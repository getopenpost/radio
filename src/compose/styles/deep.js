// Deep house, after House Music to Conquer the World: one or two chords for
// the whole song, a plucked bass that never lands on the kick, offbeat stabs
// and phrases of vocal chops. Everything moves through the filter arc.
import { GROOVES } from '../grooves.js';
import { makeStyle } from './common.js';

export const deep = makeStyle({
  id: 'deep',
  label: 'deep house',
  bpm: [119, 123],
  moods: ['deep'],
  modes: ['dorian', 'aeolian', 'ionian'],
  energy: 4,
  tags: ['house', 'deep'],
  kitTags: ['deep'],
  levels: { sub: 0.72, bass: 0.17, kick: 1.75, snare: 0.15, hat: 0.2, tick: 0.09, openhat: 0.09, perc: 0.05, pad: 0.17, keys: 0.3, lead: 0.1, voice: 0.2 },
  grooves: GROOVES.house,
  chordModes: [[8, 'stab'], [2, 'both']],
  melodyModes: [[6, 'hook'], [1, 'run']],
  bassChance: 0.9,
  chopChance: 0.5,
  stabs: ['...x.x....x...x.', '..x...x....x..x.', '..x.x..x...x....', '......x.......x.', '...x..x...x...x.', '..x..x....x..x..'],
  subRhythms: ['hold'],
  bassRhythms: ['syncopated16', 'tresillo', 'lateTwo', 'walker', 'pickup', 'afterKick'],
  duck: { harmony: 7, bass: 5, melody: 3, recover: 0.28 },
  arc: [480, 3600],
  plans: () => [
    ['intro', 8, 'rise', 16, 'groove', 16, 'groove2', 16, 'lift', 16, 'break', 32, 'peak', 16, 'peak2', 16, 'fall', 8, 'outro', 8],
    ['intro', 8, 'rise', 8, 'groove', 16, 'groove2', 16, 'break', 16, 'lift', 16, 'peak', 32, 'break', 16, 'peak2', 16, 'fall', 8, 'outro', 8],
    ['intro', 8, 'rise', 16, 'groove', 32, 'lift', 16, 'break', 16, 'peak', 32, 'fall', 8, 'outro', 8],
  ],
  sections: (name, { open, drop, enter, leave, chords, low, melody }) => {
    const kick = `kick${drop}`;
    switch (name) {
      case 'intro':
        return [`held(heldA).lpf(${open(0.02, 0.18)})`, `sub(subA)${enter(4)}`];
      case 'rise':
        return [kick, `hat${enter(4)}`, 'sub(subA)', ...chords(0.08, 0.22)];
      case 'groove':
        return [kick, 'clap', 'hat', 'tick', ...low(), ...chords(0.22, 0.34)];
      case 'groove2':
        return [kick, 'clap', 'hat', 'tick', 'perc', ...low('lineA2'), ...chords(0.34, 0.46), ...melody()];
      case 'lift':
        return [kick, 'clap', 'hat', 'tick', 'open', 'perc', ...low('lineA2'), ...chords(0.46, 0.6), ...melody()];
      case 'break':
        return [`stab(A).lpf(${open(0.5, 0.95)})`, `held(heldA).lpf(${open(0.3, 0.8)})`, `hat${leave(8)}`, ...melody(), `sub(subA)${leave(8)}`, `riser${enter(8)}`];
      case 'peak':
        return [kick, 'clap', 'hat', 'tick', 'open', 'perc', ...low(), ...chords(0.55, 0.68), ...melody(1)];
      case 'peak2':
        return [kick, 'clap', 'hat', 'tick', 'open', 'perc', ...low('lineA2'), ...chords(0.68, 0.78), ...melody(1)];
      case 'fall':
        return [kick, 'hat', 'sub(subA)', ...chords(0.45, 0.2)];
      case 'outro':
        return [`held(heldA).lpf(${open(0.18, 0.02)})`, `sub(subA)${leave(4)}`];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
