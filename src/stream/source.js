// Local NAS library or HTTP library with an atomic, bounded disk buffer.
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function createSource({ dir, url, cacheDir, keep = 12 }) {
  if (url) url = url.replace(/\/$/, '');
  let catalog = [];
  let protectedIds = new Set();
  const downloads = new Map();
  const fetchFile = (path) => fetch(`${url}/${path}`, { signal: AbortSignal.timeout(90000), cache: 'no-store' });

  async function refresh() {
    try {
      let text;
      if (url) {
        const response = await fetchFile('catalog.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        text = await response.text();
      } else text = await readFile(join(dir, 'catalog.json'), 'utf8');
      const parsed = JSON.parse(text);
      if (!parsed.tracks?.length || parsed.tracks.some((t) => !/^[a-z0-9-]+$/.test(t.id) || !(t.seconds > 0))) throw new Error('invalid or empty catalog');
      catalog = parsed.tracks;
      if (url) {
        await mkdir(cacheDir, { recursive: true });
        await writeFile(join(cacheDir, 'catalog.json.partial'), text);
        await rename(join(cacheDir, 'catalog.json.partial'), join(cacheDir, 'catalog.json'));
      }
    } catch (err) {
      if (!catalog.length && url) catalog = await readFile(join(cacheDir, 'catalog.json'), 'utf8').then((s) => JSON.parse(s).tracks, () => []);
      if (!catalog.length) throw new Error(`cannot load catalog: ${err.message}`);
      console.error(`catalog refresh failed, keeping ${catalog.length} tracks: ${err.message}`);
    }
    return catalog;
  }

  async function audioPath(track) {
    if (!/^[a-z0-9-]+$/.test(track.id)) throw new Error('invalid track id');
    if (!url) return join(dir, 'tracks', `${track.id}.flac`);
    if (downloads.has(track.id)) return downloads.get(track.id);
    const download = (async () => {
      await mkdir(cacheDir, { recursive: true });
      const file = join(cacheDir, `${track.id}.flac`);
      if (await stat(file).then((s) => s.size > 0, () => false)) return file;
      const partial = `${file}.partial`;
      try {
        const response = await fetchFile(`tracks/${track.id}.flac`);
        if (!response.ok) throw new Error(`download ${track.id}: HTTP ${response.status}`);
        await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
        await rename(partial, file);
        return file;
      } catch (err) {
        await rm(partial, { force: true });
        throw err;
      }
    })();
    downloads.set(track.id, download);
    try { return await download; } finally { downloads.delete(track.id); }
  }

  async function prefetch(tracks) {
    protectedIds = new Set(tracks.filter(Boolean).map((t) => t.id));
    const pending = tracks.filter(Boolean);
    // Two transfers at a time, without loading whole songs into RAM.
    await Promise.all(Array.from({ length: Math.min(2, pending.length) }, async () => {
      while (pending.length) await audioPath(pending.shift());
    }));
    if (!url) return;
    const files = await Promise.all((await readdir(cacheDir)).filter((f) => f.endsWith('.flac')).map(async (f) => ({ f, t: (await stat(join(cacheDir, f))).mtimeMs })));
    files.sort((a, b) => b.t - a.t);
    const extra = Math.max(0, keep - protectedIds.size);
    let retained = 0;
    for (const { f } of files) if (!protectedIds.has(f.slice(0, -5)) && !downloads.has(f.slice(0, -5)) && retained++ >= extra) await rm(join(cacheDir, f), { force: true });
  }

  return { refresh, audioPath, prefetch };
}
