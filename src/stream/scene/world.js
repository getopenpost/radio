// The landscape: three pre-dithered strips (far range, hills, ground) that
// tile horizontally and scroll at different speeds. The world changes region
// every couple of hours (alpine, rolling hills, forest, village, coast) and
// is rebuilt for each season, so the walk keeps passing new country.
import { createRng, hashString } from '../../compose/rng.js';
import { bayer, clamp01, smooth } from './dither.js';
import { CLEAR, S } from './palette.js';

export const STRIP = 4096;
export const LAYERS = {
  far: { top: 130, height: 170 },
  hills: { top: 196, height: 106 },
  ground: { top: 282, height: 78 },
};
export const PATH_Y = 296; // where feet land
export const BIOMES = ['hills', 'alpine', 'forest', 'village', 'coast'];

function makeStrip({ top, height }) {
  return { top, height, data: new Uint8Array(STRIP * height).fill(CLEAR), dynamic: [] };
}

/** Smooth periodic noise; `sharp` folds it into ridged peaks. Periods must divide STRIP. */
function ridge(rng, octaves, sharp = 0) {
  const parts = octaves.map(([period, amp]) => ({ k: STRIP / period, amp, phase: rng.float(0, Math.PI * 2) }));
  return (x) => {
    let s = 0;
    for (const p of parts) {
      const v = Math.sin((2 * Math.PI * p.k * x) / STRIP + p.phase);
      s += p.amp * (sharp ? (1 - sharp) * v + sharp * (1 - 2 * Math.abs(v)) : v);
    }
    return s;
  };
}

/** Hash noise in [0, 1) for a pixel, stable per strip. */
const grain = (x, y, salt) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Fill a strip below a ridgeline with two shades dithered by slope (light
 * from the upper left), plus mist towards the base.
 */
function shadeRange(strip, line, { lit, shade, mist, mistFrom, mistTo, slopeGain = 2.2, base = 0.45, depthGain = 0 }) {
  for (let x = 0; x < STRIP; x++) {
    const h = line(x);
    // Slope over a few pixels, so jagged ridges shade in faces, not in stripes.
    const slope = (line((x + 4) % STRIP) - line((x + STRIP - 4) % STRIP)) / 4;
    for (let y = Math.max(strip.top, Math.ceil(h)); y < strip.top + strip.height; y++) {
      const below = y - h;
      // Rising faces (slope < 0) catch the light near the ridge, fading lower
      // down; a soft rim right under the ridge.
      let t = base + slope * slopeGain * 0.25 * Math.max(0, 1 - below / 28) + below * depthGain - (below < 2 ? 0.25 : 0);
      t = clamp01(t);
      const i = (y - strip.top) * STRIP + x;
      strip.data[i] = t > bayer(x, y) ? shade : lit;
      if (mist != null) {
        const m = smooth((y - mistFrom) / (mistTo - mistFrom)) * 0.5;
        if (m > bayer(x + 3, y + 5)) strip.data[i] = mist;
      }
    }
  }
}

// Vegetation and buildings, drawn straight into a strip at a base point.
function pine(strip, x, base, h, season) {
  const w = Math.max(3, Math.round(h * 0.42));
  for (let y = 0; y < h; y++) {
    const yy = base - h + y;
    const tier = (y % 5) / 5;
    const half = Math.max(0, Math.round(((y + 1) / h) * w * (0.7 + tier * 0.4)));
    for (let dx = -half; dx <= half; dx++) {
      const xx = (x + dx + STRIP) % STRIP;
      let c = dx < 0 || (dx === 0 && y % 2) ? S.pine0 : S.pine1;
      if (season === 'winter' && y % 5 < 2 && dx < half) c = S.snowcap;
      put(strip, xx, yy, c);
    }
  }
  for (let y = 0; y < 3; y++) put(strip, x, base + y - 1, S.trunk);
}

function broadleaf(strip, x, base, h, season, rng) {
  const r = Math.max(3, Math.round(h * 0.38));
  const cy = base - h + r;
  const trunkTop = season === 'winter' ? base - h + 2 : cy;
  for (let y = trunkTop; y <= base; y++) put(strip, x, y, S.trunk);
  if (season === 'winter') {
    // Bare branches with a little snow.
    for (const [dx, dy, len] of [[-1, 0, r], [1, 0, r], [-1, 1, r - 1], [1, 1, r - 2]]) {
      for (let i = 1; i <= len; i++) {
        const xx = x + dx * i;
        const yy = cy + dy * 3 - Math.round(i * 0.8) - 1;
        put(strip, (xx + STRIP) % STRIP, yy, S.trunk);
        if (i === len) put(strip, (xx + STRIP) % STRIP, yy - 1, S.snowcap);
      }
    }
    return;
  }
  for (let y = -r; y <= r; y++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = (dx / (r + 1)) ** 2 + (y / r) ** 2;
      if (d > 1 - rng.float(0, 0.15)) continue;
      const xx = (x + dx + STRIP) % STRIP;
      const yy = cy + y;
      const t = clamp01(0.35 + (dx + y) / (2 * r) * 0.7);
      let c = t > bayer(xx, yy) ? S.leaf1 : S.leaf0;
      if ((season === 'spring' || season === 'autumn') && grain(xx, yy, 7) < 0.14) c = S.blossom;
      put(strip, xx, yy, c);
    }
  }
}

