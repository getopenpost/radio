// The stream's picture, drawn at 640x360 in palette indices and upscaled 3x
// (nearest neighbour) by ffmpeg.
//
// A fox with a postbag walks a dithered landscape in time with the music.
// Every so often it stops for something (fishing, working at a desk that
// rises out of the ground, a campfire with friends, reading, stargazing),
// then walks on. The wall clock drives the sun and moon, seasons, weather,
// the region the walk passes through and what the fox does, so the picture
// keeps changing through a day and across the year.
import { createRng, hashString } from '../../compose/rng.js';
import { ACTS, drawAct } from './acts.js';
import { createCanvas, HEIGHT, maskSprite, WIDTH } from './canvas.js';
import { createCharacters } from './character.js';
import { activity, sky as skyAt, weather as weatherAt, weatherAmount } from './clock.js';
import { bayer, clamp01 } from './dither.js';
import { computePalette, S, SLOTS } from './palette.js';
import { convergeMask, drawProp, PROP_KINDS } from './props.js';
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
  let npc = null;
  let nextNpc = 90;
  let lastStep = 0;
  let actSpeed = 0; // what the current stop asks the ground to do (flying keeps it moving)
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
        canvas.line(sx - 2, d.y, sx, d.y - 16, S.wall);
        canvas.line(sx + 2, d.y, sx, d.y - 16, S.wall);
        for (let b = 0; b < 4; b++) {
          const a = time * 0.6 + (b * Math.PI) / 2;
          canvas.line(sx, d.y - 16, sx + Math.cos(a) * 9, d.y - 16 + Math.sin(a) * 9, S.ink);
        }
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
  function planned(date, light, rain, snow, overcast) {
    const plan = activity(date, light);
    const spec = ACTS[plan.kind];
    let kind = plan.kind;
    if (spec) {
      if ((spec.light === 'day' && light < 0.4) || (spec.light === 'night' && light > 0.4)) kind = 'walk';
      if (kind === 'stargaze' && (overcast > 0.3 || rain > 0.1 || snow > 0.1)) kind = 'walk';
      if ((kind === 'read' || kind === 'campfire') && rain > 0.3) kind = 'walk';
      if (kind === 'fly' && (rain > 0.3 || snow > 0.3)) kind = 'walk';
    }
    return { ...plan, kind };
  }

  function startAct(kind, plan, time, immediate) {
    const spec = ACTS[kind];
    const ahead = immediate ? 0 : spec.anchored ? WIDTH - FOX_X - spec.extent[0] + 20 : 30;
    const wx = ground + FOX_X + ahead;
    props = props.filter((p) => p.wx < wx + spec.extent[0] - 20 || p.wx > wx + spec.extent[1] + 20);
    act = { kind, wx, start: immediate ? time : null, outStart: null, end: plan.end, seed: hashString(`${kind}:${plan.start}`) };
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
   *   `region`, a sky event (`trigger`), a passer-by (`npc`) or a visualizer `look`
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

    const plan = steer?.activity ? { kind: steer.activity, start: 0, end: date.getTime() + 3600000 } : planned(date, st.light, rain, snow, overcast);
    if (steer?.trigger) sky.trigger(steer.trigger, `${steer.trigger}:${time}`);
    if (!started) {
      started = true;
      if (plan.kind !== 'walk' && plan.end - date.getTime() > 120000) startAct(plan.kind, plan, time, true);
    }
    if (mode === 'walk') {
      speed = Math.min(walkSpeed, speed + DECEL * dt);
      if (plan.kind !== 'walk' && plan.end - date.getTime() > 150000) startAct(plan.kind, plan, time, false);
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
      if (act.outStart == null && (plan.kind !== act.kind || date.getTime() > act.end - spec.outro * 1000 - 3000)) act.outStart = time;
      if (act.outStart != null && time - act.outStart >= spec.outro) {
        mode = 'leave';
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
        const kinds = [...PROP_KINDS.any, ...PROP_KINDS[st.season]];
        props.push({ kind: rng.pick(kinds), wx: nextProp, seed: rng.int(0, 999) });
      }
      nextProp += rng.int(110, 340);
    }
    props = props.filter((p) => p.wx - ground > -40);
    for (const p of props) {
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
        canvas, chars, X, Y: PATH_Y, t, out, time, dt, beat, light: st.light, season: st.season, rain, glows, overlays, seed: act.seed,
        festive: (st.month === 10 && st.day >= 24) || (st.month === 11 && st.day <= 1),
        trigger: (kind, key) => sky.trigger(kind, key),
      });
      if (res && mode === 'stay') {
        actPose = res.pose;
        after = res.after;
        actLift = res.lift ?? 0;
      }
      actSpeed = res?.speed ?? 0;
    }
    lift = actLift;

    // A friend passing the other way now and then; they wave at each other.
    if (!npc && mode === 'walk' && (time > nextNpc || steer?.npc)) {
      npc = { species: rng.chance(0.5) ? 'bunny' : 'bear', x: WIDTH + 24, walked: 0 };
      nextNpc = time + rng.int(240, 720);
    }
    let greeting = false;
    if (npc) {
      npc.walked += 7 * dt;
      npc.x -= (speed + 7) * dt;
      greeting = Math.abs(npc.x - FOX_X) < 46;
      chars.draw(canvas, npc.species, Math.round(npc.x), PATH_Y - 3, -1, { legs: 'walk', step: npc.walked / STRIDE, eyes: greeting ? 'happy' : 'open', front: greeting ? [3, -9] : [2, 5], tail: Math.sin(npc.walked) });
      if (npc.x < -40) npc = null;
    }

    // The fox.
    const step = mod(ground / STRIDE, 1);
    const moving = speed > 0.3;
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
    if (greeting) {
      pose.eyes = 'happy';
      pose.front = [3, -9];
      pose.mouth = 'open';
    }
    if (actPose) Object.assign(pose, actPose);
    if (mod(time, 4.3) < 0.12 && (pose.eyes === 'open' || pose.eyes === 'focus')) pose.eyes = 'blink';
    if (st.season === 'winter') {
      pose.beanie = true;
      pose.scarf = true;
    }
    const umbrella = rain > 0.35 && act?.kind !== 'desk' && act?.kind !== 'fly';
    if (umbrella && !actPose?.back) pose.back = [1, -12];
    const paws = chars.draw(canvas, 'fox', FOX_X, PATH_Y - lift, 1, pose);
    if (umbrella) {
      const [ux, uy] = umbrella && !actPose?.back ? paws.backPaw : [FOX_X - 4, PATH_Y - 20];
      canvas.line(ux, uy, ux, PATH_Y - 44, S.ink);
      for (let dx = -14; dx <= 14; dx++) {
        const h = Math.round(Math.sqrt(Math.max(0, 196 - dx * dx)) * 0.45);
        for (let y = 0; y <= h; y++) canvas.set(ux + dx, PATH_Y - 42 - y, (dx + 14) % 7 < 4 ? S.furDark : S.fur);
      }
    }
    if (after) after(paws);
    for (const o of overlays) o(paws);

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

  return { render, state: () => ({ mode, act: act?.kind ?? null, region: world?.region, biome: world?.biome }) };
}
