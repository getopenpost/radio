// The characters: a small postal fox in OpenPost's orange-brown (the host of
// the stream), and friends who share the same build (a bunny, a bear). They
// are drawn from simple shapes each frame into a little buffer, outlined, then
// stamped onto the frame, so any pose, expression or prop costs the same.
import { S, CLEAR } from './palette.js';

const W = 56;
const H = 56;
const OX = 28; // origin: the ground point under the body
const OY = 50;

export const SPECIES = {
  fox: { fur: S.fur, dark: S.furDark, light: S.cream, ears: 'pointy', tail: 'fox', bag: true },
  bunny: { fur: S.bunny, dark: S.bunnyDark, light: S.cream, ears: 'long', tail: 'puff', bag: false },
  bear: { fur: S.bear, dark: S.bearDark, light: S.bunnyDark, ears: 'round', tail: 'none', bag: false },
};

/**
 * A pose. Every field is optional.
 * @typedef {object} Pose
 * @property {'stand'|'walk'|'sit'|'sitGround'} [legs]
 * @property {number} [step]      walk phase in [0, 1), one full stride per unit
 * @property {number} [seat]      seat height in pixels when sitting
 * @property {number} [bob]       body offset in pixels (negative is up)
 * @property {number} [headX]     head offset, e.g. leaning in
 * @property {number} [headY]
 * @property {'open'|'blink'|'happy'|'closed'|'focus'|'wide'|'up'|'side'} [eyes]
 * @property {'none'|'smile'|'open'|'o'} [mouth]
 * @property {[number, number]} [front] front paw relative to its shoulder
 * @property {[number, number]} [back]  back paw relative to its shoulder
 * @property {number} [tail]      tail sway in [-1, 1]
 * @property {boolean} [headphones]
 * @property {boolean} [beanie]
 * @property {boolean} [scarf]
 * @property {number} [blush]     0..1
 */

