// Build or extend the track library.
// Usage: npm run library -- [--count 20] [--styles focus,lofi] [--jobs N] [--dir library]
//        npm run library -- --catalog   (only rebuild catalog.json)
// Tracks already in the library are skipped, so the command is resumable.
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { libraryDir } from '../paths.js';
import { styles } from '../compose/index.js';
import { createRng } from '../compose/rng.js';
import { STYLE_WEIGHTS, trackIds, writeCatalog } from '../library/catalog.js';

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '12' },
    styles: { type: 'string' },
    jobs: { type: 'string', default: String(Math.max(1, availableParallelism() - 2)) },
    dir: { type: 'string', default: libraryDir },
    seed: { type: 'string', default: String(Date.now()) },
    catalog: { type: 'boolean', default: false },
  },
});
const dir = values.dir;
const worker = fileURLToPath(new URL('../library/worker.js', import.meta.url));

if (!values.catalog) {
  const allowed = values.styles ? values.styles.split(',') : Object.keys(STYLE_WEIGHTS);
  for (const s of allowed) if (!styles[s]) throw new Error(`unknown style ${s}`);
  const have = await trackIds(dir);
  const rng = createRng(Number(values.seed));
  const jobs = [];
  while (jobs.length < Number(values.count)) {
    const style = rng.weighted(allowed.map((s) => [STYLE_WEIGHTS[s] ?? 10, s]));
    const seed = rng.int(1, 999999);
    if (!have.has(`${style}-${seed}`)) jobs.push({ style, seed });
  }
  let done = 0;
  let failed = 0;
  const run = ({ style, seed }) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [worker, style, String(seed), dir], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      child.stdout.on('data', (c) => (out += c));
      child.stderr.on('data', (c) => (err += c));
      child.on('close', (code) => {
        if (code === 0) {
          const t = JSON.parse(out.trim().split('\n').at(-1));
          done++;
          console.log(`[${done + failed}/${jobs.length}] ${t.id} "${t.title}" ${t.bpm} bpm ${t.key.name} ${Math.round(t.seconds)}s in ${t.renderSeconds}s`);
        } else {
          failed++;
          const reason = err.split('\n').filter((l) => /^\w*Error\b|Error:/.test(l.trim())).at(-1) ?? err.slice(-300);
          console.error(`[${done + failed}/${jobs.length}] ${style}-${seed} failed: ${reason}`);
        }
        resolve();
      });
    });
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(Number(values.jobs), queue.length) }, async () => {
      while (queue.length) await run(queue.shift());
    }),
  );
  console.log(`built ${done} tracks, ${failed} failed`);
}
console.log(`catalog: ${(await writeCatalog(dir)).length} tracks in ${join(dir, 'catalog.json')}`);
