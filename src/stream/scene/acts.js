// What the fox stops to do. Each activity draws its set (a footbridge over a
// lake, a desk that rises out of the ground, a campfire, a bench, a blanket
// under the stars), choreographs the fox through an intro, a long idle with
// small events, and an outro, and reports light sources for night glows.
//
// Times: `t` is seconds since the fox stopped (negative while the set scrolls
// in); `out` is seconds into the outro (0 until it starts). Anchored sets are
// part of the ground and scroll with it; unanchored sets appear in place.
import { hashString } from '../../compose/rng.js';
import { sprite } from './canvas.js';
import { band, bayer, clamp01, lerp, smooth } from './dither.js';
import { S } from './palette.js';

const seg = (t, a, b) => smooth((t - a) / (b - a));
const inside = (t, a, b) => t >= a && t < b;
const hash01 = (s) => (hashString(s) % 10000) / 10000;

const FISH = sprite(['.ppp..', 'pkpppp', '.ppp.p'], { p: S.paper, k: S.ink });
const BOOK = sprite(['oopppoo', 'opkkpko', 'opkpkpo', 'opppppo', 'ooooooo'], { o: S.fur, p: S.paper, k: S.cloudShade });
const MUG = sprite(['ppp.', 'pppp', 'ppp.'], { p: S.paper });
const BIRD = sprite(['.kk.', 'kkkk', '.ok.'], { k: S.ink, o: S.fur });

export const ACTS = {
  fish: { anchored: true, extent: [-100, 260], intro: 8, outro: 6, light: 'any' },
  desk: { anchored: false, extent: [-14, 50], intro: 10, outro: 8, light: 'any' },
  campfire: { anchored: true, extent: [-16, 90], intro: 10, outro: 30, light: 'night' },
  read: { anchored: true, extent: [-16, 28], intro: 5, outro: 5, light: 'day' },
  stargaze: { anchored: true, extent: [-18, 40], intro: 4, outro: 4, light: 'night' },
};

/** Draw an activity's set and return the fox's pose and anything to draw over it. */
export function drawAct(kind, c) {
  return DRAW[kind](c);
}

