import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localTime, moonPhase, sunTimes } from '../src/stream/scene/clock.js';
import { createScene, HEIGHT, WIDTH } from '../src/stream/scene/index.js';
import { climate, eventsIn, findPlace, geography, LEG, legPlan, speedOf, WALK_SPEED, YEAR } from '../src/stream/scene/journey.js';
import { convergeMask } from '../src/stream/scene/logo.js';
import { RAILS, SCOPE_SECONDS, WORKOUT_REACH, WORKOUT_SECONDS, workoutAt } from '../src/stream/scene/acts.js';
import { createCanvas } from '../src/stream/scene/canvas.js';
import { createLandscape } from '../src/stream/scene/landscape.js';
import { CLEAR, computePalette, ramp, S, SLOTS } from '../src/stream/scene/palette.js';

const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const bands = new Float32Array(64).fill(0.5);
const clear = { previous: 'clear', current: 'clear', mix: 1 };
const luma = (p, slot) => p[slot * 3] * 0.3 + p[slot * 3 + 1] * 0.56 + p[slot * 3 + 2] * 0.14;

test('sunrise and sunset in Porto match published times within 15 minutes', () => {
  // timeanddate.com, Porto: 21 Jun 2026 06:03-21:06 (WEST), 21 Dec 2026 07:59-17:11 (WET).
  for (const [iso, rise, set] of [['2026-06-21T12:00:00Z', 6.05, 21.1], ['2026-12-21T12:00:00Z', 7.98, 17.18]]) {
    const t = localTime(new Date(iso), 'Europe/Lisbon');
    const s = sunTimes(t.dayOfYear, t.offset);
    assert.ok(Math.abs(s.sunrise - rise) < 0.25, `sunrise ${hm(s.sunrise)} on ${iso}`);
    assert.ok(Math.abs(s.sunset - set) < 0.25, `sunset ${hm(s.sunset)} on ${iso}`);
  }
});

test('moon phase matches known new and full moons', () => {
  // Full moon 3 Jan 2026 10:03 UTC; new moon 18 Jan 2026 19:52 UTC.
  assert.ok(Math.abs(moonPhase(new Date('2026-01-03T10:03:00Z')) - 0.5) < 0.02);
  const fresh = moonPhase(new Date('2026-01-18T19:52:00Z'));
  assert.ok(fresh < 0.02 || fresh > 0.98);
});

test('the fox is moving right at least 95% of the time', () => {
  let moving = 0;
  let held = 0;
  for (let leg = 1000; leg < 1600; leg++) {
    let road = LEG;
    for (const e of legPlan(leg).events) {
      if (e.a === e.b) held += e.kind === 'workout' ? WORKOUT_SECONDS : SCOPE_SECONDS;
      else {
        moving += (e.b - e.a) / speedOf(e.kind);
        road -= e.b - e.a;
      }
    }
    moving += road / WALK_SPEED;
  }
  assert.ok(moving / (moving + held) >= 0.95, `moving ${(moving / (moving + held)).toFixed(3)}`);
});

test('a workout stays quick and repeats no more than every third leg', () => {
  assert.ok(WORKOUT_SECONDS < 40, `${WORKOUT_SECONDS}s`);
  for (let leg = 900; leg < 1200; leg++) {
    if (legPlan(leg).events.some((e) => e.kind === 'workout')) assert.equal(leg % 3, 2);
  }
});

test('the land changes gradually: country and season have no jumps', () => {
  for (let d = 0; d < 3e6; d += 40) {
    const a = geography(d).hill;
    assert.ok(Math.abs(a - geography(d + 40).hill) < 0.1, `hill jumps at ${d}`);
    const c = climate(d);
    assert.ok(Math.abs(c.spring + c.summer + c.autumn + c.winter - 1) < 1e-9);
    assert.ok(Math.abs(c.winter - climate(d + 40).winter) < 0.1, `winter jumps at ${d}`);
  }
  assert.ok(climate(YEAR * 0.85).winter === 1);
});

test('events on the road do not overlap', () => {
  const events = eventsIn(LEG * 1000, LEG * 1300).sort((p, q) => p.a - q.a);
  for (let i = 1; i < events.length; i++) assert.ok(events[i].a > events[i - 1].b, `${events[i - 1].id} overlaps ${events[i].id}`);
});

test('the same moment on the road draws the same picture, whichever way the fox got there', () => {
  const at = findPlace('meadow', 5e8).a;
  const still = (warm) => {
    const scene = createScene({ seed: 7 });
    const date = new Date('2026-06-21T12:00:00Z');
    for (let d = warm; d >= 0; d -= 300) scene.render({ time: 1, dt: 0, date, beat: 0, bands, pillWidth: 0, steer: { at: at - d, weather: clear } });
    return Buffer.from(scene.render({ time: 1, dt: 0, date, beat: 0, bands, pillWidth: 0, steer: { at: at + 1, weather: clear } }));
  };
  assert.ok(still(0).equals(still(1500)));
});

test('the scene renders through a year of countries, weather and travel', () => {
  const places = ['meadow', 'valley', 'lake', 'alpine', 'forest', 'coast', 'bike', 'row', 'sail', 'broom', 'workout', 'scope'];
  for (let i = 0; i < 36; i++) {
    const weather = ['clear', 'rain', 'snow', 'fog', 'cloudy', 'windy'][i % 6];
    const scene = createScene({ seed: 7 });
    const event = findPlace(places[i % places.length], 5e8 + i * YEAR / 12);
    const start = Date.parse('2026-01-01T00:00:00Z') + i * 10.3 * 86400000 + i * 3.7 * 3600000;
    let frame;
    for (let f = 0; f < 30; f++) {
      const time = f / 15;
      frame = scene.render({ time, dt: 1 / 15, date: new Date(start + time * 1000), beat: time * 1.5, bands, pillWidth: 120, steer: { at: event.a - 40, weather: { previous: weather, current: weather, mix: 1 } } });
    }
    assert.equal(frame.length, WIDTH * HEIGHT * 3);
    const colours = new Set();
    for (let p = 0; p < frame.length; p += 3 * 97) colours.add((frame[p] << 16) | (frame[p + 1] << 8) | frame[p + 2]);
    assert.ok(colours.size > 6, `flat frame for ${places[i % places.length]}`);
  }
});

