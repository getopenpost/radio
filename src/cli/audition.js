// Listen to the generator with earshot (https://github.com/Leonxlnx/earshot):
// render the first main section of a few seeds per style, level-match the
// excerpts, then score how well each matches its style description, how
// it fares against "generic" alternatives, and how produced it sounds.
// Usage: npm run audition -- [--styles focus,lofi] [--seeds 1,2] [--label before]
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { rootDir } from '../paths.js';

export const DESCRIPTIONS = {
  focus: 'deep bass-led downtempo electronic focus music',
  lofi: 'relaxing lofi hip hop beat with warm jazzy keys',
  house: 'deep chill house music',
  garage: 'future garage music with shuffled beats and reese bass',
  wave: 'dreamy synthwave night drive music',
  ambient: 'calm ambient music with soft evolving pads',
};
const ALTERNATIVES = ['cheap generic synthesizer demo', 'corporate background music', 'video game music'];
const EARSHOT = ['--python', '3.12', '--from', 'earshot@git+https://github.com/Leonxlnx/earshot@591fa3e028032e6dce56620a20e932e35667e8d8', 'earshot'];

const { values } = parseArgs({
  options: {
    styles: { type: 'string', default: Object.keys(DESCRIPTIONS).join(',') },
    seeds: { type: 'string', default: '1,2' },
    bars: { type: 'string', default: '24' },
    label: { type: 'string', default: 'run' },
    jobs: { type: 'string', default: String(Math.max(1, availableParallelism() - 2)) },
    worker: { type: 'string' },
  },
});

if (values.worker) {
  // Child process: render one excerpt to the given path.
  const [style, seed, out] = values.worker.split('|');
  const { composeTrack } = await import('../compose/index.js');
  const { renderCode } = await import('../engine/render.js');
  const { writeWav } = await import('../engine/wav.js');
  const track = composeTrack({ style, seed: Number(seed) });
  const intro = Math.round((track.introSeconds * track.bpm) / 240);
  const audio = await renderCode(track.code, { cycles: intro + Number(values.bars), seed: Number(seed), tail: 0 });
  const from = Math.round((intro * 240 * audio.sampleRate) / track.bpm);
  const raw = `${out}.raw.wav`;
  await writeWav(raw, audio.left.subarray(from), audio.right.subarray(from), audio.sampleRate);
  const ff = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5', '-ar', '48000', out]);
  await rm(raw, { force: true });
  if (ff.status !== 0) throw new Error(String(ff.stderr));
  process.exit(0);
}

const dir = join(rootDir, 'tmp', 'audition', values.label);
await mkdir(dir, { recursive: true });
const jobs = values.styles.split(',').flatMap((style) => values.seeds.split(',').map((seed) => ({ style, seed, file: join(dir, `${style}-${seed}.wav`) })));
const self = fileURLToPath(import.meta.url);
const queue = [...jobs];
await Promise.all(
  Array.from({ length: Math.min(Number(values.jobs), queue.length) }, async () => {
    for (let job; (job = queue.shift()); ) {
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [self, '--worker', `${job.style}|${job.seed}|${job.file}`, '--bars', values.bars], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr.on('data', (c) => (err += c));
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${job.style}-${job.seed}: ${err.slice(-500)}`))));
      });
      process.stderr.write(`rendered ${job.style}-${job.seed}\n`);
    }
  }),
);

const earshot = (args) => {
  const r = spawnSync('uvx', [...EARSHOT, ...args, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`earshot ${args[0]} failed: ${r.stderr.slice(-800)}`);
  return JSON.parse(r.stdout);
};
const realness = [earshot(['realness', ...jobs.map((j) => j.file)])].flat().flatMap((r) => r.files ?? r.results ?? [r]);
const results = jobs.map((job) => ({
  job,
  match: earshot(['match', job.file, DESCRIPTIONS[job.style], '--alts', ...ALTERNATIVES]),
  realness: realness.find((r) => r.path?.endsWith(`${job.style}-${job.seed}.wav`)),
}));
await writeFile(join(dir, 'results.json'), JSON.stringify(results, null, 2));
console.log(summarize(results));

function summarize(rows) {
  const lines = ['style    seed   match z   target%   p_real   sounds most like'];
  for (const { job, match, realness } of rows) {
    const z = match.z;
    const target = match.p_vs_alts;
    const real = realness?.p_real ?? NaN;
    const like = (match.closest_vocab ?? []).slice(0, 3).map((v) => v.term).join(', ');
    lines.push(`${job.style.padEnd(8)} ${String(job.seed).padEnd(6)} ${num(z).padStart(7)} ${num(target * 100, 0).padStart(8)} ${num(real).padStart(8)}   ${like}`);
  }
  return lines.join('\n');
}
function num(x, d = 2) {
  return Number.isFinite(x) ? x.toFixed(d) : '?';
}