const DRAW = {
  fish(c) {
    const { canvas, X, Y, t, out, time, beat, season, light, rain, glows } = c;
    const winter = season === 'winter';
    // The lake replaces the ground under a long footbridge.
    const left = X - 96;
    const right = X + 250;
    for (let y = 287; y < 324; y++) {
      const k = y - 287;
      const xl = Math.max(0, left + Math.round(k * 0.9));
      const xr = Math.min(639, right - Math.round(k * 0.9));
      const rate = 2 + (y % 5);
      for (let x = xl; x <= xr; x++) {
        let col = band(k / 36, 0.15, 0.9) > bayer(x, y) ? S.water1 : S.water0;
        if (!winter && (y === 290 || y === 301 || y === 308 || y === 316) && (x + Math.floor(time * rate)) % 31 < 3) col = S.waterHi;
        if (!winter && rain > 0.2 && ((x * 7 + y * 13 + Math.floor(time * 6)) % 97) < rain * 2) col = S.waterHi;
        canvas.set(x, y, col);
      }
    }
    // Footbridge planks at the path level, posts into the water.
    for (let x = left - 6; x <= right + 6; x++) {
      canvas.set(x, Y, (x - left) % 7 === 0 ? S.pathEdge : S.trunk);
      canvas.set(x, Y + 1, S.trunk);
      canvas.set(x, Y + 2, S.bag);
    }
    for (let x = left + 10; x < right; x += 26) canvas.rect(x, Y + 3, 2, 14, S.bag);
    // A lantern on the bridge at night.
    if (light < 0.5) {
      canvas.rect(X - 16, Y - 5, 3, 4, S.ink);
      canvas.rect(X - 15, Y - 4, 1, 2, S.lampLight);
      glows.push({ x: X - 15, y: Y - 3, r: 26, strength: 0.8 * (1 - light * 2), squash: 0.7 });
    }
    if (t < 0) return null;

    // Choreography.
    const bobber = { x: X + 58, y: 289 };
    const cycle = t > 8 ? Math.floor((t - 8) / 70) : -1;
    const u = t > 8 ? (t - 8) % 70 : -1;
    const catches = cycle >= 0 && hash01(`fish:${c.seed}:${cycle}`) > 0.35;
    const reel = out > 0 ? seg(out, 0, 2) : 0;
    let angle = -40; // rod angle in degrees, 0 = pointing right
    let bob = 'water'; // where the bobber is: water, flying, tip, none
    let flyP = 0;
    const pose = { legs: t < 1 ? 'stand' : 'sit', seat: 0, shin: 6, dangle: Math.sin(time * 1.4) * 0.8, eyes: 'open', front: [6, 1], back: [3, 4] };
    if (t < 1.8) {
      bob = 'none';
      angle = null;
      if (t > 1.1) pose.back = [-4, 3]; // reaching into the bag
    } else if (t < 5) {
      angle = t < 2.6 ? -90 : t < 3.4 ? lerp(-90, -125, seg(t, 2.6, 3.4)) : lerp(-125, -38, seg(t, 3.4, 3.9));
      bob = t < 3.9 ? 'tip' : 'flying';
      flyP = seg(t, 3.9, 5);
      pose.eyes = t > 3.4 ? 'happy' : 'open';
    } else if (u >= 0) {
      angle = -40 + Math.sin(time * 0.7) * 2;
      if (inside(u, 50, 53)) {
        bob = 'nibble';
        pose.eyes = 'wide';
      } else if (inside(u, 53, 54)) {
        angle = catches ? lerp(-40, -72, seg(u, 53, 53.3)) : -40;
        bob = catches ? 'tip' : 'water';
        pose.eyes = catches ? 'wide' : 'side';
        pose.mouth = 'o';
      } else if (catches && inside(u, 54, 63)) {
        angle = -72;
        bob = 'tip';
        pose.eyes = 'happy';
        pose.mouth = 'open';
        pose.front = [5, -3];
      } else if (catches && inside(u, 63, 64.5)) {
        angle = lerp(-90, -38, seg(u, 63, 63.6));
        bob = 'flying';
        flyP = seg(u, 63.6, 64.5);
      } else if (!catches && inside(u, 54, 56)) {
        pose.eyes = 'closed';
        pose.mouth = 'none';
      }
      if (inside(u, 20, 24) || inside(u, 40, 41)) pose.eyes = 'closed'; // dozing a little
    }
    if (reel > 0) {
      angle = lerp(-40, -90, reel);
      bob = reel < 1 ? 'flying' : 'none';
      flyP = 1 - reel;
      if (out > 2.5) angle = null;
      if (out > 3.5) pose.legs = 'stand';
    }

    return {
      pose,
      after(paws) {
        if (angle == null) return;
        const [px, py] = paws.frontPaw;
        const rad = (angle * Math.PI) / 180;
        const tip = { x: px + Math.cos(rad) * 22, y: py + Math.sin(rad) * 22 };
        canvas.line(px, py, tip.x, tip.y, S.trunk);
        let b = null;
        if (bob === 'water') b = { x: bobber.x, y: bobber.y + (Math.floor(beat) % 2 ? 0 : 1) };
        else if (bob === 'nibble') b = { x: bobber.x, y: bobber.y + (Math.sin(time * 18) > 0 ? 2 : 0) };
        else if (bob === 'flying') b = { x: lerp(tip.x, bobber.x, flyP), y: lerp(tip.y, bobber.y, flyP) - Math.sin(Math.PI * flyP) * 16 };
        else if (bob === 'tip') b = { x: tip.x, y: tip.y + 6 };
        if (b) {
          // Line with a little sag, then the bobber (or the catch).
          for (let s = 0; s <= 1; s += 1 / 40) {
            const lx = lerp(tip.x, b.x, s);
            const ly = lerp(tip.y, b.y, s) + Math.sin(Math.PI * s) * (bob === 'water' ? 3 : 1);
            if ((Math.round(lx) + Math.round(ly)) % 2 === 0 || light < 0.5) canvas.set(Math.round(lx), Math.round(ly), light < 0.5 ? S.cloud : S.ink);
          }
          const caught = catches && u >= 54 && u < 63;
          if (caught) {
            const p = seg(u, 54, 55.4);
            const fx = lerp(bobber.x, px + 2, p);
            const fy = lerp(bobber.y, py + 2, p) - Math.sin(Math.PI * p) * 20;
            canvas.draw(FISH, fx - 3, fy - 1, { flip: Math.floor(time * 4) % 2 === 0 });
          } else {
            canvas.set(Math.round(b.x), Math.round(b.y) - 1, S.logo);
            canvas.set(Math.round(b.x), Math.round(b.y), S.paper);
            if (winter && bob !== 'flying') canvas.rect(Math.round(b.x) - 2, bobber.y + 2, 5, 1, S.ink);
          }
          if ((bob === 'nibble' || (bob === 'flying' && flyP > 0.95)) && !winter) {
            for (const dx of [-3, 3]) canvas.set(Math.round(bobber.x + dx), bobber.y + 1, S.waterHi);
          }
        }
      },
    };
  },

  desk(c) {
    const { canvas, X, Y, t, out, time, beat, light, glows } = c;
    if (t < 0) return null;
    const rise = out > 0 ? 1 - seg(out, 4, 7.5) : seg(t, 1, 4);
    const drop = Math.round((1 - rise) * 24);
    const clip = (fn) => (x, y, w, h, col) => {
      const top = y + drop;
      const bottom = Math.min(top + h, Y + 1);
      if (bottom > top) fn(x, top, w, bottom - top, col);
    };
    const rect = clip(canvas.rect);
    // Chair under the fox, desk in front.
    rect(X - 7, 289, 13, 2, S.trunk);
    rect(X - 6, 291, 2, 6, S.bag);
    rect(X + 3, 291, 2, 6, S.bag);
    rect(X - 8, 276, 2, 15, S.trunk);
    rect(X + 10, 281, 36, 2, S.trunk);
    rect(X + 10, 283, 36, 1, S.bag);
    rect(X + 12, 284, 2, 13, S.bag);
    rect(X + 42, 284, 2, 13, S.bag);
    rect(X + 33, 284, 9, 6, S.bag);
    rect(X + 37, 286, 2, 1, S.pathEdge);
    // Dust where it breaks through.
    if ((t > 1 && t < 4.5) || (out > 4 && out < 8)) {
      for (let i = 0; i < 14; i++) {
        const dx = X - 10 + ((i * 37 + Math.floor(time * 9)) % 58);
        const dy = Y - ((i * 5 + Math.floor(time * 7)) % 6);
        if (bayer(dx, dy) < 0.5) canvas.set(dx, dy, S.smoke);
      }
    }
    // Desk things: lamp, plant, mug, laptop.
    const onDesk = drop < 1;
    if (onDesk) {
      canvas.line(X + 43, 280, X + 41, 270, S.ink);
      canvas.line(X + 41, 270, X + 36, 268, S.ink);
      canvas.rect(X + 33, 267, 5, 2, S.ink);
      canvas.rect(X + 42, 280, 3, 1, S.ink);
      if (light < 0.6) {
        canvas.rect(X + 34, 269, 3, 1, S.lampLight);
        glows.push({ x: X + 35, y: 276, r: 20, strength: 0.6 * (1 - light), squash: 0.55 });
      }
      canvas.rect(X + 20, 278, 3, 3, S.fur);
      canvas.set(X + 20, 277, S.leaf0);
      canvas.set(X + 22, 276, S.leaf0);
      canvas.set(X + 21, 276, S.leaf1);
    }
    const sipping = t > 12 && (t % 45) > 30 && (t % 45) < 34 && out === 0;
    if (onDesk && !sipping) {
      canvas.draw(MUG, X + 14, 278);
      steam(canvas, X + 15, 276, time);
    }
    const lid = out > 0 ? 1 - seg(out, 0, 1.2) : seg(t, 7, 8.5);
    if (onDesk) {
      // Laptop seen from the side: the lid's back faces us, with a little logo.
      canvas.rect(X + 24, 280, 11, 1, S.paper);
      const ang = lerp(0, 1.75, lid);
      const ly = 280 - Math.sin(ang) * 10;
      canvas.line(X + 34, 280, Math.round(X + 34 - Math.cos(ang) * 10), Math.round(ly), S.paper, 1);
      canvas.line(X + 35, 280, Math.round(X + 35 - Math.cos(ang) * 10), Math.round(ly), S.ink, 1);
      if (lid > 0.8) {
        canvas.set(Math.round(X + 35 - Math.cos(ang) * 5), Math.round(280 - Math.sin(ang) * 5), S.logo);
        glows.push({ x: X + 24, y: 275, r: 16, strength: 0.5 * (1 - light), squash: 0.8 });
      }
    }

    // The fox: watches it rise, hops on, puts headphones on, works.
    const pose = { legs: 'stand', eyes: 'open' };
    if (t < 4.2 && out === 0) {
      pose.eyes = t > 1 ? 'wide' : 'open';
      pose.mouth = t > 1 ? 'o' : 'smile';
    } else {
      const hop = out > 0 ? seg(out, 3, 3.6) : 1 - seg(t, 4.2, 4.8);
      pose.legs = hop > 0.5 && out > 0 ? 'stand' : 'sit';
      pose.seat = 7;
      pose.bob = -Math.round(Math.sin(Math.PI * clamp01(out > 0 ? (out - 3) / 0.6 : (t - 4.2) / 0.6)) * 6);
      if (pose.legs === 'stand') pose.seat = 0;
      const phones = out > 0 ? 1 - seg(out, 1.4, 2.4) : seg(t, 5.2, 6.4);
      pose.headphones = phones >= 1;
      if (phones > 0 && phones < 1) c.overlays.push(() => headphonesDropping(canvas, X + 1, Y - 25 - Math.round((1 - phones) * 14)));
      const working = t > 9 && out === 0;
      if (working) {
        const typing = Math.floor((t / 6) % 5) !== 4; // pauses now and then
        pose.front = [10, 1 + (typing && Math.floor(beat * 2) % 2 ? -1 : 0)];
        pose.back = [9, 2 + (typing && Math.floor(beat * 2 + 1) % 2 ? -1 : 0)];
        pose.eyes = 'focus';
        pose.headX = 1;
        // Vibing: eyes closed and nodding to the beat for a while each minute.
        if ((t % 60) > 40 && (t % 60) < 52) {
          pose.eyes = 'closed';
          pose.headY = Math.floor(beat) % 2 ? 1 : 0;
          pose.mouth = 'smile';
        }
        if (sipping) {
          pose.back = [4, -6];
          pose.eyes = 'closed';
          c.overlays.push((paws) => canvas.draw(MUG, paws.backPaw[0] - 1, paws.backPaw[1] - 2));
        }
      } else if (t > 6.4 && out === 0) pose.eyes = 'happy';
    }
    return { pose };
  },

  campfire(c) {
    const { canvas, chars, X, Y, t, out, time, beat, light, glows } = c;
    // Logs to sit on, a ring of stones and the fire.
    const log = (x0, x1) => {
      canvas.rect(x0, Y - 4, x1 - x0, 4, S.trunk);
      canvas.rect(x0, Y - 4, x1 - x0, 1, S.bag);
      canvas.rect(x0, Y - 4, 2, 4, S.cream);
    };
    log(X - 10, X + 8);
    log(X + 46, X + 84);
    const fx = X + 30;
    for (let dx = -8; dx <= 8; dx += 2) canvas.rect(fx + dx, Y - 1, 2, 2, dx % 4 ? S.pathEdge : S.hill1);
    canvas.line(fx - 5, Y - 1, fx + 4, Y - 4, S.trunk);
    canvas.line(fx + 5, Y - 1, fx - 4, Y - 4, S.trunk);
    if (t < 0) return null;
    const fire = Math.max(out > 0 ? 0.12 : 0, (out > 0 ? 1 - seg(out, 14, 26) : seg(t, 3, 9)));
    drawFire(canvas, fx, Y - 3, fire, time);
    if (fire > 0.05) glows.push({ x: fx, y: Y - 8, r: 30 + fire * 30 + Math.sin(time * 9) * 2, strength: fire * (1 - light * 0.85), squash: 0.7 });
    if (t > 2 && fire < 0.6) steam(canvas, fx, Y - 8 - Math.round(fire * 10), time, 3);

    // Friends walk in from the right, sit, and leave at the end.
    const friends = [
      { species: 'bunny', seatX: X + 54, start: 5 },
      { species: 'bear', seatX: X + 75, start: 13 },
    ];
    for (const f of friends) {
      const enterX = 660;
      const arrive = f.start + (enterX - f.seatX) / 10;
      let x;
      let pose;
      if (t < f.start) continue;
      if (out > 4 + (f.species === 'bear' ? 2 : 0)) {
        const go = out - (4 + (f.species === 'bear' ? 2 : 0));
        x = f.seatX + go * 13;
        pose = { legs: 'walk', step: (go * 13) / 12, eyes: 'happy', front: go < 2 ? [3, -9] : [2, 5] };
        if (x > 680) continue;
        chars.draw(canvas, f.species, Math.round(x), Y, 1, pose);
        continue;
      }
      if (t < arrive) {
        x = enterX - (t - f.start) * 10;
        pose = { legs: 'walk', step: ((t - f.start) * 10) / 12, eyes: 'open' };
      } else {
        x = f.seatX;
        const sat = t - arrive;
        pose = { legs: 'sit', seat: 4, shin: 4, eyes: sat < 2 ? 'happy' : Math.floor(time / 3.7 + f.start) % 5 === 0 ? 'blink' : 'open', front: sat < 2 ? [3, -9] : [-4, 3], headY: Math.floor(beat) % 2 && f.species === 'bear' ? 1 : 0, tail: Math.sin(time + f.start) };
        if (out > 0 && out < 4) pose.front = [3, -9];
      }
      chars.draw(canvas, f.species, Math.round(x), Y, -1, pose);
    }

    // The fox roasts marshmallows.
    const pose = { legs: t < 1 ? 'stand' : 'sit', seat: 4, shin: 4, eyes: 'open', front: [2, 5] };
    if (t > 1 && t < 3) pose.front = [5, 2];
    const u = t > 20 ? (t - 20) % 50 : -1;
    let stick = null;
    if (u >= 0 && u < 26 && out === 0) {
      pose.front = [8, -2];
      const toast = clamp01((u - 2) / 18);
      stick = { toast, eat: u > 22 };
      if (u > 22) {
        pose.front = [4, -4];
        pose.eyes = 'happy';
        pose.mouth = Math.floor(time * 4) % 2 ? 'open' : 'smile';
      }
    }
    if (out > 0) pose.legs = out > 28 ? 'stand' : 'sit';
    const arrivedFriend = friends.some((f) => t > f.start + (660 - f.seatX) / 10 && t < f.start + (660 - f.seatX) / 10 + 2.5);
    if (arrivedFriend) {
      pose.front = [3, -9];
      pose.eyes = 'happy';
    }
    if (out > 3 && out < 9) {
      pose.front = [3, -9];
      pose.eyes = 'happy';
    }
    if (u < 0 || u >= 26) pose.headY = Math.floor(beat) % 2 ? 1 : 0;
    return {
      pose,
      after(paws) {
        if (!stick) return;
        const [px, py] = paws.frontPaw;
        const tip = stick.eat ? [px + 2, py - 4] : [fx - 1, Y - 13];
        canvas.line(px, py, tip[0], tip[1], S.trunk);
        canvas.rect(tip[0], tip[1] - 1, 2, 2, stick.toast > 0.75 ? S.bag : stick.toast > 0.35 ? S.cream : S.paper);
      },
    };
  },

  read(c) {
    const { canvas, X, t, out } = c;
    // A bench seen from the front.
    canvas.rect(X - 14, 289, 38, 2, S.trunk);
    canvas.rect(X - 14, 291, 38, 1, S.bag);
    canvas.rect(X - 12, 292, 2, 5, S.bag);
    canvas.rect(X + 20, 292, 2, 5, S.bag);
    canvas.rect(X - 14, 279, 38, 2, S.trunk);
    canvas.rect(X - 14, 283, 38, 2, S.trunk);
    canvas.rect(X - 12, 279, 2, 10, S.bag);
    canvas.rect(X + 20, 279, 2, 10, S.bag);
    if (t < 0) return null;
    const pose = { legs: t < 1 ? 'stand' : 'sit', seat: 7, eyes: 'open' };
    const holding = t > 3 && (out === 0 || out < 3);
    // A small bird drops by now and then.
    const bt = t % 75;
    if (bt > 30 && bt < 46 && out === 0) {
      const landed = bt > 33 && bt < 43;
      const bx = landed ? X + 18 + (Math.floor(bt * 1.5) % 3 === 0 ? 1 : 0) : bt <= 33 ? lerp(X + 120, X + 18, seg(bt, 30, 33)) : lerp(X + 18, X + 140, seg(bt, 43, 46));
      const by = landed ? 276 : bt <= 33 ? lerp(180, 276, seg(bt, 30, 33)) : lerp(276, 160, seg(bt, 43, 46));
      canvas.draw(BIRD, bx, by, { flip: true });
      if (landed) pose.eyes = bt < 37 ? 'happy' : 'open';
    }
    if (holding) {
      pose.front = [6, -1];
      pose.back = [8, -1];
      pose.eyes = pose.eyes === 'happy' ? 'happy' : 'focus';
      pose.headY = 1;
    } else if (t > 1 && t < 3) pose.back = [-4, 3];
    if (out > 3.5) pose.legs = 'stand';
    return {
      pose,
      after(paws) {
        if (!holding) return;
        const [px, py] = paws.frontPaw;
        canvas.draw(BOOK, px - 3, py - 4);
        if (t % 25 < 0.5) canvas.rect(px - 1 + Math.round((t % 25) * 6), py - 3, 1, 3, S.paper);
      },
    };
  },

  stargaze(c) {
    const { canvas, X, Y, t, out } = c;
    // A checked blanket and a telescope on a tripod.
    for (let x = X - 16; x < X + 16; x++) for (let y = Y - 1; y <= Y; y++) canvas.set(x, y, ((x >> 1) + (y >> 1)) % 2 ? S.cream : S.fur);
    canvas.line(X + 30, 282, X + 26, Y, S.ink);
    canvas.line(X + 30, 282, X + 34, Y, S.ink);
    canvas.line(X + 30, 282, X + 30, Y, S.ink);
    canvas.line(X + 24, 284, X + 37, 276, S.paper, 2);
    canvas.set(X + 37, 275, S.ink);
    if (t < 0) return null;
    const pose = { legs: t < 1.2 ? 'stand' : 'sitGround', eyes: 'up', mouth: 'none', front: [3, 4] };
    // Every so often a shooting star; the fox points at it.
    const k = Math.floor(t / 22);
    if (t > 6 && t % 22 < 0.05 + c.dt && out === 0) c.trigger('shootingStar', `star:${c.seed}:${k}`);
    if (t > 6 && t % 22 > 0.6 && t % 22 < 3) {
      pose.front = [6, -10];
      pose.eyes = 'happy';
      pose.mouth = 'open';
    }
    if (t % 40 > 30 && t % 40 < 32) pose.eyes = 'closed';
    if (out > 2.5) pose.legs = 'stand';
    return { pose };
  },
};

