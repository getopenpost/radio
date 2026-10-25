// The audio visualizer along the bottom of the frame. Each track picks one
// of a few looks (swaying grass, dithered bars like OpenPost's charts, a dot
// matrix, a rolling ridge); a change of track lowers the old look and raises
// the new one.
import { HEIGHT, WIDTH } from './canvas.js';
import { band, bayer } from './dither.js';
import { S } from './palette.js';

export const MODES = ['grass', 'bars', 'dots', 'ridge'];
const TOP = 312; // tallest reach of the visualizer
const BASE = HEIGHT;

export function createVisualizer(seed = 1) {
  const levels = new Float32Array(WIDTH);
  const blades = Float32Array.from({ length: WIDTH }, (_, x) => 0.55 + (((x * 2654435761) >>> 0) % 1000) / 2222);
  const peaks = new Float32Array(64);
  let mode = MODES[seed % MODES.length];
  let next = null;
  let fade = 1; // 0 hidden .. 1 fully up

  function choose(name) {
    if (name !== mode && name !== next) next = name;
  }

  /** Interpolated band level at a screen x. */
  const at = (bands, x) => {
    const n = bands.length;
    const f = (x / WIDTH) * (n - 1);
    const i = Math.floor(f);
    return bands[i] + (bands[Math.min(n - 1, i + 1)] - bands[i]) * (f - i);
  };

  function draw(canvas, { dt, bands, scroll }) {
    // Swap looks: sink the old one, raise the new one.
    if (next) {
      fade = Math.max(0, fade - dt * 1.5);
      if (fade === 0) {
        mode = next;
        next = null;
      }
    } else fade = Math.min(1, fade + dt * 1.2);
    const gain = fade * fade * (3 - 2 * fade);
    const { index } = canvas;
    const shift = Math.floor(scroll);

    if (mode === 'grass') {
      for (let x = 0; x < WIDTH; x++) {
        const target = 6 + at(bands, x) * 36 * blades[(x + shift) % WIDTH] * gain;
        levels[x] += (target - levels[x]) * (target > levels[x] ? 0.55 : 0.12);
        const top = BASE - Math.round(levels[x]);
        for (let y = Math.max(TOP, top); y < HEIGHT; y++) index[y * WIDTH + x] = y - top < 2 && bayer(x + shift, y) < 0.5 ? S.grassTip : S.grass;
      }
      return;
    }
    if (mode === 'bars') {
      // Dithered columns: solid below, a Bayer band into the lighter tone at the top, a held peak.
      const n = 40;
      const w = WIDTH / n;
      for (let i = 0; i < n; i++) {
        const target = 3 + at(bands, (i + 0.5) * w) * 42 * gain;
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.5 : 0.1);
        peaks[i] = Math.max(peaks[i] - dt * 10, levels[i]);
        const h = Math.round(levels[i]);
        const x0 = Math.round(i * w) + 2;
        const x1 = Math.round((i + 1) * w) - 2;
        for (let y = BASE - h; y < HEIGHT; y++) {
          const t = band((y - (BASE - h)) / Math.max(1, h), 0, 0.6);
          for (let x = x0; x < x1; x++) index[y * WIDTH + x] = t > bayer(x, y) ? S.grass : S.grassTip;
        }
        const py = BASE - Math.round(peaks[i]) - 2;
        if (gain > 0.2) for (let x = x0; x < x1; x++) index[py * WIDTH + x] = S.logo;
      }
      return;
    }
    if (mode === 'dots') {
      // An LED matrix: 4-pixel cells, lit to each column's level.
      const cols = WIDTH / 4;
      for (let i = 0; i < cols; i++) {
        const target = at(bands, i * 4 + 2) * 11 * gain;
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.5 : 0.12);
        const lit = Math.round(levels[i]);
        for (let r = 0; r < 12; r++) {
          const y = BASE - 3 - r * 4;
          const c = r < lit ? (r === lit - 1 ? S.logo : S.grassTip) : S.grass;
          index[y * WIDTH + i * 4] = c;
          index[y * WIDTH + i * 4 + 1] = c;
          index[(y + 1) * WIDTH + i * 4] = c;
          index[(y + 1) * WIDTH + i * 4 + 1] = c;
        }
      }
      for (let y = BASE - 2; y < HEIGHT; y++) index.fill(S.grass, y * WIDTH, (y + 1) * WIDTH);
      return;
    }
    // Ridge: a smooth mirrored silhouette of the spectrum with a dithered crest.
    for (let x = 0; x < WIDTH; x++) {
      const m = x < WIDTH / 2 ? x : WIDTH - 1 - x;
      const target = 5 + at(bands, (m / (WIDTH / 2)) * WIDTH * 0.999) * 40 * gain;
      levels[x] += (target - levels[x]) * 0.25;
    }
    for (let x = 1; x < WIDTH - 1; x++) {
      const h = (levels[x - 1] + 2 * levels[x] + levels[x + 1]) / 4;
      const top = BASE - Math.round(h);
      for (let y = Math.max(TOP, top); y < HEIGHT; y++) {
        const t = band((y - top) / 10, 0, 1);
        index[y * WIDTH + x] = t > bayer(x, y) ? S.grass : S.grassTip;
      }
    }
  }

  return { draw, choose };
}
