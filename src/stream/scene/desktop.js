// A quiet desktop, viewed through the fox's laptop. Windows overlap, focus
// changes, and the pointer follows the work. Text stays as small ink strokes.
import { createRng } from '../../compose/rng.js';
import { clamp01, smooth } from './dither.js';
import { globe } from './globe.js';
import { S } from './palette.js';

export const APPS = ['code', 'mail', 'chat', 'globe', 'web'];

function lines(c, x, y, w, rows, seed, progress = Infinity, color = S.metalDark) {
  const r = createRng(seed);
  for (let i = 0; i < rows; i++) {
    let used = 0;
    const width = w * r.pick([0.6, 0.8, 0.95, 1]);
    while (used < width - 4) {
      const len = Math.min(r.int(4, 13), width - used);
      const visible = Math.min(len, Math.max(0, progress - i * w - used));
      if (visible > 0) c.rect(x + used, y + i * 6, Math.round(visible), 2, color);
      used += len + 3;
    }
  }
}

function window(c, b, app, t, seed, active) {
  const { x, y, w, h } = b;
  c.rect(x - 1, y - 1, w + 2, h + 2, S.metalDark);
  c.rect(x, y, w, h, S.paper);
  c.rect(x, y, w, 8, active ? S.metal : S.cloudShade);
  for (let i = 0; i < 3; i++) c.rect(x + 4 + i * 5, y + 3, 2, 2, i === 0 && active ? S.logo : S.paper);
  // No oversized titles or legible messages in these miniature windows.
  const body = { x: x + 3, y: y + 10, w: w - 6, h: h - 13 };
  ({ code, mail, chat, globe: study, web })[app](c, body, t, seed);
}

export function laptop(c, { x, y, w, h }, app, t, seed) {
  c.rect(x, y, w, h, S.metalDark);
  c.rect(x + 2, y + 2, w - 4, h - 4, S.knitDark);
  // Subtle desktop wallpaper, menu and a small dock.
  for (let i = 0; i < 4; i++) c.line(x + 3, y + h - 25 - i * 9, x + w - 4, y + h - 51 - i * 4, S.knit);
  c.rect(x + 2, y + 2, w - 4, 5, S.ink);
  for (let i = 0; i < 4; i++) c.rect(x + 6 + i * 9, y + 4, 5, 1, S.metal);
  c.rect(x + w / 2 - 25, y + h - 11, 50, 8, S.ink);
  for (let i = 0; i < 5; i++) c.rect(x + w / 2 - 21 + i * 9, y + h - 9, 5, 4, i === APPS.indexOf(app) ? S.logo : S.metal);
  const epoch = Math.floor(t / 24);
  const u = t % 24;
  const next = APPS[(APPS.indexOf(app) + 1) % APPS.length];
  const back = { x: x + 8, y: y + 13, w: w - 48, h: h - 35 };
  const front = { x: x + 31, y: y + 24, w: w - 43, h: h - 41 };
  window(c, back, next, t + 5, seed + 17, false);
  // A new window rises from the dock, then settles over the previous one.
  const rise = smooth(clamp01(u / 0.7));
  const moving = { ...front, y: Math.round(front.y + (1 - rise) * 14) };
  window(c, moving, app, t, seed + epoch, true);
  // An occasional compact utility floats above the working window.
  if (u > 15 && u < 20) {
    const nx = x + w - 64;
    const ny = y + 10 + Math.round((1 - smooth(clamp01(u - 15))) * 5);
    c.rect(nx, ny, 53, 23, S.cloudShade);
    c.rect(nx + 4, ny + 5, 4, 4, S.logo);
    lines(c, nx + 12, ny + 5, 35, 2, seed + 41);
  }
  const target = app === 'web' ? [moving.x + moving.w * 0.68, moving.y + 34] : app === 'globe' ? [moving.x + moving.w * 0.78, moving.y + 45] : [moving.x + moving.w * 0.72, moving.y + moving.h - 12];
  const phase = t % 6;
  const go = smooth(clamp01(phase / 1.8));
  const px = Math.round(x + w / 2 + (target[0] - x - w / 2) * go);
  const py = Math.round(y + h - 7 + (target[1] - y - h + 7) * go);
  if (phase > 1.8 && phase < 2.2) c.disc(px, py, 4, S.logo, (2.2 - phase) * 2);
  c.line(px, py, px, py + 5, S.ink, 2);
  c.line(px, py, px + 4, py + 4, S.ink, 2);
  c.line(px + 1, py + 1, px + 1, py + 4, S.paper);
}

function code(c, { x, y, w, h }, t, seed) {
  c.rect(x, y, w, h, S.ink);
  c.rect(x, y, 15, h, S.outline);
  for (let i = 0; i < 4; i++) c.rect(x + 3, y + 4 + i * 8, 8, 2, i === 1 ? S.logo : S.metal);
  const row = Math.floor(t * 1.4);
  const rows = Math.floor((h - 4) / 6);
  const first = Math.max(0, row - rows + 1);
  for (let i = 0; i < rows; i++) {
    const line = first + i;
    if (line > row) break;
    const indent = ((line + seed) % 4) * 4;
    const len = Math.min(w - 24 - indent, 17 + (line * 13 + seed) % 58);
    const typed = line === row ? Math.round(len * (t * 1.4 % 1)) : len;
    c.rect(x + 20 + indent, y + 4 + i * 6, typed, 2, [S.paper, S.logo, S.knit, S.brass][line % 4]);
    if (line === row) c.rect(x + 21 + indent + typed, y + 3 + i * 6, 1, 4, S.paper);
  }
}

