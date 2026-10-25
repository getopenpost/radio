// Shared composition engine. A style is a config: which instruments it
// favours, how loud each role sits, its groove family, bass and comping
// vocabulary, arrangement plans and what plays in each section. The engine
// turns that plus a seed into Strudel code.
import { createBuilder, duck } from '../builder.js';
import { GROOVES, grooveMini } from '../grooves.js';
import { pickKit, pickPreset } from '../instruments.js';
import { bassLine, BASS_RHYTHMS, motif } from '../patterns.js';
import { chordsPerBar, progressionMini } from '../theory.js';

export const DEFAULT_ARPS = ['[0 2 4 6]*2', '0 2 4 2 6 4 2 4', '[0 4 2 6]*2', '0 ~ 2 4 ~ 6 4 2', '[0 2 4]*2 [6 4]', '0 4 7 4 2 4 6 4'];
export const DEFAULT_COMPS = ['~ [~ x] ~ ~', '[~ x] ~ [~ x] ~', '~ ~ [~ x] ~', 'x ~ ~ [~ x]', '~ [~ x@3] ~ [~ x]', '[~ x] [~ x] ~ ~'];

/** Expand ['intro', 8, 'A', 32, ...] into [{ name, bars }]. */
export const sectionsOf = (flat) => flat.reduce((out, x, i) => (i % 2 ? out : [...out, { name: x, bars: flat[i + 1] }]), []);

export function makeStyle(config) {
  return {
    id: config.id,
    label: config.label,
    bpm: config.bpm,
    moods: config.moods,
    modes: config.modes,
    energy: config.energy,
    compose: (ctx) => compose(config, ctx),
  };
}