function house(strip, x, base, rng) {
  const w = rng.int(9, 15);
  const h = rng.int(6, 9);
  const roof = Math.ceil(w / 2);
  for (let y = 0; y < h; y++) for (let dx = 0; dx < w; dx++) put(strip, (x + dx) % STRIP, base - h + y, S.wall);
  for (let y = 0; y < roof; y++) for (let dx = y - 1; dx <= w - y; dx++) put(strip, (x + dx + STRIP) % STRIP, base - h - roof + y + 1, S.roof);
  const lit = rng.chance(0.75);
  for (let wx = 2; wx + 2 <= w - 1; wx += 4) {
    for (let y = 0; y < 2; y++) for (let dx = 0; dx < 2; dx++) put(strip, (x + wx + dx) % STRIP, base - h + 2 + y, lit && rng.chance(0.8) ? S.window : S.windowOff);
  }
  if (rng.chance(0.6)) for (let y = 0; y < 3; y++) put(strip, (x + w - 3) % STRIP, base - h - roof + y, S.roof);
  return { kind: 'chimney', x: x + w - 3, y: base - h - roof - 1 };
}

function put(strip, x, y, c) {
  const yy = y - strip.top;
  if (yy >= 0 && yy < strip.height && x >= 0 && x < STRIP) strip.data[yy * STRIP + x] = c;
}

function buildFar(rng, biome) {
  const strip = makeStrip(LAYERS.far);
  if (biome === 'coast') {
    // The sea to the horizon, with a few islands.
    const horizon = 232;
    for (let y = horizon; y < strip.top + strip.height; y++) {
      const t = (y - horizon) / 60;
      for (let x = 0; x < STRIP; x++) {
        const wave = grain(x >> 3, y, 3) < 0.18 && (y - horizon) % 3 === 0;
        put(strip, x, y, wave || t * 0.8 > bayer(x, y) ? S.sea1 : S.sea0);
      }
    }
    const island = ridge(rng, [[512, 9], [256, 5], [128, 2]]);
    for (let x = 0; x < STRIP; x++) {
      const h = horizon - Math.max(0, island(x) - 4);
      for (let y = Math.ceil(h); y < horizon; y++) put(strip, x, y, (horizon - y) * 0.15 + 0.3 > bayer(x, y) ? S.far1 : S.far0);
    }
    return strip;
  }
  const shapes = {
    alpine: { base: 196, octaves: [[1024, 30], [512, 18], [256, 9], [128, 4], [64, 2]], sharp: 0.7 },
    forest: { base: 210, octaves: [[1024, 14], [512, 8], [256, 4], [128, 2]], sharp: 0.2 },
    hills: { base: 212, octaves: [[1024, 12], [512, 7], [256, 4], [128, 2]], sharp: 0 },
    village: { base: 214, octaves: [[1024, 11], [512, 6], [256, 3], [128, 2]], sharp: 0.1 },
  }[biome];
  const back = ridge(rng, shapes.octaves, shapes.sharp);
  const front = ridge(rng, shapes.octaves.map(([p, a]) => [p, a * 0.6]), shapes.sharp * 0.6);
  const backLine = (x) => shapes.base + back(x);
  const frontLine = (x) => shapes.base + 18 + front(x);
  // Mist dithers towards the lit tone, a low-contrast pair, so it reads as haze rather than dotted rows.
  shadeRange(strip, backLine, { lit: S.far0, shade: S.far1, mist: S.far0, mistFrom: shapes.base + 6, mistTo: shapes.base + 70, base: 0.35 });
  shadeRange(strip, frontLine, { lit: S.far0, shade: S.far1, mist: S.far0, mistFrom: shapes.base + 30, mistTo: shapes.base + 95, base: 0.62 });
  // Snow on the high ground (only visible in winter, or always on alpine
  // peaks): it follows the ridge down, deeper on higher peaks, with a ragged
  // dithered edge.
  const capLine = shapes.base - (biome === 'alpine' ? 6 : 4);
  for (let x = 0; x < STRIP; x++) {
    const h = backLine(x);
    if (h > capLine) continue;
    const depth = (capLine - h) * 0.7 + 2 + (grain(x >> 2, 0, 21) - 0.5) * 4;
    for (let y = Math.ceil(h); y < h + depth; y++) {
      const t = 1 - smooth((y - h) / depth - 0.4);
      if (t > bayer(x, y)) put(strip, x, y, biome === 'alpine' ? S.glacier : S.peak);
    }
  }
  return strip;
}

