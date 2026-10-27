// Short, finite transitions. Content stays solid behind a narrow Bayer band,
// and views finish entering/exiting instead of approaching an asymptote.
import { clamp01 } from './dither.js';

export const MOTION = { viewIn: 0.22, viewOut: 0.14, world: 1.8, tour: 0.36, page: 0.62 };

export function viewAmount(current, target, dt) {
  const duration = target > current ? MOTION.viewIn : MOTION.viewOut;
  const step = Math.max(0, dt) / duration;
  return target > current ? Math.min(target, current + step) : Math.max(target, current - step);
}

export function revealCoverage(position, size, progress, edge = 12) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return clamp01((progress * (size + edge) - position) / edge);
}
