// Builds one library track: compose, render, master, write metadata.
// Run as a child process by the library CLI: node worker.js <style> <seed> <libraryDir>
import { mkdir, rm, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { composeTrack } from '../compose/index.js';
import { renderCode } from '../engine/render.js';
import { writeWav } from '../engine/wav.js';
import { decodeAudio } from '../audio/decode.js';
import { analyze } from '../audio/metrics.js';
import { master } from './master.js';

const [style, seedText, libraryDir] = process.argv.slice(2);
const seed = Number(seedText);
const started = performance.now();
const track = composeTrack({ style, seed });
const tracksDir = join(libraryDir, 'tracks');
await mkdir(tracksDir, { recursive: true });
const wav = join(tmpdir(), `rgo-music-${track.id}-${process.pid}.wav`);
try {
  const audio = await renderCode(track.code, { cycles: track.bars, seed, tail: 8 });
  await writeWav(wav, audio.left, audio.right, audio.sampleRate);
  const flac = join(tracksDir, `${track.id}.flac`);
  const partial = `${flac}.partial`;
  const loudness = await master(wav, partial, { presence: track.presence });
  const metrics = analyze(await decodeAudio(partial));
  await rename(partial, flac);
  const { code, ...meta } = track;
  const record = {
    ...meta,
    seconds: loudness.seconds,
    lufs: loudness.lufs,
    truePeak: loudness.truePeak,
    metrics: {
      centroidHz: Math.round(metrics.centroidHz),
      lowShare: Number(metrics.lowShare.toFixed(1)),
      sideToMidDb: Number(metrics.sideToMidDb.toFixed(1)),
      lowFloorDb: Number(metrics.lowFloorDb.toFixed(1)),
      bedGapsPct: Number(metrics.bedGapsPct.toFixed(1)),
    },
    renderRetries: audio.retries,
    renderSeconds: Math.round((performance.now() - started) / 1000),
    createdAt: new Date().toISOString(),
  };
  await writeFile(join(tracksDir, `${track.id}.strudel`), code);
  await writeFile(join(tracksDir, `${track.id}.json`), JSON.stringify(record, null, 2) + '\n');
  process.stdout.write(JSON.stringify(record) + '\n');
} finally {
  await rm(wav, { force: true });
}
process.exit(0);
