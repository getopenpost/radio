// The painted backdrops: long plates of hazy hills, one set per season, laid end
// to end along the distance. They load once; a plate's pixels index a shared palette.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const raw = gunzipSync(readFileSync(new URL('./plates.bin', import.meta.url)));
const size = raw.readUInt32LE(0);
const header = JSON.parse(raw.subarray(4, 4 + size).toString());

/** One palette per family: 'plates' (far), 'near', 'front'. */
export const PLATE_PALETTES = header.palettes;
const bytes = (palette) => Uint8Array.from(palette.flatMap((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))));
const RGB = Object.fromEntries(Object.entries(header.palettes).map(([family, palette]) => [family, bytes(palette)]));

const plates = new Map();
let at = 4 + size;
for (const p of header.plates) {
  plates.set(p.name, { name: p.name, family: p.family, rgb: RGB[p.family], w: p.w, h: p.h, data: raw.subarray(at, at + p.w * p.h) });
  at += p.w * p.h;
}
export const plate = (name) => plates.get(name);
