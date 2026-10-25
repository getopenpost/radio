// Things the walk passes: postboxes, lamps, signposts, fences, bushes, and
// seasonal touches (flowers, pumpkins, mushrooms, snowmen). Drawn with their
// base on the ground line at a screen x.
import { bayer } from './dither.js';
import { sprite } from './canvas.js';
import { S } from './palette.js';

const POSTBOX = sprite(
  ['.ooo.', 'ooooo', 'okkko', 'ooooo', 'ooooo', 'odddo', 'ooooo', '..t..', '..t..', '..t..', '..t..'],
  { o: S.fur, k: S.ink, d: S.furDark, t: S.trunk },
);
const MAILBOX = sprite(
  ['.pppp.', 'pppppl', 'pppppl', 'pppppl', '..t...', '..t...', '..t...', '..t...', '..t...'],
  { p: S.paper, l: S.logo, t: S.trunk },
);
const SIGN = sprite(
  ['pppppp.', 'pkkkkpp', 'pppppp.', '..t....', '..t....', '..t....', '..t....', '..t....', '..t....', '..t....'],
  { p: S.paper, k: S.ink, t: S.trunk },
);
const MUSHROOMS = sprite(['.ooo....', 'opopo.o.', 'ooooooo.', '.c...oo.', '.c....c.'], { o: S.fur, p: S.paper, c: S.cream });
const PUMPKIN = sprite(['...t...', '.ooooo.', 'oododdo', 'oododdo', '.ooooo.'], { o: S.logo, d: S.furDark, t: S.leaf1 });
const SNOWMAN = sprite(
  ['..kkk..', '..kkk..', '.kkkkk.', '..sss..', '.sksks.', '.ssso..', '..sss..', '.sssss.', 'sssssss', 'sssssss', '.sssss.'],
  { k: S.ink, s: S.snow, o: S.logo },
);

export const PROP_KINDS = {
  any: ['postbox', 'lamp', 'sign', 'fence', 'bush', 'rock', 'mailbox', 'lamp', 'postbox'],
  spring: ['flowers', 'flowers', 'bush'],
  summer: ['flowers', 'bush'],
  autumn: ['mushrooms', 'pumpkin', 'leaves'],
  winter: ['snowman', 'rock'],
};

/** Draw a prop with its base at ground line `y`. Returns a light position for lamps. */
export function drawProp(canvas, kind, x, y, seed) {
  switch (kind) {
    case 'postbox':
      canvas.draw(POSTBOX, x - 2, y - POSTBOX.h);
      return null;
    case 'mailbox':
      canvas.draw(MAILBOX, x - 2, y - MAILBOX.h);
      return null;
    case 'sign':
      canvas.draw(SIGN, x - 2, y - SIGN.h);
      return null;
    case 'lamp':
      canvas.rect(x, y - 18, 1, 18, S.ink);
      canvas.rect(x - 1, y - 1, 3, 1, S.ink);
      canvas.rect(x - 1, y - 20, 3, 1, S.ink);
      canvas.rect(x - 1, y - 19, 3, 2, S.lampLight);
      return { x, y: y - 18 };
    case 'fence':
      for (let i = 0; i < 4; i++) canvas.rect(x + i * 7, y - 8, 1, 8, S.trunk);
      canvas.rect(x, y - 7, 22, 1, S.trunk);
      canvas.rect(x, y - 4, 22, 1, S.trunk);
      return null;
    case 'bush':
      for (let dy = -6; dy <= 0; dy++) {
        for (let dx = -7; dx <= 7; dx++) {
          if ((dx / 7.5) ** 2 + ((dy + 1) / 6) ** 2 > 1) continue;
          canvas.set(x + dx, y + dy - 1, 0.3 + (dx - dy) / 14 > bayer(x + dx, y + dy) ? S.leaf1 : S.leaf0);
        }
      }
      return null;
    case 'rock':
      for (let dy = -3; dy <= 0; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx / 4.5) ** 2 + ((dy + 0.5) / 3.5) ** 2 <= 1) canvas.set(x + dx, y + dy - 1, dx + dy > 0 ? S.hill1 : S.pathEdge);
      return null;
    case 'flowers':
      for (let i = 0; i < 5; i++) {
        const fx = x + ((seed * 7 + i * 5) % 13) - 6;
        const h = 2 + ((seed + i) % 3);
        canvas.rect(fx, y - h, 1, h, S.leaf1);
        canvas.set(fx, y - h - 1, i % 2 ? S.flower : S.paper);
      }
      return null;
    case 'mushrooms':
      canvas.draw(MUSHROOMS, x - 4, y - MUSHROOMS.h);
      return null;
    case 'pumpkin':
      canvas.draw(PUMPKIN, x - 3, y - PUMPKIN.h);
      return null;
    case 'leaves':
      for (let i = 0; i < 9; i++) canvas.set(x + ((seed * 3 + i * 7) % 19) - 9, y - (i % 2), i % 3 ? S.leaf0 : S.leafFall);
      return null;
    case 'snowman':
      canvas.draw(SNOWMAN, x - 3, y - SNOWMAN.h);
      return null;
    default:
      return null;
  }
}

/** The OpenPost Converge mark: four rounded modules around a centre opening (assets/brand/logo.svg, 128-unit grid). */
export function convergeMask(size) {
  const inside = (x, y) => {
    const u = x < 64 ? x : 128 - x;
    const v = y < 64 ? y : 128 - y;
    if (u < 4 || v < 4 || u > 60 || v > 60 || u + v > 92) return false;
    if (u < 24 && v < 24) return (u - 24) ** 2 + (v - 24) ** 2 <= 400;
    return true;
  };
  const mask = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) hits += inside(((x + (sx + 0.5) / 4) * 128) / size, ((y + (sy + 0.5) / 4) * 128) / size);
      row.push(hits >= 8);
    }
    mask.push(row);
  }
  return mask;
}
