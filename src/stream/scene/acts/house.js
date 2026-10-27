// Going indoors. A cottage straddles the path; the fox stops at its left
// door, steps in, and the front wall dissolves through the dither so we see
// inside. In the studio it works at a desk under the window; at home, on
// cold days, it curls up in an armchair by the fire. When it is time to go,
// it walks out through the right door as the wall dissolves back.
import { maskSprite } from '../canvas.js';
import { bayer } from '../dither.js';
import { S } from '../palette.js';
import { convergeMask } from '../props.js';
import { above, book, laptop, panel } from '../pov.js';
import { revealCoverage, viewAmount } from '../motion.js';
import { BOOK, drawFire, MUG, seg, steam, walkTo } from './common.js';

const LEFT = -14; // outer walls, in set coordinates
const RIGHT = 112;
const TOP = 60; // wall height
const RIDGE = 86;
const DOOR_IN = 0; // left door spans DOOR_IN..DOOR_IN + 12
const DOOR_OUT = 96;
const EXIT = 120; // where the fox is outside again
const POSTER = maskSprite(convergeMask(8), S.logo);
const SIGN = maskSprite(convergeMask(7), S.logo);

/** How far the front wall has dissolved (0 solid, 1 gone), from where the fox is. */
const cutaway = (fox) => Math.min(seg(fox, 8, 26), 1 - seg(fox, 76, 94));

function interiorShell(canvas, X, Y) {
  // Back wall with a wainscot, a ceiling beam, and a plank floor.
  for (let y = Y - TOP + 2; y < Y; y++) {
    for (let x = X + LEFT + 4; x < X + RIGHT - 4; x++) {
      const low = y > Y - 14;
      canvas.set(x, y, low ? ((x - X) % 8 === 0 ? S.door : S.interiorShade) : (x + y) % 9 === 0 && y % 3 === 0 ? S.interiorShade : S.interior);
    }
  }
  canvas.rect(X + LEFT + 4, Y - 15, RIGHT - LEFT - 8, 1, S.door);
  canvas.rect(X + LEFT + 4, Y - TOP + 2, RIGHT - LEFT - 8, 3, S.trunk);
  for (let x = X + LEFT + 4; x < X + RIGHT - 4; x++) {
    canvas.set(x, Y, (x - X) % 11 === 0 ? S.door : S.floor);
    canvas.set(x, Y + 1, S.door);
  }
}

/** A window in the back wall: the outside shows through (sky, rain or snow). */
function backWindow(canvas, x0, y0, w, h, outside) {
  canvas.rect(x0 - 2, y0 - 2, w + 4, h + 4, S.trunk);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x0 + x;
      const py = y0 + y;
      canvas.set(px, py, outside.data[(py - outside.top) * outside.width + px - outside.left]);
    }
  }
  canvas.rect(x0 + Math.floor(w / 2), y0, 1, h, S.trunk);
  canvas.rect(x0, y0 + Math.floor(h / 2), w, 1, S.trunk);
  canvas.rect(x0 - 3, y0 + h + 2, w + 6, 1, S.door);
}

function bookshelf(canvas, x0, Y, w, h) {
  canvas.rect(x0, Y - h, w, h, S.trunk);
  const colors = [S.logo, S.knit, S.paper, S.bag, S.fur, S.knitDark, S.cream];
  for (let shelf = 0; shelf < Math.floor(h / 9); shelf++) {
    const sy = Y - h + 2 + shelf * 9;
    canvas.rect(x0 + 1, sy, w - 2, 7, S.interiorShade);
    for (let x = x0 + 2, k = shelf * 3; x < x0 + w - 2; x += 2, k++) {
      const bh = 4 + ((k * 7) % 3);
      canvas.rect(x, sy + 7 - bh, 2, bh, colors[k % colors.length]);
    }
  }
}

/** A wall clock showing the real time. */
function clock(canvas, cx, cy, hours) {
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) canvas.set(cx + x, cy + y, x * x + y * y > 11 ? S.trunk : S.paper);
  const h = ((hours % 12) / 12) * Math.PI * 2;
  const m = (hours % 1) * Math.PI * 2;
  canvas.line(cx, cy, Math.round(cx + Math.sin(h) * 2), Math.round(cy - Math.cos(h) * 2), S.ink);
  canvas.line(cx, cy, Math.round(cx + Math.sin(m) * 3), Math.round(cy - Math.cos(m) * 3), S.ink);
}

