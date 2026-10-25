// Ambient: beatless rooms of slow chords over a tonic drone, with sparse
// bells, felt piano and wind. The stream's breathing space between grooves.
import { enterAfter, fall, leaveAfter, makeStyle, rise } from './common.js';

export const ambient = makeStyle({
  id: 'ambient',
  label: 'ambient',
  bpm: [60, 76],
  moods: ['ambient'],
  modes: ['lydian', 'aeolian', 'ionian', 'dorian'],
  energy: 1,
  tags: ['ambient', 'soft', 'airy'],
  presets: {
    sub: ['clean'],
    bass: ['soft', 'acoustic'],
    pad: ['ambient', 'soft', 'airy', 'moving'],
    pad2: ['airy', 'vocal', 'ambient'],
    keys: ['acoustic', 'ambient', 'soft'],
    lead: ['soft', 'organic', 'bright'],
    arp: ['organic', 'soft'],
    texture: ['ambient', 'airy'],
  },
  texture2: ['clean'],
  kitTags: ['ambient', 'focus'],
  levels: { sub: 1.35, bass: 0.3, kick: 0.6, snare: 0.3, hat: 0.15, openhat: 0.1, perc: 0.25, pad: 0.75, keys: 0.4, lead: 0.28, arp: 0.24, texture: 0.1 },
  // Dark and warm: the calm space between grooves should not be brighter than them.
  padSweep: false,
  padExtra: '.lpf(sine.slow(32).range(700, 1300))',
  keysExtra: '.lpf(1400)',
  leadExtra: '.lpf(1800)',
  arpExtra: '.lpf(1600)',
  groove: 'downtempo',
  duck: false,
  comps: ['x ~ ~ ~', 'x@3 ~', '~ x ~ ~'],
  arps: ['0 ~ 2 ~ 4 ~ 2 ~', '0 ~ ~ 4 ~ ~ 2 ~', '[0 4] ~ [2 6] ~'],
  pad2Scale: 0.8,
  subRhythms: [['pedal', 'hold'], ['hold', 'pedal']],
  bassRhythms: [['hold'], ['halves']],
  motifDensity: 0.4,
  plans: () => [
    ['intro', 8, 'A', 16, 'B', 16, 'C', 16, 'outro', 8],
    ['intro', 8, 'A', 24, 'B', 16, 'outro', 8],
  ],
  sections: (name, bars) => {
    switch (name) {
      case 'intro':
        return [`pad2(A).lpf(${rise(bars, 400, 1600)})`, 'air', 'air2'];
      case 'A':
        return ['pad(A)', 'pad2(A)', 'sub(subA).postgain(.7)', `keys(A)${enterAfter(bars / 2, bars)}`, 'air', 'air2'];
      case 'B':
        return ['pad(B)', 'pad2(B)', 'sub(subB).postgain(.7)', 'arp(B)', `lead(motifB)${enterAfter(bars / 2, bars)}`, 'air', 'air2'];
      case 'C':
        return ['pad(A)', 'pad2(A)', 'keys(A)', 'sub(subA).postgain(.7)', 'lead(motif)', 'arp(A).postgain(.6)', 'air', 'air2'];
      case 'outro':
        return [`pad(A).lpf(${fall(bars, 1400, 300)})`, 'pad2(A)', `sub(subA).postgain(.7)${leaveAfter(bars / 2, bars)}`, 'air', 'air2'];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
