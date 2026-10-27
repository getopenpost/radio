// A campfire at night: the fox lights it, friends walk in and sit on the
// other log, marshmallows get toasted, then everyone heads off.
import { S } from '../palette.js';
import { clamp01 } from '../dither.js';
import { drawFire, seg, steam } from './common.js';

export default {
  spec: { anchored: true, extent: [-16, 90], intro: 10, outro: 30, light: 'night', frameAt: 37 },
  draw(c) {
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
  }
};
