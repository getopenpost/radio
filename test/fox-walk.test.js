import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createScene, WIDTH } from '../src/stream/scene/index.js';
import { sky } from '../src/stream/scene/clock.js';
import { PATH_Y } from '../src/stream/scene/landscape.js';
import { sprite } from '../src/stream/scene/nature.js';
import { artSlot, computePalette, SLOTS } from '../src/stream/scene/palette.js';
import { STRIDE, walkFrame } from '../src/stream/scene/acts.js';

const atlas = JSON.parse(readFileSync(new URL('../src/stream/scene/sprites.json', import.meta.url)));

test('walking preserves the painted face through a small natural head bob', () => {
  for (const sheet of ['walk8', 'walk8-rain', 'walk8-snow']) {
    const master = sprite(sheet, 0);
    const offsets = [];
    for (let i = 0; i < 8; i++) {
      const s = sprite(sheet, i);
      let best = { match: 0, dy: 0 };
      for (let dy = -4; dy <= 4; dy++) for (let dx = -2; dx <= 2; dx++) {
        let same = 0, ink = 0;
        for (let y = 0; y < 34; y++) for (let x = Math.floor(master.w * .45); x < master.w; x++) {
          const c = master.data[y * master.w + x];
          if (c === 255) continue;
          const sx = master.ox + x + dx - s.ox;
          const sy = -master.oy - master.h + y + dy + s.oy + s.h;
          ink++;
          if (sx >= 0 && sx < s.w && sy >= 0 && sy < s.h && s.data[sy * s.w + sx] === c) same++;
        }
        if (same / ink > best.match) best = { match: same / ink, dy };
      }
      assert.ok(best.match > .985, `${sheet} frame ${i}: only ${(best.match * 100).toFixed(1)}% of the face matches within a small head bob`);
      offsets.push(best.dy);
    }
    const bob = Math.max(...offsets) - Math.min(...offsets);
    assert.ok(bob >= 2 && bob <= 4, `${sheet}: ${bob}px head bob should retain the painted body's motion`);
  }
});

test('greeting a passerby keeps one painted walking body', () => {
  // This stretch has a passerby 90 pixels to the left, clear of the fox's body.
  const at = 500005417.9602512;
  const date = new Date('2026-06-21T12:00:00Z');
  const light = sky(date, 'Europe/Lisbon', 0);
  const moonlight = Math.sin(Math.PI * (light.moon ?? 0)) * (1 - Math.abs(light.moonAge - .5) * 2);
  const stride = walkFrame(at);
  const painted = sprite('walk8', stride);
  const top = PATH_Y - painted.oy - painted.h + 1;

  for (const time of [1, 1.2]) {
    const palette = new Uint8Array(SLOTS * 3);
    computePalette(palette, { light: light.light, warmth: light.warmth, overcast: 0, rain: 0, fog: 0, moonlight, wet: 0, time });
    const colour = (slot) => (palette[slot * 3] << 16) | (palette[slot * 3 + 1] << 8) | palette[slot * 3 + 2];
    const actorColours = new Set();
    for (let i = 0; i < atlas.actor.length; i++) {
      const slot = artSlot('actor', i);
      actorColours.add(colour(slot));
    }
    const rgb = createScene({ seed: 7 }).render({ time, dt: 0, date, beat: 0, bands: new Float32Array(64), pillWidth: 0, steer: { at, weather: { previous: 'clear', current: 'clear', mix: 1 } } });
    let paintedPixels = 0;
    let extraPixels = 0;
    // The tail and lower body already belong to this painted walking pose.
    // Leave the head outside the check so facial expressions remain possible.
    for (let y = PATH_Y - 57; y <= PATH_Y - 7; y++) {
      for (let x = 270; x < 370; x++) {
        if (y < PATH_Y - 33 && x >= 312) continue;
        const sx = x - WIDTH / 2 - painted.ox;
        const sy = y - top;
        const ink = sx >= 0 && sx < painted.w && sy >= 0 && sy < painted.h && painted.data[sy * painted.w + sx] !== 255;
        const p = (y * WIDTH + x) * 3;
        const actual = (rgb[p] << 16) | (rgb[p + 1] << 8) | rgb[p + 2];
        if (ink) paintedPixels++;
        else if (actorColours.has(actual)) extraPixels++;
      }
    }
    assert.ok(paintedPixels > 500, 'the fixture covers the painted walking body');
    assert.equal(extraPixels, 0, `${extraPixels} extra fox pixels outside the walking pose at ${time}s`);
  }
});

test('both painted steps advance the legs with compact foot reach', () => {
  for (const sheet of ['walk8', 'walk8-rain', 'walk8-snow']) {
    assert.equal(atlas.sheets[sheet].sprites.length, 8, `${sheet} contains the full two-step cycle`);
    const feet = Array.from({ length: 8 }, (_, i) => {
      const s = sprite(sheet, walkFrame((i + .5) * STRIDE / 8));
      const pixels = [];
      for (let y = s.h - 12; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        if (s.data[y * s.w + x] !== 255) pixels.push(x + s.ox);
      }
      assert.ok(pixels.length > 0, `${sheet} frame ${i} has painted feet`);
      const back = Math.min(...pixels), front = Math.max(...pixels);
      assert.ok(front - back <= 40, `${sheet} frame ${i}: ${front - back}px foot reach becomes an exaggerated boot step`);
      return { back, front, support: s.oy };
    });
    assert.equal(new Set(feet.map((f) => f.support)).size, 1, `${sheet} keeps its supporting paws on the same road row`);
    for (const start of [0, 4]) {
      const step = feet.slice(start, start + 4);
      const travel = (part) => Math.max(...step.map((f) => f[part])) - Math.min(...step.map((f) => f[part]));
      assert.ok(travel('front') >= 6, `${sheet} step ${start / 4 + 1} advances and recovers its forward foot`);
      assert.ok(travel('back') >= 3, `${sheet} step ${start / 4 + 1} moves its trailing foot too`);
      assert.ok(Math.min(step[1].front, step[2].front) <= Math.min(step[0].front, step[3].front) - 4,
        `${sheet} step ${start / 4 + 1} retracts between its contact poses`);
    }
  }
});