function compose(config, { rng, key, bpm, progressions }) {
  const [progA, progB] = progressions;
  const chordsA = chordsPerBar(key, progA);
  const chordsB = chordsPerBar(key, progB);
  const b = createBuilder({ rng, levels: config.levels });
  const tags = config.tags;
  const role = (name) => config.presets?.[name] ?? tags;

  const pick = {
    sub: pickPreset(rng, 'sub', role('sub')),
    bass: pickPreset(rng, 'bass', role('bass')),
    pad: pickPreset(rng, 'pad', role('pad')),
    keys: pickPreset(rng, 'keys', role('keys')),
    lead: pickPreset(rng, 'lead', role('lead')),
    arp: pickPreset(rng, 'arp', role('arp')),
    texture: pickPreset(rng, 'texture', role('texture')),
  };
  pick.pad2 = pickPreset(rng, 'pad', role('pad2'), [pick.pad.id]);
  const kitTags = config.kitTags ?? tags;
  const kits = Object.fromEntries(['kick', 'snare', 'hat', 'openhat', 'perc'].map((part) => [part, pickKit(rng, part, kitTags)]));
  const grooves = GROOVES[config.groove];
  const grooveA = grooveMini(rng.pick(grooves));
  const grooveB = grooveMini(rng.pick(grooves));
  const swing = rng.pick(config.swing ?? ['']);

  const subLow = config.subLow ?? 26; // sub roots between D1 and Db2 (37-69 Hz)
  const bassLow = config.bassLow ?? 40;
  const sub = (chords, rhythm) => bassLine(chords, BASS_RHYTHMS[rhythm], { low: subLow, key, legato: true });
  const line = (chords, rhythm) => bassLine(chords, BASS_RHYTHMS[rhythm], { low: bassLow, key, legato: config.legatoBass });
  const rh = {
    subA: rng.pick(config.subRhythms[0]),
    subB: rng.pick(config.subRhythms[1]),
    bassA: rng.pick(config.bassRhythms[0]),
    bassB: rng.pick(config.bassRhythms[1]),
  };

  b.def('A', `chord("${progressionMini(key, progA)}")`);
  b.def('B', `chord("${progressionMini(key, progB)}")`);

  b.comment('Bass: a sustained sub plus a moving low-register line.');
  b.def('subA', `note("${sub(chordsA, rh.subA)}")`);
  b.def('subA2', `note("${sub(chordsA, rh.subB)}")`);
  b.def('subB', `note("${sub(chordsB, rh.subB)}")`);
  b.def('lineA', `note("${line(chordsA, rh.bassA)}")`);
  b.def('lineA2', `note("${line(chordsA, rh.bassB)}")`);
  b.def('lineB', `note("${line(chordsB, rh.bassB)}")`);
  b.notes('sub', pick.sub);
  // Spread the bass line a little; the sub stays mono.
  const bassWidth = pick.bass.chain(rng).includes('.layer(') ? '' : '.layer(x => x.pan(.32), x => x.add(note(.07)).pan(.68))';
  b.notes('bass', pick.bass, { extra: `.hpf(55)${bassWidth}${config.bassExtra ?? ''}` });

  b.comment('Harmony.');
  const padTop = rng.pick(config.padAnchors ?? ['g4', 'a4', 'bb4', 'c5']);
  const padSweep = `.lpf(sine.slow(16).range(${rng.int(6, 9) * 100}, ${rng.int(12, 18) * 100}))`;
  b.chords('pad', pick.pad, { anchor: padTop, extra: `.hpf(${rng.int(22, 30) * 10})${config.padSweep === false ? '' : padSweep}${config.padExtra ?? ''}` });
  b.chords('pad2', pick.pad2, { anchor: 'e4', extra: '.hpf(260).pan(sine.slow(16).range(.3, .7))', scale: config.pad2Scale ?? 0.6 });
  b.chords('keys', pick.keys, { anchor: rng.pick(config.keysAnchors ?? ['c5']), struct: rng.pick(config.comps ?? DEFAULT_COMPS), extra: `.hpf(200).pan(.42)${config.keysExtra ?? ''}${swing}` });

  b.comment('Melody: a sparse motif and an arpeggio, both through the delay.');
  const [lo, hi] = config.motifRange ?? [64, 81];
  const phrase = rng.pick(['AABA', 'ABAC', 'AAAB', 'ABAB']);
  b.def('motif', `note("${motif(rng, key, [...chordsA, ...chordsA], { lo, hi, phrase, density: config.motifDensity ?? 0.7 })}")`);
  b.def('motifB', `note("${motif(rng, key, [...chordsB, ...chordsB], { lo, hi, phrase, density: config.motifDensity ?? 0.7 })}")`);
  b.notes('lead', pick.lead, { extra: `.pan(perlin.slow(4).range(.3, .7))${config.leadExtra ?? ''}` });
  b.arp('arp', pick.arp, {
    shape: rng.pick(config.arps ?? DEFAULT_ARPS),
    anchor: rng.pick(['c5', 'd5', 'e5']),
    extra: `.lpf(sine.slow(32).range(${rng.int(8, 12) * 100}, ${rng.int(22, 32) * 100})).pan(sine.slow(8).range(.2, .8))${config.arpExtra ?? ''}`,
  });

  b.comment('Drums.');
  const kickDuck = config.duck === false ? '' : duck(rng, config.duckDepth ? rng.step(...config.duckDepth, 0.05) : undefined);
  const drumExtra = config.drumExtra ?? '';
  b.drum('kick', kits.kick, grooveA.kick, { role: 'kick', extra: kickDuck + drumExtra, humanize: 0 });
  b.drum('kickB', kits.kick, grooveB.kick, { role: 'kick', extra: kickDuck + drumExtra, humanize: 0 });
  b.drum('snare', kits.snare, grooveA.snare, { role: 'snare', extra: drumExtra + (config.snareExtra ?? ''), on: config.snareBus ?? 'drums' });
  b.drum('snareB', kits.snare, grooveB.snare, { role: 'snare', extra: drumExtra + (config.snareExtra ?? ''), on: config.snareBus ?? 'drums' });
  b.drum('hats', kits.hat, grooveA.hat, { role: 'hat', extra: `.hpf(6000).pan(.6)${swing}${drumExtra}` });
  b.drum('hatsB', kits.hat, grooveB.hat, { role: 'hat', extra: `.hpf(6000).pan(.6)${swing}${drumExtra}` });
  b.drum('openhat', kits.openhat, config.openhat ?? '[~ x]*4', { role: 'openhat', extra: `.hpf(5000).decay(.12).pan(.66)${drumExtra}`, scale: 0.8 });
  b.drum('perc', kits.perc, grooveA.perc ?? '~', { role: 'perc', extra: `.pan(.38)${swing}${drumExtra}` });
  b.drum('fill', kits.perc, '[~ ~ ~ [x x x x]]', { role: 'perc', extra: `.pan(sine.range(.3, .7)).mask("<0!7 1>")${drumExtra}`, scale: 0.8 });
  b.def('drums', 'stack(kick, snare, hats, perc, fill).lastOf(8, x => x.mask("1 1 1 [1 0]"))');
  b.def('drumsB', 'stack(kickB, snareB, hatsB, perc, fill).lastOf(8, x => x.mask("1 1 1 [1 0]"))');
  b.texture('air', pick.texture);
  if (config.texture2) b.texture('air2', pickPreset(rng, 'texture', config.texture2, [pick.texture.id]), { scale: 0.8 });
  config.extraLayers?.(b, { rng, key, chordsA, chordsB, kits });

  const plan = sectionsOf(rng.pick(config.plans(rng)));
  const sections = plan.map(({ name, bars }) => ({ name, bars, stack: config.sections(name, bars, rng) }));
  return {
    code: `setcps(${bpm}/60/4)\n${b.code(sections)}`,
    sections: sections.map(({ name, bars }) => [name, bars]),
    instruments: Object.fromEntries([...Object.entries(pick).map(([k, v]) => [k, v.id]), ...Object.entries(kits).map(([k, v]) => [k, v.id])]),
    introBars: sections[0].bars,
    outroBars: sections.at(-1).bars,
  };
}

// Section helpers shared by styles.
export const rise = (bars, lo = 300, hi = 1200) => `saw.slow(${bars}).range(${lo}, ${hi})`;
export const fall = (bars, hi = 1200, lo = 300) => `saw.slow(${bars}).range(${hi}, ${lo})`;
export const enterAfter = (bars, of) => `.mask("<0@${bars} 1@${of - bars}>")`;
export const leaveAfter = (bars, of) => `.mask("<1@${bars} 0@${of - bars}>")`;
