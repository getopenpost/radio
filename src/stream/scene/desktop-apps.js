// Miniature app contents. Small word/token shapes keep the scene readable at
// 640x360 without turning it into a wall of oversized labels.
import { createRng } from '../../compose/rng.js';
import { clamp01, smooth } from './dither.js';
import { globe } from './globe.js';
import { WORK } from './desktop-timeline.js';
import { S } from './palette.js';

const documents = new Map();
const GLOBE = { ...S, paper: S.uiToken, cloudShade: S.uiMuted, knit: S.uiTeal, knitDark: S.uiCode, logo: S.uiAccent };
const mix = (a, b, p) => a + (b - a) * smooth(clamp01(p));
const stroke = (c, x, y, w, col = S.uiInk) => c.rect(Math.round(x), Math.round(y), Math.round(w), 2, col);

// Three-pixel ink shapes look like small type at stream size without making
// the screen a wall of legible copy. The gaps and stems vary within a word.
const GLYPHS = [[6, 5, 7], [7, 4, 7], [5, 7, 5], [3, 5, 3], [7, 2, 2], [5, 5, 7], [6, 4, 6], [7, 1, 7], [2, 5, 7], [7, 5, 5]];
function ink(c, x, y, width, color, seed = 0) {
  width = Math.max(0, Math.round(width));
  for (let k = 0; k < width; k++) {
    if (k % 4 === 3) continue;
    const glyph = GLYPHS[Math.abs(Math.floor(seed) + Math.floor(k / 4) * 7) % GLYPHS.length];
    for (let row = 0; row < 3; row++) if (glyph[row] & (1 << (2 - k % 4))) c.set(Math.round(x) + k, Math.round(y) + row, color);
  }
}

function words(c, x, y, w, seed, reveal = Infinity, color = S.uiInk) {
  const r = createRng(seed);
  let used = 0;
  while (used < w - 3) {
    const n = Math.min(w - used, r.int(4, 13));
    if (used < reveal) ink(c, x + used, y, Math.min(n, reveal - used), color, seed + used);
    used += n + r.int(2, 4);
  }
}

function program(seed) {
  if (documents.has(seed)) return documents.get(seed);
  const r = createRng(seed);
  const rows = [];
  const add = (indent, colors, lengths) => rows.push({ indent, tokens: colors.map((color, i) => ({ color, width: lengths?.[i] ?? r.int(4, 19) })), duration: r.float(0.6, 1.65) });
  add(0, [S.uiAccent, S.uiToken, S.uiGold, S.uiTeal], [13, r.int(12, 22), 6, r.int(17, 28)]);
  add(0, [S.uiAccent, S.uiToken, S.uiTeal], [13, r.int(20, 33), r.int(20, 31)]);
  add(0, []);
  for (let block = 0; block < 5; block++) {
    add(0, [S.uiMuted, S.uiMuted, S.uiMuted], [r.int(10, 23), r.int(20, 36), r.int(7, 20)]);
    add(0, [S.uiAccent, S.uiGold, S.uiToken, S.uiTeal], [16, r.int(15, 29), 3, r.int(8, 20)]);
    const n = r.int(3, 7);
    for (let i = 0; i < n; i++) {
      const shape = r.int(0, 3);
      if (shape === 0) add(1, [S.uiAccent, S.uiToken, S.uiMuted, S.uiTeal, S.uiToken]);
      else if (shape === 1) {
        add(1, [S.uiAccent, S.uiToken, S.uiGold], [8, r.int(12, 24), 9]);
        add(2, [S.uiToken, S.uiMuted, S.uiTeal, S.uiGold], [r.int(14, 24), 3, r.int(9, 17), 5]);
        add(1, [S.uiToken], [3]);
      } else if (shape === 2) add(1, [S.uiToken, S.uiMuted, S.uiGold, S.uiToken], [r.int(14, 22), 3, r.int(14, 28), 3]);
      else add(1, [S.uiAccent, S.uiTeal, S.uiToken], [14, r.int(12, 23), 4]);
    }
    add(1, [S.uiAccent, S.uiToken, S.uiGold], [14, r.int(8, 25), 3]);
    add(0, [S.uiToken], [3]);
    add(0, []);
  }
  if (documents.size > 32) documents.clear();
  documents.set(seed, rows);
  return rows;
}

