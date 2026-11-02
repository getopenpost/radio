import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScene, WIDTH } from '../src/stream/scene/index.js';
import { findPlace } from '../src/stream/scene/journey.js';
import { PATH_Y } from '../src/stream/scene/landscape.js';
import { WORKOUT_SECONDS, workoutAt } from '../src/stream/scene/acts.js';
import { createCanvas } from '../src/stream/scene/canvas.js';
import { sprite } from '../src/stream/scene/nature.js';
import { computePalette, S, SLOTS } from '../src/stream/scene/palette.js';
import { drawActorShadow } from '../src/stream/scene/shadow.js';

test('the soft shadow has continuous shading instead of checkerboard holes', () => {
  const canvas = createCanvas();
  canvas.index.fill(S.path1);
  drawActorShadow(canvas, sprite('walk8', 0), 320, PATH_Y, PATH_Y);
  for (let x = 305; x <= 325; x++) {
    assert.notEqual(canvas.get(x, PATH_Y + 1), S.path1, `unshaded hole at ${x}`);
  }
});

test('height softens the shadow and preserves snow and equipment colours', () => {
  const palette = new Uint8Array(SLOTS * 3);
  computePalette(palette, { light: 1, warmth: 0, overcast: 0, rain: 0, fog: 0, moonlight: 0, wet: 0, time: 0 });
  const luma = (slot) => palette[slot * 3] + palette[slot * 3 + 1] + palette[slot * 3 + 2];
  for (const sheet of ['walk8', 'walk8-rain', 'walk8-snow']) {
    const s = sprite(sheet, 0);
    const draw = (height, surface = S.path1) => {
      const canvas = createCanvas();
      canvas.index.fill(surface);
      canvas.rect(319, PATH_Y - 4, 2, 10, S.steel0);
      drawActorShadow(canvas, s, 320, PATH_Y - height, PATH_Y);
      return canvas;
    };
    const grounded = draw(0);
    const airborne = draw(65);
    const core = (c) => {
      let dark = 0;
      for (let y = PATH_Y - 1; y <= PATH_Y + 2; y++) {
        for (let x = 305; x <= 335; x++) dark += luma(S.path1) - luma(c.get(x, y));
      }
      return dark;
    };
    assert.ok(core(grounded) > core(airborne), `${sheet}: lifting off must soften the core`);
    assert.deepEqual(draw(0).index, grounded.index, 'repeated frames are deterministic');
    assert.equal(grounded.get(319, PATH_Y), S.steel0, 'shadows stay behind equipment');
    const snow = draw(0, S.snow0);
    let shaded = 0;
    for (const slot of new Set(snow.index)) {
      if (slot === S.snow0 || slot === S.steel0) continue;
      shaded++;
      assert.ok(luma(slot) < luma(S.snow0), 'snow is shaded');
      assert.ok(palette[slot * 3 + 2] > palette[slot * 3] * .9, 'snow keeps its pale cool hue instead of turning brown');
    }
    assert.ok(shaded > 0, 'snow receives a shadow');
  }
});

test('the ground shadow responds to the painted pose throughout every exercise', () => {
  const event = findPlace('workout', 5e8);
  const date = new Date('2026-06-21T12:00:00Z');
  const input = { time: 1, dt: 0, date, beat: 0, bands: [], pillWidth: 0,
    steer: { weather: { previous: 'clear', current: 'clear', mix: 1 } } };
  const poses = {};
  for (let t = 0; t < WORKOUT_SECONDS; t += .025) {
    const pose = workoutAt(t);
    if (!['pull', 'dip', 'muscle', 'push'].includes(pose.name)) continue;
    (poses[pose.name] ??= new Map()).set(pose.frame, t);
  }
  for (const [name, times] of Object.entries(poses)) {
    const shadows = [];
    for (const t of times.values()) {
      const scene = createScene();
      scene.render({ ...input, steer: { ...input.steer, at: event.a } });
      const state = scene.snapshot();
      state.hold.t = t;
      state.ground = event.a + workoutAt(t).x;
      scene.restore(state);
      const rgb = scene.render(input);
      const patch = [];
      for (let y = PATH_Y + 1; y <= PATH_Y + 7; y++) {
        for (let x = WIDTH / 2 - 60; x < WIDTH / 2 + 60; x++) {
          const p = (y * WIDTH + x) * 3;
          patch.push(rgb[p], rgb[p + 1], rgb[p + 2]);
        }
      }
      shadows.push(Buffer.from(patch));
    }
    assert.ok(shadows.some((s) => !s.equals(shadows[0])), `${name}: shadow stays frozen as the fox lifts and lowers`);
  }
});
