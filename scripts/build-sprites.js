// Cut the painted grid sheets in assets/scene into sprites on the scene's single
// pixel grid. Sprites are never scaled at runtime, so every pixel on screen is
// the same size. Each sheet is reduced at its own block size, found by fitting
// the grid, and all art shares a quantised palette written to sprites.json.
// Needs ffmpeg. Run after changing a sheet: node scripts/build-sprites.js
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../assets/scene/', import.meta.url).pathname;
// name: [columns, rows, block (sheet pixels per art pixel), family].
// The block is what fixes a sprite's size on screen; the fox is 72 pixels tall in every sheet.
const SHEETS = {
  'fox/walk12': [6, 2, 4, 'actor'], 'fox/walk12-rain': [6, 2, 4, 'actor'], 'fox/walk12-snow': [6, 2, 4, 'actor'],
  'fox/idle-moves': [6, 2, 4, 'actor'], 'fox/gestures': [4, 2, 5, 'actor'],
  'fox/pedal': [4, 2, 4.3, 'actor'], 'fox/ride': [4, 2, 5.5, 'actor'],
  'fox/row': [6, 2, 3, 'actor'], 'fox/sail': [4, 2, 2.95, 'actor'],
  'fox/broom': [3, 2, 4, 'actor'], 'fox/friends': [4, 2, 5, 'actor'], 'fox/props': [3, 1, 9, 'actor'],
  'fox/gym': [4, 2, 5, 'actor'], 'fox/hop': [4, 2, 4.45, 'actor'],
  'fox/pullup': [6, 3, 2.4, 'actor'], 'fox/dip': [6, 1, 4.2, 'actor'], 'fox/pushup': [6, 1, 3.5, 'actor'],
};
// One clean head per outfit, in sheet pixels from the cell corner. It is matched and
// pasted into every listed frame, so eyes and face are the same pixels throughout.
const every = (n) => Array.from({ length: n }, (_, i) => i);
const HEADS = {
  'fox/walk12': { master: 0, box: [150, 30, 345, 205], frames: every(12) },
  'fox/walk12-rain': { master: 0, box: [150, 20, 345, 205], frames: every(12) },
  'fox/walk12-snow': { master: 0, box: [108, 15, 345, 205], frames: every(12) },
  'fox/pedal': { master: 0, box: [185, 50, 385, 240], frames: every(8) },
  'fox/row': { master: 0, box: [120, 60, 245, 175], frames: every(12) },
  'fox/broom': { master: 0, box: [150, 50, 440, 255], frames: [0, 1, 2, 3] },
};
// Frames that share a fixed object are shifted so that object never moves: [cell box].
const STEADY = { 'fox/row': [10, 225, 350, 340], 'fox/sail': [20, 300, 420, 430], 'fox/pedal': [120, 280, 410, 400], 'fox/dip': [20, 575, 345, 628] };
// Workout sheets record the row of their painted bar, so the frame can be hung on the real one.
const BARRED = new Set(['fox/pullup', 'fox/dip']);
// The hop again in the fox's other outfits: the outfit's head is pasted over each frame.
const DRESSED = [['fox/hop', 'hop-snow', 'fox/walk12-snow', [0, 1, 2, 3, 4, 5, 6, 7]], ['fox/hop', 'hop-rain', 'fox/walk12-rain', [0, 1, 2, 3, 4, 5, 6, 7]]];

