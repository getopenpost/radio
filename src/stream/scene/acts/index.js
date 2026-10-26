// What the fox stops to do. Each activity draws its set, choreographs the fox
// through an intro, a long middle with small events, and an outro, and
// reports light sources for night glows. Some walk the fox through their set
// (indoors, the gym, the river) by asking the ground to move.
//
// Context: `t` is seconds since the fox stopped (negative while the set
// scrolls in); `out` is seconds into the outro (0 until it starts); `X` is
// the set's origin on screen and `foxX` the fox's, so `foxX - X` is where the
// fox is in the set; `state` persists for the visit. Anchored sets are part of
// the ground and scroll with it; unanchored ones travel with the fox.
//
// An activity returns { pose, speed, lift, done, after(paws) } or null.
import campfire from './campfire.js';
import fish from './fish.js';
import fly from './fly.js';
import gym from './gym.js';
import { home, work } from './house.js';
import read from './read.js';
import river from './river.js';
import stargaze from './stargaze.js';

const ALL = { fish, work, home, campfire, read, stargaze, fly, river, gym };

export const ACTS = Object.fromEntries(Object.entries(ALL).map(([k, v]) => [k, v.spec]));

export function drawAct(kind, c) {
  return ALL[kind].draw(c);
}
