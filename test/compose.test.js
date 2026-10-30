import test from 'node:test';
import assert from 'node:assert/strict';
import { composeTrack, styles } from '../src/compose/index.js';
import { cascade, hook } from '../src/compose/patterns.js';
import { createRng } from '../src/compose/rng.js';
import { makeChord, noteName, voiceLoop } from '../src/compose/theory.js';

const key = { tonic: 11, mode: 'aeolian' }; // B minor: Bm9 has D next to C#
const notes = (mini) => [...mini.matchAll(/[a-g]b?\d/g)].map((m) => m[0]);

test('a chord tone beside another chord tone stays where it is', () => {
  const chords = [makeChord(key, 0, 'm9')];
  for (let seed = 1; seed < 40; seed++) {
    assert.ok(notes(hook(createRng(seed), key, chords)).every((n) => !n.startsWith('c') || n.startsWith('db')));
  }
  const hooked = new Set(Array.from({ length: 40 }, (_, seed) => notes(hook(createRng(seed + 1), key, chords))).flat());
  assert.ok([...hooked].some((n) => n.startsWith('d') && !n.startsWith('db')), 'the minor third survives');
});

test('a falling run never strikes the same note twice', () => {
  const chords = [makeChord(key, 0, 'm9'), makeChord(key, 3, 'maj9')];
  for (let seed = 1; seed < 40; seed++) {
    for (const bar of cascade(createRng(seed), key, chords).split(/[[\]]/).filter((x) => /\d/.test(x))) {
      const run = notes(bar);
      assert.equal(new Set(run).size, run.length, bar);
    }
  }
});

test('ninth chords voice with the ninth on top, not as a low semitone cluster', () => {
  const [voicing] = voiceLoop([makeChord({ tonic: 7, mode: 'aeolian' }, 0, 'm9')]);
  assert.deepEqual(voicing.map(noteName), ['bb3', 'd4', 'f4', 'a4']);
});

test('every style opens and closes without drums, so the stream can crossfade tempos', () => {
  for (const style of Object.keys(styles)) {
    for (let seed = 1; seed <= 12; seed++) {
      const { code } = composeTrack({ style, seed });
      const blocks = code.slice(code.indexOf('arrange(')).split('], //');
      for (const block of [blocks[0], blocks.at(-2)]) assert.doesNotMatch(block, /\b(kick|clap|hat|tick)\b/, `${style}-${seed}`);
    }
  }
});