function load(name) {
  const file = `${ROOT}${name}.png`;
  const size = spawnSync('ffmpeg', ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr.match(/, (\d+)x(\d+)/);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  return { w: Number(size[1]), h: Number(size[2]), rgb: raw.stdout };
}

// Magenta and anything tinted by it. Orange has blue below green, and red has blue
// far below its own red (the broom scarf), so neither is mistaken for the background.
const isKey = (r, g, b) => b > g + 14 && r > g + 30 && b > r * 0.55;
const isLine = (r, g, b) => r > 215 && g > 215 && b > 215;

/** One art pixel: the commonest colour of a block, or -1 if it is mostly background. */
function block(img, x0, y0, f, x1, y1) {
  const bins = new Map();
  let clear = 0;
  let n = 0;
  for (let y = Math.round(y0); y < Math.round(y0 + f) && y < y1; y++) {
    for (let x = Math.round(x0); x < Math.round(x0 + f) && x < x1; x++) {
      const i = (y * img.w + x) * 3;
      const [r, g, b] = [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
      n++;
      if (isKey(r, g, b)) {
        clear++;
        continue;
      }
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bin.n++;
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bins.set(key, bin);
    }
  }
  if (!n || clear >= n * 0.5) return { c: -1, purity: clear / (n || 1) };
  let best = null;
  for (const b of bins.values()) if (!best || b.n > best.n) best = b;
  return { c: (Math.round(best.r / best.n) << 16) | (Math.round(best.g / best.n) << 8) | Math.round(best.b / best.n), purity: best.n / n };
}

/** The block size and phase under which blocks are most uniform. */
function fit(img, cell, wanted) {
  const sizes = wanted ? [wanted] : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20];
  let best = { score: -1 };
  for (const f of sizes) {
    for (let px = 0; px < f; px += Math.max(1, f / 6)) {
      for (let py = 0; py < f; py += Math.max(1, f / 6)) {
        let sum = 0;
        let n = 0;
        for (let y = cell.y0 + py; y + f < cell.y1; y += f * 2) {
          for (let x = cell.x0 + px; x + f < cell.x1; x += f * 2) {
            const b = block(img, x, y, f, cell.x1, cell.y1);
            sum += b.purity;
            n++;
          }
        }
        const score = sum / n + f * 0.002; // ties go to the bigger block
        if (score > best.score) best = { score, f, px, py };
      }
    }
  }
  return best;
}

/** Cell bounds from the sheet's actual white lines, falling back to equal cells. */
function spans(img, count, across) {
  const size = across ? img.w : img.h;
  const other = across ? img.h : img.w;
  const white = [];
  for (let i = 0; i < size; i++) {
    let n = 0;
    for (let j = 0; j < other; j += 4) {
      const p = (across ? j * img.w + i : i * img.w + j) * 3;
      if (isLine(img.rgb[p], img.rgb[p + 1], img.rgb[p + 2])) n++;
    }
    white.push(n / (other / 4) > 0.8);
  }
  const lines = [];
  for (let i = 0; i < size; i++) {
    if (!white[i]) continue;
    let j = i;
    while (j + 1 < size && white[j + 1]) j++;
    if (i > size * 0.02 && j < size * 0.98) lines.push((i + j) / 2);
    i = j;
  }
  const edges = lines.length === count - 1 ? [0, ...lines, size] : Array.from({ length: count + 1 }, (_, i) => (i * size) / count);
  return edges.slice(0, -1).map((e, i) => [Math.round(e), Math.round(edges[i + 1])]);
}

function cells(img, cols, rows) {
  const out = [];
  const xs = spans(img, cols, true);
  const ys = spans(img, rows, false);
  for (const [y0, y1] of ys) for (const [x0, x1] of xs) out.push({ x0: x0 + 7, x1: x1 - 7, y0: y0 + 7, y1: y1 - 7 });
  return out;
}

/** Stray specks (bits of grid line, fringe) never join the sprite: keep the largest connected shape and anything close to it. */
function keepLargest(px, W, H) {
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let i = 0; i < px.length; i++) {
    if (px[i] < 0 || label[i] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [i];
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % W;
      const y = (p / W) | 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const q = (y + dy) * W + x + dx;
          if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && px[q] >= 0 && label[q] < 0) {
            label[q] = id;
            stack.push(q);
          }
        }
      }
    }
    sizes.push(size);
  }
  const best = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < px.length; i++) if (px[i] >= 0 && label[i] !== best) px[i] = -1;
}

