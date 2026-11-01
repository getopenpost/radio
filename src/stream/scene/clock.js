// Everything the scene derives from the wall clock: daylight, the sun's and
// moon's arcs, the moon's phase and the weather. All of it is a pure function
// of time, so the stream looks right after a restart and two renderers agree.
import { createRng, hashString } from '../../compose/rng.js';

const DAY_MS = 86400000;
const formatters = new Map();

/** Local calendar parts for a time zone. */
export function localTime(date, timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }));
  const parts = Object.fromEntries(
    formatters.get(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  );
  const start = Date.UTC(parts.year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(parts.year, parts.month - 1, parts.day) - start) / DAY_MS);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  const offset = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000) / 60;
  return { ...parts, hours: (parts.hour % 24) + parts.minute / 60 + parts.second / 3600, dayOfYear, offset };
}

/** Sunrise and sunset in local hours for Porto, from the day of year and the zone's UTC offset in hours. */
export function sunTimes(dayOfYear, offset = 0, latitude = 41.15, longitude = -8.61) {
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const rad = Math.PI / 180;
  const cosH = -Math.tan(latitude * rad) * Math.tan(decl * rad);
  const halfDay = (Math.acos(Math.max(-1, Math.min(1, cosH))) / rad) / 15;
  // Solar noon from the longitude plus the equation of time (minutes).
  const b = ((2 * Math.PI) / 365) * (dayOfYear - 81);
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const noon = 12 - longitude / 15 - eot / 60 + offset;
  return { sunrise: noon - halfDay, sunset: noon + halfDay };
}

/** Moon age as a fraction of the synodic month: 0 new, 0.5 full. */
export function moonPhase(date) {
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const synodic = 29.530588853 * DAY_MS;
  return ((((date.getTime() - knownNew) % synodic) + synodic) % synodic) / synodic;
}

export function seasonOf(month) {
  return month === 12 || month <= 2 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn';
}

/**
 * Sky state at a moment: light level, sun and moon positions along their arcs
 * (both travel right to left, with the world), and twilight warmth.
 */
export function sky(date, timeZone, dayMinutes = 0) {
  const t = localTime(date, timeZone);
  const { sunrise, sunset } = dayMinutes ? { sunrise: 6, sunset: 18 } : sunTimes(t.dayOfYear, t.offset);
  const h = dayMinutes ? (6 + ((date.getTime() % (dayMinutes * 60000)) / (dayMinutes * 60000)) * 24) % 24 : t.hours;
  const twilight = 0.8; // hours of fade either side of sunrise and sunset
  let light;
  if (h < sunrise - twilight || h > sunset + twilight) light = 0;
  else if (h < sunrise + twilight) light = (h - (sunrise - twilight)) / (2 * twilight);
  else if (h > sunset - twilight) light = 1 - (h - (sunset - twilight)) / (2 * twilight);
  else light = 1;
  light = light * light * (3 - 2 * light); // smoothstep
  const sunProgress = (h - sunrise) / (sunset - sunrise); // 0 rising (right) .. 1 setting (left)
  const nightLength = 24 - (sunset - sunrise);
  const moonProgress = (((h - sunset + 24) % 24) / nightLength);
  const warmth = Math.max(0, 1 - Math.min(Math.abs(h - sunrise), Math.abs(h - sunset)) / 1.2); // golden hour
  return {
    light,
    warmth,
    sun: sunProgress > -0.05 && sunProgress < 1.05 ? sunProgress : null,
    moon: moonProgress >= 0 && moonProgress <= 1 ? moonProgress : null,
    moonAge: moonPhase(date),
    season: seasonOf(t.month),
    hours: h,
    dayOfYear: t.dayOfYear,
    month: t.month,
    day: t.day,
  };
}

// Weather changes every 90 minutes, drawn from the season. Each block blends
// into the next over ten minutes.
const WEATHER = {
  winter: [[3, 'clear'], [3, 'cloudy'], [2, 'snow'], [1, 'fog'], [1, 'rain']],
  spring: [[4, 'clear'], [3, 'cloudy'], [2, 'rain'], [1, 'fog']],
  summer: [[7, 'clear'], [2, 'cloudy'], [1, 'rain']],
  autumn: [[3, 'clear'], [3, 'cloudy'], [2, 'rain'], [1, 'fog'], [1, 'windy']],
};
const WEATHER_BLOCK = 90 * 60000;

export function weather(date, season, dayMinutes = 0) {
  const blockMs = dayMinutes ? dayMinutes * 60000 * 0.3 : WEATHER_BLOCK;
  const block = Math.floor(date.getTime() / blockMs);
  const pick = (b) => createRng(hashString(`weather:${b}`)).weighted(WEATHER[season]);
  const into = (date.getTime() % blockMs) / (dayMinutes ? 90000 : 600000);
  const previous = pick(block - 1);
  const current = pick(block);
  const mix = Math.min(1, into);
  return { previous, current, mix };
}

/** Intensity of one kind of weather right now, blended across block changes. */
export function weatherAmount(w, kind) {
  return (w.previous === kind ? 1 - w.mix : 0) + (w.current === kind ? w.mix : 0);
}
