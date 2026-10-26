// Fishing from a long footbridge over a lake: casts, waits, sometimes lands a
// fish, admires it and lets it go. The lake freezes in winter.
import { sprite } from '../canvas.js';
import { S } from '../palette.js';
import { drawWater } from '../water.js';
import { above, panel, underwater } from '../pov.js';
import { hash01, inside, lerp, seg } from './common.js';

const FISH = sprite(['.ppp..', 'pkpppp', '.ppp.p'], { p: S.paper, k: S.ink });

export default {
  spec: { anchored: true, extent: [-100, 260], intro: 8, outro: 6, light: 'any' },
  draw(c) {
    const { canvas, X, Y, t, out, time, beat, season, light, rain, glows } = c;
    const winter = season === 'winter';
    // The lake replaces the ground under a long footbridge.
    const left = X - 96;
    const right = X + 250;
    drawWater(canvas, { top: 287, bottom: 324, left: (y) => left + (y - 287) * 0.9, right: (y) => right - (y - 287) * 0.9, time, rain, winter, current: 3 });
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
        // Around a bite we see under the water: the hook, the fish coming in.
        if (u >= 38 && u < 58) panel(canvas, above(), seg(u, 38, 39.2) * (1 - seg(u, 56, 57.2)), (sc, b) => underwater(sc, b, u - 41, { strike: 12, caught: catches }), paws.top);
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
  }
};
