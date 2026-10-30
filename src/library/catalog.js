// The library on disk: tracks/<id>.{flac,json,strudel} plus catalog.json.
import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

// How much of the library each style makes up, roughly in the proportion of the
// reference mixes: mostly house, with slow soul as the long rest between runs.
export const STYLE_WEIGHTS = { melodic: 42, deep: 22, broken: 10, slow: 26 };

export async function trackIds(dir) {
  try {
    return new Set((await readdir(join(dir, 'tracks'))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
  } catch {
    return new Set();
  }
}

/** Rebuild catalog.json from the per-track metadata files. */
export async function writeCatalog(dir) {
  const tracks = [];
  for (const id of [...(await trackIds(dir))].sort()) {
    tracks.push(JSON.parse(await readFile(join(dir, 'tracks', `${id}.json`), 'utf8')));
  }
  const tmp = join(dir, 'catalog.json.partial');
  await writeFile(tmp, JSON.stringify({ updatedAt: new Date().toISOString(), tracks }, null, 1) + '\n');
  await rename(tmp, join(dir, 'catalog.json'));
  return tracks;
}

export async function readCatalog(dir) {
  return JSON.parse(await readFile(join(dir, 'catalog.json'), 'utf8')).tracks;
}
