// The sky: a five-tone dithered gradient warmed around the sun, the sun and moon
// on their arcs (rising on the right, setting on the left), stars, long flat
// clouds with a few fuller ones, and the odd flock or balloon.
import { createRng, hashString } from '../../compose/rng.js';
import { WIDTH } from './canvas.js';
import { band, bayer, clamp01, smooth } from './dither.js';
import { HORIZON } from './landscape.js';
import { fbm, hash, noise2 } from './nature.js';
import { CLEAR, S } from './palette.js';

const SKY_HEIGHT = HORIZON + 8;

/** Sun or moon screen position for a progress along its arc (0 rising right, 1 setting left). */
export function arc(progress, height = 150) {
  return { x: Math.round(WIDTH - 40 - progress * (WIDTH - 80)), y: Math.round(HORIZON - Math.sin(Math.PI * progress) * height) };
}

function makeCloud(r, i) {
  const full = i % 9 === 0; // mostly long flat streaks
  const w = full ? r.int(70, 150) : r.int(60, 180);
  const h = full ? r.int(18, 32) : r.int(4, 9);
  const seed = r.int(0, 9999);
  const data = new Uint16Array(w * h).fill(CLEAR);
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const taper = Math.sin(Math.PI * t) ** (full ? 0.5 : 0.8);
    // Flat base, broken crown: heaped when full, a thin streak otherwise.
    const crown = h * taper * (0.32 + 0.68 * fbm(x / (full ? 15 : 20), seed, 3));
    const base = h - 1 - (full ? 0 : (noise2(x / 13, 2, seed) - 0.3) * h * 0.4);
    for (let y = Math.max(0, Math.round(base - crown)); y <= Math.min(h - 1, Math.round(base)); y++) {
      const v = (base - y) / Math.max(1, crown);
      if (v < 0.12 && bayer(x, y) > v * 8) continue;
      if (!full && hash(x >> 1, y, seed) < 0.16) continue;
      data[y * w + x] = v > 0.72 ? S.cloudLit : band(v, 0.05, 0.42) > bayer(x, y) ? S.cloud : S.cloudShade;
    }
  }
  return { w, h, data, y: full ? r.int(32, 120) : r.int(20, 172), speed: r.float(1.2, 3.2), x0: r.float(0, WIDTH + 400), rank: i / 16, shown: null };
}

/** A hot-air balloon: striped envelope with a dark edge, so it holds up against a pale sky. */
function drawBalloon(canvas, x, y) {
  const R = 13;
  const cx = x + R;
  const cy = y + R;
  for (let dy = -R - 1; dy <= R + 7; dy++) {
    // Round above, narrowing to the neck below.
    const half = dy <= 0 ? Math.sqrt(Math.max(0, (R + 1) ** 2 - dy * dy)) : (R + 1) * (1 - (dy / (R + 8)) ** 1.6);
    for (let dx = -Math.floor(half); dx <= Math.floor(half); dx++) {
      const edge = Math.abs(dx) >= Math.floor(half) || dy === -R - 1 || dy === R + 7;
      const stripe = Math.floor(((dx / (half || 1)) * 0.5 + 0.5) * 5) % 2;
      const lit = dx < 0 && dy < 2;
      canvas.set(cx + dx, cy + dy, edge ? S.ink : stripe ? S.logo : lit ? S.foam : S.path1);
    }
  }
  for (const side of [-3, 3]) canvas.line(cx + side, cy + R + 7, cx + Math.sign(side) * 2, cy + R + 13, S.ink);
  canvas.rect(cx - 3, cy + R + 13, 7, 5, S.ink);
  canvas.rect(cx - 2, cy + R + 14, 5, 3, S.wood);
}

