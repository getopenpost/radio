// Stargazing on a clear night: a refractor on a tripod and a bench. The fox
// looks through the eyepiece and a round view opens in the sky showing what
// it sees (the moon at its real phase, Saturn, Jupiter, a galaxy, a cluster);
// then it steps back, names it, and rests on the bench looking up, sometimes
// with a friend.
import { createRng } from '../../../compose/rng.js';
import { bubble, dialogue } from '../bubbles.js';
import { createCanvas } from '../canvas.js';
import { panel } from '../pov.js';
import { viewAmount } from '../motion.js';
import { bayer } from '../dither.js';
import { CLEAR, S } from '../palette.js';
import { bench, seg } from './common.js';
import { dressFor, visitor } from './visitor.js';

const CYCLE = 52;
const BENCH = -46; // where the fox sits, in set coordinates

const NAMES = { moon: 'THE MOON!', saturn: 'SATURN!', jupiter: 'JUPITER!', galaxy: 'A GALAXY!', cluster: 'SO MANY STARS' };

function telescope(canvas, X, Y) {
  // Tripod: two front legs and one behind, a head block.
  canvas.line(X + 24, Y - 27, X + 14, Y - 1, S.metalDark);
  canvas.line(X + 24, Y - 27, X + 34, Y - 1, S.metalDark);
  canvas.line(X + 24, Y - 27, X + 25, Y - 1, S.metal);
  canvas.rect(X + 22, Y - 30, 5, 4, S.ink);
  // Tube from the eyepiece (low, at the fox's eye) up to the dew shield.
  for (let i = 0; i <= 34; i++) {
    const x = X + 10 + i;
    const y = Math.round(Y - 22 - i * 0.55);
    const w = i > 27 ? 5 : 4;
    for (let k = 0; k < w; k++) canvas.set(x, y - k + (i > 27 ? 1 : 0), k === 0 || k === w - 1 ? S.ink : i === 14 || i === 27 ? S.brass : S.paper);
  }
  canvas.rect(X + 7, Y - 23, 4, 3, S.ink); // eyepiece
  canvas.line(X + 20, Y - 33, X + 30, Y - 38, S.ink); // finder
}

function object(canvas, kind, cx, cy, moonAge, seed) {
  const r = createRng(seed);
  if (kind === 'moon') {
    const rad = 22;
    const cosine = Math.cos(2 * Math.PI * (moonAge < 0.5 ? moonAge : moonAge - 0.5));
    const craters = Array.from({ length: 9 }, () => [r.float(-15, 15), r.float(-15, 15), r.float(2, 5)]);
    for (let y = -rad; y <= rad; y++) {
      const half = Math.sqrt(Math.max(0, rad * rad - y * y));
      for (let x = -rad; x <= rad; x++) {
        if (x * x + y * y > rad * rad) continue;
        const lit = moonAge < 0.5 ? x / half > cosine : x / half < cosine;
        let c = lit ? S.moon : S.moonDark;
        if (lit) for (const [qx, qy, qr] of craters) if ((x - qx) ** 2 + (y - qy) ** 2 < qr * qr && bayer(x, y) < 0.6) c = S.cloudShade;
        canvas.set(cx + x, cy + y, c);
      }
    }
  } else if (kind === 'saturn') {
    const ring = (front) => {
      for (let x = -21; x <= 21; x++) {
        for (let y = -5; y <= 5; y++) {
          const d = (x / 21) ** 2 + (y / 5) ** 2;
          if (d > 1 || d < 0.45) continue;
          if (front !== y > 0) continue;
          canvas.set(cx + x, cy + y, d < 0.62 ? S.cloudShade : S.paper);
        }
      }
    };
    ring(false);
    for (let y = -8; y <= 8; y++) for (let x = -9; x <= 9; x++) if ((x / 9) ** 2 + (y / 8) ** 2 <= 1) canvas.set(cx + x, cy + y, Math.floor((y + 8) / 3) % 2 ? S.brass : S.cream);
    ring(true);
  } else if (kind === 'jupiter') {
    for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) if (x * x + y * y <= 121) canvas.set(cx + x, cy + y, [S.cream, S.brass, S.cream, S.fur, S.cream, S.brass, S.cream][Math.floor((y + 11) / 3.3)]);
    canvas.rect(cx + 2, cy + 3, 4, 2, S.logo);
    for (const dx of [-24, -17, 16, 25]) canvas.set(cx + dx, cy + (dx % 3 === 0 ? 0 : 1), S.paper);
  } else if (kind === 'galaxy') {
    for (let y = -14; y <= 14; y++) {
      for (let x = -26; x <= 26; x++) {
        const u = x * 0.9 + y * 0.45;
        const v = -x * 0.45 + y * 0.9;
        const d = Math.sqrt((u / 22) ** 2 + (v / 8) ** 2);
        const arm = Math.abs(Math.sin(Math.atan2(v * 2.5, u) * 2 - d * 5));
        const density = Math.max(0, 1 - d) * (0.55 + arm * 0.45) + (d < 0.18 ? 0.6 : 0);
        if (density > bayer(cx + x, cy + y) + 0.05) canvas.set(cx + x, cy + y, density > 0.8 ? S.paper : S.cloudShade);
      }
    }
  } else {
    for (let i = 0; i < 46; i++) {
      const a = r.float(0, Math.PI * 2);
      const d = Math.abs(r.float(-1, 1) * r.float(0, 1)) * 24;
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d);
      canvas.set(x, y, i % 4 ? S.paper : S.star);
      if (i % 9 === 0) {
        canvas.set(x + 1, y, S.paper);
        canvas.set(x, y + 1, S.paper);
      }
    }
  }
}

