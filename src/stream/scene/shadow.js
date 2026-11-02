// Grounding follows the painted silhouette, including coats and floor exercises.
// Cache the pose measurements, never motion history, so chunk boundaries agree.
import { bayer } from './dither.js';
import { ramp, S } from './palette.js';

const shapes = new WeakMap();
const tones = new Map([
  ...[S.path0, S.path1, S.path2, S.path3].map((s) => [s, S.path3]),
  ...ramp('snow', 0).map((s) => [s, S.snow3]),
  ...ramp('bark', 0).map((s) => [s, ramp('bark', 0)[2]]),
]);

function shape(s) {
  if (shapes.has(s)) return shapes.get(s);
  const floor = new Int16Array(s.w).fill(-1);
  let mass = 0, sum = 0, square = 0, bottom = 0;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (s.data[y * s.w + x] === 255) continue;
    // Lower body and limbs carry more of the contact shadow than the head.
    const weight = .3 + (y / s.h) ** 2;
    mass += weight;
    sum += x * weight;
    square += x * x * weight;
    floor[x] = y;
    bottom = Math.max(bottom, y);
  }
  const center = sum / mass;
  const half = Math.max(14, Math.sqrt(square / mass - center ** 2) * 1.9);
  const result = { center, half, floor, bottom };
  shapes.set(s, result);
  return result;
}

/** A soft body shadow, plus tight contact beneath the lowest painted limbs. */
export function drawActorShadow(canvas, s, x, y, groundY, { flip = false } = {}) {
  const p = shape(s);
  const top = Math.round(y) - s.oy - s.h + 1;
  const gap = Math.max(0, groundY - (top + p.bottom));
  const sign = flip ? -1 : 1;
  const center = Math.round(x) + sign * (s.ox + p.center);
  const half = p.half + Math.min(8, gap * .09);
  const depth = 2.5 + Math.min(3, gap * .045);
  const opacity = .58 / (1 + gap / 35);
  const paint = (px, py, amount) => {
    const tone = tones.get(canvas.get(px, py));
    if (tone != null && bayer(px, py) < amount) canvas.set(px, py, tone);
  };
  // Dither stays anchored to the ground grid, with no per-frame random flicker.
  for (let py = Math.floor(groundY + 1 - depth); py <= groundY + 1 + depth; py++) {
    for (let px = Math.floor(center - half); px <= center + half; px++) {
      const radius = ((px - center) / half) ** 2 + ((py - groundY - 1) / depth) ** 2;
      if (radius < 1) paint(px, py, opacity * (1 - radius) ** .65);
    }
  }
  for (let dx = 0; dx < s.w; dx++) {
    if (p.floor[dx] < 0) continue;
    const foot = top + p.floor[dx];
    const clearance = Math.max(0, groundY - foot);
    if (clearance > 5) continue;
    const px = Math.round(x) + sign * (s.ox + dx);
    for (let row = 1; row <= 2; row++) paint(px, Math.min(groundY + 1, foot + row), .85 * (1 - clearance / 7));
  }
}
