import { band, bayer } from './dither.js';
import { landAt } from './land.js';
import { S } from './palette.js';

const CITIES = [[38.7, -9.1], [35.7, 139.7], [40.7, -74], [-33.9, 151.2], [51.5, -0.1]];

/**
 * A rotating globe drawn as a dither: land bright on the lit side and a sparse
 * grid past the terminator, the sea a faint dither thickening towards the rim,
 * a thin atmosphere, pulsing cities and an arc between two of them.
 */
export function globe(c, cx, cy, r, spin, colors = S) {
  const tilt = (18 * Math.PI) / 180;
  const lx = -0.55;
  const ly = -0.45;
  const lz = 0.7;
  const rot = (spin * Math.PI) / 180;
  for (let py = Math.floor(cy - r - 3); py <= cy + r + 3; py++) {
    for (let px = Math.floor(cx - r - 3); px <= cx + r + 3; px++) {
      const nx = (px - cx + 0.5) / r;
      const ny = (py - cy + 0.5) / r;
      const d2 = nx * nx + ny * ny;
      const th = bayer(px, py);
      if (d2 > 1) {
        // Atmosphere: a thin glow on the lit rim.
        const out = Math.sqrt(d2) - 1;
        if (out < 0.08 && (nx * lx + ny * ly) > 0 && band(1 - out / 0.08, 0, 1) * 0.6 > th) c.set(px, py, colors.knit);
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      // Tilt the pole towards us, then read latitude and longitude.
      const y2 = ny * Math.cos(tilt) - nz * Math.sin(tilt);
      const z2 = ny * Math.sin(tilt) + nz * Math.cos(tilt);
      const lat = (Math.asin(Math.max(-1, Math.min(1, -y2))) * 180) / Math.PI;
      const lon = (((Math.atan2(nx, z2) + rot) * 180) / Math.PI + 540) % 360 - 180;
      const light = Math.max(0, nx * lx + ny * ly + nz * lz);
      const land = landAt(lat, lon) > 0.5;
      let tone;
      if (land) tone = light > 0.15 ? 0.35 + light * 0.75 : (Math.round(lat) % 4 === 0 || Math.round(lon) % 4 === 0) ? 0.5 : 0.08;
      else tone = 0.06 + (1 - nz) * 0.35 + light * 0.08;
      if (tone > th) c.set(px, py, land ? (light > 0.15 ? colors.paper : colors.cloudShade) : colors.knitDark);
    }
  }
  // Cities facing us pulse; an arc lifts between the first two.
  const project = (lat, lon, lift = 1) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180 - rot;
    let X = Math.cos(la) * Math.sin(lo);
    let Yy = -Math.sin(la);
    let Z = Math.cos(la) * Math.cos(lo);
    const y2 = Yy * Math.cos(tilt) + Z * Math.sin(tilt);
    const z2 = -Yy * Math.sin(tilt) + Z * Math.cos(tilt);
    return [cx + X * r * lift, cy + y2 * r * lift, z2];
  };
  for (const [i, [lat, lon]] of CITIES.entries()) {
    const [px, py, z] = project(lat, lon);
    if (z < 0.1) continue;
    const pulse = (spin / 40 + i * 0.3) % 1;
    c.rect(Math.round(px) - 1, Math.round(py) - 1, 2, 2, colors.logo);
    const pr = 1 + pulse * 4;
    for (let a = 0; a < 12; a++) if (pulse < 0.8) c.set(Math.round(px + Math.cos(a) * pr), Math.round(py + Math.sin(a) * pr), colors.logo);
  }
  const [a, b] = [CITIES[0], CITIES[4]];
  for (let k = 0; k <= 30; k++) {
    const f = k / 30;
    const [px, py, z] = project(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 1 + Math.sin(Math.PI * f) * 0.25);
    if (z > 0 && k % 2 === 0) c.set(Math.round(px), Math.round(py), colors.logo);
  }
}

