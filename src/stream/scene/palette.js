// The scene's colours. Everything is drawn as palette slots: a material (grass,
// pine, roof tile, fox fur) in a ramp of tones, at a depth. Each frame one light
// model recolours every slot for the sun, the moon, the weather and the haze, so
// dawn, dusk, night and fog cost nothing per pixel, and a pixel painted once
// stays correct under any sky.
//
// Depth order is the rule that keeps the picture readable: distant land sinks
// towards the colour of the horizon, near land keeps its own colour, and at
// night the same order survives as blue-green tones with small warm windows.

/** sRGB bytes from '#rrggbb'. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

import { createRequire } from 'node:module';
import { PLATE_PALETTES } from './plates.js';

const art = createRequire(import.meta.url)('./sprites.json');

// Light to dark. Muted on purpose: the look is a dry autumn afternoon, and even
// the strongest orange should sit inside the landscape rather than glow.
const WORLD = {
  grass: ['#b2a56a', '#99905a', '#7e7c4b', '#646640'],
  dry: ['#c6ae6d', '#a9965a', '#8c834e', '#6f6a43'],
  spring: ['#adaa6c', '#92965d', '#78824f', '#5f6c43'],
  pine: ['#646a4a', '#4f573d', '#3c4531', '#2c3327'],
  leaf: ['#8f9057', '#747648', '#5a5f3b', '#454a30'],
  amber: ['#e6a64c', '#d6812f', '#b85c24', '#8a421d'],
  rust: ['#d0703a', '#b24f29', '#8d3b22', '#672c1e'],
  gold: ['#e3c462', '#cca245', '#a67e33', '#7a5d2a'],
  blossom: ['#f3e2df', '#e9c6c8', '#d3a3ad', '#ab8390'],
  bark: ['#7d644c', '#5c4939', '#40332a'],
  rock: ['#b6b0a1', '#979184', '#767167', '#57544d'],
  snow: ['#fbfaf4', '#e9eaea', '#cdd4db', '#a9b4c2'],
  soil: ['#a48e6a', '#826e52', '#5e4e3c'],
};
// Depth 0 is the near meadow, 1 the hills, 2 the forested ridges.
const DEPTHS = [Object.keys(WORLD), Object.keys(WORLD), Object.keys(WORLD)];
const HAZE = [0.03, 0.36, 0.56];

const ACTOR_NIGHT = 0.5; // how much of an actor's colour survives the dark

const NAMES = [];
const add = (name) => NAMES.push(name) - 1;
const SKY = ['sky0', 'sky1', 'sky2', 'sky3', 'sky4', 'sunGlow', 'sun', 'moon', 'moonDark', 'star', 'cloud', 'cloudLit', 'cloudShade', 'smoke', 'rain', 'flake', 'firefly', 'spark'];
const FLAT = ['far0', 'far1', 'far2', 'ridge0', 'ridge1', 'ridge2', 'peak0', 'peak1', 'peak2', 'peakSnow0', 'peakSnow1', 'peakSnow2', 'peakSnow3', 'peakDark0', 'peakDark1'];
const WATER = ['water0', 'water1', 'water2', 'water3', 'waterHi', 'waterDeep', 'puddle', 'foam'];
const LAMPS = ['windowA', 'windowB', 'windowC', 'lamp', 'glass', 'pill', 'logo', 'white', 'ink', 'steel0', 'steel1', 'wood'];
for (const n of [...SKY, ...FLAT, ...WATER, ...LAMPS]) add(n);

/** Named slots: S.sky0, S.fur1 and so on. */
export const S = Object.fromEntries(NAMES.map((n, i) => [n, i]));

const entries = new Map(); // slot -> { color, kind, haze }
const RAMPS = {};
for (const [depth, materials] of DEPTHS.entries()) {
  RAMPS[depth] = {};
  for (const material of materials) {
    RAMPS[depth][material] = WORLD[material].map((hex, i) => {
      const slot = add(`${material}${i}@${depth}`);
      entries.set(slot, { color: rgb(hex), kind: 'world', haze: HAZE[depth] });
      return slot;
    });
  }
}
// The painted sheets run hotter than the reference; settle them into its dry palette.
const mute = ([r, g, b]) => {
  const v = r * 0.3 + g * 0.56 + b * 0.14;
  return [v + (r - v) * 0.8, v + (g - v) * 0.82 + 2, v + (b - v) * 0.8];
};

