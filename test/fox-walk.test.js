import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createScene, WIDTH } from '../src/stream/scene/index.js';
import { sky } from '../src/stream/scene/clock.js';
import { PATH_Y } from '../src/stream/scene/landscape.js';
import { sprite, walkCycleOf } from '../src/stream/scene/nature.js';
import { artSlot, computePalette, SLOTS } from '../src/stream/scene/palette.js';
import { walkFrame } from '../src/stream/scene/acts.js';

const atlas = JSON.parse(readFileSync(new URL('../src/stream/scene/sprites.json', import.meta.url)));
const SHEETS = ['walk12', 'walk12-rain', 'walk12-snow'];
const palette = atlas.actor.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const orange = (v) => v !== 255 && palette[v][0] > 190 && palette[v][1] > 60;
// Painted pixel at a point measured from the cell centre and floor.
const at = (s, x, h) => {
  const sx = x - s.ox;
  const sy = s.h - 1 - (h - s.oy);
  return sx >= 0 && sy >= 0 && sx < s.w && sy < s.h ? s.data[sy * s.w + sx] : 255;
};

test('walking repaints only the legs and arm: the rest of the fox is the same pixels, bobbing', () => {
  for (const sheet of SHEETS) {
    const master = sprite(sheet, 0);
    for (let i = 1; i < atlas.sheets[sheet].sprites.length; i++) {
      const s = sprite(sheet, i);
      let best = 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          let same = 0, ink = 0;
          for (let h = 24; h < 80; h++) for (let x = -40; x < 19; x++) {
            const c = at(master, x, h);
            if (c === 255) continue;
            ink++;
            if (at(s, x + dx, h + dy) === c) same++;
          }
          best = Math.max(best, same / ink);
        }
      }
      assert.ok(best > 0.97, `${sheet} frame ${i}: only ${(best * 100).toFixed(1)}% of the upper body is unchanged`);
    }
  }
});

test('the two steps alternate legs: the near leg leads the first, the far leg the second', () => {
  for (const sheet of SHEETS) {
    const { steps } = walkCycleOf(sheet);
    for (const [frame, near] of [[0, true], [steps.length, false]]) {
      const s = sprite(sheet, frame);
      // The thigh above the front foot at contact.
      let front = -99;
      for (let x = 40; x > -20; x--) if (at(s, x, s.oy) !== 255) { front = x; break; }
      let lit = 0;
      for (let h = s.oy + 8; h <= s.oy + 16; h++) for (let x = front - 14; x <= front - 2; x++) if (orange(at(s, x, h))) lit++;
      assert.equal(lit > 6, near, `${sheet} frame ${frame}: the leading thigh should be ${near ? 'near (orange)' : 'far (shaded)'}, saw ${lit} orange pixels`);
    }
  }
});

test('the planted foot stays put on the road while the fox walks', () => {
  for (const sheet of SHEETS) {
    const { stride } = walkCycleOf(sheet);
    const heelAt = (d) => {
      const s = sprite(sheet, walkFrame(d, sheet));
      // The frontmost whole foot on the floor carries the weight; a grazing toe does not.
      const on = (x) => at(s, x, s.oy) !== 255;
      const runs = [];
      for (let x = -40; x <= 40; x++) if (on(x)) { const r = runs.at(-1); if (r && x - r[1] <= 1) r[1] = x; else runs.push([x, x]); }
      return runs.filter((r) => r[1] - r[0] >= 3).at(-1)[0];
    };
    const steps = walkCycleOf(sheet).steps.length;
    for (let start = 0.5; start < stride; start += stride / 2) {
      let worst = 0;
      const first = heelAt(start);
      const half = Math.floor(walkFrame(start, sheet) / steps);
      for (let d = start + 1; Math.floor(walkFrame(d, sheet) / steps) === half && d < start + stride / 2; d++) {
        // Relative to the road, a planted heel moves back exactly as far as the fox goes forward.
        const drift = Math.abs(heelAt(d) + (d - start) - first);
        worst = Math.max(worst, drift);
      }
      assert.ok(worst <= 5, `${sheet}: the planted foot slides ${worst}px over a step`);
    }
  }
});

test('greeting a passerby keeps one painted walking body', () => {
  // This stretch has a passerby 90 pixels to the left, clear of the fox's body.
  const ground = 500005417.9602512;
  const date = new Date('2026-06-21T12:00:00Z');
  const light = sky(date, 'Europe/Lisbon', 0);
  const moonlight = Math.sin(Math.PI * (light.moon ?? 0)) * (1 - Math.abs(light.moonAge - .5) * 2);
  const painted = sprite('walk12', walkFrame(ground, 'walk12'));
  const top = PATH_Y - painted.oy - painted.h + 1;
  for (const time of [1, 1.2]) {
    const rgbPalette = new Uint8Array(SLOTS * 3);
    computePalette(rgbPalette, { light: light.light, warmth: light.warmth, overcast: 0, rain: 0, fog: 0, moonlight, wet: 0, time });
    const colour = (slot) => (rgbPalette[slot * 3] << 16) | (rgbPalette[slot * 3 + 1] << 8) | rgbPalette[slot * 3 + 2];
    const actorColours = new Set(atlas.actor.map((_, i) => colour(artSlot('actor', i))));
    const rgb = createScene({ seed: 7 }).render({ time, dt: 0, date, beat: 0, bands: new Float32Array(64), pillWidth: 0, steer: { at: ground, weather: { previous: 'clear', current: 'clear', mix: 1 } } });
    let paintedPixels = 0, extraPixels = 0;
    for (let y = PATH_Y - 57; y <= PATH_Y - 7; y++) {
      for (let x = 270; x < 370; x++) {
        if (y < PATH_Y - 33 && x >= 312) continue;
        const sx = x - WIDTH / 2 - painted.ox;
        const sy = y - top;
        const ink = sx >= 0 && sx < painted.w && sy >= 0 && sy < painted.h && painted.data[sy * painted.w + sx] !== 255;
        const p = (y * WIDTH + x) * 3;
        if (ink) paintedPixels++;
        else if (actorColours.has((rgb[p] << 16) | (rgb[p + 1] << 8) | rgb[p + 2])) extraPixels++;
      }
    }
    assert.ok(paintedPixels > 500, 'the fixture covers the painted walking body');
    assert.equal(extraPixels, 0, `${extraPixels} extra fox pixels outside the walking pose at ${time}s`);
  }
});
