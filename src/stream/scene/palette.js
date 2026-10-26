// The scene's colours. Everything is drawn as palette slots; each frame the
// slots are recoloured for the time of day, the season and the weather. So
// dawn, dusk, fog and a full moon cost nothing per pixel.
//
// The picture follows the real sun: OpenPost's light scheme by day (warm
// paper and ink), its dark Dither scheme by night (warm charcoal), blended
// through dawn and dusk, with the orange-brown signal at hue 45 throughout.
// Both keep the same depth order (sky lightest, foreground darkest) so the
// landscape never washes into one grey while the light changes.

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
  'knit', 'knitDark', 'raincoat', 'raincoatDark', 'wallShade', 'roofShade', 'door', 'metal', 'metalDark', 'brass', 'interior', 'interiorShade', 'floor', 'roofSnow',
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
  sky0: '#e8e2d6', sky1: '#f1ede4', sky2: '#f6f1e6', sunGlow: '#f7ead4', sun: '#f2b36b', moon: '#f1ede4', moonDark: '#e3ddd1', star: '#f6f1e6',
  cloud: '#fbf9f4', cloudShade: '#ddd6ca',
  far0: '#d7cfc2', far1: '#c9c0b2', peak: '#d7cfc2', glacier: '#f6f3ed', sea0: '#c5cbc8', sea1: '#aab3b1',
  hill0: '#b8af9f', hill1: '#a39a8b', pine0: '#6e715a', pine1: '#565a46', leaf0: '#7d855f', leaf1: '#636b4a', blossom: '#7d855f', snowcap: '#6e715a',
  trunk: '#5a4b3f', roof: '#7c3a07', wall: '#e9e4da', window: '#7a7266', windowOff: '#7a7266',
  ground0: '#d3cab9', ground1: '#bcb2a1', path: '#e6dfd2', pathEdge: '#9b9081', flower: '#bcb2a1',
  water0: '#c3c9c6', water1: '#a7b0ae', waterHi: '#fbf9f4',
  grass: '#2b2623', grassTip: '#5c544b',
  fur: 'oklch(0.6 0.14 45)', furDark: 'oklch(0.46 0.12 45)', cream: '#f7ecdc', outline: 'oklch(0.3 0.07 45)', blush: 'oklch(0.68 0.12 30)', bag: 'oklch(0.36 0.06 55)',
  bunny: '#dcd5ca', bunnyDark: '#a59b8d', bear: '#6b5242', bearDark: '#4a372b', ink: '#302b28', paper: '#fbf9f4', screen: '#fff4e0', cat: '#3a3330', logo: 'oklch(0.76 0.14 45)',
  fire0: '#e0702a', fire1: '#f2a548', fire2: '#fbe3a0', glow0: '#d3cab9', glow1: '#d3cab9', smoke: '#b5ac9e', lampLight: '#efe9de',
  rain: '#a19788', snow: '#ffffff', leafFall: '#b45309', light: '#ffffff', banner: '#fbf9f4', pill: '#1c1917',
  hat: '#4a433d', straw: '#c9a25a',
  knit: 'oklch(0.52 0.07 200)', knitDark: 'oklch(0.42 0.06 200)', raincoat: 'oklch(0.84 0.14 92)', raincoatDark: 'oklch(0.7 0.13 85)',
  wallShade: '#d6cfc3', roofShade: 'oklch(0.36 0.09 40)', door: '#6b5242', metal: '#8f8a84', metalDark: '#5f5a55', brass: 'oklch(0.7 0.1 80)',
  interior: '#e2d9ca', interiorShade: '#cfc4b3', floor: '#a88f74', roofSnow: '#7c3a07',
});