// Sprite colours: world art exists at each depth so haze can settle on it; actors once.
const SPRITE_BASE = NAMES.length;
for (const [depth, haze] of HAZE.entries()) {
  for (const [i, hex] of art.world.entries()) {
    add(`art${i}@${depth}`);
    entries.set(SPRITE_BASE + depth * art.world.length + i, { color: mute(rgb(hex)), kind: 'world', haze });
  }
}
// Outlines sit in the dark brown of the fox, not black; strong colours step back into the land.
const soften = ([r, g, b]) => {
  const v = r * 0.3 + g * 0.56 + b * 0.14;
  if (v < 46) return [r + 34, g + 20, b + 12];
  return [v + (r - v) * 0.82, v + (g - v) * 0.84, v + (b - v) * 0.8];
};
const ACTOR_BASE = NAMES.length;
for (const [i, hex] of art.actor.entries()) {
  add(`actor${i}`);
  entries.set(ACTOR_BASE + i, { color: soften(rgb(hex)), kind: 'actor', haze: 0 });
}
// The painted snow runs blue; the reference's light stays warm even in its shadows.
const warmBlue = ([r, g, b]) => {
  const over = Math.max(0, b - r) * 0.55;
  return [r + over * 0.5, g + over * 0.2, b - over * 0.6];
};
// The reference's depth comes from its near colours being far stronger and darker
// than its far ones. Saturation and contrast fall away with each family's distance.
const grade = (saturation, contrast, gain, olive) => ([r, g, b]) => {
  const v = r * 0.3 + g * 0.56 + b * 0.14;
  const lifted = (x) => (v + (x - v) * saturation - 128) * contrast + 128;
  return [lifted(r) * gain, lifted(g) * gain * olive, lifted(b) * gain];
};
const PLATE_LOOK = {
  plates: { look: grade(0.86, 0.92, 1.03, 0.99), haze: 0.14 },
  near: { look: grade(0.9, 1.03, 1, 0.97), haze: 0.02 },
  front: { look: grade(0.88, 1.08, 0.93, 0.97), haze: 0 },
};
const PLATE_BASE = {};
for (const [family, palette] of Object.entries(PLATE_PALETTES)) {
  PLATE_BASE[family] = NAMES.length;
  const { look, haze } = PLATE_LOOK[family];
  for (const [i, hex] of palette.entries()) {
    const slot = add(`${family}${i}`);
    entries.set(slot, { color: look(warmBlue(rgb(hex))), kind: 'world', haze });
  }
}
/** The slot of a plate colour. */
export const plateSlot = (family, colour) => PLATE_BASE[family] + colour;

/** The actor colour nearest to a hex colour, so drawn limbs share the painted fox's tones. */
export function actorSlot(hex) {
  const want = rgb(hex);
  let best = 0;
  let distance = Infinity;
  for (const [i, value] of art.actor.entries()) {
    const c = rgb(value);
    const d = (c[0] - want[0]) ** 2 + (c[1] - want[1]) ** 2 + (c[2] - want[2]) ** 2;
    if (d < distance) [distance, best] = [d, i];
  }
  return ACTOR_BASE + best;
}

/** The slot of a sprite colour. */
export const artSlot = (family, colour, depth = 0) => (family === 'actor' ? ACTOR_BASE + colour : SPRITE_BASE + depth * art.world.length + colour);
const PATH_TONES = ['#f4e6cc', '#ead7b6', '#d3bc98', '#a98f6d'];
for (const [i, hex] of PATH_TONES.entries()) {
  const slot = add(`path${i}`);
  S[`path${i}`] = slot;
  entries.set(slot, { color: rgb(hex), kind: 'world', haze: 0.02 });
}
for (let i = 0; i < 4; i++) S[`snow${i}`] = RAMPS[0].snow[i];
export const SLOTS = NAMES.length;
export const CLEAR = 65535;

/** Slots of a material's tones at a depth, falling back to the nearest depth that has it. */
export function ramp(material, depth = 0) {
  for (let d = depth; d >= 0; d--) if (RAMPS[d][material]) return RAMPS[d][material];
  throw new Error(`no material ${material}`);
}

// Flat distant tones: painted once, recoloured from the sky each frame.
const FAR = {
  far0: 0.78, far1: 0.7, far2: 0.62, // furthest soft ranges, as a mix towards the land tone
  ridge0: 0.6, ridge1: 0.5, ridge2: 0.4,
};
const PEAK = {
  peak0: ['#a7a7a4', 0.5], peak1: ['#8d8f92', 0.5], peak2: ['#747a84', 0.5], peakDark0: ['#646b78', 0.5], peakDark1: ['#535a68', 0.5],
  peakSnow0: ['#fbf8f0', 0.28], peakSnow1: ['#e7e6e6', 0.32], peakSnow2: ['#ccd0d9', 0.36], peakSnow3: ['#aeb6c6', 0.4],
};
const LAND_FAR = rgb('#8d8c7a');

