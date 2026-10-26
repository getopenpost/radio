// A calisthenics park: pull-up bars, dip bars, a spot for push-ups, a wall
// for handstand push-ups and a bench. The fox works through sets (counting
// reps in little bubbles), rests with water between them, and loops back for
// muscle-ups. Some sessions a friend trains on the lower bar and cheers.
import { bubble } from '../bubbles.js';
import { S } from '../palette.js';
import { BOTTLE, bench, seg } from './common.js';
import { dressFor, visitor } from './visitor.js';

const BAR = { from: 4, to: 32, y: 46 }; // pull-up bar: span and height
const LOW = { from: 34, to: 52, y: 38 }; // the friend's lower bar
const DIP = { from: 62, to: 82, y: 18 };
const PUSH = 104;
const WALL = 140;
const BENCH = 156;

// The session: where each set happens, how many reps and how long each takes.
const ROUTINE = [
  { kind: 'pullup', at: 18, reps: 5, rep: 2.4 },
  { kind: 'shake', at: 18, time: 4 },
  { kind: 'dip', at: 72, reps: 6, rep: 2 },
  { kind: 'pushup', at: PUSH, reps: 8, rep: 1.6 },
  { kind: 'shake', at: PUSH, time: 3 },
  { kind: 'hspu', at: WALL - 6, reps: 3, rep: 3 },
  { kind: 'rest', at: BENCH + 8, time: 18 },
  { kind: 'muscleup', at: 18, reps: 2, rep: 3.6 },
  { kind: 'pullup', at: 18, reps: 3, rep: 2.4 },
  { kind: 'rest', at: BENCH + 8, time: 22 },
];

const setLength = (s) => (s.reps ? 1.2 + s.reps * s.rep + 0.8 : s.time);

function equipment(canvas, X, Y) {
  const post = (x, h) => {
    canvas.rect(X + x, Y - h, 2, h, S.metalDark);
    canvas.rect(X + x - 1, Y - 1, 4, 1, S.ink);
  };
  post(BAR.from, BAR.y + 2);
  post(BAR.to, BAR.y + 2);
  canvas.rect(X + BAR.from, Y - BAR.y, BAR.to - BAR.from + 2, 2, S.metal);
  post(LOW.to, LOW.y + 2);
  canvas.rect(X + LOW.from, Y - LOW.y, LOW.to - LOW.from + 2, 2, S.metal);
  post(DIP.from, DIP.y + 2);
  post(DIP.to, DIP.y + 2);
  canvas.rect(X + DIP.from, Y - DIP.y, DIP.to - DIP.from + 2, 2, S.metal);
  // A mat for push-ups and a padded wall for handstands.
  for (let x = PUSH - 16; x < PUSH + 6; x++) canvas.set(X + x, Y - 1, (x - PUSH) % 4 < 2 ? S.knit : S.knitDark);
  canvas.rect(X + WALL, Y - 42, 5, 42, S.trunk);
  for (let y = Y - 40; y < Y; y += 6) canvas.rect(X + WALL, y, 5, 1, S.bag);
  bench(canvas, X + BENCH, Y);
}