function code(c, { x, y, w, h }, t, seed, document) {
  const action = WORK.code;
  c.rect(x, y, w, h, S.uiCode);
  const rail = 31;
  c.rect(x, y, rail, h, S.uiRail);
  for (let i = 0; i < 6; i++) {
    const ly = y + 7 + i * 10;
    c.rect(x + 4 + (i > 1 ? 3 : 0), ly, 3, 4, i > 1 ? S.uiTeal : S.uiMuted);
    ink(c, x + 12, ly, 8 + i % 3 * 3, i === (t < action.fileReady ? 2 : 3) ? S.uiToken : S.uiMuted, i * 3);
  }
  const file = t < action.fileReady ? 0 : 1;
  const rows = program(seed + document * 301 + file * 97);
  c.rect(x + rail + 1, y, w - rail - 1, 9, S.uiRail);
  for (let i = 0; i < 2; i++) {
    c.rect(x + rail + 3 + i * 42, y + 1, 40, 7, file === i ? S.uiInk : S.uiRail);
    c.rect(x + rail + 7 + i * 42, y + 3, 3, 3, file === i ? S.uiAccent : S.uiMuted);
    stroke(c, x + rail + 14 + i * 42, y + 4, 20, file === i ? S.uiToken : S.uiMuted);
  }
  // Run feedback shares its timing with the pointer's click.
  c.line(x + w - 9, y + 2, x + w - 5, y + 4, S.uiAccent);
  c.line(x + w - 5, y + 4, x + w - 9, y + 6, S.uiAccent);
  const local = file === 0 ? Math.max(0, t - action.typing) : Math.max(0, t - action.secondTyping);
  let budget = Math.min(local, file === 0 ? action.file - action.typing - 0.5 : action.stopTyping - action.secondTyping);
  let row = 7 + file * 3;
  while (row < rows.length - 1 && budget > rows[row].duration) budget -= rows[row++].duration;
  const fraction = clamp01(budget / rows[row].duration);
  const available = Math.floor((h - 20) / 6);
  const scroll = Math.max(0, row + fraction - available * 0.7) * 6;
  for (let i = 0; i < rows.length; i++) {
    const ly = Math.round(y + 12 + i * 6 - scroll);
    if (ly < y + 11 || ly > y + h - 10 || i > row) continue;
    c.rect(x + rail + 4, ly, 2 + i % 3, 1, S.uiInk);
    let lx = x + rail + 12 + rows[i].indent * 7;
    const total = rows[i].tokens.reduce((n, tok) => n + tok.width + 3, 0);
    let reveal = i < row ? Infinity : total * fraction;
    for (const token of rows[i].tokens) {
      const width = Math.min(token.width, Math.max(0, reveal), x + w - 6 - lx);
      if (width > 0) ink(c, lx, ly, width, token.color, seed + i * 13 + lx);
      reveal -= token.width + 3;
      lx += token.width + 3;
    }
    if (i === row && t < action.run && t % 1.1 < 0.75) c.rect(Math.min(x + w - 5, x + rail + 12 + rows[i].indent * 7 + Math.round(total * fraction)), ly - 1, 1, 4, S.uiToken);
  }
  c.rect(x + rail, y + h - 6, w - rail, 6, S.uiRail);
  stroke(c, x + rail + 5, y + h - 4, 17, S.uiTeal);
  if (t >= action.run) {
    const progress = clamp01((t - action.run) / (action.done - action.run));
    c.rect(x + w - 55, y + h - 4, Math.round(42 * progress), 1, progress < 1 ? S.uiGold : S.uiTeal);
    if (progress === 1) {
      c.line(x + w - 9, y + h - 4, x + w - 7, y + h - 2, S.uiToken);
      c.line(x + w - 7, y + h - 2, x + w - 4, y + h - 5, S.uiToken);
    }
  }
}

