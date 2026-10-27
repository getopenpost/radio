// The characters: a small postal fox in OpenPost's orange-brown (the host of
// the stream), and friends who share the same build (a bunny, a bear). They
// are drawn from simple shapes each frame into a little buffer, outlined, then
// stamped onto the frame (optionally rotated, for push-ups and handstands), so
// any pose, outfit or prop costs the same. Activities that need hands planted
// on a bar or the ground leave the arms off and draw them with `arm`, which
// bends the elbow to reach.
import { S, CLEAR } from './palette.js';

const W = 64;
const H = 64;
const OX = 32; // origin: the ground point under the body
const OY = 58;
const PIVOT = [0, -9]; // rotation happens around the middle of the body by default
export const UPPER_ARM = 7;
export const FOREARM = 7;

export const SPECIES = {
  fox: { fur: S.fur, dark: S.furDark, light: S.cream, ears: 'pointy', tail: 'fox', bag: true },
  bunny: { fur: S.bunny, dark: S.bunnyDark, light: S.cream, ears: 'long', tail: 'puff', bag: false },
  bear: { fur: S.bear, dark: S.bearDark, light: S.bunnyDark, ears: 'round', tail: 'none', bag: false },
};

/**
 * A pose. Every field is optional.
 * @typedef {object} Pose
 * @property {'stand'|'walk'|'sit'|'sitGround'|'hang'|'tuck'|'plank'} [legs]
 * @property {number} [reach]     for 'plank': how far forward the toes are (they meet the ground when turned for a push-up)
 * @property {number} [step]      walk phase in [0, 1), one full stride per unit
 * @property {number} [seat]      seat height in pixels when sitting
 * @property {number} [shin]      shin length when sitting (defaults to reaching the ground)
 * @property {number} [dangle]    shin swing when sitting or hanging
 * @property {number} [bob]       body offset in pixels (negative is up)
 * @property {number} [headX]     head offset, e.g. leaning in
 * @property {number} [headY]
 * @property {'open'|'blink'|'happy'|'closed'|'focus'|'wide'|'up'|'side'} [eyes]
 * @property {'none'|'smile'|'open'|'o'} [mouth]
 * @property {'back'} [ears]      ears laid flat along the head (and no pompom), for handstands
 * @property {[number, number]} [front] front paw relative to its shoulder
 * @property {[number, number]} [back]  back paw relative to its shoulder
 * @property {number} [tail]      tail sway in [-1, 1]
 * @property {boolean} [headphones]
 * @property {boolean} [winter]   knitted beanie and striped scarf
 * @property {boolean} [scarf]    just the scarf (flying)
 * @property {boolean} [raincoat] a hooded raincoat
 * @property {number} [umbrella]  hold an umbrella up in the front paw, leaning this much (radians, + is forwards)
 * @property {'aviator'|'witch'} [cap] a flying cap with goggles, or a pointed hat
 * @property {boolean} [sweat]    a drop of sweat after effort
 * @property {number} [angle]     rotate clockwise by this many radians (a push-up lies near PI/2, a handstand at PI)
 * @property {[number, number]} [pivot] the local point the rotation turns about (default the middle of the body)
 * @property {boolean} [arms]     false leaves the arms off, for the caller to draw with `arm`
 * @property {number} [blush]     0..1
 * @property {number} [nod]       turn the head clockwise about its centre, relative to the body (radians)
 */

