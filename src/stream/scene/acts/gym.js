// A calisthenics park: a pull-up bar, dip bars, a mat for push-ups,
// parallettes by a wall for handstand push-ups, and a bench. The camera moves
// in while the fox trains. Each movement is built from its mechanics: hands
// stay planted on the bar or the floor and the arms bend at the elbow to
// carry the body (drawn with `arm`), push-ups pivot on the toes, the handstand
// starts with a kick-up over the hands and ends by coming back down. Reps are
// counted in little bubbles; it rests with water between sets, and some
// sessions a friend trains on the lower bar and cheers.
import { bubble } from '../bubbles.js';
import { S } from '../palette.js';
import { BOTTLE, bench, lerp, seg, smooth } from './common.js';
import { dressFor, visitor } from './visitor.js';

const BAR = { from: 2, to: 34, y: 54 }; // pull-up bar: span and height above the ground
const LOW = { from: 40, to: 58, y: 40 }; // the friend's lower bar
const DIP = { from: 70, to: 92, y: 20 };
const PUSH = 120; // where the fox stands to drop into push-ups
const WALL = 168; // the wall face, with parallettes in front
const PARALLETTE = { x: 160, h: 8 };
const BENCH = 182;
// Arm lengths per movement (upper arm, forearm): long for hanging under the
// bar so the head clears it, short for push-ups so the plank stays low.
const ARMS = { pullup: [10, 10], muscleup: [10, 10], dip: [7, 7], pushup: [6, 6], hspu: [9, 9] };

// The session: where each set happens, how many reps and how long each takes.
const ROUTINE = [
  { kind: 'pullup', at: 18, reps: 5, rep: 2.6 },
  { kind: 'shake', at: 18, time: 4 },
  { kind: 'dip', at: 81, reps: 6, rep: 2.2 },
  { kind: 'pushup', at: PUSH, reps: 8, rep: 1.8 },
  { kind: 'shake', at: PUSH, time: 3 },
  { kind: 'hspu', at: PARALLETTE.x - 9, reps: 4, rep: 2.8, mount: 3 },
  { kind: 'rest', at: BENCH + 10, time: 18 },
  { kind: 'muscleup', at: 18, reps: 2, rep: 4.2 },
  { kind: 'pullup', at: 18, reps: 3, rep: 2.6 },
  { kind: 'rest', at: BENCH + 10, time: 22 },
];
const MOUNT = 1.4; // seconds to get on (and off) the equipment, unless the set says
const setLength = (s) => (s.reps ? 2 * (s.mount ?? MOUNT) + s.reps * s.rep : s.time);

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
  // A mat for push-ups.
  for (let x = PUSH - 22; x < PUSH + 10; x++) canvas.set(X + x, Y - 1, (x - PUSH) % 4 < 2 ? S.knit : S.knitDark);
  // A padded wall, and low parallettes in front of it.
  canvas.rect(X + WALL, Y - 46, 6, 46, S.trunk);
  for (let y = Y - 44; y < Y; y += 6) canvas.rect(X + WALL, y, 6, 1, S.bag);
  canvas.rect(X + PARALLETTE.x - 4, Y - PARALLETTE.h, 9, 2, S.metal);
  canvas.rect(X + PARALLETTE.x - 4, Y - PARALLETTE.h + 2, 1, PARALLETTE.h - 2, S.metalDark);
  canvas.rect(X + PARALLETTE.x + 4, Y - PARALLETTE.h + 2, 1, PARALLETTE.h - 2, S.metalDark);
  bench(canvas, X + BENCH, Y);
}