function cut(name, [cols, rows, f], dress) {
  const img = load(name);
  const list = cells(img, cols, rows);
  const grids = list.map((cell) => {
    const { px, py } = fit(img, cell, f);
    const W = Math.floor((cell.x1 - cell.x0 - px) / f);
    const H = Math.floor((cell.y1 - cell.y0 - py) / f);
    const grid = new Int32Array(W * H).fill(-1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = block(img, cell.x0 + px + x * f, cell.y0 + py + y * f, f, cell.x1, cell.y1).c;
        if (c < 0 || ((x < 1 || y < 1 || x >= W - 1 || y >= H - 1) && isLine(c >> 16, (c >> 8) & 255, c & 255))) continue;
        grid[y * W + x] = c;
      }
    }
    return { W, H, grid, sx: 0, sy: 0 };
  });
  if (HEADS[name]) lockHeads(grids, HEADS[name], f, name);
  if (dress) for (const i of dress.frames) wear(grids[i], heads[dress.head]);
  if (name === 'fox/gestures' || name === 'fox/idle-moves') alignToWalk(grids);
  if (STEADY[name]) {
    const patch = patchOf(grids[0], STEADY[name], f);
    for (const g of grids) {
      const { dx, dy } = bestOffset(g, patch, 6);
      g.sx = -dx;
      g.sy = dy;
    }
  }
  const sprites = grids.map(({ W, H, grid, sx, sy }) => {
    if (!grid.some((c) => c >= 0)) return null;
    keepLargest(grid, W, H);
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (grid[y * W + x] < 0) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const data = new Int32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = grid[(y + y0) * W + x + x0];
    // Anchor: offset of the sprite's left edge from the cell's centre, and of its bottom from the cell's floor.
    const out = { w, h, ox: x0 - Math.floor(W / 2) + sx, oy: H - 1 - y1 + sy, data };
    if (BARRED.has(name)) out.bar = barRow(out);
    return out;
  }).filter(Boolean);
  return { f, sprites };
}

/** The row of a frame's painted bar above the cell floor: the row with the most unwarm pixels. */
function barRow(s) {
  let best = 0;
  let row = 0;
  for (let y = 0; y < s.h; y++) {
    let n = 0;
    for (let x = 0; x < s.w; x++) {
      const c = s.data[y * s.w + x];
      if (c >= 0 && (c >> 16) - (c & 255) < 60) n++;
    }
    if (n > best) [best, row] = [n, y];
  }
  return s.h - 1 - row + s.oy;
}

const dist = (a, b) => (a < 0 || b < 0 ? (a === b ? 0 : 3000) : Math.abs((a >> 16) - (b >> 16)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.abs((a & 255) - (b & 255)));

function patchOf(g, box, f) {
  const [x0, y0, x1, y1] = box.map((v) => Math.round(v / f));
  const list = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (g.grid[y * g.W + x] >= 0) list.push({ x, y, c: g.grid[y * g.W + x] });
  return { x0, y0, x1, y1, cells: list };
}

function bestOffset(g, patch, reach) {
  let best = { score: Infinity, dx: 0, dy: 0 };
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      let score = 0;
      for (const p of patch.cells) {
        const x = p.x + dx;
        const y = p.y + dy;
        score += x >= 0 && y >= 0 && x < g.W && y < g.H ? dist(p.c, g.grid[y * g.W + x]) : 3000;
      }
      if (score < best.score) best = { score, dx, dy };
    }
  }
  return best;
}

let walkHead = null;
const heads = {};
function lockHeads(grids, { master, box, frames }, f, name) {
  const patch = patchOf(grids[master], box, f);
  heads[name] = patch;
  if (box === HEADS['fox/walk12'].box) walkHead = patch;
  for (const i of frames) {
    if (i === master) continue;
    const g = grids[i];
    const { dx, dy } = bestOffset(g, patch, 10);
    if (name.startsWith('fox/walk12')) {
      // Keep the whole painted pose registered to its master face. Cell bounds
      // and matching offsets otherwise make it jitter by one or two art pixels.
      g.sx = -dx + Math.floor(g.W / 2) - Math.floor(grids[master].W / 2);
      g.sy = dy + grids[master].H - g.H;
    }
    for (let y = patch.y0 + dy; y < patch.y1 + dy; y++) for (let x = patch.x0 + dx; x < patch.x1 + dx; x++) if (x >= 0 && y >= 0 && x < g.W && y < g.H) g.grid[y * g.W + x] = -1;
    for (const p of patch.cells) if (p.x + dx >= 0 && p.y + dy >= 0 && p.x + dx < g.W && p.y + dy < g.H) g.grid[(p.y + dy) * g.W + p.x + dx] = p.c;
  }
}

