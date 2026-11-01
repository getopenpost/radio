// Short, finite transitions behind a narrow Bayer band.
import { clamp01 } from './dither.js';

export const MOTION = { tour: 0.36 };

export function revealCoverage(position, size, progress, edge = 12) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return clamp01((progress * (size + edge) - position) / edge);
}