const NIGHT = table({
  sky0: '#26211e', sky1: '#2d2723', sky2: '#3b332d', sunGlow: '#3b332d', sun: '#3b332d', moon: '#ece7df', moonDark: '#3a332e', star: '#fff6e5',
  cloud: '#3a332e', cloudShade: '#302a26',
  far0: '#352e29', far1: '#2d2723', peak: '#352e29', glacier: '#4f4842', sea0: '#2c3030', sea1: '#232726',
  hill0: '#2a2420', hill1: '#231e1b', pine0: '#1e1d18', pine1: '#181713', leaf0: '#221e18', leaf1: '#1b1814', blossom: '#221e18', snowcap: '#1e1d18',
  trunk: '#16120f', roof: '#2c1c13', wall: '#2c2622', window: '#fdb36b', windowOff: '#2c2622',
  ground0: '#231e1a', ground1: '#1c1815', path: '#302924', pathEdge: '#17130f', flower: '#1c1815',
  water0: '#262b2b', water1: '#1c2020', waterHi: '#7c7b71',
  grass: '#110e0c', grassTip: '#2f2823',
  fur: 'oklch(0.56 0.11 45)', furDark: 'oklch(0.42 0.09 45)', cream: '#a79a89', outline: 'oklch(0.2 0.04 45)', blush: 'oklch(0.5 0.09 30)', bag: 'oklch(0.26 0.04 55)',
  bunny: '#7a7268', bunnyDark: '#4f4841', bear: '#3e3029', bearDark: '#2a201b', ink: '#0a0807', paper: '#9a9086', screen: '#ffe8c4', cat: '#5a524b', logo: 'oklch(0.76 0.14 45)',
  fire0: '#fd7d3a', fire1: '#ffb35c', fire2: '#fff0c4', glow0: '#3a2618', glow1: '#6a3f22', smoke: '#3a332e', lampLight: '#ffd9a0',
  rain: '#4a433d', snow: '#d8d1c7', leafFall: '#4a2f1f', light: '#fff6e5', banner: '#c9c1b6', pill: '#0c0a09',
  hat: '#4a443f', straw: '#8a6f40',
  knit: 'oklch(0.38 0.05 200)', knitDark: 'oklch(0.3 0.04 200)', raincoat: 'oklch(0.62 0.1 90)', raincoatDark: 'oklch(0.5 0.09 85)',
  wallShade: '#120f0d', roofShade: '#0b0908', door: '#2a201b', metal: '#4f4a45', metalDark: '#34302c', brass: 'oklch(0.5 0.07 80)',
  interior: '#4a3a2c', interiorShade: '#3a2d22', floor: '#33261c', roofSnow: '#0e0c0a',
});

// Sunrise and sunset: the sky warms and the low sun turns orange.
const GOLDEN = table({
  sky0: '#e6d3bf', sky1: '#efc9a3', sky2: '#f1a96b', sunGlow: '#f4b678', sun: '#e8692a', cloud: '#f3c79c', cloudShade: '#d39a72',
  far0: '#d6b394', far1: '#c49c7d', sea0: '#c9b6a6', sea1: '#a8968a', waterHi: '#f6c99a',
});

// Seasons recolour the vegetation and the ground. Day and night pairs.
const SEASONS = {
  spring: {
    day: table({ leaf0: '#8a9567', leaf1: '#6f7a52', blossom: '#f4e6e0', flower: '#f1ece2', grassTip: '#5e6448' }),
    night: table({ blossom: '#2a2421', flower: '#1d1916' }),
  },
  summer: {
    day: table({ leaf0: '#717b4e', leaf1: '#5b643f', flower: '#d9963f', grassTip: '#4f5338' }),
    night: table({}),
  },
  autumn: {
    day: table({ leaf0: '#c4691c', leaf1: '#9c4c12', blossom: '#d99a3e', pine0: '#64624e', ground0: '#cfc1a8', flower: '#c4a582', grassTip: '#6e5a40' }),
    night: table({ leaf0: '#332013', leaf1: '#28190f', blossom: '#332013' }),
  },
  winter: {
    day: table({
      peak: '#fdfcf9', snowcap: '#fdfcf9', pine0: '#5a5a50', pine1: '#45463e', leaf0: '#6b6157', leaf1: '#584f47', blossom: '#fdfcf9',
      ground0: '#f3f0ea', ground1: '#e1dcd3', path: '#e7e2d9', pathEdge: '#c4bdb1', flower: '#e1dcd3',
      hill0: '#d9d4cb', hill1: '#c6c0b6', water0: '#e4e8e6', water1: '#cdd3d1', waterHi: '#ffffff', grassTip: '#d9d4cb',
      roofSnow: '#fdfcf9',
    }),
    night: table({
      peak: '#4c4640', snowcap: '#403a35', ground0: '#3b3632', ground1: '#332e2a', path: '#37322d', hill0: '#302b27', hill1: '#292420',
      water0: '#38332e', water1: '#2e2a26', grassTip: '#3b3632', roofSnow: '#4c4640',
    }),
  },
};

// How far each slot sits in depth, for fog and haze (0 near, 1 far).
const DEPTH = { far0: 0.85, far1: 0.85, peak: 0.85, glacier: 0.85, sea0: 0.8, sea1: 0.8, hill0: 0.55, hill1: 0.55, pine0: 0.5, pine1: 0.5, leaf0: 0.5, leaf1: 0.5, blossom: 0.5, snowcap: 0.5, trunk: 0.45, roof: 0.45, wall: 0.45, cloud: 0.3, cloudShade: 0.3, ground0: 0.2, ground1: 0.2, path: 0.2, pathEdge: 0.2, flower: 0.2, water0: 0.2, water1: 0.2 };
const SKY_SLOTS = new Set(['sky0', 'sky1', 'sky2', 'sunGlow', 'cloud', 'cloudShade']);
// Light sources and the interface keep their colour whatever the weather.
const UNLIT = new Set(['window', 'screen', 'fire0', 'fire1', 'fire2', 'lampLight', 'logo', 'pill', 'interior', 'interiorShade', 'floor']);

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
