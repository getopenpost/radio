// The stream's picture, drawn on a single 640x360 pixel grid and enlarged by a
// whole number in ffmpeg. A fox with a postbag travels right through an endless
// countryside. It walks, picks up a bicycle, rows a lake, sails a coast, rides a
// broom, and pauses only for a quick workout or a look through a telescope. The
// wall clock drives the sun, moon and weather; distance drives country and season.
import { BOAT, IDLE, LOOK, RAILS, SCOPE_SECONDS, STRIDE, WALK_FRAMES, WORKOUT_SECONDS, workoutAt } from './acts.js';
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
import { createWater, swellAt } from './water.js';
import { createWeather } from './weather.js';

export { HEIGHT, WIDTH };

/** Where the brand chip (top left) sits, so the encoder can place its text. Both chips share its height. */
export const BRAND = { x: 16, y: 12, w: 130, h: 26, textX: 47 };
export const BRAND_TEXT = 'openpo.st/radio';

const FOX_X = WIDTH / 2;
const ACCEL = 34; // px/s² when changing pace
const LOGO = maskSprite(convergeMask(20, 2), S.logo);
const NOTE = maskSprite(['..xx', '..x.', '..x.', 'xxx.', 'xx..'].map((r) => [...r].map((ch) => ch === 'x')), S.logo);
const BAR = 90; // pull-up bar height above the road
const RAIL = 50; // dip rail height
const HEAD_ROWS = 40; // top rows of a frame that hold the head
const NECK = 34; // rows of a walk frame above the floor that stay the frame's own

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
const BROOM_ALONE = 5;
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

  /** The gym: one bar and, a little further on, two rails, always the same pixels. */
  function drawBar(x) {
    for (const dx of [-30, 28]) {
      canvas.rect(x + dx - 1, PATH_Y - 2 - BAR, 4, BAR + 2, S.ink);
      canvas.rect(x + dx, PATH_Y - 2 - BAR, 2, BAR + 2, S.steel1);
    }
    canvas.rect(x - 34, PATH_Y - 3 - BAR, 68, 3, S.ink);
    canvas.rect(x - 34, PATH_Y - 2 - BAR, 68, 1, S.steel0);
  }
  function drawRail(x, y) {
    for (const dx of [-24, 22]) {
      canvas.rect(x + dx - 1, y, 4, PATH_Y - y, S.ink);
      canvas.rect(x + dx, y, 2, PATH_Y - y, S.wood);
    }
    canvas.rect(x - 28, y - 1, 56, 3, S.ink);
    canvas.rect(x - 28, y, 56, 1, S.steel0);
  }

  /** A hop on or off something: one short jump, the same for every vehicle. */
  function hop(p, fromY, toY, outfit, dismount = false) {
    const frames = dismount ? [3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
    const i = frames[Math.min(frames.length - 1, Math.floor(p * frames.length))];
    const sheet = `hop${outfit}`;
    const y = fromY + (toY - fromY) * p - Math.sin(Math.PI * p) * 16;
    frame(canvas, sheet, i, FOX_X, Math.round(y) + sprite(sheet, i).oy);
  }

  /** The body in a standing pose with its feet on the road. */
  function stood(sheet, i, x, y = PATH_Y, flip = false) {
    frame(canvas, sheet, i, x, y + sprite(sheet, i).oy, { flip });
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
      if (pillWidth > 0) meter(pillWidth, bands, dt);
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
        drawRail(at(e.a + RAILS), PATH_Y - RAIL - 4);
      } else if (e.kind === 'scope') {
        frame(canvas, 'props', 0, at(e.a) + SCOPE_OFFSET, PATH_Y + 3);
      } else if (e.kind === 'bike') {
        if (ground < e.a + MOUNT) fox.bike(at(e.a + MOUNT), PATH_Y, 0.4);
        if (ground >= e.b - MOUNT) fox.bike(at(e.b - MOUNT), PATH_Y, 0.4);
      } else if (e.kind === 'row' || e.kind === 'sail') {
        const hull = e.kind === 'row' ? BOAT.moored : BOAT.sailMoored;
        for (const d of [e.a + HOP, e.b - HOP]) {
          if (d === e.a + HOP ? ground >= d : ground < d) continue;
          frame(canvas, 'boat', hull, at(d), HULL_Y + seesaw(at(d)));
        }
      } else if (e.kind === 'broom') {
        // It waits at knee height, on the line the fox will ride it.
        const hover = PATH_Y - 3 + Math.round(Math.sin(time * 1.6) * 1.4) + sprite('broom', BROOM_ALONE).oy;
        if (ground < e.a + MOUNT) frame(canvas, 'broom', BROOM_ALONE, at(e.a + MOUNT) + 4, hover);
        if (ground >= e.b - MOUNT) frame(canvas, 'broom', BROOM_ALONE, at(e.b - MOUNT) + 4, hover);
      }
    }

    // A friend coming the other way: neither stops, both wave.
    const friend = kind === 'walk' && !hold ? friendNear(ground) : null;
    const greeting = friend && Math.abs(friend.rel) < 92;
    if (friend) {
      const step = Math.floor(mod(-friend.rel / 1.76 / (STRIDE / 2), 1) * 4);
      const x = Math.round(FOX_X + friend.rel);
      const y = roadY(ground + friend.rel) - 4;
      shadow(x, y, 16);
      frame(canvas, 'friends', friend.offset + step, x, y);
    }

    // --- The fox. ---
    const outfit = rain > 0.3 ? '-rain' : c.winter > 0.5 ? '-snow' : '';
    const walkSheet = `walk12${outfit}`;
    const step = Math.floor(mod(ground / STRIDE, 1) * WALK_FRAMES);
    let drawn = false;
    if (hold) {
      if (hold.event.kind === 'workout') {
        drawn = workout(workoutAt(hold.t), hold.event, outfit, at);
      } else {
        // Eye to the eyepiece. The telescope itself never changes.
        stood('gestures', LOOK, FOX_X, PATH_Y);
        drawn = true;
      }
    } else if (kind === 'bike') {
      const on = (ground - trip.a) / MOUNT;
      const off = (trip.b - ground) / MOUNT;
      shadow(FOX_X, feet + 1, 36);
      if (on < 1) hop(clamp01(on), PATH_Y, PATH_Y - 34, outfit);
      else if (off < 1) hop(1 - clamp01(off), PATH_Y - 34, PATH_Y, outfit, true);
      else {
        fox.ride(FOX_X, feet, ground / WHEEL, ground / 16);
        fox.puff(FOX_X, PATH_Y - 44, (ground - trip.a - MOUNT) / 22);
      }
      drawn = true;
    } else if (boat) {
      const on = (ground - trip.a) / HOP;
      const off = (trip.b - ground) / HOP;
      const y = HULL_Y + bob;
      if (on < 1 || off < 1) {
        // Stepping aboard or ashore; the near side of the boat passes in front of the legs.
        if (on < 1) hop(clamp01(on), PATH_Y, y - 40, outfit);
        else hop(1 - clamp01(off), y - 40, PATH_Y, outfit, true);
        const d = on < 1 ? trip.a + HOP : trip.b - HOP;
        if (kind === 'row') fox.hullFront(at(d), y);
      } else {
        const tilt = Math.round(swellAt(ground, time).tilt * 1.2);
        if (kind === 'row') {
          fox.row(FOX_X, y, ground / 12, (bx, by) => splash(bx, Math.max(by, WATERLINE - 4), time), outfit);
        } else {
          frame(canvas, 'boat', BOAT.sailing, FOX_X, y, { tilt });
        }
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
        const s = sprite('broom', 0);
        frame(canvas, 'broom', 0, FOX_X, y + s.oy);
        for (let i = 0; i < 12; i++) {
          const age = mod(time * 0.8 + i / 12, 1);
          const px = Math.round(FOX_X - 54 - age * 90 + Math.sin(i * 7) * 6);
          const py = Math.round(y - 12 + Math.sin(i * 3 + time * 3) * (2 + age * 8));
          if (bayer(px, py) > age * 0.9) canvas.set(px, py, S.spark);
        }
        if (lift < 0.4) shadow(FOX_X, feet + 1, 24);
        fox.puff(FOX_X + 4, y - 44, (ground - trip.a - MOUNT) / 26);
      }
      drawn = true;
    }
    if (!drawn) {
      if (onLand) shadow(FOX_X, feet + 1, 24);
      // The body takes the frame; the head rides a pixel lower on each footfall.
      const s = sprite(walkSheet, step);
      const headRows = s.oy + s.h - NECK;
      frame(canvas, walkSheet, step, FOX_X, feet, { skip: headRows });
      const nod = step % 6 < 3 ? 1 : 0;
      frame(canvas, walkSheet, step, FOX_X, feet + nod, { rows: headRows });
      // Small gestures laid over the stride. The gesture sheet shares the walk's head.
      if (walkSheet === 'walk12') {
        const vibing = Math.floor(beat / 32) % 5 === 3;
        let g = null;
        if (mod(time, 4.3) < 0.14) g = IDLE.blink;
        else if (greeting) g = Math.floor(time * 6) % 2 ? IDLE.waveA : IDLE.waveB;
        else if (vibing) g = IDLE.happy;
        else if (sky.event?.kind === 'birds' && !sky.event.done && sky.event.x > 30 && sky.event.x < 290) g = IDLE.up;
        if (g != null) frame(canvas, 'idle-moves', g, FOX_X, feet + nod, { rows: greeting ? 48 : HEAD_ROWS });
      }
    }

    land.draw(canvas, 3, view);

    weatherFx.draw(canvas, weather);

    // Brand chip (top left) and now-playing pill (top right); ffmpeg draws the text.
    roundedRect(BRAND.x, BRAND.y, BRAND.w, BRAND.h, 7, S.pill);
    canvas.draw(LOGO, BRAND.x + 5, BRAND.y + 3);
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

  /** The meter's falling levels, which carry over between frames. */
  function meter(width, bands, dt) {
    const count = Math.floor((width - 16) / 3);
    if (levels.length !== count) levels = new Array(count).fill(0);
    for (let i = 0; i < count; i++) {
      // Low notes on the left, spread as the ear hears them.
      const at = Math.min(bands.length - 1, Math.floor(((i / count) ** 1.6) * bands.length));
      const level = clamp01(bands[at] ?? 0);
      levels[i] = level > levels[i] ? level : Math.max(level, levels[i] - dt * 1.8);
    }
  }

  /** The sound, as a row of level bars along the bottom of the now-playing chip. */
  function drawMeter(left, width, bands, dt) {
    meter(width, bands, dt);
    const floor = BRAND.y + BRAND.h + METER - 4;
    levels.forEach((level, i) => {
      const h = Math.round(level * (METER + 1));
      canvas.rect(left + 8 + i * 3, floor - h, 2, h + 1, S.logo);
    });
  }

  /** The gym routine. Hands stay on their bars; only the shoulders travel. */
  function workout({ name, p, reps, back }, e, outfit, at) {
    const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
    const rep = (n) => ease(Math.abs((((p * n) % 1) * 2) - 1)); // 1 at both ends of a rep, 0 in the middle
    const barY = PATH_Y - 2 - BAR;
    const railY = PATH_Y - RAIL - 4;
    const gym = `gym${outfit}`;
    switch (name) {
      case 'walk': {
        const stride = Math.floor(mod(ground / STRIDE, 1) * WALK_FRAMES);
        const f = back ? WALK_FRAMES - 1 - stride : stride;
        shadow(FOX_X, PATH_Y + 1, 24);
        frame(canvas, `walk12${outfit}`, f, FOX_X, PATH_Y, { flip: back });
        break;
      }
      case 'stand': stood(gym, 2, FOX_X); break;
      case 'turn': stood('gym', 3, FOX_X); break;
      case 'crouch': stood(gym, 5, FOX_X); break;
      case 'reach': stood(gym, 6, FOX_X, PATH_Y - Math.round(ease(p) * (BAR - 78))); break;
      case 'pull': fox.hang(FOX_X, barY, 33 - (1 - rep(reps)) * 21, outfit); break;
      case 'muscle': fox.hang(FOX_X, barY, 33 - (1 - rep(reps)) * 62, outfit); break;
      case 'drop': stood(gym, 7, FOX_X, PATH_Y - Math.round((1 - p) ** 2 * (BAR - 78))); break;
      case 'mount': stood(gym, 6, FOX_X, PATH_Y - Math.round(ease(p) * 14)); break;
      case 'dip': fox.hang(FOX_X, railY, -24 + (1 - rep(reps)) * 17, outfit); break;
      case 'dismount': stood(gym, 7, FOX_X, PATH_Y - Math.round((1 - p) ** 2 * 14)); break;
      case 'down': stood(gym, 5, FOX_X, PATH_Y); break;
      case 'push': {
        // The toes stay put; the chest rises and sinks on one straight arm.
        const tilt = Math.round(-11 + (1 - rep(reps)) * 15);
        frame(canvas, gym, 1, FOX_X, PATH_Y + sprite(gym, 1).oy, { tilt, clipY: PATH_Y + 1 });
        fox.arm(FOX_X + 8, PATH_Y - 26 + Math.round(tilt * 0.6), FOX_X + 7, PATH_Y - 1, 1, false);
        break;
      }
      case 'up': stood(gym, 5, FOX_X, PATH_Y); break;
      default: stood(gym, 2, FOX_X);
    }
    // The rail is in front of the body, so the fox sits between its two sides.
    if (name === 'dip') drawRail(at(e.a + RAILS), railY);
    return true;
  }

  /** Water thrown up where the oar blade bites. */
  function splash(x, y, time) {
    for (let i = 0; i < 6; i++) {
      const a = hash(i, Math.floor(time * 8), 811);
      canvas.set(Math.round(x + (a - 0.5) * 12), Math.round(y - hash(i, Math.floor(time * 8), 812) * 5), S.foam);
    }
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