function drawFire(canvas, x, base, level, time) {
  if (level <= 0.02) return;
  for (let dx = -5; dx <= 5; dx++) {
    const shape = 1 - Math.abs(dx) / 6;
    const flick = Math.sin(time * 7.3 + dx * 1.7) * 0.5 + Math.sin(time * 12.1 + dx * 0.9) * 0.35;
    const h = Math.max(0, level * (7 + 6 * shape + flick * 3) * shape);
    for (let y = 0; y < h; y++) {
      const px = x + dx;
      const py = base - y;
      const r = y / Math.max(1, h);
      if (r > 0.75 && bayer(px, py + Math.floor(time * 10)) < 0.5) continue;
      canvas.set(px, py, Math.abs(dx) < 2 && r < 0.45 ? S.fire2 : Math.abs(dx) < 4 && r < 0.75 ? S.fire1 : S.fire0);
    }
  }
  // Sparks drifting up.
  for (let i = 0; i < 6; i++) {
    const age = (time + i * 0.37) % 2.2;
    if (age > 1.7 * level) continue;
    const sx = Math.round(x + Math.sin(i * 3.1 + age * 2) * 4);
    const sy = Math.round(base - 10 - age * 16);
    canvas.set(sx, sy, i % 2 ? S.fire1 : S.fire2);
  }
}

/** A few rising wisps (steam from a mug, smoke from embers). */
function steam(canvas, x, y, time, n = 2) {
  for (let i = 0; i < n * 3; i++) {
    const age = (time * 0.8 + i / (n * 3)) % 1;
    const sx = Math.round(x + Math.sin(age * 6 + i) * 1.5);
    const sy = Math.round(y - age * 10);
    if (age < 0.85 && bayer(sx, sy) < 0.6) canvas.set(sx, sy, S.smoke);
  }
}

function headphonesDropping(canvas, x, y) {
  canvas.line(x - 6, y + 5, x - 5, y, S.ink);
  canvas.line(x - 5, y, x + 2, y - 1, S.ink);
  canvas.rect(x - 8, y + 4, 3, 5, S.ink);
}
