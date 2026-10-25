// Where tracks come from: a local library directory, or a base URL (for
// example a public S3/R2 bucket) whose files are cached locally just before
// they play. The cache keeps only a few tracks, so the streaming host needs
// little disk.
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function createSource({ dir, url, cacheDir, keep = 6 }) {
  if (url) url = url.replace(/\/$/, '');
  let catalog = [];
  let catalogStamp = '';

  async function refresh() {
    try {
      const text = url ? await (await fetch(`${url}/catalog.json`, { cache: 'no-store' })).text() : await readFile(join(dir, 'catalog.json'), 'utf8');
      const parsed = JSON.parse(text);
      if (parsed.updatedAt !== catalogStamp && parsed.tracks?.length) {
        catalog = parsed.tracks;
        catalogStamp = parsed.updatedAt;
      }
    } catch (err) {
      if (!catalog.length) throw new Error(`cannot load catalog: ${err.message}`);
      console.error(`catalog refresh failed, keeping ${catalog.length} tracks: ${err.message}`);
    }
    return catalog;
  }

  /** Local path of a track's audio, downloading it first when the library is remote. */
  async function audioPath(track) {
    if (!url) return join(dir, 'tracks', `${track.id}.flac`);
    await mkdir(cacheDir, { recursive: true });
    const file = join(cacheDir, `${track.id}.flac`);
    try {
      await stat(file);
      return file;
    } catch {}
    const response = await fetch(`${url}/tracks/${track.id}.flac`);
    if (!response.ok) throw new Error(`download ${track.id}: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(`${file}.partial`));
    await rename(`${file}.partial`, file);
    await prune(file);
    return file;
  }

  async function prune(keepFile) {
    const files = await Promise.all(
      (await readdir(cacheDir)).filter((f) => f.endsWith('.flac')).map(async (f) => ({ f: join(cacheDir, f), t: (await stat(join(cacheDir, f))).mtimeMs })),
    );
    files.sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(keep)) if (f !== keepFile) await rm(f, { force: true });
  }

  return { refresh, audioPath };
}
