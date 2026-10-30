import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barMini, barsMini } from '../src/compose/mini.js';
import { bassLine, BASS_RHYTHMS } from '../src/compose/patterns.js';
import { chordsPerBar, PROGRESSIONS } from '../src/compose/theory.js';

test('bars become compact mini-notation with rests and weights', () => {
  assert.equal(barMini([{ step: 0, len: 16, value: 'a1' }]), 'a1');
  assert.equal(barMini([{ step: 0, len: 8, value: 'a1' }, { step: 8, len: 8, value: 'e2' }]), '[a1 e2]');
  assert.equal(barMini([{ step: 4, len: 4, value: 'c3' }]), '[~ c3 ~@2]');
});

test('repeated bars fold into one alternation entry', () => {
  assert.equal(barsMini(['a', 'a', 'b']), '<a!2 b>');
  assert.equal(barsMini(['a', 'a']), 'a');
});

test('legato bass lines stay inside their register', () => {
  const key = { tonic: 2, mode: 'aeolian' };
  for (const p of PROGRESSIONS.filter((x) => x.mode === 'aeolian')) {
    for (const rhythm of Object.values(BASS_RHYTHMS)) {
      const line = bassLine(chordsPerBar(key, p), rhythm, { low: 26, legato: true });
      for (const [, name, octave] of line.matchAll(/\b([a-g]b?)(\d)\b/g)) {
        const midi = 'c db d eb e f gb g ab a bb b'.split(' ').indexOf(name) + 12 * (Number(octave) + 1);
        assert.ok(midi >= 26 && midi <= 26 + 24, `${p.id}: ${name}${octave} out of range`);
      }
    }
  }
});
