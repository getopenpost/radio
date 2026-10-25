// Lofi: jazzy chords on dusty keys, lazy swung boom-bap, upright or warm
// bass, vinyl and tape wobble. Short tracks, like a beat tape.
import { enterAfter, fall, makeStyle, rise } from './common.js';

export const lofi = makeStyle({
  id: 'lofi',
  label: 'lofi',
  bpm: [70, 88],
  moods: ['jazzy'],
  modes: ['ionian', 'dorian', 'aeolian'],
  energy: 2,
  tags: ['lofi', 'jazzy', 'warm', 'acoustic', 'soft', 'organic'],
  presets: {
    sub: ['warm', 'clean'],
    bass: ['acoustic', 'jazzy', 'lofi'],
    pad: ['soft', 'warm', 'jazzy'],
    pad2: ['soft', 'warm'],
    keys: ['lofi', 'jazzy', 'acoustic'],
    lead: ['jazzy', 'organic', 'soft'],
    arp: ['organic', 'soft'],
    texture: ['lofi'],
  },
  texture2: ['clean'],
  kitTags: ['lofi'],
  levels: { sub: 0.8, bass: 0.8, kick: 1.05, snare: 0.55, hat: 0.3, openhat: 0.15, perc: 0.22, pad: 0.32, keys: 0.72, lead: 0.4, arp: 0.28, texture: 0.22 },
  groove: 'boombap',
  swing: ['.swingBy(1/6, 8)', '.swingBy(1/5, 8)', '.swingBy(1/4, 8)'],
  duckDepth: [0.15, 0.3],
  drumExtra: '.lpf(4800)',
  // Tape wow: a slow, shallow vibrato on the keys and melody.
  keysExtra: '.vib(.5).vibmod(.05)',
  leadExtra: '.vib(.5).vibmod(.05)',
  comps: ['~ [~ x] ~ [~ x]', 'x ~ [~ x] ~', '[~ x] ~ ~ [~ x]', 'x@3 [~ x]', '~ [x@3 x] ~ x', '[x ~ ~ x] ~ [~ x] ~'],
  keysAnchors: ['c5', 'd5', 'e5'],
  padSweep: false,
  pad2Scale: 0.4,
  subRhythms: [
    ['hold', 'lazy', 'halves'],
    ['rootFifth', 'holdApproach', 'halves'],
  ],
  bassRhythms: [
    ['walkUp', 'rootFifth', 'lazy', 'dotted'],
    ['walkUp', 'syncopated', 'rootFifth', 'holdApproach'],
  ],
  bassLow: 36,
  motifDensity: 0.55,
  plans: (rng) => {
    const intro = rng.pick([4, 8]);
    return [
      ['intro', intro, 'A', 16, 'B', 16, 'break', 8, 'C', 16, 'outro', 8],
      ['intro', intro, 'A', 16, 'B', 16, 'C', 16, 'outro', 8],
      ['intro', intro, 'A', 8, 'B', 16, 'break', 8, 'C', 16, 'outro', 4],
    ];
  },
  sections: (name, bars, rng) => {
    switch (name) {
      case 'intro':
        return [`keys(A).lpf(${rise(bars, 600, 2400)})`, 'air', 'air2'];
      case 'A':
        return ['keys(A)', `bass(lineA)`, 'sub(subA).postgain(.6)', 'drums', 'air', 'air2'];
      case 'B':
        return ['keys(A)', 'bass(lineA2)', 'sub(subA2).postgain(.6)', 'drums', `lead(motif)${enterAfter(4, bars)}`, 'air', 'air2'];
      case 'break':
        return ['keys(B)', 'pad(B)', 'lead(motifB)', 'sub(subB).postgain(.5)', 'air', 'air2'];
      case 'C':
        return ['keys(B)', 'bass(lineB)', 'sub(subB).postgain(.6)', 'drumsB', rng.chance(0.5) ? 'arp(B).postgain(.7)' : 'lead(motifB).postgain(.8)', 'air', 'air2'];
      case 'outro':
        return [`keys(A).lpf(${fall(bars, 2400, 600)})`, 'air', 'air2'];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
