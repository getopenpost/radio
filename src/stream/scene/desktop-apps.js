// Miniature app contents. Small word/token shapes keep the scene readable at
// 640x360 without turning it into a wall of oversized labels.
import { createRng } from '../../compose/rng.js';
import { clamp01, smooth } from './dither.js';
import { globe } from './globe.js';
import { S } from './palette.js';

const documents = new Map();
const mix = (a, b, p) => a + (b - a) * smooth(clamp01(p));
const stroke = (c, x, y, w, col = S.metalDark) => c.rect(Math.round(x), Math.round(y), Math.round(w), 2, col);

function words(c, x, y, w, seed, reveal = Infinity, color = S.metalDark) {
  const r = createRng(seed);
  let used = 0;
  while (used < w - 3) {
    const n = Math.min(w - used, r.int(4, 13));
    if (used < reveal) stroke(c, x + used, y, Math.min(n, reveal - used), color);
    used += n + r.int(2, 4);
  }
}

function program(seed) {
  if (documents.has(seed)) return documents.get(seed);
  const r = createRng(seed);
  const rows = [];
  const add = (indent, colors, lengths) => rows.push({ indent, tokens: colors.map((color, i) => ({ color, width: lengths?.[i] ?? r.int(4, 19) })), duration: r.float(0.6, 1.65) });
  add(0, [S.logo, S.paper, S.brass, S.knit], [13, r.int(12, 22), 6, r.int(17, 28)]);
  add(0, [S.logo, S.paper, S.knit], [13, r.int(20, 33), r.int(20, 31)]);
  add(0, []);
  for (let block = 0; block < 5; block++) {
    add(0, [S.metal, S.metal, S.metal], [r.int(10, 23), r.int(20, 36), r.int(7, 20)]);
    add(0, [S.logo, S.brass, S.paper, S.knit], [16, r.int(15, 29), 3, r.int(8, 20)]);
    const n = r.int(3, 7);
    for (let i = 0; i < n; i++) {
      const shape = r.int(0, 3);
      if (shape === 0) add(1, [S.logo, S.paper, S.metal, S.knit, S.paper]);
      else if (shape === 1) {
        add(1, [S.logo, S.paper, S.brass], [8, r.int(12, 24), 9]);
        add(2, [S.paper, S.metal, S.knit, S.brass], [r.int(14, 24), 3, r.int(9, 17), 5]);
        add(1, [S.paper], [3]);
      } else if (shape === 2) add(1, [S.paper, S.metal, S.brass, S.paper], [r.int(14, 22), 3, r.int(14, 28), 3]);
      else add(1, [S.logo, S.knit, S.paper], [14, r.int(12, 23), 4]);
    }
    add(1, [S.logo, S.paper, S.brass], [14, r.int(8, 25), 3]);
    add(0, [S.paper], [3]);
    add(0, []);
  }
  if (documents.size > 32) documents.clear();
  documents.set(seed, rows);
  return rows;
}

