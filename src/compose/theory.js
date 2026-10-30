// Pitch, key, chord and progression vocabulary for the composer.

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
export const MINOR_MODES = new Set(['dorian', 'aeolian', 'phrygian']);

// Chord qualities: intervals in semitones and the Strudel/iReal chord suffix.
export const QUALITIES = {
  maj: { intervals: [0, 4, 7], suffix: '' },
  min: { intervals: [0, 3, 7], suffix: 'm' },
  sus2: { intervals: [0, 2, 7], suffix: '2' },
  sus4: { intervals: [0, 5, 7], suffix: 'sus' },
  add9: { intervals: [0, 4, 7, 14], suffix: 'add9' },
  madd9: { intervals: [0, 3, 7, 14], suffix: '-add9' },
  6: { intervals: [0, 4, 7, 9], suffix: '6' },
  m6: { intervals: [0, 3, 7, 9], suffix: '-6' },
  69: { intervals: [0, 4, 7, 9, 14], suffix: '69' },
  m69: { intervals: [0, 3, 7, 9, 14], suffix: '-69' },
  maj7: { intervals: [0, 4, 7, 11], suffix: '^7' },
  maj9: { intervals: [0, 4, 7, 11, 14], suffix: '^9' },
  maj7s11: { intervals: [0, 4, 7, 11, 18], suffix: '^7#11' },
  m7: { intervals: [0, 3, 7, 10], suffix: 'm7' },
  m9: { intervals: [0, 3, 7, 10, 14], suffix: 'm9' },
  m11: { intervals: [0, 3, 7, 10, 14, 17], suffix: 'm11' },
  7: { intervals: [0, 4, 7, 10], suffix: '7' },
  9: { intervals: [0, 4, 7, 10, 14], suffix: '9' },
  13: { intervals: [0, 4, 7, 10, 14, 21], suffix: '13' },
  '7sus': { intervals: [0, 5, 7, 10], suffix: '7sus' },
  '9sus': { intervals: [0, 5, 7, 10, 14], suffix: '9sus' },
  m7b5: { intervals: [0, 3, 6, 10], suffix: 'h7' },
  '7b9': { intervals: [0, 4, 7, 10, 13], suffix: '7b9' },
};

export const pitchName = (pc) => FLAT_NAMES[((pc % 12) + 12) % 12];

/** MIDI number to a Strudel note name, e.g. 57 -> "a3". */
export function noteName(midi) {
  return pitchName(midi).toLowerCase() + (Math.floor(midi / 12) - 1);
}

export function keyName(key) {
  const label = { aeolian: 'minor', ionian: 'major' }[key.mode] ?? key.mode;
  return `${pitchName(key.tonic)} ${label}`;
}

/** Camelot wheel position for DJ-style key compatibility, e.g. A minor -> {n: 8, letter: 'A'}. */
export function camelot(key) {
  const minor = MINOR_MODES.has(key.mode);
  const anchor = minor ? 8 : 11; // Ab minor and B major are 1A and 1B
  return { n: ((((key.tonic - anchor) * 7) % 12) + 12) % 12 + 1, letter: minor ? 'A' : 'B' };
}

/** 0 = same key, 1 = relative or adjacent on the wheel, 2 = two steps, larger = clash. */
export function keyDistance(a, b) {
  const ca = camelot(a);
  const cb = camelot(b);
  const ring = Math.min(Math.abs(ca.n - cb.n), 12 - Math.abs(ca.n - cb.n));
  if (ring === 0 && ca.letter === cb.letter) return 0;
  if (ring === 0) return 1;
  return ring + (ca.letter === cb.letter ? 0 : 1);
}

export function makeChord(key, offset, quality) {
  const q = QUALITIES[quality];
  if (!q) throw new Error(`unknown chord quality ${quality}`);
  const root = (key.tonic + offset) % 12;
  return {
    root,
    quality,
    symbol: pitchName(root) + q.suffix,
    intervals: q.intervals,
    tones: [...new Set(q.intervals.map((i) => (root + i) % 12))],
  };
}

/** All MIDI notes in [lo, hi] whose pitch class is in pcs. */
export function notesInRange(pcs, lo, hi) {
  const set = new Set(pcs);
  const out = [];
  for (let m = lo; m <= hi; m++) if (set.has(m % 12)) out.push(m);
  return out;
}

/** The MIDI note with pitch class pc closest to target. */
export function nearest(pc, target) {
  const base = target - (((target - pc) % 12) + 12) % 12;
  return target - base <= base + 12 - target ? base : base + 12;
}

