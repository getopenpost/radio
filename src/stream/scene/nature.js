// Noise, and the animation frames in sprites.json (see scripts/build-sprites.js),
// drawn pixel for pixel. Nothing is ever scaled, so the picture sits on one grid.
import { createRequire } from 'node:module';
import { HEIGHT, WIDTH } from './canvas.js';
import { artSlot } from './palette.js';

const atlas = createRequire(import.meta.url)('./sprites.json');

/** Fast integer hash to 0..1. */
export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in 1D, around 0..1. */
export function noise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

export function fbm(x, seed = 0, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
  }
  return sum / norm;
}

/** Smooth value noise in 2D. */
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (hash(ix, iy, seed) * (1 - ux) + hash(ix + 1, iy, seed) * ux) * (1 - uy) + (hash(ix, iy + 1, seed) * (1 - ux) + hash(ix + 1, iy + 1, seed) * ux) * uy;
}

const decoded = new Map();
function sheet(name) {
  if (!decoded.has(name)) {
    const entry = atlas.sheets[name];
    if (!entry) throw new Error(`no sheet ${name}`);
    decoded.set(name, entry.sprites.map((s) => ({ ...s, data: Buffer.from(s.data, 'base64'), family: entry.family })));
  }
  return decoded.get(name);
}

/** A walking sheet's cycle: its stride on the road and where each pose's planted heel sits. */
export const walkCycleOf = (name) => atlas.sheets[name].walk;

export const sprite = (name, i) => {
  const set = sheet(name);
  return set[((i % set.length) + set.length) % set.length];
};

/**
 * An animation frame onto the canvas, placed by its cell anchor so frames of a
 * sheet stay registered. (x, y) is the middle of the cell's floor. `rows` limits
 * drawing to the frame's top rows, for laying a gesture over walking legs.
 */
export function frame(canvas, name, i, x, y, { flip = false, rows = Infinity, skip = 0, clipY = Infinity, tilt = 0 } = {}) {
  const s = sprite(name, i);
  const X = Math.round(x);
  const Y = Math.round(y);
  const { index } = canvas;
  const top = Y - s.oy - s.h + 1;
  for (let dy = skip; dy < Math.min(s.h, rows); dy++) {
    for (let dx = 0; dx < s.w; dx++) {
      const v = s.data[dy * s.w + dx];
      if (v === 255) continue;
      // A tilt drops whole columns: no pixel is resampled, so the sprite stays sharp.
      const py = top + dy + (tilt ? Math.round((dx / s.w) * tilt) : 0);
      if (py < 0 || py >= HEIGHT || py >= clipY) continue;
      const px = flip ? X - s.ox - dx : X + s.ox + dx;
      if (px >= 0 && px < WIDTH) index[py * WIDTH + px] = artSlot(s.family, v);
    }
  }
}