/**
 * The view through the eyepiece: the object drawn at its own size into a
 * scratch frame, then magnified 2x into a big round panel with a few stars.
 */
const lens = createCanvas();
function view(canvas, box, amount, kind, moonAge, seed, from) {
  lens.index.fill(CLEAR);
  object(lens, kind, 100, 100, moonAge, seed);
  panel(canvas, box, amount, (sc, b) => {
    sc.rect(b.x, b.y, b.w, b.h, S.ink);
    for (const [x, y] of [[-48, -20], [30, -50], [44, 30], [-30, 44], [8, -58], [-56, 18], [52, -12]]) sc.set(b.x + b.w / 2 + x, b.y + b.h / 2 + y, S.star);
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const v = lens.get(100 + Math.floor((x - b.w / 2) / 2), 100 + Math.floor((y - b.h / 2) / 2));
        if (v !== CLEAR) sc.set(b.x + x, b.y + y, v);
      }
    }
  }, from);
}

export default {
  spec: { anchored: true, extent: [-62, 50], intro: 4, outro: 4, light: 'night' },
  draw(c) {
    const { canvas, X, Y, t, out, time, moonUp, moonAge } = c;
    bench(canvas, X + BENCH - 12, Y);
    telescope(canvas, X, Y);
    if (t < 0) return null;

    const fox = c.foxX - X;
    const k = Math.floor(Math.max(0, t - 2) / CYCLE);
    const u = Math.max(0, t - 2) % CYCLE;
    const kinds = moonUp ? ['moon', 'saturn', 'jupiter', 'galaxy', 'cluster'] : ['saturn', 'jupiter', 'galaxy', 'cluster'];
    const kind = kinds[(k + c.seed) % kinds.length];
    const pose = { legs: 'stand', eyes: 'open' };
    let speed = 0;
    let looking = 0;
    const bubbles = [];
    if (out > 0) {
      speed = fox < -1 ? 6 : 0; // back to the telescope side, then off
      if (fox < -1) pose.facing = 1;
    } else if (u < 19) {
      // At the eyepiece.
      speed = fox < -0.5 ? Math.min(8, 2 + -fox * 2) : 0;
      if (speed === 0) {
        Object.assign(pose, { headX: 2, headY: 1, eyes: 'closed', front: [6, -4], back: [5, -3] });
        looking = u > 1 && u < 18.8 ? 1 : 0;
      }
    } else if (u < 22) {
      Object.assign(pose, { front: [4, -12], eyes: 'happy', mouth: 'open' });
      bubbles.push((paws) => bubble(canvas, paws.top[0], paws.top[1], NAMES[kind], (u - 19) / 0.6));
    } else if (u < 41) {
      // Over to the bench to look up for a while.
      speed = fox > BENCH + 0.5 ? -Math.min(8, 2 + (fox - BENCH) * 2) : 0;
      if (speed !== 0) pose.facing = -1;
      else Object.assign(pose, { legs: 'sit', seat: 7, eyes: 'up', mouth: 'smile' });
      if (u > 30 && u < 30 + c.dt) c.trigger('shootingStar', `star:${c.seed}:${k}`);
      if (u > 30.6 && u < 33 && speed === 0) Object.assign(pose, { front: [5, -11], eyes: 'happy', mouth: 'open' });
    } else {
      speed = fox < -0.5 ? Math.min(8, 2 + -fox * 2) : 0;
    }

    // Every other cycle a friend comes to sit and look up too.
    const visit = k % 2 === 1 && u > 22 && out === 0;
    const lines = [{ who: 'b', text: 'WHAT DID YOU SEE?' }, { who: 'a', text: NAMES[kind].replace('!', '') }, { who: 'b', text: 'SHOW ME LATER!' }];
    let talking = null;
    const friend = visit
      ? visitor({ ...c, t: u - 22 }, {
          species: k % 4 === 1 ? 'bunny' : 'bear',
          arrive: 0,
          stay: 16,
          spot: BENCH + 18,
          dress: dressFor(c),
          settle: (s) => {
            talking = dialogue(lines, s - 1);
            return { legs: 'sit', seat: 7, eyes: talking ? 'open' : 'up', mouth: talking?.who === 'b' && talking.typed < 1 && Math.floor(time * 8) % 2 ? 'open' : 'smile' };
          },
        })
      : null;
    if (talking) {
      const { text, typed, who } = talking;
      if (who === 'a') {
        pose.eyes = 'happy';
        pose.mouth = typed < 1 && Math.floor(time * 8) % 2 ? 'open' : 'smile';
        bubbles.push((paws) => bubble(canvas, paws.top[0], paws.top[1], text, typed, 'left'));
      } else bubbles.push(() => bubble(canvas, friend.head[0], friend.head[1], text, typed, 'right'));
    }

    const box = { x: Math.round(320 - 70), y: 30, w: 140, h: 140, round: true };
    c.state.view ??= 0;
    c.state.view = viewAmount(c.state.view, looking, c.dt);
    return {
      pose,
      speed,
      after(paws) {
        if (c.state.view > 0.02) c.overlays.push(() => view(canvas, box, c.state.view, kind, moonAge, c.seed + k, paws.top));
        for (const b of bubbles) b(paws);
      },
    };
  },
};
