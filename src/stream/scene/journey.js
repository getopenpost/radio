// Where the fox is going. The journey is laid out along distance, so what comes
// next depends only on how far it has walked: countries, seasons, the lake it
// rows across, the bicycle left by a fence, the bars by the road. Seasons are
// places here. The fox walks out of autumn and into the snow, and because the
// distant layers show the road ahead, the white peaks arrive first.
import { createRng, hashString } from '../../compose/rng.js';
import { smooth } from './dither.js';

export const WALK_SPEED = 48; // px/s of ground; one stride takes about 0.96 s
export const LEG = 14000; // a country lasts about five minutes on foot
const BLEND = 2600;
export const YEAR = 660000; // ground pixels per trip round the seasons, about four hours
const EPOCH = Date.UTC(2026, 0, 1);

/** How far the fox has come at a moment. A restart resumes in the same country. */
export const distanceAt = (date) => ((date.getTime() - EPOCH) / 1000) * WALK_SPEED;

export const COUNTRIES = {
  meadow: { peak: 0.12, hill: 0.75, forest: 0.32, lake: 0, sea: 0, river: 0, town: 0.85, farm: 0.8, alpine: 0 },
  valley: { peak: 0.3, hill: 0.9, forest: 0.42, lake: 0, sea: 0, river: 1, town: 0.65, farm: 0.45, alpine: 0 },
  lake: { peak: 0.45, hill: 0.55, forest: 0.45, lake: 1, sea: 0, river: 0, town: 0.6, farm: 0.2, alpine: 0.2 },
  alpine: { peak: 1, hill: 1, forest: 0.55, lake: 0, sea: 0, river: 0, town: 0.5, farm: 0.1, alpine: 1 },
  forest: { peak: 0.2, hill: 0.8, forest: 1, lake: 0, sea: 0, river: 0, town: 0.15, farm: 0.05, alpine: 0 },
  coast: { peak: 0, hill: 0.25, forest: 0.14, lake: 0, sea: 1, river: 0, town: 0.4, farm: 0.15, alpine: 0 },
};
const WEIGHTS = [[5, 'meadow'], [4, 'valley'], [3, 'lake'], [3, 'alpine'], [3, 'forest'], [2, 'coast']];

const kinds = new Map();
function countryOf(leg) {
  if (kinds.has(leg)) return kinds.get(leg);
  const rng = createRng(hashString(`country:${leg}`));
  let kind = rng.weighted(WEIGHTS);
  // Avoid the same country twice running; the check uses the raw draw of the
  // neighbour, so any leg can be answered without walking from the start.
  const before = createRng(hashString(`country:${leg - 1}`)).weighted(WEIGHTS);
  if (kind === before) kind = kind === 'meadow' ? 'valley' : 'meadow';
  if (kinds.size > 400) kinds.clear();
  kinds.set(leg, kind);
  return kind;
}

const FIELDS = Object.keys(COUNTRIES.meadow);
const out = {};
/** Blended country numbers at a distance. The returned object is reused. */
export function geography(d) {
  const leg = Math.floor(d / LEG);
  const into = d - leg * LEG;
  const a = COUNTRIES[countryOf(leg)];
  let other = null;
  let t = 0;
  if (into < BLEND / 2) {
    other = COUNTRIES[countryOf(leg - 1)];
    t = 1 - smooth(0.5 + into / BLEND);
  } else if (into > LEG - BLEND / 2) {
    other = COUNTRIES[countryOf(leg + 1)];
    t = smooth((into - (LEG - BLEND / 2)) / BLEND);
  }
  for (const f of FIELDS) out[f] = other ? a[f] + (other[f] - a[f]) * t : a[f];
  return out;
}

/** Season weights at a distance: spring, summer, autumn, winter sum to 1. */
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TURN = 0.05; // the fraction of a season spent changing into the next
const climateOut = { spring: 0, summer: 0, autumn: 0, winter: 0 };
export function climate(d) {
  const y = (((d / YEAR) % 1) + 1) % 1;
  const q = y * 4;
  const i = Math.floor(q);
  const f = q - i;
  const t = smooth((f - (1 - TURN)) / TURN);
  for (const s of SEASONS) climateOut[s] = 0;
  climateOut[SEASONS[i]] = 1 - t;
  climateOut[SEASONS[(i + 1) % 4]] += t;
  return climateOut;
}

