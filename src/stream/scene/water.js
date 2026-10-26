// Still and slow water seen from the side: the bank and sky above mirrored
// into it, broken up by ripples and fading with depth through the dither, a
// gradient from the far edge to the near one, highlight dashes drifting with
// the current, rings when it rains, and ice with cracks in winter.
import { band, bayer } from './dither.js';
import { S } from './palette.js';

// What water mirrors: the sky, hills, trees and buildings, not bare ground.
const MIRRORS = new Uint8Array(256);
for (const n of ['sky0', 'sky1', 'sky2', 'sunGlow', 'sun', 'moon', 'cloud', 'cloudShade', 'far0', 'far1', 'hill0', 'hill1', 'pine0', 'pine1', 'leaf0', 'leaf1', 'blossom', 'snowcap', 'trunk', 'roof', 'wall', 'window', 'windowOff', 'glacier', 'peak']) MIRRORS[S[n]] = 1;

/**
 * Fill water between rows `top` (the far waterline) and `bottom`, from
 * `left(y)` to `right(y)` on each row. Call after the scenery above the
 * waterline is drawn, so there is something to reflect.
 */
export function drawWater(canvas, { top, bottom, left, right, time, rain = 0, winter = false, current = 6 }) {
  const h = bottom - top;
  for (let y = top; y < bottom; y++) {
    const d = y - top;
    const depth = d / h;
    const x0 = Math.max(0, Math.round(left(y)));
    const x1 = Math.min(639, Math.round(right(y)));
    for (let x = x0; x <= x1; x++) {
      const th = bayer(x, y);
      let c = band(depth, 0.15, 0.95) > th ? S.water1 : S.water0;
      if (winter) {
        // Ice: pale, with a few cracks.
        c = band(depth, 0.3, 1) * 0.6 > th ? S.water1 : S.water0;
        if (((x * 7 + y * 3) % 53 === 0 || (x * 3 - y * 5 + 400) % 61 === 0) && d > 2) c = S.pathEdge;
      } else {
        // A mirror of what is above, wobbling and thinning with depth.
        const wob = Math.round(Math.sin(d * 0.9 + time * 1.6 + x * 0.04) * (0.5 + depth * 1.5));
        const src = canvas.get(x + wob, top - 1 - d);
        if (MIRRORS[src] && (1 - depth / 0.55) * 0.8 > th) c = src;
        // Long thin streaks of light drifting with the current, a few per row.
        if (d % 6 === 3 && (x + Math.floor(time * (current + (d % 4))) + d * 29) % (70 + d * 2) < 6) c = S.waterHi;
        if (rain > 0.15) {
          const k = Math.floor(time * 3 + (x * 13 + y * 7) % 11);
          if ((x * 31 + y * 17 + k * 101) % 997 < rain * 4) c = S.waterHi;
        }
      }
      canvas.set(x, y, c);
    }
  }
  // The far waterline: a thin dark edge where the water meets the bank.
  for (let x = Math.max(0, Math.round(left(top))); x <= Math.min(639, Math.round(right(top))); x++) canvas.set(x, top, S.water1);
}
