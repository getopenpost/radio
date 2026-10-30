// Drum grooves as step grids per bar ("x" hit, "." rest); 32 steps span two
// bars. The kick, clap and offbeat hat of the house families were identical in
// every reference song, so seeds differ only in the quiet detail around them.
export const GROOVES = {
  house: [
    { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', tick: 'xxxxxxxxxxxxxxxx', open: '..............x.', perc: '.......x.......x' },
    { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', tick: 'xxxxxxxxxxxxxxxx', open: '......x.......x.', perc: '...x.......x....' },
    { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x.x.x...x.', tick: 'xxxxxxxxxxxxxxxx', open: '..............x.', perc: '.......x..x.....' },
    { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x.x.x...x.x.x.', tick: 'x.xxx.xxx.xxx.xx', open: '..............x.', perc: '...x..x....x..x.' },
    { kick: 'x...x...x...x...', clap: '....x.......x..x', hat: '..x...x...x...x.', tick: 'x.xxx.xxx.xxx.xx', open: '......x.......x.', perc: '.....x.......x..' },
  ],
  // Two kicks a bar, the snare away from two and four, steady sixteenths.
  broken: [
    { kick: 'x.....x......x..', clap: '....x.......x...', hat: '..x...x...x...x.', tick: 'xxxxxxxxxxxxxxxx', open: '..............x.', perc: '...x.......x....' },
    { kick: 'x.....x.........x.........x.....', clap: '....x.......x.......x.......x...', hat: '..x...x...x...x.', tick: 'xxxxxxxxxxxxxxxx', open: '..............x.', perc: '.......x.......x' },
    { kick: 'x.......x.x.....', clap: '....x.......x...', hat: '..x...x...x...x.', tick: 'xxxxxxxxxxxxxxxx', open: '......x.........', perc: '...x..x.......x.' },
    { kick: 'x......xx....x..', clap: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', tick: 'x.xxx.xxx.xxx.xx', open: '..............x.', perc: '.....x.......x..' },
    { kick: 'x.........x.....', clap: '....x.......x...', hat: '..x...x...x...x.', tick: 'xxxxxxxxxxxxxxxx', open: '..............x.', perc: '.......x...x....' },
  ],
  // Soul beats: a doubled kick late in the bar, a backbeat, straight eighths.
  soul: [
    { kick: 'x.......x.x.....', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tick: '................', open: '................', perc: '...............x' },
    { kick: 'x.x.......x.....', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tick: '................', open: '................', perc: '.......x........' },
    { kick: 'x......xx.x.....', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tick: '.......x.......x', open: '................', perc: '................' },
    { kick: 'x.x...........x.', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tick: '................', open: '................', perc: '...x............' },
  ],
};
