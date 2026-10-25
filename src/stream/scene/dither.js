// Ordered dithering, after OpenPost's Dither material (itself adapted from
// Dither Kit): two neighbouring colours, solid at each end, with a 4x4 Bayer
// transition between them. The scene is drawn in palette indices, so every
// gradient, soft edge and glow is such a two-colour Bayer band. Patterns are
// anchored to the layer they belong to, so moving layers carry their dither
// with them instead of crawling under it.

const ORDER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Thresholds in (0, 1), indexed [(y & 3) * 4 + (x & 3)]. */
export const BAYER = Float32Array.from(ORDER, (v) => (v + 0.5) / 16);

export const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

/** Smoothstep, for easing anything that should start and stop softly. */
export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Coverage for a band between two solid ends: 0 up to `from`, 1 from `to`,
 * eased in between. OpenPost keeps 15% solid at each end of a transition.
 */
export const band = (t, from = 0.15, to = 0.85) => smooth((t - from) / (to - from));
