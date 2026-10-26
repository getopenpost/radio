// The 24/7 stream: picks tracks, crossfades them, draws the scene and feeds
// ffmpeg in real time.
//
// Usage:
//   RGO_MUSIC_OUTPUTS="rtmp://a.rtmp.youtube.com/live2/<key> rtmp://live.twitch.tv/app/<key>" npm run stream
//   npm run stream -- --output tmp/preview.mp4 --duration 120   (renders a file as fast as possible)
//   npm run stream -- --output tmp/tour.mp4 --tour   (a twelve-minute fast-forward through every scene)
// --output can repeat; RGO_MUSIC_OUTPUTS takes several separated by whitespace.
// Options: --library <dir> | --library-url <url>, --fps 30, --preset veryfast,
//          --bitrate 4500k, --scale 3 (1080p; 2 = 720p), --state <dir>,
//          --timezone Europe/Lisbon. Each has an RGO_MUSIC_* variable too.
//          Previews can set the scene's clock: --clock 2026-01-12T17:40 (start
//          time) and --clock-speed 60 (minutes per second of video, for sky checks).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createRng } from '../compose/rng.js';
import { cacheDir, libraryDir } from '../paths.js';
import { openDeck } from './deck.js';
import { createDirector } from './director.js';
import { CHAR_WIDTH, isRtmp, startEncoder } from './encoder.js';
import { createScene, HEIGHT, WIDTH } from './scene/index.js';
import { bayer } from './scene/dither.js';
import { createSource } from './source.js';
import { createTour, TOUR_SECONDS } from './tour.js';
import { createSpectrum } from './spectrum.js';

const SR = 48000;
const { values } = parseArgs({
  options: {
    output: { type: 'string', multiple: true, default: (process.env.RGO_MUSIC_OUTPUTS ?? '').split(/\s+/).filter(Boolean) },
    library: { type: 'string', default: libraryDir },
    'library-url': { type: 'string', default: process.env.RGO_MUSIC_LIBRARY_URL },
    state: { type: 'string', default: process.env.RGO_MUSIC_STATE ?? join(cacheDir, 'stream') },
    fps: { type: 'string', default: process.env.RGO_MUSIC_FPS ?? '30' },
    preset: { type: 'string', default: process.env.RGO_MUSIC_X264_PRESET ?? 'veryfast' },
    bitrate: { type: 'string', default: process.env.RGO_MUSIC_VIDEO_BITRATE ?? '4500k' },
    scale: { type: 'string', default: process.env.RGO_MUSIC_SCALE ?? '3' },
    duration: { type: 'string' },
    tour: { type: 'boolean', default: false },
    clock: { type: 'string' },
    'clock-speed': { type: 'string', default: '1' },
    timezone: { type: 'string', default: process.env.RGO_MUSIC_TIMEZONE ?? 'Europe/Lisbon' },
  },
});
if (!values.output.length) {
  console.error('set RGO_MUSIC_OUTPUTS or pass --output <file or rtmp url>');
  process.exit(2);
}
const fps = Number(values.fps);
const spf = SR / fps;
if (!Number.isInteger(spf)) throw new Error(`fps must divide 48000 (got ${fps})`);
const realtime = values.output.some(isRtmp);
const stopAfter = values.duration ? Number(values.duration) * SR : values.tour ? TOUR_SECONDS * SR : Infinity;

await mkdir(values.state, { recursive: true });
const nowPlayingFile = join(values.state, 'nowplaying.txt');
const historyFile = join(values.state, 'history.json');
const history = await readFile(historyFile, 'utf8').then(JSON.parse, () => []);

const source = createSource({ dir: values.library, url: values['library-url'], cacheDir: join(values.state, 'cache') });
let catalog = await source.refresh();
const director = createDirector({ rng: createRng(Date.now() >>> 0), history });
const scene = createScene({ seed: 7, timeZone: values.timezone });
const spectrum = createSpectrum();

const overlapOf = (a, b) => Math.round(Math.min(24, Math.max(6, Math.min(a.outroSeconds ?? 8, b.introSeconds ?? 8))) * SR);

async function load(track, start) {
  const deck = openDeck(await source.audioPath(track));
  await deck.ready();
  return { track, deck, start, frames: Math.round(track.seconds * SR) };
}

async function writeNowPlaying(track) {
  const text = `${track.title} · ${track.styleLabel}`.slice(0, 48);
  await writeFile(`${nowPlayingFile}.tmp`, text);
  await rename(`${nowPlayingFile}.tmp`, nowPlayingFile);
  return text;
}

let current = await load(director.next(catalog, null), 0);
let next = null;
let nextLoading = null;
let shown = null;
let pillWidth = 0;
await writeNowPlaying(current.track).then((text) => {
  shown = current.track.id;
  pillWidth = Math.round(26 + text.length * CHAR_WIDTH);
});
console.log(`playing ${current.track.id} "${current.track.title}"`);

