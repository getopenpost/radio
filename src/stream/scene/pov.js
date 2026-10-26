// What the fox sees, opened in a panel above the scene: its laptop screen
// (a code editor, an email being written and sent, a team chat, a study app
// with a rotating dithered globe), the book it is reading, the water under
// its fishing line, the sky through its telescope. Panels dissolve in and out
// through the dither and are tied to the fox by a few thought dots.
import { createRng } from '../../compose/rng.js';
import { createCanvas, HEIGHT, WIDTH } from './canvas.js';
import { band, bayer, clamp01, smooth } from './dither.js';
import { textMask } from './font.js';
import { landAt } from './land.js';
import { CLEAR, S } from './palette.js';

const scratch = createCanvas();
const masks = new Map();
const maskOf = (t) => {
  if (!masks.has(t)) masks.set(t, textMask(t));
  return masks.get(t);
};

/** Pixel-font text; `upTo` characters shown (for typing). Returns the width drawn. */
export function text(canvas, x, y, str, color, upTo = Infinity) {
  const shown = str.slice(0, Math.max(0, Math.floor(upTo)));
  if (!shown) return 0;
  const m = maskOf(shown);
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < m[0].length; xx++) if (m[yy][xx]) canvas.set(x + xx, y + yy, color);
  return m[0].length;
}

/**
 * Open a panel: draw its contents with `paint(canvas, box)` into a scratch
 * frame, then copy them in through a Bayer dissolve of `amount`, with thought
 * dots from `from` (the fox's head) to the panel.
 * @param {{ x: number, y: number, w: number, h: number, round?: boolean }} box
 */
export function panel(canvas, box, amount, paint, from) {
  if (amount <= 0.02) return;
  const { x, y, w, h, round } = box;
  scratch.index.fill(CLEAR);
  paint(scratch, box);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  for (let yy = y - 2; yy < y + h + 2; yy++) {
    for (let xx = x - 2; xx < x + w + 2; xx++) {
      if (xx < 0 || yy < 0 || xx >= WIDTH || yy >= HEIGHT) continue;
      const th = bayer(xx >> 1, yy >> 1);
      if (th >= amount) continue;
      let edge;
      if (round) {
        const d = Math.hypot(xx - cx + 0.5, yy - cy + 0.5);
        if (d > r + 2) continue;
        edge = d > r ? (d > r + 1 ? S.ink : S.paper) : null;
      } else {
        const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
        const corner = (xx < x + 2 || xx >= x + w - 2) && (yy < y + 2 || yy >= y + h - 2);
        if (!inside && corner) continue;
        edge = inside ? null : S.ink;
      }
      if (edge != null) canvas.set(xx, yy, edge);
      else {
        const v = scratch.get(xx, yy);
        if (v !== CLEAR) canvas.set(xx, yy, v);
      }
    }
  }
  // Thought dots, growing from the fox's head towards the panel.
  if (from && amount > 0.5) {
    const [fx, fy] = from;
    const tx = Math.max(x + 8, Math.min(x + w - 8, fx));
    const ty = y + h + 6;
    for (let k = 0; k < 3; k++) {
      const p = (k + 1) / 4;
      const px = Math.round(fx + (tx - fx) * p);
      const py = Math.round(fy - 6 + (ty - (fy - 6)) * p);
      const rr = 1 + k * 0.7;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= rr + 0.5) canvas.set(px + dx, py + dy, d > rr - 0.5 ? S.ink : S.banner);
      }
    }
  }
}

/** The usual place for a panel: centred above the fox, in the sky. */
export const above = (w = 216, h = 128) => ({ x: Math.round(WIDTH / 2 - w / 2), y: 46, w, h });

// ---- The laptop -------------------------------------------------------------

export const APPS = ['code', 'mail', 'chat', 'globe'];

/** A laptop screen with an app, `t` seconds into it. */
export function laptop(c, box, app, t, seed) {
  const { x, y, w, h } = box;
  // Aluminium bezel, a black screen border and a camera notch.
  c.rect(x, y, w, h, S.metal);
  c.rect(x + 3, y + 3, w - 6, h - 6, S.ink);
  c.rect(x + w / 2 - 6, y + 3, 12, 3, S.ink);
  const sx = x + 5;
  const sy = y + 6;
  const sw = w - 10;
  const sh = h - 11;
  // A window title bar with traffic lights.
  const dark = app === 'code' || app === 'globe';
  c.rect(sx, sy, sw, sh, dark ? S.ink : S.paper);
  c.rect(sx, sy, sw, 9, dark ? S.outline : S.cloudShade);
  for (const [k, col] of [[0, S.logo], [1, S.brass], [2, S.leaf0]]) c.rect(sx + 3 + k * 5, sy + 3, 3, 3, col);
  const title = { code: 'MAIN.JS', mail: 'NEW MESSAGE', chat: '#TEAM', globe: 'STUDY' }[app];
  text(c, sx + Math.round(sw / 2 - title.length * 3), sy + 1, title, dark ? S.cloudShade : S.ink);
  const body = { x: sx, y: sy + 10, w: sw, h: sh - 10 };
  ({ code, mail, chat, globe: study })[app](c, body, t, seed);
}

