// The stream's picture, drawn on a single 640x360 pixel grid and enlarged by a
// whole number in ffmpeg. A fox with a postbag travels right through an endless
// countryside. It walks, picks up a bicycle, rows a lake, sails a coast, rides a
// broom, and pauses only for a quick workout or a look through a telescope. The
// wall clock drives the sun, moon and weather; distance drives country and season.
import { BROOM, LOOK, PEDAL_FRAMES, RAILS, ROW_FRAMES, SAIL_FRAMES, SCOPE_SECONDS, STRIDE, WORKOUT_REACH, WORKOUT_SECONDS, walkFrame, workoutAt } from './acts.js';
import { createCanvas, HEIGHT, maskSprite, WIDTH } from './canvas.js';
import { sky as skyAt, weather as weatherAt, weatherAmount } from './clock.js';
import { bayer, clamp01 } from './dither.js';
import { climate, distanceAt, eventsIn, geography, movingAt, nextStop, seasonAt, speedOf, WALK_SPEED } from './journey.js';
import { createLandscape, crossing, PATH_Y, WATERLINE } from './landscape.js';
import { createFox, WHEEL } from './fox.js';
import { convergeMask } from './logo.js';
import { frame, hash, noise2, sprite } from './nature.js';
import { computePalette, ramp, S, SLOTS } from './palette.js';
import { arc, createSky } from './sky.js';
import { drawActorShadow } from './shadow.js';
import { createWater, swellAt } from './water.js';
import { createWeather } from './weather.js';

export { HEIGHT, WIDTH };

/** Where the brand chip (top left) sits, so the encoder can place its text. Both chips share its height. */
export const BRAND = { x: 16, y: 12, w: 124, h: 26, textX: 41 };
export const BRAND_TEXT = 'openpo.st/radio';

const FOX_X = WIDTH / 2;
const ACCEL = 34; // px/s² when changing pace
const LOGO = maskSprite(convergeMask(14, 2), S.logo);
const NOTE = maskSprite(['..xx', '..x.', '..x.', 'xxx.', 'xx..'].map((r) => [...r].map((ch) => ch === 'x')), S.logo);
const BAR = 104; // pull-up bar height above the road
const DIP = 58; // dip rail height
const AXLE = [-30, 37]; // wheel centres from the middle of a riding frame
const PARKED_SHIFT = 3; // moves the parked bicycle's art onto those same wheels
const JUMP_RAILS = 34; // how high the hop onto the rails goes

const mod = (a, n) => ((a % n) + n) % n;
// A tiling sheet of mist density, so drifting fog costs one lookup per pixel.
const MIST = Float32Array.from({ length: 512 * 90 }, (_, i) => {
  const x = i % 512;
  const y = (i / 512) | 0;
  const wrap = (f, seed) => {
    const a = noise2((x / 512) * f, (y / 90) * 3, seed);
    const b = noise2(((x - 512) / 512) * f, (y / 90) * 3, seed);
    return a + (b - a) * (x / 512);
  };
  return Math.max(0, wrap(7, 701) * 0.7 + wrap(19, 702) * 0.3 - 0.36) * 2.2;
});
const FRIEND_CELL = 2300;
const HOP = 40; // ground pixels spent hopping onto a boat
const MOUNT = 34; // the same for a bicycle or a broom
const BROOM_DOWN = 170; // ground pixels spent climbing off the road or coming back to it
const METER = 13; // rows the sound meter adds to the now-playing chip
const SCOPE_OFFSET = 56;

// A ghost frame still moves the weather, which only writes pixels; there is nothing to write to.
const GHOST_CANVAS = { set() {}, rect() {} };

/** Whether any water can be seen from here. Most of the road has none, and the sea is the costliest thing to draw. */
function waterShows(ground) {
  if (crossing(ground, 700)) return true;
  // The far hills cover ten times more road than the screen is wide.
  for (let d = ground - 3600; d <= ground + 3600; d += 400) {
    const g = geography(d);
    if (g.lake > 0.01 || g.sea > 0.01) return true;
  }
  return false;
}

