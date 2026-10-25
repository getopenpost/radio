// The stream's picture: a calm dithered landscape scrolling in parallax, the
// OpenPost mark walking along a path in time with the music, and a grass line
// that moves with the spectrum. Drawn at 640x360 in palette indices and
// upscaled 3x (nearest neighbour) by ffmpeg.
//
// Layers are pre-rendered and pre-dithered strips that only translate, so the
// per-frame work is a few row copies, and x264 sees clean motion.
import { createRng } from '../compose/rng.js';

export const WIDTH = 640;
export const HEIGHT = 360;
const STRIP = 2560; // strip width; tiles seamlessly

// Palette slots. Day is OpenPost's warm paper, night its charcoal. Both keep
// the same depth order (sky lightest, near layers darkest) so the dusk and dawn
// blend never washes the landscape into one grey.
export const P = { bg: 0, tone1: 1, tone2: 2, ink: 3, accent: 4, accentDark: 5, pill: 6, pillText: 7, light: 8, grass: 9, grassTip: 10, haze: 11, clear: 255 };
const DAY = ['#f4f1ea', '#ddd6ca', '#a69d90', '#302b28', '#b45309', '#7c3a07', '#1c1917', '#f4f1ea', '#ffffff', '#2b2623', '#8f8679', '#e9e4da'];
const NIGHT = ['#241f1b', '#181412', '#3d3530', '#0e0c0a', '#fd975d', '#c56a35', '#0c0a09', '#ece7df', '#fff6e5', '#0b0908', '#74695f', '#1f1a17'];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const DAY_RGB = DAY.map(hex);
const NIGHT_RGB = NIGHT.map(hex);

// 4x4 Bayer thresholds in [0, 1).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// 3x5 glyphs for the ASCII texture, roughly ordered by ink coverage.
const GLYPHS = [
  ['...', '...', '...', '...', '...'],
  ['...', '...', '...', '...', '.x.'],
  ['...', '.x.', '...', '.x.', '...'],
  ['...', '...', 'xxx', '...', '...'],
  ['..x', '..x', '.x.', 'x..', 'x..'],
  ['x..', 'x..', '.x.', '..x', '..x'],
  ['.x.', 'x..', 'x..', 'x..', '.x.'],
  ['...', 'xxx', '...', 'xxx', '...'],
  ['x.x', '.x.', 'x.x', '.x.', 'x.x'],
  ['.x.', 'xxx', '.x.', 'xxx', '.x.'],
  ['xx.', 'x.x', 'x.x', 'x.x', 'xx.'],
  ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
].map((rows) => rows.map((r) => [...r].map((c) => c === 'x')));

/** A strip of palette indices with a vertical extent. */
function makeStrip(top, height) {
  return { top, height, data: new Uint8Array(STRIP * height).fill(P.clear) };
}

/** Periodic smooth noise over the strip width. */
function ridge(rng, octaves) {
  const parts = octaves.map(([period, amp]) => ({ k: STRIP / period, amp, phase: rng.float(0, Math.PI * 2) }));
  return (x) => parts.reduce((s, p) => s + p.amp * Math.sin((2 * Math.PI * p.k * x) / STRIP + p.phase), 0);
}

/** Fill a strip below a heightline with ASCII texture whose density is `tone(x, y)` in [0, 1]. */
function texture(strip, rng, heightAt, { under, ink, tone }) {
  const cellW = 4;
  const cellH = 6;
  for (let cy = 0; cy < strip.height; cy += cellH) {
    for (let cx = 0; cx < STRIP; cx += cellW) {
      const t = Math.max(0, Math.min(0.999, tone(cx, strip.top + cy) + rng.float(-0.12, 0.12)));
      const glyph = GLYPHS[Math.floor(t * GLYPHS.length)];
      for (let gy = 0; gy < cellH; gy++) {
        const y = cy + gy;
        if (y >= strip.height) break;
        for (let gx = 0; gx < cellW; gx++) {
          const x = cx + gx;
          if (strip.top + y < heightAt(x)) continue;
          const on = gy < 5 && gx < 3 && glyph[gy][gx];
          strip.data[y * STRIP + x] = on ? ink : under;
        }
      }
    }
  }
}

