// What the fox sees, opened in a panel above the scene: its laptop screen
// (a code editor, an email being written and sent, a team chat, a study app
// with a rotating dithered globe), the book it is reading, the water under
// its fishing line, the sky through its telescope. Panels dissolve in and out
// through the dither and are tied to the fox by a few thought dots.
import { createCanvas, HEIGHT, WIDTH } from './canvas.js';
import { band, bayer, clamp01, smooth } from './dither.js';
import { CLEAR, S } from './palette.js';
import { trash } from './trash.js';

const scratch = createCanvas();

/**
 * Open a panel: draw its contents with `paint(canvas, box)` into a scratch
 * frame, then copy them in through a Bayer dissolve of `amount`, with thought
 * dots from `from` (the fox's head) to the panel.
 * @param {{ x: number, y: number, w: number, h: number, round?: boolean }} box
 */
export function panel(canvas, box, amount, paint, from) {
  if (amount <= 0.02) return;
  const { x, y, w, h, round } = box;
  scratch.index.fill(CLEAR);
  paint(scratch, box);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  for (let yy = y - 2; yy < y + h + 2; yy++) {
    for (let xx = x - 2; xx < x + w + 2; xx++) {
      if (xx < 0 || yy < 0 || xx >= WIDTH || yy >= HEIGHT) continue;
      const th = bayer(xx >> 1, yy >> 1);
      if (th >= amount) continue;
      let edge;
      if (round) {
        const d = Math.hypot(xx - cx + 0.5, yy - cy + 0.5);
        if (d > r + 2) continue;
        edge = d > r ? (d > r + 1 ? S.ink : S.paper) : null;
      } else {
        const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
        const corner = (xx < x + 2 || xx >= x + w - 2) && (yy < y + 2 || yy >= y + h - 2);
        if (!inside && corner) continue;
        edge = inside ? null : S.ink;
      }
      if (edge != null) canvas.set(xx, yy, edge);
      else {
        const v = scratch.get(xx, yy);
        if (v !== CLEAR) canvas.set(xx, yy, v);
      }
    }
  }
  // Thought dots, growing from the fox's head towards the panel.
  if (from && amount > 0.5) {
    const [fx, fy] = from;
    const tx = Math.max(x + 8, Math.min(x + w - 8, fx));
    const ty = y + h + 6;
    for (let k = 0; k < 3; k++) {
      const p = (k + 1) / 4;
      const px = Math.round(fx + (tx - fx) * p);
      const py = Math.round(fy - 6 + (ty - (fy - 6)) * p);
      const rr = 1 + k * 0.7;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= rr + 0.5) canvas.set(px + dx, py + dy, d > rr - 0.5 ? S.ink : S.banner);
      }
    }
  }
}

/** The usual place for a panel: centred above the fox, in the sky. */
export const above = (w = 216, h = 128) => ({ x: Math.round(WIDTH / 2 - w / 2), y: 46, w, h });

export { APPS, laptop } from './desktop.js';

// ---- The book, the water, the telescope --------------------------------------

export { book } from './reading.js';

/**
 * Under the water at the end of the line: the bright surface above, light
 * shafts and drifting motes in deep water, weed on a sandy bottom, a retrieval hook and discarded objects on the lake bed.
 * A snag is lifted out at `strike` when `caught` is true.
 */
export function underwater(c, { x, y, w, h }, t, { strike, caught, item = 0 }) {
  const floor = h - 12;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const px = x + xx;
      const py = y + yy;
      const th = bayer(px, py);
      let col = band(yy / floor, 0.05, 0.85) > th ? S.knitDark : S.knit;
      // Soft shafts of light slanting down from the surface, fading with depth.
      const shaft = Math.sin((xx + yy * 0.6) * 0.07 + t * 0.25) * Math.sin((xx + yy * 0.6) * 0.023 - t * 0.1);
      if (shaft > 0.55 && (1 - yy / floor) * 0.45 > th) col = S.knit;
      // The surface, wavering.
      const surface = 3 + Math.round(Math.sin(xx * 0.18 + t * 2) * 1.2);
      if (yy < surface) col = yy === surface - 1 ? S.waterHi : S.sea0;
      // A sandy bottom with a dithered edge.
      const sand = floor + Math.round(Math.sin(xx * 0.05) * 2 + Math.sin(xx * 0.17) * 0.8);
      if (yy >= sand) col = band((yy - sand) / 4, 0, 1) > th ? S.path : S.pathEdge;
      c.set(px, py, col);
    }
  }
  // Motes drifting up through the light.
  for (let k = 0; k < 18; k++) {
    const mx = x + ((k * 53 + Math.floor(Math.sin(t * 0.5 + k) * 3)) % w);
    const my = y + floor - ((k * 29 + t * (3 + (k % 3))) % floor);
    if (my > y + 5) c.set(Math.round(mx), Math.round(my), S.waterHi);
  }
  // Weed swaying on the bottom, and a few stones.
  for (let k = 0; k < 11; k++) {
    const bx = x + 6 + k * (w / 11) + ((k * 13) % 7);
    const hgt = 12 + ((k * 37) % 20);
    for (let i = 0; i < hgt; i++) {
      const sway = Math.sin(t * 1.1 + k + i * 0.2) * (i / hgt) * 4;
      c.rect(Math.round(bx + sway), y + floor + 1 - i, i < hgt - 3 ? 2 : 1, 1, k % 3 ? S.pine1 : S.pine0);
    }
  }
  for (let k = 0; k < 6; k++) {
    const sx = x + 10 + k * 37 + ((k * 17) % 11);
    c.rect(sx, y + floor - 1, 7, 3, S.metalDark);
    c.rect(sx + 1, y + floor - 2, 4, 1, S.metal);
  }
  // A snag on the lake bed, lifted steadily out of the silt. No bait or fish.
  const hx = x + Math.round(w * 0.6);
  const pulled = caught && t > strike ? smooth(clamp01((t - strike) / 1.5)) : 0;
  const approach = smooth(clamp01(t / 6));
  const bed = y + floor - 14;
  const hy = Math.round(y + h * 0.35 + (bed - y - h * 0.35) * approach - pulled * h);
  if (hy >= y) {
    c.rect(hx, y, 1, hy - y, S.paper);
    c.line(hx, hy, hx - 2, hy + 3, S.metal);
    c.line(hx - 2, hy + 3, hx - 4, hy + 1, S.metal);
  }
  if (!caught || t <= strike || hy > y - 12) trash(c, hx - 3, t > strike && caught ? hy + 2 : bed + 2, item, 2);
  // A little silt and released air drift up as the object leaves the bed.
  if (pulled > 0) for (let k = 0; k < 7; k++) {
    const age = (t - strike + k * 0.17) % 2;
    const py = Math.round(bed - age * 13);
    if (py > y + 4) c.set(hx + Math.round(Math.sin(k * 3 + age) * 8), py, S.waterHi);
  }
}
