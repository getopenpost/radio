// The land, in parallax layers painted into chunks on demand. A chunk is a pure
// function of its position: each column asks what country and season its
// distance belongs to, so the same stretch always looks the same and seams take
// no care. Columns map to distance by (u - 320) / parallax, which puts the land
// behind the fox at its own distance and the right of the frame further ahead.
//
// Backdrop, near meadow and foreground are long painted plates, laid end to end
// and dissolved into each other. Only the road and the shore are code.
import { climate, eventsIn, geography } from './journey.js';
import { fbm, hash, noise, noise2 } from './nature.js';
import { CLEAR, plateSlot, ramp, S } from './palette.js';
import { plate } from './plates.js';

export const PATH_Y = 312; // the fox's feet
export const HORIZON = 208;
export const WATERLINE = 322; // where a boat sits on the near water
const CHUNK = 512;
const DOCK = 60;
const distance = (u, p) => (u - 320) / p;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

function createChunk(layer, index) {
  const x0 = index * CHUNK;
  const data = new Uint16Array(CHUNK * layer.h).fill(CLEAR);
  return {
    x0, data, top: layer.top, h: layer.h,
    set(x, y, c) {
      const lx = x - x0;
      const ly = y - layer.top;
      if (lx >= 0 && lx < CHUNK && ly >= 0 && ly < layer.h) data[ly * CHUNK + lx] = c;
    },
  };
}

/** Which season a pixel shows: seasons change in drifting patches. */
function seasonOf(c, u, y) {
  let r = noise2(u / 50, y / 22, 43) * 0.75 + hash(u, y, 44) * 0.25;
  for (const s of SEASONS) if ((r -= c[s]) < 0) return s;
  return 'winter';
}

/**
 * Lay one family of plates along a layer. Plates overlap by `seam` columns. Both
 * bend to a shared skyline, then a cut runs down the overlap along the path where
 * the two paintings differ least, so a tree stays whole on one side or the other.
 */
function paintPlates(layer, chunk, { family, width, seam, choice, bottom, limit = 60, shift = () => 0, cut = () => Infinity }) {
  const { x0 } = chunk;
  const pitch = width - seam;
  const plateOf = (cell, season) => plate(`${family}/${season}-${choice(cell)}`);
  const spec = { top: layer.top, bottom, pitch, seam, limit };
  for (let u = x0; u < x0 + CHUNK; u++) {
    const d = distance(u, layer.p);
    const c = climate(d);
    const cell = Math.floor(u / pitch);
    const px = u - cell * pitch;
    const down = shift(u, d);
    if (down == null) continue;
    const stop = Math.min(cut(u, d), layer.top + layer.h);
    const inSeam = px < seam;
    const seasonal = {};
    for (let y = layer.top; y < stop; y++) {
      const season = seasonOf(c, u, y);
      const ry = y - down;
      if (inSeam) {
        // Each season's painting differs a little, so each has its own join.
        const a = plateOf(cell - 1, season);
        const b = plateOf(cell, season);
        const join = (seasonal[season] ??= joinOf(a, b, spec));
        const old = isOld(join, px, ry);
        const p = old ? a : b;
        const sy = settle(ry - (bottom - p.h) - (old ? join.bendOld[px] : join.bendNew[px]), p.h);
        if (sy < 0) continue;
        const v = p.data[sy * p.w + (old ? px + pitch : px)];
        if (v !== 255 && !stranded(join).has(px * 4096 + ry)) chunk.set(u, y, plateSlot(family, v));
        continue;
      }
      const p = plateOf(cell, season);
      const sy = ry - (bottom - p.h);
      if (sy < 0 || sy >= p.h) continue;
      const v = p.data[sy * p.w + px];
      if (v !== 255) chunk.set(u, y, plateSlot(family, v));
    }
  }
}

/** A bend can lift a plate off its base; the land below it is its own bottom rows, mirrored. */
const settle = (sy, h) => (sy < h ? sy : 2 * h - 1 - sy);

