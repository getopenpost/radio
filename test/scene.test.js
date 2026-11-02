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

test('a workout stays brief and repeats no more than every fifth leg', () => {
  assert.ok(WORKOUT_SECONDS < 80, `${WORKOUT_SECONDS}s`);
  for (let leg = 900; leg < 1200; leg++) {
    if (legPlan(leg).events.some((e) => e.kind === 'workout')) assert.equal(leg % 5, 4);
  }
});

test('exercise reps allow a controlled lift and lower', () => {
  const duration = { pull: 0, dip: 0, muscle: 0, push: 0 };
  const dt = .005;
  for (let t = 0; t < WORKOUT_SECONDS; t += dt) {
    const { name } = workoutAt(t);
    if (name in duration) duration[name] += dt;
  }
  for (const [name, reps, minimum, maximum] of [
    ['pull', 20, 1.7, 2], ['dip', 5, 1.7, 2],
    ['muscle', 3, 2.5, 2.9], ['push', 6, 1.7, 2],
  ]) {
    const seconds = duration[name] / reps;
    assert.ok(seconds >= minimum && seconds <= maximum, `${name}: ${seconds.toFixed(2)} seconds per rep`);
  }
});

test('pull-ups pause at the top and dips and push-ups pause at the bottom', () => {
  const runs = [];
  const dt = .005;
  for (let t = 0; t < WORKOUT_SECONDS; t += dt) {
    const { name, frame } = workoutAt(t);
    const last = runs.at(-1);
    if (last?.name === name && last.frame === frame) last.seconds += dt;
    else runs.push({ name, frame, seconds: dt });
  }
  for (const [name, peak, reps] of [['pull', 5, 20], ['dip', 4, 5], ['push', 4, 6]]) {
    const holds = runs.filter((r) => r.name === name && r.frame === peak);
    assert.equal(holds.length, reps, `${name}: every rep has a hold`);
    for (const hold of holds) {
      assert.ok(hold.seconds >= .4 && hold.seconds <= .55, `${name}: hold lasts ${hold.seconds.toFixed(3)}s`);
      const i = runs.indexOf(hold);
      assert.ok(hold.seconds > runs[i - 1].seconds * 2, `${name}: pause is longer than the lift`);
      assert.ok(hold.seconds > runs[i + 1].seconds * 2, `${name}: pause is longer than the lowering frame`);
    }
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

test('a worker restored from a snapshot draws the same pixels as an unbroken run', () => {
  const at = findPlace('meadow', 5e8).a;
  const date = (f) => new Date(Date.parse('2026-06-21T12:00:00Z') + (f / 60) * 1000);
  const frame = (scene, f, ghost) => scene.render({ time: f / 60, dt: 1 / 60, date: date(f), beat: f / 30, bands, pillWidth: 120, ghost, steer: { at, weather: clear } });
  const unbroken = createScene({ seed: 7 });
  const ghost = createScene({ seed: 7 });
  for (let f = 0; f < 200; f++) {
    frame(unbroken, f, false);
    frame(ghost, f, true);
  }
  const worker = createScene({ seed: 7 });
  worker.restore(JSON.parse(JSON.stringify(ghost.snapshot())));
  for (let f = 200; f < 260; f++) {
    const a = Buffer.from(frame(unbroken, f, false));
    assert.ok(a.equals(frame(worker, f, false)), `frame ${f} differs`);
  }
});

test('skipping hidden water changes no pixel, wherever the fox is', () => {
  const date = new Date('2026-06-21T12:00:00Z');
  const step = (scene, at) => Buffer.from(scene.render({ time: 3, dt: 0, date, beat: 0, bands, pillWidth: 0, steer: { at, weather: clear } }));
  const places = ['meadow', 'forest', 'alpine', 'valley', 'lake', 'row', 'sail', 'coast'];
  for (const [i, place] of places.entries()) {
    const at = findPlace(place, 5e8 + i * LEG * 9).a;
    for (const off of [-2500, -700, 0, 900, 2600]) {
      assert.ok(step(createScene({ seed: 7 }), at + off).equals(step(createScene({ seed: 7, alwaysWater: true }), at + off)), `${place} ${off}`);
    }
  }
});

test('the chip eases to a new width and settles on the new title', async () => {
  const { chipAt, pillFor } = await import('../src/stream/chip.js');
  const titles = [{ from: 0, text: 'Short' }, { from: 600, text: 'A much longer title · melodic house' }];
  assert.equal(chipAt(titles, 599, 60).pill, pillFor('Short'));
  assert.equal(chipAt(titles, 600, 60).pill, pillFor('Short'));
  const widths = Array.from({ length: 80 }, (_, i) => chipAt(titles, 600 + i, 60).pill);
  assert.ok(widths.every((w, i) => i === 0 || (w >= widths[i - 1] && w - widths[i - 1] <= 5)), 'no jump in width');
  assert.equal(chipAt(titles, 800, 60).pill, pillFor(titles[1].text));
  assert.equal(chipAt(titles, 800, 60).old, null);
  const { createChipText } = await import('../src/stream/chip.js');
  assert.ok(createChipText(3).draw({ text: 'Long Shoreline · 100% house', old: null, t: 9 }).some((v) => v > 200), 'the title has ink');
});

test('the far land never ends in a straight vertical step', () => {
  const land = createLandscape();
  const canvas = createCanvas();
  for (const place of ['sail', 'coast', 'row', 'lake']) {
    const event = findPlace(place, 5e8);
    for (let g = event.a - 9000; g <= event.a + 9000; g += 1500) {
      canvas.index.fill(CLEAR);
      land.draw(canvas, 0, g);
      const base = (x) => {
        let y = HEIGHT - 1;
        while (y > 0 && canvas.index[y * WIDTH + x] === CLEAR) y--;
        return y;
      };
      // An empty column is open water: the land has tapered away, which is fine.
      for (let x = 1; x < WIDTH; x++) {
        const [a, b] = [base(x - 1), base(x)];
        if (a && b) assert.ok(Math.abs(a - b) < 12, `${place} at ${g}, column ${x}: ${a} to ${b}`);
      }
    }
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
    if (stage.name !== route.at(-1)?.name) route.push(stage);
  }
  const lifts = route.filter((s) => ['pull', 'dip', 'muscle', 'push'].includes(s.name));
  assert.deepEqual(lifts.map((s) => s.name), ['pull', 'dip', 'muscle', 'push']);
  assert.deepEqual(lifts.map((s) => s.x), [0, RAILS, 0, WORKOUT_REACH]);
  assert.ok(WORKOUT_REACH > RAILS, 'push-ups happen past the rails');
  assert.ok(WORKOUT_SECONDS < 80);
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
  assert.ok(art.sheets.walk12.sprites.length === 14 && Math.abs(art.sheets.walk12.sprites[0].h - 75) < 5, 'the fox stays about 72 pixels tall');
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
