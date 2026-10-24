// Compare mix metrics across audio files.
// Usage: npm run analyze -- <file>[@start+duration] ... [--json]
// Example: npm run analyze -- ref.opus@600+180 library/tracks/abc.flac
import { basename } from 'node:path';
import { decodeAudio } from '../audio/decode.js';
import { analyze, formatComparison } from '../audio/metrics.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const results = {};
for (const arg of args.filter((a) => a !== '--json')) {
  const [, path, start, duration] = arg.match(/^(.*?)(?:@(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?))?$/);
  const audio = await decodeAudio(path, { start: start && Number(start), duration: duration && Number(duration) });
  results[basename(path) + (start ? `@${start}` : '')] = analyze(audio);
}
console.log(json ? JSON.stringify(results, null, 2) : formatComparison(results));
