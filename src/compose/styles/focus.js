// Focus: bass-led downtempo and future beats with chill-house and
// future-garage colour. Deep sustained sub, a groove with detail between the
// pulses, a filled-in wide harmonic bed, dark top end.
import { bassLine, BASS_RHYTHMS, gridMini, motif } from '../patterns.js';
import { chordsPerBar, progressionMini } from '../theory.js';
import { num } from '../mini.js';

export const focus = {
  id: 'focus',
  label: 'deep focus',
  bpm: [86, 102],
  moods: ['dark', 'deep'],
  modes: ['aeolian', 'dorian', 'phrygian'],
  energy: 3,
  compose,
};

const KICKS = [
  { sound: 'bd', mods: '.bank("RolandTR909").n(1).lpf(2400)', gain: 0.95 },
  { sound: 'bd', mods: '.bank("LinnDrum").lpf(3000)', gain: 0.9 },
  { sound: 'bd', mods: '.bank("RolandTR808").n(3).decay(.45).lpf(2000)', gain: 0.8 },
  { sound: 'bd', mods: '.bank("AkaiXR10").n(2).lpf(2600)', gain: 0.9 },
  { sound: 'bd', mods: '.bank("EmuSP12").n(4).lpf(2600)', gain: 0.9 },
];
const SNARES = [
  { sound: 'cp', mods: '.bank("RolandTR909").n(2).hpf(400).lpf(5000)', gain: 0.32 },
  { sound: 'rim', mods: '.bank("RolandTR808").hpf(300).lpf(6000)', gain: 0.3 },
  { sound: 'sd', mods: '.bank("LinnDrum").n(1).hpf(250).lpf(4500)', gain: 0.3 },
  { sound: 'cp', mods: '.bank("KorgM1").hpf(500).lpf(5000)', gain: 0.28 },
  { sound: 'sd', mods: '.bank("EmuSP12").n(9).hpf(300).lpf(4000)', gain: 0.32 },
];
const HATS = [
  { sound: 'hh', mods: '.bank("RolandTR909").n(2)', gain: 0.1 },
  { sound: 'hh', mods: '.bank("LinnDrum")', gain: 0.12 },
  { sound: 'sh', mods: '.bank("RolandTR808")', gain: 0.14 },
  { sound: 'shaker_small', mods: '', gain: 0.12 },
  { sound: 'hh', mods: '.bank("AkaiXR10")', gain: 0.1 },
];
const KICK_GRIDS = ['x.........x.....', 'x.....x...x.....', 'x.........x..x..', 'x..x......x.....', 'x.......x.x.....'];
const SNARE_GRIDS = ['....x.......x...', '....x.......x..x', '........x.......'];
const HAT_GRIDS = ['x.x.x.x.x.x.x.x.', 'x.xxx.x.x.xxx.x.', '..x...x...x...x.', 'x.x.x.xxx.x.x.x.'];
// Low percussion that keeps the low end moving between kicks.
const LOW_PERC = [
  { sound: 'lt', mods: '.bank("LinnDrum")', gain: 0.22 },
  { sound: 'conga', mods: '.n(1)', gain: 0.22 },
  { sound: 'lt', mods: '.bank("RolandTR909").n(3)', gain: 0.18 },
  { sound: 'tom_mallet', mods: '.n(1)', gain: 0.22 },
];
const LOW_PERC_GRIDS = ['......x.......x.', '...x.......x....', '......x..x......', '.......x.....x..'];

