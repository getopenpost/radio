// Native Web Audio replacements for superdough's per-voice AudioWorklets.
//
// node-web-audio-api never releases AudioWorklet nodes during offline
// rendering, and each one costs a thread handoff per render quantum, so a
// track with a few hundred worklet voices renders quadratically slower.
// These replacements compute the same math with native nodes. The bundler
// (scripts/build-strudel.js) routes superdough's getWorklet() through
// nativeWorklet(); processors without a replacement still use the worklet.

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
const frac = (x) => x - Math.floor(x);

// Same order as waveShapeNames in superdough/worklets.mjs.
const lfoShapes = [
  (p, skew) => (p >= skew ? 1 / (1 - skew) - p / (1 - skew) : p / skew), // tri
  (p) => Math.sin(2 * Math.PI * p) * 0.5 + 0.5, // sine
  (p) => p, // ramp
  (p) => 1 - p, // saw
  (p, skew) => (p >= skew ? 0 : 1), // square
  (p) => p, // custom with its default values [0, 1]
  (p) => 2 * p - 1, // sawblep
];

const curveCache = new Map();
function cached(key, make) {
  let value = curveCache.get(key);
  if (!value) {
    value = make();
    curveCache.set(key, value);
  }
  return value;
}

function withParameters(node, values = {}) {
  const parameters = new Map();
  for (const [name, value] of Object.entries(values)) parameters.set(name, { value, defaultValue: value });
  node.parameters = parameters;
  return node;
}

// The LFO output only depends on its phase, so one precomputed cycle played
// as a looping buffer reproduces the worklet exactly.
function lfo(ac, params) {
  const {
    begin = 0,
    end = 0,
    time = begin,
    frequency = 0.5,
    skew = 0.5,
    depth = 1,
    phaseoffset = 0,
    shape = 0,
    curve = 1,
    dcoffset = 0,
    min = -1e9,
    max = 1e9,
  } = params;
  const out = withParameters(new GainNode(ac, { gain: 1 }));
  const start = Math.max(begin, ac.currentTime);
  if (!(end > start) || !(frequency > 0)) return out;

  const size = 2048;
  const wave = lfoShapes[shape] ?? lfoShapes[0];
  const key = `lfo:${shape}:${skew}:${depth}:${curve}:${dcoffset}:${min}:${max}`;
  const buffer = cached(key, () => {
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const v = Math.pow((wave(i / size, skew) + dcoffset) * depth, curve);
      data[i] = Number.isFinite(v) ? clamp(v, min, max) : 0;
    }
    const b = ac.createBuffer(1, size, ac.sampleRate);
    b.copyToChannel(data, 0);
    return b;
  });
  const source = new AudioBufferSourceNode(ac, {
    buffer,
    loop: true,
    playbackRate: (frequency * size) / ac.sampleRate,
  });
  source.connect(out);
  source.start(start, (frac(time * frequency + phaseoffset) * size) / ac.sampleRate);
  source.stop(end);
  return out;
}

// Memoryless worklets become a WaveShaperNode. Input is scaled into the
// curve's [-1, 1] domain first so signals up to +12 dB keep their shape.
function shaper(ac, key, fn) {
  const range = 4;
  const curve = cached(key, () => {
    const size = 16385;
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) data[i] = fn(((2 * i) / (size - 1) - 1) * range);
    // Some algorithms overflow far outside [-1, 1]; hold the last finite value.
    for (let i = 0, last = 0; i < size; i++) {
      if (Number.isFinite(data[i])) last = data[i];
      else data[i] = last;
    }
    return data;
  });
  const input = new GainNode(ac, { gain: 1 / range });
  const ws = new WaveShaperNode(ac, { curve, oversample: '2x' });
  input.connect(ws);
  input.connect = (...args) => ws.connect(...args);
  input.disconnect = (...args) => ws.disconnect(...args);
  return withParameters(input);
}

