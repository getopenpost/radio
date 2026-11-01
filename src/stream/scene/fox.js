// Drawing the fox away from the road. Walking is painted frame by frame, but
// anything tied to an object is built from one still body and limbs worked out
// from where they must be: feet on pedals, hands on an oar or a bar. The body is
// the same pixels on every frame, so nothing shimmers and nothing slides.
import { actorSlot, S } from './palette.js';
import { frame, sprite } from './nature.js';

const FUR = actorSlot('#e8672a');
const SHADE = actorSlot('#b8481f');
const BOOT = actorSlot('#6e2e14');
const TEAL = actorSlot('#4d8b8b');
const OAR = actorSlot('#c07a3a');
const OAR_DARK = actorSlot('#8a4f22');

// Where things sit on the ride sheet, from the bicycle's anchor.
export const WHEEL = 20;
const REAR = [-35, -13];
const FRONT = [37, -12];
const CRANK = [1, -12];
const CRANK_R = 8;
const GRIP = [24, -56]; // the raised bar the gloves rest on
const STEM = [18, -48];
const RIDER = [-11, -25]; // the rider's anchor, so the seat is under its hips
const HIP = [-2, -41];
const THIGH = 19;
const SHIN = 20;

// The rowing boat, from the hull's anchor.
export const HULL_RIM = 12; // rows of hull behind the fox; the rest pass in front
const OARLOCK = [30, -44];
const ROWER = [-16, -36];
const SHOULDER = [8, -62]; // at rest, from the hull
const ARM = 17;

