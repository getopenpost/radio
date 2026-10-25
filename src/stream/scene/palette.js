// The scene's colours. Everything is drawn as palette slots; each frame the
// slots are recoloured for the time of day, the season and the weather. So
// dawn, dusk, fog and a full moon cost nothing per pixel.
//
// The stream is always in dark mode, after OpenPost's Dither dark scheme:
// warm charcoal at neutral hue 50 with the orange-brown signal at hue 45.
// Daylight lifts the charcoal and lights the textures; night sinks them to
// near black under the moon and stars. Layers are two-tone pairs (a lit
// texture over a dark base) so the Bayer bands read as texture, and depth
// order stays the same at every hour.

const NAMES = [
  'sky0', 'sky1', 'sky2', 'sunGlow', 'sun', 'moon', 'moonDark', 'star', 'cloud', 'cloudShade',
  'far0', 'far1', 'peak', 'glacier', 'sea0', 'sea1',
  'hill0', 'hill1', 'pine0', 'pine1', 'leaf0', 'leaf1', 'blossom', 'snowcap', 'trunk', 'roof', 'wall', 'window', 'windowOff',
  'ground0', 'ground1', 'path', 'pathEdge', 'flower',
  'water0', 'water1', 'waterHi',
  'grass', 'grassTip',
  'fur', 'furDark', 'cream', 'outline', 'blush', 'bag', 'bunny', 'bunnyDark', 'bear', 'bearDark', 'ink', 'paper', 'screen', 'cat', 'logo',
  'fire0', 'fire1', 'fire2', 'glow0', 'glow1', 'smoke', 'lampLight',
  'rain', 'snow', 'leafFall', 'light', 'banner', 'pill', 'hat', 'straw',
];
export const S = Object.fromEntries(NAMES.map((n, i) => [n, i]));
export const SLOTS = NAMES.length;
export const CLEAR = 255;

/** sRGB bytes from '#rrggbb' or 'oklch(L C H)' (OpenPost defines its signal colours in OKLCH). */
function rgb(value) {
  if (value.startsWith('#')) return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  const [L, C, H] = value.match(/[\d.]+/g).map(Number);
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return linear.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  });
}
const table = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rgb(v)]));

const DAY = table({
  sky0: '#161311', sky1: '#1c1916', sky2: '#26211d', sunGlow: '#3b2c21', sun: 'oklch(0.76 0.14 45)', moon: '#cfc8bd', moonDark: '#221e1b', star: '#8a8178',
  cloud: '#2e2925', cloudShade: '#221e1b',
  far0: '#4a433d', far1: '#2a2521', peak: '#4a433d', glacier: '#a39b90', sea0: '#2b3231', sea1: '#1f2524',
  hill0: '#3a3430', hill1: '#211d1a', pine0: '#323628', pine1: '#22251c', leaf0: '#3e4430', leaf1: '#2c3122', blossom: '#3e4430', snowcap: '#323628',
  trunk: '#3a2e25', roof: 'oklch(0.4 0.1 45)', wall: '#4a433d', window: '#2a2522', windowOff: '#2a2522',
  ground0: '#2e2925', ground1: '#221e1b', path: '#3a3530', pathEdge: '#1a1715', flower: '#221e1b',
  water0: '#28302f', water1: '#1c2221', waterHi: '#9aa29f',
  grass: '#0f0d0c', grassTip: '#3d3732',
  fur: 'oklch(0.6 0.14 45)', furDark: 'oklch(0.46 0.12 45)', cream: '#f2e6d4', outline: 'oklch(0.22 0.04 45)', blush: 'oklch(0.68 0.12 30)', bag: 'oklch(0.36 0.06 55)',
  bunny: '#cfc8bd', bunnyDark: '#8f877c', bear: '#6b5242', bearDark: '#4a372b', ink: '#0e0c0b', paper: '#d9d2c7', screen: '#fff4e0', cat: '#5a524b', logo: 'oklch(0.76 0.14 45)',
  fire0: '#e0702a', fire1: '#f2a548', fire2: '#fbe3a0', glow0: '#3a2618', glow1: '#6a3f22', smoke: '#4a433d', lampLight: '#efe9de',
  rain: '#5f5850', snow: '#d8d1c7', leafFall: 'oklch(0.55 0.12 45)', light: '#f4f1ea', banner: '#d9d2c7', pill: 'oklch(0.19 0.013 50)',
  hat: '#5f5751', straw: '#c9a25a',
});

