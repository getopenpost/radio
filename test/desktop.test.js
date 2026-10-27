import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCanvas } from '../src/stream/scene/canvas.js';
import { laptop } from '../src/stream/scene/desktop.js';
import { desktopAt } from '../src/stream/scene/desktop-timeline.js';
import { S } from '../src/stream/scene/palette.js';

const box = { x: 100, y: 50, w: 280, h: 170 };
function frame(t) {
  const c = createCanvas();
  laptop(c, box, t, 7);
  return c;
}

// Find the light vertical stroke shared by the arrow and editor caret.
// Long window edges and horizontal text strokes cannot match this shape.
function pointers(c) {
  const found = [];
  for (let y = box.y; y < box.y + box.h - 5; y++) for (let x = box.x + 1; x < box.x + box.w - 1; x++) {
    if (c.get(x, y - 1) !== S.ink || c.get(x, y + 4) !== S.ink) continue;
    if ([0, 1, 2, 3].every((dy) => c.get(x, y + dy) === S.paper && c.get(x - 1, y + dy) === S.ink)) found.push([x, y]);
  }
  return found;
}

test('the rendered pointer does not teleport when its old six-second loop ends', () => {
  const before = pointers(frame(6 - 1 / 120));
  const after = pointers(frame(6 + 1 / 120));
  assert.ok(before.length && after.length, 'the pointer is visible in both frames');
  for (const [x, y] of after) {
    const moved = Math.min(...before.map(([bx, by]) => Math.hypot(x - bx, y - by)));
    assert.ok(moved <= 8, `a pointer/caret jumped ${moved.toFixed(1)} pixels between adjacent frames`);
  }
});

test('the editor renders varied syntax tokens rather than one repeated solid bar per line', () => {
  const c = frame(12);
  const syntax = new Set([S.paper, S.logo, S.knit, S.brass]);
  let detailedRows = 0;
  for (let y = box.y + 44; y < box.y + box.h - 30; y++) {
    let tokens = 0;
    let inside = false;
    const colors = new Set();
    for (let x = box.x + 60; x < box.x + box.w - 34; x++) {
      const col = c.get(x, y);
      if (syntax.has(col)) {
        if (!inside) tokens++;
        colors.add(col);
        inside = true;
      } else inside = false;
    }
    if (tokens >= 3 && colors.size >= 2) detailedRows++;
  }
  assert.ok(detailedRows >= 6, `only ${detailedRows} rows contain varied syntax`);
});

test('pointer trajectories remain continuous across app changes and repeated work sessions', () => {
  let previous = desktopAt(0).pointer;
  // A complete wall-clock activity slot, long enough to cross multiple
  // session boundaries without copying the owner's declared session length.
  for (let frame = 1; frame <= 15 * 60 * 60; frame++) {
    const p = desktopAt(frame / 60).pointer;
    assert.ok(Math.hypot(p.x - previous.x, p.y - previous.y) < 0.025, `pointer jumped at ${(frame / 60).toFixed(3)}s`);
    assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
    previous = p;
  }
});