function code(c, { x, y, w, h }, t, seed) {
  // Lines of tokens typed in at a steady pace, scrolling as they fill the screen.
  const r = createRng(seed);
  const lines = Array.from({ length: 40 }, () => {
    const indent = r.pick([0, 0, 1, 1, 2, 3]);
    const tokens = Array.from({ length: r.int(1, 4) }, () => ({ len: r.int(3, 12), col: r.pick([S.logo, S.knit, S.paper, S.cloudShade, S.leaf0, S.brass, S.paper]) }));
    return r.chance(0.15) ? { indent: 0, tokens: [] } : { indent, tokens };
  });
  const perLine = 1.1;
  const typed = t / perLine;
  const rows = Math.floor((h - 4) / 6);
  const first = Math.max(0, Math.floor(typed) - rows + 2);
  for (let i = first; i <= Math.min(lines.length - 1, typed); i++) {
    const ly = y + 3 + (i - first) * 6;
    text(c, x + 2, ly - 1, String((i % 99) + 1).padStart(2, ' '), S.outline);
    let lx = x + 16 + lines[i].indent * 8;
    const frac = i < Math.floor(typed) ? Infinity : (typed % 1) * 40;
    let used = 0;
    for (const tok of lines[i].tokens) {
      const len = Math.min(tok.len, Math.max(0, frac - used));
      if (len > 0) c.rect(lx, ly + 1, Math.round(len), 3, tok.col);
      used += tok.len + 2;
      lx += tok.len + 3;
      if (lx > x + w - 6) break;
    }
    if (i === Math.floor(typed) && Math.floor(t * 2.5) % 2 === 0) c.rect(Math.min(x + w - 4, x + 16 + lines[i].indent * 8 + Math.min(used, frac)), ly, 1, 5, S.paper);
  }
}

function mail(c, { x, y, w, h }, t) {
  const fields = [['TO', 'ANA@TEAM'], ['RE', 'THE NEW DEMO']];
  fields.forEach(([k, v], i) => {
    text(c, x + 4, y + 3 + i * 10, k, S.cloudShade);
    text(c, x + 22, y + 3 + i * 10, v, S.ink, (t - i * 1.2) * 8);
    c.rect(x + 3, y + 12 + i * 10, w - 6, 1, S.cloudShade);
  });
  // The body, typed as lines of words.
  const words = [[14, 9, 20, 7], [11, 18, 6, 12], [22, 8, 13], [9, 15, 10, 8], [16]];
  let k = 0;
  for (let i = 0; i < words.length; i++) {
    let lx = x + 4;
    for (const wl of words[i]) {
      const reveal = clamp01((t - 2.5 - k * 0.25) / 0.25);
      if (reveal > 0) c.rect(lx, y + 27 + i * 7, Math.round(wl * reveal), 3, S.outline);
      lx += wl + 3;
      k++;
    }
  }
  // Send, then a toast.
  const sendAt = 2.5 + k * 0.25 + 1;
  const pressed = t > sendAt && t < sendAt + 0.4;
  c.rect(x + w - 34, y + h - 14, 30, 11, pressed ? S.furDark : S.logo);
  text(c, x + w - 31, y + h - 12, 'SEND', S.paper);
  if (t > sendAt + 0.4) {
    const slide = smooth(clamp01((t - sendAt - 0.4) / 0.4));
    const ty = Math.round(y + h - 2 - slide * 16);
    c.rect(x + 4, ty, 44, 11, S.ink);
    text(c, x + 8, ty + 2, 'SENT!', S.paper);
  }
}

const CHAT = [
  ['b', 'MERGED IT?'],
  ['a', 'YES, JUST NOW'],
  ['b', 'DEMO AT 3?'],
  ['a', 'PERFECT'],
  ['b', 'YOU ROCK'],
  ['a', 'THANKS!'],
];

