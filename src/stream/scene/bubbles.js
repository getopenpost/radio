// Speech bubbles in the pixel font: a rounded box with a tail towards the
// speaker. The box is sized for the whole line while the text types in.
import { WIDTH } from './canvas.js';
import { textMask } from './font.js';
import { S } from './palette.js';

const masks = new Map();
const maskOf = (text) => {
  if (!masks.has(text)) masks.set(text, textMask(text));
  return masks.get(text);
};

/**
 * Draw a bubble whose tail points down at (x, y), the top of the speaker's head.
 * `reveal` in [0, 1] types the text in from the left. `side` puts the box to
 * the 'left' or 'right' of the tail (so two speakers' bubbles do not collide),
 * or centres it.
 */
export function bubble(canvas, x, y, text, reveal = 1, side = 'center') {
  const mask = maskOf(text);
  const tw = mask[0].length;
  const w = tw + 8;
  const h = 13;
  const want = side === 'left' ? x - w + 7 : side === 'right' ? x - 6 : x - w / 2;
  const left = Math.max(4, Math.min(WIDTH - 4 - w, Math.round(want)));
  const top = Math.round(y) - h - 4;
  // Box with clipped corners, a 1px ink border.
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const corner = (xx === 0 || xx === w - 1) && (yy === 0 || yy === h - 1);
      if (corner) continue;
      const edge = xx === 0 || xx === w - 1 || yy === 0 || yy === h - 1;
      canvas.set(left + xx, top + yy, edge ? S.ink : S.banner);
    }
  }
  // Tail: a small wedge from the box towards the speaker.
  const tx = Math.max(left + 3, Math.min(left + w - 4, Math.round(x)));
  for (let k = 0; k < 4; k++) {
    for (let xx = 0; xx < 4 - k; xx++) canvas.set(tx + xx - 1, top + h - 1 + k, xx === 0 || xx === 3 - k ? S.ink : S.banner);
  }
  canvas.set(tx - 1, top + h + 3, S.ink);
  // Text, typed in.
  const shown = Math.ceil(tw * Math.max(0, Math.min(1, reveal)));
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < shown; xx++) if (mask[yy][xx]) canvas.set(left + 4 + xx, top + 3 + yy, S.ink);
}

/**
 * Where a conversation is `t` seconds after it starts: the line being said,
 * who says it, and how much of it has typed in. Null between lines and after.
 * @param {{ who: string, text: string }[]} lines
 */
export function dialogue(lines, t) {
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    const d = 1.4 + lines[i].text.length * 0.09;
    if (t >= at && t < at + d) return { i, ...lines[i], typed: Math.min(1, (t - at) / (lines[i].text.length * 0.05)) };
    at += d + 0.4;
  }
  return null;
}

/** How long a conversation lasts. */
export const dialogueLength = (lines) => lines.reduce((s, l) => s + 1.8 + l.text.length * 0.09, 0);
