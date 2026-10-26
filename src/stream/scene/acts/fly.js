// Flying: the fox unfolds a letter from its bag into a paper plane (a broom
// around Halloween), climbs over the hills, bobs along waving, then lands.
import { sprite } from '../canvas.js';
import { bayer } from '../dither.js';
import { S } from '../palette.js';
import { drawTilted, lerp, seg, smooth } from './common.js';

// A letter folded into a paper plane, stamp on the tail; and a broom.
const PLANE = sprite(
  [
    'ppp.....................................',
    '.ppppp..................................',
    '.pppppppp...............................',
    '..ppppppppppppp.........................',
    '..pppppppppppppppppppp..................',
    '..llppppppppppppppppppppppppppp.........',
    '...ssssssssssssssssssssssssssssssspp....',
    '....ssssssssssssssssssssssss............',
    '......ssssssssssssssssss................',
    '........sssssssssss.....................',
    '..........sssss.........................',
  ],
  { p: S.paper, s: S.bunnyDark, l: S.logo },
);
const BROOM = sprite(
  [
    'bbb................................',
    'bbbbb..............................',
    'bbbbbbtssssssssssssssssssssssssss..',
    'bbbbbbtssssssssssssssssssssssssssss',
    'bbbbbb.............................',
    'bbbb...............................',
    'bb.................................',
  ],
  { b: S.straw, t: S.logo, s: S.trunk },
);
export default {
  spec: { anchored: false, extent: [-20, 40], intro: 9, outro: 9, light: 'any' },
  draw(c) {
    const { canvas, X, Y, t, out, time, festive } = c;
    if (t < 0) return null;
    const vehicle = festive ? BROOM : PLANE;
    const cruise = (tt) => seg(tt, 3.6, 9) * (100 + Math.sin(tt * 0.9) * 10 + Math.sin(tt * 2.3) * 2);
    const landing = out > 0 ? seg(out, 0, 6) : 0;
    const lift = (tt) => cruise(tt) * (1 - landing);
    const h = lift(t);
    const climb = (lift(t + 0.2) - h) / 0.2;
    const tilt = Math.max(-1, Math.min(1, climb / 25));
    const seat = 4; // the fox sits this far above the path line, legs hidden in the plane
    const onBoard = t >= 3.6 && !(out > 6.6);
    const pose = { legs: 'stand', eyes: 'open', scarf: true, cap: festive ? 'witch' : 'aviator' };
    let foxLift = 0;
    let planeX = X - 20;
    let unfold = 1;

    if (t < 1.5) pose.back = t > 0.5 ? [-4, 3] : [-2, 5];
    if (t < 3) {
      unfold = seg(t, 1.5, 3);
      planeX = X + 8;
      pose.eyes = t > 1.5 ? 'happy' : 'open';
    } else if (t < 3.6) {
      const p = (t - 3) / 0.6;
      planeX = lerp(X + 8, X - 20, smooth(p));
      foxLift = Math.sin(Math.PI * p) * 9 + p * seat;
    }
    if (out > 6 && out <= 6.6) {
      const p = (out - 6) / 0.6;
      planeX = lerp(X - 20, X + 8, smooth(p));
      foxLift = Math.sin(Math.PI * p) * 9 + (1 - p) * seat;
    } else if (out > 6.6) {
      planeX = X + 8;
      unfold = 1 - seg(out, 6.6, 8.2);
      pose.back = [-4, 3];
    }
    if (onBoard) {
      foxLift = h + seat;
      Object.assign(pose, { legs: 'sit', seat: 0, shin: 3, front: [6, 3], back: [-3, 4], headX: 1, tail: Math.sin(time * 6) * 0.9 });
      // Waves now and then, squints into the wind, grins.
      const u = t % 18;
      if (h > 40 && u < 2.4) {
        pose.back = [2 + Math.round(Math.sin(time * 10) * 1.5), -10];
        pose.eyes = 'happy';
        pose.mouth = 'open';
      } else if (u > 9 && u < 11) pose.eyes = 'closed';
      else if (u > 6 && u < 9) pose.eyes = 'happy';
    }
    // The plane's keel (or the broom's stick) rides at the fox's seat.
    const planeY = Y - Math.round(onBoard ? h : 0) - (festive ? 6 : 10);

    // A shadow on the path that shrinks as the plane climbs.
    if (onBoard && h > 2) {
      const w = Math.max(4, Math.round(20 - h * 0.12));
      for (let dx = -w; dx <= w; dx++) {
        const x = X + dx;
        if (Math.max(0.15, 0.7 - h / 220) * (1 - Math.abs(dx) / (w + 1)) > bayer(x, Y)) canvas.set(x, Y, S.pathEdge);
      }
    }

    return {
      pose,
      lift: Math.round(foxLift),
      speed: onBoard ? 22 * seg(t, 4, 9) * (1 - (out > 0 ? seg(out, 1.5, 6.2) : 0)) : 0,
      after() {
        if (unfold <= 0) return;
        const x0 = planeX;
        drawTilted(canvas, vehicle, x0, planeY, onBoard ? tilt : 0, Math.round(unfold * vehicle.w));
        // A trail: sparkles off the broom, soft wisps off the plane.
        if (onBoard && h > 12) {
          for (let k = 1; k <= 16; k++) {
            const tx = Math.round(x0 - k * 3);
            const ty = Math.round(Y - lift(t - (k * 3) / 22) - (festive ? 1 : 2));
            if ((1 - k / 16) * 0.75 > bayer(tx, ty + Math.floor(time * 8))) canvas.set(tx, ty, festive ? S.light : S.smoke);
          }
        }
      },
    };
  }
};
