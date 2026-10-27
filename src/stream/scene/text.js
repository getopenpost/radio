// Painted text. Two faces: the 5x7 banner font and the 3x5 body font.
// Masks and wrapped paragraphs are cached because a page repaints every frame.
import { textMask, textMaskTiny } from './font.js';

const cache = { big: new Map(), tiny: new Map() };
const wraps = new Map();

export const LINE = { big: 9, tiny: 6 };
export const ROWS = { big: 7, tiny: 5 };

function maskOf(str, tiny) {
  const box = tiny ? cache.tiny : cache.big;
  let m = box.get(str);
  if (!m) {
    if (box.size > 3000) box.clear();
    m = tiny ? textMaskTiny(str) : textMask(str);
    box.set(str, m);
  }
  return m;
}

/** Rendered width of `str` in pixels. */
export function measure(str, tiny = false) {
  return maskOf(str, tiny)[0]?.length ?? 0;
}

/**
 * Draw `str` with its top-left at (x, y). `reveal` types it in by character;
 * `clip` stops the glyphs at a pixel width. Coordinates are whole pixels.
 */
export function text(c, x, y, str, color, { tiny = false, reveal = Infinity, clip = Infinity } = {}) {
  const shown = reveal === Infinity ? str : str.slice(0, Math.max(0, Math.floor(reveal)));
  const m = maskOf(shown, tiny);
  const width = Math.min(m[0]?.length ?? 0, clip);
  if (width <= 0) return 0;
  const px = Math.round(x);
  const py = Math.round(y);
  for (let row = 0; row < m.length; row++) {
    const line = m[row];
    for (let col = 0; col < width; col++) if (line[col]) c.set(px + col, py + row, color);
  }
  return width;
}

/**
 * Split `str` into lines no wider than `maxWidth`. Long words are cut.
 */
export function wrap(str, maxWidth, tiny = false) {
  const key = `${tiny ? 't' : 'b'}:${maxWidth}:${str}`;
  let lines = wraps.get(key);
  if (lines) return lines;
  lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, tiny) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    let rest = word;
    while (measure(rest, tiny) > maxWidth) {
      let cut = rest.length;
      while (cut > 1 && measure(rest.slice(0, cut), tiny) > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  if (wraps.size > 600) wraps.clear();
  wraps.set(key, lines);
  return lines;
}

/** The paragraph text of a wrapped block, ready to draw line by line. */
export function lines(str, maxWidth, tiny = false) {
  return wrap(str, maxWidth, tiny);
}
