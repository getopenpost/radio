// Rhythm and line generators shared by the styles. Everything here returns
// plain data (events or mini-notation strings) so styles stay declarative.
import { barMini, barsMini } from './mini.js';
import { nearest, noteName, notesInRange, pentatonic } from './theory.js';

/**
 * Bass rhythms on a 16-step bar: [step, length, role]. Roles resolve against
 * the bar's chord: R root, O octave, 5 fifth, A approach into the next bar's root.
 */
export const BASS_RHYTHMS = {
  hold: [[0, 16, 'R']],
  holdApproach: [[0, 13, 'R'], [14, 2, 'A']],
  // Measured house bass cells: plucks that stay off the kick's steps, a
  // tresillo push, and an octave flip under a held note.
  afterKick: [[2, 2, 'R'], [6, 2, 'R']],
  syncopated16: [[3, 1, 'R'], [5, 1, 'R'], [7, 2, 'O'], [10, 2, 'R'], [14, 2, 'R']],
  tresillo: [[0, 2, 'R'], [2, 2, 'R'], [7, 2, 'O'], [10, 2, 'R'], [13, 2, '5']],
  lateTwo: [[7, 2, 'R'], [10, 3, 'O']],
  walker: [[2, 2, 'R'], [7, 2, '5'], [11, 2, 'R'], [13, 2, 'O']],
  pickup: [[2, 1, 'R'], [3, 1, 'R'], [14, 1, 'O'], [15, 1, 'R']],
  offbeats: [[2, 2, 'R'], [6, 2, 'R'], [10, 2, 'R'], [14, 2, 'O']],
  octaveFlip: [[0, 8, 'R'], [8, 8, 'O']],
  // Soul lines: one long root, then a pickup that leads into the next chord.
  long: [[0, 11, 'R'], [14, 2, 'A']],
  doubled: [[0, 7, 'R'], [8, 2, 'R'], [10, 3, 'O'], [14, 2, 'A']],
  rootOctave: [[0, 2, 'R'], [2, 3, 'O'], [6, 5, 'R'], [12, 2, 'O'], [14, 2, 'A']],
};

/**
 * Resolve a bass rhythm over a sequence of chords (one per bar).
 * @returns {string} mini-notation alternation, one bar per chord
 */
export function bassLine(chords, rhythm, { low = 33, legato = false, tie = false } = {}) {
  const bars = chords.map((chord, i) => {
    const next = chords[(i + 1) % chords.length];
    const root = low + ((((chord.root - low) % 12) + 12) % 12);
    const resolve = (role) => {
      switch (role) {
        case 'R':
          return root;
        case 'O':
          return root + 12;
        case '5':
          return root + (chord.intervals.includes(6) && !chord.intervals.includes(7) ? 6 : 7);
        case 'A': {
          // Lead into the note the next bar actually starts on: a semitone
          // below it, or a tone above when below would leave the register.
          const target = low + ((((next.root - low) % 12) + 12) % 12);
          if (target === root) return root + 7;
          return target - 1 >= low ? target - 1 : target + 2;
        }
        default:
          return root;
      }
    };
    const events = rhythm.map(([step, len, role], j) => {
      const nextStep = rhythm[j + 1]?.[0] ?? 16;
      return { step, len: legato ? nextStep - step : len, value: noteName(resolve(role)) };
    });
    return barMini(events);
  });
  return barsMini(bars);
}

// Hooks in the reference songs are short bright phrases that cross a bar line,
// heard every four bars as a call and a shorter answer, with the echo filling
// the space after them. Each template is [step, pentatonic offset] within four
// bars (16 steps a bar), measured around the bar lines they cross.
const HOOKS = [
  { call: [[10, 2], [12, 1], [14, 1], [16, 2], [19, 0]], answer: [[44, 1], [46, 0], [48, -1]] },
  { call: [[11, 0], [13, 1], [14, 2], [16, 3], [18, 2]], answer: [[45, 2], [46, 1], [48, 0]] },
  { call: [[12, 3], [14, 2], [16, 1], [19, 0]], answer: [[44, 2], [47, 1], [50, 0]] },
  { call: [[6, 1], [10, 1], [14, 2], [16, 1]], answer: [[38, 1], [42, 1], [46, 2], [48, 0]] },
  { call: [[14, 0], [15, 1], [16, 2], [18, 3], [20, 2]], answer: [[46, 2], [47, 1], [48, 0]] },
  { call: [[10, 0], [13, 2], [16, 3], [18, 1]], answer: [[42, 2], [45, 1], [48, -1]] },
  { call: [[3, 1], [6, 2], [10, 1], [14, 0]], answer: [[35, 1], [38, 2], [42, 3], [46, 1]] },
];

function pitchOf(midi, chord) {
  if (chord.tones.includes(midi % 12)) return midi; // a third next to a ninth is still a chord tone
  const clash = chord.tones.find((t) => (midi - t + 12) % 12 === 1 || (t - midi + 12) % 12 === 1);
  return clash === undefined ? midi : nearest(clash, midi);
}

const barAt = (chords, bar) => chords[bar % chords.length];

/** Split events on a long step line into per-bar mini-notation. */
function perBar(events, bars) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    const from = bar * 16;
    out.push(barMini(events.filter((e) => e.step >= from && e.step < from + 16).map((e) => ({ ...e, step: e.step - from }))));
  }
  return barsMini(out);
}