// The hanging body, seen nearly from behind: head between the arms, elbows out to either side.
const HANG_LEFT = -32;
const SHOULDERS = [[22, 47], [43, 47]];
const HANDS = [-13, 13];
const REACH = 17; // one arm's upper and lower parts

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createFox(canvas) {
  /** Pixels within a tapered segment, each pass over the same shape so limbs read as one outline. */
  function capsule(ax, ay, bx, by, ra, rb, slot) {
    const r = Math.max(ra, rb);
    const x0 = Math.floor(Math.min(ax, bx) - r - 1);
    const x1 = Math.ceil(Math.max(ax, bx) + r + 1);
    const y0 = Math.floor(Math.min(ay, by) - r - 1);
    const y1 = Math.ceil(Math.max(ay, by) + r + 1);
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy || 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / len, 0, 1);
        const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
        if (d <= ra + (rb - ra) * t) canvas.set(x, y, slot);
      }
    }
  }

  /** Draw limb parts: one ink outline around all of them, then their colours. */
  function limb(parts) {
    for (const [ax, ay, bx, by, ra, rb] of parts) capsule(ax, ay, bx, by, ra + 1, rb + 1, S.ink);
    for (const [ax, ay, bx, by, ra, rb, slot] of parts) capsule(ax, ay, bx, by, ra, rb, slot);
  }

  /** The joint of a two-part limb, bending to the side of `bend` (+1 or -1). */
  function joint(ax, ay, bx, by, l1, l2, bend) {
    const d = clamp(Math.hypot(bx - ax, by - ay), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = (bx - ax) / (Math.hypot(bx - ax, by - ay) || 1);
    const uy = (by - ay) / (Math.hypot(bx - ax, by - ay) || 1);
    return [ax + ux * a - uy * h * bend, ay + uy * a + ux * h * bend];
  }

  function leg(hx, hy, fx, fy, far) {
    const [kx, ky] = joint(hx, hy, fx, fy, THIGH, SHIN, -1);
    const fur = far ? SHADE : FUR;
    const mid = 0.45;
    const sx = kx + (fx - kx) * mid;
    const sy = ky + (fy - ky) * mid;
    limb([
      [hx, hy, kx, ky, 5, 4, fur],
      [kx, ky, sx, sy, 4, 3.5, fur],
      [sx, sy, fx, fy, 3.5, 3.5, BOOT],
      [fx - 1, fy + 1, fx + 6, fy + 1, 2.5, 2, BOOT],
    ]);
  }

  function arm(sx, sy, hx, hy, bend, far) {
    const [ex, ey] = joint(sx, sy, hx, hy, REACH, REACH, bend);
    const fur = far ? SHADE : FUR;
    const gx = ex + (hx - ex) * 0.62;
    const gy = ey + (hy - ey) * 0.62;
    limb([
      [sx, sy, ex, ey, 3, 2.5, fur],
      [ex, ey, gx, gy, 2.5, 2.5, fur],
      [gx, gy, hx, hy, 2.5, 3.5, BOOT],
    ]);
  }

  /** A sprite placed by its top-left corner. */
  function part(name, i, x, y, options) {
    const s = sprite(name, i);
    frame(canvas, name, i, x - s.ox, y + s.h - 1 + s.oy, options);
  }

  /** A bicycle wheel. Drawn, not painted, so it turns evenly at any speed. */
  function wheel(cx, cy, turn) {
    const R = WHEEL;
    for (let a = 0; a < 6.283; a += 0.03) {
      const [c, s] = [Math.cos(a), Math.sin(a)];
      for (const r of [R, R - 1]) canvas.set(Math.round(cx + c * r), Math.round(cy + s * r), S.ink);
      canvas.set(Math.round(cx + c * (R - 2)), Math.round(cy + s * (R - 2)), S.steel1);
    }
    for (let i = 0; i < 3; i++) {
      const a = turn + (i * Math.PI) / 3;
      canvas.line(cx - Math.cos(a) * (R - 3), cy - Math.sin(a) * (R - 3), cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3), S.steel1);
    }
    canvas.rect(cx - 2, cy - 2, 5, 5, S.steel1);
    canvas.rect(cx - 1, cy - 1, 3, 3, S.steel0);
  }

  function crank(cx, cy, a) {
    const px = cx + Math.cos(a) * CRANK_R;
    const py = cy + Math.sin(a) * CRANK_R;
    canvas.line(cx, cy, px, py, S.ink, 2);
    canvas.rect(Math.round(px) - 3, Math.round(py), 7, 2, S.ink);
    return [px, py];
  }

  /** The bicycle alone. A ridden bicycle is this with a rider on it, so a hop on moves no pixel of it. */
  function bike(x, feet, turn, angle = 0.6) {
    const y = feet - 7;
    wheel(x + REAR[0], feet - WHEEL, turn);
    wheel(x + FRONT[0], feet - WHEEL, turn);
    const far = crank(x + CRANK[0], y + CRANK[1], angle + Math.PI);
    frame(canvas, 'ride', 0, x, y);
    canvas.line(x + STEM[0], y + STEM[1], x + GRIP[0], y + GRIP[1], S.ink, 3);
    canvas.line(x + STEM[0] + 1, y + STEM[1], x + GRIP[0] + 1, y + GRIP[1], TEAL, 1);
    canvas.rect(x + GRIP[0] - 4, y + GRIP[1] - 1, 9, 3, S.ink);
    return { y, far };
  }

  /** The fox riding. The crank angle follows the ground, the feet follow the crank. */
  function ride(x, feet, turn, angle) {
    const { y, far } = bike(x, feet, turn, angle);
    leg(x + HIP[0] + 3, y + HIP[1] + 2, far[0] - 2, far[1] - 4, true);
    const near = [x + CRANK[0] + Math.cos(angle) * CRANK_R, y + CRANK[1] + Math.sin(angle) * CRANK_R];
    frame(canvas, 'ride', 1, x + RIDER[0], y + RIDER[1]);
    leg(x + HIP[0], y + HIP[1], near[0] - 2, near[1] - 4, false);
    crank(x + CRANK[0], y + CRANK[1], angle);
  }

  /** The boat under the fox's front half. `rim` separates what sits behind it. */
  function hullBack(x, y) {
    frame(canvas, 'boat', 3, x, y, { rows: HULL_RIM });
  }
  function hullFront(x, y) {
    frame(canvas, 'boat', 3, x, y, { skip: HULL_RIM });
  }

  /** Rowing: hull and body are still; one stroke moves the oar, the arms and a small lean. */
  function row(x, y, phase, water, outfit = '') {
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const lean = Math.round(c * 3);
    hullBack(x, y);
    frame(canvas, `ride${outfit}`, 3, x + ROWER[0] + lean, y + ROWER[1]);
    hullFront(x, y);
    // The handle circles the oarlock; the blade answers on the far side of it.
    const lx = x + OARLOCK[0];
    const ly = y + OARLOCK[1];
    const hx = lx - 6 + c * 10;
    const hy = ly - 9 + s * 3;
    const bx = lx + (lx - hx) * 1.9;
    const by = ly + (ly - hy) * 2.6;
    canvas.line(hx, hy, bx, by, S.ink, 3);
    canvas.line(hx, hy, bx, by, OAR, 1);
    capsule(bx, by, bx + (bx - hx) * 0.16, by + (by - hy) * 0.16, 2, 3.5, OAR_DARK);
    // Near arm, shoulder to handle.
    const sx = x + SHOULDER[0] + lean;
    const sy = y + SHOULDER[1];
    const [ex, ey] = joint(sx, sy, hx, hy, ARM, ARM, 1);
    limb([
      [sx, sy, ex, ey, 3.5, 3, FUR],
      [ex, ey, hx, hy, 3, 3.5, FUR],
      [hx - 2, hy, hx + 2, hy, 3.5, 3.5, BOOT],
    ]);
    if (s > 0.2 && water) water(bx, by);
  }

  /** The body hanging from two fixed hands; `drop` is how far the shoulders sit below them. */
  function hang(x, barY, drop, outfit = '') {
    const left = x + HANG_LEFT;
    const top = barY + drop - SHOULDERS[0][1];
    arm(left + SHOULDERS[1][0], top + SHOULDERS[1][1], x + HANDS[1], barY, 1, true);
    part(`gym${outfit}`, 0, left, top);
    arm(left + SHOULDERS[0][0], top + SHOULDERS[0][1], x + HANDS[0], barY, -1, false);
  }

  /** A little dust where something lands; it also covers the moment a hat goes on. */
  function puff(x, y, age) {
    if (age >= 1) return;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283;
      const r = 8 + age * 20 + (i % 3) * 3;
      if (i % 2 && age > 0.6) continue;
      canvas.set(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.4), S.path1);
    }
  }

  return { arm, bike, capsule, hang, hullFront, puff, ride, row };
}