function buildLayers(seed) {
  const rng = createRng(seed);
  // Far mountains: pale, sparse texture.
  const farLine = ridge(rng, [[640, 18], [320, 9], [160, 4]]);
  const far = makeStrip(150, 140);
  texture(far, rng, (x) => 205 + farLine(x), { under: P.haze, ink: P.tone1, tone: (x, y) => 0.08 + (y - 190) / 500 });

  // Hills with a row of small trees.
  const hillLine = ridge(rng, [[512, 12], [256, 6], [128, 3]]);
  const hills = makeStrip(215, 90);
  texture(hills, rng, (x) => 250 + hillLine(x), { under: P.tone1, ink: P.tone2, tone: (x, y) => 0.35 + (y - 240) / 180 });
  for (let x = rng.int(0, 60); x < STRIP - 20; x += rng.int(28, 90)) {
    const base = Math.round(250 + hillLine(x)) - hills.top;
    const h = rng.int(10, 22);
    const w = rng.int(5, 9);
    for (let y = 0; y < h; y++) {
      const half = Math.floor((w * (y + 2)) / (h + 2) / 2) + 1;
      for (let dx = -half; dx <= half; dx++) {
        const yy = base - h + y;
        const xx = x + dx;
        if (yy >= 0 && yy < hills.height && xx >= 0 && xx < STRIP) hills.data[yy * STRIP + xx] = (xx + yy) % 3 ? P.tone2 : P.ink;
      }
    }
    for (let y = 0; y < 4; y++) if (base + y < hills.height) hills.data[(base - 1 + y) * STRIP + x] = P.ink;
  }

  // Ground with the path the mark walks on.
  const ground = makeStrip(282, 50);
  texture(ground, rng, () => 284, { under: P.tone1, ink: P.tone2, tone: (x, y) => (y < 296 ? 0.18 : Math.min(0.55, 0.3 + (y - 296) / 90)) });
  for (let x = 0; x < STRIP; x++) {
    for (const y of [296, 297]) ground.data[(y - ground.top) * STRIP + x] = (x >> 1) % 2 ? P.tone2 : P.ink;
  }
  return { far, hills, ground };
}

