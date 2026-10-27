import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCanvas } from '../src/stream/scene/canvas.js';
import { createCharacters } from '../src/stream/scene/character.js';
import { book } from '../src/stream/scene/pov.js';
import { S } from '../src/stream/scene/palette.js';

test('a turning book leaf carries printed text instead of blanking the left page', () => {
  const canvas = createCanvas();
  const box = { x: 100, y: 50, w: 216, h: 128 };
  for (const t of [0.88, 13.88, 14.88, 27.88, 18.9, 19.4, 19.9, 39.9]) {
    book(canvas, box, t, 7);
    let printedRows = 0;
    for (let y = box.y + 10; y < box.y + box.h - 18; y++) {
      let ink = 0;
      for (let x = box.x + 10; x < box.x + box.w / 2 - 8; x++) {
        if ([S.ink, S.outline, S.cloudShade].includes(canvas.get(x, y))) ink++;
      }
      if (ink >= 8) printedRows++;
    }
    assert.ok(printedRows >= 8, `left page lost its print at ${t}s (${printedRows} rows)`);
  }
});

test('arms can reach a straight hang and support without moving the hand off its anchor', () => {
  const chars = createCharacters();
  for (const dir of [-1, 1]) {
    const canvas = createCanvas();
    const shoulder = [100, 100];
    const hand = [100, 100 + dir * 20];
    const elbow = chars.arm(canvas, 'fox', shoulder, hand, 1, { upper: 10, fore: 10 });
    assert.ok(Math.abs(elbow[0] - 100) < 0.1, `elbow bows out at full reach: ${elbow}`);
    assert.equal(canvas.get(...hand), S.cream, 'paw stays on the bar');
  }
});