/** Pose and height for a set `s`, `into` seconds in. */
function exercise(s, into, Y, time) {
  const pose = { eyes: 'focus' };
  let lift = 0;
  let count = null;
  const reps = s.reps ?? 0;
  const work = into - 1.2;
  const r = reps ? Math.min(reps - 1, Math.floor(Math.max(0, work) / s.rep)) : 0;
  const p = reps && work >= 0 && work < reps * s.rep ? (work / s.rep) % 1 : null;
  if (reps && work >= 0 && work < reps * s.rep && p > 0.62 && p < 0.95) count = String(r + 1);
  const ending = reps && work >= reps * s.rep;

  const hang = (barY, front1) => {
    // Paws on the bar: the body hangs below them.
    lift = Y - (Y - barY + 11 - front1);
    return { legs: 'hang', front: [1, front1], back: [0, front1], dangle: Math.sin(time * 2) * 0.6 };
  };
  if (s.kind === 'pullup' || s.kind === 'muscleup') {
    if (into < 1.2) {
      // Reach up, jump, catch the bar.
      const j = seg(into, 0.3, 1);
      if (j === 0) return { pose: { front: [1, -12], back: [0, -12], eyes: 'up' }, lift: 0 };
      Object.assign(pose, hang(BAR.y, -16));
      lift *= j;
    } else if (ending) {
      Object.assign(pose, hang(BAR.y, -16));
      lift *= 1 - seg(into - 1.2 - reps * s.rep, 0, 0.5);
      pose.eyes = 'happy';
    } else if (s.kind === 'pullup') {
      const up = p < 0.42 ? seg(p, 0, 0.42) : p < 0.55 ? 1 : 1 - seg(p, 0.55, 1);
      Object.assign(pose, hang(BAR.y, -16 + up * 13));
      if (up > 0.9) Object.assign(pose, { eyes: 'closed', mouth: 'o' });
    } else {
      // Muscle-up: pull high, turn the wrists over the bar, press to lockout, lower.
      let front1;
      if (p < 0.32) front1 = -16 + seg(p, 0, 0.32) * 13;
      else if (p < 0.45) front1 = -3 + seg(p, 0.32, 0.45) * 7;
      else if (p < 0.6) front1 = 4 + seg(p, 0.45, 0.6) * 3;
      else if (p < 0.7) front1 = 7;
      else front1 = 7 - seg(p, 0.7, 1) * 23;
      Object.assign(pose, hang(BAR.y, front1));
      pose.headX = front1 > -3 && front1 < 7 ? 2 : 0;
      if (front1 >= 6.5) Object.assign(pose, { eyes: 'happy', mouth: 'open', legs: 'hang' });
      else if (front1 > -4) Object.assign(pose, { eyes: 'closed', mouth: 'o' });
    }
  } else if (s.kind === 'dip') {
    const support = (front1) => {
      lift = Y - (Y - DIP.y + 11 - front1);
      return { legs: 'tuck', front: [front1 < 6 ? 3 : 1, front1], back: [front1 < 6 ? 2 : 0, front1] };
    };
    if (into < 1.2) {
      Object.assign(pose, support(7), { eyes: 'open' });
      lift *= seg(into, 0.3, 1);
    } else if (ending) {
      Object.assign(pose, support(7), { eyes: 'happy' });
      lift *= 1 - seg(into - 1.2 - reps * s.rep, 0, 0.5);
    } else {
      const down = p < 0.45 ? seg(p, 0, 0.45) : 1 - seg(p, 0.55, 1);
      Object.assign(pose, support(7 - down * 5));
      if (down > 0.9) Object.assign(pose, { eyes: 'closed', mouth: 'o' });
    }
  } else if (s.kind === 'pushup') {
    if (into < 0.6) return { pose: { bob: 3, front: [4, 6], back: [3, 6], eyes: 'focus' }, lift: 0 };
    if (ending) return { pose: { bob: into - 1.2 - reps * s.rep < 0.4 ? 3 : 0, front: [4, 6], eyes: 'happy', mouth: 'open' }, lift: 0 };
    // Lying turned on its side: arms push the chest up, toes stay on the ground.
    const down = p == null ? 0 : p < 0.45 ? seg(p, 0, 0.45) : 1 - seg(p, 0.55, 1);
    Object.assign(pose, { turn: 90, legs: 'plank', reach: 10 - down * 4, front: [7 - down * 4, 0], back: [7 - down * 4, 1] });
    lift = 1 - down * 4;
    if (down > 0.9) Object.assign(pose, { eyes: 'closed', mouth: 'o' });
  } else if (s.kind === 'hspu') {
    if (into < 0.8) return { pose: { bob: 2, front: [3, 6], back: [2, 6], eyes: 'focus' }, lift: 0 };
    if (ending) return { pose: { eyes: 'happy', mouth: 'open', front: [3, -10] }, lift: 0 };
    // Upside down, heels on the wall: bend the arms until the head nearly touches.
    const down = p == null ? 0 : p < 0.45 ? seg(p, 0, 0.45) : 1 - seg(p, 0.55, 1);
    Object.assign(pose, { turn: 180, legs: 'hang', front: [down, -18 + down * 4], back: [down, -18 + down * 4] });
    lift = 11 - down * 4;
    if (down > 0.9) Object.assign(pose, { eyes: 'closed', mouth: 'o' });
  } else if (s.kind === 'shake') {
    Object.assign(pose, { eyes: 'closed', mouth: 'smile', front: [2 + Math.round(Math.sin(time * 12) * 2), 6], back: [-2 - Math.round(Math.sin(time * 12) * 2), 6], sweat: true });
  } else if (s.kind === 'rest') {
    const u = into;
    Object.assign(pose, { legs: 'sit', seat: 7, eyes: 'closed', sweat: u < 8, bob: Math.floor(time * 1.2) % 2 });
    if (u > 3 && u < 7) Object.assign(pose, { back: [5, -6], eyes: 'closed', item: 'bottle' });
    else if (u > 9 && u < 11) Object.assign(pose, { front: [4, -13], eyes: 'closed', mouth: 'o' });
    else if (u > 11) Object.assign(pose, { eyes: 'open', mouth: 'smile' });
  }
  return { pose, lift, count };
}

