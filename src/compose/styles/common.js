// Shared song engine. Every style is a loop-based song: one harmonic loop, a
// few parts that each own a register, and a form of 8 and 16 bar blocks in
// which parts enter on block lines and a slow filter arc replaces chord
// changes as the source of movement. The numbers come from transcribing the
// reference mixes (docs/music/reference-analysis.md).
import { createBuilder } from '../builder.js';
import { pickKit, pickPreset } from '../instruments.js';
import { barMini, barsMini, num } from '../mini.js';
import { bassLine, BASS_RHYTHMS, cascade, chops, fills, gridMini, hook } from '../patterns.js';
import { chordsPerBar, noteName, voiceLoop } from '../theory.js';

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
    presence: config.presence ?? 3, // dB at 2.5 kHz in the master
    compose: (ctx) => compose(config, ctx),
  };
}

// A rhythm that changes on the last bar of every four, so a loop turns over.
const turn = (a, b) => `<[${gridMini(a, 'x')}]!3 [${gridMini(b, 'x')}]>`;

const chordNotes = (notes) => `[${notes.map(noteName).join(',')}]`;

/**
 * Comping that can lean into the next chord: `cell` is [[step, length, next]],
 * where next plays the following bar's chord early, as a pianist anticipates.
 */
const comp = (voicings, cell) =>
  barsMini(
    voicings.map((notes, i) =>
      barMini(cell.map(([step, len, next]) => ({ step, len, value: chordNotes(next ? voicings[(i + 1) % voicings.length] : notes) }))),
    ),
  );