function chat(c, { x, y, w, h }, t) {
  // Messages pop in one by one after a typing indicator; the list scrolls.
  const shown = [];
  let at = 0.6;
  for (const [who, msg] of CHAT) {
    if (t < at) {
      if (t > at - 1) shown.push({ who, typing: true });
      break;
    }
    shown.push({ who, msg });
    at += 2.2;
  }
  const rows = Math.floor((h - 4) / 14);
  const list = shown.slice(-rows);
  list.forEach((m, i) => {
    const by = y + 3 + i * 14;
    const tw = m.typing ? 17 : maskOf(m.msg)[0].length + 8;
    const bx = m.who === 'a' ? x + w - tw - 4 : x + 4;
    c.rect(bx, by, tw, 11, m.who === 'a' ? S.logo : S.cloudShade);
    if (m.typing) for (let d = 0; d < 3; d++) c.rect(bx + 3 + d * 4, by + 4 + (Math.floor(t * 6 + d) % 3 === 0 ? -1 : 0), 2, 2, S.ink);
    else text(c, bx + 4, by + 2, m.msg, m.who === 'a' ? S.paper : S.ink);
  });
}

function study(c, { x, y, w, h }, t) {
  const r = Math.min(w, h) / 2 - 6;
  globe(c, x + w / 2, y + h / 2 + 1, r, t * 8);
}

const CITIES = [[38.7, -9.1], [35.7, 139.7], [40.7, -74], [-33.9, 151.2], [51.5, -0.1]];

/**
 * A rotating globe drawn as a dither: land bright on the lit side and a sparse
 * grid past the terminator, the sea a faint dither thickening towards the rim,
 * a thin atmosphere, pulsing cities and an arc between two of them.
 */
export function globe(c, cx, cy, r, spin) {
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
        if (out < 0.08 && (nx * lx + ny * ly) > 0 && band(1 - out / 0.08, 0, 1) * 0.6 > th) c.set(px, py, S.knit);
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
      if (tone > th) c.set(px, py, land ? (light > 0.15 ? S.paper : S.cloudShade) : S.knitDark);
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
    c.rect(Math.round(px) - 1, Math.round(py) - 1, 2, 2, S.logo);
    const pr = 1 + pulse * 4;
    for (let a = 0; a < 12; a++) if (pulse < 0.8) c.set(Math.round(px + Math.cos(a) * pr), Math.round(py + Math.sin(a) * pr), S.logo);
  }
  const [a, b] = [CITIES[0], CITIES[4]];
  for (let k = 0; k <= 30; k++) {
    const f = k / 30;
    const [px, py, z] = project(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 1 + Math.sin(Math.PI * f) * 0.25);
    if (z > 0 && k % 2 === 0) c.set(Math.round(px), Math.round(py), S.logo);
  }
}

// ---- The book, the water, the telescope --------------------------------------

/** An open book: two pages of text, a picture, now and then a page turning. */
export function book(c, { x, y, w, h }, t, seed) {
  const page = Math.floor(t / 14);
  const r = createRng(seed + page * 7);
  c.rect(x, y, w, h, S.trunk);
  c.rect(x + 3, y + 3, w - 6, h - 6, S.paper);
  const mid = x + w / 2;
  for (let k = 0; k < 4; k++) c.rect(mid - 2 + k, y + 3, 1, h - 6, k === 1 || k === 2 ? S.cloudShade : S.banner);
  const lines = (left, top, width, n, gap = 6) => {
    for (let i = 0; i < n; i++) {
      let lx = left;
      while (lx < left + width - 4) {
        const wl = r.int(4, 14);
        c.rect(lx, top + i * gap, Math.min(wl, left + width - lx), 2, S.cloudShade);
        lx += wl + 3;
      }
    }
  };
  lines(x + 10, y + 12, w / 2 - 18, Math.floor((h - 24) / 6));
  // The right page: a little landscape picture, a caption, more text.
  const px = mid + 8;
  const pw = w / 2 - 18;
  const ph = Math.floor(h * 0.4);
  c.rect(px, y + 10, pw, ph, S.sky1);
  for (let xx = 0; xx < pw; xx++) {
    const hgt = Math.round(ph * 0.45 + Math.sin(xx * 0.12 + page) * 5 + Math.sin(xx * 0.31) * 2);
    for (let yy = ph - hgt; yy < ph; yy++) c.set(px + xx, y + 10 + yy, yy < ph - hgt + 2 ? S.ink : (xx + yy) % 3 ? S.hill0 : S.hill1);
  }
  c.rect(px + pw - 12, y + 14, 5, 5, S.logo);
  lines(px, y + 14 + ph, pw, Math.floor((h - ph - 28) / 6));
  text(c, x + w / 4 - 3, y + h - 11, String(page * 2 + 12), S.outline);
  // Turning: the right page sweeps over to the left.
  const turn = (t % 14) / 0.9;
  if (turn < 1) {
    const edge = Math.round(x + w - 3 - (w - 6) * smooth(turn));
    const from = Math.min(edge, mid);
    const to = Math.max(edge, mid);
    c.rect(from, y + 3, to - from, h - 6, S.banner);
    c.rect(edge, y + 3, 1, h - 6, S.cloudShade);
  }
}