function mail(c, { x, y, w, h }, t, seed) {
  c.rect(x, y, 17, h, S.cloudShade);
  for (let i = 0; i < 4; i++) c.rect(x + 3, y + 5 + i * 9, 10, 2, S.metalDark);
  const u = t % 15;
  for (let i = 0; i < 2; i++) {
    c.rect(x + 22, y + 3 + i * 8, 6, 2, S.metal);
    c.rect(x + 32, y + 3 + i * 8, 38 + i * 7, 2, S.metalDark);
  }
  const rows = Math.max(1, Math.floor((h - 36) / 6));
  lines(c, x + 22, y + 23, w - 27, rows, seed, u * (w - 27) * 0.7);
  c.rect(x + w - 23, y + h - 8, 18, 6, u > 12 ? S.knit : S.logo);
  if (u > 12) {
    c.line(x + w - 17, y + h - 5, x + w - 15, y + h - 3, S.paper);
    c.line(x + w - 15, y + h - 3, x + w - 11, y + h - 7, S.paper);
  }
}

function chat(c, { x, y, w, h }, t, seed) {
  c.rect(x, y, 19, h, S.cloudShade);
  for (let i = 0; i < 4; i++) c.rect(x + 3, y + 5 + i * 8, 12, 2, S.metalDark);
  const first = Math.floor(t / 3);
  for (let i = 0; i < Math.floor((h - 10) / 14); i++) {
    const right = (first + i) % 2;
    const bw = Math.min(w - 30, 42 + ((first + i) * 11) % 29);
    const bx = right ? x + w - bw - 4 : x + 23;
    const by = y + 3 + i * 14;
    c.rect(bx, by, bw, 10, right ? S.cloudShade : S.banner);
    lines(c, bx + 3, by + 4, bw - 6, 1, seed + first + i);
  }
  c.rect(x + 23, y + h - 6, w - 27, 5, S.cloudShade);
  c.rect(x + 26 + Math.round(t * 9 % Math.max(1, w - 40)), y + h - 5, 1, 3, S.metalDark);
}

function study(c, { x, y, w, h }, t, seed) {
  c.rect(x, y, w, h, S.ink);
  const r = Math.min(w * 0.25, h / 2 - 5);
  const cx = x + r + 5;
  globe(c, cx, y + h / 2, r, t * 8);
  const nx = Math.round(x + w * 0.55);
  const nw = x + w - nx - 5;
  c.rect(nx - 3, y + 5, 1, h - 10, S.outline);
  const rows = Math.floor((h - 15) / 7);
  const page = Math.floor(t / 18);
  for (let i = 0; i < rows; i++) {
    const active = Math.floor(t % 18 / 18 * rows) === i;
    const ly = y + 8 + i * 7;
    c.rect(nx + 1, ly, 2, 2, active ? S.logo : S.knit);
    lines(c, nx + 6, ly, nw - 6, 1, seed + page * 7 + i, Infinity, active ? S.paper : S.metal);
    if (active) c.rect(nx + 6, ly + 3, Math.round((nw - 10) * (t * 0.6 % 1)), 1, S.logo);
  }
}

function web(c, { x, y, w, h }, t, seed) {
  // Address field, navigation, a landscape article with linked cards. The
  // content scrolls smoothly inside the viewport after each navigation.
  c.rect(x, y, w, 9, S.cloudShade);
  c.line(x + 3, y + 4, x + 6, y + 2, S.metalDark);
  c.line(x + 3, y + 4, x + 6, y + 6, S.metalDark);
  c.rect(x + 13, y + 2, w - 24, 5, S.paper);
  c.rect(x + 17, y + 4, w * 0.4, 1, S.metal);
  const u = t % 18;
  const scroll = Math.round(smooth(clamp01((u - 4) / 10)) * 65);
  const content = (yy, hh, paint) => {
    const top = Math.max(y + 11, yy);
    const bottom = Math.min(y + h - 1, yy + hh);
    if (bottom > top) paint(top, bottom);
  };
  const hero = y + 15 - scroll;
  content(hero, 23, (top, bottom) => {
    c.rect(x + 7, top, w - 17, bottom - top, S.knit);
    for (let xx = 0; xx < w - 17; xx++) {
      const hill = hero + 15 + Math.round(Math.sin(xx * 0.1) * 4);
      if (hill < bottom) c.rect(x + 7 + xx, Math.max(top, hill), 1, bottom - Math.max(top, hill), S.knitDark);
    }
  });
  for (let i = 0; i < 17; i++) {
    const ly = hero + 30 + i * 6;
    content(ly, 2, (top) => lines(c, x + 7, top, w - 19, 1, seed + Math.floor(t / 18) * 13 + i));
    if (i === 2 || i === 10) content(ly + 3, 1, (top) => c.rect(x + 7, top, w * 0.42, 1, S.logo));
  }
  c.rect(x + w - 3, y + 12, 1, h - 14, S.cloudShade);
  c.rect(x + w - 3, y + 13 + Math.round(scroll / 65 * (h - 28)), 1, 10, S.metalDark);
}