// Progressions: [semitone offset from tonic, quality, bars]. Each declares the
// mode it implies, which drives melody scales and key labelling. These are the
// loop shapes transcribed from the reference mixes: chords last two bars or
// more, and maj9 and m9 colour nearly everything.
export const PROGRESSIONS = [
  // Melodic house, minor: eight-bar loops that open out from the tonic.
  { id: 'night-1', mode: 'aeolian', moods: ['melodic'], chords: [[0, 'm9', 4], [3, 'maj9', 2], [8, 'maj9', 2]] },
  { id: 'night-2', mode: 'aeolian', moods: ['melodic'], chords: [[0, 'm9', 2], [5, 'm9', 2], [8, 'maj9', 2], [3, 'maj9', 2]] },
  { id: 'night-3', mode: 'aeolian', moods: ['melodic'], chords: [[0, 'm9', 2], [3, 'maj9', 2], [7, 'm9', 2], [8, 'maj9', 2]] },
  { id: 'night-4', mode: 'aeolian', moods: ['melodic'], chords: [[0, 'm9', 4], [8, 'maj9', 2], [3, 'maj9', 2]] },
  { id: 'night-5', mode: 'aeolian', moods: ['melodic'], chords: [[0, 'm9', 4], [2, 'm7', 2], [10, '9sus', 1], [3, 'maj9', 1]] },
  { id: 'night-6', mode: 'aeolian', moods: ['melodic'], chords: [[0, 'm9', 2], [8, 'maj9', 2], [3, 'maj9', 2], [10, '9sus', 2]] },
  { id: 'night-7', mode: 'phrygian', moods: ['melodic'], chords: [[0, 'm9', 6], [1, 'maj9', 1], [5, 'm9', 1]] },
  // Melodic house, major: the brighter half of the same mixes.
  { id: 'day-1', mode: 'ionian', moods: ['melodic'], chords: [[0, 'maj9', 2], [9, 'm9', 1], [7, '69', 1]] },
  { id: 'day-2', mode: 'ionian', moods: ['melodic'], chords: [[0, 'maj9', 2], [7, '69', 2], [2, 'm9', 2], [9, 'm9', 1], [5, 'maj9', 1]] },
  { id: 'day-3', mode: 'ionian', moods: ['melodic'], chords: [[0, 'maj9', 4], [7, '69', 4]] },
  { id: 'day-4', mode: 'ionian', moods: ['melodic'], chords: [[0, 'maj9', 2], [4, 'm9', 2]] },
  { id: 'day-5', mode: 'ionian', moods: ['melodic'], chords: [[0, 'maj9', 6], [5, 'maj9', 2]] },
  { id: 'day-6', mode: 'ionian', moods: ['melodic'], chords: [[0, 'maj9', 2], [9, 'm9', 1], [4, 'm9', 1]] },
  { id: 'day-7', mode: 'ionian', moods: ['melodic'], chords: [[0, 'maj9', 2], [7, '69', 1], [0, 'maj9', 1], [5, 'maj9', 4]] },
  // Deep house vamps: one or two chords for the whole song.
  { id: 'vamp-1', mode: 'dorian', moods: ['deep'], chords: [[0, 'm9', 2], [5, 'm9', 2]] },
  { id: 'vamp-2', mode: 'dorian', moods: ['deep'], chords: [[0, 'm9', 4]] },
  { id: 'vamp-3', mode: 'dorian', moods: ['deep'], chords: [[0, 'm9', 3], [5, '9', 1]] },
  { id: 'vamp-4', mode: 'aeolian', moods: ['deep'], chords: [[0, 'm9', 3], [7, 'm9', 1]] },
  { id: 'vamp-5', mode: 'dorian', moods: ['deep'], chords: [[0, 'm11', 2], [5, 'm9', 2]] },
  { id: 'vamp-6', mode: 'ionian', moods: ['deep'], chords: [[5, 'maj9', 3], [7, '69', 1]] },
  { id: 'vamp-7', mode: 'ionian', moods: ['deep'], chords: [[0, 'maj9', 3], [5, 'maj9', 1]] },
  { id: 'vamp-8', mode: 'ionian', moods: ['deep'], chords: [[5, 'maj9', 2], [9, 'm9', 2]] },
  // Slow soul: chords every bar or two, ii and vi leaning back towards I.
  { id: 'soul-1', mode: 'ionian', moods: ['soul'], chords: [[2, 'm9', 2], [0, 'maj9', 2], [2, 'm9', 2], [4, 'm7', 1], [9, 'm9', 1]] },
  { id: 'soul-2', mode: 'ionian', moods: ['soul'], chords: [[5, 'maj9', 1], [0, 'maj9', 1], [5, 'maj9', 1], [7, '9sus', 1]] },
  { id: 'soul-3', mode: 'ionian', moods: ['soul'], chords: [[0, 'maj9', 1], [5, 'maj9', 1], [2, 'm9', 1], [7, '13', 1]] },
  { id: 'soul-4', mode: 'ionian', moods: ['soul'], chords: [[0, 'maj9', 1], [9, 'm9', 1], [5, 'maj9', 1], [2, 'm9', 1]] },
  { id: 'soul-5', mode: 'ionian', moods: ['soul'], chords: [[2, 'm9', 1], [7, '13', 1], [5, 'maj9', 2]] },
  { id: 'soul-6', mode: 'ionian', moods: ['soul'], chords: [[0, 'maj9', 2], [2, 'm9', 2], [4, 'm7', 1], [9, 'm9', 1], [2, 'm9', 1], [9, 'm9', 1]] },
  { id: 'soul-7', mode: 'ionian', moods: ['soul'], chords: [[9, 'm9', 1], [4, 'm7', 1], [9, 'm9', 1], [0, 'maj9', 1], [5, 'maj9', 1], [4, 'm7', 1], [7, '13', 1], [0, 'maj9', 1]] },
  { id: 'soul-8', mode: 'ionian', moods: ['soul'], chords: [[2, 'm9', 1], [0, 'maj9', 2], [2, 'm9', 1], [5, 'maj9', 2], [7, '9sus', 2]] },
  { id: 'soul-9', mode: 'dorian', moods: ['soul'], chords: [[0, 'm9', 2], [5, '9', 1], [7, 'm7', 1], [5, '9', 2], [3, 'maj9', 2]] },
  { id: 'soul-10', mode: 'aeolian', moods: ['soul'], chords: [[10, 'maj9', 2], [7, 'm7', 2], [10, 'maj9', 2], [0, 'm9', 2]] },
];