/**
 * Under the water at the end of the line: the bright surface above, light
 * shafts and drifting motes in deep water, weed on a sandy bottom, a school
 * passing far off, the hook with its worm, and a fish that comes to look,
 * nibbles and either gets hooked (`caught` true, pulled up at `strike`) or
 * turns and swims off.
 */
export function underwater(c, { x, y, w, h }, t, { strike, caught }) {
  const floor = h - 12;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const px = x + xx;
      const py = y + yy;
      const th = bayer(px, py);
      let col = band(yy / floor, 0.05, 0.85) > th ? S.knitDark : S.knit;
      // Soft shafts of light slanting down from the surface, fading with depth.
      const shaft = Math.sin((xx + yy * 0.6) * 0.07 + t * 0.25) * Math.sin((xx + yy * 0.6) * 0.023 - t * 0.1);
      if (shaft > 0.55 && (1 - yy / floor) * 0.45 > th) col = S.knit;
      // The surface, wavering.
      const surface = 3 + Math.round(Math.sin(xx * 0.18 + t * 2) * 1.2);
      if (yy < surface) col = yy === surface - 1 ? S.waterHi : S.sea0;
      // A sandy bottom with a dithered edge.
      const sand = floor + Math.round(Math.sin(xx * 0.05) * 2 + Math.sin(xx * 0.17) * 0.8);
      if (yy >= sand) col = band((yy - sand) / 4, 0, 1) > th ? S.path : S.pathEdge;
      c.set(px, py, col);
    }
  }
  // Motes drifting up through the light.
  for (let k = 0; k < 18; k++) {
    const mx = x + ((k * 53 + Math.floor(Math.sin(t * 0.5 + k) * 3)) % w);
    const my = y + floor - ((k * 29 + t * (3 + (k % 3))) % floor);
    if (my > y + 5) c.set(Math.round(mx), Math.round(my), S.waterHi);
  }
  // A school far off, crossing slowly.
  for (let k = 0; k < 5; k++) {
    const sx = x + ((t * 9 + k * 7 + (k % 2) * 3) % (w + 60)) - 30;
    const sy = y + 22 + (k % 3) * 4 + Math.round(Math.sin(t + k) * 1.5);
    if (sx > x + 1 && sx < x + w - 4) {
      c.rect(Math.round(sx), Math.round(sy), 3, 1, S.outline);
      c.set(Math.round(sx) - 1, Math.round(sy) - 1, S.outline);
      c.set(Math.round(sx) - 1, Math.round(sy) + 1, S.outline);
    }
  }
  // Weed swaying on the bottom, and a few stones.
  for (let k = 0; k < 11; k++) {
    const bx = x + 6 + k * (w / 11) + ((k * 13) % 7);
    const hgt = 12 + ((k * 37) % 20);
    for (let i = 0; i < hgt; i++) {
      const sway = Math.sin(t * 1.1 + k + i * 0.2) * (i / hgt) * 4;
      c.rect(Math.round(bx + sway), y + floor + 1 - i, i < hgt - 3 ? 2 : 1, 1, k % 3 ? S.pine1 : S.pine0);
    }
  }
  for (let k = 0; k < 6; k++) {
    const sx = x + 10 + k * 37 + ((k * 17) % 11);
    c.rect(sx, y + floor - 1, 7, 3, S.metalDark);
    c.rect(sx + 1, y + floor - 2, 4, 1, S.metal);
  }
  // The line down to the hook and its worm.
  const hx = x + Math.round(w * 0.6);
  const pulled = caught && t > strike ? smooth(clamp01((t - strike) / 0.6)) : 0;
  const hy = y + Math.round(h * 0.5 - pulled * h * 0.55);
  c.rect(hx, y, 1, hy - y, S.paper);
  c.set(hx, hy, S.metal);
  c.set(hx, hy + 1, S.metal);
  c.set(hx - 1, hy + 2, S.metal);
  c.set(hx - 2, hy + 1, S.metal);
  const wig = Math.round(Math.sin(t * 5));
  c.rect(hx - 1, hy + 3, 2, 3, S.logo);
  c.set(hx - 1 + wig, hy + 6, S.logo);
  // The fish: in from the left, looking, nibbling at the worm, then hooked
  // (wriggling up with the line) or off the way it came.
  const approach = clamp01((t - (strike - 12)) / 6);
  let mx = x - 10 + (hx - 6 - (x - 10)) * smooth(approach);
  let my = hy + 6 + Math.sin(t * 1.7) * 3 * (1 - approach);
  let dir = 1;
  let tilt = 0;
  if (t > strike - 6 && t < strike) {
    const nib = Math.sin((t - strike) * 7);
    mx = hx - 3 + nib * 2;
    my = hy + 4;
  }
  if (t >= strike) {
    if (caught) {
      mx = hx - 1;
      my = hy + 4;
      tilt = Math.sin(t * 14) * 0.5;
    } else {
      dir = -1;
      mx = hx - 6 - (t - strike) * 34;
      my = hy + 6 + (t - strike) * 4;
    }
  }
  fish(c, mx, my, dir, t, tilt);
  // Bubbles from the fish now and then.
  for (let k = 0; k < 3; k++) {
    const age = (t * 0.5 + k / 3) % 1;
    const by = Math.round(my - 3 - age * 40);
    if (by > y + 4) c.set(Math.round(mx - dir * 2 + Math.sin(age * 9) * 1.5), by, S.waterHi);
  }
}

