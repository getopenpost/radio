// Melodic house, after Lock In and the four-on-the-floor half of Serious Grind:
// an eight-bar chord loop held over one sidechained sub, a short hook crossing
// the bar line, and a filter that opens across the whole song.
import { GROOVES } from '../grooves.js';
import { makeStyle } from './common.js';

export const melodic = makeStyle({
  id: 'melodic',
  label: 'melodic house',
  bpm: [118, 127],
  moods: ['melodic'],
  modes: ['aeolian', 'ionian', 'phrygian'],
  energy: 4,
  tags: ['house', 'melodic'],
  kitTags: ['melodic'],
  levels: { sub: 0.78, bass: 0.13, kick: 1.7, snare: 0.17, hat: 0.2, tick: 0.09, openhat: 0.1, perc: 0.04, pad: 0.42, keys: 0.5, lead: 0.11 },
  grooves: GROOVES.house,
  chordModes: [[5, 'pad'], [3, 'both'], [2, 'stab']],
  melodyModes: [[5, 'hook'], [3, 'run'], [2, 'both']],
  bassChance: 0.3,
  stabs: ['...x.x....x...x.', '..x...x....x..x.', '......x.......x.', '..x...x...x.x.x.', '..x..x...x.x..x.', '.x...x...x...x..'],
  subRhythms: ['hold'],
  bassRhythms: ['afterKick', 'offbeats', 'lateTwo', 'pickup'],
  duck: { harmony: 8, bass: 6, melody: 3, recover: 0.32 },
  arc: [520, 3400],
  plans: () => [
    ['intro', 8, 'rise', 16, 'groove', 16, 'hook', 16, 'lift', 16, 'break', 16, 'peak', 16, 'peak2', 16, 'fall', 8, 'outro', 8],
    ['intro', 8, 'rise', 16, 'groove', 32, 'dip', 8, 'hook', 16, 'lift', 16, 'break', 16, 'peak', 32, 'fall', 8, 'outro', 8],
    ['intro', 8, 'groove', 16, 'hook', 32, 'break', 16, 'peak', 16, 'peak2', 16, 'dip', 8, 'peak', 16, 'fall', 8, 'outro', 8],
  ],
  sections: (name, { open, drop, enter, leave, chords, low, melody }) => {
    const kick = `kick${drop}`;
    switch (name) {
      case 'intro':
        return [`held(heldA).lpf(${open(0.02, 0.2)})`, `sub(subA)${enter(4)}`];
      case 'rise':
        return [kick, `hat${enter(8)}`, 'sub(subA)', ...chords(0.1, 0.25)];
      case 'groove':
        return [kick, 'clap', 'hat', 'tick', ...low(), ...chords(0.25, 0.4)];
      case 'hook':
        return [kick, 'clap', 'hat', 'tick', 'perc', ...low(), ...chords(0.35, 0.5), ...melody()];
      case 'lift':
        return [kick, 'clap', 'hat', 'tick', 'open', 'perc', ...low('lineA2'), ...chords(0.45, 0.6), ...melody()];
      case 'dip':
        return [`hat${enter(4)}`, 'sub(subA)', ...chords(0.5, 0.6), ...melody()];
      case 'break':
        return [`held(heldA).lpf(${open(0.45, 0.95)})`, ...melody(), `sub(subA)${leave(8)}`, `riser${enter(8)}`];
      case 'peak':
        return [kick, 'clap', 'hat', 'tick', 'open', 'perc', ...low(), ...chords(0.6, 0.72), ...melody(1)];
      case 'peak2':
        return [kick, 'clap', 'hat', 'tick', 'open', 'perc', ...low('lineA2'), ...chords(0.72, 0.8), ...melody(1)];
      case 'fall':
        return [kick, 'hat', 'sub(subA)', ...chords(0.5, 0.2)];
      case 'outro':
        return [`held(heldA).lpf(${open(0.2, 0.02)})`, `sub(subA)${leave(4)}`];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
