// Slow soul, after Let's Work Slow and Easy: electric piano leads the mix over
// a loose hip-hop beat, chords change every bar or two and sometimes land
// early, the bass walks up to the next root, and short pentatonic fills answer
// at the ends of phrases.
import { GROOVES } from '../grooves.js';
import { makeStyle } from './common.js';

export const slow = makeStyle({
  id: 'slow',
  label: 'slow soul',
  bpm: [80, 95],
  moods: ['soul'],
  modes: ['ionian', 'aeolian', 'dorian'],
  energy: 2,
  presence: 0,
  echo: 0,
  tags: ['soul'],
  kitTags: ['soul'],
  levels: { sub: 0.42, bass: 0.72, kick: 1.15, snare: 0.26, hat: 0.035, tick: 0.022, openhat: 0.05, perc: 0.05, pad: 0.26, keys: 0.8, lead: 0.3 },
  grooves: GROOVES.soul,
  chordModes: [[1, 'pad']],
  melodyModes: [[1, 'hook']],
  center: [62, 66],
  voices: 5,
  swing: 0.14,
  fills: true,
  stabs: ['x...............'],
  comps: [
    [[0, 11]],
    [[0, 7], [8, 5], [14, 2, true]],
    [[0, 10], [14, 2, true]],
    [[0, 6], [7, 6]],
    [[0, 5], [6, 2], [8, 6]],
    [[2, 3], [6, 3], [10, 3], [14, 2, true]],
  ],
  subRhythms: ['hold'],
  bassLow: 31,
  bassRhythms: ['long', 'doubled', 'rootOctave', 'holdApproach'],
  duck: { harmony: 2, bass: 2, melody: 1, recover: 0.2 },
  arc: [620, 2000],
  plans: (rng) => {
    const turnaround = rng.pick([8, 16]);
    return [
      ['intro', 4, 'verse', 16, 'lead', 16, 'lift', turnaround, 'verse2', 16, 'lead', 16, 'end', 8, 'outro', 4],
      ['intro', 4, 'verse', 8, 'lead', 16, 'lift', 8, 'lead', 16, 'lift', turnaround, 'lead', 16, 'end', 8, 'outro', 4],
    ];
  },
  sections: (name, { drop, open, enter }) => {
    const beat = ['kick', 'clap', 'hat', 'tick', 'perc'];
    switch (name) {
      case 'intro':
        return [`keys(compA).lpf(${open(0.2, 0.5)})`];
      case 'verse':
        return [...beat, 'bass(lineA)', `keys(compA).lpf(${open(0.5)})`];
      case 'lead':
        return [...beat, 'bass(lineA)', `keys(compA).lpf(${open(0.65)})`, 'lead(fillA)'];
      case 'lift':
        return [`kick${drop}`, 'clap', 'hat', 'perc', 'bass(lineA2)', `keys(compA2).lpf(${open(0.75)})`, 'lead(fillB)', `held(heldA).lpf(${open(0.3)})`];
      case 'verse2':
        return [...beat, 'bass(lineA2)', `keys(compA2).lpf(${open(0.6)})`, `lead(fillA)${enter(8)}`];
      case 'end':
        return ['hat', 'bass(lineA)', `keys(compA).lpf(${open(0.5)})`, 'lead(fillA)'];
      case 'outro':
        return [`keys(compA).lpf(${open(0.4, 0.15)})`];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
