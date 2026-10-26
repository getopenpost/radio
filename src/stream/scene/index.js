// The stream's picture, drawn at 640x360 in palette indices and upscaled 3x
// (nearest neighbour) by ffmpeg.
//
// A fox with a postbag walks a dithered landscape in time with the music.
// Every so often it stops for something (fishing, working in its studio or
// warming up at home, a campfire with friends, reading, stargazing, a
// workout, rowing across a river, flying), then walks on. The wall clock drives the sun and moon, seasons, weather,
// the region the walk passes through and what the fox does, so the picture
// keeps changing through a day and across the year.
import { createRng, hashString } from '../../compose/rng.js';
import { ACTS, drawAct } from './acts/index.js';
import { createCanvas, HEIGHT, maskSprite, WIDTH } from './canvas.js';
import { createCharacters } from './character.js';
import { createEncounters } from './encounter.js';
import { activity, sky as skyAt, weather as weatherAt, weatherAmount } from './clock.js';
import { bayer, clamp01 } from './dither.js';
import { computePalette, S, SLOTS } from './palette.js';
import { convergeMask, CREEK_SPAN, creekLift, creekRail, drawCreek, drawProp, PROP_KINDS } from './props.js';
import { createSky } from './sky.js';
import { createVisualizer, MODES } from './visualizer.js';
import { createWeather } from './weather.js';
import { buildWorld, PATH_Y, STRIP } from './world.js';

export { HEIGHT, WIDTH };

/** Where the brand chip (top left) sits, so the encoder can place its text. Both chips share its height. */
export const BRAND = { x: 16, y: 12, w: 130, h: 26, textX: 47 };
export const BRAND_TEXT = 'openpo.st/radio';

const FOX_X = 300;
const REGION_MS = 2 * 3600 * 1000;
const STRIDE = 12; // ground pixels per full walk cycle (two steps)
const DECEL = 5; // px/s² when stopping or setting off
const LOGO = maskSprite(convergeMask(20), S.logo);
const NOTE = maskSprite(['..xx', '..x.', '..x.', 'xxx.', 'xx..'].map((r) => [...r].map((ch) => ch === 'x')), S.logo);

// Slots a light pool may brighten: landscape and sky, not characters, light sources or the interface.
const LIT = new Uint8Array(256);
for (const name of ['sky0', 'sky1', 'sky2', 'far0', 'far1', 'hill0', 'hill1', 'pine0', 'pine1', 'leaf0', 'leaf1', 'blossom', 'snowcap', 'trunk', 'roof', 'wall', 'ground0', 'ground1', 'path', 'pathEdge', 'flower', 'water0', 'water1', 'bag', 'paper', 'cloud', 'cloudShade', 'smoke', 'grass', 'grassTip']) LIT[S[name]] = 1;

const mod = (a, n) => ((a % n) + n) % n;

