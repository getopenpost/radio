import { test } from 'node:test';
import assert from 'node:assert/strict';
import { camelot, chordScale, keyDistance, makeChord, PROGRESSIONS, QUALITIES } from '../src/compose/theory.js';

test('camelot positions match the published wheel', () => {
  assert.deepEqual(camelot({ tonic: 9, mode: 'aeolian' }), { n: 8, letter: 'A' }); // A minor
  assert.deepEqual(camelot({ tonic: 0, mode: 'ionian' }), { n: 8, letter: 'B' }); // C major
  assert.deepEqual(camelot({ tonic: 8, mode: 'aeolian' }), { n: 1, letter: 'A' }); // Ab minor
  assert.deepEqual(camelot({ tonic: 4, mode: 'ionian' }), { n: 12, letter: 'B' }); // E major
});

test('relative and neighbouring keys are close, distant keys are not', () => {
  const am = { tonic: 9, mode: 'aeolian' };
  assert.equal(keyDistance(am, { tonic: 0, mode: 'ionian' }), 1); // relative major
  assert.equal(keyDistance(am, { tonic: 4, mode: 'aeolian' }), 1); // E minor, one step on the wheel
  assert.ok(keyDistance(am, { tonic: 3, mode: 'aeolian' }) >= 5); // Eb minor, opposite side
});

test('chord symbols and tones', () => {
  const c = makeChord({ tonic: 9, mode: 'aeolian' }, 8, 'maj9'); // VI of A minor
  assert.equal(c.symbol, 'F^9');
  assert.deepEqual(new Set(c.tones), new Set([5, 9, 0, 4, 7]));
});

test('chord scales avoid notes a semitone above chord tones', () => {
  const key = { tonic: 0, mode: 'ionian' };
  const cmaj7 = makeChord(key, 0, 'maj7');
  assert.ok(!chordScale(key, cmaj7).includes(5)); // F over Cmaj7 rubs against E
});

test('every progression uses known qualities', () => {
  for (const p of PROGRESSIONS) for (const [, quality] of p.chords) assert.ok(QUALITIES[quality], `${p.id}: ${quality}`);
});
