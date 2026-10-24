// In-place radix-2 FFT on separate real/imaginary arrays.
const tables = new Map();

function twiddles(n) {
  let t = tables.get(n);
  if (!t) {
    t = { cos: new Float64Array(n / 2), sin: new Float64Array(n / 2), rev: new Uint32Array(n) };
    for (let i = 0; i < n / 2; i++) {
      t.cos[i] = Math.cos((2 * Math.PI * i) / n);
      t.sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      t.rev[i] = r;
    }
    tables.set(n, t);
  }
  return t;
}

export function fft(re, im) {
  const n = re.length;
  const { cos, sin, rev } = twiddles(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const c = cos[k * step];
        const s = sin[k * step];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * c - im[b] * s;
        const ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

export function hann(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}