const NIGHT = table({
  sky0: '#0f0d0c', sky1: '#141210', sky2: '#1b1815', sunGlow: '#1b1815', sun: '#1b1815', moon: '#ece7df', moonDark: '#1f1b18', star: '#fff6e5',
  cloud: '#221e1b', cloudShade: '#181513',
  far0: '#252120', far1: '#171412', peak: '#252120', glacier: '#4a443f', sea0: '#171a1a', sea1: '#101211',
  hill0: '#1c1917', hill1: '#100e0d', pine0: '#121310', pine1: '#0c0d0b', leaf0: '#14150f', leaf1: '#0e0f0b', blossom: '#14150f', snowcap: '#121310',
  trunk: '#0d0b0a', roof: '#110f0d', wall: '#1a1715', window: '#fdb36b', windowOff: '#1a1715',
  ground0: '#15120f', ground1: '#0e0c0b', path: '#1c1916', pathEdge: '#0b0908', flower: '#0e0c0b',
  water0: '#161919', water1: '#0f1111', waterHi: '#6a6a64',
  grass: '#060504', grassTip: '#1d1916',
  fur: 'oklch(0.56 0.11 45)', furDark: 'oklch(0.42 0.09 45)', cream: '#a79a89', outline: 'oklch(0.16 0.03 45)', blush: 'oklch(0.5 0.09 30)', bag: 'oklch(0.26 0.04 55)',
  bunny: '#8a8277', bunnyDark: '#57504a', bear: '#4a3a30', bearDark: '#2f241e', ink: '#070605', paper: '#9a9086', screen: '#ffe8c4', cat: '#5a524b', logo: 'oklch(0.76 0.14 45)',
  fire0: '#fd7d3a', fire1: '#ffb35c', fire2: '#fff0c4', glow0: '#3a2618', glow1: '#6a3f22', smoke: '#3a332e', lampLight: '#ffd9a0',
  rain: '#4a433d', snow: '#d8d1c7', leafFall: '#4a2f1f', light: '#fff6e5', banner: '#b8b0a5', pill: 'oklch(0.17 0.012 50)',
  hat: '#4a443f', straw: '#8a6f40',
});

// Sunrise and sunset: the low sun warms the sky and the far hills.
const GOLDEN = table({
  sky0: '#1e1714', sky1: '#2a1c15', sky2: '#4a2616', sunGlow: '#5e2f17', sun: '#e8692a', cloud: '#4a2c1c', cloudShade: '#331f15',
  far0: '#55392a', far1: '#2e211a', sea0: '#4a2b1c', sea1: '#2a1b13', water0: '#4a2b1c', water1: '#2a1b13',
});

// Seasons recolour the vegetation and the ground. Day and night pairs.
const SEASONS = {
  spring: {
    day: table({ leaf0: '#46503a', leaf1: '#323a29', blossom: '#b9a49c', flower: '#8f857a', grassTip: '#3c4232' }),
    night: table({ blossom: '#2a2421', flower: '#1d1916' }),
  },
  summer: {
    day: table({ leaf0: '#3e4630', leaf1: '#2c3222', flower: 'oklch(0.6 0.12 70)', grassTip: '#363a2b' }),
    night: table({}),
  },
  autumn: {
    day: table({ leaf0: 'oklch(0.52 0.13 45)', leaf1: 'oklch(0.4 0.1 45)', blossom: 'oklch(0.62 0.12 70)', pine0: '#34352a', ground0: '#302a24', flower: '#4a3f33', grassTip: '#4a3a2c' }),
    night: table({ leaf0: '#1f150e', leaf1: '#160f0a', blossom: '#1f150e' }),
  },
  winter: {
    day: table({
      peak: '#a39b90', snowcap: '#a39b90', pine0: '#2f302a', pine1: '#22231e', leaf0: '#3a342e', leaf1: '#2a2622', blossom: '#a39b90',
      ground0: '#5a554f', ground1: '#46423d', path: '#4f4a44', pathEdge: '#36322e', flower: '#46423d',
      hill0: '#4a4540', hill1: '#36322e', water0: '#4f5452', water1: '#3e4341', waterHi: '#cfd3d1', grassTip: '#6a655e',
    }),
    night: table({
      peak: '#3a3531', snowcap: '#2e2a26', ground0: '#24201d', ground1: '#1c1917', path: '#211d1a', hill0: '#1e1b18', hill1: '#191614',
      water0: '#28231f', water1: '#201c19', grassTip: '#2a2622',
    }),
  },
};

