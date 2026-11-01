// The small things drawn around the painted fox: bicycle wheels, which must turn
// evenly at any speed, and the dust of a landing.
import { S } from './palette.js';

export const WHEEL = 19;

export function createFox(canvas) {
  function wheel(cx, cy, turn) {
    const R = WHEEL;
    for (let a = 0; a < 6.283; a += 0.03) {
      const [c, s] = [Math.cos(a), Math.sin(a)];
      for (const r of [R, R - 1]) canvas.set(Math.round(cx + c * r), Math.round(cy + s * r), S.ink);
      canvas.set(Math.round(cx + c * (R - 2)), Math.round(cy + s * (R - 2)), S.steel1);
    }
    for (let i = 0; i < 3; i++) {
      const a = turn + (i * Math.PI) / 3;
      canvas.line(cx - Math.cos(a) * (R - 3), cy - Math.sin(a) * (R - 3), cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3), S.steel1);
    }
    canvas.rect(cx - 2, cy - 2, 5, 5, S.steel1);
    canvas.rect(cx - 1, cy - 1, 3, 3, S.steel0);
  }

  /** A little dust where something lands; it also covers the moment a helmet goes on. */
  function puff(x, y, age) {
    if (age >= 1 || age < 0) return;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283;
      const r = 8 + age * 20 + (i % 3) * 3;
      if (i % 2 && age > 0.6) continue;
      canvas.set(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.4), S.path1);
    }
  }

  return { puff, wheel };
}
