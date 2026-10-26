// A wide river. The path ends at a jetty with a rowboat; the fox steps in,
// takes the paddle and rows across past ducks and the odd jumping fish,
// moors at the far jetty and walks on, leaving the boat there.
import { sprite } from '../canvas.js';
import { S } from '../palette.js';
import { drawWater } from '../water.js';
import { hash01, seg } from './common.js';

const WIDTH = 560; // of open water
const NEAR = 18; // where the water starts, in set coordinates
const FAR = NEAR + WIDTH; // where it ends
const SEAT = 38; // where the fox sits in the boat, from the start
const BOAT = 48; // boat length
const MOORED = NEAR - 2; // where the boat waits at the near jetty
const LANDED = FAR - BOAT + 2; // and where it is left, bow on the far bank
const IN_BOAT = SEAT - MOORED; // the seat, from the stern
const ASHORE = LANDED + IN_BOAT; // the fox's position when the boat touches the far bank
const DUCK = sprite(['....gg.', '...gkgo', 'c...cc.', 'ccccccc', '.ccccc.'], { g: S.leaf1, k: S.ink, o: S.logo, c: S.paper });
const FISH = sprite(['.ppp..', 'pkpppp', '.ppp.p'], { p: S.paper, k: S.ink });

/** The hull of a rowboat seen from the side, bow to the right: white with an orange stripe. */
function hull(canvas, x0, top) {
  for (let x = 0; x < BOAT; x++) {
    const bow = Math.max(0, x - (BOAT - 8));
    const stern = Math.max(0, 4 - x);
    const depth = 9 - Math.round(bow * 0.6) - Math.round(stern * 0.5);
    const rise = Math.round(bow * 0.45);
    for (let y = -rise; y < depth; y++) {
      const c = y <= -rise ? S.trunk : y === 1 - rise || y === 2 - rise ? S.logo : S.paper;
      canvas.set(x0 + x, top + y, y === depth - 1 ? S.bunnyDark : c);
    }
  }
}

function jetty(canvas, x0, Y, w) {
  for (let x = x0; x < x0 + w; x++) {
    canvas.set(x, Y, (x - x0) % 6 === 0 ? S.pathEdge : S.trunk);
    canvas.set(x, Y + 1, S.bag);
  }
  for (let x = x0 + 2; x < x0 + w; x += 9) canvas.rect(x, Y + 2, 2, 16, S.bag);
}