let encoder = startEncoder({ outputs: values.output, fps, nowPlayingFile, scale: Number(values.scale), preset: values.preset, videoBitrate: values.bitrate });
const mix = new Float32Array(spf * 2);
const gainA = new Float32Array(spf);
const gainB = new Float32Array(spf);
const started = performance.now();
const clockStart = values.clock ? new Date(values.clock).getTime() : null;
const clockSpeed = Number(values['clock-speed']);
// Live streams follow the wall clock; previews can start anywhere and run fast.
const sceneDate = (seconds) => (clockStart == null ? new Date() : new Date(clockStart + seconds * 1000 * clockSpeed));
// Tour mode: the script picks date and stops, and runs the scene faster between them.
const tour = values.tour ? createTour() : null;
let tourTime = 0;
let tourScene = -1;
const lastFrame = tour ? Buffer.alloc(WIDTH * HEIGHT * 3) : null;
const cutFrom = tour ? Buffer.alloc(WIDTH * HEIGHT * 3) : null;

for (let frame = 0, t = 0; t < stopAfter; frame++, t += spf) {
  // Line up the next track about half a minute before the crossfade.
  const fadeStart = next ? next.start : current.start + current.frames - (current.frames >> 3);
  if (!next && !nextLoading && t >= current.start + current.frames - 40 * SR) {
    catalog = await source.refresh();
    const track = director.next(catalog, current.track);
    const overlap = overlapOf(current.track, track);
    nextLoading = load(track, current.start + current.frames - overlap)
      .then((deck) => (next = deck))
      .catch((err) => console.error(`could not load ${track.id}: ${err.message}`))
      .finally(() => (nextLoading = null));
    await writeFile(historyFile, JSON.stringify(director.history().slice(-2000)));
  }
  if (!next && nextLoading && t + spf >= fadeStart) await nextLoading; // never start a fade without the next deck

  // Equal-power crossfade, computed per sample.
  const overlap = next ? current.start + current.frames - next.start : 0;
  for (let i = 0; i < spf; i++) {
    const s = t + i;
    if (next && s >= next.start) {
      const p = Math.min(1, (s - next.start) / overlap);
      gainA[i] = Math.cos((p * Math.PI) / 2);
      gainB[i] = Math.sin((p * Math.PI) / 2);
    } else {
      gainA[i] = 1;
      gainB[i] = 0;
    }
  }
  mix.fill(0);
  current.deck.mixInto(mix, spf, gainA);
  if (next && t + spf > next.start) next.deck.mixInto(mix, spf, gainB, Math.max(0, next.start - t));

  // The picture follows whichever track is louder.
  const active = next && t >= next.start + overlap / 2 ? next : current;
  if (active.track.id !== shown) {
    shown = active.track.id;
    const text = await writeNowPlaying(active.track);
    pillWidth = Math.round(26 + text.length * CHAR_WIDTH);
    console.log(`now playing ${active.track.id} "${active.track.title}"`);
  }
  let rgb;
  if (tour) {
    const step = tour(t / SR, scene.state());
    if (step.scene !== tourScene) {
      tourScene = step.scene;
      cutFrom.set(lastFrame);
      console.log(`tour ${(t / SR).toFixed(0)}s: ${step.title}`);
    }
    const dt = (spf / SR) * step.rate;
    tourTime += dt;
    rgb = scene.render({ time: tourTime, dt, date: step.date, beat: (tourTime * active.track.bpm) / 60, bpm: active.track.bpm, bands: spectrum.update(mix), pillWidth, steer: step.steer });
    // A jump in time dissolves through the Bayer pattern from the last picture.
    if (step.cut != null) {
      for (let y = 0, o = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++, o += 3) if (bayer(x >> 1, y >> 1) >= step.cut) cutFrom.copy(rgb, o, o, o + 3);
    }
    lastFrame.set(rgb);
  } else {
    rgb = scene.render({
      time: t / SR,
      dt: spf / SR,
      date: sceneDate(t / SR),
      beat: Math.max(0, ((t - active.start) / SR) * (active.track.bpm / 60)),
      bpm: active.track.bpm,
      bands: spectrum.update(mix),
      pillWidth,
      trackId: active.track.id,
    });
  }
  await encoder.frame(rgb, mix);
  if (!encoder.alive) {
    if (!realtime) throw new Error('ffmpeg exited early');
    // RTMP dropped: reconnect and carry on where the music is.
    console.error('encoder exited, reconnecting in 5s');
    await new Promise((r) => setTimeout(r, 5000));
    encoder = startEncoder({ outputs: values.output, fps, nowPlayingFile, scale: Number(values.scale), preset: values.preset, videoBitrate: values.bitrate });
  }

  // The old deck is done once the crossfade completes.
  if (next && t + spf >= current.start + current.frames) {
    current.deck.close();
    current = next;
    next = null;
  }
  if (realtime) {
    const due = started + ((frame + 1) * 1000) / fps;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    else if (wait < -2000 && frame % fps === 0) console.error(`running ${(-wait / 1000).toFixed(1)}s behind real time`);
  }
}
current.deck.close();
next?.deck.close();
await encoder.close();
console.log(`wrote ${(stopAfter / SR).toFixed(0)}s to ${values.output.join(', ')} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