/** The end of the nose: the furthest-forward pixel of the head, enough to place another head on it. */
function noseOf(cells, rows = Infinity) {
  const right = Math.max(...cells.map((p) => p.x));
  const left = Math.min(...cells.map((p) => p.x));
  const side = cells.filter((p) => p.x > left + (right - left) * 0.4);
  const top = Math.min(...side.map((p) => p.y));
  const head = side.filter((p) => p.y < top + rows);
  const x = Math.max(...head.map((p) => p.x));
  const tip = head.filter((p) => p.x >= x - 1);
  return { x, y: Math.round(tip.reduce((sum, p) => sum + p.y, 0) / tip.length) };
}

/** Put an outfit's head where a frame's bare head is. */
function wear(g, head) {
  const list = [];
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if (g.grid[y * g.W + x] >= 0) list.push({ x, y });
  if (!list.length) return;
  const at = noseOf(list, 44);
  const from = noseOf(head.cells);
  // The bare ears stop at the top of the new head, or they stand up behind the hat.
  const left = Math.min(...head.cells.map((p) => p.x)) + at.x - from.x;
  for (const p of list) if (p.y <= at.y && p.x >= left) g.grid[p.y * g.W + p.x] = -1;
  for (const p of head.cells) {
    const x = p.x + at.x - from.x;
    const y = p.y + at.y - from.y;
    if (x >= 0 && y >= 0 && x < g.W && y < g.H) g.grid[y * g.W + x] = p.c;
  }
}

/** Shift gesture frames so their heads land exactly on the walking head. */
function alignToWalk(grids) {
  for (const g of grids) {
    const { dx, dy } = bestOffset(g, walkHead, 12);
    g.sx = -dx;
    g.sy = dy;
  }
}

const parts = (c) => [c >> 16, (c >> 8) & 255, c & 255];
const luma = (c) => { const [r, g, b] = parts(c); return r * 0.3 + g * 0.56 + b * 0.14; };

/** Dark openings in a lit wall become windows, which glow after dark. */
function markWindows(s) {
  const at = (x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h ? -1 : s.data[y * s.w + x]);
  const light = (c) => c >= 0 && luma(c) > 165;
  const marks = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const c = at(x, y);
      if (c < 0 || luma(c) > 120) continue;
      if ((light(at(x - 1, y)) || light(at(x - 2, y))) && (light(at(x + 1, y)) || light(at(x + 2, y)))) marks.push(y * s.w + x);
    }
  }
  for (const i of marks) s.data[i] = -3;
}

/** Median cut to n colours. */
function quantise(counts, n) {
  let boxes = [[...counts.entries()].map(([c, k]) => ({ c: [c >> 16, (c >> 8) & 255, c & 255], k }))];
  while (boxes.length < n) {
    let bi = -1, axis = 0, span = -1;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let a = 0; a < 3; a++) {
        let lo = 255;
        let hi = 0;
        for (const p of b) {
          lo = Math.min(lo, p.c[a]);
          hi = Math.max(hi, p.c[a]);
        }
        const s = (hi - lo) * (a === 1 ? 1.2 : 1) * Math.log2(b.reduce((t, p) => t + p.k, 2));
        if (s > span) [span, bi, axis] = [s, i, a];
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p.c[axis] - q.c[axis]);
    const total = b.reduce((t, p) => t + p.k, 0);
    let run = 0, m = 1;
    for (; m < b.length - 1; m++) if ((run += b[m - 1].k) >= total / 2) break;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.map((b) => {
    const t = b.reduce((s, p) => s + p.k, 0);
    return [0, 1, 2].map((a) => Math.round(b.reduce((s, p) => s + p.c[a] * p.k, 0) / t));
  });
}

/**
 * Painted fur is mottled, and the mottling lands somewhere else on every frame, so
 * the sprite shimmers. Each pixel takes the commonest colour among its close-coloured
 * neighbours: patches go flat while outlines, eyes and buckles, far from anything
 * around them, stay exactly where they were painted.
 */
