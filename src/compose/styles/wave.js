// Night drive: slow synthwave and chillwave. Pumping eighth-note bass, wide
// polysynth pads, sixteenth arpeggios through a tempo delay, a big reverb
// snare and a singing lead.
import { enterAfter, fall, makeStyle, rise } from './common.js';

export const wave = makeStyle({
  id: 'wave',
  label: 'night drive',
  bpm: [84, 108],
  moods: ['wave'],
  modes: ['aeolian', 'dorian'],
  energy: 3,
  tags: ['wave', 'synth', 'wide'],
  presets: {
    sub: ['clean'],
    bass: ['wave', 'synth'],
    pad: ['wave', 'synth', 'wide'],
    pad2: ['wave', 'airy', 'synth'],
    keys: ['synth', 'wave'],
    lead: ['wave', 'synth'],
    arp: ['wave', 'synth'],
    texture: ['clean'],
  },
  kitTags: ['wave'],
  levels: { sub: 1.1, bass: 0.55, kick: 1.1, snare: 0.55, hat: 0.24, openhat: 0.18, perc: 0.25, pad: 0.6, keys: 0.36, lead: 0.4, arp: 0.34, texture: 0.1 },
  groove: 'wave',
  snareBus: 'hall',
  duckDepth: [0.3, 0.5],
  comps: ['x ~ ~ ~', '~ [~ x] ~ [~ x]', 'x ~ x ~'],
  arps: ['[0 2 4 2]*4', '[0 1 2 4 2 1]*2 [0 2]', '[0 2 4 6]*4', '[4 2 0 2]*4', '[0 4 2 4]*4'],
  padAnchors: ['a4', 'bb4', 'c5'],
  subRhythms: [
    ['hold', 'halves'],
    ['hold', 'holdPush'],
  ],
  bassRhythms: [
    ['pulse8', 'octPump', 'offbeat'],
    ['pulse8', 'octPump', 'rolling'],
  ],
  plans: (rng) => {
    const intro = rng.pick([8, 16]);
    return [
      ['intro', intro, 'A', 16, 'B', 32, 'break', 16, 'C', 32, 'outro', 8],
      ['intro', intro, 'A', 32, 'B', 16, 'break', 8, 'C', 32, 'outro', 16],
    ];
  },
  sections: (name, bars) => {
    switch (name) {
      case 'intro':
        return [`pad(A).lpf(${rise(bars)})`, `arp(A).lpf(${rise(bars, 400, 1800)})${enterAfter(bars / 2, bars)}`, 'air'];
      case 'A':
        return ['pad(A)', 'arp(A)', 'sub(subA)', 'bass(lineA)', 'drums', 'air'];
      case 'B':
        return ['pad(B)', 'pad2(B)', 'arp(B).postgain(.7)', 'sub(subB)', 'bass(lineB)', 'drumsB', `lead(motifB)${enterAfter(4, bars)}`, 'air'];
      case 'break':
        return ['pad(A)', 'pad2(A)', 'keys(A)', 'arp(A).lpf(900)', 'sub(subA)', 'air'];
      case 'C':
        return ['pad(A)', 'pad2(A)', 'arp(A)', 'sub(subA2)', 'bass(lineA2)', 'drums', 'openhat', 'lead(motif)', 'air'];
      case 'outro':
        return [`pad(A).lpf(${fall(bars)})`, `arp(A).lpf(${fall(bars, 1800, 400)})`, 'air'];
      default:
        throw new Error(`unknown section ${name}`);
    }
  },
});
