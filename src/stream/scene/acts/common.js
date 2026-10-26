// Helpers and small sprites shared by the activities.
import { hashString } from '../../../compose/rng.js';
import { sprite } from '../canvas.js';
import { bayer, lerp, smooth } from '../dither.js';
import { S } from '../palette.js';

export { lerp, smooth };
export const seg = (t, a, b) => smooth((t - a) / (b - a));
export const inside = (t, a, b) => t >= a && t < b;
export const hash01 = (s) => (hashString(s) % 10000) / 10000;

export const MUG = sprite(['ppp.', 'pppp', 'ppp.'], { p: S.paper });
export const BOOK = sprite(['oopppoo', 'opkkpko', 'opkpkpo', 'opppppo', 'ooooooo'], { o: S.fur, p: S.paper, k: S.cloudShade });
export const BIRD = sprite(['.kk.', 'kkkk', '.ok.'], { k: S.ink, o: S.fur });
export const BOTTLE = sprite(['.k.', 'ppp', 'pkp', 'pkp', 'ppp'], { p: S.knit, k: S.paper });

/** A sprite drawn with its nose tilted up (tilt > 0) or down, column by column. */
export function drawTilted(canvas, s, x0, y0, tilt, upTo = s.w) {
  for (let x = 0; x < Math.min(s.w, upTo); x++) {
    const dy = -Math.round(tilt * ((x - s.w / 2) / (s.w / 2)) * 3);
    for (let y = 0; y < s.h; y++) {
      const v = s.data[y * s.w + x];
      if (v !== 255) canvas.set(Math.round(x0) + x, Math.round(y0) + y + dy, v);
    }
  }
}

/** Flames with sparks drifting up; `level` 0..1 sizes them. */
export function drawFire(canvas, x, base, level, time, width = 5) {
  if (level <= 0.02) return;
  for (let dx = -width; dx <= width; dx++) {
    const shape = 1 - Math.abs(dx) / (width + 1);
    const flick = Math.sin(time * 7.3 + dx * 1.7) * 0.5 + Math.sin(time * 12.1 + dx * 0.9) * 0.35;
    const h = Math.max(0, level * (7 + 6 * shape + flick * 3) * shape);
    for (let y = 0; y < h; y++) {
      const px = x + dx;
      const py = base - y;
      const r = y / Math.max(1, h);
      if (r > 0.75 && bayer(px, py + Math.floor(time * 10)) < 0.5) continue;
      canvas.set(px, py, Math.abs(dx) < width * 0.4 && r < 0.45 ? S.fire2 : Math.abs(dx) < width * 0.8 && r < 0.75 ? S.fire1 : S.fire0);
    }
  }
  for (let i = 0; i < 6; i++) {
    const age = (time + i * 0.37) % 2.2;
    if (age > 1.7 * level) continue;
    const sx = Math.round(x + Math.sin(i * 3.1 + age * 2) * 4);
    const sy = Math.round(base - 10 - age * 16);
    canvas.set(sx, sy, i % 2 ? S.fire1 : S.fire2);
  }
}

/** A few rising wisps (steam from a mug, smoke from embers). */
export function steam(canvas, x, y, time, n = 2) {
  for (let i = 0; i < n * 3; i++) {
    const age = (time * 0.8 + i / (n * 3)) % 1;
    const sx = Math.round(x + Math.sin(age * 6 + i) * 1.5);
    const sy = Math.round(y - age * 10);
    if (age < 0.85 && bayer(sx, sy) < 0.6) canvas.set(sx, sy, S.smoke);
  }
}

/** A park bench seen from the front, seat 7 pixels up, spanning x0..x0+w. */
export function bench(canvas, x0, Y, w = 38) {
  canvas.rect(x0, Y - 7, w, 2, S.trunk);
  canvas.rect(x0, Y - 5, w, 1, S.bag);
  canvas.rect(x0 + 2, Y - 4, 2, 4, S.metalDark);
  canvas.rect(x0 + w - 4, Y - 4, 2, 4, S.metalDark);
  canvas.rect(x0, Y - 17, w, 2, S.trunk);
  canvas.rect(x0, Y - 13, w, 2, S.trunk);
  canvas.rect(x0 + 2, Y - 18, 2, 11, S.metalDark);
  canvas.rect(x0 + w - 4, Y - 18, 2, 11, S.metalDark);
}

/**
 * Where an activity that walks the fox through its set wants the ground to go:
 * walking pace until the fox reaches `target` (in set coordinates), then stop.
 */
export const walkTo = (foxLocal, target, pace = 8) => (foxLocal < target - 0.5 ? Math.min(pace, 2 + (target - foxLocal) * 2) : 0);
