// Rhythm and line generators shared by the styles. Everything here returns
// plain data (events or mini-notation strings) so styles stay declarative.
import { barMini, barsMini } from './mini.js';
import { chordScale, nearest, noteName, notesInRange } from './theory.js';

/**
 * Bass rhythms on a 16-step bar: [step, length, role]. Roles resolve against
 * the bar's chord: R root, O octave, 5 fifth, 3 third, 7 seventh,
 * A approach into the next bar's root.
 */
export const BASS_RHYTHMS = {
  hold: [[0, 16, 'R']],
  holdPush: [[0, 10, 'R'], [10, 6, 'R']],
  holdApproach: [[0, 14, 'R'], [14, 2, 'A']],
  halves: [[0, 8, 'R'], [8, 8, '5']],
  dotted: [[0, 6, 'R'], [6, 4, 'R'], [10, 6, '5']],
  dottedOct: [[0, 3, 'R'], [3, 3, 'R'], [6, 4, 'O'], [10, 6, 'R']],
  syncopated: [[0, 7, 'R'], [7, 3, 'R'], [10, 4, 'O'], [14, 2, 'A']],
  twoStep: [[0, 4, 'R'], [7, 3, 'R'], [10, 6, 'O']],
  rolling: [[0, 2, 'R'], [2, 2, 'R'], [4, 2, 'O'], [6, 2, 'R'], [8, 2, 'R'], [10, 2, '5'], [12, 2, 'R'], [14, 2, 'O']],
  offbeat: [[2, 2, 'R'], [6, 2, 'R'], [10, 2, 'R'], [14, 2, 'O']],
  walkUp: [[0, 4, 'R'], [4, 4, '3'], [8, 4, '5'], [12, 4, 'A']],
  rootFifth: [[0, 6, 'R'], [6, 2, '5'], [8, 6, 'R'], [14, 2, '5']],
  pulse8: [[0, 2, 'R'], [2, 2, 'R'], [4, 2, 'R'], [6, 2, 'R'], [8, 2, 'R'], [10, 2, 'R'], [12, 2, 'R'], [14, 2, 'R']],
  octPump: [[0, 2, 'R'], [2, 2, 'O'], [4, 2, 'R'], [6, 2, 'O'], [8, 2, 'R'], [10, 2, 'O'], [12, 2, 'R'], [14, 2, 'O']],
  lazy: [[0, 12, 'R'], [12, 4, '7']],
  pedal: [[0, 16, 'T']], // T: the key tonic regardless of chord
  // Plucked funk and soul lines: short notes with air between them.
  pocket: [[0, 4, 'R'], [6, 2, 'R'], [10, 4, '5'], [14, 2, 'O']],
  funk: [[0, 3, 'R'], [3, 1, 'R'], [6, 2, 'O'], [8, 3, '5'], [11, 2, 'R'], [14, 2, 'A']],
  soul: [[0, 6, 'R'], [7, 1, 'R'], [8, 4, '5'], [12, 2, '3'], [14, 2, 'A']],
  strut: [[0, 2, 'R'], [3, 2, 'R'], [6, 1, 'O'], [7, 2, 'R'], [10, 3, '5'], [14, 2, 'A']],
};

/**
 * Resolve a bass rhythm over a sequence of chords (one per bar).
 * @returns {string} mini-notation alternation, one bar per chord
 */
export function bassLine(chords, rhythm, { low = 33, key, legato = false } = {}) {
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
        case '3':
          return root + chord.intervals[1];
        case '7':
          return root + (chord.intervals.find((x) => x === 10 || x === 11) ?? 12);
        case 'T':
          return nearest(key.tonic, low + 5);
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

/**
 * A short melodic motif that follows the chords. Rhythm comes from a seeded
 * template; pitches walk the chord scale and land on chord tones on strong steps.
 */
const MOTIF_RHYTHMS = [
  [0, 3, 6, 10],
  [0, 2, 4, 7, 10],
  [2, 6, 8, 14],
  [0, 6, 8, 11],
  [4, 6, 10, 12],
  [0, 3, 8],
  [0, 8, 10, 12, 14],
  [6, 8, 10],
  [0, 4, 6, 10, 14],
  [2, 4, 10],
];

export function motif(rng, key, chords, { lo = 67, hi = 84, density = 0.7, phrase = 'AABA' } = {}) {
  const shapes = {};
  const makeShape = () => {
    const rhythm = rng.pick(MOTIF_RHYTHMS).filter((s, i) => i === 0 || rng.chance(density + 0.2));
    // Contour as scale-step moves; mostly steps, sometimes a leap.
    const moves = rhythm.map(() => rng.weighted([[5, 1], [5, -1], [3, 2], [3, -2], [2, 0], [1, 4], [1, -3]]));
    return { rhythm, moves, start: rng.int(0, 4) };
  };
  const bars = chords.map((chord, i) => {
    const letter = phrase[i % phrase.length];
    shapes[letter] ??= makeShape();
    const shape = shapes[letter];
    const scale = notesInRange(chordScale(key, chord), lo, hi);
    const tones = notesInRange(chord.tones, lo, hi);
    let index = Math.min(scale.length - 1, Math.floor(scale.length / 3) + shape.start);
    const events = shape.rhythm.map((step, j) => {
      index = Math.max(0, Math.min(scale.length - 1, index + shape.moves[j]));
      let midi = scale[index];
      if (step % 4 === 0 && tones.length) {
        // strong beat: snap to the closest chord tone
        midi = tones.reduce((best, t) => (Math.abs(t - midi) < Math.abs(best - midi) ? t : best), tones[0]);
        index = scale.indexOf(midi) >= 0 ? scale.indexOf(midi) : index;
      }
      const nextStep = shape.rhythm[j + 1] ?? 16;
      return { step, len: nextStep - step, value: noteName(midi) };
    });
    return barMini(events);
  });
  return barsMini(bars);
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