/** The front of the cottage: siding, windows, doors (open or shut), lamp, roof. */
function facade(canvas, X, Y, { kind, cut, leftOpen, rightOpen, light, season, glows, time }) {
  const winter = season === 'winter';
  // Walls, dissolving away as the fox goes in (the dither anchored to the house).
  for (let y = Y - TOP; y < Y; y++) {
    for (let x = X + LEFT; x < X + RIGHT; x++) {
      const lx = x - X;
      const post = lx < LEFT + 4 || lx >= RIGHT - 4;
      if (!post && cut > 0 && bayer(lx, y - Y) < revealCoverage(lx - LEFT, RIGHT - LEFT, cut, 8)) continue;
      const doorIn = lx >= DOOR_IN && lx < DOOR_IN + 12 && y >= Y - 24;
      const doorOut = lx >= DOOR_OUT && lx < DOOR_OUT + 12 && y >= Y - 24;
      if ((doorIn && leftOpen) || (doorOut && rightOpen)) continue;
      let c = post ? S.trunk : (y - Y) % 5 === 0 ? S.wallShade : S.wall;
      if (y > Y - 4 && !post) c = (lx + (y % 2) * 3) % 6 < 3 ? S.pathEdge : S.hill1;
      if (doorIn || doorOut) {
        const dl = lx - (doorIn ? DOOR_IN : DOOR_OUT);
        c = dl === 0 || dl === 11 || y === Y - 24 ? S.trunk : (dl === 3 || dl === 8) && y > Y - 20 && y < Y - 4 ? S.bag : S.door;
        if (dl === 9 && y === Y - 12) c = S.brass;
      }
      canvas.set(x, y, c);
    }
  }
  // Open doors: the dark doorway edge and the door swung in against the frame.
  for (const [open, at] of [[leftOpen, DOOR_IN], [rightOpen, DOOR_OUT]]) {
    if (!open) continue;
    canvas.rect(X + at - 1, Y - 25, 14, 1, S.trunk);
    canvas.rect(X + at - 1, Y - 24, 1, 24, S.trunk);
    canvas.rect(X + at + 12, Y - 24, 1, 24, S.trunk);
    canvas.rect(X + at + 9, Y - 24, 3, 24, S.door);
  }
  // Two front windows with flower boxes, lit from inside after dark.
  if (cut < 1) {
    for (const wx of [22, 64]) {
      const x0 = X + wx;
      const y0 = Y - 44;
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 16; x++) {
          if (cut > 0 && bayer(wx + x, y0 - Y + y) < revealCoverage(wx + x - LEFT, RIGHT - LEFT, cut, 8)) continue;
          const frame = x === 0 || x === 15 || y === 0 || y === 13 || x === 7 || y === 6;
          const glint = light > 0.5 && (x + y === 5 || x + y === 6) && x < 7;
          canvas.set(x0 + x, y0 + y, frame ? S.trunk : glint ? S.paper : S.window);
        }
      }
      if (cut < 0.5) {
        canvas.rect(x0 - 1, y0 + 14, 18, 3, S.bag);
        for (let k = 0; k < 6; k++) canvas.set(x0 + 1 + k * 3, y0 + 13, k % 2 ? S.leaf0 : season === 'winter' ? S.snow : S.flower);
      }
      if (light < 0.5) glows.push({ x: x0 + 8, y: Y - 2, r: 18, strength: 0.7 * (1 - light * 2), squash: 0.35 });
    }
  }
  // Lamp by the door, and a sign: the post office mark for the studio. Both go with the wall.
  if (cut > 0.5) return roof(canvas, X, Y, { kind, winter, light, time });
  canvas.rect(X - 6, Y - 30, 1, 6, S.ink);
  canvas.rect(X - 8, Y - 31, 5, 2, S.ink);
  canvas.rect(X - 7, Y - 29, 3, 2, light < 0.6 ? S.lampLight : S.paper);
  if (light < 0.6) glows.push({ x: X - 6, y: Y - 26, r: 22, strength: 0.8 * (1 - light), squash: 0.8 });
  if (kind === 'work') {
    canvas.rect(X + 15, Y - 32, 11, 9, S.paper);
    canvas.draw(SIGN, X + 17, Y - 31);
  }

  roof(canvas, X, Y, { kind, winter, light, time });
}