// How far each slot sits in depth, for fog and haze (0 near, 1 far).
const DEPTH = { far0: 0.85, far1: 0.85, peak: 0.85, glacier: 0.85, sea0: 0.8, sea1: 0.8, hill0: 0.55, hill1: 0.55, pine0: 0.5, pine1: 0.5, leaf0: 0.5, leaf1: 0.5, blossom: 0.5, snowcap: 0.5, trunk: 0.45, roof: 0.45, wall: 0.45, cloud: 0.3, cloudShade: 0.3, ground0: 0.2, ground1: 0.2, path: 0.2, pathEdge: 0.2, flower: 0.2, water0: 0.2, water1: 0.2 };
const SKY_SLOTS = new Set(['sky0', 'sky1', 'sky2', 'sunGlow', 'cloud', 'cloudShade']);
// Light sources and the interface keep their colour whatever the weather.
const UNLIT = new Set(['window', 'screen', 'fire0', 'fire1', 'fire2', 'lampLight', 'logo', 'pill']);

const mixInto = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};

/**
 * Fill `out` (SLOTS * 3 bytes) for the current conditions.
 * @param {object} c
 * @param {number} c.light 0 night .. 1 day
 * @param {number} c.warmth 0..1, strongest at sunrise and sunset
 * @param {string} c.season
 * @param {number} c.overcast 0..1 cloud cover
 * @param {number} c.rain 0..1
 * @param {number} c.fog 0..1
 * @param {number} c.moonlight 0..1, a high full moon at night
 */
export function computePalette(out, { light, warmth, season, overcast, rain, fog, moonlight }) {
  const seasonDay = SEASONS[season].day;
  const seasonNight = SEASONS[season].night;
  const c = [0, 0, 0];
  const fogColor = [0, 0, 0];
  mixInto(fogColor, NIGHT.sky1, DAY.sky1, light);
  for (let i = 0; i < SLOTS; i++) {
    const name = NAMES[i];
    const day = seasonDay[name] ?? DAY[name];
    const night = seasonNight[name] ?? NIGHT[name];
    mixInto(c, night, day, light);
    const gold = GOLDEN[name];
    if (gold && warmth > 0) mixInto(c, c, gold, warmth * 0.85 * (1 - overcast * 0.7));
    // Overcast skies flatten and dim the colours a little.
    const dull = overcast * 0.45 + rain * 0.25;
    if (dull > 0 && !UNLIT.has(name)) {
      const g = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
      mixInto(c, c, [g * 0.98, g * 0.97, g * 0.96], dull * 0.6);
      const dim = 1 - rain * 0.12 * light - (SKY_SLOTS.has(name) ? overcast * 0.06 * light : 0);
      c[0] *= dim;
      c[1] *= dim;
      c[2] *= dim;
    }
    const depth = DEPTH[name];
    if (depth && fog > 0) mixInto(c, c, fogColor, fog * depth * 0.8);
    // A bright moon lifts the night landscape.
    if (moonlight > 0 && light < 1 && !UNLIT.has(name) && name !== 'star' && name !== 'moon') {
      const lift = 1 + moonlight * (1 - light) * 0.45;
      c[0] = c[0] * lift + moonlight * (1 - light) * 3;
      c[1] = c[1] * lift + moonlight * (1 - light) * 3;
      c[2] = c[2] * lift + moonlight * (1 - light) * 4;
    }
    out[i * 3] = Math.max(0, Math.min(255, Math.round(c[0])));
    out[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(c[1])));
    out[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(c[2])));
  }
  return out;
}
