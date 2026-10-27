// One connected work session. Positions use desktop fractions so input and
// painting share the same targets at every preview size. No animation resets
// its own pointer, and inactive windows keep their last document state.
import { clamp01, smooth } from './dither.js';

export const APPS = ['code', 'web', 'mail', 'globe', 'chat'];
export const WINDOWS = {
  code: { x: 0.045, y: 0.085, w: 0.86, h: 0.8 },
  web: { x: 0.105, y: 0.12, w: 0.84, h: 0.77 },
  mail: { x: 0.145, y: 0.1, w: 0.8, h: 0.79 },
  globe: { x: 0.06, y: 0.14, w: 0.86, h: 0.75 },
  chat: { x: 0.185, y: 0.17, w: 0.755, h: 0.72 },
};
export const dockPoint = (app) => [0.5 + (APPS.indexOf(app) - 2) * 0.065, 0.947];
const bodyPoint = (app, u, v) => {
  const b = WINDOWS[app];
  return [b.x + 0.018 + u * (b.w - 0.036), b.y + 0.078 + v * (b.h - 0.096)];
};
export const WORK = {
  code: { focus: 1.05, typing: 1.4, file: 13.6, fileReady: 13.72, secondTyping: 13.72, stopTyping: 24, run: 24.6, done: 25.4 },
  web: { focus: 0.95, loaded: 1.3, scroll1: 5.2, scroll1End: 6.1, scroll2: 10.8, scroll2End: 11.8, link: 14.2, articleReady: 14.45, articleScroll: 18.2, articleScrollEnd: 19.2, back: 23.4 },
  mail: { compose: 0.95, fields: 1.8, body: 3.8, send: 17.6, sent: 17.76, toastEnd: 20 },
  globe: { focus: 0.95, note1: 5.5, note2: 13, save: 22 },
  chat: { focus: 0.95, input: 8.4, typing: 8.6, send: 15.7, sent: 15.82, reply: 19 },
};
const STORY = [
  { app: 'code', seconds: 30 },
  { app: 'web', seconds: 26 },
  { app: 'code', seconds: 28 },
  { app: 'mail', seconds: 22 },
  { app: 'globe', seconds: 28 },
  { app: 'chat', seconds: 24 },
];
const DESKTOP_SECONDS = STORY.reduce((n, s) => n + s.seconds, 0);

const INPUT = {
  code: [[WORK.code.focus, 0.3, 0.02, true], [WORK.code.file, 0.07, 0.34, true], [WORK.code.run, 0.97, 0.02, true]],
  web: [[WORK.web.focus, 0.5, 0.025, true], [WORK.web.scroll1, 0.8, 0.64], [WORK.web.link, 0.32, 0.64, true], [WORK.web.articleScroll - 1, 0.92, 0.6], [WORK.web.back, 0.035, 0.025, true]],
  mail: [[WORK.mail.compose, 0.035, 0.1, true], [WORK.mail.fields, 0.38, 0.18, true], [WORK.mail.send, 0.88, 0.9, true]],
  globe: [[WORK.globe.focus, 0.3, 0.5, true], [WORK.globe.note1, 0.66, 0.84, true], [WORK.globe.note2, 0.68, 0.91, true], [WORK.globe.save, 0.92, 0.065, true]],
  chat: [[WORK.chat.focus, 0.07, 0.27, true], [WORK.chat.input, 0.46, 0.91, true], [WORK.chat.send, 0.93, 0.91, true]],
};

const events = [{ at: 0, point: dockPoint('code'), duration: 0 }];
let start = 0;
for (let i = 0; i < STORY.length; i++) {
  const s = STORY[i];
  s.start = start;
  for (const [at, x, y, click] of INPUT[s.app]) {
    if (at < s.seconds - 1) events.push({ at: start + at, point: bodyPoint(s.app, x, y), duration: 0.38, click });
  }
  events.push({ at: start + s.seconds - 0.18, point: dockPoint(STORY[(i + 1) % STORY.length].app), duration: 0.7, click: true });
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
    const begin = Math.max(previous.at + 0.12, e.at - Math.max(e.duration, distance * 1.8));
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
  return { app: current.app, elapsed, run, cycle, pointer, windows: windows.reverse() };
}
