// Objective mix metrics used to check renders against the target sound:
// spectral balance, stereo width, bass continuity and gaps in the harmonic bed.
import { fft, hann } from './fft.js';

export const bands = [
  ['sub', 20, 60],
  ['bass', 60, 150],
  ['lowmid', 150, 400],
  ['mid', 400, 1000],
  ['highmid', 1000, 3000],
  ['presence', 3000, 8000],
  ['air', 8000, 20000],
];

const db = (x) => 10 * Math.log10(Math.max(x, 1e-20));
const percentile = (values, p) => {
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

export function analyze({ left, right, sampleRate }) {
  const n = 4096;
  const hop = 1024;
  const window = hann(n);
  const binHz = sampleRate / n;
  const bandBins = bands.map(([, lo, hi]) => [Math.ceil(lo / binHz), Math.min(n / 2, Math.floor(hi / binHz))]);
  const reM = new Float64Array(n);
  const imM = new Float64Array(n);
  const reS = new Float64Array(n);
  const imS = new Float64Array(n);

  const frames = [];
  for (let start = 0; start + n <= left.length; start += hop) {
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const l = left[start + i];
      const r = right[start + i];
      reM[i] = ((l + r) / 2) * window[i];
      reS[i] = ((l - r) / 2) * window[i];
      imM[i] = 0;
      imS[i] = 0;
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
    }
    fft(reM, imM);
    fft(reS, imS);
    const mid = new Float64Array(bands.length);
    const side = new Float64Array(bands.length);
    let centroidNum = 0;
    let centroidDen = 0;
    bandBins.forEach(([lo, hi], b) => {
      for (let k = lo; k <= hi; k++) {
        const m = reM[k] * reM[k] + imM[k] * imM[k];
        const s = reS[k] * reS[k] + imS[k] * imS[k];
        mid[b] += m;
        side[b] += s;
        centroidNum += k * binHz * (m + s);
        centroidDen += m + s;
      }
    });
    frames.push({ mid, side, peak, centroid: centroidDen ? centroidNum / centroidDen : 0, energy: centroidDen });
  }

  // Ignore near-silent frames (lead-in, tails) for distribution statistics.
  const loudest = percentile(frames.map((f) => f.energy), 0.95);
  const active = frames.filter((f) => f.energy > loudest * 1e-5);

  const bandMid = new Float64Array(bands.length);
  const bandSide = new Float64Array(bands.length);
  for (const f of active) {
    for (let b = 0; b < bands.length; b++) {
      bandMid[b] += f.mid[b];
      bandSide[b] += f.side[b];
    }
  }
  const total = bandMid.reduce((a, x) => a + x, 0) + bandSide.reduce((a, x) => a + x, 0);
  const balance = Object.fromEntries(bands.map(([name], b) => [name, (100 * (bandMid[b] + bandSide[b])) / total]));
  const width = Object.fromEntries(bands.map(([name], b) => [name, db(bandSide[b]) - db(bandMid[b])]));
  const sideTotal = bandSide.reduce((a, x) => a + x, 0);
  const midTotal = bandMid.reduce((a, x) => a + x, 0);

  // Bass continuity: how far the quiet moments of the low end sit below the
  // loud ones. Near 0 dB means a sustained foundation, very negative means
  // isolated thumps with silence between pulses.
  const low = active.map((f) => f.mid[0] + f.mid[1] + f.side[0] + f.side[1]);
  const lowFloor = db(percentile(low, 0.1)) - db(percentile(low, 0.9));

  // Harmonic bed: share of frames where 150 Hz-3 kHz drops 20 dB below its median.
  const bed = active.map((f) => f.mid[2] + f.mid[3] + f.mid[4] + f.side[2] + f.side[3] + f.side[4]);
  const bedMedian = percentile(bed, 0.5);
  const bedGaps = (100 * bed.filter((e) => e < bedMedian / 100).length) / Math.max(1, bed.length);

  // Correlation and level statistics in the time domain.
  let sl = 0;
  let sr = 0;
  let slr = 0;
  let sum2 = 0;
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    sl += left[i] * left[i];
    sr += right[i] * right[i];
    slr += left[i] * right[i];
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  sum2 = (sl + sr) / 2;
  const rms = Math.sqrt(sum2 / Math.max(1, left.length));

  // Movement over time: spread of 3-second energy across the active part.
  const block = Math.round((3 * sampleRate) / hop);
  const blocks = [];
  for (let i = 0; i + block <= active.length; i += block) {
    blocks.push(active.slice(i, i + block).reduce((a, f) => a + f.energy, 0));
  }
  const movement = blocks.length > 2 ? db(percentile(blocks, 0.95)) - db(percentile(blocks, 0.1)) : 0;

  return {
    seconds: left.length / sampleRate,
    rmsDb: 20 * Math.log10(Math.max(rms, 1e-10)),
    peakDb: 20 * Math.log10(Math.max(peak, 1e-10)),
    crestDb: 20 * Math.log10(Math.max(peak, 1e-10) / Math.max(rms, 1e-10)),
    centroidHz: percentile(active.map((f) => f.centroid), 0.5),
    balance,
    lowShare: balance.sub + balance.bass + balance.lowmid,
    width,
    sideToMidDb: db(sideTotal) - db(midTotal),
    correlation: slr / Math.sqrt(Math.max(sl * sr, 1e-20)),
    lowFloorDb: lowFloor,
    bedGapsPct: bedGaps,
    movementDb: movement,
  };
}

export function formatComparison(results) {
  const names = Object.keys(results);
  const rows = [
    ['seconds', (m) => m.seconds.toFixed(0)],
    ['rms dBFS', (m) => m.rmsDb.toFixed(1)],
    ['crest dB', (m) => m.crestDb.toFixed(1)],
    ['centroid Hz', (m) => m.centroidHz.toFixed(0)],
    ...bands.map(([b]) => [`% ${b}`, (m) => m.balance[b].toFixed(1)]),
    ['% <400Hz', (m) => m.lowShare.toFixed(1)],
    ...bands.map(([b]) => [`S/M ${b} dB`, (m) => m.width[b].toFixed(1)]),
    ['S/M total dB', (m) => m.sideToMidDb.toFixed(1)],
    ['L/R corr', (m) => m.correlation.toFixed(2)],
    ['bass floor dB', (m) => m.lowFloorDb.toFixed(1)],
    ['bed gaps %', (m) => m.bedGapsPct.toFixed(1)],
    ['movement dB', (m) => m.movementDb.toFixed(1)],
  ];
  const width = Math.max(14, ...names.map((n) => n.length + 2));
  const lines = ['metric'.padEnd(16) + names.map((n) => n.padStart(width)).join('')];
  for (const [label, fn] of rows) lines.push(label.padEnd(16) + names.map((n) => fn(results[n]).padStart(width)).join(''));
  return lines.join('\n');
}
