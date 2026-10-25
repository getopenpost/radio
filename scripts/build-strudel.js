// Bundles the Strudel packages into one ESM file for Node (dist/strudel.js).
//
// - Some Strudel dependencies only expose their ESM build through the "module"
//   field, which Node ignores, so they go through a bundler.
// - superdough is bundled from source so its per-voice AudioWorklets can be
//   routed to native replacements (src/engine/native-nodes.js). See that file
//   for why.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const superdoughDir = join(root, 'node_modules/superdough');
const nativeNodes = join(root, 'src/engine/native-nodes.js');

function patch(source, file, replacements) {
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`build-strudel: patch anchor not found in ${file}: ${from}`);
    source = source.replace(from, to);
  }
  return source;
}

// Seeded PRNG injected into patched modules (mulberry32).
const prng = `function __prng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function __hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}`;

const patches = {
  // Deterministic reverb impulse responses: the same parameters always give
  // the same IR, so chunks rendered separately agree.
  'reverbGen.mjs': [
    ['var reverbGen = {};', `var reverbGen = {};\n${prng}\nvar __reverbRandom = Math.random;`],
    [
      'reverbGen.generateReverb = function (params, callback) {',
      `reverbGen.generateReverb = function (params, callback) {
  __reverbRandom = __prng(__hash(JSON.stringify([params.numChannels, params.decayTime, params.fadeInTime, params.lpFreqStart, params.lpFreqEnd, params.audioContext?.sampleRate])));`,
    ],
    ['  return Math.random() * 2 - 1;', '  return __reverbRandom() * 2 - 1;'],
  ],
  // Deterministic cached noise buffers (white, pink, brown). Crackle stays random.
  'noise.mjs': [
    ['let noiseCache = {};', `let noiseCache = {};\n${prng}\nlet __crackleSeed = 1;`],
    ['  const output = noiseBuffer.getChannelData(0);', "  const output = noiseBuffer.getChannelData(0);\n  const __rand = __prng(type === 'crackle' ? __crackleSeed : __hash(type));"],
    // Crackle differs per voice, seeded by the voice's absolute start time.
    ['  o.buffer = getNoiseBuffer(type, density);', "  __crackleSeed = __hash(`${type}:${Math.round((t + (globalThis.__renderOffset ?? 0)) * 1000)}`);\n  o.buffer = getNoiseBuffer(type, density);"],
    ["      output[i] = Math.random() * 2 - 1;\n    } else if (type === 'brown') {\n      let white = Math.random() * 2 - 1;", "      output[i] = __rand() * 2 - 1;\n    } else if (type === 'brown') {\n      let white = __rand() * 2 - 1;"],
    ["    } else if (type === 'pink') {\n      let white = Math.random() * 2 - 1;", "    } else if (type === 'pink') {\n      let white = __rand() * 2 - 1;"],
    ['      if (Math.random() < probability) {\n        output[i] = Math.random() * 2 - 1;', '      if (__rand() < probability) {\n        output[i] = __rand() * 2 - 1;'],
  ],
  // Never recycle nodes: superdough's pool hands out nodes the offline render
  // thread may still be processing, which freezes the output for a while.
  'nodePools.mjs': [
    ['export const releaseNodeToPool = (node) => {\n  node.disconnect();', 'export const releaseNodeToPool = (node) => {\n  node.disconnect();\n  return;'],
  ],
  'helpers.mjs': [
    // FM modulators started at context time 0, so their phase at note-on
    // depended on when the context started. Start them with the note.
    ["const mod = (freq, type = 'sine') => {", "const mod = (freq, type = 'sine', begin) => {"],
    ['  osc.start();\n  return osc;\n};', '  osc.start(begin);\n  return osc;\n};'],
    ["const fm = (frequencyparam, harmonicityRatio, wave = 'sine') => {", "const fm = (frequencyparam, harmonicityRatio, wave = 'sine', begin) => {"],
    ['  return { osc: mod(modfreq, wave), freq: modfreq };', '  return { osc: mod(modfreq, wave, begin), freq: modfreq };'],
    ["fm(param, value[`fmh${idxS}`] ?? 1, value[`fmwave${idxS}`] ?? 'sine');", "fm(param, value[`fmh${idxS}`] ?? 1, value[`fmwave${idxS}`] ?? 'sine', begin);"],
    ['export function getWorklet(ac, processor, params, config) {', `import { nativeWorklet as __nativeWorklet } from ${JSON.stringify(nativeNodes)};
export function getWorklet(ac, processor, params, config) {
  return __nativeWorklet(ac, processor, params, config, { getDistortionAlgorithm }) ?? __workletNode(ac, processor, params, config);
}
function __workletNode(ac, processor, params, config) {`],
  ],
  'synth.mjs': [
    ["import { logger } from './logger.mjs';", `import { logger } from './logger.mjs';
import { nativeSupersaw as __nativeSupersaw } from ${JSON.stringify(nativeNodes)};`],
    ["const factory = () => new AudioWorkletNode(ac, 'supersaw-oscillator', { outputChannelCount: [2] });", 'const factory = () => __nativeSupersaw(ac);'],
    ["const o = getNodeFromPool('supersaw', factory);", 'const o = factory();'],
    ['releaseNodeToPool(o);', 'o.disconnect();'],
  ],
};

const superdoughSource = {
  name: 'superdough-source',
  setup(b) {
    b.onResolve({ filter: /^superdough(\/.*)?$/ }, (args) => ({
      path: join(superdoughDir, args.path === 'superdough' ? 'index.mjs' : args.path.slice('superdough/'.length)),
    }));
    // Vite's "?audioworklet" import: bundle the worklet module into a data URL.
    b.onResolve({ filter: /\?audioworklet$/ }, (args) => ({
      path: join(args.resolveDir, args.path.replace(/\?audioworklet$/, '')),
      namespace: 'audioworklet',
    }));
    b.onLoad({ filter: /.*/, namespace: 'audioworklet' }, async (args) => {
      const result = await build({
        entryPoints: [args.path],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral',
        mainFields: ['module', 'main'],
        define: { 'process.env.NODE_ENV': '"production"' },
        logLevel: 'warning',
      });
      const url = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
      return { contents: `export default ${JSON.stringify(url)};`, loader: 'js' };
    });
    b.onLoad({ filter: /node_modules\/superdough\/[^/]+\.mjs$/ }, async (args) => {
      const file = args.path.slice(superdoughDir.length + 1);
      let contents = await readFile(args.path, 'utf8');
      if (patches[file]) contents = patch(contents, file, patches[file]);
      return { contents, loader: 'js', resolveDir: dirname(args.path) };
    });
  },
};

await build({
  entryPoints: [join(root, 'src/engine/strudel-entry.js')],
  outfile: join(root, 'dist/strudel.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  mainFields: ['module', 'main'],
  external: ['node-web-audio-api'],
  plugins: [superdoughSource],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});