const KEYS = {
  noon: { sky: ['#e2d6c4', '#efdfc6', '#f5e3c4', '#f8e0b9', '#f9dbae'], glow: '#fbdfae', sun: '#f6b877', cloud: '#f3d6ab', lit: '#f5deb9', shade: '#eccb9c' },
  gold: { sky: ['#e3d3bf', '#f2dcc0', '#f9deb9', '#fcd8a6', '#fccf95'], glow: '#fbd9a6', sun: '#f4a55c', cloud: '#f7cf9c', lit: '#f9d9ac', shade: '#f0c28e' },
  night: { sky: ['#0d1626', '#111e30', '#172738', '#1e3242', '#293f4e'], glow: '#233646', sun: '#233646', cloud: '#26364a', lit: '#3a4c60', shade: '#1b2739' },
  grey: { sky: ['#a9adaa', '#b4b7b3', '#bfc1bc', '#c8c9c3', '#cfcfc8'], glow: '#d5d4cc', sun: '#dcdbd2', cloud: '#c4c5c0', lit: '#d4d4cd', shade: '#9fa3a2' },
};
for (const k of Object.values(KEYS)) {
  k.sky = k.sky.map(rgb);
  for (const f of ['glow', 'sun', 'cloud', 'lit', 'shade']) k[f] = rgb(k[f]);
}

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const luma = (c) => c[0] * 0.3 + c[1] * 0.56 + c[2] * 0.14;

/**
 * Fill `out` (SLOTS * 3 bytes) for the current conditions.
 * @param {object} c
 * @param {number} c.light 0 night .. 1 day
 * @param {number} c.warmth 0..1, strongest at sunrise and sunset
 * @param {number} c.overcast 0..1
 * @param {number} c.rain 0..1
 * @param {number} c.fog 0..1
 * @param {number} c.moonlight 0..1, a high full moon at night
 * @param {number} [c.wet] 0..1 how much the path holds rain
 * @param {number} [c.time] seconds, turns the water shimmer
 */
