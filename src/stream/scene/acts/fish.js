// Cleaning a lake from a footbridge: cast, snag a discarded object, reel it
// in and put it in the collection sack. The lake freezes in winter.
import { S } from '../palette.js';
import { drawWater } from '../water.js';
import { above, panel, underwater } from '../pov.js';
import { trash } from '../trash.js';
import { inside, lerp, seg } from './common.js';

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
    const cycle = t > 8 ? Math.floor((t - 8) / 42) : -1;
    const u = t > 8 ? (t - 8) % 42 : -1;
    const catches = cycle >= 0;
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
      if (inside(u, 28, 31)) {
        bob = 'nibble';
        pose.eyes = 'wide';
      } else if (inside(u, 31, 32)) {
        angle = catches ? lerp(-40, -72, seg(u, 31, 31.3)) : -40;
        bob = catches ? 'tip' : 'water';
        pose.eyes = catches ? 'wide' : 'side';
        pose.mouth = 'o';
      } else if (catches && inside(u, 32, 39)) {
        angle = -72;
        bob = 'tip';
        pose.eyes = 'happy';
        pose.mouth = 'open';
        pose.front = [5, -3];
      } else if (catches && inside(u, 39, 40.5)) {
        angle = lerp(-90, -38, seg(u, 39, 39.6));
        bob = 'flying';
        flyP = seg(u, 39.6, 40.5);
      }
      if (inside(u, 18, 19)) pose.eyes = 'focus';
    }
    if (reel > 0) {
      angle = lerp(-40, -90, reel);
      bob = reel < 1 ? 'flying' : 'none';
      flyP = 1 - reel;
      if (out > 2.5) angle = null;
      if (out > 3.5) pose.legs = 'stand';
    }

    // A collection sack and previously recovered litter stay on the bridge.
    canvas.rect(X - 18, Y - 7, 9, 7, S.knitDark);
    canvas.line(X - 18, Y - 7, X - 9, Y - 7, S.metal);
    const stored = cycle - (u < 39 ? 1 : 0);
    if (stored >= 0) trash(canvas, X - 14, Y - 10, c.seed + stored);
    return {
      pose,
      after(paws) {
        // Follow the hook down to the litter, then watch the retrieval.
        if (u >= 16 && u < 34) c.overlays.push(() => panel(canvas, above(), seg(u, 16, 17.2) * (1 - seg(u, 32.8, 34)), (sc, b) => underwater(sc, b, u - 17, { strike: 14, caught: catches, item: c.seed + cycle }), paws.top));
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
        const caught = catches && u >= 32 && u < 39;
        let recovered = null;
        if (caught) {
          const pull = seg(u, 32, 34);
          const deposit = seg(u, 36, 39);
          const fx = lerp(bobber.x, px + 2, pull);
          const fy = lerp(bobber.y, py + 2, pull) - Math.sin(Math.PI * pull) * 20;
          recovered = { x: lerp(fx, X - 14, deposit), y: lerp(fy, Y - 10, deposit) - Math.sin(Math.PI * deposit) * 7 };
          // The retrieval line stays attached until the object reaches the
          // paw. Then the fox unhooks it and tosses it into the sack.
          if (u < 35) b = recovered;
        }
        if (b) {
          // Line with a little sag, then the bobber (or the catch).
          for (let s = 0; s <= 1; s += 1 / 40) {
            const lx = lerp(tip.x, b.x, s);
            const ly = lerp(tip.y, b.y, s) + Math.sin(Math.PI * s) * (bob === 'water' ? 3 : 1);
            if ((Math.round(lx) + Math.round(ly)) % 2 === 0 || light < 0.5) canvas.set(Math.round(lx), Math.round(ly), light < 0.5 ? S.cloud : S.ink);
          }
          if (recovered) {
            trash(canvas, recovered.x, recovered.y, c.seed + cycle);
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
