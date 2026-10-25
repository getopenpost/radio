import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/compose/rng.js';
import { createDirector, STYLE_FLOW } from '../src/stream/director.js';

const catalog = [];
let n = 0;
for (const style of Object.keys(STYLE_FLOW)) {
  for (let i = 0; i < 12; i++) {
    catalog.push({ id: `${style}-${n++}`, style, bpm: 80 + (n % 40), energy: 3, key: { tonic: n % 12, mode: n % 2 ? 'aeolian' : 'ionian' } });
  }
}

test('consecutive tracks only move between neighbouring styles', () => {
  const director = createDirector({ rng: createRng(1), hourOf: () => 12 });
  let current = null;
  for (let i = 0; i < 300; i++) {
    const next = director.next(catalog, current);
    if (current) assert.ok(STYLE_FLOW[current.style][next.style], `${current.style} -> ${next.style}`);
    current = next;
  }
});

test('nothing repeats until most of the library has played', () => {
  const director = createDirector({ rng: createRng(2), hourOf: () => 12 });
  const seen = new Map();
  let current = null;
  for (let i = 0; i < 200; i++) {
    current = director.next(catalog, current);
    if (seen.has(current.id)) assert.ok(i - seen.get(current.id) >= catalog.length * 0.6, `${current.id} repeated after ${i - seen.get(current.id)}`);
    seen.set(current.id, i);
  }
});

test('style runs stay short', () => {
  const director = createDirector({ rng: createRng(3), hourOf: () => 12 });
  let current = null;
  let run = 0;
  let longest = 0;
  for (let i = 0; i < 500; i++) {
    const next = director.next(catalog, current);
    run = current && next.style === current.style ? run + 1 : 0;
    longest = Math.max(longest, run);
    current = next;
  }
  assert.ok(longest <= 9, `longest run ${longest}`);
});
