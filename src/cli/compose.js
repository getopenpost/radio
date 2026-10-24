// Compose a track and print its Strudel code, or render it.
// Usage: npm run compose -- --style focus --seed 42 [--render out.wav] [--json]
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { composeTrack, styles } from '../compose/index.js';

const { values } = parseArgs({
  options: {
    style: { type: 'string', default: 'focus' },
    seed: { type: 'string', default: String(Date.now() % 100000) },
    render: { type: 'string' },
    code: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});
if (!styles[values.style]) {
  console.error(`unknown style ${values.style}; known: ${Object.keys(styles).join(', ')}`);
  process.exit(2);
}
const track = composeTrack({ style: values.style, seed: Number(values.seed) });
if (values.code) await writeFile(values.code, track.code);
if (values.json) {
  const { code, ...meta } = track;
  console.log(JSON.stringify(meta, null, 2));
} else if (!values.render) {
  console.log(track.code);
}
if (values.render) {
  const { renderCode } = await import('../engine/render.js');
  const { writeWav } = await import('../engine/wav.js');
  const started = performance.now();
  const audio = await renderCode(track.code, { cycles: track.bars, seed: track.seed, tail: 8 });
  await writeWav(values.render, audio.left, audio.right, audio.sampleRate);
  const seconds = audio.left.length / audio.sampleRate;
  console.error(`${track.title} (${track.id}): ${seconds.toFixed(0)}s, rendered in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
}
