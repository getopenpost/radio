// Broken beat, after the 128-134 BPM half of Serious Grind: two kicks a bar
// pushed off the grid, held ninth chords and a held sub. The groove carries it,
// so harmony and melody stay plain.
import { GROOVES } from '../grooves.js';
import { makeStyle } from './common.js';

export const broken = makeStyle({
  id: 'broken',
  label: 'broken beat',
  bpm: [128, 134],
  moods: ['melodic'],
  modes: ['aeolian', 'ionian'],
  energy: 3,
  tags: ['house', 'melodic'],
  kitTags: ['melodic'],
  levels: { sub: 0.68, bass: 0.13, kick: 1.9, snare: 0.22, hat: 0.16, tick: 0.09, openhat: 0.09, perc: 0.05, pad: 0.42, keys: 0.45, lead: 0.11 },
  grooves: GROOVES.broken,
  chordModes: [[7, 'pad'], [3, 'both']],
  melodyModes: [[4, 'hook'], [4, 'run']],
  bassChance: 0.15,
  stabs: ['.x.x.x.x.x.x.x.x', '.x...x..x..x..x.', '.x.x..x...x.xx..'],
  subRhythms: ['hold', 'octaveFlip'],
  bassRhythms: ['lateTwo', 'octaveFlip'],
  duck: { harmony: 7, bass: 7, melody: 3, recover: 0.26 },
  arc: [560, 3000],
  plans: () => [
    ['intro', 8, 'rise', 16, 'groove', 16, 'hook', 32, 'break', 16, 'peak', 32, 'fall', 8, 'outro', 8],
    ['intro', 8, 'rise', 16, 'groove', 32, 'break', 16, 'hook', 16, 'peak', 32, 'fall', 8, 'outro', 8],
  ],
  sections: (name, { open, drop, enter, leave, chords, low, melody }) => {
    const kick = `kick${drop}`;
    switch (name) {
      case 'intro':
        return [`held(heldA).lpf(${open(0.05, 0.25)})`, `sub(subA)${enter(4)}`];
      case 'rise':
        return [kick, `tick${enter(8)}`, 'sub(subA)', ...chords(0.15, 0.3)];
      case 'groove':
        return [kick, 'clap', 'hat', 'tick', ...low(), ...chords(0.3, 0.45)];
      case 'hook':
        return [kick, 'clap', 'hat', 'tick', 'perc', ...low(), ...chords(0.4, 0.55), ...melody()];
      case 'break':
        return [`held(heldA).lpf(${open(0.45, 0.9)})`, ...melody(), `sub(subA)${leave(8)}`, `riser${enter(8)}`];
      case 'peak':
        return [kick, 'clap', 'hat', 'tick', 'open', 'perc', ...low(), ...chords(0.55, 0.75), ...melody(1)];
      case 'fall':
        return [kick, 'hat', 'sub(subA)', ...chords(0.45, 0.2)];
      case 'outro':
        return [`held(heldA).lpf(${open(0.2, 0.03)})`, `sub(subA)${leave(4)}`];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
