// A scripted fast-forward through everything the scene does, for previews:
// `npm run stream -- --tour --output tmp/tour.mp4` (about twelve minutes). Each scene sets a date
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

// [title, seconds, { day, from/to: local hours (the clock runs between), act, weather, biome, look, stay, cut, events }]
const SCENES = [
  ['Dawn walk through fog', 45, { day: '2026-10-14', from: 6.8, to: 9.1, act: 'walk', weather: weather('fog', 'clear', 45), biome: 'hills', look: 'grass', events: { 10: 'birds', 26: 'plane' } }],
  ['Into the studio to work', 75, { day: '2026-10-14', from: 9.6, to: 9.8, act: 'work', weather: weather('clear', 'clear'), biome: 'village', look: 'bars', stay: 2.2, cut: true }],
  ['Rain, and a chat with a friend', 50, { day: '2026-10-14', from: 12.5, to: 12.7, act: 'walk', weather: weather('cloudy', 'rain', 15), biome: 'village', look: 'dots', cut: true, events: { 16: 'chat' } }],
  ['The calisthenics park', 95, { day: '2026-10-15', from: 10.5, to: 10.7, act: 'gym', weather: weather('clear', 'clear'), biome: 'highlands', look: 'ridge', stay: 2.6, cut: true }],
  ['Rowing across the river', 60, { day: '2026-10-15', from: 14.5, to: 14.7, act: 'river', weather: weather('clear', 'clear'), biome: 'hills', look: 'grass', stay: 2.8, cut: true }],
  ['Cleaning the lake at golden hour', 60, { day: '2026-10-15', from: sunset('2026-10-15') - 1.2, to: sunset('2026-10-15') - 0.7, act: 'fish', weather: weather('windy', 'windy'), biome: 'alpine', look: 'bars', stay: 2.4, cut: true }],
  ['Campfire with friends', 75, { day: '2026-10-15', from: 22.3, to: 22.5, act: 'campfire', weather: weather('clear', 'clear'), biome: 'forest', look: 'grass', stay: 2.4, cut: true }],
  ['Stargazing by the sea', 55, { day: '2026-10-26', from: 22.8, to: 23, act: 'stargaze', weather: weather('clear', 'clear'), biome: 'coast', look: 'bars', stay: 2.2, cut: true }],
  ['Winter: reading on the bench, then a friend', 65, { day: '2027-01-15', from: 12.5, to: 12.7, act: 'read', weather: weather('snow', 'snow'), biome: 'village', look: 'dots', stay: 2.4, cut: true }],
  ['Winter evening by the fire', 65, { day: '2027-01-15', from: 18.2, to: 18.4, act: 'home', weather: weather('snow', 'snow'), biome: 'village', look: 'ridge', stay: 2.2, cut: true }],
  ['Spring: a paper plane over the highlands', 50, { day: '2027-04-20', from: 9.5, to: 9.8, act: 'fly', weather: weather('clear', 'clear'), biome: 'highlands', look: 'ridge', stay: 1.4, cut: true, events: { 24: 'birds' } }],
  ['Halloween: a broom into the night', 45, { day: '2026-10-30', from: sunset('2026-10-30') - 0.2, to: sunset('2026-10-30') + 0.8, act: 'fly', weather: weather('clear', 'clear'), biome: 'alpine', look: 'grass', stay: 1.4, cut: true, events: { 20: 'plane' } }],
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
    const steer = { activity: s.act, key: index, weather: s.weather(into), region: firstRegion(s.biome), look: s.look, fresh: s.cut && into < 1.2 };
    for (const [at, what] of Object.entries(s.events ?? {})) {
      const key = `${index}:${at}`;
      // A meeting waits (up to 15 s) until the fox is walking; sky events fire once.
      if (what === 'chat' || what === 'npc') {
        if (into >= Number(at) && into < Number(at) + 15 && !state.meeting) steer[what] = true;
      } else if (into >= Number(at) && !fired.has(key)) {
        fired.add(key);
        steer.trigger = what;
      }
    }
    const rate = state.mode === 'stay' && state.act === s.act ? s.stay ?? 1.5 : 3;
    return { title, date, steer, rate, cut: s.cut && into < 1.2 ? into / 1.2 : null, scene: index };
  };
}
