// The fox's frames, read from the animation sheets. Walking is one cycle of twelve
// frames advanced by distance, so stride and ground agree; pedalling and rowing
// follow distance in the same way. The workout is a timed run through its sheets.
export const STRIDE = 46; // ground pixels per full walk cycle
export const WALK_FRAMES = 12;
export const PEDAL_FRAMES = 8;
export const ROW_FRAMES = 12;
export const SAIL_FRAMES = 8;

export const IDLE = { blink: 0, happy: 1, up: 2, waveA: 4, waveB: 5, earA: 6, earB: 7 };
export const LOOK = 1; // eyes shut against the eyepiece, in the gestures sheet
export const BOAT = { moored: 3, sailing: 4, sailMoored: 5 };

// The gym: a pull-up bar, a pair of dip rails a little further on, and a clear
// stretch of road past them. Distances are from the bar.
export const RAILS = 104;
const FLOOR = RAILS + 72;
const PACE = 52; // px/s between stations

// 20 pull-ups, then the rails for 5 dips, back to the bar for 3 muscle-ups, on
// past the rails for 6 push-ups, and away.
const STAGES = [
  ['stand', 0.2, 0], ['crouch', 0.16, 0], ['reach', 0.2, 0],
  ['pull', 12, 0, 20],
  ['drop', 0.34, 0], ['stand', 0.1, 0],
  ['walk', RAILS / PACE, 0, RAILS],
  ['stand', 0.1, RAILS], ['crouch', 0.16, RAILS], ['mount', 0.2, RAILS],
  ['dip', 3.2, RAILS, 5],
  ['dismount', 0.3, RAILS], ['turn', 0.16, RAILS],
  ['walk', RAILS / PACE, RAILS, 0],
  ['turn', 0.16, 0], ['stand', 0.1, 0], ['crouch', 0.16, 0], ['reach', 0.2, 0],
  ['muscle', 4, 0, 3],
  ['drop', 0.34, 0], ['stand', 0.1, 0],
  ['walk', FLOOR / PACE, 0, FLOOR],
  ['down', 0.34, FLOOR],
  ['push', 3.2, FLOOR, 6],
  ['up', 0.34, FLOOR],
];
export const WORKOUT_SECONDS = STAGES.reduce((sum, s) => sum + s[1], 0);
export const WORKOUT_REACH = FLOOR;
export const SCOPE_SECONDS = 5;

/** The routine at `t` seconds: which stage, how far through it (0..1), and where along the road. */
export function workoutAt(t) {
  let at = 0;
  for (const [name, seconds, from, extra] of STAGES) {
    if (t < at + seconds) {
      const p = (t - at) / seconds;
      if (name === 'walk') return { name, p, x: from + (extra - from) * p, back: extra < from };
      return { name, p, x: from, reps: extra };
    }
    at += seconds;
  }
  return { name: 'stand', p: 1, x: FLOOR };
}