export function createCharacters() {
  const buf = new Uint8Array(W * H);

  const put = (x, y, c) => {
    const px = OX + Math.round(x);
    const py = OY + Math.round(y);
    if (px >= 0 && px < W && py >= 0 && py < H) buf[py * W + px] = c;
  };
  const fillRect = (x0, y0, w, h, c) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x0 + x, y0 + y, c);
  };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / (rx + 0.35)) ** 2 + ((y - cy) / (ry + 0.35)) ** 2 <= 1) put(x, y, c);
      }
    }
  };
  const stroke = (x0, y0, x1, y1, c, w = 2) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      fillRect(Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, c);
    }
  };
  const triangle = (ax, ay, bx, by, cx, cy, c) => {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const edge = (x0, y0, x1, y1, x, y) => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const e0 = edge(ax, ay, bx, by, x, y);
        const e1 = edge(bx, by, cx, cy, x, y);
        const e2 = edge(cx, cy, ax, ay, x, y);
        if ((e0 >= -0.5 && e1 >= -0.5 && e2 >= -0.5) || (e0 <= 0.5 && e1 <= 0.5 && e2 <= 0.5)) put(x, y, c);
      }
    }
  };

  /** Foot position for one leg in the walk cycle: planted half the time, swinging forward the other half. */
  function foot(phase) {
    const p = ((phase % 1) + 1) % 1;
    if (p < 0.5) return { x: 3 - (p / 0.5) * 6, lift: 0 };
    const s = (p - 0.5) / 0.5;
    return { x: -3 + s * 6, lift: Math.sin(Math.PI * s) * 2.2 };
  }

  /**
   * Draw a character at (x, y) on the canvas, y being the ground line.
   * Returns anchor points (paws, head) for props the caller draws.
   */
  function draw(canvas, species, x, y, facing, pose = {}) {
    const sp = SPECIES[species];
    buf.fill(CLEAR);
    const legs = pose.legs ?? 'stand';
    const seat = legs === 'sit' ? pose.seat ?? 6 : legs === 'sitGround' ? -3 : 0;
    const by = -seat + (pose.bob ?? 0); // body base offset
    const hx = 1 + (pose.headX ?? 0);
    const hy = by - 18 + (pose.headY ?? 0);

    // Tail, behind everything.
    const sway = pose.tail ?? 0;
    if (sp.tail === 'fox') {
      const tx = -9;
      const ty = by - 10 + sway * 1.5;
      stroke(-4, by - 6, -7, by - 7 + sway * 0.6, sp.fur, 4);
      stroke(-7, by - 7 + sway * 0.6, tx, ty, sp.fur, 4);
      ellipse(tx - 1, ty - 1, 2, 2, sp.light);
    } else if (sp.tail === 'puff') {
      ellipse(-6, by - 6, 2, 2, sp.light);
    }

    // Legs.
    const hipY = by - 5;
    const drawLeg = (hipX, footX, footY, c) => {
      stroke(hipX, hipY, footX, footY - 1, c, 2);
      fillRect(Math.round(footX) - 1, Math.round(footY) - 1, 3, 1, c);
    };
    if (legs === 'walk') {
      const step = pose.step ?? 0;
      const a = foot(step);
      const b = foot(step + 0.5);
      drawLeg(-1.5, -1.5 + b.x, -1 - b.lift, sp.dark);
      drawLeg(1.5, 1.5 + a.x, -1 - a.lift, sp.dark);
    } else if (legs === 'sit') {
      // Thighs along the seat, shins hanging (to the ground from a chair, or
      // swinging over the edge of a jetty).
      const swing = pose.dangle ?? 0;
      const shin = pose.shin ?? seat + 1;
      stroke(-1, by - 4, 3, by - 4, sp.dark, 2);
      stroke(3, by - 3, 3 + swing, by - 3 + shin, sp.dark, 2);
      stroke(1, by - 3, 5, by - 3, sp.fur, 2);
      stroke(5, by - 2, 5 - swing, by - 2 + shin, sp.fur, 2);
    } else if (legs === 'sitGround') {
      stroke(0, by - 2, 7, by - 1, sp.dark, 2);
      stroke(1, by - 1, 8, by, sp.fur, 2);
    } else {
      drawLeg(-1.5, -1.5, -1, sp.dark);
      drawLeg(1.5, 2, -1, sp.dark);
    }

    // Back arm, body, belly.
    const shoulderY = by - 11;
    const back = pose.back ?? [-2, 5];
    stroke(-2, shoulderY, -2 + back[0], shoulderY + back[1], sp.dark, 2);
    ellipse(-0.5, by - 8.5, 5, 4.5, sp.fur);
    ellipse(1.8, by - 7.5, 2.4, 3, sp.light);
    if (sp.bag) {
      stroke(3, shoulderY - 1, -4, by - 6, S.bag, 1);
      fillRect(-7, by - 8, 4, 4, S.bag);
      put(-5, by - 7, S.logo);
    }
    if (pose.scarf) {
      stroke(-4, by - 12, 5, by - 12, S.logo, 2);
      const flutter = Math.round(sway * 1.5);
      stroke(-4, by - 11, -9, by - 9 + flutter, S.logo, 2);
    }

    // Head, a beanie over it, ears through the beanie.
    ellipse(hx, hy, 7, 6, sp.fur);
    if (pose.beanie) {
      ellipse(hx, hy - 3, 6.5, 3.5, S.cream);
      fillRect(hx - 6, hy - 2, 13, 2, S.logo);
      ellipse(hx - 1, hy - 7, 1.5, 1.5, S.logo);
    }
    if (sp.ears === 'pointy') {
      triangle(hx - 6, hy - 3, hx - 2, hy - 5, hx - 5, hy - 10, sp.fur);
      triangle(hx + 1, hy - 5, hx + 5, hy - 4, hx + 3, hy - 11, sp.fur);
      put(hx - 4, hy - 6, sp.dark);
      put(hx - 4, hy - 7, sp.dark);
      put(hx + 3, hy - 7, sp.dark);
      put(hx + 3, hy - 8, sp.dark);
    } else if (sp.ears === 'long') {
      const flop = Math.round(sway);
      stroke(hx - 3, hy - 5, hx - 4 - flop, hy - 14, sp.fur, 3);
      stroke(hx + 2, hy - 5, hx + 2 - flop, hy - 15, sp.fur, 3);
      stroke(hx + 2, hy - 7, hx + 2 - flop, hy - 13, sp.light, 1);
    } else if (sp.ears === 'round') {
      ellipse(hx - 4, hy - 5, 2, 2, sp.fur);
      ellipse(hx + 3, hy - 6, 2, 2, sp.fur);
      put(hx + 3, hy - 6, sp.dark);
    }

    // Face: the muzzle points the way the character faces.
    ellipse(hx + 3.5, hy + 2.2, 3.6, 2.6, sp.light);
    put(hx + 7, hy + 1, S.ink);
    put(hx + 7, hy + 2, S.ink);
    const eye = (ex, ey) => {
      const look = pose.eyes ?? 'open';
      switch (look) {
        case 'blink':
        case 'closed':
          put(ex, ey, S.ink);
          put(ex + 1, ey, S.ink);
          break;
        case 'happy':
          put(ex - 1, ey, S.ink);
          put(ex, ey - 1, S.ink);
          put(ex + 1, ey, S.ink);
          break;
        case 'focus':
          put(ex, ey - 1, S.ink);
          put(ex + 1, ey - 1, S.ink);
          put(ex, ey, S.ink);
          break;
        case 'wide':
          fillRect(ex, ey - 1, 2, 2, S.ink);
          break;
        case 'up':
          put(ex, ey - 2, S.ink);
          put(ex, ey - 1, S.ink);
          break;
        case 'side':
          put(ex - 1, ey - 1, S.ink);
          put(ex - 1, ey, S.ink);
          break;
        default:
          put(ex, ey - 1, S.ink);
          put(ex, ey, S.ink);
      }
    };
    eye(hx + 3, hy - 1);
    eye(hx - 1, hy - 1);
    if ((pose.blush ?? 0.6) > 0.3) {
      put(hx - 2, hy + 2, S.blush);
      put(hx - 3, hy + 2, S.blush);
    }
    const mouth = pose.mouth ?? 'smile';
    if (mouth === 'smile') {
      put(hx + 5, hy + 4, S.ink);
      put(hx + 4, hy + 4, S.outline);
    } else if (mouth === 'open') {
      fillRect(hx + 4, hy + 3, 2, 2, S.outline);
      put(hx + 4, hy + 4, S.blush);
    } else if (mouth === 'o') {
      fillRect(hx + 5, hy + 3, 2, 2, S.ink);
    }

    if (pose.headphones) {
      stroke(hx - 6, hy - 1, hx - 5, hy - 6, S.ink, 1);
      stroke(hx - 5, hy - 6, hx - 1, hy - 8, S.ink, 1);
      stroke(hx - 1, hy - 8, hx + 2, hy - 7, S.ink, 1);
      fillRect(hx - 8, hy - 2, 3, 5, S.ink);
      put(hx - 7, hy, S.logo);
    }

    // Front arm and paw, over the body.
    const front = pose.front ?? [2, 5];
    stroke(3, shoulderY, 3 + front[0], shoulderY + front[1], sp.fur, 2);
    fillRect(Math.round(3 + front[0]) - 1, Math.round(shoulderY + front[1]) - 1, 2, 2, sp.light);

    // Outline everything drawn, then stamp onto the frame.
    for (let py = 1; py < H - 1; py++) {
      for (let px = 1; px < W - 1; px++) {
        const i = py * W + px;
        if (buf[i] !== CLEAR) continue;
        if (buf[i - 1] < 254 || buf[i + 1] < 254 || buf[i - W] < 254 || buf[i + W] < 254) buf[i] = 254;
      }
    }
    for (let py = 0; py < H; py++) {
      const cy = y - OY + py;
      if (cy < 0 || cy >= 360) continue;
      for (let px = 0; px < W; px++) {
        let v = buf[py * W + px];
        if (v === CLEAR) continue;
        if (v === 254) v = S.outline;
        canvas.set(facing > 0 ? x - OX + px : x + OX - px, cy, v);
      }
    }
    const at = (dx, dy) => [x + facing * dx, y + dy];
    return {
      frontPaw: at(3 + front[0], shoulderY + front[1]),
      backPaw: at(-2 + back[0], shoulderY + back[1]),
      head: at(hx, hy),
      top: at(hx, hy - 11),
    };
  }

  return { draw };
}