function browser(c, { x, y, w, h }, t, seed, document) {
  const action = WORK.web;
  c.rect(x, y, w, h, S.uiPaper);
  c.rect(x, y, w, 9, S.uiChrome);
  c.line(x + 4, y + 4, x + 7, y + 2, S.uiInk);
  c.line(x + 4, y + 4, x + 7, y + 6, S.uiInk);
  c.rect(x + 16, y + 2, w - 30, 5, S.uiPaper);
  stroke(c, x + 22, y + 4, 6, S.uiTeal);
  words(c, x + 32, y + 4, w * 0.38, seed, Math.max(0, t - action.focus) * 95, S.uiMuted);
  const article = t >= action.link + 0.08 && t < action.back + 0.1;
  const loading = t < action.loaded ? clamp01((t - action.focus) / (action.loaded - action.focus)) : t >= action.link && t < action.articleReady ? (t - action.link) / (action.articleReady - action.link) : 1;
  if (loading < 1) c.rect(x, y + 9, Math.round(w * loading), 1, S.uiAccent);
  const scroll = article ? mix(0, 56, (t - action.articleScroll) / (action.articleScrollEnd - action.articleScroll)) : t > action.back ? 88 : mix(0, 42, (t - action.scroll1) / (action.scroll1End - action.scroll1)) + mix(0, 46, (t - action.scroll2) / (action.scroll2End - action.scroll2));
  const body = (yy, hh, paint) => {
    if (yy + hh <= y + 12 || yy >= y + h - 1) return;
    paint(Math.max(y + 12, yy), Math.min(y + h - 1, yy + hh));
  };
  const top = y + 16 - scroll;
  if (article) {
    body(top, 3, (a, b) => { if (b - a === 3) words(c, x + 13, a, w * 0.64, seed, Infinity, S.uiInk); });
    for (let i = 0; i < 24; i++) {
      const ly = top + 14 + i * 5 + Math.floor(i / 5) * 6;
      body(ly, 3, (a, b) => {
        if (b - a === 3) words(c, x + 13, a, w - 32 - (i % 5 === 4 ? 36 : 0), seed + document * 37 + i);
      });
    }
  } else {
    body(top, 27, (a, b) => {
      c.rect(x + 12, a, w - 27, b - a, S.uiImage);
      for (let xx = 0; xx < w - 27; xx++) {
        const edge = top + 18 + Math.sin(xx * 0.08 + document) * 5;
        if (edge < b) c.rect(x + 12 + xx, Math.max(a, Math.round(edge)), 1, b - Math.max(a, Math.round(edge)), S.uiImageDark);
      }
    });
    for (let i = 0; i < 3; i++) {
      const cy = top + 42 + i * 42;
      body(cy, 22, (a, b) => {
        c.rect(x + 12, a, 25, b - a, S.uiSelected);
        for (let xx = 1; xx < 24; xx++) {
          const ridge = cy + 15 - Math.round(Math.sin(xx * 0.14 + i * 2 + document) * 5);
          if (ridge < b) c.rect(x + 12 + xx, Math.max(a, ridge), 1, b - Math.max(a, ridge), S.uiImageDark);
        }
        if (cy + 5 >= a && cy + 8 < b) c.rect(x + 30, cy + 5, 3, 3, S.uiGold);
      });
      for (let k = 0; k < 3; k++) body(cy + 3 + k * 6, 3, (a, b) => {
        if (b - a === 3) words(c, x + 44, a, w - 63 - k * 7, seed + i * 13 + k, Infinity, k ? S.uiMuted : S.uiInk);
      });
      body(cy + 22, 1, (a) => c.rect(x + 44, a, 32, 1, S.uiAccent));
    }
  }
  c.rect(x + w - 3, y + 12, 1, h - 14, S.uiChrome);
  c.rect(x + w - 3, y + 13 + Math.round(scroll / 90 * (h - 27)), 1, 11, S.uiMuted);
}

