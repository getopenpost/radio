// Drum grooves as 16-step grids per bar ("x" hit, "." rest), grouped by feel.
import { gridMini } from './patterns.js';

export const GROOVES = {
  // Focus-house and chillstep: a soft pulse with a few displaced answers.
  // Keep the upper rhythm sparse, rather than filling every sixteenth.
  focus: [
    { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '.......x......x.' },
    { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '...x.......x....' },
    { kick: 'x...x...x.x.x...', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '......x.......x.' },
    { kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x.x.....x.', perc: '.......x......x.' },
    { kick: 'x......x..x.....', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '...x.......x....' },
    { kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '......x.......x.' },
  ],
  // Downtempo and future beats: kick on one, syncopation late in the bar.
  downtempo: [
    { kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '......x.......x.' },
    { kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.xxx.x.x.xxx.x.', perc: '...x.......x....' },
    { kick: 'x.........x..x..', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '......x..x......' },
    { kick: 'x..x......x.....', snare: '....x.......x...', hat: 'x.x.x.xxx.x.x.x.', perc: '.......x.....x..' },
    { kick: 'x.......x.x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.xx', perc: '..x.......x.....' },
    { kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', perc: '...x..x....x..x.' },
  ],
  // Four on the floor, offbeat hats.
  house: [
    { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', perc: 'x.xx.x.xx.x.x.xx' },
    { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...xx', perc: '...x..x....x..x.' },
    { kick: 'x...x...x...x..x', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '.x.x.x.x.x.x.x.x' },
  ],
  // UK garage two-step: kick on one and the "and" of three, skippy snares.
  garage: [
    { kick: 'x.........x.....', snare: '....x.......x...', hat: '..x.x.x...x.x.xx', perc: '.......x......x.' },
    { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x...x.x.x...x.', perc: '...x.......x....' },
    { kick: 'x.........x...x.', snare: '....x..x....x...', hat: '..x...x.x.x...x.', perc: '......x.......x.' },
  ],
  // Boom bap for lofi: lazy kicks, snare on two and four.
  boombap: [
    { kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '' },
    { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '' },
    { kick: 'x.....x...x..x..', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '' },
    { kick: 'x..x......x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', perc: '' },
    { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.xxx.', perc: '' },
  ],
  // Cafe chillhop: straight, unhurried eighths, a kick that answers the bass,
  // a ghost note or rim now and then.
  chillhop: [
    { kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '.......x.......x' },
    { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', perc: '..x.......x.....' },
    { kick: 'x.....x...x..x..', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '' },
    { kick: 'x..x......x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', perc: '......x.......x.' },
    { kick: 'x.......x.x...x.', snare: '....x.......x...', hat: 'x.xxx.x.x.xxx.x.', perc: '' },
  ],
  // Synthwave: straight rock and dance beats.
  wave: [
    { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '' },
    { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '' },
    { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', perc: '' },
    { kick: 'x......xx.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '' },
  ],
};

/** A groove's parts as mini-notation rhythms using "x" for hits. */
export function grooveMini(groove) {
  const out = {};
  for (const [part, grid] of Object.entries(groove)) out[part] = grid ? gridMini(grid, 'x') : null;
  return out;
}