function code(c, { x, y, w, h }, t, seed, document) {
  c.rect(x, y, w, h, S.ink);
  const rail = 31;
  c.rect(x, y, rail, h, S.pill);
  for (let i = 0; i < 6; i++) {
    const ly = y + 7 + i * 10;
    c.rect(x + 4 + (i > 1 ? 3 : 0), ly, 3, 4, i > 1 ? S.knit : S.metal);
    stroke(c, x + 12, ly + 1, 8 + i % 3 * 3, i === (t < 23 ? 2 : 3) ? S.paper : S.metal);
  }
  const file = t < 23.3 ? 0 : 1;
  const rows = program(seed + document * 301 + file * 97);
  c.rect(x + rail + 1, y, w - rail - 1, 9, S.pill);
  for (let i = 0; i < 2; i++) {
    c.rect(x + rail + 3 + i * 42, y + 1, 40, 7, file === i ? S.ink : S.pill);
    c.rect(x + rail + 7 + i * 42, y + 3, 3, 3, file === i ? S.logo : S.metal);
    stroke(c, x + rail + 14 + i * 42, y + 4, 20, file === i ? S.paper : S.metal);
  }
  // Play button is the target of the run click at 38.5s.
  c.line(x + w - 9, y + 2, x + w - 5, y + 4, S.logo);
  c.line(x + w - 5, y + 4, x + w - 9, y + 6, S.logo);
  const local = file === 0 ? Math.max(0, t - 3) : Math.max(0, t - 24.2);
  let budget = Math.min(local, file === 0 ? 16.5 : 14.3);
  let row = 7 + file * 3;
  while (row < rows.length - 1 && budget > rows[row].duration) budget -= rows[row++].duration;
  const fraction = clamp01(budget / rows[row].duration);
  const available = Math.floor((h - 20) / 6);
  const scroll = Math.max(0, row + fraction - available * 0.7) * 6;
  for (let i = 0; i < rows.length; i++) {
    const ly = Math.round(y + 12 + i * 6 - scroll);
    if (ly < y + 11 || ly > y + h - 10 || i > row) continue;
    c.rect(x + rail + 4, ly, 2 + i % 3, 1, S.metalDark);
    let lx = x + rail + 12 + rows[i].indent * 7;
    const total = rows[i].tokens.reduce((n, tok) => n + tok.width + 3, 0);
    let reveal = i < row ? Infinity : total * fraction;
    for (const token of rows[i].tokens) {
      const width = Math.min(token.width, Math.max(0, reveal), x + w - 6 - lx);
      if (width > 0) stroke(c, lx, ly, width, token.color);
      reveal -= token.width + 3;
      lx += token.width + 3;
    }
    if (i === row && t < 38.5 && t % 1.1 < 0.75) c.rect(Math.min(x + w - 5, x + rail + 12 + rows[i].indent * 7 + Math.round(total * fraction)), ly - 1, 1, 4, S.paper);
  }
  c.rect(x + rail, y + h - 6, w - rail, 6, S.pill);
  stroke(c, x + rail + 5, y + h - 4, 17, S.knit);
  if (t >= 38.5) {
    const progress = clamp01((t - 38.5) / 1.7);
    c.rect(x + w - 55, y + h - 4, Math.round(42 * progress), 1, progress < 1 ? S.brass : S.knit);
    if (progress === 1) {
      c.line(x + w - 9, y + h - 4, x + w - 7, y + h - 2, S.paper);
      c.line(x + w - 7, y + h - 2, x + w - 4, y + h - 5, S.paper);
    }
  }
}

function browser(c, { x, y, w, h }, t, seed, document) {
  c.rect(x, y, w, h, S.paper);
  c.rect(x, y, w, 9, S.cloudShade);
  c.line(x + 4, y + 4, x + 7, y + 2, S.metalDark);
  c.line(x + 4, y + 4, x + 7, y + 6, S.metalDark);
  c.rect(x + 16, y + 2, w - 30, 5, S.paper);
  stroke(c, x + 22, y + 4, 6, S.knit);
  words(c, x + 32, y + 4, w * 0.38, seed, Math.max(0, t - 2) * 35, S.metal);
  const article = t >= 18 && t < 29.25;
  const loading = t >= 4 && t < 4.8 ? (t - 4) / 0.8 : t >= 18 && t < 18.8 ? (t - 18) / 0.8 : 1;
  if (loading < 1) c.rect(x, y + 9, Math.round(w * loading), 1, S.logo);
  const scroll = article ? mix(0, 56, (t - 23) / 4) : t > 29 ? 88 : mix(0, 42, (t - 8) / 3) + mix(0, 46, (t - 14) / 2.5);
  const body = (yy, hh, paint) => {
    if (yy + hh <= y + 12 || yy >= y + h - 1) return;
    paint(Math.max(y + 12, yy), Math.min(y + h - 1, yy + hh));
  };
  const top = y + 16 - scroll;
  if (article) {
    body(top, 5, (a, b) => c.rect(x + 13, a, w * 0.64, b - a, S.ink));
    for (let i = 0; i < 24; i++) {
      const ly = top + 14 + i * 5 + Math.floor(i / 5) * 6;
      body(ly, 2, (a, b) => {
        if (b - a === 2) words(c, x + 13, a, w - 32 - (i % 5 === 4 ? 36 : 0), seed + document * 37 + i);
      });
    }
  } else {
    body(top, 27, (a, b) => {
      c.rect(x + 12, a, w - 27, b - a, S.knit);
      for (let xx = 0; xx < w - 27; xx++) {
        const edge = top + 18 + Math.sin(xx * 0.08 + document) * 5;
        if (edge < b) c.rect(x + 12 + xx, Math.max(a, Math.round(edge)), 1, b - Math.max(a, Math.round(edge)), S.knitDark);
      }
    });
    for (let i = 0; i < 3; i++) {
      const cy = top + 42 + i * 42;
      body(cy, 22, (a, b) => c.rect(x + 12, a, 25, b - a, i % 2 ? S.knitDark : S.knit));
      for (let k = 0; k < 3; k++) body(cy + 3 + k * 6, 2, (a, b) => {
        if (b - a === 2) words(c, x + 44, a, w - 63 - k * 7, seed + i * 13 + k, Infinity, k ? S.metal : S.ink);
      });
      body(cy + 22, 1, (a) => c.rect(x + 44, a, 32, 1, S.logo));
    }
  }
  c.rect(x + w - 3, y + 12, 1, h - 14, S.cloudShade);
  c.rect(x + w - 3, y + 13 + Math.round(scroll / 90 * (h - 27)), 1, 11, S.metal);
}