function mail(c, { x, y, w, h }, t, seed) {
  const action = WORK.mail;
  c.rect(x, y, w, h, S.uiPaper);
  c.rect(x, y, 23, h, S.uiChrome);
  c.rect(x + 4, y + 7, 15, 7, S.uiAccent);
  for (let i = 0; i < 4; i++) stroke(c, x + 5, y + 24 + i * 9, 9 + i % 2 * 4);
  const composing = t >= action.compose + 0.12 && t < action.sent;
  if (composing) {
    for (let i = 0; i < 2; i++) {
      stroke(c, x + 29, y + 7 + i * 10, 7, S.uiMuted);
      words(c, x + 41, y + 7 + i * 10, w - 58, seed + i, Math.max(0, t - action.fields - i * 0.85) * 26);
      c.rect(x + 28, y + 14 + i * 10, w - 35, 1, S.uiChrome);
    }
    const rows = Math.min(5, Math.floor((h - 43) / 6));
    const typed = Math.max(0, t - action.body) * ((w - 42) * rows / (action.send - action.body - 2));
    for (let i = 0; i < rows; i++) words(c, x + 29, y + 31 + i * 6, w - 42 - (i === rows - 1 ? 23 : 0), seed + i * 3, typed - i * (w - 42));
    if (t > action.send - 3) for (let k = 0; k < 2; k++) {
      const ax = x + 29 + k * 35;
      const ay = y + h - 28;
      c.rect(ax, ay, 30, 12, S.uiSelected);
      c.rect(ax + 3, ay + 3, 5, 6, S.uiMuted);
      ink(c, ax + 11, ay + 4, 15, S.uiInk, seed + k);
    }
    c.rect(x + w - 29, y + h - 14, 24, 9, t >= action.send ? S.uiTeal : S.uiAccent);
    c.line(x + w - 21, y + h - 11, x + w - 16, y + h - 9, S.uiPaper);
    c.line(x + w - 16, y + h - 9, x + w - 21, y + h - 7, S.uiPaper);
  } else {
    for (let i = 0; i < Math.floor((h - 5) / 17); i++) {
      const ly = y + 5 + i * 17;
      c.rect(x + 28, ly + 1, 5, 5, i % 2 ? S.uiTeal : S.uiMuted);
      words(c, x + 39, ly, w - 48, seed + i * 17);
      words(c, x + 39, ly + 5, w - 62, seed + i * 17 + 1, Infinity, S.uiMuted);
      c.rect(x + 28, ly + 12, w - 34, 1, S.uiChrome);
    }
    if (t > action.sent && t < action.toastEnd) {
      const rise = smooth(clamp01((t - action.sent) / 0.14)) * (1 - smooth(clamp01((t - action.toastEnd + 0.12) / 0.12)));
      const ty = Math.round(y + h - 4 - rise * 16);
      c.rect(x + w - 68, ty, 62, 12, S.uiImageDark);
      c.line(x + w - 62, ty + 6, x + w - 59, ty + 8, S.uiPaper);
      c.line(x + w - 59, ty + 8, x + w - 55, ty + 3, S.uiPaper);
      words(c, x + w - 50, ty + 5, 37, seed, Infinity, S.uiPaper);
    }
  }
}