// Pad builders return Strudel code for a function of the chord pattern `c`.
const PADS = [
  (rng) => ({
    name: 'saw stack',
    code: `c.anchor("${rng.pick(['g4', 'a4', 'c5'])}").voicing().s("sawtooth").attack(1.2).decay(1).sustain(.8).release(3)
    .layer(x => x.pan(.15), x => x.add(note(.12)).pan(.85))
    .lpf(${rng.int(7, 12) * 100}).lpq(1)`,
    gain: 0.14,
  }),
  (rng) => ({
    name: 'supersaw',
    code: `c.anchor("${rng.pick(['g4', 'a4', 'bb4'])}").voicing().s("supersaw").detune(${num(rng.float(0.15, 0.3), 2)}).unison(5).spread(1)
    .attack(1).decay(1).sustain(.8).release(3).lpf(${rng.int(6, 10) * 100})`,
    gain: 0.22,
  }),
  (rng) => {
    const name = rng.pick(['gm_pad_warm', 'gm_pad_halo', 'gm_pad_new_age', 'gm_pad_sweep']);
    return {
      name,
      code: `c.anchor("a4").voicing().s("${name}").attack(1).release(3).lpf(1600)
    .layer(x => x.pan(.2), x => x.add(note(.08)).pan(.8))`,
      gain: 0.5,
    };
  },
];
const SOFT_PADS = ['gm_pad_warm', 'gm_pad_halo', 'gm_pad_new_age', 'gm_pad_choir', 'gm_synth_strings_1'];

const KEYS = [
  { name: 'rhodes', code: 's("gm_epiano1:1").phaser(.5).phaserdepth(.4).lpf(2200)', gain: 0.32 },
  { name: 'rhodes2', code: 's("gm_epiano2").lpf(1800)', gain: 0.32 },
  { name: 'fm keys', code: 's("sine").fm(1.6).fmh(1).fmdecay(.35).fmsustain(.15).decay(.9).sustain(.2).release(.6).lpf(2400)', gain: 0.32 },
];
const COMPS = ['~ [~ x] ~ ~', '[~ x] ~ [~ x] ~', '~ ~ [~ x] ~', 'x ~ ~ [~ x]', '~ [~ x@3] ~ [~ x]'];

const LEADS = [
  { name: 'bell', code: 's("triangle").fm(2.5).fmh(3.01).fmdecay(.4).fmsustain(0).decay(.8).sustain(0).release(.4).lpf(3200)', gain: 0.3 },
  { name: 'vibes', code: 's("vibraphone_soft").lpf(3000)', gain: 0.35 },
  { name: 'kalimba', code: 's("kalimba").lpf(3500)', gain: 0.3 },
  { name: 'voice', code: 's("gm_voice_oohs").lpf(2400).attack(.08).release(.8)', gain: 0.35 },
  { name: 'glass pluck', code: 's("sine").fm(4).fmh(2).fmdecay(.12).fmsustain(0).decay(.5).sustain(0).lpf(2600)', gain: 0.3 },
];

function sections(rng) {
  const intro = rng.pick([8, 16]);
  const outro = rng.pick([8, 16]);
  const plans = [
    [['intro', intro], ['A', 32], ['B', 32], ['break', 16], ['C', 32], ['outro', outro]],
    [['intro', intro], ['A', 16], ['B', 32], ['break', 8], ['C', 32], ['D', 16], ['outro', outro]],
    [['intro', intro], ['A', 32], ['break', 16], ['B', 32], ['C', 16], ['outro', outro]],
  ];
  return rng.pick(plans);
}