function flatten(data, w, h, palette) {
  const close = (a, b) => a < 250 && b < 250 && Math.abs(palette[a][0] - palette[b][0]) + Math.abs(palette[a][1] - palette[b][1]) + Math.abs(palette[a][2] - palette[b][2]) < 70;
  for (let pass = 0; pass < 3; pass++) {
    const from = data.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = from[y * w + x];
        if (c >= 250) continue;
        const tally = new Map();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h) continue;
            const n = from[(y + dy) * w + x + dx];
            if (close(c, n)) tally.set(n, (tally.get(n) ?? 0) + 1);
          }
        }
        let best = c;
        for (const [n, k] of tally) if (k > (tally.get(best) ?? 0)) best = n;
        data[y * w + x] = best;
      }
    }
  }
}

/** The pixels that stay put across a sheet's frames, in cell coordinates. */
function stillParts(sprites, need, keep = () => true) {
  const seen = new Map();
  for (const s of sprites) {
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const c = s.data[y * s.w + x];
        if (c < 0) continue;
        const key = (x + s.ox + 1000) * 4096 + (y - s.h + 1 - s.oy + 2000);
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(c);
      }
    }
  }
  const cells = [];
  for (const [key, colours] of seen) {
    let best = null;
    let count = 0;
    for (const c of colours) {
      const n = colours.filter((o) => dist(c, o) < 42).length;
      if (n > count) [best, count] = [c, n];
    }
    const x = Math.floor(key / 4096) - 1000;
    const y = (key % 4096) - 2000;
    if (count >= need && keep(best, x, y)) cells.push({ x, y, c: best });
  }
  return spriteFrom(cells);
}

function spriteFrom(cells) {
  const x0 = Math.min(...cells.map((p) => p.x));
  const x1 = Math.max(...cells.map((p) => p.x));
  const y0 = Math.min(...cells.map((p) => p.y));
  const y1 = Math.max(...cells.map((p) => p.y));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const data = new Int32Array(w * h).fill(-1);
  for (const p of cells) data[(p.y - y0) * w + p.x - x0] = p.c;
  keepLargest(data, w, h);
  return { w, h, ox: x0, oy: -y1, data };
}

const unwarm = (c) => (c >> 16) - (c & 255) < 75;
const orange = (c) => c >> 16 > 165 && ((c >> 8) & 255) < 130 && (c & 255) < 95;

/**
 * The rails, measured from the first frame and drawn once, then lifted out of every
 * dip frame: painted rails wobble from frame to frame and these must not move.
 */
function railsOf(sprites) {
  const first = sprites[0];
  const at = (x, y) => first.data[y * first.w + x];
  const rowCount = Array.from({ length: first.h }, (_, y) => {
    let n = 0;
    for (let x = 0; x < first.w; x++) if (at(x, y) >= 0 && unwarm(at(x, y))) n++;
    return n;
  });
  const rows = rowCount.flatMap((n, y) => (n > first.w * 0.6 ? [y] : []));
  const below = rows.at(-1) + 1;
  const columns = [];
  for (let x = 0; x < first.w; x++) {
    let n = 0;
    for (let y = below; y < first.h; y++) if (at(x, y) >= 0 && unwarm(at(x, y))) n++;
    if (n > (first.h - below) * 0.75) columns.push(x);
  }
  const cells = [];
  const middle = (list) => list.sort((p, q) => p - q)[list.length >> 1];
  const base = first.h - 1 + first.oy; // rows from the top of the frame to the cell floor
  for (const y of rows) {
    const colour = middle(Array.from({ length: first.w }, (_, x) => at(x, y)).filter((c) => c >= 0 && unwarm(c)));
    for (let x = columns[0] - 3; x <= columns.at(-1) + 3; x++) cells.push({ x: x + first.ox, y: y - base, c: colour });
  }
  for (const x of columns) {
    const colour = middle(Array.from({ length: first.h - below }, (_, k) => at(x, below + k)).filter((c) => c >= 0 && unwarm(c)));
    for (let y = below; y <= first.h - 1; y++) cells.push({ x: x + first.ox, y: y - base, c: colour });
  }
  const rail = new Set(cells.map((p) => `${p.x},${p.y}`));
  const near = (x, y) => [0, -1, 1].some((dx) => [0, -1, 1].some((dy) => rail.has(`${x + dx},${y + dy}`)));
  for (const s of sprites) {
    const floor = s.h - 1 + s.oy;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const c = s.data[y * s.w + x];
        if (c >= 0 && unwarm(c) && near(x + s.ox, y - floor)) s.data[y * s.w + x] = -1;
      }
    }
  }
  return spriteFrom(cells);
}

