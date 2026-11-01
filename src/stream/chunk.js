// Draw and encode one chunk of a planned programme, on its own CPU core.
//   node src/stream/chunk.js --plan <dir> --index <n> --output <file.ts>
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chunkArgs } from './encoder.js';
import { bayer } from './scene/dither.js';
import { createScene, HEIGHT, WIDTH } from './scene/index.js';
import { revealCoverage } from './scene/motion.js';
import { CHUNK_SECONDS, fileOf, RECORD } from './plan.js';

const { values } = parseArgs({
  options: {
    plan: { type: 'string' }, index: { type: 'string' }, output: { type: 'string' },
    scale: { type: 'string', default: '3' }, bitrate: { type: 'string', default: '6000k' }, preset: { type: 'string', default: 'veryfast' },
  },
});
const dir = values.plan;
const index = Number(values.index);
const plan = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'));
const { fps, chunkFrames, frames: total, clockStart, clockSpeed, timeZone, dayMinutes, titles } = plan;
const first = index * chunkFrames;
const last = Math.min(total, first + chunkFrames);
const spf = 48000 / fps;

const scene = createScene({ seed: 7, timeZone, dayMinutes });
scene.restore(JSON.parse(readFileSync(`${fileOf(dir, 'state', index)}.json`, 'utf8')));
const records = readFileSync(`${fileOf(dir, 'frames', index)}.bin`);

// Only the titles shown in this chunk, each with its frames counted from the chunk's start.
const shown = titles
  .map((t, i) => ({ text: t.text, from: t.from - first, to: (titles[i + 1]?.from ?? total) - first }))
  .filter((t) => t.to > 0 && t.from < last - first)
  .map((t, i) => {
    const file = join(dir, `title-${index}-${i}.txt`);
    writeFileSync(file, t.text);
    return { ...t, file };
  });

const ff = spawn('ffmpeg', chunkArgs({ fps, scale: Number(values.scale), preset: values.preset, videoBitrate: values.bitrate, titles: shown, audio: `${fileOf(dir, 'audio', index)}.aac`, offset: index * CHUNK_SECONDS, output: values.output }), { stdio: ['pipe', 'ignore', 'inherit'] });
ff.stdin.on('error', () => {});

const bands = new Float32Array(64);
const firstPicture = index > 0 && last === total ? readFileSync(join(dir, 'first.rgb')) : null;
const started = performance.now();
for (let frame = first; frame < last; frame++) {
  const o = (frame - first) * RECORD;
  for (let i = 0; i < 64; i++) bands[i] = records[o + i] / 255;
  const seconds = (frame * spf) / 48000;
  const rgb = scene.render({ time: seconds, dt: spf / 48000, date: new Date(clockStart + seconds * 1000 * clockSpeed), beat: records.readFloatLE(o + 64), bands, pillWidth: records.readUInt16LE(o + 68) });
  if (firstPicture) {
    // The last moments dissolve into the first picture, so the programme loops without a cut.
    const into = 1 - (((total - frame) * spf) / 48000) / 0.36;
    if (into > 0) for (let y = 0, p = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++, p += 3) if (bayer(x, y) < revealCoverage(x, WIDTH, into, 24)) firstPicture.copy(rgb, p, p, p + 3);
  }
  if (!ff.stdin.write(rgb)) await once(ff.stdin, 'drain');
}
ff.stdin.end();
await once(ff, 'close');
if (ff.exitCode !== 0) throw new Error(`ffmpeg exited ${ff.exitCode}`);
console.log(`chunk ${index}: ${((last - first) / ((performance.now() - started) / 1000)).toFixed(0)} fps`);
