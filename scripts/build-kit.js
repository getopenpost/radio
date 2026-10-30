// Synthesises the house drum kit into assets/kit. Levels, tuning and decay are
// measured from the reference mixes (docs/music/reference-analysis.md):
// kicks hold 48-58 Hz with almost no audible pitch sweep after 15 ms and fall
// 20 dB in 120-160 ms; hats are 30-40 ms of band-limited metal around 5-9 kHz.
// Output is deterministic, so rebuilding never changes a track.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, 'assets/kit');
const SR = 48000;

function noise(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const biquad = (type, freq, q) => {
  const w = (2 * Math.PI * freq) / SR;
  const a = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const [b0, b1, b2] = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : type === 'hp' ? [(1 + c) / 2, -1 - c, (1 + c) / 2] : [a, 0, -a];
  const a0 = 1 + a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - -2 * c * y1 - (1 - a) * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
};

function normalise(data, peak) {
  const max = data.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1;
  return data.map((x) => (x / max) * peak);
}

/** Round sine kick: a quick pitch drop into `hz`, a held body and a short click. */
function kick({ hz, from = 150, sweep = 0.009, body = 0.085, shape = 1.6, drive = 1.4, click = 0.1, seconds = 0.42 }) {
  const n = noise(7);
  const hp = biquad('hp', 1800, 0.7);
  const out = new Float32Array(Math.round(seconds * SR));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = hz + (from - hz) * Math.exp(-t / sweep);
    phase += (2 * Math.PI * f) / SR;
    const amp = Math.exp(-Math.pow(t / body, shape));
    const tone = Math.tanh(Math.sin(phase) * amp * drive) / Math.tanh(drive);
    const tick = hp(n()) * Math.exp(-t / 0.0025) * click;
    out[i] = tone + tick;
  }
  const fade = Math.round(0.01 * SR);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return normalise(out, 0.95);
}

/** Layered noise bursts through a band-pass, like a tight hand clap. */
function clap({ hz = 2100, q = 0.8, tail = 0.075, seconds = 0.34, seed = 11 }) {
  const n = noise(seed);
  const bp = biquad('bp', hz, q);
  const hp = biquad('hp', 450, 0.7);
  const out = new Float32Array(Math.round(seconds * SR));
  const bursts = [0, 0.0105, 0.0205];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let env = Math.exp(-Math.max(t - 0.03, 0) / tail) * (t >= 0.03 ? 0.8 : 0);
    for (const b of bursts) if (t >= b) env = Math.max(env, Math.exp(-(t - b) / 0.0055));
    out[i] = hp(bp(n())) * env;
  }
  return normalise(out, 0.9);
}

// The six square-wave ratios of the analog hi-hat circuit.
const METAL = [263, 400, 421, 474, 587, 845].map((x) => x * 2.1);

/** Metallic hat: detuned squares and a little noise through a high pass. */
function hat({ decay, tone = 7200, seconds, air = 0.45, seed = 23 }) {
  const n = noise(seed);
  const hp1 = biquad('hp', tone, 0.8);
  const hp2 = biquad('hp', tone, 0.8);
  const lp = biquad('lp', 13500, 0.7);
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const f of METAL) s += Math.sign(Math.sin(2 * Math.PI * f * t));
    const env = Math.min(t / 0.0006, 1) * Math.exp(-t / decay);
    out[i] = lp(hp2(hp1((s / METAL.length) * (1 - air) + n() * air))) * env;
  }
  const fade = Math.round(0.004 * SR);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return normalise(out, 0.8);
}

/** Pitched, woody rim for soul and hip-hop beats. */
function rim({ hz = 1650, decay = 0.012, seconds = 0.12 }) {
  const out = new Float32Array(Math.round(seconds * SR));
  const n = noise(31);
  const bp = biquad('bp', hz * 1.4, 1.2);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const tone = Math.sin(2 * Math.PI * hz * t) * 0.7 + Math.sin(2 * Math.PI * hz * 0.62 * t) * 0.4;
    out[i] = (tone + bp(n()) * 1.2) * Math.exp(-t / decay);
  }
  return normalise(out, 0.9);
}

// Noise differs per channel, as it would between two overheads: the reference
// top end is wide while kick and bass stay in the centre.
const stereo = (make, options) => [make({ ...options, seed: 101 }), make({ ...options, seed: 202 })];

const KIT = {
  kick_deep: kick({ hz: 50 }), // the 118-124 BPM reference kick
  kick_punch: kick({ hz: 54, from: 190, sweep: 0.012, body: 0.075, drive: 2.2, click: 0.16 }), // harder, for 126-130 BPM
  kick_round: kick({ hz: 58, from: 120, body: 0.06, shape: 1.3, drive: 1.1, click: 0.05 }), // short boom for slow beats
  clap_tight: stereo(clap, {}),
  clap_soft: stereo(clap, { hz: 1500, tail: 0.11 }),
  hat_closed: stereo(hat, { decay: 0.011, seconds: 0.12, air: 0.7 }),
  hat_offbeat: stereo(hat, { decay: 0.034, tone: 6400, seconds: 0.22, air: 0.7 }),
  hat_open: stereo(hat, { decay: 0.09, tone: 6000, seconds: 0.5, air: 0.7 }),
  rim_wood: rim({}),
};

function wav(sound) {
  const channels = Array.isArray(sound) ? sound : [sound];
  const frames = channels[0].length;
  const pcm = Buffer.alloc(frames * 2 * channels.length);
  for (let i = 0; i < frames; i++) {
    channels.forEach((data, c) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), (i * channels.length + c) * 2));
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels.length, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2 * channels.length, 28);
  header.writeUInt16LE(2 * channels.length, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

await mkdir(dir, { recursive: true });
const map = {};
for (const [name, data] of Object.entries(KIT)) {
  await writeFile(join(dir, `${name}.wav`), wav(data));
  map[name] = `${name}.wav`;
}
await writeFile(join(dir, 'strudel.json'), `${JSON.stringify(map, null, 2)}\n`);
console.log(`wrote ${Object.keys(KIT).length} samples to ${dir}`);
