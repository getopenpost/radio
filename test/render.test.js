import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderCode } from '../src/engine/render.js';

test('a kick can duck a bus before anything has played on it', async () => {
  // The kick ducks orbit 2 from the first beat; the chords on orbit 2 only start in bar 2.
  const code = `setcps(.5)
stack(
  note("c2*4").s("sine").decay(.1).sustain(0).duckorbit(2).duckdepth(.5).orbit(1),
  note("<~ [c4,e4,g4]>").s("triangle").orbit(2),
)`;
  const audio = await renderCode(code, { cycles: 2, tail: 0 });
  assert.ok(audio.left.length > 0);
});
