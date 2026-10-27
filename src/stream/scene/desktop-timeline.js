// One connected work session. Positions use desktop fractions so input and
// painting share the same targets at every preview size. No animation resets
// its own pointer, and inactive windows keep their last document state.
import { clamp01, smooth } from './dither.js';

export const APPS = ['code', 'web', 'mail', 'globe', 'chat'];
export const WINDOWS = {
  code: { x: 0.055, y: 0.09, w: 0.84, h: 0.78 },
  web: { x: 0.12, y: 0.145, w: 0.83, h: 0.75 },
  mail: { x: 0.165, y: 0.11, w: 0.77, h: 0.78 },
  globe: { x: 0.07, y: 0.16, w: 0.85, h: 0.72 },
  chat: { x: 0.22, y: 0.18, w: 0.72, h: 0.68 },
};
export const dockPoint = (app) => [0.5 + (APPS.indexOf(app) - 2) * 0.065, 0.947];
const bodyPoint = (app, u, v) => {
  const b = WINDOWS[app];
  return [b.x + 0.018 + u * (b.w - 0.036), b.y + 0.078 + v * (b.h - 0.096)];
};
const STORY = [
  { app: 'code', seconds: 48 },
  { app: 'web', seconds: 34 },
  { app: 'code', seconds: 42 },
  { app: 'mail', seconds: 28 },
  { app: 'globe', seconds: 34 },
  { app: 'chat', seconds: 30 },
];
const DESKTOP_SECONDS = STORY.reduce((n, s) => n + s.seconds, 0);

const INPUT = {
  code: [[2, 0.3, 0.02, true], [23, 0.07, 0.28, true], [38.5, 0.95, 0.02, true]],
  web: [[2, 0.5, 0.025, true], [8, 0.8, 0.64], [17.8, 0.32, 0.64, true], [20, 0.92, 0.6], [29, 0.035, 0.025, true]],
  mail: [[2, 0.075, 0.12, true], [3.5, 0.38, 0.18, true], [20, 0.88, 0.9, true]],
  globe: [[2.3, 0.3, 0.5, true], [10, 0.66, 0.3, true], [18, 0.68, 0.58, true], [28, 0.92, 0.12, true]],
  chat: [[2, 0.07, 0.27, true], [10, 0.46, 0.91, true], [19.3, 0.93, 0.91, true]],
};

const events = [{ at: 0, point: dockPoint('code'), duration: 0 }];
let start = 0;
for (let i = 0; i < STORY.length; i++) {
  const s = STORY[i];
  s.start = start;
  for (const [at, x, y, click] of INPUT[s.app]) {
    if (at < s.seconds - 3) events.push({ at: start + at, point: bodyPoint(s.app, x, y), duration: 0.75, click });
  }
  events.push({ at: start + s.seconds - 0.65, point: dockPoint(STORY[(i + 1) % STORY.length].app), duration: 1.1, click: true });
  start += s.seconds;
}

export function desktopAt(seconds) {
  const cycle = Math.floor(seconds / DESKTOP_SECONDS);
  const t = ((seconds % DESKTOP_SECONDS) + DESKTOP_SECONDS) % DESKTOP_SECONDS;
  let run = STORY.length - 1;
  while (STORY[run].start > t) run--;
  const current = STORY[run];
  const elapsed = t - current.start;
  let previous = events[0];
  let pointer = { x: previous.point[0], y: previous.point[1], pressed: false };
  for (let i = 1; i < events.length; i++) {
    const e = events[i];
    const distance = Math.hypot(e.point[0] - previous.point[0], e.point[1] - previous.point[1]);
    const begin = Math.max(previous.at + 0.25, e.at - Math.max(e.duration, distance * 2.5));
    if (t < begin) break;
    const p = smooth(clamp01((t - begin) / (e.at - begin)));
    // A shallow arc, slowing to settle on the control, then staying there.
    const dx = e.point[0] - previous.point[0];
    const dy = e.point[1] - previous.point[1];
    const arc = Math.sin(Math.PI * p) * 0.045;
    pointer = { x: previous.point[0] + dx * p - dy * arc, y: previous.point[1] + dy * p + dx * arc, pressed: Boolean(e.click && t >= e.at && t < e.at + 0.12) };
    if (t < e.at) break;
    previous = e;
  }
  const windows = [];
  for (let ago = 0; windows.length < 3 && ago < STORY.length; ago++) {
    const index = (run - ago + STORY.length) % STORY.length;
    const s = STORY[index];
    if (windows.some((w) => w.app === s.app)) continue;
    const generation = cycle - (index > run ? 1 : 0);
    windows.push({ app: s.app, elapsed: ago === 0 ? elapsed : s.seconds, document: generation * 2 + (index === 2 ? 1 : 0), active: ago === 0 });
  }
  return { app: current.app, elapsed, run, cycle, pointer, windows: windows.reverse(), opening: smooth(clamp01(elapsed / 0.55)) };
}