/** Shingle rows from the eaves up to the ridge (snow on top in winter), and the chimney. */
function roof(canvas, X, Y, { kind, winter, light, time }) {
  for (let y = 0; y < RIDGE - TOP; y++) {
    const inset = Math.round(y * 0.75);
    const yy = Y - TOP - 1 - y;
    for (let x = X + LEFT - 8 + inset; x < X + RIGHT + 8 - inset; x++) {
      const row = Math.floor(y / 3);
      const seam = y % 3 === 0 || (x - X + row * 3) % 6 === 0;
      let c = seam ? S.roofShade : S.roof;
      if (winter && y > RIDGE - TOP - 6) c = S.snow;
      else if (winter && y > RIDGE - TOP - 9 && bayer(x, yy) < 0.5) c = S.snow;
      canvas.set(x, yy, c);
    }
  }
  canvas.rect(X + LEFT - 9, Y - TOP, RIGHT - LEFT + 18, 2, S.trunk);
  // Chimney, smoking when the fire is lit or it is cold.
  canvas.rect(X + 82, Y - RIDGE - 4, 9, 18, S.pathEdge);
  for (let y = Y - RIDGE - 4; y < Y - RIDGE + 14; y += 3) canvas.rect(X + 82 + ((y / 3) % 2 ? 0 : 4), y, 1, 3, S.hill1);
  canvas.rect(X + 81, Y - RIDGE - 5, 11, 2, S.ink);
  if (kind === 'home' || winter || light < 0.5) {
    for (let i = 0; i < 8; i++) {
      const age = (time * 0.2 + i / 8) % 1;
      const px = Math.round(X + 86 + age * 10 + Math.sin(age * 5 + i) * 2);
      const py = Math.round(Y - RIDGE - 7 - age * 30);
      if (bayer(px, py) < 0.8 - age * 0.6) canvas.set(px, py, S.smoke);
    }
  }
}

