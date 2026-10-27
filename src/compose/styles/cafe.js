// Cafe: warm coffee-shop chillhop with soul and jazz-funk colour. Clean jazz
// guitar comping over Rhodes, a plucked finger bass with air between the
// notes (no held sub), soft straight-eighth drums, a guitar, trumpet or
// vibes melody, and a dark, clean, wide mix with no noise bed. Tuned against
// a cafe reference mix: 80-95 bpm, mostly major keys, almost nothing above
// 3 kHz, a bass floor far below the peaks.
import { enterAfter, fall, leaveAfter, makeStyle, rise } from './common.js';

export const cafe = makeStyle({
  id: 'cafe',
  label: 'cafe',
  bpm: [76, 88],
  moods: ['cafe'],
  modes: ['ionian', 'dorian', 'aeolian'],
  energy: 2,
  tags: ['cafe', 'jazzy', 'warm', 'funky', 'soft'],
  presets: {
    sub: ['sub.sine'],
    bass: ['bass.finger', 'bass.pick', 'bass.fretless'],
    pad: ['pad.rhodes', 'pad.wurli'],
    pad2: ['pad.rhodes', 'pad.wurli', 'pad.warm'],
    keys: ['keys.jazz-guitar', 'keys.clean-guitar', 'keys.muted-guitar'],
    lead: ['lead.jazz-guitar', 'lead.rhodes', 'lead.vibes'],
    arp: ['arp.guitar', 'arp.harp', 'arp.kalimba'],
  },
  texture: false,
  kitTags: ['cafe'],
  levels: { sub: 0.8, bass: 0.85, kick: 0.92, snare: 0.42, hat: 0.2, openhat: 0.12, perc: 0.2, pad: 0.55, keys: 0.75, lead: 0.36, arp: 0.3 },
  groove: 'chillhop',
  // A lazy sixteenth feel rather than a shuffle.
  swing: ['.swingBy(1/16, 16)', '.swingBy(1/12, 16)', '.swingBy(1/10, 16)'],
  duckDepth: [0.1, 0.2],
  drumExtra: '.lpf(3400)',
  // Tape wow on everything that holds a pitch, and a dark top end.
  keysExtra: '.lpf(2600)',
  keysWide: true, // the guitar keeps its doubled spread instead of sitting at one pan
  padExtra: '.lpf(1600)',
  leadExtra: '.lpf(1600).vib(.45).vibmod(.05)',
  arpExtra: '.lpf(1800)',
  // The guitar picks broken chords and double stops (indices into the
  // voicing) rather than strumming blocks: struck together, the soundfont
  // guitars read as an electric piano.
  picks: ['0 2 1 3 2 4 3 1', '[0 ~] 2 [1 3] ~ [0 ~] 2 [3 4] 2', '0 [~ 2] [1 ~] 3 0 [~ 2] [4 ~] 3', '[0,2] ~ [1 3] ~ [0,2] ~ 4 [3 1]', '0 2 4 ~ 1 3 ~ 2', '[0 1] [2 ~] [3 2] ~ [0 1] [2 4] ~ 3'],
  keysAnchors: ['d4', 'e4', 'g4'],
  padSweep: false,
  pad2Scale: 0.5,
  subRhythms: [['halves'], ['halves']],
  bassRhythms: [
    ['pocket', 'funk', 'soul', 'syncopated'],
    ['strut', 'funk', 'soul', 'walkUp'],
  ],
  bassLow: 36,
  motifRange: [62, 79],
  motifDensity: 0.5,
  plans: (rng) => {
    const intro = rng.pick([4, 8]);
    return [
      ['intro', intro, 'A', 16, 'B', 16, 'break', 8, 'C', 16, 'outro', 8],
      ['intro', intro, 'A', 8, 'A2', 16, 'B', 16, 'break', 8, 'C', 16, 'outro', 8],
      ['intro', intro, 'A', 16, 'B', 16, 'C', 16, 'A2', 8, 'outro', 8],
    ];
  },
  sections: (name, bars, rng) => {
    switch (name) {
      case 'intro':
        return [`pad(A).lpf(${rise(bars, 500, 1700)})`, `keys(A).postgain(.7)${enterAfter(bars / 2, bars)}`];
      case 'A':
        return ['keys(A)', 'pad(A).postgain(.8)', 'bass(lineA)', 'drums'];
      case 'A2':
        return ['keys(A)', 'bass(lineA2)', 'drums', `lead(motif)${enterAfter(4, bars)}`];
      case 'B':
        return ['keys(A)', 'pad(A).postgain(.85)', 'bass(lineA2)', 'drums', `lead(motif)${enterAfter(4, bars)}`];
      case 'break':
        return ['pad(B)', 'lead(motifB)', 'bass(lineB).postgain(.7)', `hats${enterAfter(bars / 2, bars)}`];
      case 'C':
        return ['keys(B)', 'pad(B).postgain(.8)', 'bass(lineB)', 'drumsB', rng.chance(0.5) ? 'arp(B).postgain(.8)' : 'lead(motifB)'];
      case 'outro':
        return [`pad(A).lpf(${fall(bars, 1700, 400)})`, `keys(A).postgain(.7)${leaveAfter(bars / 2, bars)}`];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