export default {
  spec: { anchored: true, extent: [-20, BENCH + 50], intro: 2, outro: 4, light: 'day' },
  draw(c) {
    const { canvas, X, Y, t, out, time, state } = c;
    equipment(canvas, X, Y);
    if (t < 0) return null;
    const fox = c.foxX - X;

    // Where in the routine: walk to the next station, then do the set.
    state.step ??= 0;
    state.since ??= null;
    let s = ROUTINE[state.step % ROUTINE.length];
    let speed = 0;
    let pose = {};
    let lift = 0;
    let count = null;
    let item = null;
    if (out > 0) {
      // Finish up and walk on past the bench.
      if (fox < BENCH + 50) speed = 8;
    } else {
      const off = s.at - fox;
      if (state.since == null && Math.abs(off) > 0.5) {
        speed = Math.sign(off) * Math.min(8, 2 + Math.abs(off) * 2);
        if (off < 0) pose.facing = -1;
      } else {
        state.since ??= t;
        const into = t - state.since;
        const e = exercise(s, into, Y, time);
        pose = e.pose;
        lift = e.lift;
        count = e.count;
        item = pose.item;
        delete pose.item;
        if (into >= setLength(s)) {
          state.step++;
          state.since = null;
          s = ROUTINE[state.step % ROUTINE.length];
        }
      }
    }

    // A training partner on the lower bar, some sessions.
    const bubbles = [];
    const partner = c.seed % 2 === 0 && out === 0
      ? visitor({ ...c, t: t - 20 }, {
          species: c.seed % 4 === 0 ? 'bear' : 'bunny',
          arrive: 0,
          stay: 600,
          spot: (LOW.from + LOW.to) / 2 + 1,
          dress: dressFor(c),
          settle: (u) => {
            const cycle = u % 14;
            if (cycle < 8) {
              const p = (cycle % 2.6) / 2.6;
              const up = p < 0.42 ? seg(p, 0, 0.42) : p < 0.55 ? 1 : 1 - seg(p, 0.55, 1);
              const front1 = -16 + up * 13;
              return { legs: 'hang', front: [1, front1], back: [0, front1], eyes: up > 0.9 ? 'closed' : 'focus', bob: -(LOW.y - 11 + front1), facing: -1 };
            }
            return { eyes: 'open', facing: -1, front: cycle > 11 && s.kind !== 'rest' ? [3 + Math.round(Math.sin(time * 9)), -10] : [2, 5] };
          },
        })
      : null;
    if (partner?.phase === 'here') {
      const cycle = partner.settled % 14;
      const cheer = cycle > 11 && s.kind !== 'rest' ? ['NICE FORM!', 'ONE MORE!', 'STRONG!', "LET'S GO!"][Math.floor(partner.settled / 14) % 4] : null;
      if (cheer) bubbles.push(() => bubble(canvas, partner.head[0], partner.head[1], cheer, (cycle - 11) / 0.5, 'right'));
    }
    if (count) bubbles.push((paws) => bubble(canvas, paws.top[0] + (pose.turn === 90 ? 8 : 0), pose.turn ? Y - 26 : paws.top[1], count));

    return {
      pose,
      speed,
      lift,
      after(paws) {
        if (item === 'bottle') canvas.draw(BOTTLE, paws.backPaw[0] - 1, paws.backPaw[1] - 3);
        else canvas.draw(BOTTLE, X + BENCH + 30, Y - 12);
        for (const b of bubbles) b(paws);
      },
    };
  },
};
