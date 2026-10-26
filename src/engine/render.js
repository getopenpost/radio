// Offline Strudel renderer for Node.
//
// Evaluates Strudel code exactly like the strudel.cc REPL does and renders it
// through superdough on node-web-audio-api's OfflineAudioContext.
//
// Tracks render in short chunks, each in a fresh context with every voice
// scheduled up front:
// - node-web-audio-api processes every node in the graph each render quantum,
//   including voices that have not started yet, so one context per track is
//   quadratic in track length;
// - adding voices mid-render with suspend()/resume() intermittently freezes
//   the output for seconds at a time in node-web-audio-api 2.2.
// Each chunk starts PREROLL seconds early so reverb, delay and sidechain state
// is already settled when the kept region begins. Reverb, noise and supersaw
// randomness is deterministic, so neighbouring chunks agree sample for sample
// and the short crossfade at each seam is inaudible.
import { seedRandom } from './globals.js';

const PREROLL = 6; // seconds rendered before each chunk's kept region
const OVERLAP = 4096; // samples both neighbouring chunks render; they must agree
const CROSSFADE = 1024; // samples blended at each seam
const QUANTUM = 128;
const ATTEMPTS = 5;

const strudelLog = [];
const consoleLog = console.log;
console.log = (first, ...rest) => {
  // Strudel's loggers print "%c<message>" with CSS; keep them out of stdout.
  if (typeof first === 'string' && first.startsWith('%c')) strudelLog.push(first.slice(2));
  else consoleLog(first, ...rest);
};

const { core, mini, tonal, webaudio, soundfonts, transpiler } = await import('../../dist/strudel.js');
webaudio.setLogger((message) => strudelLog.push(String(message)));

// The same default sound library strudel.cc loads, so templates stay portable.
const doughSamples = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
const prebakeSources = [
  `${doughSamples}/tidal-drum-machines.json`,
  `${doughSamples}/piano.json`,
  `${doughSamples}/Dirt-Samples.json`,
  `${doughSamples}/vcsl.json`,
  `${doughSamples}/mridangam.json`,
  'https://raw.githubusercontent.com/tidalcycles/uzu-drumkit/main/strudel.json',
];
const bankAliases = 'https://raw.githubusercontent.com/todepond/samples/main/tidal-drum-machines-alias.json';

let prebaked;
function prebake() {
  prebaked ??= (async () => {
    await core.evalScope(core, mini, tonal, webaudio, soundfonts);
    webaudio.registerSynthSounds();
    webaudio.registerZZFXSounds();
    soundfonts.registerSoundfonts();
    await Promise.all(prebakeSources.map((url) => webaudio.samples(url)));
    await webaudio.aliasBank(bankAliases);
  })();
  return prebaked;
}

// superdough fills reverb impulse responses asynchronously on a nested
// OfflineAudioContext. Track convolvers so rendering can wait for their
// buffers; otherwise the first seconds of a reverb would be dry.
const pendingConvolvers = new Set();
const bufferDescriptor = (() => {
  for (let p = ConvolverNode.prototype; p; p = Object.getPrototypeOf(p)) {
    const d = Object.getOwnPropertyDescriptor(p, 'buffer');
    if (d) return d;
  }
})();
const createConvolver = BaseAudioContext.prototype.createConvolver;
BaseAudioContext.prototype.createConvolver = function (...args) {
  const node = createConvolver.apply(this, args);
  let generate;
  pendingConvolvers.add(node);
  Object.defineProperty(node, 'buffer', {
    get: () => bufferDescriptor.get.call(node),
    set: (buffer) => {
      bufferDescriptor.set.call(node, buffer);
      if (buffer) pendingConvolvers.delete(node);
    },
  });
  Object.defineProperty(node, 'generate', {
    get: () => generate,
    set: (fn) => {
      generate = (...a) => {
        pendingConvolvers.add(node);
        return fn(...a);
      };
    },
  });
  return node;
};

