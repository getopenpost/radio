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

/** Scale pitch classes of a key. */
export function scalePcs(key) {
  return MODES[key.mode].map((i) => (key.tonic + i) % 12);
}

/**
 * Notes that sound good over a chord: chord tones plus scale tensions that
 * are not a semitone above a chord tone (the classic "avoid notes").
 */
export function chordScale(key, chord) {
  const scale = scalePcs(key);
  const tones = new Set(chord.tones);
  return scale.filter((pc) => tones.has(pc) || !chord.tones.some((t) => (pc - t + 12) % 12 === 1));
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
// mode it implies, which drives melody scales and key labelling.
export const PROGRESSIONS = [
  // Dark minor: focus, garage, ambient
  { id: 'dark-1', mode: 'aeolian', moods: ['dark', 'deep'], chords: [[0, 'm9', 1], [8, 'maj9', 1], [3, 'maj7', 1], [10, '6', 1]] },
  { id: 'dark-2', mode: 'aeolian', moods: ['dark', 'deep'], chords: [[0, 'm9', 2], [8, 'maj7', 1], [10, '9sus', 1]] },
  { id: 'dark-3', mode: 'aeolian', moods: ['dark'], chords: [[0, 'm11', 1], [5, 'm9', 1], [8, 'maj7', 1], [7, 'm7', 1]] },
  { id: 'dark-4', mode: 'aeolian', moods: ['dark', 'deep'], chords: [[0, 'm9', 1], [10, '6', 1], [8, 'maj9', 1], [5, 'm9', 1]] },
  { id: 'dark-5', mode: 'aeolian', moods: ['dark', 'deep'], chords: [[8, 'maj9', 1], [10, '6', 1], [0, 'm9', 2]] },
  { id: 'dark-6', mode: 'aeolian', moods: ['dark'], chords: [[0, 'm9', 1], [7, 'm7', 1], [8, 'maj7', 1], [5, 'm9', 1]] },
  { id: 'dark-7', mode: 'aeolian', moods: ['dark', 'ambient', 'deep'], chords: [[0, 'madd9', 2], [8, 'maj7s11', 2]] },
  { id: 'dark-8', mode: 'aeolian', moods: ['dark'], chords: [[8, 'maj7', 1], [7, 'm7', 1], [5, 'm9', 1], [0, 'm9', 1]] },
  { id: 'dark-9', mode: 'aeolian', moods: ['dark', 'deep'], chords: [[0, 'm9', 2], [5, 'm9', 2], [8, 'maj9', 2], [10, '9sus', 2]] },
  { id: 'phryg-1', mode: 'phrygian', moods: ['dark', 'deep'], chords: [[0, 'm11', 2], [1, 'maj7', 2]] },
  { id: 'phryg-2', mode: 'phrygian', moods: ['dark'], chords: [[0, 'm9', 1], [1, 'maj7', 1], [0, 'm9', 1], [10, 'm7', 1]] },
  // Dorian: warm minor, lofi and focus
  { id: 'dorian-1', mode: 'dorian', moods: ['deep', 'jazzy', 'house'], chords: [[0, 'm9', 1], [5, '9', 1]] },
  { id: 'dorian-2', mode: 'dorian', moods: ['deep', 'jazzy'], chords: [[0, 'm11', 1], [3, 'maj9', 1], [10, '6', 1], [5, '9', 1]] },
  { id: 'dorian-3', mode: 'dorian', moods: ['deep', 'house'], chords: [[0, 'm9', 2], [10, '69', 1], [5, '9', 1]] },
  { id: 'dorian-4', mode: 'dorian', moods: ['jazzy', 'deep'], chords: [[0, 'm9', 1], [2, 'm7', 1], [3, 'maj7', 1], [5, '13', 1]] },
  // Major-key jazzy: lofi, chillhop
  { id: 'jazz-1', mode: 'ionian', moods: ['cafe', 'jazzy', 'bright'], chords: [[2, 'm9', 1], [7, '13', 1], [0, 'maj9', 1], [9, 'm9', 1]] },
  { id: 'jazz-2', mode: 'ionian', moods: ['cafe', 'jazzy', 'bright'], chords: [[0, 'maj9', 1], [9, 'm9', 1], [2, 'm9', 1], [7, '9sus', 1]] },
  { id: 'jazz-3', mode: 'ionian', moods: ['jazzy'], chords: [[5, 'maj9', 1], [4, 'm7', 1], [9, 'm9', 1], [2, 'm9', 1]] },
  { id: 'jazz-4', mode: 'ionian', moods: ['jazzy'], chords: [[5, 'maj7', 1], [5, 'm6', 1], [4, 'm7', 1], [9, 'm9', 1]] },
  { id: 'jazz-5', mode: 'ionian', moods: ['jazzy', 'bright'], chords: [[0, 'maj7', 1], [5, 'maj7', 1]] },
  { id: 'jazz-6', mode: 'ionian', moods: ['cafe', 'jazzy'], chords: [[9, 'm9', 1], [2, 'm9', 1], [7, '13', 1], [0, 'maj9', 1]] },
  { id: 'jazz-7', mode: 'aeolian', moods: ['jazzy', 'dark'], chords: [[0, 'm9', 1], [8, 'maj9', 1], [2, 'm7b5', 1], [7, '7b9', 1]] },
  { id: 'jazz-8', mode: 'ionian', moods: ['jazzy'], chords: [[2, 'm9', 1], [7, '9sus', 1], [4, 'm7', 1], [9, 'm9', 1]] },
  { id: 'jazz-9', mode: 'ionian', moods: ['cafe', 'jazzy', 'bright'], chords: [[0, 'maj9', 1], [4, 'm7', 1], [5, 'maj9', 1], [7, '9sus', 1]] },
  // Pop minor: synthwave, chillwave
  // Cafe chillhop and soul: the royal road (IV V iii vi) and its III7 turn,
  // ii-V-Is, a minor "just the two of us" turnaround and a two-chord funk vamp.
  { id: 'cafe-1', mode: 'ionian', moods: ['cafe'], chords: [[5, 'maj9', 1], [4, 'm7', 1], [2, 'm9', 1], [7, '13', 1]] },
  { id: 'cafe-2', mode: 'ionian', moods: ['cafe'], chords: [[0, 'maj9', 1], [9, 'm9', 1], [5, 'maj9', 1], [7, '9sus', 1]] },
  { id: 'cafe-3', mode: 'ionian', moods: ['cafe'], chords: [[2, 'm9', 1], [7, '13', 1], [0, 'maj9', 2]] },
  { id: 'cafe-4', mode: 'ionian', moods: ['cafe'], chords: [[0, 'maj9', 1], [4, '7b9', 1], [9, 'm9', 1], [7, '9sus', 1]] },
  { id: 'cafe-5', mode: 'ionian', moods: ['cafe'], chords: [[5, 'maj9', 1], [7, '9', 1], [4, 'm7', 1], [9, 'm9', 1]] },
  { id: 'cafe-6', mode: 'ionian', moods: ['cafe'], chords: [[5, 'maj9', 1], [7, '13', 1], [4, '7b9', 1], [9, 'm9', 1]] },
  { id: 'cafe-7', mode: 'ionian', moods: ['cafe'], chords: [[0, '69', 1], [2, 'm9', 1], [4, 'm7', 1], [5, 'maj9', 1]] },
  { id: 'cafe-8', mode: 'dorian', moods: ['cafe'], chords: [[0, 'm9', 1], [5, '13', 1]] },
  { id: 'cafe-9', mode: 'aeolian', moods: ['cafe'], chords: [[8, 'maj7', 1], [7, '7b9', 1], [0, 'm9', 1], [10, '9', 1]] },
  { id: 'cafe-10', mode: 'aeolian', moods: ['cafe'], chords: [[0, 'm9', 1], [5, 'm9', 1], [10, '13', 1], [3, 'maj9', 1]] },
  { id: 'wave-1', mode: 'aeolian', moods: ['wave'], chords: [[0, 'min', 1], [8, 'maj', 1], [3, 'maj', 1], [10, 'maj', 1]] },
  { id: 'wave-2', mode: 'aeolian', moods: ['wave'], chords: [[8, 'maj', 1], [10, 'maj', 1], [0, 'min', 2]] },
  { id: 'wave-3', mode: 'aeolian', moods: ['wave', 'dark'], chords: [[0, 'min', 1], [10, 'maj', 1], [8, 'maj', 1], [10, 'maj', 1]] },
  { id: 'wave-4', mode: 'aeolian', moods: ['wave'], chords: [[0, 'madd9', 1], [5, 'min', 1], [8, 'maj7', 1], [10, 'sus2', 1]] },
  { id: 'wave-5', mode: 'aeolian', moods: ['wave', 'dark'], chords: [[0, 'min', 2], [8, 'maj7', 2], [5, 'm7', 2], [10, 'sus4', 1], [10, 'maj', 1]] },
  { id: 'wave-6', mode: 'dorian', moods: ['wave'], chords: [[0, 'm7', 1], [5, 'maj', 1], [3, 'maj7', 1], [10, 'maj', 1]] },
  // House and garage vamps
  { id: 'house-1', mode: 'dorian', moods: ['house', 'deep'], chords: [[0, 'm9', 2], [5, 'm9', 2]] },
  { id: 'house-2', mode: 'aeolian', moods: ['house', 'dark'], chords: [[0, 'm7', 1], [10, '6', 1], [8, 'maj7', 1], [10, '6', 1]] },
  { id: 'house-3', mode: 'ionian', moods: ['house', 'bright'], chords: [[2, 'm9', 1], [0, 'maj9', 1], [5, 'maj9', 1], [7, '69', 1]] },
  { id: 'house-4', mode: 'dorian', moods: ['house', 'deep'], chords: [[0, 'm11', 1], [10, 'maj9', 1], [8, 'maj7', 1], [10, 'maj9', 1]] },
  // Ambient: slow, open colours
  { id: 'amb-1', mode: 'lydian', moods: ['ambient', 'bright'], chords: [[0, 'maj7s11', 4], [9, 'm9', 4]] },
  { id: 'amb-2', mode: 'aeolian', moods: ['ambient', 'dark'], chords: [[0, 'madd9', 4], [8, 'maj7', 4]] },
  { id: 'amb-3', mode: 'ionian', moods: ['ambient'], chords: [[5, 'maj9', 4], [0, 'add9', 4]] },
  { id: 'amb-4', mode: 'dorian', moods: ['ambient', 'deep'], chords: [[0, 'm11', 4], [5, '9sus', 2], [3, 'maj9', 2]] },
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
