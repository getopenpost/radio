// Browser globals that Strudel expects, provided for Node.
// Import this module before loading dist/strudel.js.
import 'node-web-audio-api/polyfill.js';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { cacheDir } from '../paths.js';

const noop = () => {};
const element = () =>
  Object.assign(new EventTarget(), {
    style: {},
    classList: { add: noop, remove: noop },
    appendChild: noop,
    removeChild: noop,
    setAttribute: noop,
    getContext: () => null,
  });

if (!globalThis.document) {
  globalThis.document = Object.assign(new EventTarget(), {
    createElement: element,
    getElementById: () => null,
    querySelector: () => null,
    body: element(),
    head: element(),
  });
}
const win = globalThis.window;
for (const key of ['addEventListener', 'removeEventListener', 'dispatchEvent']) {
  win[key] = EventTarget.prototype[key].bind(globalThis.document);
}
win.document = globalThis.document;
win.location = { href: 'http://localhost/', search: '', origin: 'http://localhost' };
win.localStorage ??= { getItem: () => null, setItem: noop, removeItem: noop };

// Remote samples and sample maps are cached on disk, so renders after the
// first one work offline and never depend on a CDN being up.
const networkFetch = globalThis.fetch;
const httpCache = join(cacheDir, 'http');

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!/^https?:/.test(url) || (init?.method && init.method !== 'GET')) return networkFetch(input, init);
  const file = join(httpCache, createHash('sha256').update(url).digest('hex'));
  try {
    return new Response(await readFile(file), { status: 200 });
  } catch {}
  const response = await networkFetch(url, init);
  if (!response.ok) return response;
  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(httpCache, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, file);
  return new Response(body, { status: 200 });
};

// Strudel's patterns are deterministic, but superdough uses Math.random for
// reverb impulse responses and noise. Seeding it makes renders reproducible.
let rngState = 1;
export function seedRandom(seed) {
  rngState = seed >>> 0 || 1;
}
Math.random = () => {
  // mulberry32
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