function study(c, { x, y, w, h }, t, seed, document) {
  const action = WORK.globe;
  c.rect(x, y, w, h, S.uiCode);
  const r = Math.min(w * 0.23, h / 2 - 8);
  globe(c, x + r + 7, y + h / 2, r, t * 2.3 + document * 41, GLOBE);
  const nx = x + Math.round(w * 0.54);
  c.rect(nx - 6, y + 6, 1, h - 12, S.uiBorder);
  c.rect(x + w - 15, y + 5, 7, 5, t >= action.save ? S.uiAccent : S.uiMuted);
  if (t >= action.save) {
    c.line(x + w - 14, y + 7, x + w - 12, y + 9, S.uiPaper);
    c.line(x + w - 12, y + 9, x + w - 9, y + 6, S.uiPaper);
  }
  const rows = Math.floor((h - 20) / 7);
  for (let i = 0; i < rows; i++) {
    const ly = y + 11 + i * 7;
    const added = i >= rows - 2;
    const start = i === rows - 2 ? action.note1 + 0.15 : action.note2 + 0.15;
    const progress = added ? Math.max(0, t - start) * 18 : Infinity;
    if (progress > 0) {
      c.rect(nx, ly, 2, 2, added ? S.uiAccent : S.uiTeal);
      words(c, nx + 6, ly, w - (nx - x) - 12 - i % 3 * 5, seed + document * 17 + i, progress, added ? S.uiPaper : S.uiMuted);
    }
    if (i === Math.min(rows - 3, Math.floor(Math.max(0, t - action.focus) / 3))) c.rect(nx + 6, ly + 3, 24, 1, S.uiAccent);
  }
}

function chat(c, { x, y, w, h }, t, seed) {
  const action = WORK.chat;
  c.rect(x, y, w, h, S.uiPaper);
  c.rect(x, y, 21, h, S.uiChrome);
  for (let i = 0; i < 4; i++) stroke(c, x + 4, y + 8 + i * 10, 10 + i % 2 * 3, i === 1 ? S.uiInk : S.uiMuted);
  const messages = [[0, false], [2.2, true], [6.8, false], [action.sent, true], [action.reply, false]];
  const shown = messages.filter(([at]) => t >= at);
  const visible = Math.floor((h - 20) / 17);
  const first = Math.max(0, shown.length - visible);
  const oldFirst = Math.max(0, shown.length - 1 - visible);
  const scroll = mix(oldFirst * 17, first * 17, (t - shown[shown.length - 1][0]) / 0.18);
  for (let i = oldFirst; i < shown.length; i++) {
    const [at, own] = shown[i];
    const bw = Math.min(w - 33, 54 + (seed + i * 29) % 38);
    const bx = own ? x + w - bw - 5 : x + 27;
    const by = Math.round(y + 5 + i * 17 - scroll + (1 - smooth(clamp01((t - at) / 0.12))) * 3);
    const top = Math.max(y + 2, by);
    const bottom = Math.min(y + h - 16, by + 12);
    if (bottom > top) c.rect(bx, top, bw, bottom - top, own ? S.uiChrome : S.uiSelected);
    if (by + 5 >= top && by + 7 <= bottom) words(c, bx + 5, by + 5, bw - 10, seed + i * 7);
  }
  c.rect(x + 26, y + h - 13, w - 31, 11, S.uiChrome);
  if (t >= action.input && t < action.sent) words(c, x + 30, y + h - 8, w - 47, seed + 31, Math.max(0, t - action.typing) * 13);
  if (t > 5.8 && t < 6.8 || t > action.reply - 1.2 && t < action.reply) for (let i = 0; i < 3; i++) c.rect(x + 29 + i * 4, y + h - 18, 2, 1 + (Math.sin(t * 5 + i) > 0 ? 1 : 0), S.uiMuted);
  c.line(x + w - 13, y + h - 10, x + w - 9, y + h - 7, S.uiImageDark);
  c.line(x + w - 9, y + h - 7, x + w - 13, y + h - 4, S.uiImageDark);
}

export function paintApp(c, box, state, seed) {
  const variant = seed + state.document * 1103;
  ({ code, web: browser, mail, globe: study, chat })[state.app](c, box, state.elapsed, variant, state.document);
}
