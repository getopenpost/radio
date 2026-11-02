import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createScene, WIDTH } from '../src/stream/scene/index.js';
import { sky } from '../src/stream/scene/clock.js';
import { PATH_Y } from '../src/stream/scene/landscape.js';
import { sprite } from '../src/stream/scene/nature.js';
import { artSlot, computePalette, SLOTS } from '../src/stream/scene/palette.js';
import { STRIDE, WALK_FRAMES } from '../src/stream/scene/acts.js';

const atlas = JSON.parse(readFileSync(new URL('../src/stream/scene/sprites.json', import.meta.url)));

test('greeting a passerby keeps one painted walking body', () => {
  // This stretch has a passerby 90 pixels to the left, clear of the fox's body.
  const at = 500005417.9602512;
  const date = new Date('2026-06-21T12:00:00Z');
  const light = sky(date, 'Europe/Lisbon', 0);
  const moonlight = Math.sin(Math.PI * (light.moon ?? 0)) * (1 - Math.abs(light.moonAge - .5) * 2);
  const stride = Math.floor(((at % STRIDE) + STRIDE) % STRIDE / STRIDE * WALK_FRAMES);
  const painted = sprite('walk12', stride);
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