function compose(config, { rng, key, bpm, progressions }) {
  const [progA, progB] = progressions;
  const chordsA = chordsPerBar(key, progA);
  const chordsB = chordsPerBar(key, progB);
  const b = createBuilder({ rng, levels: config.levels, swing: config.swing, echo: config.echo });
  const role = (name) => config.presets?.[name] ?? config.tags;

  const pick = {
    sub: pickPreset(rng, 'sub', role('sub')),
    bass: pickPreset(rng, 'bass', role('bass')),
    pad: pickPreset(rng, 'pad', role('pad')),
    keys: pickPreset(rng, 'keys', role('keys')),
    lead: pickPreset(rng, 'lead', role('lead')),
  };
  const kitTags = config.kitTags ?? config.tags;
  const kits = Object.fromEntries(['kick', 'snare', 'hat', 'tick', 'openhat', 'perc'].map((part) => [part, pickKit(rng, part, kitTags)]));
  // Each song makes one or two clear choices rather than using every part.
  const song = {
    chords: rng.weighted(config.chordModes),
    melody: rng.weighted(config.melodyModes),
    bass: rng.chance(config.bassChance ?? 1),
    chops: rng.chance(config.chopChance ?? 0),
  };

  b.comment('Harmony: rootless close voicings, moved as little as possible.');
  const center = rng.int(...(config.center ?? [58, 62]));
  const voice = (chords) => voiceLoop(chords, { center, size: config.voices ?? 4 });
  const voicedA = voice(chordsA);
  const voicedB = voice(chordsB);
  b.def('A', `note("${barsMini(voicedA.map(chordNotes))}")`);
  b.def('B', `note("${barsMini(voicedB.map(chordNotes))}")`);
  b.def('heldA', `note("${barsMini(voicedA.map(chordNotes), { tie: true })}")`);
  b.def('heldB', `note("${barsMini(voicedB.map(chordNotes), { tie: true })}")`);

  b.comment('Low end: one held sub, and for some songs a sparse line above it.');
  const subLow = config.subLow ?? 27;
  const bassLow = config.bassLow ?? 36;
  const subRhythm = rng.pick(config.subRhythms);
  const sub = (chords) => bassLine(chords, BASS_RHYTHMS[subRhythm], { low: subLow, legato: true, tie: subRhythm === 'hold' });
  const line = (chords, rhythm) => bassLine(chords, BASS_RHYTHMS[rhythm], { low: bassLow, legato: config.legatoBass });
  const [rhythmA, rhythmB] = rng.shuffle(config.bassRhythms);
  b.def('subA', `note("${sub(chordsA)}")`);
  b.def('subB', `note("${sub(chordsB)}")`);
  b.def('lineA', `note("${line(chordsA, rhythmA)}")`);
  b.def('lineA2', `note("${line(chordsA, rhythmB ?? rhythmA)}")`);
  b.def('lineB', `note("${line(chordsB, rhythmB ?? rhythmA)}")`);
  b.notes('sub', pick.sub);
  b.notes('bass', pick.bass, { extra: config.bassExtra ?? '' });

  b.comment('Parts above the bass.');
  const [cellA, cellB] = rng.shuffle(config.stabs);
  b.pattern('stab', pick.keys, { struct: turn(cellA, cellB ?? cellA), extra: config.stabExtra ?? '', scale: song.chords === 'both' ? 0.6 : 1 });
  b.pattern('held', pick.pad);
  if (config.comps) {
    const [compA, compB] = rng.shuffle(config.comps);
    b.def('compA', `note("${comp(voicedA, compA)}")`);
    b.def('compA2', `note("${comp(voicedA, compB ?? compA)}")`);
    b.def('compB', `note("${comp(voicedB, compB ?? compA)}")`);
    b.pattern('keys', pick.keys, { scale: 1 });
  }
  const [lo, hi] = config.hookRange ?? [69, 86];
  const melodyBars = Math.max(8, chordsA.length);
  b.def('hookA', `note("${hook(rng, key, chordsA, { lo, hi, bars: melodyBars })}")`);
  b.def('hookB', `note("${hook(rng, key, chordsA, { lo: lo + 3, hi: hi + 3, bars: melodyBars })}")`);
  b.def('runA', `note("${cascade(rng, key, chordsA, { top: hi, bars: melodyBars })}")`);
  b.notes('lead', pick.lead, { on: 'fx', extra: '.pan(perlin.slow(4).range(.42, .62))' });
  b.notes('run', pick.lead, { on: 'fx', extra: '.clip(6).release(.9).pan(perlin.slow(3).range(.3, .7))', scale: 0.8 });
  if (config.chopChance) {
    b.def('chopA', `note("${chops(rng, chordsA, { bars: melodyBars })}")`);
    b.def('voice', 'n => n.s("gm_voice_oohs").attack(.008).release(.08).hpf(500).lpf(3200)' + `.gain(${num((config.levels.voice ?? 0.2))})${b.bus.fx}`);
  }
  if (config.fills) {
    b.def('fillA', `note("${fills(rng, key, chordsA, { bars: melodyBars })}")`);
    b.def('fillB', `note("${fills(rng, key, chordsA, { base: 77, bars: melodyBars })}")`);
  }

  b.comment('Drums: the kick ducks everything that holds a note.');
  const groove = rng.pick(config.grooves);
  const pattern = (grid) => (grid.length > 16 ? `<${gridMini(grid.slice(0, 16), 'x')} ${gridMini(grid.slice(16), 'x')}>` : gridMini(grid, 'x'));
  b.drum('kick', kits.kick, pattern(groove.kick), { role: 'kick', extra: config.duck ? b.duck(config.duck) : '', humanize: 0 });
  b.drum('clap', kits.snare, pattern(groove.clap), { role: 'snare', humanize: 0.08 });
  b.drum('hat', kits.hat, pattern(groove.hat), { role: 'hat', extra: '.pan(.54)', humanize: 0.12 });
  b.drum('tick', kits.tick, pattern(groove.tick), { role: 'tick', extra: `.pan(.46).velocity("[1 .45 .75 .55]*4")${b.swing}`, humanize: 0 });
  b.drum('open', kits.openhat, pattern(groove.open), { role: 'openhat', extra: '.pan(.6)', humanize: 0.1 });
  b.drum('perc', kits.perc, pattern(groove.perc), { role: 'perc', extra: `.pan(.4)${b.swing}`, humanize: 0.2 });
  b.def('riser', `s("white").slow(8).attack(7).release(.3).hpf(1200).lpf(6500).gain(${num(config.levels.riser ?? 0.03)}).orbit(4)`);

  const plan = sectionsOf(rng.pick(config.plans(rng)));
  const [dark, bright] = config.arc ?? [520, 3400];
  const sections = plan.map(({ name, bars }) => {
    const hz = (x) => Math.round(dark * Math.pow(bright / dark, x));
    const open = (from, to = from) => (from === to ? String(hz(from)) : `saw.slow(${bars}).range(${hz(from)}, ${hz(to)})`);
    const ctx = {
      rng,
      bars,
      open,
      // The last bar of a block drops the kick; the loop keeps playing over the gap.
      drop: `.mask("<1!${bars - 1} 0>")`,
      enter: (n) => `.mask("<0@${n} 1@${bars - n}>")`,
      leave: (n) => `.mask("<1@${n} 0@${bars - n}>")`,
      // The chord part this song chose, at a point on the filter arc.
      chords: (from, to = from) => [
        ...(song.chords !== 'stab' ? [`held(heldA).lpf(${open(from, to)})`] : []),
        ...(song.chords !== 'pad' ? [`stab(A).lpf(${open(from, to)})`] : []),
      ],
      low: (line = 'lineA') => ['sub(subA)', ...(song.bass ? [`bass(${line})`] : [])],
      // The melody this song chose: `n` picks the phrase, higher for later sections.
      melody: (n = 0) => [
        ...(song.melody !== 'run' ? [`lead(${n ? 'hookB' : 'hookA'})`] : []),
        ...(song.melody !== 'hook' ? ['run(runA)'] : []),
        ...(song.chops ? ['voice(chopA)'] : []),
      ],
    };
    return { name, bars, stack: config.sections(name, ctx) };
  });
  return {
    code: `setcps(${bpm}/60/4)\n${b.code(sections)}`,
    sections: sections.map(({ name, bars }) => [name, bars]),
    instruments: Object.fromEntries([...Object.entries(pick).map(([k, v]) => [k, v.id]), ...Object.entries(kits).map(([k, v]) => [k, v.id])]),
    introBars: sections[0].bars,
    outroBars: sections.at(-1).bars,
  };
}
