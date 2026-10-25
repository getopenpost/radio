// Future garage: shuffled two-step drums, reese bass and a punchy sub, vowel
// pads that stand in for vocal chops, crackle and heavy reverb.
import { enterAfter, fall, leaveAfter, makeStyle, rise } from './common.js';

export const garage = makeStyle({
  id: 'garage',
  label: 'future garage',
  bpm: [128, 136],
  moods: ['dark', 'deep'],
  modes: ['aeolian', 'dorian', 'phrygian'],
  energy: 3,
  tags: ['garage', 'dark', 'vocal', 'synth', 'airy'],
  presets: {
    sub: ['punchy', 'warm'],
    bass: ['garage', 'dark'],
    pad: ['vocal', 'garage', 'airy', 'dark'],
    pad2: ['airy', 'vocal', 'ambient'],
    keys: ['synth', 'warm'],
    lead: ['vocal', 'soft'],
    arp: ['synth', 'soft'],
    texture: ['lofi', 'airy'],
  },
  texture2: ['airy', 'ambient'],
  kitTags: ['garage', 'focus'],
  levels: { sub: 1.4, bass: 0.42, kick: 1.05, snare: 0.45, hat: 0.26, openhat: 0.16, perc: 0.3, pad: 0.6, keys: 0.36, lead: 0.36, arp: 0.26, texture: 0.14 },
  groove: 'garage',
  swing: ['.swingBy(1/6, 8)', '.swingBy(1/5, 8)', '.swingBy(1/7, 8)'],
  duckDepth: [0.4, 0.6],
  comps: ['~ ~ [~ x] ~', '[~ x] ~ ~ ~', '~ [~ x@3] ~ ~'],
  subRhythms: [
    ['hold', 'holdPush', 'halves'],
    ['twoStep', 'syncopated', 'holdApproach'],
  ],
  bassRhythms: [
    ['hold', 'holdPush', 'halves'],
    ['twoStep', 'syncopated', 'dotted'],
  ],
  legatoBass: true,
  plans: (rng) => {
    const outro = rng.pick([8, 16]);
    return [
      ['intro', 16, 'A', 32, 'B', 32, 'break', 16, 'C', 32, 'outro', outro],
      ['intro', 16, 'A', 32, 'break', 16, 'B', 32, 'C', 32, 'outro', outro],
    ];
  },
  sections: (name, bars) => {
    switch (name) {
      case 'intro':
        return [`pad(A).lpf(${rise(bars)})`, 'pad2(A)', `sub(subA)${enterAfter(bars / 2, bars)}`, 'air', 'air2'];
      case 'A':
        return ['pad(A)', 'pad2(A)', 'sub(subA)', `bass(lineA)${enterAfter(8, bars)}`, 'drums', 'air', 'air2'];
      case 'B':
        return ['pad(B)', 'keys(B)', 'sub(subB)', 'bass(lineB)', 'drumsB', `lead(motifB)${enterAfter(8, bars)}`, 'air', 'air2'];
      case 'break':
        return ['pad(A).lpf(650)', 'pad2(A)', 'sub(subA)', 'lead(motif).postgain(.8)', `hats${enterAfter(bars / 2, bars)}`, 'air', 'air2'];
      case 'C':
        return ['pad(A)', 'pad2(A)', 'keys(A)', 'sub(subA2)', 'bass(lineA2)', 'drums', 'openhat', 'lead(motif)', 'arp(A).postgain(.5)', 'air', 'air2'];
      case 'outro':
        return [`pad(A).lpf(${fall(bars)})`, 'pad2(A)', `sub(subA)${leaveAfter(bars / 2, bars)}`, 'air', 'air2'];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
