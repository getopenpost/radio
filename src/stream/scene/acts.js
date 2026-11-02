// The fox's frames, read from the animation sheets. Walking uses painted poses
// advanced by distance, so stride and ground agree; pedalling and rowing
// follow distance in the same way. The workout is a timed run through its sheets.
import { walkCycleOf } from './nature.js';

export const STRIDE = 46; // ground pixels between friends' footfalls and footprints
/**
 * The walking pose for a distance. A sheet's poses are laid out by where the planted
 * heel sits (`walk` in sprites.json): advancing through them with the ground keeps that
 * foot still on the road. The second half of the cycle is the first with the legs swapped.
 */
export function walkFrame(distance, sheet = 'walk12') {
  const { stride, steps } = walkCycleOf(sheet);
  const p = ((distance % stride) + stride) % stride;
  const half = stride / 2;
  const second = p >= half ? 1 : 0;
  const d = p - second * half;
  let best = 0;
  for (let i = 1; i < steps.length; i++) if (Math.abs(steps[i] - d) < Math.abs(steps[best] - d)) best = i;
  // Nearer the next step's start than any pose of this one: it has already landed.
  if (half - d < Math.abs(steps[best] - d)) return ((second + 1) % 2) * steps.length;
  return second * steps.length + best;
}
export const PEDAL_FRAMES = 8;
export const ROW_FRAMES = 12;
export const SAIL_FRAMES = 8;

export const IDLE = { blink: 0, happy: 1, up: 2, waveA: 4, waveB: 5, earA: 6, earB: 7 };
export const LOOK = 1; // eyes shut against the eyepiece, in the gestures sheet
export const BOAT = { moored: 3, sailMoored: 5 };
export const BROOM = { fly: [0, 1, 2], alone: 5 };

// The gym: a pull-up bar, a pair of rails a little further on, and a clear stretch
// of road past them. Distances are from the bar.
export const RAILS = 132;
const FLOOR = RAILS + 84;
const PACE = 52; // px/s between stations

// Hold the end pose without speeding up the painted lift or lowering.
const seq = (sheet, frames, step, hold = -1) => frames.map((f) => [sheet, f, step + (f === hold ? 0.3 : 0)]);
const twice = (list, n) => Array.from({ length: n }, () => list).flat();
const PULL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MUSCLE = [0, 12, 13, 14, 15, 16, 17, 17, 16, 15, 3, 1];
const DIP = [0, 1, 2, 3, 4, 3, 2, 1];
const PUSH = [0, 1, 2, 3, 4, 3, 2, 1];
// A step is [sheet, frame, seconds, lift], where lift runs from one height to another,
// as a share of the way up to the bar or rails.
const STAND = ['gym', 2, 0.12];
const CROUCH = ['gym', 5, 0.14];
const UP_TO_BAR = [STAND, CROUCH, ['hop', 3, 0.1, [0, 0.4]], ['gym', 6, 0.16, [0.4, 1]]];
const DOWN_FROM_BAR = [['gym', 7, 0.3, [1, 0]], CROUCH, STAND];
const UP_TO_RAILS = [STAND, CROUCH, ['hop', 3, 0.1, [0, 0.45]], ['hop', 4, 0.12, [0.45, 1]]];
const DOWN_FROM_RAILS = [['hop', 6, 0.26, [1, 0]], CROUCH, STAND];
const DOWN_TO_FLOOR = [STAND, CROUCH];
const UP_FROM_FLOOR = [CROUCH, STAND];

// 20 pull-ups, then the rails for 5 dips, back to the bar for 3 muscle-ups, on past
// the rails for 6 push-ups, and away.
const STAGES = [
  { name: 'ready', x: 0, steps: UP_TO_BAR },
  { name: 'pull', x: 0, steps: twice(seq('pullup', PULL, 0.15, 5), 20) },
  { name: 'done', x: 0, steps: DOWN_FROM_BAR },
  { name: 'walk', from: 0, to: RAILS },
  { name: 'ready', x: RAILS, steps: UP_TO_RAILS },
  { name: 'dip', x: RAILS, steps: twice(seq('dip', DIP, 0.1875, 4), 5) },
  { name: 'done', x: RAILS, steps: DOWN_FROM_RAILS },
  { name: 'turn', x: RAILS, steps: [['gym', 3, 0.18]] },
  { name: 'walk', from: RAILS, to: 0 },
  { name: 'turn', x: 0, steps: [['gym', 3, 0.18]] },
  { name: 'ready', x: 0, steps: UP_TO_BAR },
  { name: 'muscle', x: 0, steps: twice(seq('pullup', MUSCLE, 0.225), 3) },
  { name: 'done', x: 0, steps: DOWN_FROM_BAR },
  { name: 'walk', from: 0, to: FLOOR },
  { name: 'ready', x: FLOOR, steps: DOWN_TO_FLOOR },
  { name: 'push', x: FLOOR, steps: twice(seq('pushup', PUSH, 0.1875, 4), 6) },
  { name: 'done', x: FLOOR, steps: UP_FROM_FLOOR },
];
const lengthOf = (s) => (s.name === 'walk' ? Math.abs(s.to - s.from) / PACE : s.steps.reduce((sum, step) => sum + step[2], 0));
export const WORKOUT_SECONDS = STAGES.reduce((sum, s) => sum + lengthOf(s), 0);
export const WORKOUT_REACH = FLOOR;
export const SCOPE_SECONDS = 5;

/** The routine at `t` seconds: the stage, where along the road, the painted frame and its lift. */
export function workoutAt(t) {
  let at = 0;
  for (const stage of STAGES) {
    const seconds = lengthOf(stage);
    if (t < at + seconds) {
      if (stage.name === 'walk') return { name: 'walk', x: stage.from + (stage.to - stage.from) * ((t - at) / seconds), back: stage.to < stage.from };
      let into = t - at;
      for (const [sheet, frame, step, lift] of stage.steps) {
        if (into < step) {
          const p = into / step;
          return { name: stage.name, x: stage.x, sheet, frame, lift: lift ? lift[0] + (lift[1] - lift[0]) * (lift[1] < lift[0] ? p * p : 1 - (1 - p) ** 2) : 0 };
        }
        into -= step;
      }
    }
    at += seconds;
  }
  return { name: 'done', x: FLOOR, sheet: 'gym', frame: 2, lift: 0 };
}
