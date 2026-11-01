// Falling and drifting things: rain with splashes, snow, autumn leaves on the
// wind, and fireflies on summer nights. Particle counts follow the weather
// amounts, so showers build and ease off instead of switching.
import { createRng } from '../../compose/rng.js';
import { HEIGHT, WIDTH } from './canvas.js';
import { ramp, S } from './palette.js';

const MAX = { rain: 260, snow: 220, leaves: 14, fireflies: 24, petals: 12 };

export function createWeather(seed = 3) {
  const rng = createRng(seed);
  const spawn = (kind) => ({ x: rng.float(-40, WIDTH + 40), y: rng.float(-HEIGHT, HEIGHT), z: rng.float(0.4, 1), phase: rng.float(0, 6.28), kind, floor: rng.float(300, HEIGHT) });
  const pools = Object.fromEntries(Object.entries(MAX).map(([k, n]) => [k, Array.from({ length: n }, () => spawn(k))]));
  const splashes = [];

  /**
   * @param {object} w amounts in [0, 1]: rain, snow, leaves, fireflies; wind in [0, 1]
   * @param {number} scroll ground speed in px/s, so near particles drift with the walk
   */
  function draw(canvas, { dt, time, rain, snow, leaves, fireflies, wind, scroll, petals = 0 }) {
    const leafTones = [ramp('amber', 0)[1], ramp('rust', 0)[1], ramp('gold', 0)[1]];
    const drift = -scroll * 0.4;
    // Rain: thin streaks slanted by the wind; splashes where they land.
    const rainCount = Math.round(MAX.rain * rain);
    for (let i = 0; i < rainCount; i++) {
      const p = pools.rain[i];
      p.y += (260 + 140 * p.z) * dt;
      p.x += (-40 * wind - 10 + drift * p.z) * dt;
      if (p.y > p.floor) {
        if (p.z > 0.7 && splashes.length < 60) splashes.push({ x: p.x, y: p.floor, age: 0 });
        p.y = rng.float(-40, -4);
        p.x = rng.float(-20, WIDTH + 60);
        p.floor = rng.float(300, HEIGHT);
      }
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const len = p.z > 0.7 ? 4 : 3;
      for (let k = 0; k < len; k++) canvas.set(x + Math.round(k * (0.15 + wind * 0.3)), y - k, S.rain);
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.age += dt;
      if (s.age > 0.12) {
        splashes.splice(i, 1);
        continue;
      }
      canvas.set(Math.round(s.x) - 1, Math.round(s.y) - 1, S.rain);
      canvas.set(Math.round(s.x) + 1, Math.round(s.y) - 1, S.rain);
    }

    // Snow: slow, swaying flakes; near ones are bigger.
    const snowCount = Math.round(MAX.snow * snow);
    for (let i = 0; i < snowCount; i++) {
      const p = pools.snow[i];
      p.y += (10 + 22 * p.z) * dt;
      p.x += (Math.sin(time * 0.8 + p.phase) * 8 - 12 * wind + drift * p.z) * dt;
      if (p.y > p.floor) {
        p.y = rng.float(-20, -2);
        p.x = rng.float(-20, WIDTH + 40);
      }
      if (p.x < -10) p.x += WIDTH + 20;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      canvas.set(x, y, S.flake);
      if (p.z > 0.8) {
        canvas.set(x + 1, y, S.flake);
        canvas.set(x, y + 1, S.flake);
        canvas.set(x + 1, y + 1, S.flake);
      }
    }

    // Leaves tumble across on the wind.
    const leafCount = Math.round(MAX.leaves * leaves);
    for (let i = 0; i < leafCount; i++) {
      const p = pools.leaves[i];
      p.x += (-30 - 50 * wind * p.z + drift) * dt;
      p.y += (14 + Math.sin(time * 2 + p.phase) * 18) * dt;
      if (p.x < -10 || p.y > p.floor || p.y < 150) {
        p.x = WIDTH + rng.float(5, 160);
        p.y = rng.float(170, 270);
      }
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const flip = Math.sin(time * 5 + p.phase) > 0;
      const c = leafTones[i % 3];
      canvas.rect(x, y, flip ? 3 : 2, flip ? 2 : 3, c);
    }

    // Fireflies blink slowly low over the grass.
    const flyCount = Math.round(MAX.fireflies * fireflies);
    for (let i = 0; i < flyCount; i++) {
      const p = pools.fireflies[i];
      p.x += (Math.sin(time * 0.5 + p.phase) * 6 + drift * 0.6) * dt;
      if (p.x < -10) p.x += WIDTH + 20;
      if (p.x > WIDTH + 10) p.x -= WIDTH + 20;
      const y = 255 + ((p.phase * 37) % 50) + Math.sin(time * 0.7 + p.phase * 3) * 6;
      if (Math.sin(time * 1.3 + p.phase * 5) > 0.35) canvas.set(Math.round(p.x), Math.round(y), S.firefly);
    }

    // Blossom drifting down the wind in spring.
    const petalCount = Math.round(MAX.petals * petals);
    for (let i = 0; i < petalCount; i++) {
      const p = pools.petals[i];
      p.x += (-22 - 40 * wind * p.z + drift) * dt;
      p.y += (9 + Math.sin(time * 1.7 + p.phase) * 12) * dt;
      if (p.x < -10 || p.y > p.floor || p.y < 170) {
        p.x = WIDTH + rng.float(5, 200);
        p.y = rng.float(170, 280);
      }
      canvas.set(Math.round(p.x), Math.round(p.y), ramp('blossom', 0)[0]);
    }
  }

  return {
    draw,
    snapshot: () => ({ pools, splashes }),
    restore(state) {
      for (const [kind, list] of Object.entries(state.pools)) pools[kind] = list;
      splashes.splice(0, splashes.length, ...state.splashes);
    },
  };
}
