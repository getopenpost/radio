// Reduce the painted backdrop plates in assets/scene/plates onto the scene's pixel
// grid and pack them, with one shared palette, into src/stream/scene/plates.bin.
// Needs ffmpeg. Run after changing a plate: node scripts/build-plates.js
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const ROOT = new URL('../assets/scene/', import.meta.url).pathname;
// Each family's width in scene pixels; it fixes how large the painting sits on screen.
const FAMILIES = { plates: 760, near: 800, front: 620 };
const COLOURS = 254;

function load(file) {
  const size = spawnSync('ffmpeg', ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr.match(/, (\d+)x(\d+)/);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 29 });
  return { w: Number(size[1]), h: Number(size[2]), rgb: raw.stdout };
}
const isKey = (r, g, b) => b > g + 30 && r > g + 45;

/** Commonest colour of each block; sky stays clear, and specks of sky inside the land are filled. */
function reduce(img, WIDE) {
  const f = img.w / WIDE;
  const H = Math.floor(img.h / f);
  const px = new Int32Array(WIDE * H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < WIDE; x++) {
      const bins = new Map();
      let clear = 0;
      let n = 0;
      for (let sy = Math.round(y * f); sy < Math.round((y + 1) * f); sy++) {
        for (let sx = Math.round(x * f); sx < Math.round((x + 1) * f); sx++) {
          const i = (sy * img.w + sx) * 3;
          const [r, g, b] = [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
          n++;
          if (isKey(r, g, b)) {
            clear++;
            continue;
          }
          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
          bin.n++;
          bin.r += r;
          bin.g += g;
          bin.b += b;
          bins.set(key, bin);
        }
      }
      if (clear >= n * 0.5 || !bins.size) continue;
      let best = null;
      for (const b of bins.values()) if (!best || b.n > best.n) best = b;
      px[y * WIDE + x] = (Math.round(best.r / best.n) << 16) | (Math.round(best.g / best.n) << 8) | Math.round(best.b / best.n);
    }
  }
  anchor(px, WIDE, H);
  return { H, px };
}

/** Land must stand on something: anything not joined to the bottom edge is a stray, and is dropped. */
function anchor(px, W, H) {
  const seen = new Uint8Array(W * H);
  const stack = [];
  const visit = (i) => {
    if (px[i] >= 0 && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) visit((H - 1) * W + x);
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    if (x > 0) visit(i - 1);
    if (x < W - 1) visit(i + 1);
    if (i >= W) visit(i - W);
    if (i + W < px.length) visit(i + W);
  }
  for (let i = 0; i < px.length; i++) if (!seen[i]) px[i] = -1;
}

function medianCut(counts, n) {
  let boxes = [[...counts.entries()].map(([c, k]) => ({ c: [c >> 16, (c >> 8) & 255, c & 255], k }))];
  while (boxes.length < n) {
    let bi = -1, axis = 0, span = -1;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let a = 0; a < 3; a++) {
        let lo = 255, hi = 0, t = 2;
        for (const p of b) {
          lo = Math.min(lo, p.c[a]);
          hi = Math.max(hi, p.c[a]);
          t += p.k;
        }
        const s = (hi - lo) * Math.log2(t);
        if (s > span) [span, bi, axis] = [s, i, a];
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p.c[axis] - q.c[axis]);
    const total = b.reduce((t, p) => t + p.k, 0);
    let run = 0, m = 1;
    for (; m < b.length - 1; m++) if ((run += b[m - 1].k) >= total / 2) break;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.map((b) => {
    const t = b.reduce((s, p) => s + p.k, 0);
    return [0, 1, 2].map((a) => Math.round(b.reduce((s, p) => s + p.c[a] * p.k, 0) / t));
  });
}

const plates = Object.entries(FAMILIES).flatMap(([family, wide]) => readdirSync(ROOT + family).filter((f) => f.endsWith('.png')).sort().map((f) => {
  const r = reduce(load(`${ROOT}${family}/${f}`), wide);
  return { family, name: `${family}/${f.replace('.png', '')}`, w: wide, ...r };
}));

/** Each family gets its own palette, so near greens and oranges are not spent on distant haze. */
function paletteFor(list) {
  const counts = new Map();
  for (const p of list) {
    for (const c of p.px) {
      if (c < 0) continue;
      const q = c & 0xf8f8f8;
      counts.set(q, (counts.get(q) ?? 0) + 1);
    }
  }
  const palette = medianCut(counts, COLOURS);
  const memo = new Map();
  const nearest = (c) => {
    if (!memo.has(c)) {
      const [r, g, b] = [c >> 16, (c >> 8) & 255, c & 255];
      let best = 0, bd = Infinity;
      palette.forEach((p, i) => {
        const d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
        if (d < bd) [bd, best] = [d, i];
      });
      memo.set(c, best);
    }
    return memo.get(c);
  };
  return { palette, nearest };
}
const packs = Object.fromEntries(Object.keys(FAMILIES).map((family) => [family, paletteFor(plates.filter((p) => p.family === family))]));
const index = plates.map((p) => ({ name: p.name, family: p.family, w: p.w, h: p.H }));
const palettes = Object.fromEntries(Object.entries(packs).map(([family, { palette }]) => [family, palette.map((p) => '#' + p.map((v) => v.toString(16).padStart(2, '0')).join(''))]));
const header = Buffer.from(JSON.stringify({ palettes, plates: index }));
const body = Buffer.concat(plates.map((p) => Buffer.from(Array.from(p.px, (c) => (c < 0 ? 255 : packs[p.family].nearest(c))))));
const length = Buffer.alloc(4);
length.writeUInt32LE(header.length);
const packed = gzipSync(Buffer.concat([length, header, body]), { level: 9 });
writeFileSync(new URL('../src/stream/scene/plates.bin', import.meta.url), packed);
console.log('plates.bin', (packed.length / 1e6).toFixed(1), 'MB');
