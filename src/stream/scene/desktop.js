// A small desktop with persistent, overlapping app windows. The work session
// owns both content and input, so typing holds the mouse still and clicks
// actually precede navigation, sending mail and changing files.
import { createCanvas } from './canvas.js';
import { bayer } from './dither.js';
import { paintApp } from './desktop-apps.js';
import { APPS, WINDOWS, desktopAt, dockPoint } from './desktop-timeline.js';
import { CLEAR, S } from './palette.js';

const windowCanvas = createCanvas();

function icon(c, x, y, app, color) {
  if (app === 'code') {
    c.line(x + 2, y + 1, x, y + 3, color);
    c.line(x, y + 3, x + 2, y + 5, color);
    c.line(x + 5, y + 1, x + 7, y + 3, color);
    c.line(x + 7, y + 3, x + 5, y + 5, color);
  } else if (app === 'web' || app === 'globe') {
    c.disc(x + 3, y + 3, 3, color);
    c.disc(x + 3, y + 3, 2, S.uiInk);
    c.line(x + 1, y + 3, x + 5, y + 3, color);
    c.line(x + 3, y + 1, x + 3, y + 5, color);
    if (app === 'web') c.rect(x + 1, y + 1, 2, 2, S.uiAccent);
  } else if (app === 'mail') {
    c.rect(x, y + 1, 8, 5, color);
    c.line(x, y + 1, x + 3, y + 4, S.uiInk);
    c.line(x + 3, y + 4, x + 7, y + 1, S.uiInk);
  } else {
    c.rect(x, y, 8, 5, color);
    c.rect(x + 1, y + 4, 2, 3, color);
    for (let i = 0; i < 3; i++) c.set(x + 1 + i * 2, y + 2, S.uiInk);
  }
}

function drawWindow(c, desktop, state, seed) {
  const layout = WINDOWS[state.app];
  const w = Math.round(layout.w * desktop.w);
  const h = Math.round(layout.h * desktop.h);
  const x = Math.round(desktop.x + layout.x * desktop.w);
  const y = Math.round(desktop.y + layout.y * desktop.h);
  const sc = windowCanvas;
  sc.index.fill(CLEAR);
  sc.rect(0, 0, w, h, S.uiInk);
  sc.rect(1, 1, w - 2, h - 2, S.uiPaper);
  sc.rect(1, 1, w - 2, 10, S.uiChrome);
  for (let i = 0; i < 3; i++) sc.disc(5 + i * 5, 5, 1, state.active && i === 0 ? S.uiAccent : S.uiMuted);
  icon(sc, 24, 2, state.app, state.active ? S.uiInk : S.uiMuted);
  for (let k = 0; k < 3; k++) sc.set(w - 10 + k * 2, 5, S.uiMuted);
  sc.rect(1, 10, w - 2, 1, S.uiBorder);
  // A body viewport keeps scrolling pages, carets and toasts inside the app.
  paintApp(sc, { x: 2, y: 12, w: w - 4, h: h - 14 }, state, seed);
  for (let yy = 0; yy < h + 4; yy++) for (let xx = 0; xx < w + 4; xx++) {
    if (xx >= w || yy >= h) {
      const distance = Math.max(xx - w + 1, yy - h + 1);
      if (xx > 1 && yy > 1 && bayer(xx, yy) < (4 - distance) * 0.08) c.set(x + xx, y + yy, S.uiInk);
      continue;
    }
    if ((xx < 2 || xx >= w - 2) && (yy < 2 || yy >= h - 2)) continue;
    const color = sc.get(xx, yy);
    if (color !== CLEAR) c.set(x + xx, y + yy, color);
  }
}

export function laptop(c, box, t, seed) {
  const { x, y, w, h } = box;
  const state = desktopAt(t);
  c.rect(x, y, w, h, S.uiInk);
  c.rect(x + 1, y + 1, w - 2, h - 2, S.uiBack);
  c.rect(x + 1, y + 1, w - 2, 7, S.uiInk);
  for (let i = 0; i < 3; i++) c.rect(x + 7 + i * 10, y + 4, i ? 5 : 3, 1, S.uiMuted);
  c.line(x + w - 28, y + 4, x + w - 26, y + 2, S.uiMuted);
  c.line(x + w - 26, y + 2, x + w - 24, y + 4, S.uiMuted);
  c.rect(x + w - 19, y + 3, 10, 2, S.uiMuted);
  for (const window of state.windows) drawWindow(c, box, window, seed);
  const dockY = Math.round(y + h * 0.915);
  const dockX = Math.round(x + w * 0.5 - w * 0.175);
  c.rect(dockX, dockY, Math.round(w * 0.35), Math.round(h * 0.075), S.uiInk);
  for (const app of APPS) {
    const [dx] = dockPoint(app);
    const ix = Math.round(x + dx * w - 4);
    icon(c, ix, dockY + 2, app, state.app === app ? S.uiPaper : S.uiMuted);
    if (state.app === app) c.rect(ix + 2, dockY + 10, 3, 1, S.uiAccent);
  }
  const px = Math.round(x + state.pointer.x * w);
  const py = Math.round(y + state.pointer.y * h);
  // A filled arrow stays legible over light pages and the dark code editor.
  const arrow = ['XX', 'XoX', 'XooX', 'XoooX', 'XooooX', 'XXXoXX', '..XoX', '..XXX'];
  for (let yy = 0; yy < arrow.length; yy++) for (let xx = 0; xx < arrow[yy].length; xx++) {
    const pixel = arrow[yy][xx];
    if (pixel !== '.') c.set(px + xx, py + yy + (state.pointer.pressed ? 1 : 0), pixel === 'X' ? S.uiInk : S.uiPaper);
  }
}