export function createSky(seed = 1) {
  const rng = createRng(seed);
  const cache = new Uint16Array(WIDTH * SKY_HEIGHT);
  let cacheKey = '';
  const stars = Array.from({ length: 170 }, () => ({
    x: rng.int(0, WIDTH - 1), y: rng.int(4, 190), rank: rng.float(0, 1), phase: rng.float(0, 6.28), rate: rng.float(0.3, 1.4), big: rng.chance(0.08),
  }));
  const clouds = Array.from({ length: 16 }, (_, i) => makeCloud(createRng(seed * 31 + i), i));
  let event = null;

  function buildGradient(sun) {
    const stops = [S.sky0, S.sky1, S.sky2, S.sky3, S.sky4];
    for (let y = 0; y < SKY_HEIGHT; y++) {
      const t = Math.min(0.999, (y / HORIZON) ** 1.15) * 4;
      const k = Math.floor(t);
      const f = band(t - k, 0.18, 0.82);
      for (let x = 0; x < WIDTH; x++) {
        const th = bayer(x, y);
        let c = f > th ? stops[Math.min(4, k + 1)] : stops[k];
        if (sun) {
          const d = Math.hypot(x - sun.x, (y - sun.y) * 1.2) / sun.r;
          if (d < 1 && band(1 - d, 0, 0.8) > th) c = S.sunGlow;
        }
        cache[y * WIDTH + x] = c;
      }
    }
  }

  /** Draw the sky into the frame. */
  function draw(canvas, { time, dt, light, sunProgress, moonProgress, moonAge, overcast, wind, date, scroll }) {
    const sunPos = sunProgress != null ? arc(sunProgress) : null;
    const low = sunProgress != null ? 1 - Math.sin(Math.PI * clamp01(sunProgress)) : 0;
    const glow = sunPos && overcast < 0.8 ? { x: sunPos.x, y: sunPos.y, r: 34 + 60 * low } : null;
    const key = glow ? `${glow.x},${glow.y},${Math.round(glow.r / 4)}` : 'none';
    if (key !== cacheKey) {
      buildGradient(glow);
      cacheKey = key;
    }
    canvas.index.set(cache);

    const dark = clamp01((0.55 - light) / 0.45) * (1 - overcast * 0.85);
    if (dark > 0) {
      for (const s of stars) {
        if (s.rank > dark) continue;
        if (Math.sin(time * s.rate + s.phase) < -0.6) continue;
        canvas.set(s.x, s.y, S.star);
        if (s.big && Math.sin(time * s.rate * 0.5 + s.phase) > 0) {
          canvas.set(s.x - 1, s.y, S.star);
          canvas.set(s.x + 1, s.y, S.star);
          canvas.set(s.x, s.y - 1, S.star);
          canvas.set(s.x, s.y + 1, S.star);
        }
      }
    }

    if (moonProgress != null && light < 0.75) drawMoon(canvas, arc(moonProgress, 135), moonAge, light, overcast);
    if (sunPos && overcast < 0.95) canvas.disc(sunPos.x, sunPos.y, 12, S.sun, 1 - overcast * 0.6);

    // How many clouds are out follows the cover; each joins or leaves only
    // while off screen, so none pops in. They drift and scroll very slowly.
    const want = 7 + overcast * 9;
    for (const c of clouds) {
      const span = WIDTH + c.w + 40;
      const raw = c.x0 - time * c.speed * (0.5 + wind) - scroll * 0.012;
      const x = Math.round((((raw % span) + span) % span) - c.w - 20);
      if (c.shown === null || x <= -c.w || x >= WIDTH) c.shown = c.rank * 16 < want;
      if (c.shown) canvas.draw(c, x, c.y);
    }

    drawEvents(canvas, { time, dt, date, light });
  }

  function drawMoon(canvas, { x, y }, age, light, overcast) {
    const r = 9;
    const cosine = Math.cos(2 * Math.PI * (age < 0.5 ? age : age - 0.5));
    if (light < 0.5 && overcast < 0.6) {
      const strength = Math.abs(age - 0.5) < 0.3 ? 0.5 : 0.25;
      for (let dy = -26; dy <= 26; dy++) {
        for (let dx = -26; dx <= 26; dx++) {
          const d = Math.hypot(dx, dy);
          if (d <= r || d > 26) continue;
          const px = x + dx;
          const py = y + dy;
          const v = canvas.get(px, py);
          if ((v === S.sky0 || v === S.sky1 || v === S.sky2) && band(1 - (d - r) / (26 - r), 0.2, 1.2) * strength * 1.6 > bayer(px, py)) canvas.set(px, py, S.sky3);
        }
      }
    }
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.sqrt(Math.max(0, r * r - dy * dy));
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const nx = half ? dx / half : 0;
        const lit = age < 0.5 ? nx > cosine : nx < cosine;
        canvas.set(x + dx, y + dy, lit ? S.moon : S.moonDark);
      }
    }
  }


  function startEvent(e) {
    const r = createRng(hashString(`sky:${e.seed}`));
    if (e.kind === 'birds') {
      const dir = r.chance(0.5) ? 1 : -1;
      return { ...e, x: dir > 0 ? -40 : WIDTH + 40, y: r.int(50, 150), speed: r.float(18, 28), dir, n: r.int(3, 7), flap: r.float(5, 7) };
    }
    if (e.kind === 'shootingStar') return { ...e, x: r.int(200, 600), y: r.int(20, 80), vx: -r.float(150, 220), vy: r.float(50, 90), age: 0 };
    if (e.kind === 'balloon') return { ...e, x: WIDTH + 10, y: r.int(60, 120), speed: r.float(5, 8), dir: -1 };
    return null;
  }

  function drawEvents(canvas, { time, dt, date, light }) {
    if (!event || event.done) {
      const next = skyEventAt(date);
      if (next && (!event || event.seed !== next.seed) && date.getTime() >= next.start && date.getTime() < next.start + 60000) {
        if (next.kind !== 'shootingStar' || light < 0.3) event = startEvent(next);
      }
    }
    if (!event || event.done) return;
    const e = event;
    if (e.kind === 'birds') {
      e.x += e.dir * e.speed * dt;
      for (let i = 0; i < e.n; i++) {
        const bx = Math.round(e.x - e.dir * (i * 9 + (i % 2) * 3));
        const by = e.y + Math.abs(i - (e.n >> 1)) * 4 + Math.round(Math.sin(time * 0.8 + i) * 1.5);
        const up = Math.sin(time * e.flap + i * 1.3) > 0;
        canvas.set(bx, by, S.ink);
        canvas.set(bx - 1, by + (up ? -1 : 0), S.ink);
        canvas.set(bx + 1, by + (up ? -1 : 0), S.ink);
      }
      if ((e.dir > 0 && e.x - e.n * 12 > WIDTH) || (e.dir < 0 && e.x + e.n * 12 < 0)) e.done = true;
    } else if (e.kind === 'shootingStar') {
      e.age += dt;
      const x = e.x + e.vx * e.age;
      const y = e.y + e.vy * e.age;
      const fade = 1 - smooth(e.age / 0.9);
      for (let i = 0; i < 28; i++) {
        const px = Math.round(x - (e.vx / 200) * i * 1.2);
        const py = Math.round(y - (e.vy / 200) * i * 1.2);
        if ((1 - i / 28) * fade > bayer(px, py)) canvas.set(px, py, S.star);
      }
      if (e.age > 0.9) e.done = true;
    } else if (e.kind === 'balloon') {
      e.x += e.dir * e.speed * dt;
      const x = Math.round(e.x);
      const y = Math.round(e.y + Math.sin(time * 0.3) * 3);
      drawBalloon(canvas, x, y);
      if (x < -20) e.done = true;
    }
  }

  return {
    draw,
    /** Start a sky event now (for previews). */
    trigger(kind, key) {
      event = startEvent({ kind, seed: hashString(key) });
    },
    get event() {
      return event;
    },
  };
}

/** The sky event due in the 5-minute window around `date`, if any. */
export function skyEventAt(date) {
  const window = Math.floor(date.getTime() / 300000);
  const r = createRng(hashString(`event:${window}`));
  const roll = r.float(0, 1);
  const kind = roll < 0.3 ? 'birds' : roll < 0.42 ? 'shootingStar' : roll < 0.47 ? 'balloon' : null;
  return kind ? { kind, start: window * 300000 + r.int(10, 200) * 1000, seed: window } : null;
}
