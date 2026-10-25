// Measure every instrument preset on a reference phrase for its role and write
// gain multipliers to src/compose/calibration.json, so all presets of a role
// sit at the same loudness. Re-run after adding or changing presets.
// Usage: npm run calibrate [-- --only pad.warm]
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createRng } from '../compose/rng.js';
import { KITS, PRESETS } from '../compose/instruments.js';
import { renderCode } from '../engine/render.js';
import calibration from '../compose/calibration.json' with { type: 'json' };

const { values } = parseArgs({ options: { only: { type: 'string' } } });
const TARGET_DB = -20;
const BARS = 8;
const chords = 'chord("<Am9 F^9 C^7 G6>")';
const reference = {
  sub: (chain) => `note("<a1 f1 c2 g1>")${chain}`,
  bass: (chain) => `note("<[a2 ~ a2 e3] [f2 ~ f2 c3] [c3 ~ c3 g3] [g2 ~ g2 d3]>")${chain}`,
  pad: (chain) => `${chords}.anchor("a4").voicing()${chain}`,
  keys: (chain) => `${chords}.struct("~ [~ x] ~ [~ x]").anchor("c5").voicing()${chain}`,
  lead: (chain) => `note("<[e5 ~ g5 a5] [c5 ~ ~ e5] [g5 ~ e5 d5] [b4 ~ ~ ~]>")${chain}`,
  arp: (chain) => `${chords}.n("0 2 4 2 6 4 2 4").anchor("c5").voicing()${chain}`,
  texture: (chain) => `note("a3")${chain}`,
};
const grids = {
  kick: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
  snare: '~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~',
  hat: 'x ~ x ~ x ~ x ~ x ~ x ~ x ~ x ~',
  openhat: '~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~',
  perc: '~ ~ ~ x ~ ~ x ~ ~ ~ ~ x ~ ~ x ~',
};

const items = [
  ...PRESETS.map((preset) => ({ id: preset.id, code: reference[preset.role](preset.chain(createRng(1))) })),
  ...Object.entries(KITS).flatMap(([part, kits]) =>
    kits.map((kit) => ({ id: kit.id, code: `s("[${grids[part].replaceAll(/\b(bd|x)\b/g, kit.sound)}]")${kit.mods}` })),
  ),
].filter((item) => !values.only || item.id === values.only);

const result = { ...calibration };
for (const { id, code } of items) {
  const audio = await renderCode(`setcps(100/60/4)\n${code}`, { cycles: BARS, tail: 0 });
  let sum = 0;
  for (let i = 0; i < audio.left.length; i++) sum += audio.left[i] ** 2 + audio.right[i] ** 2;
  const rmsDb = 10 * Math.log10(sum / (2 * audio.left.length) + 1e-20);
  result[id] = Number(Math.pow(10, (TARGET_DB - rmsDb) / 20).toPrecision(3));
  console.log(`${id.padEnd(22)} ${rmsDb.toFixed(1).padStart(6)} dBFS  gain x${result[id]}`);
}
const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(fileURLToPath(new URL('../compose/calibration.json', import.meta.url)), JSON.stringify(sorted, null, 2) + '\n');
process.exit(0);
