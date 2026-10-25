// Focus: bass-led downtempo and future beats with chill-house and
// future-garage colour. A deep sustained sub, a groove with detail between
// the pulses, a wide overlapping harmonic bed and a dark top end.
import { enterAfter, fall, leaveAfter, makeStyle, rise } from './common.js';

export const focus = makeStyle({
  id: 'focus',
  label: 'deep focus',
  bpm: [86, 104],
  moods: ['dark', 'deep'],
  modes: ['aeolian', 'dorian', 'phrygian'],
  energy: 3,
  tags: ['focus', 'dark', 'deep', 'synth', 'wide', 'soft', 'airy', 'moving'],
  presets: {
    sub: ['clean', 'warm'],
    bass: ['synth', 'dark', 'garage'],
    pad2: ['soft', 'airy', 'ambient'],
    keys: ['jazzy', 'warm', 'synth'],
    lead: ['soft', 'bright', 'vocal', 'organic'],
    arp: ['synth', 'soft', 'organic'],
    texture: ['clean', 'airy'],
  },
  kitTags: ['focus'],
  levels: { sub: 1.5, bass: 0.5, kick: 0.95, snare: 0.42, hat: 0.24, openhat: 0.18, perc: 0.34, pad: 0.62, keys: 0.42, lead: 0.34, arp: 0.3, texture: 0.07 },
  groove: 'downtempo',
  swing: ['', '', '.swingBy(1/12, 8)', '.swingBy(1/8, 8)'],
  subRhythms: [
    ['hold', 'holdPush', 'holdApproach', 'halves', 'lazy'],
    ['holdApproach', 'dotted', 'syncopated', 'holdPush', 'twoStep'],
  ],
  bassRhythms: [
    ['dotted', 'dottedOct', 'syncopated', 'twoStep', 'rootFifth'],
    ['rolling', 'syncopated', 'dottedOct', 'offbeat', 'walkUp'],
  ],
  plans: (rng) => {
    const intro = rng.pick([8, 16]);
    const outro = rng.pick([8, 16]);
    return [
      ['intro', intro, 'A', 32, 'B', 32, 'break', 16, 'C', 32, 'outro', outro],
      ['intro', intro, 'A', 16, 'B', 32, 'break', 8, 'C', 32, 'D', 16, 'outro', outro],
      ['intro', intro, 'A', 32, 'break', 16, 'B', 32, 'C', 16, 'outro', outro],
      ['intro', intro, 'A', 16, 'A2', 16, 'B', 32, 'break', 16, 'C', 32, 'outro', outro],
    ];
  },
  sections: (name, bars, rng) => {
    switch (name) {
      case 'intro':
        return [`pad(A).lpf(${rise(bars)})`, 'pad2(A)', `sub(subA)${enterAfter(bars / 2, bars)}`, 'air'];
      case 'A':
        return ['pad(A)', 'pad2(A)', `keys(A)${enterAfter(8, bars)}`, 'sub(subA)', `bass(lineA)${enterAfter(4, bars)}`, 'drums', 'air'];
      case 'A2':
        return ['pad(A)', 'keys(A)', 'sub(subA2)', 'bass(lineA2)', 'drums', 'openhat', `lead(motif)${enterAfter(8, bars)}`, 'air'];
      case 'B':
        return ['pad(B)', 'keys(B)', 'sub(subB)', 'bass(lineB)', 'drumsB', `openhat${enterAfter(bars / 2, bars)}`, rng.chance(0.5) ? 'arp(B)' : `lead(motifB)${enterAfter(8, bars)}`, 'air'];
      case 'break':
        return ['pad(A).lpf(700)', 'pad2(A)', 'sub(subA)', `arp(A)${enterAfter(bars / 4, bars)}`, `hats${enterAfter(bars / 2, bars)}`, 'air'];
      case 'C':
        return ['pad(A)', 'pad2(A)', 'keys(A)', 'sub(subA2)', 'bass(lineA2)', 'drums', 'openhat', 'lead(motif)', 'arp(A).postgain(.6)', 'air'];
      case 'D':
        return ['pad(B)', 'sub(subB)', 'bass(lineB)', 'drumsB', 'arp(B)', 'air'];
      case 'outro':
        return [`pad(A).lpf(${fall(bars)})`, 'pad2(A)', `sub(subA)${leaveAfter(bars / 2, bars)}`, 'air'];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
