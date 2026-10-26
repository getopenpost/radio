// Reading on a park bench. Friends come by now and then, sit on the other
// end, chat a little and read along before heading back to work; when the
// bench is free, a small bird drops in.
import { bubble, dialogue, dialogueLength } from '../bubbles.js';
import { S } from '../palette.js';
import { BIRD, BOOK, bench, lerp, seg } from './common.js';
import { dressFor, visitor } from './visitor.js';

const VISITS = [
  {
    hello: [{ who: 'b', text: 'MIND IF I SIT?' }, { who: 'a', text: 'PLEASE DO!' }, { who: 'b', text: 'GOOD BOOK?' }, { who: 'a', text: 'ALL ABOUT OLD MAPS' }, { who: 'b', text: 'SOUNDS COZY' }],
    bye: [{ who: 'b', text: 'BACK TO WORK!' }, { who: 'a', text: 'GOOD LUCK!' }],
  },
  {
    hello: [{ who: 'b', text: 'NICE SPOT, HUH?' }, { who: 'a', text: 'MY FAVOURITE' }, { who: 'b', text: 'READING AGAIN?' }, { who: 'a', text: 'ALWAYS' }],
    bye: [{ who: 'b', text: 'GOT A CALL SOON' }, { who: 'a', text: 'SEE YOU LATER!' }],
  },
  {
    hello: [{ who: 'b', text: 'HEY YOU!' }, { who: 'a', text: 'HEY! SIT DOWN' }, { who: 'b', text: 'HOW IS THE WEEK?' }, { who: 'a', text: 'BUSY BUT GOOD' }, { who: 'b', text: 'SAME HERE' }],
    bye: [{ who: 'b', text: 'OFF I GO' }, { who: 'a', text: 'TAKE CARE!' }],
  },
];
const PERIOD = 160; // a visitor at most every this many seconds
const STAY = 75;

export default {
  spec: { anchored: true, extent: [-20, 46], intro: 5, outro: 5, light: 'day' },
  draw(c) {
    const { canvas, X, Y, t, out, time } = c;
    bench(canvas, X - 14, Y, 54);
    if (t < 0) return null;

    // A visitor each period, once the fox has settled.
    const k = t > 12 ? Math.floor((t - 12) / PERIOD) : -1;
    const local = { ...c, t: t - 12 - k * PERIOD };
    const visit = VISITS[(k + c.seed) % VISITS.length];
    const species = (k + c.seed) % 2 ? 'bear' : 'bunny';
    const byeAt = STAY - dialogueLength(visit.bye) - 1;
    const bubbles = [];
    let talking = null;
    const friend =
      k >= 0 && out === 0
        ? visitor(local, {
            species,
            arrive: 0,
            stay: STAY,
            spot: 30,
            dress: dressFor(c),
            settle: (s) => {
              const line = s < 2 ? null : dialogue(visit.hello, s - 2) ?? (s > byeAt ? dialogue(visit.bye, s - byeAt) : null);
              talking = line;
              const quiet = !line && s > 2 + dialogueLength(visit.hello);
              return { legs: 'sit', seat: 7, eyes: quiet ? 'focus' : 'open', headY: quiet ? 1 : 0, mouth: line?.who === 'b' && line.typed < 1 && Math.floor(time * 8) % 2 ? 'open' : 'smile', front: quiet ? [6, -1] : [3, 3], back: quiet ? [8, -1] : undefined };
            },
          })
        : null;

    const pose = { legs: t < 1 ? 'stand' : 'sit', seat: 7, eyes: 'open' };
    const reading = t > 3 && out < 3 && !(talking && talking.who === 'a');
    if (reading) {
      pose.front = [6, -1];
      pose.back = [8, -1];
      pose.eyes = 'focus';
      pose.headY = 1;
    } else if (t > 1 && t < 3) pose.back = [-4, 3];
    if (friend?.phase === 'in' && friend.x < 70) {
      pose.eyes = 'side';
      pose.headY = 0;
    }
    if (talking) {
      pose.eyes = talking.who === 'a' ? 'happy' : 'open';
      pose.headY = 0;
      if (talking.who === 'a') pose.mouth = talking.typed < 1 && Math.floor(time * 8) % 2 ? 'open' : 'smile';
      const text = talking.text;
      const typed = talking.typed;
      if (talking.who === 'a') bubbles.push((paws) => bubble(canvas, paws.top[0], paws.top[1], text, typed, 'left'));
      else bubbles.push(() => bubble(canvas, friend.head[0], friend.head[1], text, typed, 'right'));
    }
    if (out > 3.5) pose.legs = 'stand';

    // A small bird lands on the free end of the backrest now and then.
    let bird = null;
    const bt = t % 75;
    if (!friend && bt > 30 && bt < 46 && out === 0) {
      const landed = bt > 33 && bt < 43;
      bird = {
        x: landed ? X + 34 + (Math.floor(bt * 1.5) % 3 === 0 ? 1 : 0) : bt <= 33 ? lerp(X + 120, X + 34, seg(bt, 30, 33)) : lerp(X + 34, X + 140, seg(bt, 43, 46)),
        y: landed ? Y - 20 : bt <= 33 ? lerp(180, Y - 20, seg(bt, 30, 33)) : lerp(Y - 20, 160, seg(bt, 43, 46)),
      };
      if (landed && bt < 37) pose.eyes = 'happy';
    }

    return {
      pose,
      after(paws) {
        if (bird) canvas.draw(BIRD, bird.x, bird.y, { flip: true });
        if (reading) {
          const [px, py] = paws.frontPaw;
          canvas.draw(BOOK, px - 3, py - 4);
          if (t % 25 < 0.5) canvas.rect(px - 1 + Math.round((t % 25) * 6), py - 3, 1, 3, S.paper);
        }
        if (friend?.phase === 'here' && !talking && friend.settled > 2 + dialogueLength(visit.hello)) {
          const [fx, fy] = friend.paws.frontPaw;
          canvas.draw(BOOK, fx - 3, fy - 4, { flip: true });
        }
        for (const b of bubbles) b(paws);
      },
    };
  },
};
