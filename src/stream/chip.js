// The now-playing chip. When the song changes the chip eases to its new width,
// growing or shrinking to the left, and the title rolls over letter by letter,
// from the right, like a split-flap board. Letters that stay the same do not move.
// Everything here is a pure function of the frame number and the list of titles,
// so a worker can draw any frame on its own.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetsDir } from '../paths.js';

export const TEXT_SIZE = 10;
export const CHAR_WIDTH = TEXT_SIZE * 0.6;
export const TEXT_W = 960; // the title layer, in output pixels
export const TEXT_H = 44;
const MORPH = 1.15; // seconds the chip takes to change width
const ROLL = 0.34; // seconds one letter takes to turn over
const STAGGER = 0.016; // seconds between neighbouring letters
const SET = [...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(''), '·', '–', 'é', 'á', 'í', 'ó', 'ú', 'ñ', 'ü', 'ö', 'ä', 'ç', 'ã', 'õ'];
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));

export const pillFor = (text) => Math.round(26 + text.length * CHAR_WIDTH);

/** The chip at a frame: its width, and the title on its way in and out. */
export function chipAt(titles, frame, fps) {
  let i = titles.length - 1;
  while (i > 0 && titles[i].from > frame) i--;
  const now = titles[i];
  const before = titles[i - 1];
  const t = (frame - now.from) / fps;
  if (!before || t >= MORPH + 1) return { pill: pillFor(now.text), text: now.text, old: null, t };
  const width = pillFor(before.text) + (pillFor(now.text) - pillFor(before.text)) * ease(clamp(t / MORPH));
  return { pill: Math.round(width), text: now.text, old: before.text, t };
}

/** One strip of every letter, at output size, from the stream's own font. */
function renderGlyphs(scale) {
  const size = TEXT_SIZE * scale;
  const cell = Math.round(size * 0.6);
  const dir = mkdtempSync(join(tmpdir(), 'glyphs-'));
  const font = join(assetsDir, 'fonts', 'GeistMono-Medium.ttf').replaceAll(':', '\\:');
  // Every letter is placed on its own, so the strip's layout is exactly the grid.
  const filters = SET.flatMap((ch, i) => {
    if (ch === ' ') return [];
    const file = join(dir, `${i}.txt`);
    writeFileSync(file, ch);
    return [`drawtext=expansion=none:fontfile='${font}':textfile='${file}':fontsize=${size}:fontcolor=white:x=${i * cell}:y=${TEXT_H / 2}-max_glyph_a/2-2`];
  });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=black:s=${cell * SET.length}x${TEXT_H}`, '-vf', filters.join(','), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 24 });
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`glyphs: ${r.stderr}`);
  return { strip: r.stdout, cell, width: cell * SET.length, index: new Map(SET.map((c, i) => [c, i])) };
}

export function createChipText(scale) {
  const glyphs = renderGlyphs(scale);
  const layer = new Uint8Array(TEXT_W * TEXT_H);
  let shown = '';

  function glyph(ch, x, dy) {
    const i = glyphs.index.get(ch);
    if (i == null || ch === ' ') return;
    for (let y = Math.max(0, -dy); y < Math.min(TEXT_H, TEXT_H - dy); y++) {
      const from = y * glyphs.width + i * glyphs.cell;
      const to = (y + dy) * TEXT_W + x;
      for (let k = 0; k < glyphs.cell; k++) {
        const v = glyphs.strip[from + k];
        if (v > layer[to + k]) layer[to + k] = v;
      }
    }
  }

  /** The title layer for a chip state. Returns it unchanged while nothing moves. */
  function draw({ text, old, t, pill }) {
    const key = old ? `${old}>${text}@${Math.round(t * 240)}` : text;
    if (key === shown) return layer;
    shown = key;
    layer.fill(0);
    const slots = Math.max(text.length, old?.length ?? 0);
    for (let j = 0; j < slots; j++) {
      const x = TEXT_W - (j + 1) * glyphs.cell;
      if (x < 0) break;
      const next = text[text.length - 1 - j];
      const last = old?.[old.length - 1 - j];
      if (!old || next === last) {
        if (next) glyph(next, x, 0);
        continue;
      }
      const p = ease(clamp((t - j * STAGGER) / ROLL));
      if (last) glyph(last, x, -Math.round(p * TEXT_H));
      if (next) glyph(next, x, Math.round((1 - p) * TEXT_H));
    }
    // While the chip changes size, nothing shows outside it or over the note.
    if (old) {
      const edge = TEXT_W - (pill - 24) * scale;
      for (let y = 0; y < TEXT_H; y++) layer.fill(0, y * TEXT_W, y * TEXT_W + Math.max(0, edge));
    }
    return layer;
  }
  return { draw };
}