/** A friend walking the other way, if one is near this stretch of road. */
function friendNear(ground) {
  const cell = Math.floor((ground + 700) / FRIEND_CELL);
  for (const c of [cell - 1, cell]) {
    if (hash(c, 501) > 0.62) continue;
    const meet = (c + 0.5) * FRIEND_CELL + hash(c, 502) * 700;
    const rel = (meet - ground) * 1.76;
    if (Math.abs(rel) > 420) continue;
    if (eventsIn(meet - 500, meet + 500).length || crossing(meet, 300)) continue;
    return { rel, offset: hash(c, 503) < 0.5 ? 0 : 4, seed: c };
  }
  return null;
}

export function createScene({ seed = 7, timeZone = 'Europe/Lisbon', dayMinutes = 0, alwaysWater = false } = {}) {
  const canvas = createCanvas();
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
  const palette = new Uint8Array(SLOTS * 3);
  const sky = createSky(seed);
  const land = createLandscape();
  const water = createWater();
  const weatherFx = createWeather(seed + 1);
  const fox = createFox(canvas);

  let ground = null;
  let lastAt = null;
  let speed = WALK_SPEED;
  let hold = null; // the stop in progress: { event, t, length }
  let passedStop = null;
  let wet = 0;
  let mood = 'walk';
  const prints = [];
  let levels = [];
  let lastPrint = 0;

  function shadow(x, y, half) {
    for (let row = 0; row < 3; row++) {
      for (let dx = -half; dx <= half; dx++) {
        const px = Math.round(x + dx);
        if (Math.abs(dx) < half - row * 4 && bayer(px, y + row) < 0.72 - Math.abs(dx / half) * 0.4) canvas.set(px, y + row, S.path3);
      }
    }
  }

  function groundedFrame(sheet, i, x, y, groundY = PATH_Y, options = {}) {
    drawActorShadow(canvas, sprite(sheet, i), x, y, groundY, options);
    frame(canvas, sheet, i, x, y, options);
  }

  /** The bar. The painted frames hang on it by their recorded bar row. */
  function drawBar(x) {
    for (const dx of [-54, 52]) {
      canvas.rect(x + dx - 1, PATH_Y - 4 - BAR, 5, BAR + 2, S.steel1);
      canvas.rect(x + dx, PATH_Y - 4 - BAR, 2, BAR + 2, S.steel0);
    }
    canvas.rect(x - 60, PATH_Y - 4 - BAR, 120, 2, S.steel0);
    canvas.rect(x - 60, PATH_Y - 2 - BAR, 120, 2, S.steel1);
  }
  /** Where a frame from the dip sheet sits, so its rails stand on the road. */
  const railY = () => PATH_Y + sprite('rails', 0).oy;

  function parkedBike(x) {
    fox.wheel(x + AXLE[0], PATH_Y - WHEEL, 0.4);
    fox.wheel(x + AXLE[1], PATH_Y - WHEEL, 1.1);
    frame(canvas, 'ride', 0, x + PARKED_SHIFT, PATH_Y - WHEEL + 3 + sprite('ride', 0).oy);
  }

  /** A hop on or off something: one short jump, the same for every vehicle. */
  function hop(p, fromY, toY, outfit, dismount = false) {
    const frames = dismount ? [3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
    const i = frames[Math.min(frames.length - 1, Math.floor(p * frames.length))];
    // The hat comes off in mid-air, in a puff, wherever the next pose has none.
    const sheet = (dismount ? p > 0.5 : p < 0.5) ? `hop${outfit}` : 'hop';
    const y = fromY + (toY - fromY) * p - Math.sin(Math.PI * p) * 16;
    groundedFrame(sheet, i, FOX_X, Math.round(y) + sprite(sheet, i).oy);
    if (outfit && Math.abs(p - 0.5) < 0.25) fox.puff(FOX_X + 6, y - 58, (p - 0.25) / 0.5);
  }

  /** The body in a standing pose with its feet on the road. */
  function stood(sheet, i, x, y = PATH_Y, flip = false) {
    groundedFrame(sheet, i, x, y + sprite(sheet, i).oy, y, { flip });
  }

  /**
   * Draw one frame.
   * @param {object} s
   * @param {number} s.time    seconds since the stream started (drives motion)
   * @param {number} s.dt      seconds since the previous frame
   * @param {Date}   s.date    wall clock (drives sky and weather; sets the starting distance)
   * @param {number} s.beat    beats elapsed in the current track
   * @param {Float32Array} s.bands spectrum levels in [0, 1], low to high
   * @param {number} s.pillWidth now-playing pill width (0 hides it)
   * @param {object} [s.steer] for previews: `at` (jump to a distance), `weather`, `trigger` a sky event
   * @param {boolean} [s.ghost] advance everything that carries over between frames, but draw nothing
   * @returns {Buffer} RGB24 frame
   */
  function render({ time, dt, date, beat, bands, pillWidth, steer, ghost = false }) {
    if (ground == null) ground = distanceAt(date);
    if (steer?.at != null && steer.at !== lastAt) {
      ground = steer.at;
      lastAt = steer.at;
      hold = null;
      speed = speedOf(movingAt(ground)?.kind ?? 'walk');
    }
    const st = skyAt(date, timeZone, dayMinutes);
    const c = climate(ground);
    const season = seasonAt(ground);
    const w = steer?.weather ?? weatherAt(date, season, dayMinutes);
    const rain = weatherAmount(w, 'rain');
    const snow = weatherAmount(w, 'snow');
    const fog = weatherAmount(w, 'fog');
    const windy = weatherAmount(w, 'windy');
    const overcast = clamp01(weatherAmount(w, 'cloudy') * 0.7 + rain + snow * 0.8 + fog * 0.5);
    const wind = 0.15 + windy * 0.85 + rain * 0.3;
    const moonUp = st.moon != null ? Math.sin(Math.PI * st.moon) : 0;
    const moonlight = moonUp * (1 - Math.abs(st.moonAge - 0.5) * 2) * (1 - overcast);
    wet += ((rain > 0.2 ? 1 : 0) - wet) * Math.min(1, dt * (rain > 0.2 ? 0.25 : 0.05));
    if (!ghost) computePalette(palette, { light: st.light, warmth: st.warmth, overcast, rain, fog, moonlight, wet, time });

    // --- The road: pace, stops, and what the fox is riding. ---
    const trip = movingAt(ground);
    const kind = trip?.kind ?? 'walk';
    const boat = kind === 'row' || kind === 'sail';
    const easing = (kind === 'broom' ? BROOM_DOWN : kind === 'bike' ? MOUNT : HOP) + 90;
    const cruising = trip && ground > trip.a + (boat ? HOP : MOUNT) && ground < trip.b - easing;
    let target = cruising ? speedOf(kind) : WALK_SPEED;
    let limit = Infinity;
    if (hold) {
      hold.t += dt;
      target = 0;
      limit = 0;
      if (hold.t >= hold.length) {
        passedStop = hold.event.id;
        if (hold.event.kind === 'workout') speed = 0;
        hold = null;
      }
    } else {
      const stop = nextStop(ground, 60);
      if (stop && stop.id !== passedStop) {
        const left = stop.a - ground;
        limit = Math.sqrt(2 * ACCEL * Math.max(0, left));
        if (left < 0.3) {
          ground = stop.a;
          speed = 0;
          hold = { event: stop, t: 0, length: stop.kind === 'workout' ? WORKOUT_SECONDS : SCOPE_SECONDS };
        }
      }
    }
    speed += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, target - speed));
    speed = Math.min(speed, limit);
    if (!hold) ground += speed * dt;
    else if (hold.event.kind === 'workout') ground = hold.event.a + workoutAt(hold.t).x;
    mood = hold ? hold.event.kind : kind;
    const view = Math.floor(ground);
    const roadY = () => PATH_Y;
    const feet = PATH_Y;

    // --- Sky and land, back to front. ---
    const body = st.sun != null && st.light > 0.2 ? arc(st.sun) : st.moon != null ? arc(st.moon, 135) : null;
    sky.draw(canvas, { time, dt, light: st.light, sunProgress: st.sun, moonProgress: st.moon, moonAge: st.moonAge, overcast, wind, date, scroll: ground, ghost });
    if (steer?.trigger) sky.trigger(steer.trigger, `${steer.trigger}:${time}`);
    const printing = c.winter > 0.4 && kind === 'walk' && !hold;
    if (printing && Math.abs(ground - lastPrint) > STRIDE / 2) {
      lastPrint = ground;
      prints.push(ground - 1);
      if (prints.length > 30) prints.shift();
    }
    const onLand = !crossing(ground, 0);
    const weather = {
      dt, time, rain, snow: snow * clamp01(c.winter * 2), wind, scroll: speed,
      leaves: c.autumn * (0.25 + windy * 0.75) * (onLand ? 1 : 0),
      fireflies: c.summer > 0.5 && st.light < 0.3 && onLand ? 1 - st.light * 3 : 0,
      petals: c.spring * (onLand ? 0.5 : 0),
    };
    if (ghost) {
      weatherFx.draw(GHOST_CANVAS, weather);
      if (pillWidth > 0) meter(bands, dt);
      return null;
    }

    if (waterShows(ground) || alwaysWater) water.draw(canvas, { ground, time, body, light: st.light, overcast, rough: (geography(ground).sea > 0.5 ? 1 : 0.42) * (1 + wind) });
    land.draw(canvas, 0, view);
    fogBanks(view, time, fog, st.light);
    land.draw(canvas, 1, view);
    land.draw(canvas, 2, view);

    if (printing) {
      for (const p of prints) {
        const x = Math.round(FOX_X + p - view);
        if (x > 0 && x < FOX_X - 6) canvas.rect(x, roadY(p) + (Math.round(p / 23) % 2 ? 0 : 3), 4, 1, S.snow3);
      }
    }

    // --- World things beside the road. ---
    const at = (d) => Math.round(FOX_X + d - view);
    const seesaw = (x) => Math.round(swellAt(ground, time, x).lift);
    const bob = seesaw(FOX_X);
    const HULL_Y = WATERLINE + 22;
    for (const e of eventsIn(ground - 400, ground + 400)) {
      if (e.kind === 'workout') {
        drawBar(at(e.a));
        frame(canvas, 'rails', 0, at(e.a + RAILS), railY());
      } else if (e.kind === 'scope') {
        frame(canvas, 'props', 0, at(e.a) + SCOPE_OFFSET, PATH_Y + 3);
      } else if (e.kind === 'bike') {
        if (ground < e.a + MOUNT) parkedBike(at(e.a + MOUNT));
        if (ground >= e.b - MOUNT) parkedBike(at(e.b - MOUNT));
      } else if (e.kind === 'row' || e.kind === 'sail') {
        // The empty boat is cut from the frames it is ridden in, so nothing changes as the fox sits.
        const hull = e.kind === 'row' ? 0 : 1;
        for (const d of [e.a + HOP, e.b - HOP]) {
          if (d === e.a + HOP ? ground >= d : ground < d) continue;
          frame(canvas, 'moored', hull, at(d), HULL_Y + seesaw(at(d)));
        }
      } else if (e.kind === 'broom') {
        // It waits at knee height, on the line the fox will ride it.
        const hover = PATH_Y - 3 + Math.round(Math.sin(time * 1.6) * 1.4) + sprite('broom', BROOM.alone).oy;
        if (ground < e.a + MOUNT) frame(canvas, 'broom', BROOM.alone, at(e.a + MOUNT) + 4, hover);
        if (ground >= e.b - MOUNT) frame(canvas, 'broom', BROOM.alone, at(e.b - MOUNT) + 4, hover);
      }
    }

    // A friend coming the other way: neither stops.
    const friend = kind === 'walk' && !hold ? friendNear(ground) : null;
    if (friend) {
      const step = Math.floor(mod(-friend.rel / 1.76 / (STRIDE / 2), 1) * 4);
      const x = Math.round(FOX_X + friend.rel);
      const y = roadY(ground + friend.rel) - 4;
      groundedFrame('friends', friend.offset + step, x, y, y);
    }

    // --- The fox. ---
    const outfit = rain > 0.3 ? '-rain' : c.winter > 0.5 ? '-snow' : '';
    const walkSheet = `walk8${outfit}`;
    const step = walkFrame(ground);
    let drawn = false;
    if (hold) {
      if (hold.event.kind === 'workout') {
        workout(workoutAt(hold.t));
        if (outfit) {
          fox.puff(FOX_X + 6, PATH_Y - 60, hold.t / 0.3);
          fox.puff(FOX_X + 6, PATH_Y - 60, 1 - (hold.length - hold.t) / 0.3);
        }
        drawn = true;
      } else {
        // Eye to the eyepiece. The telescope itself never changes.
        stood('gestures', LOOK, FOX_X, PATH_Y);
        drawn = true;
      }
    } else if (kind === 'bike') {
      const on = (ground - trip.a) / MOUNT;
      const off = (trip.b - ground) / MOUNT;
      if (on < 1) hop(clamp01(on), PATH_Y, PATH_Y - 34, outfit);
      else if (off < 1) hop(1 - clamp01(off), PATH_Y - 34, PATH_Y, outfit, true);
      else {
        shadow(FOX_X, feet + 1, 36);
        const turn = ground / WHEEL;
        fox.wheel(FOX_X + AXLE[0], feet - WHEEL, turn);
        fox.wheel(FOX_X + AXLE[1], feet - WHEEL, turn);
        frame(canvas, 'pedal', Math.floor(mod(ground / 52, 1) * PEDAL_FRAMES), FOX_X, feet - 8);
        fox.puff(FOX_X, PATH_Y - 44, (ground - trip.a - MOUNT) / 22);
      }
      drawn = true;
    } else if (boat) {
      const on = (ground - trip.a) / HOP;
      const off = (trip.b - ground) / HOP;
      const y = HULL_Y + bob;
      if (on < 1 || off < 1) {
        // Stepping aboard or ashore; the near side of the boat passes in front of the legs.
        if (on < 1) hop(clamp01(on), PATH_Y, y - 26, outfit);
        else hop(1 - clamp01(off), y - 26, PATH_Y, outfit, true);
      } else {
        if (kind === 'row') frame(canvas, 'row', Math.floor(mod(ground / 90, 1) * ROW_FRAMES), FOX_X, y);
        else frame(canvas, 'sail', Math.floor(mod(time * 1.2, SAIL_FRAMES)), FOX_X, y);
        water.wake(canvas, FOX_X - 54, WATERLINE + 8 + bob, time, ground);
      }
      drawn = true;
    } else if (kind === 'broom') {
      const on = (ground - trip.a) / MOUNT;
      const off = (trip.b - ground) / MOUNT;
      if (on < 1) hop(clamp01(on), PATH_Y, PATH_Y - 18, outfit);
      else if (off < 1) hop(1 - clamp01(off), PATH_Y - 18, PATH_Y, outfit, true);
      else {
        // Up off the road after the hop, down to it before the next.
        const edge = Math.min(ground - trip.a - MOUNT, trip.b - MOUNT - ground);
        const lift = Math.min(1, edge / BROOM_DOWN);
        const y = Math.round(PATH_Y - 3 - lift * lift * (3 - 2 * lift) * 78 + Math.sin(time * 1.6) * 1.4);
        const f = BROOM.fly[Math.floor(mod(time * 3, 3))];
        groundedFrame('broom', f, FOX_X, y + sprite('broom', 0).oy);
        for (let i = 0; i < 12; i++) {
          const age = mod(time * 0.8 + i / 12, 1);
          const px = Math.round(FOX_X - 54 - age * 90 + Math.sin(i * 7) * 6);
          const py = Math.round(y - 12 + Math.sin(i * 3 + time * 3) * (2 + age * 8));
          if (bayer(px, py) > age * 0.9) canvas.set(px, py, S.spark);
        }
        fox.puff(FOX_X + 4, y - 44, (ground - trip.a - MOUNT) / 26);
      }
      drawn = true;
    }
    if (!drawn) {
      if (outfit) {
        const gym = eventsIn(ground - WORKOUT_REACH - 14, ground).find((e) => e.kind === 'workout');
        if (gym) fox.puff(FOX_X + 6, PATH_Y - 60, (ground - gym.a - WORKOUT_REACH) / 14 + 0.5);
      }
      groundedFrame(walkSheet, step, FOX_X, feet);
      // The idle sheet contains another whole fox, including its tail and arms.
      // Keep the painted walking pose as their sole owner throughout the stride.
    }

    land.draw(canvas, 3, view);

    weatherFx.draw(canvas, weather);

    // Brand chip (top left) and now-playing pill (top right); ffmpeg draws the text.
    roundedRect(BRAND.x, BRAND.y, BRAND.w, BRAND.h, 7, S.pill);
    canvas.draw(LOGO, BRAND.x + 7, BRAND.y + 6);
    if (pillWidth > 0) {
      roundedRect(WIDTH - 16 - pillWidth, BRAND.y, pillWidth, BRAND.h + METER, 7, S.pill);
      canvas.draw(NOTE, WIDTH - 16 - pillWidth + 9, BRAND.y + 10);
      drawMeter(WIDTH - 16 - pillWidth, pillWidth, bands, dt);
    }

    const { index } = canvas;
    for (let i = 0, o = 0; i < index.length; i++, o += 3) {
      const v = index[i] * 3;
      rgb[o] = palette[v];
      rgb[o + 1] = palette[v + 1];
      rgb[o + 2] = palette[v + 2];
    }
    return rgb;
  }

  /** The meter's falling levels, one per band, which carry over between frames. */
  function meter(bands, dt) {
    if (levels.length !== bands.length) levels = new Array(bands.length).fill(0);
    for (let i = 0; i < levels.length; i++) {
      const level = clamp01(bands[i]);
      levels[i] = level > levels[i] ? level : Math.max(level, levels[i] - dt * 1.8);
    }
  }

  /** The sound, as a row of level bars along the bottom of the now-playing chip. */
  function drawMeter(left, width, bands, dt) {
    meter(bands, dt);
    const count = Math.floor((width - 16) / 3);
    const floor = BRAND.y + BRAND.h + METER - 4;
    for (let i = 0; i < count; i++) {
      // Low notes on the left, spread as the ear hears them.
      const level = levels[Math.min(levels.length - 1, Math.floor(((i / count) ** 1.6) * levels.length))];
      const h = Math.round(level * (METER + 1));
      canvas.rect(left + 8 + i * 3, floor - h, 2, h + 1, S.logo);
    }
  }

  /** The gym routine: painted frames, hung on the real bar and rails. The hat stays off for it. */
  function workout({ name, sheet, frame: f, back, lift }) {
    if (name === 'walk') {
      const stride = walkFrame(back ? -ground : ground);
      groundedFrame('walk8', stride, FOX_X, PATH_Y, PATH_Y, { flip: back });
      return;
    }
    const s = sprite(sheet, f);
    if (sheet === 'pullup') return groundedFrame(sheet, f, FOX_X, PATH_Y - 3 - BAR + s.bar);
    if (sheet === 'dip') return groundedFrame(sheet, f, FOX_X, railY());
    if (sheet === 'pushup') return groundedFrame(sheet, f, FOX_X, PATH_Y + sprite('pushup', 0).oy);
    const hang = BAR + 5 - sprite('gym', 6).h - sprite('gym', 6).oy * 0;
    const height = sheet === 'hop' && f !== 3 ? JUMP_RAILS : sheet === 'gym' ? hang : Math.min(hang, JUMP_RAILS);
    groundedFrame(sheet, f, FOX_X, PATH_Y + s.oy - Math.round(lift * height));
  }

  /** Slow banks of mist lying between the hills, in dither over the painted land. */
  function fogBanks(view, time, fog, light) {
    const { index } = canvas;
    const amount = 0.22 + fog * 0.7;
    const scroll = Math.floor(view * 0.1 + time * 0.8);
    for (let y = 190; y < 280; y++) {
      const t = (y - 190) / 90;
      const depth = Math.sin(Math.PI * t) ** 1.5 * amount;
      for (let x = 0; x < WIDTH; x++) {
        const v = MIST[((y - 190) * 512 + ((x + scroll) & 511))];
        if (v * depth > hash(x + scroll, y, 704) * 0.5 + bayer(x, y) * 0.5) index[y * WIDTH + x] = light > 0.3 ? S.sky3 : S.sky2;
      }
    }
  }

  function roundedRect(x0, y0, w, h, r, color) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cx = x < r ? r - x - 0.5 : x >= w - r ? x - (w - r) + 0.5 : 0;
        const cy = y < r ? r - y - 0.5 : y >= h - r ? y - (h - r) + 0.5 : 0;
        if (cx * cx + cy * cy <= r * r) canvas.set(x0 + x, y0 + y, color);
      }
    }
  }

  /** Everything that carries from one frame to the next, so a worker can start mid-stream. */
  const snapshot = () => JSON.parse(JSON.stringify({ ground, lastAt, speed, hold, passedStop, wet, mood, prints, lastPrint, levels, sky: sky.snapshot(), weather: weatherFx.snapshot() }));
  function restore(state) {
    ({ ground, lastAt, speed, hold, passedStop, wet, mood, lastPrint, levels } = state);
    prints.splice(0, prints.length, ...state.prints);
    sky.restore(state.sky);
    weatherFx.restore(state.weather);
  }

  return { render, snapshot, restore, state: () => ({ mode: mood, moving: !hold && speed > 0.5, ground, speed, season: seasonAt(ground ?? 0) }) };
}