function compose({ rng, key, bpm, progressions }) {
  const [progA, progB] = progressions;
  const chordsA = chordsPerBar(key, progA);
  const chordsB = chordsPerBar(key, progB);

  const kick = rng.pick(KICKS);
  const snare = rng.pick(SNARES);
  const hat = rng.pick(HATS);
  const lowPerc = rng.pick(LOW_PERC);
  const pad = rng.pick(PADS)(rng);
  const pad2 = rng.chance(0.6) ? rng.pick(SOFT_PADS) : null;
  const keys = rng.chance(0.65) ? rng.pick(KEYS) : null;
  const lead = rng.pick(LEADS);

  const subRhythmA = rng.pick(['hold', 'holdPush', 'holdApproach', 'halves', 'lazy']);
  const subRhythmB = rng.pick(['holdApproach', 'dotted', 'syncopated', 'holdPush', 'twoStep']);
  const bassRhythmA = rng.pick(['dotted', 'dottedOct', 'syncopated', 'twoStep', 'rootFifth']);
  const bassRhythmB = rng.pick(['rolling', 'syncopated', 'dottedOct', 'offbeat', 'walkUp']);
  const subLow = 28; // sub roots between E1 and Eb2 (41-78 Hz)
  const sub = (chords, rhythm) => bassLine(chords, BASS_RHYTHMS[rhythm], { low: subLow, key, legato: true });
  const bassLow = subLow + 12;
  const bass = (chords, rhythm) => bassLine(chords, BASS_RHYTHMS[rhythm], { low: bassLow, key });
  const kit = (k, grid) => `s("${gridMini(grid, k.sound)}")${k.mods}`;

  const kickGrid = rng.pick(KICK_GRIDS);
  const kickGridB = rng.pick(KICK_GRIDS);
  const snareGrid = rng.pick(SNARE_GRIDS);
  const hatGrid = rng.pick(HAT_GRIDS);
  const lowPercGrid = rng.pick(LOW_PERC_GRIDS);
  const swing = rng.pick([0, 1 / 12, 1 / 8]);
  const comp = rng.pick(COMPS);
  const arpShape = rng.pick(['[0 2 4 6]*2', '0 2 4 2 6 4 2 4', '[0 4 2 6]*2', '0 ~ 2 4 ~ 6 4 2']);
  const melody = motif(rng, key, [...chordsA, ...chordsA], { lo: 64, hi: 81, phrase: rng.pick(['AABA', 'ABAC', 'AAAB']) });
  const plan = sections(rng);

  const padDuck = num(rng.float(0.35, 0.6), 2);
  const room = { harmony: num(rng.float(0.5, 0.8), 2), size: num(rng.float(4, 7), 1) };
  const swingCode = swing ? `.swingBy(${num(swing, 4)}, 8)` : '';

  const code = `setcps(${bpm}/60/4)

// Harmony: A carries most of the track, B colours the second half.
const A = chord("${progressionMini(key, progA)}")
const B = chord("${progressionMini(key, progB)}")

// Bass: a sustained sine sub plus a moving low-register line.
const subA = note("${sub(chordsA, subRhythmA)}")
const subA2 = note("${sub(chordsA, subRhythmB)}")
const subB = note("${sub(chordsB, subRhythmB)}")
const bassA = note("${bass(chordsA, bassRhythmA)}")
const bassA2 = note("${bass(chordsA, bassRhythmB)}")
const bassB = note("${bass(chordsB, bassRhythmB)}")
const sub = n => n.s("sine").attack(.02).decay(.3).sustain(.9).release(.25).gain(1)
  .superimpose(x => x.add(note(12)).s("triangle").lpf(300).gain(.18))
  .orbit(3)
const bass = n => n.s("sawtooth").attack(.005).decay(.25).sustain(.35).release(.12)
  .lpf(${rng.int(28, 42) * 10}).lpenv(${num(rng.float(1.5, 3), 1)}).lpdecay(.18).lpq(${num(rng.float(2, 6), 1)})
  .layer(x => x.pan(.4), x => x.add(note(.1)).pan(.6)).gain(.16).orbit(3)

// Harmony layers: wide, slow, overlapping so the bed never empties out.
const pad = c => ${pad.code}
  .room(${room.harmony}).roomsize(${room.size}).roomlp(3500).roomdim(700).gain(${pad.gain}).orbit(2)
${pad2 && pad2 !== pad.name ? `const pad2 = c => c.anchor("e4").voicing().s("${pad2}").attack(1.5).release(4).lpf(1200)
  .pan(sine.slow(16).range(.25, .75)).room(${room.harmony}).roomsize(${room.size}).roomlp(3500).roomdim(700).gain(.35).orbit(2)` : 'const pad2 = c => silence'}
${keys ? `const keys = c => c.struct("${comp}").anchor("c5").voicing().${keys.code}
  .room(${room.harmony}).roomsize(${room.size}).roomlp(3500).roomdim(700).gain(${keys.gain}).pan(.4).orbit(2)` : 'const keys = c => silence'}
const arp = c => c.n("${arpShape}").anchor("${rng.pick(['c5', 'd5', 'e5'])}").voicing()
  .s("triangle").decay(.18).sustain(0).lpf(sine.slow(32).range(900, 2400)).lpq(4)
  .pan(sine.slow(8).range(.2, .8)).delay(.4).delaysync(3/16).delayfeedback(.45)
  .room(.5).roomsize(4).roomlp(4000).roomdim(900).gain(.14).orbit(4)
const lead = note("${melody}")
  .${lead.code}.pan(perlin.slow(4).range(.3, .7))
  .delay(.35).delaysync(3/16).delayfeedback(.4).room(.5).roomsize(4).roomlp(4000).roomdim(900).gain(${lead.gain}).orbit(4)

// Drums: soft, dark, with detail between the main pulses.
const kick = ${kit(kick, kickGrid)}.gain(${kick.gain})
  .duckorbit("2:3").duckdepth("${padDuck}:0.25").duckattack("0.3:0.18").orbit(1)
const kickB = ${kit(kick, kickGridB)}.gain(${kick.gain})
  .duckorbit("2:3").duckdepth("${padDuck}:0.25").duckattack("0.3:0.18").orbit(1)
const snare = ${kit(snare, snareGrid)}.gain(${snare.gain})
  .room(.3).roomsize(1.5).roomlp(5000).roomdim(1200).orbit(1)
const hats = ${kit(hat, hatGrid)}.hpf(6500)
  .gain(perlin.range(${num(hat.gain * 0.6)}, ${num(hat.gain)}))${swingCode}.pan(.62)
  .room(.3).roomsize(1.5).roomlp(5000).roomdim(1200).orbit(1)
const lowPerc = ${kit(lowPerc, lowPercGrid)}.lpf(1800)
  .gain(${lowPerc.gain})${swingCode}.pan(.38).room(.3).roomsize(1.5).roomlp(5000).roomdim(1200).orbit(1)
const air = s("pink").slow(8).attack(4).release(4).hpf(2500).lpf(7000)
  .pan(sine.slow(24).range(.2, .8)).gain(.012).orbit(4)

const drums = k => stack(k, snare, hats, lowPerc).lastOf(8, x => x.mask("1 1 1 [1 0]"))

arrange(
${plan.map(([name, bars]) => `  [${bars}, ${sectionStack(name, rng)}], // ${name}`).join('\n')}
)
`;

  return {
    code,
    sections: plan,
    instruments: [pad.name, pad2, keys?.name, lead.name].filter(Boolean),
    introBars: plan[0][1],
    outroBars: plan.at(-1)[1],
  };
}

function sectionStack(name, rng) {
  switch (name) {
    case 'intro':
      return 'stack(pad(A).lpf(saw.slow(16).range(300, 1000)), pad2(A), sub(subA).mask("<0@4 1@12>"), air)';
    case 'A':
      return 'stack(pad(A), pad2(A), keys(A).mask("<0@8 1@24>"), sub(subA), bass(bassA).mask("<0@4 1@28>"), drums(kick), air)';
    case 'B':
      return `stack(pad(B), keys(B), sub(subB), bass(bassB), drums(kickB), ${rng.chance(0.5) ? 'arp(B)' : 'lead.mask("<0@8 1@24>")'}, air)`;
    case 'break':
      return 'stack(pad(A).lpf(700), pad2(A), sub(subA), arp(A).mask("<0@4 1@12>"), hats.mask("<0@8 1@8>"), air)';
    case 'C':
      return 'stack(pad(A), pad2(A), keys(A), sub(subA2), bass(bassA2), drums(kick), lead, arp(A).gain(.1), air)';
    case 'D':
      return 'stack(pad(B), sub(subB), bass(bassB), drums(kickB), arp(B), air)';
    case 'outro':
      return 'stack(pad(A).lpf(saw.slow(16).range(1000, 300)), pad2(A), sub(subA).mask("<1@8 0@8>"), air)';
    default:
      throw new Error(`unknown section ${name}`);
  }
}
