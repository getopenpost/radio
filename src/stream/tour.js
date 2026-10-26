// A scripted fast-forward through everything the scene does, for previews:
// `npm run stream -- --tour --output tmp/tour.mp4`. Each scene sets a date
// (and how fast the clock runs), the weather, the country, what the fox
// does and the visualizer look. Walking and arrivals play at 3x; stops play
// near normal speed so their gestures read. Jumps in time dissolve through
// the dither.
import { localTime, sunTimes } from './scene/clock.js';
import { biomeOf } from './scene/world.js';

const firstRegion = (biome) => {
  for (let r = 249000; ; r++) if (biomeOf(r) === biome) return r;
};

/** A UTC timestamp for a local date and hour in Lisbon. */
function local(day, hours) {
  const noon = new Date(`${day}T12:00:00Z`);
  const { offset } = localTime(noon, 'Europe/Lisbon');
  return Date.parse(`${day}T00:00:00Z`) + (hours - offset) * 3600000;
}
function sunset(day) {
  const t = localTime(new Date(`${day}T12:00:00Z`), 'Europe/Lisbon');
  return sunTimes(t.dayOfYear, t.offset).sunset;
}

const weather = (previous, current, ramp = 0) => (s) => ({ previous, current, mix: ramp ? Math.min(1, s / ramp) : 1 });

// [title, seconds, { from: local start, to: local end (clock runs between), act, weather, biome, look, stay, cut, events }]
const SCENES = [
  ['Dawn walk through fog', 55, { day: '2026-10-14', from: 6.8, to: 9.1, act: 'walk', weather: weather('fog', 'clear', 50), biome: 'hills', look: 'grass', events: { 12: 'birds', 30: 'plane' } }],
  ['Fishing on a windy morning', 60, { day: '2026-10-14', from: 10, to: 10.2, act: 'fish', weather: weather('windy', 'windy'), biome: 'alpine', look: 'bars', stay: 2.2, cut: true }],
  ['Rain rolls in, a friend passes', 70, { day: '2026-10-14', from: 15, to: 15.3, act: 'walk', weather: weather('clear', 'rain', 20), biome: 'village', look: 'dots', cut: true, events: { 38: 'npc' } }],
  ['Working at a desk through dusk', 85, { day: '2026-10-14', from: sunset('2026-10-14') - 0.6, to: sunset('2026-10-14') + 0.9, act: 'desk', weather: weather('rain', 'clear', 15), biome: 'forest', look: 'ridge', stay: 1.6, cut: true }],
  ['Campfire with friends', 90, { day: '2026-10-14', from: 22.3, to: 22.5, act: 'campfire', weather: weather('clear', 'clear'), biome: 'forest', look: 'grass', stay: 2.2, cut: true }],
  ['Stargazing by the lighthouse', 65, { day: '2026-10-14', from: 23.4, to: 23.6, act: 'stargaze', weather: weather('clear', 'clear'), biome: 'coast', look: 'bars', stay: 2 }],
  ['Winter: reading in the snow', 75, { day: '2027-01-15', from: 12.5, to: 12.7, act: 'read', weather: weather('snow', 'snow'), biome: 'village', look: 'dots', stay: 2.2, cut: true }],
  ['Spring: flying a paper plane', 55, { day: '2027-04-20', from: 9.5, to: 9.8, act: 'fly', weather: weather('clear', 'clear'), biome: 'hills', look: 'ridge', stay: 1.4, cut: true, events: { 30: 'birds' } }],
  ['Halloween: a broom into the night', 45, { day: '2026-10-30', from: sunset('2026-10-30') - 0.2, to: sunset('2026-10-30') + 0.8, act: 'fly', weather: weather('clear', 'clear'), biome: 'alpine', look: 'grass', stay: 1.4, cut: true }],
];

export const TOUR_SECONDS = SCENES.reduce((s, [, len]) => s + len, 0);

export function createTour() {
  const fired = new Set();
  /**
   * What the scene should show `seconds` into the tour, given the scene's
   * state (walking and arrivals run faster than stops).
   */
  return function at(seconds, state) {
    let start = 0;
    let index = 0;
    while (index < SCENES.length - 1 && seconds >= start + SCENES[index][1]) start += SCENES[index++][1];
    const [title, length, s] = SCENES[index];
    const into = seconds - start;
    const p = Math.min(1, into / length);
    const date = new Date(local(s.day, s.from + (s.to - s.from) * p));
    const steer = { activity: s.act, weather: s.weather(into), region: firstRegion(s.biome), look: s.look };
    for (const [at, what] of Object.entries(s.events ?? {})) {
      const key = `${index}:${at}`;
      if (into >= Number(at) && !fired.has(key)) {
        fired.add(key);
        if (what === 'npc') steer.npc = true;
        else steer.trigger = what;
      }
    }
    const rate = state.mode === 'stay' && state.act === s.act ? s.stay ?? 1.5 : 3;
    return { title, date, steer, rate, cut: s.cut && into < 1.2 ? into / 1.2 : null, scene: index };
  };
}