// Keep every node's JS wrapper alive until its chunk has rendered. When a
// wrapper is garbage collected mid-render, node-web-audio-api can drop live
// nodes from the graph and the output freezes until the context ends.
// The list also lets a finished chunk detach its voices' `ended` handlers.
let chunkNodes = [];
{
  for (const name of Object.getOwnPropertyNames(globalThis)) {
    const Ctor = globalThis[name];
    if (typeof Ctor !== 'function' || !/Node$/.test(name) || !(Ctor.prototype instanceof AudioNode)) continue;
    const Kept = class extends Ctor {
      constructor(...args) {
        super(...args);
        chunkNodes.push(this);
      }
    };
    Object.defineProperty(Kept, 'name', { value: name });
    globalThis[name] = Kept;
    globalThis.window[name] = Kept;
  }
  for (const method of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
    if (!method.startsWith('create') || method === 'createBuffer' || method === 'createPeriodicWave') continue;
    const original = BaseAudioContext.prototype[method];
    if (typeof original !== 'function') continue;
    BaseAudioContext.prototype[method] = function (...args) {
      const node = original.apply(this, args);
      chunkNodes.push(node);
      return node;
    };
  }
}

async function convolversReady() {
  for (let i = 0; pendingConvolvers.size && i < 5000; i++) await new Promise((r) => setTimeout(r, 1));
  if (pendingConvolvers.size) throw new Error('reverb impulse responses did not finish generating');
}

// Sidechain ducking in superdough relies on main-thread callbacks that fire
// late offline. Haps are scheduled in time order, so the gain automation is
// written directly. In the browser the callback runs up to ~10 ms before the
// kick, so the fall starts 15 ms early here; the kick transient masks it.
// node-web-audio-api mishandles cancelAndHoldAtTime for future times, so the
// envelope is tracked here and an overlapping duck restarts from the value the
// previous recovery ramp has reached.
function patchDuck() {
  const controller = webaudio.getSuperdoughAudioController();
  const proto = Object.getPrototypeOf(controller.getOrbit(1));
  if (proto.__offlineDuck) return;
  proto.__offlineDuck = true;
  // Each chunk starts with no buses, so a kick can duck a bus before its first
  // chord arrives. superdough reports that as an error; create the bus instead,
  // so the duck still shapes the chord when it lands.
  const controllerProto = Object.getPrototypeOf(controller);
  const duckOrbits = controllerProto.duck;
  controllerProto.duck = function (targets, ...rest) {
    for (const target of [targets].flat()) if (this.nodes[target] == null) this.getOrbit(target);
    return duckOrbits.call(this, targets, ...rest);
  };
  proto.duck = function (t, onsettime = 0, attacktime = 0.1, depth = 1) {
    const gain = this.output.gain;
    const attack = Math.max(attacktime, 0.002);
    const ducked = Math.min(Math.max(1 - Math.sqrt(depth), 0.01), 1);
    const fallStart = Math.max(t - 0.015, 0);
    const bottom = Math.max(t + Math.max(onsettime, 0), fallStart + 0.005);
    const prev = this.__duck;
    if (prev && fallStart < prev.end) {
      const v =
        fallStart <= prev.bottom
          ? prev.ducked
          : prev.ducked * Math.pow(1 / prev.ducked, (fallStart - prev.bottom) / (prev.end - prev.bottom));
      gain.cancelScheduledValues(fallStart);
      gain.setValueAtTime(v, fallStart);
    } else {
      gain.setValueAtTime(1, fallStart);
    }
    gain.exponentialRampToValueAtTime(ducked, bottom);
    gain.exponentialRampToValueAtTime(1, bottom + attack);
    this.__duck = { ducked, bottom, end: bottom + attack };
  };
}

let repl;
let evalError;

/** Evaluate Strudel code like the REPL does. Returns the pattern and its tempo. */
export async function evaluateCode(code) {
  await prebake();
  repl ??= core.repl({
    transpiler,
    getTime: () => 0,
    defaultOutput: () => {},
    onEvalError: (err) => (evalError = err),
  });
  evalError = undefined;
  repl.setCps(0.5); // the REPL default, in case the code does not set a tempo
  const pattern = await repl.evaluate(code, false);
  if (evalError || !pattern) throw new Error(`Strudel evaluation failed: ${evalError?.message ?? 'no pattern'}`);
  return { pattern, cps: repl.scheduler.cps };
}

const align = (seconds, sampleRate) => Math.floor((seconds * sampleRate) / QUANTUM) * QUANTUM;