export function nativeWorklet(ac, processor, params = {}, config = {}, { getDistortionAlgorithm } = {}) {
  switch (processor) {
    case 'lfo-processor':
      return lfo(ac, params);
    case 'shape-processor': {
      const s = Math.min(params.shape ?? 0, 1 - 4e-10);
      const k = (2 * s) / (1 - s);
      const post = clamp(params.postgain ?? 1, 0.001, 1);
      return shaper(ac, `shape:${s}:${post}`, (x) => (((1 + k) * x) / (1 + k * Math.abs(x))) * post);
    }
    case 'crush-processor': {
      const q = Math.pow(2, Math.max(1, params.crush ?? 8) - 1);
      return shaper(ac, `crush:${q}`, (x) => Math.round(x * q) / q);
    }
    case 'distort-processor': {
      const algorithm = config.processorOptions?.algorithm;
      const fn = getDistortionAlgorithm(algorithm);
      const k = Math.expm1(params.distort ?? 0);
      const post = clamp(params.postgain ?? 1, 0.001, 1);
      return shaper(ac, `distort:${algorithm}:${k}:${post}`, (x) => post * fn(x, k));
    }
    default:
      return undefined;
  }
}

// Supersaw: one native band-limited sawtooth per unison voice, detuned and
// alternately panned exactly like superdough's supersaw-oscillator. Parameter
// values arrive after construction, so voices are built on 'initialize'.
export function nativeSupersaw(ac) {
  const out = new GainNode(ac, { gain: 1, channelCount: 2, channelCountMode: 'explicit' });
  const merger = new ChannelMergerNode(ac, { numberOfInputs: 2 });
  merger.connect(out);
  const frequency = new ConstantSourceNode(ac, { offset: 440 });
  const detune = new ConstantSourceNode(ac, { offset: 0 });
  const plain = { begin: -1, end: -1, freqspread: 0.2, panspread: 0.4, voices: 5 };
  const parameters = new Map([
    ['frequency', frequency.offset],
    ['detune', detune.offset],
  ]);
  for (const [name, value] of Object.entries(plain)) parameters.set(name, { value, defaultValue: value });
  out.parameters = parameters;

  const build = () => {
    const get = (name) => parameters.get(name).value;
    const begin = Math.max(get('begin'), ac.currentTime);
    const end = get('end');
    const voices = Math.max(1, Math.round(get('voices')));
    const spread = get('freqspread');
    const pan = get('panspread') * 0.5 + 0.5;
    let gainL = Math.sqrt(1 - pan);
    let gainR = Math.sqrt(pan);
    frequency.start(begin);
    detune.start(begin);
    for (let n = 0; n < voices; n++) {
      const semis = voices < 2 ? 0 : n * (spread / (voices - 1)) - spread * 0.5;
      const osc = new OscillatorNode(ac, { type: 'sawtooth', frequency: 0, detune: semis * 100 });
      frequency.connect(osc.frequency);
      detune.connect(osc.detune);
      osc.connect(new GainNode(ac, { gain: gainL })).connect(merger, 0, 0);
      osc.connect(new GainNode(ac, { gain: gainR })).connect(merger, 0, 1);
      [gainL, gainR] = [gainR, gainL];
      // Start phase is pseudo-random like the worklet's, but derived from the
      // voice itself so separately rendered chunks agree.
      const period = 1 / Math.max(frequency.offset.value, 1);
      const absolute = begin + (globalThis.__renderOffset ?? 0);
      const phase = frac(Math.sin((absolute * 1000 + frequency.offset.value) * 12.9898 + n * 78.233) * 43758.5453);
      osc.start(Math.max(ac.currentTime, begin - phase * period));
      if (end > 0) osc.stop(end + 0.05);
    }
    if (end > 0) {
      frequency.stop(end + 0.05);
      detune.stop(end + 0.05);
    }
  };
  out.port = {
    postMessage: (message) => {
      if (message?.type === 'initialize') build();
    },
  };
  return out;
}