export function createScene({ seed = 7, timeZone = 'Europe/Lisbon' } = {}) {
  const canvas = createCanvas();
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
  const palette = new Uint8Array(SLOTS * 3);
  const sky = createSky(seed);
  const chars = createCharacters();
  const weatherFx = createWeather(seed + 1);
  const visualizer = createVisualizer(seed);
  const rng = createRng(seed ^ 0x5eed);

  let world = null;
  let previous = null;
  let dissolve = 1;
  let ground = 0; // ground scroll in pixels
  let speed = 0;
  let base = 9;
  let mode = 'walk';
  let act = null;
  let props = [];
  let nextProp = 200;
  const encounters = createEncounters(createRng(seed ^ 0xf00d));
  let paused = false; // stopped to chat with a friend
  let lastStep = 0;
  let actSpeed = 0; // what the current stop asks the ground to do (flying keeps it moving)
  let actDone = false; // the current stop says it is finished (the river is crossed)
  const finished = new Set(); // stops already done in their time slot
  let lift = 0; // how high the fox is off the path
  const footprints = [];
  let started = false;

  function blit(strip, offset, prev, mix) {
    const shift = mod(Math.floor(offset), STRIP);
    const { index } = canvas;
    for (let y = 0; y < strip.height; y++) {
      const sy = strip.top + y;
      if (sy >= HEIGHT) break;
      const row = y * STRIP;
      const out = sy * WIDTH;
      let sx = shift;
      for (let x = 0; x < WIDTH; x++) {
        let v = strip.data[row + sx];
        if (prev && bayer(sx, sy) >= mix) v = prev.data[row + sx];
        if (v !== 255) index[out + x] = v;
        if (++sx === STRIP) sx = 0;
      }
    }
  }

  /** Screen x of a point in a strip's coordinates, or null when off screen. */
  const onScreen = (x, offset, margin = 30) => {
    let sx = mod(x - Math.floor(offset), STRIP);
    if (sx > STRIP - margin) sx -= STRIP;
    return sx > -margin && sx < WIDTH + margin ? sx : null;
  };

  function drawHillLife(time, offset, light) {
    for (const d of world.hills.dynamic) {
      const sx = onScreen(d.x, offset, 140);
      if (sx == null) continue;
      if (d.kind === 'chimney' && (light < 0.7 || world.season === 'winter')) {
        for (let i = 0; i < 5; i++) {
          const age = (time * 0.25 + i / 5) % 1;
          const px = Math.round(sx + age * 6 + Math.sin(age * 5 + i) * 1.5);
          const py = Math.round(d.y - age * 14);
          if (bayer(px, py) < 0.7 - age * 0.5) canvas.set(px, py, S.smoke);
        }
      } else if (d.kind === 'windmill') {
        // A tapered tower with a cap and a door; four cloth sails turning slowly.
        for (let y = 0; y < 18; y++) {
          const half = Math.round(4.5 - y * 0.12);
          for (let dx = -half; dx <= half; dx++) canvas.set(sx + dx, d.y - y, dx > half - 2 ? S.wallShade : S.wall);
        }
        canvas.rect(sx - 1, d.y - 3, 2, 3, S.door);
        canvas.set(sx, d.y - 10, light < 0.5 ? S.window : S.windowOff);
        for (let k = 0; k < 4; k++) canvas.rect(sx - 3 + k, d.y - 21 + Math.abs(k - 1.5) | 0, 1, 4, S.roof);
        const hub = [sx, d.y - 19];
        for (let b = 0; b < 4; b++) {
          const a = time * 0.5 + (b * Math.PI) / 2;
          const [ux, uy] = [Math.cos(a), Math.sin(a)];
          for (let r = 2; r <= 12; r++) {
            canvas.set(Math.round(hub[0] + ux * r), Math.round(hub[1] + uy * r), S.trunk);
            if (r > 3) for (let w = 1; w <= 2; w++) canvas.set(Math.round(hub[0] + ux * r - uy * w), Math.round(hub[1] + uy * r + ux * w), S.banner);
          }
        }
        canvas.set(hub[0], hub[1], S.ink);
      } else if (d.kind === 'lighthouse') {
        canvas.rect(sx - 1, d.y, 3, 2, light < 0.5 ? S.lampLight : S.wall);
        if (light < 0.5) {
          // A slow sweeping beam out to sea.
          const a = time * 0.7;
          const dir = Math.cos(a);
          const reach = 150 * Math.abs(dir);
          for (let r = 4; r < reach; r++) {
            const spread = r * 0.12;
            const px0 = sx + Math.sign(dir) * r;
            for (let dy = -spread; dy <= spread; dy++) {
              const px = Math.round(px0);
              const py = Math.round(d.y + 1 + dy);
              const v = canvas.get(px, py);
              if (LIT[v] && (1 - r / reach) * 0.7 * (1 - light * 2) > bayer(px, py)) canvas.set(px, py, S.sky2);
            }
          }
        }
      }
    }
  }

  /** Pick what the fox should be doing, given the plan and the conditions. */
  function planned(date, light, rain, snow, overcast, season) {
    const plan = activity(date, light);
    const spec = ACTS[plan.kind];
    let kind = plan.kind;
    if (spec) {
      if ((spec.light === 'day' && light < 0.4) || (spec.light === 'night' && light > 0.4)) kind = 'walk';
      if (kind === 'stargaze' && (overcast > 0.3 || rain > 0.1 || snow > 0.1)) kind = 'walk';
      if ((kind === 'read' || kind === 'campfire') && rain > 0.3) kind = 'walk';
      if (kind === 'fly' && (rain > 0.3 || snow > 0.3)) kind = 'walk';
      if (kind === 'gym' && rain > 0.2) kind = 'walk';
      if (kind === 'river' && season === 'winter') kind = 'walk';
      // Home by the fire only when it is cold out.
      if (kind === 'home' && !(season === 'winter' || snow > 0.2 || (season === 'autumn' && light < 0.5))) kind = 'walk';
    }
    return { ...plan, kind };
  }

  function startAct(kind, plan, time, immediate) {
    const spec = ACTS[kind];
    const ahead = immediate ? 0 : spec.anchored ? WIDTH - FOX_X - spec.extent[0] + 20 : 30;
    const wx = ground + FOX_X + ahead;
    props = props.filter((p) => p.wx < wx + spec.extent[0] - 20 || p.wx > wx + spec.extent[1] + 20);
    act = { kind, wx, start: immediate ? time : null, outStart: null, end: plan.end, key: `${kind}:${plan.start}`, seed: hashString(`${kind}:${plan.start}`), state: {} };
    actDone = false;
    mode = immediate ? 'stay' : 'arrive';
    if (immediate) speed = 0;
  }

  /**
   * Draw one frame.
   * @param {object} s
   * @param {number} s.time    seconds since the stream started (drives motion)
   * @param {number} s.dt      seconds since the previous frame
   * @param {Date}   s.date    wall clock (drives sky, season, weather, activities)
   * @param {number} s.beat    beats elapsed in the current track
   * @param {number} s.bpm     current tempo; the walk keeps step with it
   * @param {Float32Array} s.bands spectrum levels in [0, 1], low to high
   * @param {number} s.pillWidth now-playing pill width (0 hides it)
   * @param {string} [s.trackId] current track; each track picks a visualizer look
   * @param {object} [s.steer] for previews: force `activity`, `weather` ({ previous, current, mix }),
   *   `region`, a sky event (`trigger`), a passer-by (`npc`, `chat`), a visualizer `look`, or
   *   drop a leftover set after a jump in time (`fresh`)
   * @returns {Buffer} RGB24 frame
   */
  function render({ time, dt, date, beat, bpm = 90, bands, pillWidth, trackId, steer }) {
    const st = skyAt(date, timeZone);
    const w = steer?.weather ?? weatherAt(date, st.season);
    const rain = weatherAmount(w, 'rain');
    const snow = weatherAmount(w, 'snow');
    const fog = weatherAmount(w, 'fog');
    const windy = weatherAmount(w, 'windy');
    const overcast = clamp01(weatherAmount(w, 'cloudy') * 0.7 + rain + snow * 0.8 + fog * 0.5);
    const wind = 0.15 + windy * 0.85 + rain * 0.3;
    const moonUp = st.moon != null ? Math.sin(Math.PI * st.moon) : 0;
    const moonlight = moonUp * (1 - Math.abs(st.moonAge - 0.5) * 2) * (1 - overcast);
    computePalette(palette, { light: st.light, warmth: st.warmth, season: st.season, overcast, rain, fog, moonlight });

    // The region changes every couple of hours, and with the season; the new
    // country dissolves in through the dither.
    const region = steer?.region ?? Math.floor(date.getTime() / REGION_MS);
    if (!world || world.region !== region || world.season !== st.season) {
      const next = buildWorld(region, st.season);
      previous = world ? world : null;
      world = next;
      dissolve = previous ? 0 : 1;
    }
    if (dissolve < 1) dissolve = Math.min(1, dissolve + dt / 45);
    const prev = dissolve < 1 ? previous : null;

    // Walking pace follows the tempo, one step per beat, nudged to land on the beat.
    base += (6 * (bpm / 60) - base) * Math.min(1, dt * 0.5);
    const stepPhase = mod(ground / STRIDE, 1);
    const err = mod(beat * 0.5 - stepPhase + 0.25, 0.5) - 0.25;
    const walkSpeed = base * (1 + Math.max(-0.3, Math.min(0.3, err * 1.5)));

    const plan = steer?.activity ? { kind: steer.activity, start: steer.key ?? 0, end: date.getTime() + 3600000 } : planned(date, st.light, rain, snow, overcast, st.season);
    const fresh = !finished.has(`${plan.kind}:${plan.start}`);
    // Previews that jump in time drop whatever set was still scrolling away.
    if (steer?.fresh && act && act.kind !== plan.kind) {
      act = null;
      mode = 'walk';
      speed = walkSpeed;
    }
    if (steer?.trigger) sky.trigger(steer.trigger, `${steer.trigger}:${time}`);
    if (!started) {
      started = true;
      if (plan.kind !== 'walk' && plan.end - date.getTime() > 120000) startAct(plan.kind, plan, time, true);
    }
    if (mode === 'walk') {
      speed = paused ? Math.max(0, speed - DECEL * 3 * dt) : Math.min(walkSpeed, speed + DECEL * dt);
      if (!paused && !encounters.active && plan.kind !== 'walk' && fresh && plan.end - date.getTime() > 150000) startAct(plan.kind, plan, time, false);
    }
    if (mode === 'arrive') {
      const remaining = act.wx - FOX_X - ground;
      speed = Math.min(walkSpeed, Math.sqrt(2 * DECEL * Math.max(0, remaining)));
      if (remaining <= 0.4 || speed * dt >= remaining) {
        ground = act.wx - FOX_X;
        speed = 0;
        mode = 'stay';
        act.start = time;
      }
    }
    if (mode === 'stay') {
      speed += (actSpeed - speed) * Math.min(1, dt * 2);
      const spec = ACTS[act.kind];
      if (act.outStart == null && (actDone || plan.kind !== act.kind || date.getTime() > act.end - spec.outro * 1000 - 3000)) act.outStart = time;
      if (act.outStart != null && time - act.outStart >= spec.outro) {
        mode = 'leave';
        finished.add(act.key);
        actSpeed = 0;
        if (!spec.anchored) act = null;
      }
    } else if (mode === 'leave') {
      speed = Math.min(walkSpeed, speed + DECEL * dt * 0.8);
      if (act && act.wx + ACTS[act.kind].extent[1] - ground < -20) act = null;
      if (!act && speed >= walkSpeed * 0.98) mode = 'walk';
    }
    ground += speed * dt;

    // Sky, then the three landscape layers in parallax.
    sky.draw(canvas, { time, dt, light: st.light, sunProgress: st.sun, moonProgress: st.moon, moonAge: st.moonAge, overcast, wind, date });
    const farOffset = ground * 0.08;
    const hillOffset = ground * 0.3;
    blit(world.far, farOffset, prev?.far, dissolve);
    blit(world.hills, hillOffset, prev?.hills, dissolve);
    const glows = [];
    drawHillLife(time, hillOffset, st.light);
    blit(world.ground, ground, prev?.ground, dissolve);

    // Props along the path while walking.
    while (nextProp < ground + WIDTH + 40) {
      const blocked = act && nextProp > act.wx + ACTS[act.kind].extent[0] - 40 && nextProp < act.wx + ACTS[act.kind].extent[1] + 40;
      if (!blocked && mode !== 'arrive') {
        // Now and then the path crosses a creek on a little footbridge.
        const creek = rng.chance(0.12);
        const kinds = [...PROP_KINDS.any, ...PROP_KINDS[st.season]];
        props.push({ kind: creek ? 'creek' : rng.pick(kinds), wx: nextProp, seed: rng.int(0, 999) });
        if (creek) nextProp += CREEK_SPAN + 60;
      }
      nextProp += rng.int(110, 340);
    }
    props = props.filter((p) => p.wx - ground > -40);
    let bridge = 0; // how high a footbridge lifts the fox
    for (const p of props) {
      if (p.kind === 'creek') {
        const x = Math.round(p.wx - ground);
        drawCreek(canvas, x, PATH_Y, time);
        bridge = Math.max(bridge, creekLift(FOX_X - x));
        continue;
      }
      const lamp = drawProp(canvas, p.kind, Math.round(p.wx - ground), PATH_Y - 3, p.seed);
      if (lamp && st.light < 0.55) glows.push({ x: lamp.x, y: lamp.y + 2, r: 22, strength: 0.9 * (1 - st.light * 1.6), squash: 0.8 });
    }

    // Footprints in the snow.
    if (st.season === 'winter') {
      const stepIndex = Math.floor((ground / STRIDE) * 2);
      if (stepIndex !== lastStep && speed > 0.5 && lift === 0) {
        footprints.push(ground + FOX_X + (stepIndex % 2 ? 2 : -1));
        if (footprints.length > 60) footprints.shift();
      }
      lastStep = stepIndex;
      for (const f of footprints) {
        const x = Math.round(f - ground);
        if (x > -4 && x < FOX_X - 2) canvas.rect(x, PATH_Y, 2, 1, S.pathEdge);
      }
    }

    // The set for the current stop, behind the fox.
    const spec = act && ACTS[act.kind];
    const overlays = [];
    let actPose = null;
    let after = null;
    let actLift = 0;
    if (act) {
      const X = spec.anchored ? Math.round(act.wx - ground) : FOX_X; // unanchored sets travel with the fox
      const t = act.start == null ? -1 : time - act.start;
      const out = act.outStart == null ? 0 : Math.min(spec.outro, time - act.outStart);
      const res = drawAct(act.kind, {
        canvas, chars, X, Y: PATH_Y, foxX: FOX_X, t, out, time, dt, beat, light: st.light, season: st.season, rain, glows, overlays, seed: act.seed, state: act.state,
        hours: st.hours, moonUp: st.moon != null && st.light < 0.5, moonAge: st.moonAge,
        festive: (st.month === 10 && st.day >= 24) || (st.month === 11 && st.day <= 1),
        trigger: (kind, key) => sky.trigger(kind, key),
      });
      if (res && mode === 'stay') {
        actPose = res.pose;
        actLift = res.lift ?? 0;
      }
      after = res?.after ?? null; // sets still draw over the fox while it walks away
      actSpeed = res?.speed ?? 0;
      actDone = Boolean(res?.done);
    }
    lift = actLift || bridge;

    // A friend passing the other way now and then: a wave, or a stop for a chat.
    const meeting = encounters.update(canvas, chars, {
      time, dt, speed, walking: mode === 'walk' && !act, foxX: FOX_X, y: PATH_Y - 3, rain, winter: st.season === 'winter', hour: st.hours, force: steer?.npc, forceChat: steer?.chat,
    });
    paused = meeting.pause;

    // The fox.
    // Walking left (back across a set) mirrors the stride so the feet stay planted.
    const facing = actPose?.facing ?? 1;
    const step = mod((facing * ground) / STRIDE, 1);
    const moving = Math.abs(speed) > 0.3;
    const pose = moving
      ? { legs: 'walk', step, bob: -Math.round(Math.abs(Math.sin(2 * Math.PI * step))), tail: Math.sin(2 * Math.PI * step), front: [2 + Math.round(Math.sin(2 * Math.PI * step) * 2), 5], back: [-2 - Math.round(Math.sin(2 * Math.PI * step) * 2), 5] }
      : { legs: 'stand', tail: Math.sin(time * 1.3) * 0.6 };
    pose.eyes = 'open';
    if (moving && Math.floor(beat / 16) % 4 === 3) {
      // Vibing: eyes shut, nodding along.
      pose.eyes = 'closed';
      pose.headY = Math.floor(beat) % 2 ? 1 : 0;
    }
    const hour = st.hours;
    if (hour > 0.5 && hour < 5 && time % 190 < 2) {
      pose.eyes = 'closed';
      pose.mouth = 'o';
    }
    const plane = sky.event?.kind === 'plane' && !sky.event.done && sky.event.x > 120 && sky.event.x < 520;
    if (plane) {
      pose.eyes = 'up';
      pose.front = [3, -9];
    }
    if (meeting.fox) Object.assign(pose, meeting.fox);
    if (actPose) Object.assign(pose, actPose);
    if (mod(time, 4.3) < 0.12 && (pose.eyes === 'open' || pose.eyes === 'focus')) pose.eyes = 'blink';
    if (st.season === 'winter' && !actPose?.indoors) pose.winter = true;
    // Under an umbrella in the rain (outdoors, hands free): it leans into the
    // walk and the wind and rocks with each step.
    if (rain > 0.35 && !actPose?.indoors && act?.kind !== 'fly' && !actPose?.back) {
      pose.umbrella = (moving ? 0.16 + Math.sin(2 * Math.PI * step) * 0.05 : 0.04) + wind * 0.12;
    }
    const paws = chars.draw(canvas, 'fox', FOX_X, PATH_Y - lift, facing, pose);
    if (after) after(paws);
    for (const o of overlays) o(paws);
    for (const p of props) if (p.kind === 'creek') creekRail(canvas, Math.round(p.wx - ground), PATH_Y);
    for (const b of meeting.bubbles) b(paws.top);

    weatherFx.draw(canvas, {
      dt, time, rain, snow, wind, scroll: speed,
      leaves: st.season === 'autumn' ? 0.25 + windy * 0.75 : 0,
      fireflies: st.season === 'summer' && st.light < 0.3 ? 1 - st.light * 3 : 0,
    });

    // Light pools after dark.
    if (st.light < 0.75) for (const g of glows) canvas.glow(g.x, g.y, g.r, g.strength, [S.glow0, S.glow1], LIT, g.squash ?? 1);

    if (steer?.look) visualizer.choose(steer.look);
    else if (trackId) visualizer.choose(MODES[hashString(trackId) % MODES.length]);
    visualizer.draw(canvas, { dt, bands, scroll: ground });

    // Brand chip (top left) and now-playing pill (top right); ffmpeg draws the text.
    roundedRect(BRAND.x, BRAND.y, BRAND.w, BRAND.h, 7, S.pill);
    canvas.draw(LOGO, BRAND.x + 5, BRAND.y + 3);
    if (pillWidth > 0) {
      roundedRect(WIDTH - 16 - pillWidth, BRAND.y, pillWidth, BRAND.h, 7, S.pill);
      canvas.draw(NOTE, WIDTH - 16 - pillWidth + 9, BRAND.y + 10);
    }

    const { index } = canvas;
    for (let i = 0, o = 0; i < index.length; i++, o += 3) {
      const c = index[i] * 3;
      rgb[o] = palette[c];
      rgb[o + 1] = palette[c + 1];
      rgb[o + 2] = palette[c + 2];
    }
    return rgb;
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

  return { render, state: () => ({ mode, act: act?.kind ?? null, region: world?.region, biome: world?.biome, meeting: Boolean(encounters.active) }) };
}
