const fs = require('node:fs');
const read = p => { const b = fs.readFileSync(p); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const source = read('output/live-one-hour/reference.pcm');
const served = read('output/live-one-hour/served.pcm');
const manifest = JSON.parse(fs.readFileSync('output/live-one-hour/manifest.json'));
const capture = JSON.parse(fs.readFileSync('output/live-one-hour/capture.json'));
const sr = 8000, length = source.length;
const sample = i => source[((i % length) + length) % length];
const corr = (at, offset, count, step = 1) => {
  let ab = 0, aa = 0, bb = 0;
  for (let j = 0; j < count; j += step) {
    const a = served[at + j], b = sample(offset + j);
    ab += a * b; aa += a * a; bb += b * b;
  }
  return ab / Math.sqrt(aa * bb);
};
const at = 10 * sr;
const expected = Math.round(((capture.started - manifest.anchor) / 1000 + 10) * sr);
let best = [-1, 0];
for (let offset = expected - 240 * sr; offset < expected + 30 * sr; offset += 4) {
  const value = corr(at, offset, 2 * sr, 32);
  if (value > best[0]) best = [value, offset];
}
let fine = [-1, 0];
for (let d = -4; d <= 4; d++) {
  const value = corr(at, best[1] + d, 3 * sr);
  if (value > fine[0]) fine = [value, best[1] + d];
}
const windows = [2, 7, 12, 17, 22].filter(t => (t + 2) * sr <= served.length).map(t => {
  let peak = -1;
  for (let d = -8; d <= 8; d++) peak = Math.max(peak, corr(t * sr, fine[1] + (t - 10) * sr + d, 2 * sr));
  return { captureSeconds: t, correlation: peak };
});
const result = { sourceOffset: ((fine[1] / sr) % manifest.seconds + manifest.seconds) % manifest.seconds, match: fine[0], windows };
fs.writeFileSync('output/live-one-hour/audio-verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (!windows.length || windows.some(w => w.correlation < 0.95)) process.exitCode = 1;