function buildHills(rng, biome, season) {
  const strip = makeStrip(LAYERS.hills);
  const base = { alpine: 246, forest: 244, hills: 250, village: 250, coast: 262 }[biome];
  const shape = ridge(rng, [[1024, 9], [512, 6], [256, 3], [128, 1.5]]);
  const line = (x) => base + shape(x);
  shadeRange(strip, line, { lit: S.hill0, shade: S.hill1, mist: S.hill0, mistFrom: base + 12, mistTo: base + 60, base: 0.4 });
  const density = { alpine: [40, 110], forest: [7, 20], hills: [30, 90], village: [40, 110], coast: [70, 200] }[biome];
  const pineShare = { alpine: 0.9, forest: 0.7, hills: 0.25, village: 0.35, coast: 0.3 }[biome];
  for (let x = rng.int(0, 40); x < STRIP - 24; x += rng.int(...density)) {
    const b = Math.round(line(x)) + 1;
    const h = rng.int(10, biome === 'forest' ? 26 : 22);
    if (rng.chance(pineShare)) pine(strip, x, b, h, season);
    else broadleaf(strip, x, b, h, season, rng);
  }
  if (biome === 'village' || biome === 'hills') {
    const every = biome === 'village' ? [60, 180] : [500, 1100];
    for (let x = rng.int(20, 200); x < STRIP - 40; x += rng.int(...every)) {
      strip.dynamic.push(house(strip, x, Math.round(Math.max(line(x), line(x + 14))) + 1, rng));
      if (biome === 'village' && rng.chance(0.3)) x += 20;
    }
  }
  if (biome === 'hills') {
    for (let x = rng.int(300, 900); x < STRIP - 60; x += rng.int(1400, 2200)) strip.dynamic.push({ kind: 'windmill', x, y: Math.round(line(x)) + 1 });
  }
  if (biome === 'coast') {
    const x = rng.int(600, 3000);
    const y = Math.round(line(x)) + 1;
    for (let yy = y - 24; yy <= y; yy++) {
      const half = 2 + Math.floor((yy - (y - 24)) / 10);
      for (let dx = -half; dx <= half; dx++) put(strip, x + dx, yy, Math.floor((yy - y) / 4) % 2 ? S.wall : S.roof);
    }
    for (let dx = -2; dx <= 2; dx++) put(strip, x + dx, y - 25, S.ink);
    strip.dynamic.push({ kind: 'lighthouse', x, y: y - 27 });
  }
  return strip;
}

function buildGround(rng) {
  const strip = makeStrip(LAYERS.ground);
  const edge = ridge(rng, [[256, 1.2], [64, 0.8]]);
  for (let x = 0; x < STRIP; x++) {
    const top = Math.round(286 + edge(x));
    for (let y = top; y < strip.top + strip.height; y++) {
      const onPath = y >= PATH_Y - 3 && y <= PATH_Y + 3;
      const nearPath = y === PATH_Y - 4 || y === PATH_Y + 4;
      let c;
      if (onPath) c = grain(x, y, 11) < 0.05 ? S.pathEdge : S.path;
      else if (nearPath) c = grain(x, y, 12) < 0.55 ? S.pathEdge : S.ground1;
      else {
        const t = 0.25 + (y - top) * 0.02 + (grain(x >> 1, y >> 1, 13) - 0.5) * 0.5;
        c = t > bayer(x, y) ? S.ground1 : S.ground0;
        if (grain(x, y, 14) < 0.004) c = S.flower;
      }
      if (y === top) c = S.ground1;
      put(strip, x, y, c);
    }
  }
  // Pebbles on the path.
  for (let x = rng.int(0, 30); x < STRIP; x += rng.int(18, 70)) {
    const y = PATH_Y + rng.int(-2, 2);
    put(strip, x, y, S.pathEdge);
    if (rng.chance(0.4)) put(strip, x + 1, y, S.pathEdge);
  }
  return strip;
}

/** Build all three strips for a region and season. */
export function buildWorld(region, season) {
  const rng = createRng(hashString(`region:${region}`));
  const biome = rng.pick(BIOMES);
  const seed = (n) => createRng(hashString(`region:${region}:${n}`));
  return {
    region,
    biome,
    season,
    far: buildFar(seed('far'), biome),
    hills: buildHills(seed('hills'), biome, season),
    ground: buildGround(seed('ground')),
  };
}