/**
 * A call and answer on the key's pentatonic, repeated exactly every four bars
 * with only the last note of the phrase changed at the end of the loop.
 * Notes a semitone from a tone of the sounding chord slide onto that tone.
 */
export function hook(rng, key, chords, { lo = 69, hi = 86, bars = 8, hooks = HOOKS } = {}) {
  const scale = notesInRange(pentatonic(key), lo, hi);
  const { call, answer } = rng.pick(hooks);
  const phrase = [...call, ...answer];
  const home = rng.int(Math.floor(scale.length * 0.3), Math.floor(scale.length * 0.5));
  const ending = rng.pick([1, 2]);
  const events = [];
  for (let unit = 0; unit < Math.ceil(bars / 4); unit++) {
    const lastUnit = unit === Math.ceil(bars / 4) - 1;
    phrase.forEach(([step, offset], i) => {
      const at = unit * 64 + step;
      const change = lastUnit && i === phrase.length - 1 ? ending : 0;
      const midi = scale[Math.max(0, Math.min(scale.length - 1, home + offset + change))];
      const next = phrase[i + 1]?.[0] ?? step + 8;
      events.push({ step: at, len: Math.min(next - step, 4), value: noteName(pitchOf(midi, barAt(chords, Math.floor(at / 16)))) });
    });
  }
  return perBar(events, Math.ceil(bars / 4) * 4);
}

/**
 * A falling run into each chord change, sixteenths apart and left ringing, the
 * way a pianist rolls down the keys: heard every four bars, it arrives on the
 * next chord's colour tones.
 */
export function cascade(rng, key, chords, { top = 86, notes = 7, bars = 8 } = {}) {
  const events = [];
  const every = 4;
  const length = rng.pick([6, notes, notes + 1]);
  for (let bar = every - 1; bar < bars; bar += every) {
    const target = barAt(chords, bar + 1);
    const pool = notesInRange([...new Set([...target.tones, ...pentatonic(key)])], top - 22, top).reverse();
    const last = (bar + 1) * 16;
    const run = [...new Set(pool.map((midi) => pitchOf(midi, target)))].slice(0, length);
    run.forEach((midi, i) => {
      events.push({ step: last + i - run.length + 2, len: 1, value: noteName(midi) });
    });
  }
  return perBar(events.filter((e) => e.step < bars * 16), bars);
}

/** Short vocal bursts on one or two chord tones, in phrases that leave bars empty. */
export function chops(rng, chords, { lo = 72, hi = 80, bars = 8 } = {}) {
  const rhythm = rng.pick([
    [3, 6, 10],
    [2, 5, 8, 11],
    [6, 8, 10, 14],
    [3, 6, 11, 14],
  ]);
  const silent = rng.pick([[1, 3], [0, 2], [1, 3, 5, 7]]);
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    if (silent.includes(bar % 8)) {
      out.push('~');
      continue;
    }
    const tones = notesInRange(barAt(chords, bar).tones, lo, hi);
    out.push(barMini(rhythm.map((step, i) => ({ step, len: 1, value: noteName(tones[i % Math.min(2, tones.length)]) }))));
  }
  return barsMini(out);
}

// Soul fills: scale degrees of the major scale (7 = octave) at steps in the
// last bar of a phrase, read from the slow mix. Each lands on the next bar line.
const FILLS = [
  { steps: [12, 13, 14, 16], degrees: [2, 4, 5, 7] },
  { steps: [8, 10, 12, 14, 16], degrees: [12, 11, 9, 8, 7] },
  { steps: [10, 12, 14, 16], degrees: [4, 2, 1, 0] },
  { steps: [4, 6, 10], degrees: [11, 9, 11] },
  { steps: [8, 10, 12, 14, 16], degrees: [9, 8, 7, 5, 4] },
  { steps: [15, 16], degrees: [4, 4] },
  { steps: [6, 8, 12, 14], degrees: [1, 2, 1, 0] },
  { steps: [0, 2, 4, 8], degrees: [5, 4, 5, 4] },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// Semitones from a mode's tonic up to the tonic of its parent major scale.
const PARENT = { ionian: 0, lydian: 7, mixolydian: 5, dorian: 10, phrygian: 8, aeolian: 3 };

/** Fills at the end of every second and fourth bar, one figure answering another. */
export function fills(rng, key, chords, { base = 72, bars = 8 } = {}) {
  const [a, b] = rng.shuffle(FILLS);
  const root = nearest((key.tonic + PARENT[key.mode]) % 12, base);
  const degree = (d) => root + MAJOR[d % 7] + 12 * Math.floor(d / 7);
  const events = [];
  for (let bar = 1; bar < bars; bar += 2) {
    const fill = bar % 4 === 3 ? b : a;
    fill.steps.forEach((step, i) => {
      const at = bar * 16 + step;
      const chord = barAt(chords, Math.floor(at / 16));
      const len = (fill.steps[i + 1] ?? step + 4) - step;
      events.push({ step: at, len, value: noteName(pitchOf(degree(fill.degrees[i]), chord)) });
    });
  }
  return perBar(events.filter((e) => e.step < bars * 16), bars);
}

/** Drum grid strings ("x...x...") to mini-notation for a sound. */
export function gridMini(grid, sound, accentSound = sound) {
  const cells = grid.replace(/\s/g, '');
  const events = [];
  [...cells].forEach((c, i) => {
    if (c === 'x') events.push({ step: i, len: 1, value: sound });
    if (c === 'X') events.push({ step: i, len: 1, value: accentSound });
  });
  return barMini(events, cells.length);
}
