// A calisthenics park: a pull-up bar, dip bars, a mat for push-ups,
// freestanding parallettes for handstand push-ups, and a bench. Each
// movement is built from its mechanics: hands
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
const LOW = { from: 34, to: 64, y: 40 }; // the friend's lower bar, joined to the tall post
const DIP = { from: 70, to: 92, y: 20 };
const PUSH = 120; // where the fox stands to drop into push-ups
const PARALLETTE = { x: 160, h: 8 };
const BENCH = 182;
const BOTTLE_AT = BENCH + 21;
// Keep hanging/support arms close to the fox's usual proportions. Push-up
// arms stay compact so the plank remains low to the mat.
const ARMS = { pullup: [7, 7], muscleup: [6, 6], dip: [7, 7], pushup: [6, 6], hspu: [9, 9] };

// The session: where each set happens, how many reps and how long each takes.
const ROUTINE = [
  { kind: 'pullup', at: 18, reps: 5, rep: 2.6 },
  { kind: 'shake', at: 18, time: 2.5 },
  { kind: 'dip', at: 81, reps: 6, rep: 2.2 },
  { kind: 'pushup', at: PUSH, reps: 8, rep: 1.8 },
  { kind: 'shake', at: PUSH, time: 2 },
  { kind: 'hspu', at: PARALLETTE.x - 9, reps: 4, rep: 2.8, mount: 2.2 },
  { kind: 'rest', at: BENCH + 10, time: 10 },
  { kind: 'muscleup', at: 18, reps: 2, rep: 4.2 },
  { kind: 'pullup', at: 18, reps: 3, rep: 2.6 },
  { kind: 'rest', at: BENCH + 10, time: 12 },
];
const MOUNT = 1.4; // seconds to get on (and off) the equipment, unless the set says
const setLength = (s) => (s.reps ? 2 * (s.mount ?? MOUNT) + s.reps * s.rep : s.time);

/** Rotate the little bottle about its cap, which stays at the mouth while sipping. */
function bottle(canvas, capX, capY, angle = 0) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const sx = Math.round(x * cos + y * sin) + 1;
    const sy = Math.round(-x * sin + y * cos);
    if (sx < 0 || sx >= BOTTLE.w || sy < 0 || sy >= BOTTLE.h) continue;
    const color = BOTTLE.data[sy * BOTTLE.w + sx];
    if (color !== 255) canvas.set(Math.round(capX) + x, Math.round(capY) + y, color);
  }
}

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
  // Low parallettes with open space for the freestanding kick-up.
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
    // Plant the hands on the parallettes, kick up tucked over them, then
    // balance with the legs stacked above the wrists (ears laid back).
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
      angle = Math.PI + Math.sin(time * 1.7) * 0.025;
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
  // Reach to the same bottle that was already on the bench. Lift its cap to
  // the lips, tilt the body, lower it, release it, then bring the hand back.
  const u = into;
  const lift = seg(u, 1.6, 2.4) * (1 - seg(u, 4.4, 5.25));
  const capX = lerp(X + BOTTLE_AT, fx + 8, lift);
  const capY = lerp(Y - 12, Y - 20, lift);
  const angle = -1.8 * lift + (lift > 0.99 ? Math.sin(time * 3) * 0.025 : 0);
  const reach = seg(u, 1, 1.6) * (1 - seg(u, 5.25, 5.7));
  const front = u >= 1.6 && u < 5.25
    ? [capX - Math.sin(angle) * 2.5 - fx - 3, capY + Math.cos(angle) * 2.5 - Y + 15]
    : [lerp(2, 8, reach), lerp(5, 5.5, reach)];
  const pose = { legs: 'sit', seat: 7, arms: false, front, back: [-2, 5], eyes: lift > 0.8 ? 'closed' : 'open', mouth: lift > 0.95 ? 'o' : 'smile', sweat: u < 2.5, nod: -0.05 * lift, ...extra };
  chars.arm(canvas, 'fox', [fx - 2, Y - 15], [fx - 4, Y - 10], 1, { back: true, upper: 5, fore: 5 });
  const paws = stand(pose);
  chars.arm(canvas, 'fox', [fx + 3, Y - 15], paws.frontPaw, 1, { upper: 6, fore: 6 });
  bottle(canvas, capX, capY, angle);
  return { paws, count: null };
}

export default {
  spec: { anchored: true, extent: [-20, BENCH + 50], intro: 2, outro: 4, light: 'day', frameAt: 108 },
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
      after() {
        if (set) {
          const { paws, count } = perform(c, set.s, set.into, c.foxX, Y, c.winter ? { winter: true } : {});
          if (count) bubbles.push(() => bubble(canvas, paws.top[0], Math.min(paws.top[1], paws.head[1] - 10), count));
        }
        if (set?.s.kind !== 'rest') bottle(canvas, X + BOTTLE_AT, Y - 12);
        for (const b of bubbles) b();
      },
    };
  },
};