// The OpenPost Converge mark: four rounded modules around a centre opening.
// Geometry from assets/brand/logo.svg (128-unit grid), mirrored per quadrant.
function convergeMask(size) {
  const mask = [];
  const inside = (x, y) => {
    const u = x < 64 ? x : 128 - x;
    const v = y < 64 ? y : 128 - y;
    if (u < 4 || v < 4 || u > 60 || v > 60 || u + v > 92) return false;
    if (u < 24 && v < 24) return (u - 24) ** 2 + (v - 24) ** 2 <= 400;
    return true;
  };
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

const MARK = convergeMask(24);
const SMALL_MARK = convergeMask(12);
const NOTE = ['..xx', '..x.', '..x.', 'xxx.', 'xx..'].map((r) => [...r].map((c) => c === 'x'));
const POSTBOX = ['.xxx.', 'xxxxx', 'x...x', 'xxxxx', 'xxxxx', 'xxxxx', '..x..', '..x..', '..x..', '..x..'];
const LAMP = ['xxx', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', 'xxx'];

export function createScene({ seed = 1 } = {}) {
  const layers = buildLayers(seed);
  const rng = createRng(seed ^ 0xabc);
  const index = new Uint8Array(WIDTH * HEIGHT);
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
  const stars = Array.from({ length: 70 }, () => ({ x: rng.int(0, WIDTH - 1), y: rng.int(4, 150), phase: rng.float(0, 6.28), rate: rng.float(0.2, 1.2) }));
  const clouds = Array.from({ length: 6 }, (_, i) => makeCloud(rng, (i * WIDTH) / 4));
  const props = [];
  let nextProp = 4;
  const grass = new Float32Array(WIDTH);
  const blades = Float32Array.from({ length: WIDTH }, () => rng.float(0.55, 1));
  const palette = new Uint8Array(DAY.length * 3);

  function makeCloud(r, x) {
    const w = r.int(70, 140);
    const h = r.int(18, 30);
    const cells = [];
    for (let cy = 0; cy < h; cy += 6) {
      for (let cx = 0; cx < w; cx += 4) {
        const dx = (cx - w / 2) / (w / 2);
        const dy = (cy - h / 2) / (h / 2);
        const d = dx * dx + dy * dy * 1.4 + r.float(-0.15, 0.15);
        if (d < 1) cells.push({ cx, cy, g: GLYPHS[d < 0.35 ? r.int(3, 7) : r.int(1, 3)] });
      }
    }
    return { x, y: r.int(18, 110), speed: r.float(2, 4.5), cells, w };
  }

  function setPalette(daylight) {
    for (let i = 0; i < DAY.length; i++) {
      for (let c = 0; c < 3; c++) palette[i * 3 + c] = Math.round(NIGHT_RGB[i][c] + (DAY_RGB[i][c] - NIGHT_RGB[i][c]) * daylight);
    }
  }

  function blitStrip(strip, offset) {
    const shift = ((Math.floor(offset) % STRIP) + STRIP) % STRIP;
    for (let y = 0; y < strip.height; y++) {
      const sy = strip.top + y;
      if (sy >= HEIGHT) break;
      const row = y * STRIP;
      const out = sy * WIDTH;
      for (let x = 0; x < WIDTH; x++) {
        const v = strip.data[row + ((x + shift) % STRIP)];
        if (v !== P.clear) index[out + x] = v;
      }
    }
  }

  function sprite(mask, x0, y0, color) {
    for (let y = 0; y < mask.length; y++) {
      for (let x = 0; x < mask[y].length; x++) {
        const px = x0 + x;
        const py = y0 + y;
        if (mask[y][x] && px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) index[py * WIDTH + px] = color;
      }
    }
  }

  function rect(x0, y0, w, h, color) {
    for (let y = Math.max(0, y0); y < Math.min(HEIGHT, y0 + h); y++) index.fill(color, y * WIDTH + Math.max(0, x0), y * WIDTH + Math.min(WIDTH, x0 + w));
  }

  function roundedRect(x0, y0, w, h, r, color) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cx = x < r ? r - x - 0.5 : x >= w - r ? x - (w - r) + 0.5 : 0;
        const cy = y < r ? r - y - 0.5 : y >= h - r ? y - (h - r) + 0.5 : 0;
        if (cx * cx + cy * cy <= r * r) index[(y0 + y) * WIDTH + x0 + x] = color;
      }
    }
  }

  /**
   * Draw one frame.
   * @param {object} s
   * @param {number} s.time seconds since the stream started (drives motion)
   * @param {number} s.beat beats elapsed in the current track (drives the walk)
   * @param {number} s.daylight 0 night .. 1 day
   * @param {Float32Array} s.bands spectrum levels in [0, 1], low to high
   * @param {number} s.pillWidth now-playing pill width in pixels (0 hides it)
   * @returns {Buffer} RGB24 frame
   */
  function render({ time, beat, daylight, bands, pillWidth }) {
    setPalette(daylight);
    // Sky: paper or charcoal with a dithered glow towards the horizon.
    for (let y = 0; y < 300; y++) {
      const t = Math.max(0, (y - 70) / 230) ** 1.6 * 0.6;
      const out = y * WIDTH;
      for (let x = 0; x < WIDTH; x++) index[out + x] = bayer(x, y) < t ? P.tone1 : P.bg;
    }
    rect(0, 300, WIDTH, HEIGHT - 300, P.tone1);

    // Stars at night, twinkling slowly.
    if (daylight < 0.6) {
      for (const s of stars) {
        if (Math.sin(time * s.rate + s.phase) > 0.2 - (0.6 - daylight)) index[s.y * WIDTH + s.x] = P.light;
      }
    }
    // Sun or moon: a dithered disc.
    const cx = 510;
    const cy = 70;
    for (let y = -22; y <= 22; y++) {
      for (let x = -22; x <= 22; x++) {
        const d = Math.sqrt(x * x + y * y);
        const glow = d < 13 ? 1 : d < 22 ? (22 - d) / 30 : 0;
        if (glow > bayer(cx + x, cy + y)) index[(cy + y) * WIDTH + cx + x] = d < 13 ? P.accent : P.tone1;
      }
    }
    if (daylight < 0.5) for (let y = -13; y <= 13; y++) for (let x = -13; x <= 13; x++) if ((x - 6) ** 2 + (y - 4) ** 2 < 110 && x * x + y * y < 169) index[(cy + y) * WIDTH + cx + x] = P.bg;

    // Clouds drift on their own, independent of the walk.
    for (const c of clouds) {
      const x0 = Math.round(((c.x - time * c.speed) % (WIDTH + 200) + WIDTH + 200) % (WIDTH + 200)) - 100;
      for (const cell of c.cells) {
        for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
          if (!cell.g[gy][gx]) continue;
          const px = x0 + cell.cx + gx;
          const py = c.y + cell.cy + gy;
          if (px >= 0 && px < WIDTH) index[py * WIDTH + px] = P.tone1;
        }
      }
    }

    // Parallax: far mountains, hills, ground.
    blitStrip(layers.far, time * 3);
    blitStrip(layers.hills, time * 8);
    const groundOffset = time * 20;
    blitStrip(layers.ground, groundOffset);

    // Props along the path: postboxes and lamps pass by now and then.
    if (time >= nextProp) {
      props.push({ kind: rng.chance(0.55) ? 'postbox' : 'lamp', at: groundOffset + WIDTH + 10 });
      nextProp = time + rng.float(18, 45);
    }
    for (let i = props.length - 1; i >= 0; i--) {
      const x = Math.round(props[i].at - groundOffset);
      if (x < -20) {
        props.splice(i, 1);
        continue;
      }
      const shape = (props[i].kind === 'postbox' ? POSTBOX : LAMP).map((r) => [...r].map((ch) => ch === 'x'));
      sprite(shape, x, 296 - shape.length, props[i].kind === 'postbox' ? P.accent : P.ink);
      if (props[i].kind === 'lamp' && daylight < 0.5) {
        for (let y = -6; y <= 6; y++) for (let dx = -6; dx <= 6; dx++) if (dx * dx + y * y < 36 && bayer(x + dx, y) < 0.35) {
          const px = x + 1 + dx;
          const py = 296 - LAMP.length + y;
          if (px >= 0 && px < WIDTH && index[py * WIDTH + px] === P.bg) index[py * WIDTH + px] = P.light;
        }
      }
    }

    // The mark walks: one step per beat, a small bounce on each step.
    const step = beat % 2;
    const lift = Math.abs(Math.sin(Math.PI * step));
    const mx = 280;
    const my = 263 - Math.round(lift * 2);
    for (let x = 0; x < 20; x++) if (bayer(mx + 2 + x, 294) < 0.6) index[294 * WIDTH + mx + 2 + x] = P.tone2; // shadow
    sprite(MARK, mx, my, P.accent);
    const legPhase = Math.sin(Math.PI * beat);
    const legs = [
      [mx + 7 + Math.round(legPhase * 2), my + 24],
      [mx + 15 - Math.round(legPhase * 2), my + 24],
    ];
    for (const [lx, ly] of legs) {
      rect(lx, ly, 2, 293 - ly, P.accentDark);
      rect(lx, 293, 3, 1, P.accentDark);
    }

    // Grass along the bottom moves with the spectrum.
    const n = bands.length;
    for (let x = 0; x < WIDTH; x++) {
      const f = (x / WIDTH) * (n - 1);
      const i = Math.floor(f);
      const level = bands[i] + (bands[Math.min(n - 1, i + 1)] - bands[i]) * (f - i);
      const target = 6 + level * 34 * blades[(x + Math.floor(groundOffset * 1.5)) % WIDTH];
      grass[x] += (target - grass[x]) * (target > grass[x] ? 0.55 : 0.12);
    }
    for (let x = 0; x < WIDTH; x++) {
      const top = HEIGHT - Math.round(grass[x]);
      for (let y = Math.max(312, top); y < HEIGHT; y++) {
        index[y * WIDTH + x] = y - top < 2 && bayer(x, y) < 0.5 ? P.grassTip : P.grass;
      }
    }
    // Speckle the grass mass so it reads as texture, anchored to the scroll.
    const g = Math.floor(groundOffset * 1.5);
    for (let y = 330; y < HEIGHT; y += 3) for (let x = (y * 7 + g) % 9; x < WIDTH; x += 9) {
      const px = (x - (g % 9) + WIDTH) % WIDTH;
      if (index[y * WIDTH + px] === P.grass && (px + y) % 5 === 0) index[y * WIDTH + px] = P.grassTip;
    }

    // Brand chip (top left) and now-playing pill (top right); ffmpeg draws the text.
    roundedRect(16, 14, 112, 22, 6, P.pill);
    sprite(SMALL_MARK, 22, 19, P.accent);
    if (pillWidth > 0) {
      roundedRect(WIDTH - 16 - pillWidth, 14, pillWidth, 22, 6, P.pill);
      sprite(NOTE, WIDTH - 16 - pillWidth + 9, 22, P.accent);
    }

    for (let i = 0, o = 0; i < index.length; i++, o += 3) {
      const c = index[i] * 3;
      rgb[o] = palette[c];
      rgb[o + 1] = palette[c + 1];
      rgb[o + 2] = palette[c + 2];
    }
    return rgb;
  }

  return { render };
}

/** Daylight (0..1) for a time zone, with 45-minute dawn and dusk fades. */
export function daylightAt(date = new Date(), timeZone = 'Europe/Lisbon', sunrise = 7.5, sunset = 19.5) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour').value) % 24 + Number(parts.find((p) => p.type === 'minute').value) / 60;
  const fade = 0.75;
  if (h < sunrise - fade || h > sunset + fade) return 0;
  if (h < sunrise + fade) return (h - (sunrise - fade)) / (2 * fade);
  if (h > sunset - fade) return 1 - (h - (sunset - fade)) / (2 * fade);
  return 1;
}