/** The main season at a distance. */
export function seasonAt(d) {
  const c = climate(d);
  return SEASONS.reduce((best, s) => (c[s] > c[best] ? s : best), 'spring');
}

const SPEEDS = { walk: WALK_SPEED, bike: 78, row: 26, sail: 46, broom: 62 };
export const speedOf = (mode) => SPEEDS[mode];

const plans = new Map();
/**
 * A leg's events, as distances. Moving events span a..b. Stops sit at one
 * distance and hold the ground still; workouts come every fifth leg, so the
 * fox stays in motion 95% of the time or better.
 */
export function legPlan(leg) {
  if (plans.has(leg)) return plans.get(leg);
  const rng = createRng(hashString(`leg:${leg}`));
  const country = countryOf(leg);
  const start = leg * LEG;
  const events = [];
  let free = start + BLEND;
  if (country === 'lake') {
    const a = start + rng.int(3600, 4600);
    const b = a + rng.int(2800, 4000);
    events.push({ kind: 'row', a, b, id: `row:${leg}` });
    free = b + 700;
  } else if (country === 'coast') {
    const a = start + rng.int(3200, 4200);
    const b = a + rng.int(6000, 7600);
    events.push({ kind: 'sail', a, b, id: `sail:${leg}` });
    free = b + 700;
  }
  const end = start + LEG - BLEND;
  if (country !== 'lake' && country !== 'coast') {
    const roll = rng.float(0, 1);
    if (roll < 0.34 && end - free > 6000) {
      const a = free + rng.int(1000, 3000);
      const b = a + rng.int(3600, 5200);
      events.push({ kind: 'bike', a, b, id: `bike:${leg}` });
      free = b + 800;
    } else if (roll < 0.5 && end - free > 5000) {
      const a = free + rng.int(800, 2400);
      const b = a + rng.int(3000, 4200);
      events.push({ kind: 'broom', a, b, id: `broom:${leg}` });
      free = b + 800;
    }
  }
  if (((leg % 5) + 5) % 5 === 4 && end - free > 1200) {
    events.push({ kind: 'workout', a: free + rng.int(300, end - free - 500), id: `workout:${leg}` });
    free = events.at(-1).a + 700;
  }
  if (rng.chance(country === 'alpine' || country === 'lake' || country === 'coast' ? 0.6 : 0.2) && end - free > 900) {
    events.push({ kind: 'scope', a: free + rng.int(200, end - free - 400), id: `scope:${leg}` });
  }
  for (const e of events) e.b ??= e.a;
  if (plans.size > 200) plans.clear();
  plans.set(leg, { country, events });
  return plans.get(leg);
}

/** Events touching a stretch of road, in order. */
export function eventsIn(from, to) {
  const found = [];
  for (let leg = Math.floor(from / LEG) - 1; leg <= Math.floor(to / LEG); leg++) {
    for (const e of legPlan(leg).events) if (e.b >= from && e.a <= to) found.push(e);
  }
  return found;
}

/** The moving event under the fox, if any. */
export function movingAt(d) {
  for (const e of eventsIn(d, d)) if (e.b > e.a && d >= e.a && d < e.b) return e;
  return null;
}

/** The water crossing covering a distance, if any. */
export function waterAt(d) {
  for (const e of eventsIn(d, d)) if ((e.kind === 'row' || e.kind === 'sail') && d >= e.a && d < e.b) return e;
  return null;
}

/** The next stop at or after a distance, within `reach`. */
export function nextStop(d, reach) {
  for (const e of eventsIn(d, d + reach)) if (e.a === e.b && e.a >= d) return e;
  return null;
}

/** For previews: the first event of a kind, or the first stretch of a country or season, after a distance. */
export function findPlace(want, from = 0) {
  for (let leg = Math.floor(from / LEG); leg < Math.floor(from / LEG) + 4000; leg++) {
    const plan = legPlan(leg);
    const e = plan.events.find((v) => v.kind === want && v.a >= from);
    if (e) return e;
    if (plan.country === want && leg * LEG >= from) return { kind: want, a: leg * LEG + LEG / 2, b: leg * LEG + LEG / 2 };
  }
  throw new Error(`nowhere to find ${want}`);
}
