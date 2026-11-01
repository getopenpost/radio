// A scripted fast-forward through what the scene does, for previews:
// `npm run stream -- --tour --output tmp/tour.mp4`. Each stop picks a place on
// the road (a kind of country or travel, in a season), a time of day and the
// weather, then lets the fox carry on from there. Cuts dissolve through the dither.
import { findPlace, YEAR } from './scene/journey.js';
import { localTime } from './scene/clock.js';
import { MOTION } from './scene/motion.js';
import { WORKOUT_SECONDS } from './scene/acts.js';

const QUARTER = { spring: 0.1, summer: 0.35, autumn: 0.6, winter: 0.85 };
const BASE = Math.floor(5e8 / YEAR) * YEAR;
const steady = (kind) => ({ previous: kind, current: kind, mix: 1 });

/** A UTC timestamp for a local hour in Lisbon on a fixed day. */
function local(hours) {
  const day = '2026-06-21';
  const { offset } = localTime(new Date(`${day}T12:00:00Z`), 'Europe/Lisbon');
  return Date.parse(`${day}T00:00:00Z`) + (hours - offset) * 3600000;
}

// [title, seconds, place, season, from/to local hours, weather, metres before the place, measured from its far end]
const SCENES = [
  ['Autumn walk through the meadows', 24, 'meadow', 'autumn', 17.5, 18.5, 'clear', 0],
  ['A bicycle by the road', 26, 'bike', 'autumn', 13, 13.5, 'clear', 220],
  ['Off the bicycle', 12, 'bike', 'autumn', 13.5, 13.7, 'clear', 300, true],
  ['Rain in the forest', 20, 'forest', 'summer', 12, 12.5, 'rain', 0],
  ['Rowing a spring lake', 30, 'row', 'spring', 7.5, 8.5, 'clear', 180],
  ['Ashore', 12, 'row', 'spring', 8.5, 8.7, 'clear', 200, true],
  ['Into the mountains', 20, 'alpine', 'summer', 9.5, 10, 'clear', 0],
  ['Snow in the pass', 24, 'alpine', 'winter', 11, 11.5, 'snow', 0],
  ['Winter night in the village', 20, 'meadow', 'winter', 23, 23.5, 'clear', 0],
  ['Sailing into the sunset', 28, 'sail', 'summer', 20, 21, 'clear', 150],
  ['Back on the quay', 12, 'sail', 'summer', 21, 21.2, 'clear', 260, true],
  ['The roadside bars', WORKOUT_SECONDS + 10, 'workout', 'summer', 11, 11.2, 'clear', 120],
  ['A look through the telescope', 14, 'scope', 'spring', 18, 18.2, 'clear', 120],
  ['A broom into the dusk', 26, 'broom', 'autumn', 20.2, 21.2, 'clear', 120],
  ['Down from the broom', 12, 'broom', 'autumn', 21.2, 21.4, 'clear', 300, true],
];

export const TOUR_SECONDS = SCENES.reduce((s, scene) => s + scene[1], 0);

export function createTour() {
  /** What the scene should show `seconds` into the tour. */
  return function at(seconds) {
    let start = 0;
    let index = 0;
    while (index < SCENES.length - 1 && seconds >= start + SCENES[index][1]) start += SCENES[index++][1];
    const [title, length, place, season, from, to, weather, before, fromEnd] = SCENES[index];
    const into = seconds - start;
    const event = findPlace(place, BASE + QUARTER[season] * YEAR);
    const date = new Date(local(from + (to - from) * Math.min(1, into / length)));
    return { title, date, rate: 1, steer: { at: (fromEnd ? event.b : event.a) - before, weather: steady(weather) }, cut: into < MOTION.tour ? into / MOTION.tour : null, scene: index };
  };
}