function makeHouse(kind) {
  const seatX = kind === 'work' ? 44 : 40;
  return {
    spec: { anchored: true, extent: [LEFT - 10, EXIT + 10], intro: 6, outro: 14, light: 'any', indoors: true, frameAt: kind === 'home' ? 88 : undefined },
    draw(c) {
      const { canvas, X, Y, t, out, time, beat, light, season, glows, state, hours } = c;
      const fox = c.foxX - X; // where the fox is in the set
      const cut = t < 0 ? 0 : cutaway(fox);
      const leftOpen = fox > -6 && fox < 18;
      const rightOpen = fox > 86 && fox < EXIT - 4;
      const inFront = fox >= 6 && fox <= DOOR_OUT + 8;

      // Inside, drawn when the wall has started to go.
      const lamp = light < 0.7;
      if (cut > 0) {
        // The panes are holes through to this same frame, including the real
        // stars, hills and precipitation behind the house. No second sky.
        state.backdrop ??= new Uint8Array((RIGHT - LEFT) * TOP);
        const outside = { data: state.backdrop, left: X + LEFT, top: Y - TOP, width: RIGHT - LEFT };
        for (let yy = 0; yy < TOP; yy++) for (let xx = 0; xx < outside.width; xx++) outside.data[yy * outside.width + xx] = canvas.get(outside.left + xx, outside.top + yy);
        interiorShell(canvas, X, Y);
        if (kind === 'work') {
          bookshelf(canvas, X + 8, Y - 1, 16, 38);
          canvas.rect(X + 28, Y - 50, 12, 12, S.paper);
          canvas.draw(POSTER, X + 30, Y - 48);
          backWindow(canvas, X + 58, Y - 50, 22, 16, outside);
          clock(canvas, X + 96, Y - 44, hours);
          // Desk under the window, a chair, a plant and a lamp.
          canvas.rect(X + 52, Y - 16, 40, 2, S.trunk);
          canvas.rect(X + 54, Y - 14, 2, 14, S.door);
          canvas.rect(X + 88, Y - 14, 2, 14, S.door);
          canvas.rect(X + 76, Y - 14, 12, 7, S.door);
          canvas.rect(X + 81, Y - 11, 2, 1, S.brass);
          canvas.rect(X + 86, Y - 21, 4, 5, S.fur);
          canvas.set(X + 87, Y - 23, S.leaf0);
          canvas.set(X + 89, Y - 24, S.leaf1);
          canvas.set(X + 86, Y - 22, S.leaf1);
          canvas.line(X + 83, Y - 17, X + 81, Y - 27, S.ink);
          canvas.line(X + 81, Y - 27, X + 76, Y - 29, S.ink);
          canvas.rect(X + 73, Y - 30, 5, 2, S.ink);
          if (lamp) {
            canvas.rect(X + 74, Y - 28, 3, 1, S.lampLight);
            glows.push({ x: X + 74, y: Y - 20, r: 26, strength: 0.75 * (1 - light), squash: 0.6 });
          }
          // Chair.
          canvas.rect(X + seatX - 6, Y - 8, 12, 2, S.trunk);
          canvas.rect(X + seatX - 5, Y - 6, 2, 6, S.door);
          canvas.rect(X + seatX + 3, Y - 6, 2, 6, S.door);
          canvas.rect(X + seatX - 7, Y - 24, 2, 16, S.trunk);
        } else {
          bookshelf(canvas, X + 4, Y - 1, 14, 30);
          backWindow(canvas, X + 24, Y - 48, 16, 14, outside);
          canvas.rect(X + 46, Y - 46, 12, 9, S.trunk);
          canvas.rect(X + 47, Y - 45, 10, 7, S.knit);
          canvas.rect(X + 49, Y - 42, 6, 3, S.leaf0);
          // Rug, armchair facing the fire, side table with cocoa.
          for (let x = X + 34; x < X + 74; x++) canvas.set(x, Y - 1, (x - X) % 4 < 2 ? S.logo : S.knit);
          canvas.rect(X + seatX - 9, Y - 24, 5, 24, S.knit);
          canvas.rect(X + seatX - 8, Y - 24, 3, 2, S.knitDark);
          canvas.rect(X + seatX - 6, Y - 11, 14, 5, S.knit);
          canvas.rect(X + seatX - 6, Y - 6, 2, 6, S.door);
          canvas.rect(X + seatX + 6, Y - 6, 2, 6, S.door);
          canvas.rect(X + seatX + 4, Y - 15, 4, 5, S.knitDark);
          canvas.rect(X + 56, Y - 12, 8, 2, S.trunk);
          canvas.rect(X + 59, Y - 10, 2, 10, S.door);
          // The fireplace: stone surround, mantel, fire, and the cat on the rug.
          for (let y = Y - 34; y < Y; y++) for (let x = X + 74; x < X + 102; x++) canvas.set(x, y, ((x - X + Math.floor((y - Y) / 4) * 3) % 7 === 0 || (y - Y) % 4 === 0) ? S.hill1 : S.pathEdge);
          canvas.rect(X + 72, Y - 36, 32, 3, S.trunk);
          canvas.rect(X + 80, Y - 20, 16, 20, S.ink);
          drawFire(canvas, X + 88, Y - 2, 0.9 + Math.sin(time * 3) * 0.1, time, 6);
          canvas.rect(X + 82, Y - 2, 12, 2, S.trunk);
          glows.push({ x: X + 88, y: Y - 10, r: 46, strength: 0.95 * (1 - light * 0.6), squash: 0.7 });
          canvas.rect(X + 84, Y - 41, 3, 5, S.paper);
          canvas.rect(X + 92, Y - 40, 4, 4, S.brass);
          // The cat, curled up, tail flicking; z's now and then.
          for (let y = -3; y <= 0; y++) for (let x = -5; x <= 5; x++) if ((x / 5.5) ** 2 + ((y + 1) / 3) ** 2 <= 1) canvas.set(X + 66 + x, Y - 1 + y, S.cat);
          canvas.set(X + 62, Y - 5, S.cat);
          canvas.set(X + 63, Y - 5, S.cat);
          canvas.set(X + 71 + (Math.sin(time * 2) > 0.6 ? 1 : 0), Y - 2, S.cat);
          if (time % 6 < 3) canvas.set(X + 61 + Math.floor((time % 6) * 2), Y - 8 - Math.floor((time % 6) * 2), S.ink);
        }
      }
      if (!inFront) facade(canvas, X, Y, { kind, cut, leftOpen, rightOpen, light, season, glows, time });

      if (t < 0) return { pose: null, after: inFront ? () => facade(canvas, X, Y, { kind, cut, leftOpen, rightOpen, light, season, glows, time }) : null };

      // Walk in to the seat, sit, and at the end walk out of the far door.
      let speed = 0;
      const pose = { indoors: fox > 8 && fox < DOOR_OUT + 6 };
      let item = null;
      let view = null; // what the fox is looking at, shown above the house
      if (out === 0) {
        speed = walkTo(fox, seatX);
        if (speed === 0) {
          state.seated ??= t;
          const s = t - state.seated;
          Object.assign(pose, { legs: 'sit', seat: kind === 'work' ? 8 : 9, eyes: 'open' });
          if (kind === 'work') {
            pose.headphones = s > 0.35;
            const typing = s > 1.3 && s % 42 < 40;
            pose.front = [10, 1 + (typing && Math.floor(beat * 2) % 2 ? -1 : 0)];
            pose.back = [9, 2 + (typing && Math.floor(beat * 2 + 1) % 2 ? -1 : 0)];
            pose.eyes = 'focus';
            pose.headX = 1;
            const u = s % 70;
            if (u > 64 && u < 66) {
              pose.back = [5, -6];
              pose.eyes = 'closed';
              item = 'sip';
            }
            // Keep working, with a short sip rather than long idle intervals.
            // The desktop stays visible as focus passes between overlapping apps.
            view = { kind: 'laptop', t: Math.max(0, s - 0.85), amount: s >= 0.85 ? 1 : 0 };
          } else {
            // Read by the fire, pausing just long enough for a sip of cocoa.
            const u = s % 70;
            if (u < 65) {
              pose.front = [6, -1];
              pose.back = [8, -1];
              pose.eyes = 'focus';
              pose.headY = 1;
              item = 'book';
              view = { kind: 'book', t: s, amount: u > 0.3 && u < 64.8 ? 1 : 0 };
            } else {
              pose.back = [5, -6];
              pose.eyes = 'closed';
              item = 'sip';
            }
          }
        }
      } else {
        if (out < 1.6) Object.assign(pose, { legs: 'sit', seat: kind === 'work' ? 8 : 9, eyes: 'open', headphones: kind === 'work' && out < 0.8 });
        else speed = walkTo(fox, EXIT);
      }

      // Keep the last view while it dissolves during a sip or departure.
      if (view) state.lastView = view;
      state.viewAmount ??= 0;
      state.viewAmount = viewAmount(state.viewAmount, view?.amount ?? 0, c.dt);
      const thought = view ?? state.lastView;

      // Things on the desk: the laptop (screen lit while open) and a mug.
      const laptopOpen = kind === 'work' && fox >= seatX - 1 && (out === 0 ? t - (state.seated ?? t) > 0.55 : out < 0.4);
      return {
        pose,
        speed,
        done: out > 0 && fox >= EXIT - 1,
        after(paws) {
          if (cut > 0 && kind === 'work') {
            canvas.rect(X + 58, Y - 18, 12, 2, S.paper);
            if (laptopOpen) {
              canvas.line(X + 69, Y - 18, X + 72, Y - 28, S.paper, 1);
              canvas.line(X + 70, Y - 18, X + 73, Y - 28, S.ink, 1);
              canvas.set(X + 71, Y - 23, S.logo);
              if (light < 0.8) glows.push({ x: X + 62, y: Y - 22, r: 16, strength: 0.6 * (1 - light), squash: 0.8 });
            } else canvas.rect(X + 58, Y - 19, 12, 1, S.ink);
            if (item !== 'sip') {
              canvas.draw(MUG, X + 78, Y - 20);
              steam(canvas, X + 79, Y - 22, time);
            }
          }
          if (cut > 0 && kind === 'home' && item !== 'sip') {
            canvas.draw(MUG, X + 58, Y - 16);
            steam(canvas, X + 59, Y - 18, time);
          }
          if (item === 'sip') canvas.draw(MUG, paws.backPaw[0] - 1, paws.backPaw[1] - 2);
          if (item === 'book') canvas.draw(BOOK, paws.frontPaw[0] - 3, paws.frontPaw[1] - 4);
          if (inFront) facade(canvas, X, Y, { kind, cut, leftOpen, rightOpen, light, season, glows, time });
          if (thought && state.viewAmount > 0.02) {
            const paint = thought.kind === 'laptop' ? (sc, b) => laptop(sc, b, thought.t, c.seed) : (sc, b) => book(sc, b, thought.t, c.seed);
            // Keep the book above the natively framed fireplace and chairs.
            const box = thought.kind === 'laptop' ? { ...above(312, 158), y: 42 } : { ...above(292, 152), x: Math.round(X + 88 - 146), y: 46 };
            c.overlays.push(() => panel(canvas, box, state.viewAmount, paint, paws.top));
          }
        },
      };
    },
  };
}

export const work = makeHouse('work');
export const home = makeHouse('home');
