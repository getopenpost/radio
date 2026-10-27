// The same recovered objects appear under the water, on the line and on shore.
import { sprite } from './canvas.js';
import { S } from './palette.js';

const colors = { o: S.outline, b: S.bag, m: S.metal, l: S.paper, k: S.knit, d: S.knitDark };
const OBJECTS = [
  sprite(['.oooo....', '.obbo....', '.obbo....', '.obboooo.', '.obbbbbo.', '.ooooooo.'], colors),
  sprite(['..mm..', '..dd..', '.okko.', '.okko.', '.oklo.', '.okko.', '.oooo.'], colors),
  sprite(['.mmmm.', '.ommo.', '.omlo.', '.ommo.', '.ommo.', '.oooo.'], colors),
];

/** Top-centre anchor, with an integer scale for the underwater close view. */
export function trash(c, x, y, kind, scale = 1) {
  const s = OBJECTS[((kind % OBJECTS.length) + OBJECTS.length) % OBJECTS.length];
  for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) {
    const col = s.data[yy * s.w + xx];
    if (col !== 255) c.rect(Math.round(x - s.w * scale / 2 + xx * scale), Math.round(y + yy * scale), scale, scale, col);
  }
}
