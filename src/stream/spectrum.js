// Log-spaced spectrum bands for the visualizer, from the exact audio that
// goes out on the stream.
import { fft, hann } from '../audio/fft.js';

export function createSpectrum({ size = 2048, bands = 64, sampleRate = 48000, low = 30, high = 14000 } = {}) {
  const window = hann(size);
  const history = new Float32Array(size);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const levels = new Float32Array(bands);
  const edges = Array.from({ length: bands + 1 }, (_, i) => Math.round(((low * Math.pow(high / low, i / bands)) / sampleRate) * size));

  return {
    /** Push interleaved stereo samples; returns band levels in [0, 1]. */
    update(interleaved) {
      const frames = interleaved.length / 2;
      history.copyWithin(0, frames);
      for (let i = 0; i < frames; i++) history[size - frames + i] = (interleaved[2 * i] + interleaved[2 * i + 1]) / 2;
      for (let i = 0; i < size; i++) {
        re[i] = history[i] * window[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let b = 0; b < bands; b++) {
        const lo = Math.max(1, edges[b]);
        const hi = Math.max(lo + 1, edges[b + 1]);
        let power = 0;
        for (let k = lo; k < hi; k++) power += re[k] * re[k] + im[k] * im[k];
        const db = 10 * Math.log10(power / (hi - lo) + 1e-12);
        // Tilt by +3 dB per octave so the quieter highs still move the grass.
        const tilt = 3 * Math.log2(edges[b] / edges[0] + 1);
        levels[b] = Math.min(1, Math.max(0, (db + tilt - 8) / 42));
      }
      return levels;
    },
  };
}