test('no land hangs in the air at the joins between plates', () => {
  const land = createLandscape();
  const canvas = createCanvas();
  const strays = (layer, ground, base) => {
    canvas.index.fill(CLEAR);
    land.draw(canvas, layer, ground);
    const seen = new Uint8Array(WIDTH * HEIGHT);
    const stack = [];
    const visit = (i) => {
      if (canvas.index[i] !== CLEAR && !seen[i]) {
        seen[i] = 1;
        stack.push(i);
      }
    };
    for (let y = base; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) visit(y * WIDTH + x);
    for (let y = 0; y < HEIGHT; y++) {
      visit(y * WIDTH);
      visit(y * WIDTH + WIDTH - 1);
    }
    while (stack.length) {
      const i = stack.pop();
      if (i % WIDTH) visit(i - 1);
      if (i % WIDTH < WIDTH - 1) visit(i + 1);
      if (i >= WIDTH) visit(i - WIDTH);
      if (i + WIDTH < seen.length) visit(i + WIDTH);
    }
    let lost = 0;
    for (let i = 0; i < seen.length; i++) if (canvas.index[i] !== CLEAR && !seen[i]) lost++;
    return lost;
  };
  for (let g = 6000; g < 150000; g += 4500) assert.ok(strays(0, g, 225) <= 60, `hills at ${g}`);
});

test('the gym runs bar, rails, back to the bar, then past the rails, inside its time', () => {
  const route = [];
  for (let t = 0; t < WORKOUT_SECONDS; t += 0.05) {
    const stage = workoutAt(t);
    if (stage.name !== route.at(-1)?.name && stage.name !== 'stand') route.push(stage);
  }
  const lifts = route.filter((s) => ['pull', 'dip', 'muscle', 'push'].includes(s.name));
  assert.deepEqual(lifts.map((s) => s.name), ['pull', 'dip', 'muscle', 'push']);
  assert.deepEqual(lifts.map((s) => s.x), [0, RAILS, 0, WORKOUT_REACH]);
  assert.ok(WORKOUT_REACH > RAILS, 'push-ups happen past the rails');
  assert.ok(WORKOUT_SECONDS < 40);
});

test('a stop holds the ground still, then the fox carries on', () => {
  const stop = findPlace('scope', 5e8);
  const scene = createScene({ seed: 7 });
  const date = new Date('2026-06-21T12:00:00Z');
  const seen = new Set();
  let stopped = 0;
  for (let f = 0; f < 20 * 15; f++) {
    scene.render({ time: f / 15, dt: 1 / 15, date, beat: 0, bands, pillWidth: 0, steer: { at: stop.a - 100, weather: clear } });
    const s = scene.state();
    seen.add(s.mode);
    if (!s.moving) stopped += 1 / 15;
  }
  assert.ok(seen.has('scope') && seen.has('walk'));
  assert.ok(Math.abs(stopped - SCOPE_SECONDS) < 0.6, `stopped ${stopped.toFixed(1)}s`);
  assert.ok(scene.state().ground > stop.a);
});

test('every sprite is stored at native size and stays on the single grid', async () => {
  const { readFile } = await import('node:fs/promises');
  const art = JSON.parse(await readFile(new URL('../src/stream/scene/sprites.json', import.meta.url)));
  for (const [name, sheet] of Object.entries(art.sheets)) {
    for (const s of sheet.sprites) {
      assert.equal(Buffer.from(s.data, 'base64').length, s.w * s.h, name);
      assert.ok(s.h <= 260 && s.w <= 260, `${name} ${s.w}x${s.h} is out of proportion`);
    }
  }
  assert.ok(art.sheets.walk12.sprites.length === 12 && Math.abs(art.sheets.walk12.sprites[0].h - 75) < 5, 'the fox stays about 72 pixels tall');
});

test('the logo keeps open gaps between its petals, symmetric at chip size', () => {
  const mask = convergeMask(20);
  for (const i of [0, 9, 10, 19]) {
    assert.deepEqual(mask[i], [...mask[i]].reverse());
  }
  assert.ok(mask[9].every((on) => !on) && mask[10].every((on) => !on), 'horizontal gap');
  assert.ok(mask.every((row) => !row[9] && !row[10]), 'vertical gap');
  assert.ok(mask[4][4] && mask[4][15] && mask[15][4] && mask[15][15], 'four petals');
});

test('depth order survives day and night: sky lightest, near land darkest', () => {
  const palette = new Uint8Array(SLOTS * 3);
  for (const light of [1, 0.5, 0]) {
    computePalette(palette, { light, warmth: 0, overcast: 0, rain: 0, fog: 0, moonlight: 0 });
    assert.ok(luma(palette, S.sky4) > luma(palette, S.far1), `sky over far at ${light}`);
    assert.ok(luma(palette, S.far1) > luma(palette, ramp('pine', 0)[2]), `far over near at ${light}`);
  }
  computePalette(palette, { light: 0, warmth: 0, overcast: 0, rain: 0, fog: 0, moonlight: 0 });
  assert.ok(palette[S.windowA * 3] > 200, 'windows glow at night');
});
