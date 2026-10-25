// Chill house: soft four-on-the-floor, offbeat hats, deep chord stabs and
// rolling bass under warm pads. Intros and outros stay beatless so the
// stream can crossfade from any tempo.
import { enterAfter, fall, leaveAfter, makeStyle, rise } from './common.js';

export const house = makeStyle({
  id: 'house',
  label: 'chill house',
  bpm: [112, 122],
  moods: ['house', 'deep'],
  modes: ['dorian', 'aeolian', 'ionian'],
  energy: 4,
  tags: ['house', 'warm', 'synth', 'deep', 'soft'],
  presets: {
    sub: ['clean', 'warm'],
    bass: ['synth', 'funky', 'soft'],
    pad: ['soft', 'warm', 'vocal', 'synth'],
    pad2: ['airy', 'vocal'],
    keys: ['house', 'synth', 'jazzy'],
    lead: ['vocal', 'soft', 'bright'],
    arp: ['synth', 'organic'],
    texture: ['clean', 'airy'],
  },
  kitTags: ['house'],
  levels: { sub: 1.3, bass: 0.55, kick: 1.15, snare: 0.4, hat: 0.3, openhat: 0.26, perc: 0.3, pad: 0.5, keys: 0.5, lead: 0.32, arp: 0.28, texture: 0.12 },
  groove: 'house',
  swing: ['', '.swingBy(1/12, 8)'],
  duckDepth: [0.45, 0.65],
  comps: ['~ [~ x] ~ [~ x]', '[~ x]*4', '~ x ~ x', '[~ x] ~ [x ~] ~', '~ [~ x] [~ x] ~'],
  openhat: '[~ x]*4',
  subRhythms: [
    ['hold', 'holdPush', 'halves'],
    ['holdApproach', 'halves', 'holdPush'],
  ],
  bassRhythms: [
    ['offbeat', 'rolling', 'pulse8'],
    ['syncopated', 'offbeat', 'octPump'],
  ],
  plans: (rng) => [
    ['intro', 8, 'A', 32, 'B', 32, 'break', 16, 'C', 32, 'outro', 8],
    ['intro', 8, 'A', 16, 'A2', 16, 'B', 32, 'break', 16, 'C', 32, 'outro', 8],
    ['intro', rng.pick([8, 16]), 'A', 32, 'break', 16, 'B', 32, 'C', 16, 'outro', 8],
  ],
  sections: (name, bars, rng) => {
    switch (name) {
      case 'intro':
        return [`pad(A).lpf(${rise(bars)})`, 'pad2(A)', `sub(subA)${enterAfter(bars / 2, bars)}`, 'air'];
      case 'A':
        return ['pad(A)', `keys(A)${enterAfter(8, bars)}`, 'sub(subA)', 'bass(lineA)', 'drums', 'openhat', 'air'];
      case 'A2':
        return ['pad(A)', 'keys(A)', 'sub(subA2)', 'bass(lineA2)', 'drums', 'openhat', 'lead(motif)', 'air'];
      case 'B':
        return ['pad(B)', 'pad2(B)', 'keys(B)', 'sub(subB)', 'bass(lineB)', 'drumsB', 'openhat', rng.chance(0.5) ? 'arp(B)' : 'lead(motifB)', 'air'];
      case 'break':
        return ['pad(A).lpf(800)', 'pad2(A)', 'keys(A).lpf(1200)', 'sub(subA)', `hats${enterAfter(bars / 2, bars)}`, 'air'];
      case 'C':
        return ['pad(A)', 'pad2(A)', 'keys(A)', 'sub(subA2)', 'bass(lineA2)', 'drums', 'openhat', 'lead(motif)', 'arp(A).postgain(.6)', 'air'];
      case 'outro':
        return [`pad(A).lpf(${fall(bars)})`, 'pad2(A)', `sub(subA)${leaveAfter(bars / 2, bars)}`, 'air'];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
