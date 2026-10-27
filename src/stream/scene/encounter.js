// Friends on the path. Now and then someone walks the other way: usually
// the two wave and say hi in passing; sometimes both stop for a short chat
// in speech bubbles about how their work is going, then wave goodbye. In the
// rain they carry umbrellas or wear raincoats; in winter they wrap up.
import { bubble } from './bubbles.js';

const STRIDE = 12;
const MEET = 46; // how far apart they stand to talk
const GREET = 34; // close enough to raise a paw in passing
const GREET_FOR = 1.3; // a wave is a gesture, not a held-up hand
const BYE_FOR = 1.3;

// Lines alternate between the fox (a) and the friend (b), starting with `first`.
const CHATS = [
  { first: 'a', lines: ["HOW'S THE PROJECT?", 'SHIPPED IT TODAY!', 'CONGRATS!!', 'TIME FOR A WALK'] },
  { first: 'b', lines: ['STILL ON THAT BUG?', 'FIXED IT AT 2AM', 'LEGEND', 'COFFEE HELPED'] },
  { first: 'a', lines: ['WHAT ARE YOU MAKING?', 'A TINY GARDEN APP', 'LOVE THAT', 'FIRST USER TODAY!'] },
  { first: 'b', lines: ['TAKING A BREAK?', 'JUST STRETCHING', 'GOOD CALL', 'BACK TO IT SOON'] },
  { first: 'a', lines: ["HOW'S IT GOING?", 'SLOW BUT STEADY', 'THAT STILL COUNTS', 'THANKS, FRIEND'] },
  { first: 'b', lines: ['GOT A MINUTE?', "SURE, WHAT'S UP?", 'NEED A CODE REVIEW', 'SEND IT OVER!'] },
  { first: 'a', lines: ['YOU LOOK HAPPY!', 'ALL TESTS GREEN', 'BEST FEELING'] },
  { first: 'b', lines: ['WRITING TODAY?', '500 WORDS SO FAR', 'KEEP GOING!', 'WILL DO'] },
  { first: 'a', lines: ['NEW SKETCHES?', 'FINISHED THE LOGO', "CAN'T WAIT TO SEE", 'TOMORROW!'] },
  { first: 'b', lines: ['LEARNING ANYTHING?', 'A BIT OF RUST', 'NICE! HARD?', 'FUN THOUGH'] },
];
const RAIN = { first: 'a', lines: ['BIT WET TODAY', 'GOOD FOR FOCUS', 'TRUE, TRUE'] };
const LATE = { first: 'b', lines: ['STILL UP?', 'ONE LAST TASK', "DON'T STAY TOO LATE", 'PROMISE'] };
const MORNING = { first: 'a', lines: ['GOOD MORNING!', 'MORNING! COFFEE?', 'ALREADY HAD TWO', 'HAHA'] };

const lineTime = (text) => 1.4 + text.length * 0.09;

/**
 * A paw raised to say hello: up quickly, a couple of waggles, then back down.
 * Returns the paw position relative to the shoulder, or null once the gesture
 * is over (so the arm never stays up while they walk away).
 */
function wavePose(t, span, phase = 0) {
  if (t < 0 || t >= span) return null;
  const rise = Math.min(1, t / 0.16);
  const fall = Math.min(1, (span - t) / 0.3);
  const lift = Math.min(rise, fall);
  if (lift <= 0) return null;
  const waggle = Math.round(Math.sin(t * 13 + phase) * 2.2);
  return [2 + Math.round(lift) + Math.round(waggle * lift), Math.round(5 - 15 * lift)];
}