function mail(c, { x, y, w, h }, t, seed) {
  c.rect(x, y, w, h, S.paper);
  c.rect(x, y, 23, h, S.cloudShade);
  c.rect(x + 4, y + 7, 15, 7, S.logo);
  for (let i = 0; i < 4; i++) stroke(c, x + 5, y + 24 + i * 9, 9 + i % 2 * 4);
  const composing = t >= 2.2 && t < 20.25;
  if (composing) {
    for (let i = 0; i < 2; i++) {
      stroke(c, x + 29, y + 7 + i * 10, 7, S.metal);
      words(c, x + 41, y + 7 + i * 10, w - 58, seed + i, Math.max(0, t - 3 - i * 1.4) * 26);
      c.rect(x + 28, y + 14 + i * 10, w - 35, 1, S.cloudShade);
    }
    const rows = Math.floor((h - 43) / 6);
    const typed = Math.max(0, t - 6) * 41;
    for (let i = 0; i < rows; i++) words(c, x + 29, y + 31 + i * 6, w - 42 - (i === rows - 1 ? 23 : 0), seed + i * 3, typed - i * (w - 42));
    c.rect(x + w - 29, y + h - 14, 24, 9, t >= 20 ? S.knit : S.logo);
    c.line(x + w - 21, y + h - 11, x + w - 16, y + h - 9, S.paper);
    c.line(x + w - 16, y + h - 9, x + w - 21, y + h - 7, S.paper);
  } else {
    for (let i = 0; i < Math.floor((h - 5) / 17); i++) {
      const ly = y + 5 + i * 17;
      c.rect(x + 28, ly + 1, 5, 5, i % 2 ? S.knit : S.metal);
      words(c, x + 39, ly, w - 48, seed + i * 17);
      words(c, x + 39, ly + 5, w - 62, seed + i * 17 + 1, Infinity, S.metal);
      c.rect(x + 28, ly + 12, w - 34, 1, S.cloudShade);
    }
    if (t > 20.25 && t < 24.5) {
      const rise = smooth(clamp01((t - 20.25) / 0.3)) * (1 - smooth(clamp01((t - 24) / 0.5)));
      const ty = Math.round(y + h - 4 - rise * 16);
      c.rect(x + w - 68, ty, 62, 12, S.knitDark);
      c.line(x + w - 62, ty + 6, x + w - 59, ty + 8, S.paper);
      c.line(x + w - 59, ty + 8, x + w - 55, ty + 3, S.paper);
      words(c, x + w - 50, ty + 5, 37, seed, Infinity, S.paper);
    }
  }
}