export default {
  spec: { anchored: true, extent: [-20, FAR + 70], intro: 3, outro: 1, light: 'any' },
  draw(c) {
    const { canvas, X, Y, t, out, time, season, rain } = c;
    const winter = season === 'winter';
    const fox = c.foxX - X;

    // The river: a wide band of water with sloping banks, the current drawn
    // as moving glints, the far shore a line of reeds.
    const x0 = Math.max(0, X + NEAR - 10);
    const x1 = Math.min(639, X + FAR + 10);
    for (let x = x0; x <= x1; x += 1) {
      const lx = x - X;
      if (lx < NEAR || lx > FAR) continue;
      if (hash01(`reed:${Math.floor(lx / 3)}`) < 0.3) {
        const h = 2 + Math.floor(hash01(`reedh:${lx}`) * 4);
        canvas.rect(x, Y - 8 - h, 1, h, winter ? S.trunk : S.pine1);
      }
    }
    drawWater(canvas, {
      top: Y - 8,
      bottom: Y + 40,
      left: (y) => X + NEAR - 10 + Math.max(0, 10 - Math.round((y - Y + 8) * 0.6)),
      right: (y) => X + FAR + 10 - Math.max(0, 10 - Math.round((y - Y + 8) * 0.6)),
      time,
      rain,
      winter,
      current: 8,
    });
    // Ducks bobbing midstream; now and then a fish jumps.
    for (const [dx, phase] of [[180, 0], [190, 1.3], [199, 2.1], [380, 0.6]]) {
      const x = X + dx + Math.round(Math.sin(time * 0.3 + phase) * 4);
      if (x > -10 && x < 650 && !winter) canvas.draw(DUCK, x, Y + 6 + Math.round(Math.sin(time * 2 + phase)), { flip: Math.sin(time * 0.3 + phase) < 0 });
    }
    const jump = time % 23;
    if (jump < 1.2 && !winter) {
      const jx = X + 120 + ((Math.floor(time / 23) * 97) % 360);
      canvas.draw(FISH, jx + jump * 14, Y + 14 - Math.sin((Math.PI * jump) / 1.2) * 14, { flip: false });
    }
    jetty(canvas, X - 6, Y, NEAR + 14);
    jetty(canvas, X + FAR - 14, Y, 40);

    // Where the boat is: moored at the near jetty, then under the fox, then at the far jetty.
    const rowing = fox >= SEAT - 0.5 && fox < ASHORE;
    const boatAt = Math.max(MOORED, Math.min(LANDED, fox - IN_BOAT));
    const bob = Math.round(Math.sin(time * 2.2));
    const boatTop = Y + 3 + bob;
    hull(canvas, X + boatAt, boatTop);
    if (t < 0) return null;

    // Untie, step down into the boat, row, step out, walk on.
    let speed = 0;
    let lift = 0;
    const pose = {};
    let paddle = null;
    const stroke = (time * 0.45) % 1;
    if (fox < SEAT - 0.5) {
      if (t > 1.2) speed = Math.min(8, 2 + (SEAT - fox) * 2);
      else pose.back = [-1, 6];
      if (fox > NEAR) lift = Math.sin(Math.PI * seg(fox, NEAR, SEAT)) * 5 - seg(fox, NEAR, SEAT) * 3;
    } else if (rowing) {
      c.state.boarded ??= t;
      const settle = t - c.state.boarded;
      lift = -6 - bob;
      Object.assign(pose, { legs: 'sit', seat: 1, shin: 2, eyes: 'open' });
      if (settle > 1.4) {
        // Pull through the water, lift the blade out, swing it forward again.
        const pull = stroke < 0.55 ? seg(stroke, 0, 0.55) : 1 - seg(stroke, 0.55, 1);
        pose.front = [7 - pull * 9, 5];
        pose.back = [4 - pull * 6, -3];
        pose.headX = stroke < 0.55 ? 0 : 1;
        paddle = { pull, inWater: stroke < 0.55 };
        speed = 5 + Math.sin(stroke * Math.PI * 2) * 3;
        if (Math.floor(t / 30) % 3 === 1 && (t % 30) < 4) pose.eyes = 'happy';
      }
    } else {
      // At the far side: step up onto the jetty and walk off.
      const off = fox - ASHORE;
      lift = off < 8 ? Math.sin(Math.PI * Math.min(1, off / 8)) * 5 - (1 - Math.min(1, off / 8)) * 3 : 0;
      speed = 8;
    }
    return {
      pose,
      speed,
      lift,
      done: fox > FAR + 40 && out === 0,
      after(paws) {
        // The near side of the hull hides the fox's legs; the paddle over it.
        hull(canvas, X + boatAt, boatTop);
        if (paddle) {
          const [gx, gy] = paws.backPaw;
          const [hx] = paws.frontPaw;
          const bx = hx + (hx - gx) * 1.4;
          const by = paddle.inWater ? boatTop + 7 : boatTop - 2;
          canvas.line(gx, gy, bx, by, S.trunk);
          canvas.rect(Math.round(bx) - 1, Math.round(by) - 2, 3, 7, S.bag);
          if (paddle.inWater && paddle.pull > 0.1) for (const dx of [-3, 2, 4]) canvas.set(Math.round(bx) + dx, boatTop + 6 + (dx % 2), S.waterHi);
        }
      },
    };
  },
};