export function progressionBars(progression) {
  return progression.chords.reduce((sum, [, , bars]) => sum + bars, 0);
}

/** Expand a progression into one chord per bar for a key. */
export function chordsPerBar(key, progression) {
  const bars = [];
  for (const [offset, quality, length] of progression.chords) {
    const chord = makeChord(key, offset, quality);
    for (let i = 0; i < length; i++) bars.push(chord);
  }
  return bars;
}

/** Strudel alternation for a progression, e.g. "<Am9 Fmaj9 C^7@2>". */
export function progressionMini(key, progression) {
  const parts = progression.chords.map(([offset, quality, bars]) => {
    const { symbol } = makeChord(key, offset, quality);
    return bars > 1 ? `${symbol}@${bars}` : symbol;
  });
  return `<${parts.join(' ')}>`;
}

// Colour tones in the order a sparse voicing keeps them. The bass owns the
// root, so a stab of four notes stays clear of it and of the sub.
const COLOUR_ORDER = [3, 4, 10, 11, 14, 2, 9, 21, 5, 17, 7, 6, 18, 13];

/** Pitch classes of a rootless voicing of `size` notes. */
export function colourTones(chord, size = 4) {
  const hasThird = chord.intervals.some((i) => i === 3 || i === 4);
  const ranked = chord.intervals
    .filter((i) => i !== 0)
    .sort((a, b) => COLOUR_ORDER.indexOf(a) - COLOUR_ORDER.indexOf(b));
  // A sus chord has no third, so its fourth takes that place in the order.
  if (!hasThird) ranked.sort((a, b) => (b === 5 || b === 2) - (a === 5 || a === 2));
  const pcs = ranked.map((i) => (chord.root + i) % 12);
  return [...new Set(pcs)].slice(0, size);
}

/** Every closed inversion of `pcs` as ascending MIDI notes, centred near `center`. */
function closedInversions(pcs, center) {
  return pcs.map((_, turn) => {
    const order = [...pcs.slice(turn), ...pcs.slice(0, turn)];
    const notes = [];
    for (const pc of order) {
      const floor = notes.length ? notes.at(-1) + 1 : 0;
      notes.push(floor + (((pc - floor) % 12) + 12) % 12);
    }
    const mean = notes.reduce((a, b) => a + b, 0) / notes.length;
    const shift = Math.round((center - mean) / 12) * 12;
    return notes.map((n) => n + shift);
  });
}

/**
 * Voice one chord per bar: rootless, close, and moving as little as possible
 * from bar to bar, so repeated stabs read as one instrument instead of jumps.
 */
export function voiceLoop(chords, { center = 60, size = 4 } = {}) {
  let previous;
  return chords.map((chord) => {
    const pcs = colourTones(chord, size).sort((a, b) => a - b);
    const options = closedInversions(pcs, center);
    const cost = (notes) => {
      const mean = notes.reduce((a, b) => a + b, 0) / notes.length;
      const moved = previous ? notes.reduce((sum, n, i) => sum + Math.abs(n - (previous[i] ?? previous.at(-1))), 0) : 0;
      // Neighbouring semitones beat against each other this low in the mix.
      const rough = notes.filter((n, i) => i && n - notes[i - 1] === 1).length;
      return moved + Math.abs(mean - center) * 1.5 + rough * 24;
    };
    const best = options.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    previous = best;
    return best;
  });
}

/** Pentatonic pitch classes of a key: hooks built on these sit over every chord of the loop. */
export function pentatonic(key) {
  const minor = MINOR_MODES.has(key.mode);
  return (minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]).map((i) => (key.tonic + i) % 12);
}
