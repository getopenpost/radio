// Render stills of the stream scene at chosen wall-clock times, for checking
// the look without running the stream.
// Usage: npm run scene -- --at 2026-01-12T17:40 [--at ...] [--warmup 2] [--out tmp/scene]
//   --place walks to the next alpine, meadow, lake, coast, forest or valley
//   country, or the next bike, row, sail, broom, workout or scope event.
//   --season spring|summer|autumn|winter picks where in the year to look.
//   --weather clear|cloudy|rain|snow|fog|windy forces the weather.
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chipAt, createChipText, pillFor } from '../stream/chip.js';
import { createPacker, FRAME, pictureGraph } from '../stream/encoder.js';
import { createScene } from '../stream/scene/index.js';
import { distanceAt, findPlace, YEAR } from '../stream/scene/journey.js';

const { values } = parseArgs({
  options: {
    at: { type: 'string', multiple: true, default: [new Date().toISOString()] },
    warmup: { type: 'string', default: '2' },
    place: { type: 'string' },
    season: { type: 'string' },
    weather: { type: 'string' },
    out: { type: 'string', default: 'tmp/scene' },
    timezone: { type: 'string', default: 'Europe/Lisbon' },
  },
});
await mkdir(values.out, { recursive: true });
const title = 'Glass Lantern · melodic house';
const pillWidth = pillFor(title);
const chipText = createChipText(3);
const pack = createPacker();
const fps = 30;
for (const at of values.at) {
  const scene = createScene({ seed: 7, timeZone: values.timezone });
  const start = new Date(at).getTime();
  const frames = Math.round(Number(values.warmup) * fps);
  const quarter = { spring: 0.1, summer: 0.35, autumn: 0.6, winter: 0.85 }[values.season];
  let from = distanceAt(new Date(start));
  if (quarter != null) from = Math.floor(from / YEAR) * YEAR + quarter * YEAR;
  const event = values.place ? findPlace(values.place, from) : null;
  const steer = { at: event ? (event.a + event.b) / 2 : from, weather: values.weather ? { previous: values.weather, current: values.weather, mix: 1 } : undefined };
  const bands = new Float32Array(64);
  let rgb;
  const t0 = performance.now();
  for (let f = 0; f <= frames; f++) {
    const time = f / fps;
    for (let i = 0; i < bands.length; i++) bands[i] = Math.max(0, 0.75 - i / 90 + 0.2 * Math.sin(time * 3 + i * 0.4) * Math.sin(time * 0.7 + i));
    rgb = scene.render({ time, dt: 1 / fps, date: new Date(start + time * 1000), beat: time * 2, bands, pillWidth, steer });
  }
  const ms = (performance.now() - t0) / (frames + 1);
  const file = join(values.out, `${at.replaceAll(':', '-')}.png`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${FRAME.width}x${FRAME.height}`, '-i', '-', '-filter_complex', pictureGraph({ scale: 3, fps }), '-map', '[picture]', '-frames:v', '1', file], { input: pack(rgb, chipText.draw(chipAt([{ from: 0, text: title }], 0, fps))) });
  console.log(`${file}  ${JSON.stringify(scene.state())}  ${ms.toFixed(2)} ms/frame`);
}
