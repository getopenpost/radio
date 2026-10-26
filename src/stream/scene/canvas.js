// Drawing into the palette-index frame. Everything clips to the frame.
import { bayer } from './dither.js';
import { CLEAR } from './palette.js';

export const WIDTH = 640;
export const HEIGHT = 360;

/** Parse a sprite from rows of characters; `map` turns characters into slots ('.' is clear). */
export function sprite(rows, map) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const data = new Uint8Array(w * h).fill(CLEAR);
  rows.forEach((r, y) => [...r].forEach((ch, x) => (data[y * w + x] = ch in map ? map[ch] : CLEAR)));
  return { w, h, data };
}

/** A sprite filled with one slot from a boolean mask. */
export function maskSprite(mask, slot) {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const data = new Uint8Array(w * h).fill(CLEAR);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y][x]) data[y * w + x] = slot;
  return { w, h, data };
}

export function createCanvas() {
  const index = new Uint8Array(WIDTH * HEIGHT);

  // Coordinates are floored: a fractional index into a typed array is silently ignored.
  const set = (x, y, c) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) index[(y | 0) * WIDTH + (x | 0)] = c;
  };
  const get = (x, y) => (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT ? index[(y | 0) * WIDTH + (x | 0)] : CLEAR);

  function rect(x0, y0, w, h, c) {
    const xa = Math.max(0, x0);
    const xb = Math.min(WIDTH, x0 + w);
    if (xb <= xa) return;
    for (let y = Math.max(0, y0); y < Math.min(HEIGHT, y0 + h); y++) index.fill(c, y * WIDTH + xa, y * WIDTH + xb);
  }

  /** Blit a sprite; `flip` mirrors it, `recolor` maps slots (e.g. to tint), `clipY` hides rows at or below it. */
  function draw(s, x0, y0, { flip = false, recolor = null, clipY = HEIGHT } = {}) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    for (let y = 0; y < s.h; y++) {
      const py = y0 + y;
      if (py < 0 || py >= HEIGHT || py >= clipY) continue;
      for (let x = 0; x < s.w; x++) {
        const v = s.data[y * s.w + (flip ? s.w - 1 - x : x)];
        if (v === CLEAR) continue;
        const px = x0 + x;
        if (px >= 0 && px < WIDTH) index[py * WIDTH + px] = recolor ? recolor[v] ?? v : v;
      }
    }
  }

  /** A line from (x0, y0) to (x1, y1), `w` pixels thick. */
  function line(x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (w === 1) set(x0, y0, c);
      else rect(x0, y0, w, w, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** A filled disc; `amount` < 1 dithers it. */
  function disc(cx, cy, r, c, amount = 1) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && (amount >= 1 || amount > bayer(x, y))) set(x, y, c);
      }
    }
  }

  /**
   * A dithered pool of light around (cx, cy): pixels whose slot is in `over`
   * turn into the glow slots, densest in the middle. `squash` flattens it.
   */
  function glow(cx, cy, r, strength, slots, over, squash = 1) {
    if (strength <= 0.01) return;
    const [outer, inner] = slots;
    for (let y = Math.max(0, Math.floor(cy - r * squash)); y <= Math.min(HEIGHT - 1, Math.ceil(cy + r * squash)); y++) {
      const dy = (y - cy) / squash;
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(WIDTH - 1, Math.ceil(cx + r)); x++) {
        const d = Math.sqrt((x - cx) ** 2 + dy * dy) / r;
        if (d >= 1) continue;
        const i = y * WIDTH + x;
        if (!over[index[i]]) continue;
        const t = (1 - d) * (1 - d) * strength;
        const b = bayer(x, y);
        if (t * 2.2 > b + 0.9 && inner != null) index[i] = inner;
        else if (t * 1.6 > b) index[i] = outer;
      }
    }
  }

  return { index, set, get, rect, draw, line, disc, glow };
}
