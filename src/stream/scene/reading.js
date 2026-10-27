// Printed leaves curl across the binding; the reading guide follows the words,
// occasionally returning to an earlier sentence before continuing. The pages
// hold a real book, opened at a page picked from the stream's seed.
import { createCanvas } from './canvas.js';
import { clamp01, smooth } from './dither.js';
import { hashString } from '../../compose/rng.js';
import { S } from './palette.js';
import { MOTION } from './motion.js';
import { LINE, measure, text, wrap } from './text.js';
import { BOOK } from './content/book.js';

const leaf = createCanvas();
const PERIOD = 20;
const TURN = MOTION.page;
const paginated = new Map();

/** Split the book into pages of `rows` lines, each chapter opening a page. */
function paginate(width, rows) {
  const key = `${width}:${rows}`;
  if (paginated.has(key)) return paginated.get(key);
  const pages = [];
  let lines = [];
  const flush = () => {
    while (lines.length && !lines[lines.length - 1].text) lines.pop();
    if (lines.length) pages.push(lines);
    lines = [];
  };
  const put = (line) => {
    lines.push(line);
    if (lines.length >= rows) flush();
  };
  for (const chapter of BOOK.chapters) {
    put({ text: '', head: false });
    put({ text: chapter.title, head: true });
    put({ text: '', head: false });
    for (const para of chapter.paragraphs) {
      for (const row of wrap(para, width, true)) put({ text: row, head: false });
      put({ text: '', head: false });
    }
  }
  flush();
  paginated.set(key, pages);
  return pages;
}

/**
 * One printed page. `read` is the guide position in lines on this page
 * (negative when the page has not been reached yet).
 */
function page(c, x, y, w, h, sheet, number, read) {
  c.rect(x, y, w, h, S.paper);
  text(c, x + 8, y + 4, BOOK.title, S.metalDark, { tiny: true, clip: w - 30 });
  c.rect(x + 8, y + 10, w - 16, 1, S.cloudShade);
  c.rect(x + 8, y + 11, Math.round((w - 16) * 0.22), 1, S.metalDark);
  let ly = y + 14;
  for (let i = 0; i < sheet.length; i++) {
    const line = sheet[i];
    if (line.text) {
      const seen = i <= Math.floor(read);
      const color = line.head || seen ? S.ink : S.outline;
      text(c, x + 8, ly, line.text, color, { tiny: true, clip: w - 16 });
    }
    if (i === Math.floor(read) && read >= 0) {
      const used = Math.min(w - 16, Math.round(((read % 1) || 0) * (w - 16)));
      c.rect(x + 8, ly + 6, Math.max(1, used), 1, S.logo);
      if (used > 2) c.set(x + 8 + used - 1, ly + 5, S.logo);
    }
    ly += LINE.tiny;
  }
  const folio = String(number);
  text(c, x + Math.round(w / 2 - measure(folio, true) / 2), y + h - 7, folio, S.metalDark, { tiny: true });
}

export function book(c, { x, y, w, h }, t, seed) {
  const pw = Math.floor(w / 2 - 5);
  const ph = h - 8;
  const rows = Math.floor((ph - 26) / LINE.tiny);
  const pages = paginate(pw - 15, rows);
  // Open on a full spread, not on the last leaf of a chapter or the book.
  const full = [];
  for (let i = 0; i < pages.length; i++) {
    const here = pages[i].filter((line) => line.text).length / rows;
    const nextPage = pages[(i + 1) % pages.length].filter((line) => line.text).length / rows;
    if (here > 0.75 && nextPage > 0.75) full.push(i);
  }
  const hash = hashString(`book:${seed}`);
  const start = full.length ? full[hash % full.length] : hash % pages.length;
  const spread = Math.floor(t / PERIOD);
  const u = t % PERIOD;
  const turning = u > PERIOD - TURN;
  const p = clamp01((u - PERIOD + TURN) / TURN);
  const mid = Math.round(x + w / 2);
  const left = (start + spread * 2) % pages.length;
  const right = (left + (turning ? 3 : 1)) % pages.length;
  const next = (left + 2) % pages.length;

  c.rect(x, y + 2, w, h - 2, S.trunk);
  c.rect(x + 2, y + h - 3, w - 4, 1, S.banner);

  // A brief, smooth regression of the guide reads as rereading, then it
  // catches up with its place.
  const reread = u > 6 && u < 9 ? Math.sin(((u - 6) / 3) * Math.PI) * 2.4 : 0;
  const read = clamp01((u - 0.8) / (PERIOD - TURN - 1)) * rows * 2 - reread;
  page(c, x + 3, y + 3, pw, ph, pages[left], left + 1, read);
  page(c, mid + 2, y + 3, pw, ph, pages[right], right + 1, turning ? -1 : read - rows);
  c.rect(mid - 2, y + 3, 1, ph, S.banner);
  c.rect(mid - 1, y + 3, 2, ph, S.metal);
  c.rect(mid + 1, y + 3, 1, ph, S.cloudShade);
  if (!turning) return;

  // Render both faces of a real leaf, including print. Compress its columns
  // towards the spine, then open its reverse on the left, with a curled edge.
  const front = p < 0.5;
  const face = front ? right : next;
  page(leaf, 0, 0, pw, ph, pages[face], face + 1, front ? rows : -1);
  const angle = smooth(p) * Math.PI;
  const width = Math.max(1, Math.round(Math.abs(Math.cos(angle)) * pw));
  const startX = front ? mid + 2 : mid - 2 - width;
  for (let dx = 0; dx < width; dx++) {
    const source = Math.min(pw - 1, Math.floor((dx / width) * pw));
    const lift = Math.round(Math.sin(angle) * Math.sin((dx / width) * (Math.PI / 2)) * 5);
    for (let dy = 0; dy < ph; dy++) c.set(startX + dx, y + 3 + dy - lift, leaf.get(source, dy));
  }
  const edge = front ? startX + width - 1 : startX;
  c.line(edge, y + 3 - Math.round(Math.sin(angle) * 5), edge, y + ph + 2 - Math.round(Math.sin(angle) * 5), S.metal);
}