export function computePalette(out, { light, warmth, overcast, rain, fog, moonlight, wet = 0, time = 0 }) {
  const gold = warmth * (1 - overcast * 0.75);
  const dayKey = (pick) => mix3(pick(KEYS.noon), pick(KEYS.gold), gold);
  const skyKey = (pick) => {
    // Dusk passes through the warm key on its way down to night.
    const lit = mix3(pick(KEYS.night), dayKey(pick), light);
    const greyed = mix3(pick(KEYS.night), pick(KEYS.grey), Math.max(light, 0.04));
    return mix3(lit, greyed, overcast * 0.9);
  };
  const skies = [0, 1, 2, 3, 4].map((i) => skyKey((k) => k.sky[i]));
  const horizon = skies[4];
  const fogColor = mix3(skies[3], [255 * 0.82, 255 * 0.82, 255 * 0.8], 0.25 * light);

  const set = (slot, c) => {
    const i = slot * 3;
    for (let k = 0; k < 3; k++) out[i + k] = c[k] < 0 ? 0 : c[k] > 255 ? 255 : c[k] + 0.5;
  };

  // Daylight tint and the night's blue-green cast.
  const sunTint = mix3([1, 1, 1], [1.05, 0.95, 0.8], gold);
  const dull = overcast * 0.42 + rain * 0.2;
  const moon = moonlight * (1 - light);
  function lit(c, kind) {
    let day = [c[0] * sunTint[0], c[1] * sunTint[1], c[2] * sunTint[2]];
    if (dull > 0) {
      // Bad weather greys the land; the characters stay themselves.
      const amount = kind === 'actor' ? dull * 0.25 : dull;
      const g = luma(day);
      day = mix3(day, [g * 0.97, g * 0.98, g * 1.0], amount);
      const dim = 1 - amount * 0.18;
      day = [day[0] * dim, day[1] * dim, day[2] * dim];
    }
    if (light >= 1) return day;
    const v = luma(c);
    const keep = kind === 'actor' ? ACTOR_NIGHT : 0.2 + moon * 0.1;
    const cast = kind === 'actor' ? 0.42 : 0.33 + moon * 0.14;
    const night = [c[0] * keep * 0.5 + v * cast * 0.34, c[1] * keep * 0.5 + v * cast * 0.5, c[2] * keep * 0.5 + v * cast * 0.72];
    return mix3(night, day, light);
  }

  [S.sky0, S.sky1, S.sky2, S.sky3, S.sky4].forEach((slot, i) => set(slot, skies[i]));
  set(S.sunGlow, mix3(skyKey((k) => k.glow), horizon, overcast * 0.8));
  set(S.sun, skyKey((k) => k.sun));
  set(S.moon, rgb('#f1ecdd'));
  set(S.moonDark, mix3(skies[1], skies[0], 0.5));
  set(S.star, rgb('#f7f1df'));
  set(S.cloud, skyKey((k) => k.cloud));
  set(S.cloudLit, skyKey((k) => k.lit));
  set(S.cloudShade, skyKey((k) => k.shade));
  set(S.smoke, mix3(skies[3], lit(rgb('#d9d6cc'), 'world'), 0.65));
  set(S.rain, mix3(skies[1], [120, 135, 150], 0.5 + 0.2 * (1 - light)));
  set(S.flake, mix3([206, 216, 228], [255, 254, 250], light));
  set(S.firefly, rgb('#f4e58f'));
  set(S.spark, rgb('#fbdb8a'));

  // Distant land: tones of the sky itself, darker with each range forward.
  const land = lit(LAND_FAR, 'world');
  for (const [name, t] of Object.entries(FAR)) set(S[name], mix3(land, horizon, t));
  for (const [name, [hex, haze]] of Object.entries(PEAK)) set(S[name], mix3(lit(rgb(hex), 'world'), horizon, haze));

  // Water mirrors the sky, deeper towards the viewer; it shimmers by trading
  // tones, which moves no pixel and so cannot crawl.
  const deep = lit(rgb('#5f7f86'), 'world');
  const a = 0.5 + 0.5 * Math.sin(time * 1.4);
  const w0 = mix3(skies[3], deep, 0.12);
  const w1 = mix3(skies[2], deep, 0.3);
  const w2 = mix3(skies[1], deep, 0.5);
  const w3 = mix3(skies[0], deep, 0.74);
  set(S.water0, mix3(w0, w1, a * 0.45));
  set(S.water1, mix3(w1, w2, (1 - a) * 0.45));
  set(S.water2, mix3(w2, w3, a * 0.4));
  set(S.water3, w3);
  set(S.waterDeep, mix3(w3, lit(rgb('#3c5258'), 'world'), 0.6));
  set(S.waterHi, mix3(skyKey((k) => k.lit), horizon, 0.15));
  set(S.foam, mix3(lit(rgb('#f4f1e6'), 'world'), horizon, 0.1));
  // The puddle slot is plain path when dry and a piece of sky when wet.
  const path = lit(rgb(PATH_TONES[1]), 'world');
  set(S.puddle, mix3(path, mix3(skies[2], deep, 0.3), wet));

  // Windows come on one group at a time as the light goes.
  const dark = (from, to) => Math.max(0, Math.min(1, (from - light) / (from - to)));
  const off = lit(rgb('#4a4d4e'), 'world');
  const warm = rgb('#ffc266');
  set(S.windowA, mix3(off, warm, dark(0.7, 0.45)));
  set(S.windowB, mix3(off, rgb('#ffb257'), dark(0.5, 0.3)));
  set(S.windowC, mix3(off, rgb('#ffd38a'), dark(0.3, 0.12)));
  set(S.lamp, mix3(lit(rgb('#d6cdb2'), 'world'), rgb('#ffdc9c'), dark(0.5, 0.25)));
  set(S.glass, mix3(off, skies[3], 0.6));
  set(S.pill, rgb('#171412'));
  set(S.logo, rgb('#ff9a62'));
  set(S.white, rgb('#ffffff'));

  set(S.ink, lit(rgb('#231915'), 'actor'));
  set(S.steel0, lit(rgb('#7d8084'), 'actor'));
  set(S.steel1, lit(rgb('#44474c'), 'actor'));
  set(S.wood, lit(rgb('#6e4a32'), 'actor'));
  for (const [slot, e] of entries) {
    let c = lit(e.color, e.kind);
    const haze = e.haze * (e.kind === 'world' ? 1 + fog * 1.3 : 0);
    if (haze > 0) c = mix3(c, horizon, Math.min(1, haze));
    if (fog > 0 && e.kind === 'world') c = mix3(c, fogColor, fog * (e.haze > 0.3 ? 0.62 : e.haze > 0.1 ? 0.42 : 0.14));
    set(slot, c);
  }
  return out;
}