const joins = new Map();
/** Where one plate hands over to the next. */
function joinOf(a, b, { top, bottom, pitch, seam, limit }) {
  const key = `${a.name}>${b.name}`;
  if (joins.has(key)) return joins.get(key);
  const bendOld = new Int16Array(seam);
  const bendNew = new Int16Array(seam);
  for (let px = 0; px < seam; px++) {
    const gap = Math.max(-limit, Math.min(limit, skyline(b)[px] + bottom - b.h - (skyline(a)[px + pitch] + bottom - a.h)));
    const t = px / seam;
    const ease = t * t * (3 - 2 * t);
    bendOld[px] = Math.round(gap * ease);
    bendNew[px] = Math.round(-gap * (1 - ease));
  }
  const rows = bottom - top;
  const join = { a, b, bendOld, bendNew, pitch, seam, top, bottom, edge: new Int16Array(rows), lost: null };
  // Cheapest path from top to bottom, moving at most two columns a row.
  const cost = new Float32Array(rows * seam);
  for (let r = rows - 1; r >= 0; r--) {
    for (let px = 0; px < seam; px++) {
      const here = difference(join, px, r + top) + Math.abs(px / seam - 0.5) * 0.15;
      let best = r === rows - 1 ? 0 : Infinity;
      if (r < rows - 1) for (let k = Math.max(0, px - 2); k <= Math.min(seam - 1, px + 2); k++) best = Math.min(best, cost[(r + 1) * seam + k]);
      cost[r * seam + px] = here + best;
    }
  }
  let at = 0;
  for (let px = 1; px < seam; px++) if (cost[px] < cost[at]) at = px;
  for (let r = 0; r < rows; r++) {
    join.edge[r] = at;
    if (r === rows - 1) break;
    let next = at;
    for (let k = Math.max(0, at - 2); k <= Math.min(seam - 1, at + 2); k++) if (cost[(r + 1) * seam + k] < cost[(r + 1) * seam + next]) next = k;
    at = next;
  }
  joins.set(key, join);
  return join;
}

/** One side of a join at a pixel of its plate, or null for sky. */
function sample(join, old, px, ry) {
  const p = old ? join.a : join.b;
  const sy = settle(ry - (join.bottom - p.h) - (old ? join.bendOld[px] : join.bendNew[px]), p.h);
  if (sy < 0) return null;
  const v = p.data[sy * p.w + (old ? px + join.pitch : px)];
  return v === 255 ? null : v;
}

/** How far apart the two plates are at a pixel. Land against sky is the worst place to cut. */
function difference(join, px, ry) {
  const a = sample(join, true, px, ry);
  const b = sample(join, false, px, ry);
  if (a == null && b == null) return 0;
  if (a == null || b == null) return 30;
  let sum = 0;
  for (let k = 0; k < 3; k++) sum += Math.abs(join.a.rgb[a * 3 + k] - join.a.rgb[b * 3 + k]);
  return sum / 150;
}

/** The side of the cut a pixel falls on. A few pixels of noise stop it reading as a line. */
function isOld(join, px, ry) {
  const r = Math.max(0, Math.min(join.edge.length - 1, ry - join.top));
  return px < join.edge[r] + (hash(px, ry, 45) - 0.5) * 7;
}