function study(c, { x, y, w, h }, t, seed, document) {
  c.rect(x, y, w, h, S.ink);
  const r = Math.min(w * 0.23, h / 2 - 8);
  globe(c, x + r + 7, y + h / 2, r, t * 2.3 + document * 41);
  const nx = x + Math.round(w * 0.54);
  c.rect(nx - 6, y + 6, 1, h - 12, S.outline);
  c.rect(x + w - 15, y + 5, 7, 5, t >= 28 ? S.logo : S.metal);
  if (t >= 28) {
    c.line(x + w - 14, y + 7, x + w - 12, y + 9, S.paper);
    c.line(x + w - 12, y + 9, x + w - 9, y + 6, S.paper);
  }
  const rows = Math.floor((h - 20) / 7);
  for (let i = 0; i < rows; i++) {
    const ly = y + 11 + i * 7;
    const added = i >= rows - 2;
    const start = i === rows - 2 ? 11 : 19;
    const progress = added ? Math.max(0, t - start) * 18 : Infinity;
    if (progress > 0) {
      c.rect(nx, ly, 2, 2, added ? S.logo : S.knit);
      words(c, nx + 6, ly, w - (nx - x) - 12 - i % 3 * 5, seed + document * 17 + i, progress, added ? S.paper : S.metal);
    }
    if (i === Math.min(rows - 3, Math.floor(Math.max(0, t - 2) / 3))) c.rect(nx + 6, ly + 3, 24, 1, S.logo);
  }
}

function chat(c, { x, y, w, h }, t, seed) {
  c.rect(x, y, w, h, S.paper);
  c.rect(x, y, 21, h, S.cloudShade);
  for (let i = 0; i < 4; i++) stroke(c, x + 4, y + 8 + i * 10, 10 + i % 2 * 3, i === 1 ? S.ink : S.metal);
  const messages = [[0, false], [3, true], [7.5, false], [19.5, true], [24, false]];
  const shown = messages.filter(([at]) => t >= at);
  const visible = Math.floor((h - 20) / 17);
  const first = Math.max(0, shown.length - visible);
  const oldFirst = Math.max(0, shown.length - 1 - visible);
  const scroll = mix(oldFirst * 17, first * 17, (t - shown[shown.length - 1][0]) / 0.35);
  for (let i = oldFirst; i < shown.length; i++) {
    const [at, own] = shown[i];
    const bw = Math.min(w - 33, 54 + (seed + i * 29) % 38);
    const bx = own ? x + w - bw - 5 : x + 27;
    const by = Math.round(y + 5 + i * 17 - scroll + (1 - smooth(clamp01((t - at) / 0.3))) * 3);
    const top = Math.max(y + 2, by);
    const bottom = Math.min(y + h - 16, by + 12);
    if (bottom > top) c.rect(bx, top, bw, bottom - top, own ? S.cloudShade : S.banner);
    if (by + 5 >= top && by + 7 <= bottom) words(c, bx + 5, by + 5, bw - 10, seed + i * 7);
  }
  c.rect(x + 26, y + h - 13, w - 31, 11, S.cloudShade);
  if (t >= 10 && t < 19.5) words(c, x + 30, y + h - 8, w - 47, seed + 31, Math.max(0, t - 11) * 13);
  if (t > 6 && t < 7.5 || t > 22.5 && t < 24) for (let i = 0; i < 3; i++) c.rect(x + 29 + i * 4, y + h - 18, 2, 1 + (Math.sin(t * 5 + i) > 0 ? 1 : 0), S.metal);
  c.line(x + w - 13, y + h - 10, x + w - 9, y + h - 7, S.knitDark);
  c.line(x + w - 9, y + h - 7, x + w - 13, y + h - 4, S.knitDark);
}

export function paintApp(c, box, state, seed) {
  const variant = seed + state.document * 1103;
  ({ code, web: browser, mail, globe: study, chat })[state.app](c, box, state.elapsed, variant, state.document);
}
