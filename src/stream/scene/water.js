// Open water, drawn as swell. Lines of waves run from the horizon to the viewer,
// each a sum of slow sine waves in world space, so crests really travel, lift and
// pass under the boat. Near lines are taller, further apart and quicker. Each
// crest catches the sky; the trough behind it falls into shade through dither.
import { bayer } from './dither.js';
import { HEIGHT, WIDTH } from './canvas.js';
import { HORIZON } from './landscape.js';
import { hash } from './nature.js';
import { S } from './palette.js';

const TOP = HORIZON + 1;
const LINES = Array.from({ length: 26 }, (_, i) => {
  const t = i / 25;
  return {
    y: TOP + (HEIGHT - TOP + 10) * t ** 1.7, // perspective: lines crowd towards the horizon
    t,
    size: 0.5 + t * 7, // wave height in pixels
    long: 60 + t * 190, // wavelength
    speed: 0.5 + t * 1.3,
    seed: i * 37,
    rate: 0.03 + t ** 1.5 * 1.05, // how fast the boat passes this line
  };
});
const BANDS = [S.water0, S.water1, S.water2, S.water3, S.waterDeep];

/** Height of a line at a world column. */
function surge(line, wx, time) {
  const a = (wx + line.seed * 9) / line.long;
  const b = time * line.speed;
  return Math.sin(a * 6.283 + b) * 0.6 + Math.sin(a * 2.7 * 6.283 - b * 0.7 + line.seed) * 0.28 + Math.sin(a * 0.43 * 6.283 + b * 0.4) * 0.5;
}

/** How the sea lifts and tips something floating at a screen column, near the viewer. */
export function swellAt(ground, time, x = WIDTH / 2) {
  const line = LINES[21];
  const wx = x + ground * line.rate;
  return { lift: surge(line, wx, time) * 2.2, tilt: surge(line, wx + 26, time) - surge(line, wx - 26, time) };
}

export function createWater() {
  function draw(canvas, { ground, time, body, light, overcast, rough = 1 }) {
    const { index } = canvas;
    // The ground colour of the sea, darkening towards the viewer.
    for (let y = TOP; y < HEIGHT; y++) {
      const t = (y - TOP) / (HEIGHT - TOP);
      const d = Math.min(3.999, t ** 0.8 * 4);
      const k = Math.floor(d);
      const f = d - k;
      const out = y * WIDTH;
      for (let x = 0; x < WIDTH; x++) index[out + x] = f > bayer(x, y) * 0.55 + hash(x, y, 901) * 0.45 ? BANDS[k + 1] : BANDS[k];
    }
    // Swell, back to front. A line paints over the sea behind it, so nearer waves hide further ones.
    for (const line of LINES) {
      const shift = ground * line.rate;
      const height = line.size * rough;
      const depth = Math.min(3, Math.floor(line.t * 4));
      const body0 = BANDS[depth + 1];
      const lit = BANDS[Math.max(0, depth - 1)];
      const reach = Math.max(1, Math.round(height * 1.6));
      for (let x = 0; x < WIDTH; x++) {
        const wx = x + shift;
        const h = surge(line, wx, time);
        const crest = Math.round(line.y - h * height);
        if (crest >= HEIGHT) continue;
        // Crest light, then the wave's back falling away in dither.
        // Light breaks up along a crest, in dashes, instead of drawing a contour line.
        const dash = hash(Math.floor(wx / (3 + line.t * 9)), line.seed, 903);
        if (crest >= TOP && h > 0.15 + dash * 0.75) index[crest * WIDTH + x] = h > 0.95 ? S.foam : dash < 0.45 ? S.waterHi : lit;
        for (let k = 1; k <= reach; k++) {
          const y = crest + k;
          if (y < TOP || y >= HEIGHT) continue;
          if (k / reach * 0.9 + 0.1 > bayer(Math.floor(wx), y)) index[y * WIDTH + x] = k < reach * 0.35 && h > 0 ? lit : body0;
        }
      }
    }
    if (!body || overcast > 0.75) return;
    // The light lies on the faces of the waves, in broken dashes that widen towards the viewer.
    for (let y = TOP + 1; y < HEIGHT; y++) {
      const t = (y - TOP) / (HEIGHT - TOP);
      const half = 8 + t * 58;
      for (let x = Math.max(0, Math.round(body.x - half)); x < Math.min(WIDTH, body.x + half); x++) {
        const v = index[y * WIDTH + x];
        if (v !== S.waterHi && v !== BANDS[0] && v !== BANDS[1]) continue;
        const edge = 1 - Math.abs(x - body.x) / half;
        if (hash((x + Math.floor(time * 3 + y * 3)) >> 1, y, Math.floor(time * 3)) < edge * 0.8) index[y * WIDTH + x] = light > 0.3 ? S.sunGlow : S.moon;
      }
    }
  }

  /** Foam churned up behind a boat, thinning with distance and drifting in the swell. */
  function wake(canvas, x, y, time, ground) {
    for (let i = 0; i < 80; i++) {
      const dx = i * 1.8;
      const spread = 1 + dx * 0.07;
      for (const side of [-1, 1]) {
        const px = Math.round(x - dx);
        const py = Math.round(y + side * spread + Math.sin(i * 0.4 + time * 2.4) * 1.1);
        if (hash((px + Math.floor(ground)) >> 2, side, 910) < 0.7 - i / 110) canvas.set(px, py, S.foam);
      }
    }
  }

  return { draw, wake };
}