async function renderChunk(haps, { cps, sampleRate, start, end, errors }) {
  // Render [start - PREROLL, end + crossfade]. Voices that started earlier but
  // still sound (long pads, sustained notes) pull the context start back.
  const keepFrom = align(start, sampleRate);
  const keepTo = Math.round(end * sampleRate) + OVERLAP;
  const warm = (keepFrom - align(PREROLL, sampleRate)) / sampleRate;
  const voices = haps.filter((h) => h.onset * sampleRate < keepTo && (h.onset >= warm || h.end > warm));
  const earliest = voices.reduce((m, h) => Math.min(m, h.onset), warm);
  const ctxStart = Math.max(0, align(earliest, sampleRate));
  const ctx = new OfflineAudioContext(2, keepTo - ctxStart, sampleRate);
  webaudio.setAudioContext(ctx);
  webaudio.setSuperdoughAudioController(null);
  await webaudio.initAudio({ maxPolyphony: 1e9, disableWorklets: true });
  patchDuck();

  const offset = ctxStart / sampleRate;
  globalThis.__renderOffset = offset; // lets native voices derive per-voice randomness from absolute time
  for (const h of voices) {
    try {
      // superdough mutates the value it gets, and a hap can land in two chunks.
      await webaudio.superdough({ ...h.value }, h.onset - offset, h.duration, cps, h.cycle);
    } catch (err) {
      errors.set(err.message, (errors.get(err.message) ?? 0) + 1);
    }
  }
  await convolversReady();
  const buffer = await ctx.startRendering();
  // Voices still sounding at the end fire `ended` after rendering, when the
  // next chunk's context is active; their cleanup would build nodes there.
  for (const node of chunkNodes) if ('onended' in node) node.onended = null;
  chunkNodes = [];
  const left = new Float32Array(buffer.length);
  const right = new Float32Array(buffer.length);
  buffer.copyFromChannel(left, 0);
  buffer.copyFromChannel(right, 1);
  return { left, right, ctxStart, keepFrom, voices: voices.length };
}

/**
 * Evaluate Strudel code and render it.
 * @param {string} code Strudel code, as you would paste it into strudel.cc.
 * @param {object} options
 * @param {number} [options.cycles] Number of cycles to render.
 * @param {number} [options.seconds] Alternative to cycles, rounded up to whole cycles.
 * @param {number} [options.tail=6] Extra seconds after the last cycle for releases and reverb tails.
 * @param {number} [options.sampleRate=48000]
 * @param {number} [options.seed=1] Seed for remaining randomness (e.g. vinyl crackle).
 * @param {number} [options.chunkCycles=4] Cycles per chunk.
 * @returns {Promise<{left: Float32Array, right: Float32Array, sampleRate: number, cps: number, cycles: number, events: number}>}
 */