const families = { world: [], actor: [] };
const out = { sheets: {} };
for (const [name, spec] of Object.entries(SHEETS)) {
  if (!existsSync(`${ROOT}${name}.png`)) {
    console.log('skip', name);
    continue;
  }
  const { f, sprites } = cut(name, spec);
  if (name.startsWith('build/') && !/peaks|clouds/.test(name)) sprites.forEach(markWindows);
  const short = name.split('/')[1];
  console.log(short, 'block', f, 'count', sprites.length, sprites.slice(0, 3).map((s) => `${s.w}x${s.h}`).join(' '));
  const family = spec[3] === 'actor' ? 'actor' : 'world';
  out.sheets[short] = { family, sprites };
  families[family].push(...sprites);
}
// What a vehicle looks like with nobody on it is taken from the frames it is ridden in,
// so climbing aboard changes no pixel of it.
const luma0 = (c) => (c >> 16) * 0.3 + ((c >> 8) & 255) * 0.56 + (c & 255) * 0.14;
const ROW_RIM = -31; // the top of the hull in the rowing frames, from the cell floor
const SAIL_RIM = -32;
const SAIL_FROM = -3; // left of this the fox sits; right of it is rig
const SAIL_MAST = 22;
out.sheets.moored = { family: 'actor', sprites: [
  stillParts(out.sheets.row.sprites, 4, (c, x, y) => y >= ROW_RIM || Math.abs(x) > 44),
  stillParts(out.sheets.sail.sprites.slice(0, 1), 1, (c, x, y) => (y >= SAIL_RIM && !(y < SAIL_RIM + 7 && orange(c))) || x >= SAIL_MAST || (x >= SAIL_MAST + (SAIL_FROM - SAIL_MAST) * (y + 135) / 103 && luma0(c) > 170)),
] };
out.sheets.rails = { family: 'actor', sprites: [railsOf(out.sheets.dip.sprites)] };
families.actor.push(...out.sheets.moored.sprites, ...out.sheets.rails.sprites);
for (const [from, short, head, frames] of DRESSED) {
  const { sprites } = cut(from, SHEETS[from], { head, frames });
  out.sheets[short] = { family: 'actor', sprites };
  families.actor.push(...sprites);
}
const sizes = { world: 150, actor: 56 };
for (const [family, list] of Object.entries(families)) {
  const counts = new Map();
  for (const s of list) {
    for (const c of s.data) {
      if (c < 0) continue;
      const q = c & 0xf8f8f8; // close colours share a bin, which keeps the cut quick
      counts.set(q, (counts.get(q) ?? 0) + 1);
    }
  }
  const palette = quantise(counts, sizes[family]);
  const memo = new Map();
  const nearest = (c) => {
    if (!memo.has(c)) {
      const [r, g, b] = [c >> 16, (c >> 8) & 255, c & 255];
      let best = 0, bd = Infinity;
      palette.forEach((p, i) => {
        const d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
        if (d < bd) [bd, best] = [d, i];
      });
      memo.set(c, best);
    }
    return memo.get(c);
  };
  for (const s of list) {
    const flat = Int32Array.from(s.data, (c) => (c === -3 ? 254 : c < 0 ? 255 : nearest(c)));
    if (family === 'actor') flatten(flat, s.w, s.h, palette);
    s.data = Buffer.from(flat).toString('base64');
  }
  out[family] = palette.map((p) => '#' + p.map((v) => v.toString(16).padStart(2, '0')).join(''));
}
writeFileSync(new URL('../src/stream/scene/sprites.json', import.meta.url), JSON.stringify(out));