export function createEncounters(rng) {
  let npc = null;
  let next = 90;

  /**
   * Advance and draw the friend, if any.
   * @returns {{ pause: boolean, fox: object|null, bubbles: Function[] }} whether the fox
   *   should stop, pose changes for the fox, and bubbles to draw on top
   */
  function update(canvas, chars, { time, dt, speed, walking, foxX, y, rain, winter, hour, force, forceChat }) {
    if (!npc && walking && (time > next || force || forceChat)) {
      const chatty = forceChat ?? rng.chance(0.45);
      const script = rain > 0.3 && rng.chance(0.5) ? RAIN : hour < 4 || hour > 22.5 ? LATE : hour > 6 && hour < 10.5 && rng.chance(0.4) ? MORNING : rng.pick(CHATS);
      npc = {
        species: rng.chance(0.5) ? 'bunny' : 'bear',
        x: 664,
        walked: 0,
        chat: chatty ? script : null,
        phase: 'approach',
        since: time,
        gear: rain > 0.3 ? (rng.chance(0.5) ? 'umbrella' : 'raincoat') : null,
      };
      next = time + rng.int(200, 600);
    }
    if (!npc) return { pause: false, fox: null, bubbles: [] };

    const out = { pause: false, fox: null, bubbles: [] };
    const dress = { winter, raincoat: npc.gear === 'raincoat', umbrella: npc.gear === 'umbrella' ? -0.12 : undefined };
    let pose;
    if (npc.phase === 'approach' || npc.phase === 'go') {
      npc.walked += 7 * dt;
      npc.x -= (speed + 7) * dt;
      pose = { legs: 'walk', step: npc.walked / STRIDE, tail: Math.sin(npc.walked), eyes: 'open' };
      const gap = npc.x - foxX;
      if (npc.phase === 'approach' && npc.chat && gap <= MEET) {
        npc.phase = 'talk';
        npc.since = time;
      } else if (npc.phase === 'approach' && !npc.chat) {
        // Passing by: a short wave once they are close, dropped before they
        // walk on rather than held out the whole time they are in view.
        if (npc.greetAt == null && gap <= GREET) npc.greetAt = time;
        const g = npc.greetAt == null ? -1 : time - npc.greetAt;
        const mine = wavePose(g, GREET_FOR);
        const theirs = wavePose(g - 0.08, GREET_FOR, 1);
        if (mine) {
          pose.front = mine;
          pose.eyes = 'happy';
        }
        if (theirs) {
          out.fox = { front: theirs, eyes: 'happy', mouth: g > 0.3 ? 'smile' : 'open' };
        }
        if (g >= 0.05 && g < 0.75) out.bubbles.push((foxHead) => bubble(canvas, foxHead[0], foxHead[1], 'HEY!', (g - 0.05) / 0.35, 'left'));
        if (g >= 0.15 && g < 0.9) out.bubbles.push(() => bubble(canvas, npc.x - 2, y - 33, 'HI!', (g - 0.15) / 0.35, 'right'));
      }
      if (npc.x < -40) npc = null;
    }
    if (npc && (npc.phase === 'talk' || npc.phase === 'bye')) {
      npc.x -= speed * dt; // the ground is still coming to a stop
      out.pause = true;
      pose = { legs: 'stand', tail: Math.sin(time * 1.5), eyes: 'open' };
      out.fox = { eyes: 'open' };
      const t = time - npc.since;
      if (npc.phase === 'talk') {
        // Line by line, typed in, the speaker's mouth moving while it types.
        let at = 0.6;
        let speaking = null;
        const { lines, first } = npc.chat;
        for (let i = 0; i < lines.length; i++) {
          const d = lineTime(lines[i]);
          if (t >= at && t < at + d) speaking = { i, who: (i % 2 === 0) === (first === 'a') ? 'a' : 'b', into: t - at };
          at += d + 0.3;
        }
        if (t > at) {
          npc.phase = 'bye';
          npc.since = time;
        } else if (speaking) {
          const text = lines[speaking.i];
          const typed = Math.min(1, speaking.into / (text.length * 0.05));
          const talking = typed < 1 && Math.floor(time * 8) % 2 === 0 ? 'open' : 'smile';
          const listen = { headY: Math.floor(time * 2) % 4 === 0 ? 1 : 0 };
          if (speaking.who === 'a') {
            out.fox = { mouth: talking, eyes: 'open', front: [5, 1] };
            Object.assign(pose, listen);
            out.bubbles.push((foxHead) => bubble(canvas, foxHead[0], foxHead[1], text, typed, 'left'));
          } else {
            pose.mouth = talking;
            pose.front = [4, 0];
            out.fox = { ...listen, eyes: 'open' };
            out.bubbles.push(() => bubble(canvas, npc.x - 2, y - 33, text, typed, 'right'));
          }
          if (/!|HAHA|LEGEND|CONGRATS/.test(text) && typed >= 1) {
            if (speaking.who === 'a') pose.eyes = 'happy';
            else out.fox.eyes = 'happy';
          }
        }
      } else {
        // Goodbye: both wave, then the friend walks on and the fox sets off.
        const mine = wavePose(t, BYE_FOR);
        const theirs = wavePose(t - 0.08, BYE_FOR, 1);
        if (mine) {
          pose.front = mine;
          pose.eyes = 'happy';
        }
        if (theirs) out.fox = { front: theirs, eyes: 'happy', mouth: 'open' };
        if (t < 0.95) out.bubbles.push((foxHead) => bubble(canvas, foxHead[0], foxHead[1], 'SEE YOU!', t / 0.5, 'left'));
        if (t >= 0.35 && t < 1.25) out.bubbles.push(() => bubble(canvas, npc.x - 2, y - 33, 'BYE!', (t - 0.35) / 0.3, 'right'));
        if (t > 1.8) {
          npc.phase = 'go';
          out.pause = false;
        }
      }
    }
    if (npc) chars.draw(canvas, npc.species, Math.round(npc.x), y, -1, { ...pose, ...dress, umbrella: dress.umbrella });
    return out;
  }

  return { update, get active() { return npc; } };
}