export async function renderCode(code, { cycles, seconds, tail = 6, sampleRate = 48000, seed = 1, chunkCycles = 4 } = {}) {
  seedRandom(seed);
  const logStart = strudelLog.length;
  const { pattern, cps } = await evaluateCode(code);
  cycles ??= Math.ceil((seconds ?? 60) * cps);

  const haps = pattern
    .queryArc(0, cycles, { _cps: cps })
    .filter((hap) => hap.hasOnset())
    .map((hap) => {
      hap.ensureObjectValue();
      const onset = hap.whole.begin.valueOf() / cps;
      const duration = hap.duration / cps;
      const release = Math.max(hap.value.release ?? 0, hap.value.FXrelease ?? 0);
      return { value: hap.value, onset, duration, cycle: hap.whole.begin.valueOf(), end: onset + duration + release + 0.5 };
    })
    .sort((a, b) => a.onset - b.onset);

  const total = Math.ceil((cycles / cps + tail) * sampleRate);
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const errors = new Map();
  const chunkCount = Math.ceil(cycles / chunkCycles);
  let retries = 0;
  const bounds = (k) => ({
    start: (k * chunkCycles) / cps,
    end: k === chunkCount - 1 ? total / sampleRate : ((k + 1) * chunkCycles) / cps,
  });
  const renderUnfrozen = async (k) => {
    for (let attempt = 1; ; attempt++) {
      const chunk = await renderChunk(haps, { cps, sampleRate, ...bounds(k), errors });
      const problem = frozen(chunk);
      if (!problem) return chunk;
      if (attempt === ATTEMPTS) throw new Error(`chunk ${k} failed verification ${ATTEMPTS} times: ${problem}`);
      retries++;
      if (process.env.RENDER_DEBUG) console.error(`chunk ${k} attempt ${attempt}: ${problem}, re-rendering`);
    }
  };
  const write = (chunk, k) => {
    const from = k === 0 ? 0 : chunk.keepFrom;
    for (let i = from; i < Math.min(total, chunk.ctxStart + chunk.left.length); i++) {
      const j = i - chunk.ctxStart;
      // Linear crossfade over the seam; neighbouring chunks agree there.
      const w = k === 0 ? 1 : Math.min(1, (i - chunk.keepFrom) / CROSSFADE);
      left[i] = left[i] * (1 - w) + chunk.left[j] * w;
      right[i] = right[i] * (1 - w) + chunk.right[j] * w;
    }
  };
  // A chunk is written once the next chunk agrees with it at the seam. If they
  // keep disagreeing, either could be wrong, so both are rendered again.
  let pending = await renderUnfrozen(0);
  for (let k = 1; k < chunkCount; k++) {
    let chunk = await renderUnfrozen(k);
    for (let attempt = 1; ; attempt++) {
      const problem = seamMismatch(pending, chunk);
      if (!problem) break;
      if (attempt === ATTEMPTS) throw new Error(`seam ${k} failed verification ${ATTEMPTS} times: ${problem}`);
      retries++;
      if (process.env.RENDER_DEBUG) console.error(`seam ${k} attempt ${attempt}: ${problem}, re-rendering`);
      if (attempt % 2 === 0) pending = await renderUnfrozen(k - 1);
      else chunk = await renderUnfrozen(k);
    }
    write(pending, k - 1);
    pending = chunk;
  }
  write(pending, chunkCount - 1);
  if (errors.size) {
    const summary = [...errors].map(([m, n]) => `${m} (x${n})`).join('; ');
    throw new Error(`Strudel scheduling errors: ${summary}`);
  }
  const unknown = strudelLog.slice(logStart).filter((m) => /unknown chord|not found|error/i.test(m));
  if (unknown.length) throw new Error(`Strudel reported problems: ${[...new Set(unknown)].join('; ')}`);
  return { left, right, sampleRate, cps, cycles, events: haps.length, retries };
}

// node-web-audio-api occasionally stops processing the graph and repeats the
// last render quantum until the context ends. Real audio never repeats a
// non-silent 128-sample block exactly, so that is easy to detect.
function frozen({ left, right }) {
  let run = 0;
  for (let b = QUANTUM; b + QUANTUM <= left.length; b += QUANTUM) {
    let same = true;
    let energy = 0;
    for (let i = 0; i < QUANTUM; i++) {
      const l = left[b + i];
      if (l !== left[b + i - QUANTUM] || right[b + i] !== right[b + i - QUANTUM]) {
        same = false;
        break;
      }
      energy += l * l;
    }
    run = same && energy > 1e-12 ? run + 1 : 0;
    if (run >= 4) return `output frozen at ${(b / 48000).toFixed(2)}s into the chunk`;
  }
  return undefined;
}

// Neighbouring chunks render the same OVERLAP samples and should agree up to
// noise sources that are random by design (crackle).
function seamMismatch(prev, next) {
  let diff = 0;
  let ref = 0;
  for (let i = next.keepFrom; i < next.keepFrom + OVERLAP; i++) {
    const a = i - prev.ctxStart;
    const b = i - next.ctxStart;
    if (a >= prev.left.length) break;
    const dl = prev.left[a] - next.left[b];
    const dr = prev.right[a] - next.right[b];
    diff += dl * dl + dr * dr;
    ref += prev.left[a] ** 2 + prev.right[a] ** 2;
  }
  const ratio = Math.sqrt(diff / Math.max(ref, 1e-12));
  if (process.env.RENDER_DEBUG) console.error(`seam at ${(next.keepFrom / 48000).toFixed(2)}s: diff ratio ${ratio.toExponential(2)}`);
  return diff > 1e-6 && ratio > 0.05 ? `seam mismatch (diff ratio ${ratio.toFixed(3)})` : undefined;
}

export { core, strudelLog };