/** Pixels the cut left holding on to nothing. They are dropped. */
function stranded(join) {
  if (join.lost) return join.lost;
  const { top, bottom, seam } = join;
  const rows = bottom - top;
  const solid = new Uint8Array(rows * seam);
  for (let r = 0; r < rows; r++) for (let px = 0; px < seam; px++) solid[r * seam + px] = sample(join, isOld(join, px, r + top), px, r + top) == null ? 0 : 1;
  const stack = [];
  const seen = new Uint8Array(rows * seam);
  const visit = (i) => {
    if (solid[i] && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let px = 0; px < seam; px++) visit((rows - 1) * seam + px);
  for (let r = 0; r < rows; r++) {
    visit(r * seam);
    visit(r * seam + seam - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const px = i % seam;
    if (px > 0) visit(i - 1);
    if (px < seam - 1) visit(i + 1);
    if (i >= seam) visit(i - seam);
    if (i + seam < solid.length) visit(i + seam);
  }
  const lost = new Set();
  for (let i = 0; i < solid.length; i++) if (solid[i] && !seen[i]) lost.add((i % seam) * 4096 + Math.floor(i / seam) + top);
  join.lost = lost;
  return lost;
}

const skylines = new Map();
/** The top of a plate's land per column. Near land is smoothed so single trees do not bend it; far ridges are matched closely. */
function skyline(p) {
  if (skylines.has(p)) return skylines.get(p);
  const top = new Float32Array(p.w);
  for (let x = 0; x < p.w; x++) {
    let y = 0;
    while (y < p.h - 1 && p.data[y * p.w + x] === 255) y++;
    top[x] = y;
  }
  const out = top.map((_, x) => {
    let sum = 0;
    let n = 0;
    const reach = p.family === 'plates' ? 5 : 24;
    for (let k = Math.max(0, x - reach); k <= Math.min(p.w - 1, x + reach); k++) {
      sum += top[k];
      n++;
    }
    return sum / n;
  });
  skylines.set(p, out);
  return out;
}

// Which painted hills suit each country.
const HILLS_FOR = { meadow: [1, 3, 6], valley: [3, 2, 7], lake: [1, 5, 6], alpine: [4, 2], forest: [2, 4, 7], coast: [1, 5] };
const countryName = (g) => (g.sea > 0.5 ? 'coast' : g.lake > 0.5 ? 'lake' : g.alpine > 0.5 ? 'alpine' : g.river > 0.5 ? 'valley' : g.forest > 0.7 ? 'forest' : 'meadow');

function paintHills(layer, chunk) {
  const width = 760;
  const seam = 170;
  paintPlates(layer, chunk, {
    family: 'plates', width, seam, bottom: 318,
    choice(cell) {
      const options = HILLS_FOR[countryName(geography(distance((cell + 0.5) * (width - seam), layer.p)))];
      return options[Math.floor(hash(cell, 41) * options.length)];
    },
    shift: (u, d) => Math.round(geography(d).sea * 240),
    cut(u, d) {
      const g = geography(d);
      if (g.sea > 0.02) return HORIZON + 4;
      return g.lake > 0.02 ? Math.round(318 + (232 + fbm(u / 40, 14) * 12 - 318) * Math.min(1, g.lake * 1.4)) : 318;
    },
  });
}

/** The near meadow. */
function paintNear(layer, chunk) {
  const width = 800;
  const seam = 200;
  paintPlates(layer, chunk, {
    family: 'near', width, seam, limit: 28, bottom: PATH_Y - 3,
    // Mostly open meadow; the odd farm.
    choice: (cell) => (hash(cell, 52) < 0.14 ? 4 : 1 + Math.floor(hash(cell, 51) * 3)),
    // The meadow sinks towards the water and is gone over it.
    shift(u, d) {
      const gap = shoreGap(d, 420) / 420;
      return gap === 0 ? null : Math.round((1 - gap) ** 2 * 200);
    },
    // Land going under stops at the waterline.
    cut: (u, d) => (shoreGap(d, 420) < 420 ? PATH_Y + 8 : Infinity),
  });
}

/** Ground distance from the nearest water, up to `reach`; 0 on the water. */
function shoreGap(d, reach) {
  let gap = reach;
  for (const e of eventsIn(d - reach - DOCK, d + reach + DOCK)) {
    if (e.kind !== 'row' && e.kind !== 'sail') continue;
    const from = e.a - DOCK;
    const to = e.b + DOCK;
    gap = Math.min(gap, d < from ? from - d : d > to ? d - to : 0);
  }
  return gap;
}

/** The stretch of road that is under water, with a margin of shore. */
function crossing(d, margin = 0) {
  const reach = Math.abs(margin) + DOCK;
  for (const e of eventsIn(d - reach, d + reach)) {
    if ((e.kind === 'row' || e.kind === 'sail') && d > e.a - DOCK - margin && d < e.b + DOCK + margin) return e;
  }
  return null;
}

/** The ground under the fox: a pale level road and the dry meadow below it. */
function paintGround(layer, chunk) {
  const { x0 } = chunk;
  const bottom = layer.top + layer.h;
  for (let u = x0; u < x0 + CHUNK; u++) {
    const d = u - 320;
    if (crossing(d, -46)) continue;
    const e = crossing(d, 60);
    const c = climate(d);
    const roadTop = PATH_Y - 7 + Math.round(noise(u / 22, 102) * 2);
    const roadEnd = PATH_Y + 8 + Math.round(noise(u / 26, 103) * 3);
    for (let y = roadTop; y < bottom; y++) {
      if (e) {
        const out = (d < (e.a + e.b) / 2 ? d - (e.a - DOCK) : e.b + DOCK - d) + (y - 292) * 1.5 - 46 + noise(y / 4, 130) * 12;
        if (out > 0) continue;
        if (out > -4) {
          chunk.set(u, y, S.foam);
          continue;
        }
      }
      const white = noise2(u / 44, y / 12, 104) * 0.7 + hash(u, y, 106) * 0.3 < c.winter;
      if (y <= roadEnd) {
        const tones = white ? ramp('snow', 0) : [S.path0, S.path1, S.path2, S.path3];
        const r = hash(u, y, 105);
        let tone = r < 0.56 ? 0 : r < 0.86 ? 1 : r < 0.97 ? 2 : 3;
        if (y === roadTop || y === roadEnd) tone = hash(u, 106) < 0.5 ? 2 : 1;
        const pool = !white && noise2(u / 38, y / 6, 108) * 0.8 + hash(u, y, 107) * 0.2 > 0.66;
        chunk.set(u, y, pool ? S.puddle : tones[tone]);
        continue;
      }
      // Dry verge with pale pebbles, as in the reference.
      const tones = white ? ramp('snow', 0) : ramp('dry', 0);
      const shade = 0.2 + (y - roadEnd) / 34 + (noise2(u / 22, y / 8, 109) - 0.5) * 1.5;
      const pebble = !white && hash(u >> 1, y >> 1, 110) < 0.012;
      chunk.set(u, y, pebble ? S.path2 : tones[Math.max(0, Math.min(3, Math.floor(shade + hash(u, y, 79))))]);
    }
  }
  const wood = ramp('bark', 0);
  for (const e of eventsIn(x0 - 520, x0 + CHUNK)) {
    if (e.kind !== 'row' && e.kind !== 'sail') continue;
    for (const [from, to] of [[e.a - DOCK - 6, e.a + 14], [e.b - 14, e.b + DOCK + 6]]) {
      for (let d = from; d < to; d++) {
        const u = d + 320;
        for (let y = PATH_Y - 4; y < PATH_Y + 5; y++) chunk.set(u, y, y === PATH_Y + 4 ? wood[2] : d % 7 === 0 ? wood[2] : y === PATH_Y - 4 ? wood[0] : wood[1]);
        if ((d - from) % 26 === 3) for (let y = PATH_Y - 8; y < WATERLINE + 8; y++) for (let k = 0; k < 3; k++) chunk.set(u + k, y, y > WATERLINE ? S.water3 : wood[k]);
      }
    }
  }
}

/** The dark plants along the bottom of the picture. */
function paintFront(layer, chunk) {
  paintPlates(layer, chunk, {
    family: 'front', width: 620, seam: 90, bottom: 398,
    choice: (cell) => 1 + Math.floor(hash(cell, 61) * 2),
    // The plants sink out of the picture before the shore.
    shift(u, d) {
      const gap = shoreGap(d, 150) / 150;
      return gap === 0 ? null : Math.round((1 - gap) ** 2 * 80);
    },
  });
}

const LAYERS = [
  { name: 'hills', p: 0.1, top: 40, h: 278, paint: paintHills },
  { name: 'near', p: 0.5, top: 20, h: 320, paint: paintNear },
  { name: 'ground', p: 1, top: 296, h: 64, paint: paintGround },
  { name: 'front', p: 1.45, top: 290, h: 70, paint: paintFront },
];

export function createLandscape() {
  const caches = LAYERS.map(() => new Map());

  function chunkAt(i, index) {
    const cache = caches[i];
    let c = cache.get(index);
    if (!c) {
      const layer = LAYERS[i];
      c = createChunk(layer, index);
      layer.paint(layer, c);
      cache.set(index, c);
      if (cache.size > 5) cache.delete(cache.keys().next().value);
    }
    return c;
  }

  function blitChunk(canvas, c, sx) {
    const { index } = canvas;
    for (let row = 0; row < c.h; row++) {
      const y = c.top + row;
      if (y >= 360) break;
      const from = Math.max(0, -sx);
      const to = Math.min(CHUNK, 640 - sx);
      const src = row * CHUNK;
      const dst = y * 640 + sx;
      for (let i = from; i < to; i++) {
        const v = c.data[src + i];
        if (v !== CLEAR) index[dst + i] = v;
      }
    }
  }

  /** Draw one layer for a view of the ground. */
  function draw(canvas, i, ground) {
    const layer = LAYERS[i];
    const left = Math.floor(ground * layer.p);
    const first = Math.floor(left / CHUNK);
    for (let index = first; index * CHUNK < left + 640; index++) {
      const c = chunkAt(i, index);
      blitChunk(canvas, c, index * CHUNK - left);
    }
  }

  return { draw };
}

export { crossing, DOCK };
