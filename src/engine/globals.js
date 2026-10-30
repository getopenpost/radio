// Browser globals that Strudel expects, provided for Node.
// Import this module before loading dist/strudel.js.
import 'node-web-audio-api/polyfill.js';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  if (url.startsWith('file:')) return new Response(await readFile(fileURLToPath(url)), { status: 200 });
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

// node-web-audio-api's decoder rejects some WAV variants browsers accept (for
// example several VCSL samples). Fall back to ffmpeg for those.
const nativeDecode = BaseAudioContext.prototype.decodeAudioData;
BaseAudioContext.prototype.decodeAudioData = async function (data, onSuccess, onError) {
  const copy = data.slice(0); // decoding detaches the original
  try {
    const buffer = await nativeDecode.call(this, data);
    onSuccess?.(buffer);
    return buffer;
  } catch (nativeError) {
    try {
      const buffer = await ffmpegDecode(this, Buffer.from(copy));
      onSuccess?.(buffer);
      return buffer;
    } catch {
      onError?.(nativeError);
      throw nativeError;
    }
  }
};

function ffmpegDecode(context, input) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '2', '-ar', String(context.sampleRate), 'pipe:1']);
    const chunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffmpeg could not decode sample'));
      const raw = Buffer.concat(chunks);
      const all = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
      const frames = all.length / 2;
      const buffer = context.createBuffer(2, Math.max(frames, 1), context.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const channel = new Float32Array(frames);
        for (let i = 0; i < frames; i++) channel[i] = all[2 * i + ch];
        buffer.copyToChannel(channel, ch);
      }
      resolve(buffer);
    });
    ff.stdin.on('error', () => {});
    ff.stdin.end(input);
  });
}