export function createCharacters() {
  const buf = new Uint8Array(W * H);
  const headBuf = new Uint8Array(W * H); // the head, when it turns apart from the body
  let target = buf;

  const put = (x, y, c) => {
    const px = OX + Math.round(x);
    const py = OY + Math.round(y);
    if (px >= 0 && px < W && py >= 0 && py < H) target[py * W + px] = c;
  };
  const fillRect = (x0, y0, w, h, c) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x0 + x, y0 + y, c);
  };
  const ellipse = (cx, cy, rx, ry, c, keep = null) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / (rx + 0.35)) ** 2 + ((y - cy) / (ry + 0.35)) ** 2 <= 1 && (!keep || keep(x, y))) put(x, y, typeof c === 'function' ? c(x, y) : c);
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

  /** The shaft of an umbrella held at (px, py), with a small hooked handle under the paw. */
  function umbrellaShaft(px, py, top, lean) {
    const cx = px + Math.sin(lean) * (py - top);
    stroke(px, py, cx, top + 1, S.ink, 1);
    put(px, py + 1, S.ink);
    put(px - 1, py + 2, S.ink);
  }

  /** The canopy: ribbed panels with a scalloped hem, leaning by `lean` radians. */
  function umbrella(px, py, top, lean) {
    const cx = px + Math.sin(lean) * (py - top);
    const cy = top;
    const rx = 12.5;
    const ry = 6;
    const cos = Math.cos(lean);
    const sin = Math.sin(lean);
    for (let y = Math.floor(cy - rx); y <= Math.ceil(cy + rx); y++) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        const u = (x - cx) * cos + (y - cy) * sin;
        const v = -(x - cx) * sin + (y - cy) * cos;
        if (v > 0.6 || (u / rx) ** 2 + (v / ry) ** 2 > 1) continue;
        const panel = Math.floor((u + rx) / ((2 * rx) / 5));
        const inPanel = ((u + rx) % ((2 * rx) / 5)) / ((2 * rx) / 5);
        if (v > -0.6 && (inPanel < 0.2 || inPanel > 0.8)) continue; // scallops between the ribs
        put(x, y, panel % 2 ? S.knitDark : S.knit);
      }
    }
    put(Math.round(cx - sin * (ry + 1)), Math.round(cy - cos * (ry + 1)), S.ink);
  }

  /**
   * Draw a character at (x, y) on the canvas, y being the ground line.
   * Returns anchor points (paws, head) for props the caller draws.
   */
  function draw(canvas, species, x, y, facing, pose = {}) {
    x = Math.round(x);
    y = Math.round(y);
    const sp = SPECIES[species];
    buf.fill(CLEAR);
    const legs = pose.legs ?? 'stand';
    const seat = legs === 'sit' ? pose.seat ?? 6 : 0;
    // Sitting puts the bottom on the seat; sitting on the ground drops it to the ground.
    const by = (legs === 'sit' ? -seat + 3 : legs === 'sitGround' ? 3 : 0) + (pose.bob ?? 0);
    const hx = 1 + (pose.headX ?? 0);
    const hy = by - 18 + (pose.headY ?? 0);
    const coat = pose.raincoat;
    const sleeve = coat ? S.raincoat : sp.fur;
    const sleeveBack = coat ? S.raincoatDark : sp.dark;

    // Tail, behind everything.
    const sway = pose.tail ?? 0;
    if (sp.tail === 'fox' && legs === 'plank') {
      // Lying along the legs.
      stroke(-4, by - 6, -5, by - 1, sp.fur, 4);
      stroke(-5, by - 1, -4, by + 3, sp.fur, 3);
      ellipse(-4, by + 3, 1.5, 1.5, sp.light);
    } else if (sp.tail === 'fox') {
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
      // Thighs along the seat, shins hanging to the ground (or over an edge).
      const swing = pose.dangle ?? 0;
      const shin = pose.shin ?? Math.max(1, seat - 2);
      stroke(-1, by - 4, 3, by - 4, sp.dark, 2);
      stroke(3, by - 3, 3 + swing, by - 3 + shin, sp.dark, 2);
      stroke(1, by - 3, 5, by - 3, sp.fur, 2);
      stroke(5, by - 2, 5 - swing, by - 2 + shin, sp.fur, 2);
    } else if (legs === 'sitGround') {
      stroke(0, by - 2, 7, by - 1, sp.dark, 2);
      stroke(1, by - 1, 8, by, sp.fur, 2);
    } else if (legs === 'hang') {
      // Straight down, feet together, swinging a little.
      const swing = pose.dangle ?? 0;
      stroke(-1, hipY, -1 + swing, hipY + 7, sp.dark, 2);
      stroke(1.5, hipY, 1.5 + swing, hipY + 7, sp.fur, 2);
    } else if (legs === 'plank') {
      // Long straight legs in line with the body, toes at local y 7: rotated
      // about the toes this is a push-up plank.
      stroke(-1, hipY, -1, hipY + 11, sp.dark, 2);
      stroke(1.5, hipY, 1.5, hipY + 11, sp.fur, 2);
      fillRect(1, hipY + 11, 2, 1, sp.dark);
    } else if (legs === 'tuck') {
      // Knees bent, shins crossed behind (as on a dip bar).
      stroke(-1, hipY, 0, hipY + 4, sp.dark, 2);
      stroke(0, hipY + 4, -4, hipY + 6, sp.dark, 2);
      stroke(1.5, hipY, 2, hipY + 4, sp.fur, 2);
      stroke(2, hipY + 4, -2, hipY + 7, sp.fur, 2);
    } else {
      drawLeg(-1.5, -1.5, -1, sp.dark);
      drawLeg(1.5, 2, -1, sp.dark);
    }

    // Back arm, body, belly.
    const shoulderY = by - 11;
    const arms = pose.arms !== false;
    const back = pose.back ?? [-2, 5];
    if (arms) stroke(-2, shoulderY, -2 + back[0], shoulderY + back[1], sleeveBack, 2);
    ellipse(-0.5, by - 8.5, 5, 4.5, sp.fur);
    ellipse(1.8, by - 7.5, 2.4, 3, sp.light);
    if (coat) {
      // A hooded raincoat down to the hips, buttoned at the front.
      ellipse(-0.3, by - 8, 5.6, 5, S.raincoat);
      for (let yy = by - 11; yy <= by - 5; yy += 2) put(3, yy, S.raincoatDark);
      fillRect(-5, by - 4, 11, 1, S.raincoatDark);
    }
    if (sp.bag && !coat) {
      stroke(3, shoulderY - 1, -4, by - 6, S.bag, 1);
      fillRect(-7, by - 8, 4, 4, S.bag);
      put(-5, by - 7, S.logo);
    }
    if (pose.winter || pose.scarf) {
      // A striped knitted scarf: wrapped twice, one end hanging at the front.
      for (let xx = -4; xx <= 5; xx++) for (const yy of [by - 13, by - 12]) put(xx, yy, (xx + 10) % 4 < 2 ? S.knit : S.cream);
      const flutter = Math.round(sway);
      for (let k = 0; k < 6; k++) {
        const c = k % 3 === 2 ? S.cream : S.knit;
        put(3, by - 11 + k, c);
        put(4, by - 11 + k + (k > 3 ? flutter : 0), c);
      }
      put(3, by - 4, S.cream);
      put(5, by - 4 + flutter, S.cream);
    }

    // Head, then whatever covers it, then the ears unless covered. A nodding
    // head is drawn on its own and turned into place.
    const nod = pose.nod ?? 0;
    if (nod) {
      headBuf.fill(CLEAR);
      target = headBuf;
    }
    ellipse(hx, hy, 7, 6, sp.fur);
    const covered = pose.winter || coat || pose.cap === 'witch';
    if (pose.cap === 'aviator') {
      // Leather cap with goggles pushed up on the forehead.
      ellipse(hx, hy - 3, 6.8, 3.8, S.bag);
      fillRect(hx - 7, hy - 2, 2, 5, S.bag);
      fillRect(hx - 6, hy - 3, 13, 1, S.ink);
      fillRect(hx + 1, hy - 4, 3, 3, S.paper);
      fillRect(hx + 4, hy - 4, 3, 3, S.paper);
      put(hx + 2, hy - 3, S.screen);
      put(hx + 5, hy - 3, S.screen);
    }
    if (pose.winter && !coat && !pose.cap) {
      // A knitted beanie pulled over the ears (two soft bumps show where they are), a ribbed cuff and a pompom.
      // It sits on the forehead, above the eyes.
      ellipse(hx, hy - 4.5, 7.2, 4.8, S.knit, (xx, yy) => yy <= hy - 4);
      if (sp.ears === 'pointy' && pose.ears !== 'back') {
        ellipse(hx - 4, hy - 8.5, 2.2, 2.4, S.knit);
        ellipse(hx + 3, hy - 9, 2.2, 2.4, S.knit);
      }
      for (let xx = -7; xx <= 7; xx++) put(hx + xx, hy - 4, (xx + 20) % 2 ? S.knitDark : S.knit);
      for (let xx = -7; xx <= 7; xx++) put(hx + xx, hy - 3, S.knitDark);
      if (pose.ears !== 'back') ellipse(hx - 0.5, hy - 11, 1.8, 1.6, S.cream);
    }
    if (coat) {
      // The hood over the head with a rim around the face.
      ellipse(hx - 0.5, hy - 1, 7.6, 6.2, S.raincoat, (xx, yy) => yy <= hy + 1 && !(xx > hx + 1 && yy > hy - 3));
      stroke(hx + 2, hy - 6, hx + 7, hy - 1, S.raincoatDark, 1);
    }
    if (!covered && sp.ears === 'pointy' && pose.ears === 'back') {
      // Ears laid flat along the head (upside down, so they clear the floor).
      triangle(hx - 3, hy - 4, hx + 1, hy - 6, hx - 9, hy - 5, sp.fur);
      triangle(hx - 1, hy - 5, hx + 3, hy - 6, hx - 6, hy - 6, sp.fur);
      put(hx - 4, hy - 5, sp.dark);
      put(hx - 5, hy - 5, sp.dark);
    } else if (!covered && sp.ears === 'pointy') {
      triangle(hx - 6, hy - 3, hx - 2, hy - 5, hx - 5, hy - 10, sp.fur);
      triangle(hx + 1, hy - 5, hx + 5, hy - 4, hx + 3, hy - 11, sp.fur);
      put(hx - 4, hy - 6, sp.dark);
      put(hx - 4, hy - 7, sp.dark);
      put(hx + 3, hy - 7, sp.dark);
      put(hx + 3, hy - 8, sp.dark);
    } else if (sp.ears === 'long' && !pose.winter) {
      // Long ears poke out of a hood too.
      const flop = Math.round(sway);
      stroke(hx - 3, hy - 5, hx - 4 - flop, hy - 14, sp.fur, 3);
      stroke(hx + 2, hy - 5, hx + 2 - flop, hy - 15, sp.fur, 3);
      stroke(hx + 2, hy - 7, hx + 2 - flop, hy - 13, sp.light, 1);
    } else if (!covered && sp.ears === 'round') {
      ellipse(hx - 4, hy - 5, 2, 2, sp.fur);
      ellipse(hx + 3, hy - 6, 2, 2, sp.fur);
      put(hx + 3, hy - 6, sp.dark);
    }

    // Face: the muzzle points the way the character faces.
    ellipse(hx + 3.5, hy + 2.2, 3.6, 2.6, sp.light);
    put(hx + 7, hy + 1, S.ink);
    put(hx + 7, hy + 2, S.ink);
    const eye = (ex, ey) => {
      switch (pose.eyes ?? 'open') {
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
    if (pose.sweat) {
      put(hx - 6, hy - 2, S.screen);
      put(hx - 6, hy - 1, S.screen);
      put(hx - 7, hy - 1, S.screen);
    }

    if (pose.cap === 'witch') {
      // A wide brim and a tall crooked cone, the tip bent back by the wind.
      const bend = Math.round(sway * 1.2);
      fillRect(hx - 9, hy - 5, 19, 2, S.hat);
      triangle(hx - 5, hy - 5, hx + 5, hy - 5, hx - 2, hy - 14, S.hat);
      triangle(hx - 3, hy - 13, hx - 1, hy - 13, hx - 6 - bend, hy - 18, S.hat);
      fillRect(hx - 4, hy - 7, 9, 2, S.logo);
    }

    if (pose.headphones) {
      stroke(hx - 6, hy - 1, hx - 5, hy - 6, S.ink, 1);
      stroke(hx - 5, hy - 6, hx - 1, hy - 8, S.ink, 1);
      stroke(hx - 1, hy - 8, hx + 2, hy - 7, S.ink, 1);
      fillRect(hx - 8, hy - 2, 3, 5, S.ink);
      put(hx - 7, hy, S.logo);
    }
    if (nod) {
      target = buf;
      const cos = Math.cos(nod);
      const sin = Math.sin(nod);
      for (let ly = -16; ly <= 16; ly++) {
        for (let lx = -16; lx <= 16; lx++) {
          // Inverse turn back into the upright head.
          const ux = Math.round(cos * lx + sin * ly + hx);
          const uy = Math.round(-sin * lx + cos * ly + hy);
          const bx = OX + ux;
          const byy = OY + uy;
          if (bx < 0 || bx >= W || byy < 0 || byy >= H) continue;
          const v = headBuf[byy * W + bx];
          if (v !== CLEAR) put(hx + lx, hy + ly, v);
        }
      }
    }

    // Front arm and paw, over the body; holding an umbrella, the paw is up
    // beside the head with the shaft rising from it.
    const front = pose.umbrella != null ? [5, -8] : pose.front ?? [2, 5];
    if (pose.umbrella != null) umbrellaShaft(3 + front[0], shoulderY + front[1], hy - 15, pose.umbrella);
    if (arms) {
      stroke(3, shoulderY, 3 + front[0], shoulderY + front[1], sleeve, 2);
      fillRect(Math.round(3 + front[0]) - 1, Math.round(shoulderY + front[1]) - 1, 2, 2, sp.light);
    }
    if (pose.umbrella != null) umbrella(3 + front[0], shoulderY + front[1], hy - 15, pose.umbrella);

    // Outline everything drawn, then stamp onto the frame, turned if asked.
    for (let py = 1; py < H - 1; py++) {
      for (let px = 1; px < W - 1; px++) {
        const i = py * W + px;
        if (buf[i] !== CLEAR) continue;
        if (buf[i - 1] < 254 || buf[i + 1] < 254 || buf[i - W] < 254 || buf[i + W] < 254) buf[i] = 254;
      }
    }
    const turn = transform(pose);
    const place = (dx, dy) => {
      const [rx, ry] = turn(dx, dy);
      return [x + facing * rx, y + ry];
    };
    const angle = pose.angle ?? 0;
    if (!angle) {
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          let v = buf[py * W + px];
          if (v === CLEAR) continue;
          if (v === 254) v = S.outline;
          canvas.set(x + facing * (px - OX), y + py - OY, v);
        }
      }
    } else {
      // Rotated: walk the screen around the figure and sample back into the buffer.
      const [ppx, ppy] = pose.pivot ?? PIVOT;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const [cx, cy] = turn(ppx, ppy);
      const reach = 46;
      for (let sy = -reach; sy <= reach; sy++) {
        for (let sx = -reach; sx <= reach; sx++) {
          const qx = sx + cx - ppx;
          const qy = sy + cy - ppy;
          // Inverse rotation of (q - pivot) back to the upright figure.
          const lx = Math.round(cos * qx + sin * qy + ppx);
          const ly = Math.round(-sin * qx + cos * qy + ppy);
          const bx = lx + OX;
          const byy = ly + OY;
          if (bx < 0 || bx >= W || byy < 0 || byy >= H) continue;
          let v = buf[byy * W + bx];
          if (v === CLEAR) continue;
          if (v === 254) v = S.outline;
          canvas.set(x + facing * (sx + cx), y + sy + cy, v);
        }
      }
    }
    return {
      frontPaw: place(3 + front[0], shoulderY + front[1]),
      backPaw: place(-2 + back[0], shoulderY + back[1]),
      frontShoulder: place(3, shoulderY),
      backShoulder: place(-2, shoulderY),
      head: place(hx, hy),
      top: place(hx + Math.sin(nod) * 11, hy - Math.cos(nod) * 11),
      place,
    };
  }

  /** Where a local point of a figure in this pose lands, relative to its origin and before facing. */
  function transform(pose) {
    const angle = pose.angle ?? 0;
    if (!angle) return (dx, dy) => [dx, dy];
    const [px, py] = pose.pivot ?? PIVOT;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return (dx, dy) => [cos * (dx - px) - sin * (dy - py) + px, sin * (dx - px) + cos * (dy - py) + py];
  }

  /** Local shoulder positions for a pose (front, back), before rotation. */
  function shoulders(pose = {}) {
    const legs = pose.legs ?? 'stand';
    const seat = legs === 'sit' ? pose.seat ?? 6 : 0;
    const by = (legs === 'sit' ? -seat + 3 : legs === 'sitGround' ? 3 : 0) + (pose.bob ?? 0);
    return { front: [3, by - 11], back: [-2, by - 11] };
  }

  /**
   * An arm from a shoulder to a hand on screen, the elbow bending to the side
   * given (+1 or -1, relative to the shoulder-to-hand direction) when the hand
   * is closer than full reach. Drawn with an outline; the paw at the hand.
   */
  function arm(canvas, species, shoulder, hand, bend, { back = false, upper = UPPER_ARM, fore = FOREARM } = {}) {
    const sp = SPECIES[species];
    const UPPER = upper;
    const FORE = fore;
    const [sx, sy] = shoulder;
    let [hx, hy] = hand;
    let dx = hx - sx;
    let dy = hy - sy;
    let d = Math.hypot(dx, dy);
    const reach = UPPER + FORE;
    if (d > reach) {
      hx = sx + (dx / d) * reach;
      hy = sy + (dy / d) * reach;
      dx = hx - sx;
      dy = hy - sy;
      d = reach;
    }
    // Two-bone reach: the elbow sits off the line, by how much the arm is folded.
    const along = (UPPER * UPPER - FORE * FORE + d * d) / (2 * Math.max(d, 0.001));
    const off = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
    const ux = dx / Math.max(d, 0.001);
    const uy = dy / Math.max(d, 0.001);
    const ex = sx + ux * along - uy * off * bend;
    const ey = sy + uy * along + ux * off * bend;
    const line = (x0, y0, x1, y1, c, w) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let i = 0; i <= n; i++) {
        const px = Math.round(x0 + ((x1 - x0) * i) / n - (w - 1) / 2);
        const py = Math.round(y0 + ((y1 - y0) * i) / n - (w - 1) / 2);
        canvas.rect(px, py, w, w, c);
      }
    };
    const c = back ? sp.dark : sp.fur;
    line(sx, sy, ex, ey, S.outline, 4);
    line(ex, ey, hx, hy, S.outline, 4);
    line(sx, sy, ex, ey, c, 2);
    line(ex, ey, hx, hy, c, 2);
    canvas.rect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, S.outline);
    canvas.rect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2, sp.light);
    return [ex, ey];
  }

  return { draw, transform, shoulders, arm };
}
