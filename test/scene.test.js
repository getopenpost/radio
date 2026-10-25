import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activity, localTime, moonPhase, sunTimes } from '../src/stream/scene/clock.js';
import { createScene, HEIGHT, WIDTH } from '../src/stream/scene/index.js';

const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

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

test('the fox always walks between two stops', () => {
  for (const light of [0, 1]) {
    let previous = 'walk';
    for (let t = Date.parse('2026-03-01T00:00:00Z'); t < Date.parse('2026-03-08T00:00:00Z'); t += 15 * 60000) {
      const { kind } = activity(new Date(t), light);
      assert.ok(kind === 'walk' || previous === 'walk', `two stops in a row at ${new Date(t).toISOString()}`);
      previous = kind;
    }
  }
});

test('the scene renders through a year of seasons, weather and activities', () => {
  const bands = new Float32Array(64).fill(0.5);
  for (let i = 0; i < 36; i++) {
    const start = Date.parse('2026-01-01T00:00:00Z') + i * 10.3 * 86400000 + i * 3.7 * 3600000;
    const scene = createScene({ seed: 7 });
    let frame;
    for (let f = 0; f < 45; f++) {
      const time = f / 15;
      frame = scene.render({ time, dt: 1 / 15, date: new Date(start + time * 1000), beat: time * 1.5, bpm: 90, bands, pillWidth: 120, trackId: `t${i}` });
    }
    assert.equal(frame.length, WIDTH * HEIGHT * 3);
    const colours = new Set();
    for (let p = 0; p < frame.length; p += 3 * 97) colours.add((frame[p] << 16) | (frame[p + 1] << 8) | frame[p + 2]);
    assert.ok(colours.size > 6, `flat frame at ${new Date(start).toISOString()}`);
  }
});
