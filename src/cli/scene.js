// Render stills of the stream scene at chosen wall-clock times, for checking
// the look without running the stream. Each still warms the scene up first so
// activities and weather have settled.
// Usage: npm run scene -- --at 2026-01-12T17:40 [--at ...] [--warmup 20] [--out tmp/scene]
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CHAR_WIDTH, pictureFilters } from '../stream/encoder.js';
import { createScene, HEIGHT, WIDTH } from '../stream/scene/index.js';

const { values } = parseArgs({
  options: {
    at: { type: 'string', multiple: true, default: [new Date().toISOString()] },
    warmup: { type: 'string', default: '20' },
    out: { type: 'string', default: 'tmp/scene' },
    bpm: { type: 'string', default: '90' },
    timezone: { type: 'string', default: 'Europe/Lisbon' },
    track: { type: 'string', default: 'melodic-1' },
  },
});
await mkdir(values.out, { recursive: true });
const nowPlaying = join(values.out, 'nowplaying.txt');
const title = 'Glass Lantern · melodic house';
await writeFile(nowPlaying, title);
const pillWidth = Math.round(26 + title.length * CHAR_WIDTH);
const fps = 30;
const bpm = Number(values.bpm);
for (const at of values.at) {
  const scene = createScene({ seed: 7, timeZone: values.timezone });
  const start = new Date(at).getTime();
  const frames = Math.round(Number(values.warmup) * fps);
  const bands = new Float32Array(64);
  let rgb;
  const t0 = performance.now();
  for (let f = 0; f <= frames; f++) {
    const time = f / fps;
    for (let i = 0; i < bands.length; i++) bands[i] = Math.max(0, 0.75 - i / 90 + 0.2 * Math.sin(time * 3 + i * 0.4) * Math.sin(time * 0.7 + i));
    rgb = scene.render({ time, dt: 1 / fps, date: new Date(start + time * 1000), beat: (time * bpm) / 60, bpm, bands, pillWidth, trackId: values.track });
  }
  const ms = (performance.now() - t0) / (frames + 1);
  const file = join(values.out, `${at.replaceAll(':', '-')}.png`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${WIDTH}x${HEIGHT}`, '-i', '-', '-vf', pictureFilters({ nowPlayingFile: nowPlaying, scale: 2 }), '-frames:v', '1', file], { input: rgb });
  console.log(`${file}  ${JSON.stringify(scene.state())}  ${ms.toFixed(2)} ms/frame`);
}
