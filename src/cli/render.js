// Render a Strudel file to a float WAV.
// Usage: npm run render -- <file.strudel|-> [--cycles N | --seconds S] [--seed N] [--out file.wav]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { renderCode } from '../engine/render.js';
import { writeWav } from '../engine/wav.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cycles: { type: 'string' },
    seconds: { type: 'string' },
    seed: { type: 'string', default: '1' },
    tail: { type: 'string', default: '6' },
    out: { type: 'string' },
  },
});
const input = positionals[0];
if (!input) {
  console.error('usage: npm run render -- <file.strudel|-> [--cycles N | --seconds S] [--out file.wav]');
  process.exit(2);
}
const code = readFileSync(input === '-' ? 0 : input, 'utf8');
const started = performance.now();
const result = await renderCode(code, {
  cycles: values.cycles && Number(values.cycles),
  seconds: values.seconds && Number(values.seconds),
  seed: Number(values.seed),
  tail: Number(values.tail),
});
const out = values.out ?? (input === '-' ? 'out.wav' : input.replace(/\.[^.]+$/, '') + '.wav');
await writeWav(out, result.left, result.right, result.sampleRate);
const secs = result.left.length / result.sampleRate;
const took = (performance.now() - started) / 1000;
console.error(`${out}: ${secs.toFixed(1)}s audio, ${result.events} events, rendered in ${took.toFixed(1)}s (${(secs / took).toFixed(1)}x)`);
process.exit(0);