/** Solve a push-up angle (rotation about the toes) for a shoulder height. */
function pushupAngle(chars, height) {
  let lo = 0.6;
  let hi = 1.56;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const pose = { angle: mid, pivot: [0.5, 7], legs: 'plank' };
    const q = chars.transform(pose)(3, -11);
    const h = 7 - q[1]; // toes sit at local y 7
    if (h > height) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Draw the fox doing set `s`, `into` seconds in, at stand-point `fx` on
 * screen (the fox's normal spot) with ground `Y`. Returns { count } and draws
 * everything itself (back arm, body, front arm), so the caller hides its own fox.
 */
function perform(c, s, into, fx, Y, extra) {
  const { canvas, chars, time, X } = c;
  const reps = s.reps ?? 0;
  const mount = s.mount ?? MOUNT;
  const work = into - mount;
  const total = reps * s.rep;
  const p = reps && work >= 0 && work < total ? (work / s.rep) % 1 : null;
  const r = reps ? Math.min(reps - 1, Math.floor(Math.max(0, work) / s.rep)) : 0;
  const count = p != null && p > 0.6 && p < 0.95 ? String(r + 1) : null;
  const off = reps && work >= total ? Math.min(1, (work - total) / mount) : 0; // getting down
  const on = reps ? Math.min(1, into / mount) : 1; // getting on
  // A rep's effort curve: up (or down) over the first 45%, hold, back over the rest.
  const curve = p == null ? 0 : p < 0.42 ? smooth(p / 0.42) : p < 0.55 ? 1 : 1 - smooth((p - 0.55) / 0.45);
  const strain = curve > 0.85;
  const face = { eyes: strain ? 'closed' : 'focus', mouth: strain ? 'o' : 'smile', ...extra };

  const [upper, fore] = ARMS[s.kind] ?? [7, 7];
  const REACH = upper + fore;
  /** Place the body so its front shoulder lands at (sx, sy), then draw arms to the hands. */
  const body = (pose, sx, sy, hands, bend) => {
    const q = chars.transform(pose)(3, -11);
    const ox = sx - q[0];
    const oy = sy - q[1];
    const sh = chars.transform(pose)(-2, -11);
    chars.arm(canvas, 'fox', [ox + sh[0], oy + sh[1]], hands[1], bend, { back: true, upper, fore });
    const paws = chars.draw(canvas, 'fox', ox, oy, 1, { ...pose, arms: false });
    chars.arm(canvas, 'fox', [sx, sy], hands[0], bend, { upper, fore });
    return paws;
  };
  const stand = (pose) => chars.draw(canvas, 'fox', fx, Y, 1, pose);

  if (s.kind === 'pullup' || s.kind === 'muscleup') {
    const barY = Y - BAR.y;
    const hands = [[fx + 4, barY + 1], [fx - 1, barY + 1]];
    if (on < 0.4 || off > 0.6) return { paws: stand({ front: [2, -12], back: [1, -12], eyes: 'up', ...extra }), count: null };
    // Hang: shoulders a full arm below the bar; up: chin over it.
    const hang = barY + 1 + REACH;
    let sx = fx + 4;
    let sy = hang;
    let angle = 0;
    const bend = 1;
    if (on < 1) sy = lerp(Y - 11, sy, seg(on, 0.4, 1));
    else if (off > 0) sy = lerp(sy, Y - 11, seg(off, 0, 0.6));
    else if (s.kind === 'pullup') {
      sy = lerp(hang, barY + 2, curve);
      // The chest moves behind the grip on the way up. Elbows stay below
      // the shoulders at the top instead of folding sideways into the head.
      sx -= 10 * curve;
      angle = -0.1 * curve;
    } else {
      // Muscle-up: a high pull, the chest over the bar, a press to lockout, then back down.
      const k = p < 0.3 ? smooth(p / 0.3) * 0.5 : p < 0.55 ? 0.5 + smooth((p - 0.3) / 0.25) * 0.5 : p < 0.7 ? 1 : 1 - smooth((p - 0.7) / 0.3);
      if (k < 0.5) {
        sy = lerp(hang, barY + 2, k / 0.5);
        sx -= 10 * smooth(k / 0.5);
      } else {
        const press = (k - 0.5) / 0.5;
        sy = lerp(barY + 2, barY + 1 - REACH, press);
        sx -= 10 * (1 - smooth(press));
      }
      angle = k > 0.5 ? 0.22 * Math.sin((k - 0.5) * Math.PI * 2) : -0.1 * k * 2;
      if (k > 0.9 && p >= 0.55 && p < 0.7) Object.assign(face, { eyes: 'happy', mouth: 'open' });
    }
    const paws = body({ legs: 'hang', dangle: Math.sin(time * 2.2) * 0.5, angle, pivot: [3, -11], ...face }, sx, sy, hands, bend);
    return { paws, count };
  }
  if (s.kind === 'dip') {
    const barY = Y - DIP.y;
    const hands = [[fx + 2, barY], [fx, barY]];
    if (on < 0.4 || off > 0.6) return { paws: stand({ front: [3, 4], back: [2, 4], ...extra }), count: null };
    // Support: arms straight down; bottom: shoulders sink below the hands, elbows back, chest forward.
    let sy = lerp(barY - REACH + 0.5, barY + 2, curve);
    if (on < 1) sy = lerp(Y - 11, barY - REACH + 0.5, seg(on, 0.4, 1));
    else if (off > 0) sy = lerp(barY - REACH + 0.5, Y - 11, seg(off, 0, 0.6));
    const paws = body({ legs: 'tuck', angle: 0.28 * curve, pivot: [3, -11], ...face }, fx + 2, sy, hands, 1);
    return { paws, count };
  }
  if (s.kind === 'pushup') {
    if (on < 0.5 || off > 0.5) {
      const k = on < 0.5 ? on / 0.5 : 1 - (off - 0.5) / 0.5;
      return { paws: stand({ bob: Math.round(k * 3), front: [4, 6], back: [3, 6], ...extra }), count: null };
    }
    // A straight board from toes to shoulders, turning about the toes, hands
    // under the shoulders; the head stays up, looking just ahead of the paws,
    // and the chin comes down almost to the mat.
    const toeX = fx - 14;
    const height = lerp(REACH - 2.5, 5, curve);
    const angle = pushupAngle(chars, height);
    const pose = { angle, pivot: [0.5, 7], legs: 'plank', nod: 0.35 - angle, ...face };
    const q = chars.transform(pose);
    const ox = toeX - q(0.5, 7)[0];
    const oy = Y - 1 - q(0.5, 7)[1];
    const top = chars.transform({ ...pose, angle: pushupAngle(chars, REACH - 2.5) })(3, -11);
    const handX = toeX - 0.5 + top[0];
    const s1 = q(-2, -11);
    chars.arm(canvas, 'fox', [ox + s1[0], oy + s1[1]], [handX - 2, Y - 1], 1, { back: true, upper, fore });
    const paws = chars.draw(canvas, 'fox', ox, oy, 1, { ...pose, arms: false });
    const s0 = q(3, -11);
    chars.arm(canvas, 'fox', [ox + s0[0], oy + s0[1]], [handX, Y - 1], 1, { upper, fore });
    return { paws, count };
  }
  if (s.kind === 'hspu') {
    // Facing the wall: crouch and plant the hands on the parallettes, kick up
    // tucked over them, then stretch the legs to the wall (ears laid back).
    // Each rep lowers until the head nearly touches the floor between the
    // handles, then presses back up. Coming down runs the same in reverse.
    const hy = Y - PARALLETTE.h;
    const handX = X + PARALLETTE.x;
    const hands = [[handX + 1, hy], [handX - 1, hy]];
    const k = off > 0 ? 1 - off : on; // 0 standing, 1 in the handstand
    if (k < 0.15) return { paws: stand({ front: [3, 4], back: [2, 4], eyes: 'focus', ...extra }), count: null };
    const up = hy - REACH + 0.5; // arms locked out overhead
    const bottom = Y - 15; // the crown (ears laid back) a pixel off the floor
    const crouch = [handX - 6, Y - 9];
    let sx;
    let sy;
    let angle;
    let legs = 'tuck';
    if (k < 0.45) {
      // Lean in and reach down.
      const a = smooth(seg(k, 0.15, 0.45));
      sx = lerp(fx + 3, crouch[0], a);
      sy = lerp(Y - 11, crouch[1], a);
      angle = 0.55 * a;
    } else if (k < 0.85) {
      // The kick: hips swing up over the hands.
      const a = smooth(seg(k, 0.45, 0.85));
      sx = lerp(crouch[0], handX + 1, a);
      sy = lerp(crouch[1], up, a);
      angle = lerp(0.55, Math.PI, a);
    } else {
      sx = handX + 1;
      sy = up;
      angle = Math.PI;
      legs = 'hang';
    }
    if (k >= 1) sy = lerp(up, bottom, curve);
    const pose = { legs, angle, pivot: [3, -11], ears: angle > 2 ? 'back' : undefined, ...face };
    const paws = body(pose, sx, sy, hands, 1);
    return { paws, count };
  }
  if (s.kind === 'shake') {
    return { paws: stand({ eyes: 'closed', mouth: 'smile', front: [2 + Math.round(Math.sin(time * 12) * 2), 6], back: [-2 - Math.round(Math.sin(time * 12) * 2), 6], sweat: true, ...extra }), count: null };
  }
  // Rest on the bench: catch breath, drink, wipe the brow, smile.
  const u = into;
  const pose = { legs: 'sit', seat: 7, eyes: 'closed', sweat: u < 8, bob: Math.floor(time * 1.2) % 2, ...extra };
  let bottle = false;
  if (u > 3 && u < 7) {
    Object.assign(pose, { back: [5, -6], eyes: 'closed' });
    bottle = true;
  } else if (u > 9 && u < 11) Object.assign(pose, { front: [4, -13], eyes: 'closed', mouth: 'o' });
  else if (u > 11) Object.assign(pose, { eyes: 'open', mouth: 'smile' });
  const paws = stand(pose);
  if (bottle) canvas.draw(BOTTLE, paws.backPaw[0] - 1, paws.backPaw[1] - 3);
  return { paws, count: null };
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
    let walkPose = null;
    let set = null;
    if (out > 0) {
      if (fox < BENCH + 50) speed = 8;
    } else {
      const off = s.at - fox;
      if (state.since == null && Math.abs(off) > 0.5) {
        speed = Math.sign(off) * Math.min(8, 2 + Math.abs(off) * 2);
        if (off < 0) walkPose = { facing: -1 };
      } else {
        state.since ??= t;
        const into = t - state.since;
        set = { s, into };
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
              const up = p < 0.42 ? smooth(p / 0.42) : p < 0.55 ? 1 : 1 - smooth((p - 0.55) / 0.45);
              const front1 = -16 + up * 12;
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

    return {
      // While training the activity draws the fox itself (arms and all).
      pose: set ? { hidden: true } : walkPose ?? {},
      speed,
      zoom: out === 0 ? 1.6 : 1,
      after() {
        if (set) {
          const { paws, count } = perform(c, set.s, set.into, c.foxX, Y, c.winter ? { winter: true } : {});
          if (count) bubbles.push(() => bubble(canvas, paws.top[0], Math.min(paws.top[1], paws.head[1] - 10), count));
        }
        if (!(set?.s.kind === 'rest' && set.into > 3 && set.into < 7)) canvas.draw(BOTTLE, X + BENCH + 32, Y - 12);
        for (const b of bubbles) b();
      },
    };
  },
};
