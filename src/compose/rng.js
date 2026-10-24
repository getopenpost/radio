// Seeded random helpers. Every composition decision goes through one of these,
// so a (style, seed) pair always produces the same track.
export function createRng(seed) {
  let state = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    float: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    /** Pick from [[weight, value], ...]. */
    weighted: (entries) => {
      const total = entries.reduce((sum, [w]) => sum + w, 0);
      let r = next() * total;
      for (const [w, value] of entries) {
        r -= w;
        if (r < 0) return value;
      }
      return entries.at(-1)[1];
    },
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Round to a step, e.g. rng.step(0.2, 0.6, 0.05). Keeps generated code tidy. */
    step: (lo, hi, step) => Math.round((lo + (hi - lo) * next()) / step) * step,
    fork: (salt) => createRng((Math.floor(next() * 4294967296) ^ hashString(String(salt))) >>> 0),
  };
  return rng;
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