/** A plump orange fish with its mouth at (mx, my), facing `dir`, tail swishing. */
function fish(c, mx, my, dir, t, tilt = 0) {
  const W = 26;
  const H = 16;
  const g = new Uint8Array(W * H).fill(CLEAR);
  const at = (lx, ly, col) => {
    lx = Math.round(lx);
    ly = Math.round(ly);
    if (lx >= 1 && lx < W - 1 && ly >= 1 && ly < H - 1) g[ly * W + lx] = col;
  };
  // Local frame: facing right, mouth at (22, 8).
  const cx = 15;
  const cy = 8;
  const swish = Math.sin(t * 8) * 1.5;
  for (let ly = 0; ly < H; ly++) for (let lx = 0; lx < W; lx++) {
    const u = (lx - cx) / 7.5;
    const v = (ly - cy) / 3.8;
    if (u * u + v * v <= 1) at(lx, ly, ly > cy + 1 ? S.cream : S.fur);
    // The tail: a forked fan behind the body.
    const tu = cx - 7 - lx;
    if (tu >= 0 && tu <= 5 && Math.abs(ly - cy - swish * (tu / 5)) <= 1 + tu * 0.7 && !(tu > 3 && Math.abs(ly - cy - swish) < 1)) at(lx, ly, S.furDark);
  }
  for (let k = 0; k < 4; k++) at(cx - 1 + k, cy - 4 - (k < 2 ? 1 : 0), S.furDark); // dorsal fin
  at(cx - 2, cy - 5, S.furDark);
  at(cx + 1, cy + 4, S.furDark); // a little fin underneath
  at(cx + 2, cy + 4, S.furDark);
  for (let ly = cy - 2; ly <= cy + 1; ly++) at(cx + 3, ly, S.furDark); // gill
  at(cx + 5, cy - 1, S.paper); // eye
  at(cx + 6, cy - 1, S.ink);
  at(cx + 7, cy + 1, S.ink); // mouth
  // Outline, then stamp mirrored and tilted as needed.
  for (let i = 0; i < g.length; i++) {
    if (g[i] !== CLEAR) continue;
    const n = [i - 1, i + 1, i - W, i + W].some((j) => j >= 0 && j < g.length && g[j] !== CLEAR && g[j] !== 254);
    if (n) g[i] = 254;
  }
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  for (let ly = 0; ly < H; ly++) for (let lx = 0; lx < W; lx++) {
    const v = g[ly * W + lx];
    if (v === CLEAR) continue;
    const ox = lx - 22;
    const oy = ly - 8;
    const rx = ox * cos - oy * sin;
    const ry = ox * sin + oy * cos;
    c.set(Math.round(mx + dir * rx), Math.round(my + ry), v === 254 ? S.ink : v);
  }
}
