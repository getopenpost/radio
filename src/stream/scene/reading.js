// Printed leaves curl across the binding; the reading guide follows words,
// occasionally returning to an earlier sentence before continuing.
import { createRng } from '../../compose/rng.js';
import { createCanvas } from './canvas.js';
import { clamp01, smooth } from './dither.js';
import { S } from './palette.js';

const leaf = createCanvas();
const PERIOD = 20;
const TURN = 1.3;

function page(c, x, y, w, h, number, seed, reading = -1) {
  const r = createRng(seed + number * 97);
  c.rect(x, y, w, h, S.paper);
  c.rect(x + 7, y + 6, Math.round(w * 0.34), 2, S.metalDark);
  const rows = Math.floor((h - 25) / 6);
  for (let i = 0; i < rows; i++) {
    if (number % 4 === 1 && i >= 4 && i <= 8) continue;
    const ly = y + 15 + i * 6;
    const width = w - 17 - (i % 5 === 4 ? r.int(14, 28) : 0);
    let used = i % 5 === 0 ? 4 : 0;
    while (used < width - 3) {
      const word = Math.min(r.int(4, 12), width - used);
      const read = i < Math.floor(reading) || (i === Math.floor(reading) && used / width < reading % 1);
      c.rect(x + 7 + used, ly, word, 2, read ? S.outline : S.cloudShade);
      used += word + 3;
    }
    if (i === Math.floor(reading)) {
      const gaze = Math.round(width * (reading % 1));
      c.rect(x + 7, ly + 3, Math.max(1, gaze), 1, S.logo);
      c.set(x + 7 + gaze, ly + 2, S.logo);
    }
  }
  if (number % 4 === 1) {
    // An atlas plate between paragraphs, with contour lines and a marked
    // route. While the reader studies it, the route is picked out in ink.
    const px = x + 7;
    const py = y + 38;
    const pw = w - 15;
    c.rect(px, py, pw, 29, S.banner);
    for (let k = 0; k < 4; k++) for (let xx = 2; xx < pw - 2; xx++) {
      const yy = py + 4 + k * 6 + Math.round(Math.sin(xx * 0.09 + k + number) * 2);
      if (xx % 4 !== 0) c.set(px + xx, yy, S.metal);
    }
    const active = reading >= 4 && reading < 9;
    for (let xx = 8; xx < pw - 8; xx++) {
      const yy = py + 14 + Math.round(Math.sin(xx * 0.075 + number) * 7);
      c.set(px + xx, yy, active ? S.logo : S.knit);
      if (xx % 17 === 8) c.rect(px + xx - 1, yy - 1, 3, 3, S.ink);
    }
    c.line(px + pw - 7, py + 4, px + pw - 7, py + 10, S.ink);
    c.line(px + pw - 7, py + 4, px + pw - 9, py + 7, S.ink);
  }
  // Running folio, deliberately a few small strokes rather than large type.
  const folio = 2 + number % 7;
  c.rect(x + w / 2 - folio / 2, y + h - 6, folio, 1, S.metal);
}

export function book(c, { x, y, w, h }, t, seed) {
  const spread = Math.floor(t / PERIOD);
  const u = t % PERIOD;
  const turning = u > PERIOD - TURN;
  const p = clamp01((u - PERIOD + TURN) / TURN);
  const mid = Math.round(x + w / 2);
  const pw = Math.floor(w / 2 - 5);
  const ph = h - 8;
  c.rect(x, y + 2, w, h - 2, S.trunk);
  c.rect(x + 2, y + h - 3, w - 4, 1, S.banner);
  const rows = Math.floor((ph - 25) / 6);
  // A brief, smooth regression of the guide reads as rereading, without a
  // flashing line or an eye icon. It then catches up with its original place.
  const reread = u > 6 && u < 9 ? Math.sin((u - 6) / 3 * Math.PI) * 2.4 : 0;
  const read = clamp01((u - 0.8) / (PERIOD - TURN - 1)) * rows * 2 - reread;
  const leftNo = 12 + spread * 2;
  page(c, x + 3, y + 3, pw, ph, leftNo, seed, read);
  page(c, mid + 2, y + 3, pw, ph, leftNo + (turning ? 3 : 1), seed, turning ? -1 : read - rows);
  c.rect(mid - 2, y + 3, 1, ph, S.banner);
  c.rect(mid - 1, y + 3, 2, ph, S.metal);
  c.rect(mid + 1, y + 3, 1, ph, S.cloudShade);
  if (!turning) return;

  // Render both faces of a real leaf, including print. Compress its columns
  // towards the spine, then open its reverse on the left, with a curled edge.
  const front = p < 0.5;
  page(leaf, 0, 0, pw, ph, leftNo + (front ? 1 : 2), seed, front ? rows : -1);
  const angle = smooth(p) * Math.PI;
  const width = Math.max(1, Math.round(Math.abs(Math.cos(angle)) * pw));
  const start = front ? mid + 2 : mid - 2 - width;
  for (let dx = 0; dx < width; dx++) {
    const source = Math.min(pw - 1, Math.floor(dx / width * pw));
    const lift = Math.round(Math.sin(angle) * Math.sin(dx / width * Math.PI / 2) * 5);
    for (let dy = 0; dy < ph; dy++) c.set(start + dx, y + 3 + dy - lift, leaf.get(source, dy));
  }
  const edge = front ? start + width - 1 : start;
  c.line(edge, y + 3 - Math.round(Math.sin(angle) * 5), edge, y + ph + 2 - Math.round(Math.sin(angle) * 5), S.metal);
}
