// Miniature app contents. The scene reads as a working desktop because every
// window shows real text: source files being typed, an article being read, a
// letter, a conversation and a page of notes. Body copy uses the 3x5 face so a
// whole paragraph fits; headings and code use the 5x7 face.
import { createCanvas } from './canvas.js';
import { clamp01, smooth } from './dither.js';
import { globe } from './globe.js';
import { WORK } from './desktop-timeline.js';
import { S } from './palette.js';
import { LINE, measure, text, wrap } from './text.js';
import { FILES } from './content/code.js';
import { MAIL } from './content/mail.js';
import { CHAT } from './content/chat.js';
import { NOTES } from './content/notes.js';
import { ARTICLE } from './content/article.js';

const GLOBE = { ...S, paper: S.uiToken, cloudShade: S.uiMuted, knit: S.uiTeal, knitDark: S.uiBorder, logo: S.uiAccent };
const ease = (a, b, p) => a + (b - a) * smooth(clamp01(p));
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}` : s);

const INK = S.uiInk;
const MUTED = S.uiMuted;
const PAPER = S.uiPaper;
const TOKEN = S.uiToken;
const GOLD = S.uiGold;
const TEAL = S.uiTeal;
const ACCENT = S.uiAccent;

/** Body copy in the 3x5 face. */
function body(c, x, y, str, color = INK, opts) {
  return text(c, x, y, str, color, { tiny: true, ...opts });
}

/** Headings and code in the 5x7 face. */
function label(c, x, y, str, color = INK, opts) {
  return text(c, x, y, str, color, opts);
}

/** A paragraph block, returning the height it used. */
function paragraph(c, x, y, str, width, color = INK, lead = LINE.tiny) {
  const rows = wrap(str, width, true);
  let yy = y;
  for (const row of rows) {
    body(c, x, yy, row, color);
    yy += lead;
  }
  return yy - y;
}

// ---- Code editor -----------------------------------------------------------

const CODE_RATE = 46; // characters per second
const CODE_LEAD = 9;
const files = new Map();

function fileTiming(file) {
  let cached = files.get(file.name);
  if (cached) return cached;
  let at = 0;
  let chars = 0;
  const lines = file.lines.map((tokens) => {
    const textLine = tokens.map(([, s]) => s).join('');
    const start = at;
    at += Math.max(0.22, textLine.length / CODE_RATE);
    chars += textLine.length;
    return { tokens, text: textLine, start, end: at };
  });
  cached = { lines, total: at, chars };
  files.set(file.name, cached);
  return cached;
}

function code(c, { x, y, w, h }, t, seed, document) {
  const action = WORK.code;
  c.rect(x, y, w, h, S.uiCode);
  const current = document % FILES.length;
  const file = t < action.fileReady ? current : (current + 1) % FILES.length;

  // Project rail.
  const rail = 36;
  c.rect(x, y, rail, h, S.uiRail);
  for (let i = 0; i < FILES.length; i++) {
    const ly = y + 8 + i * 13;
    const open = i === file || i === current;
    c.rect(x + 4, ly + 1, 3, 3, open ? TEAL : MUTED);
    body(c, x + 10, ly, cut(FILES[i].name.replace('.js', ''), 6), open ? PAPER : MUTED);
  }

  // Tabs for the two open files.
  c.rect(x + rail + 1, y, w - rail - 1, 9, S.uiRail);
  for (let i = 0; i < 2; i++) {
    const index = (current + i) % FILES.length;
    const on = index === file;
    const tx = x + rail + 2 + i * 58;
    c.rect(tx, y + 1, 56, 7, on ? S.uiInk : S.uiRail);
    c.rect(tx + 3, y + 3, 3, 3, on ? ACCENT : MUTED);
    body(c, tx + 9, y + 2, cut(FILES[index].name, 9), on ? TOKEN : MUTED);
  }

  const data = fileTiming(FILES[file]);
  const typing = file === current ? action.typing : action.secondTyping;
  const stop = file === current ? action.file - 0.45 : action.stopTyping;
  const typed = Math.max(0, Math.min(stop - typing, t - typing)) * CODE_RATE;

  let row = 0;
  let used = 0;
  while (row < data.lines.length - 1 && used + data.lines[row].text.length <= typed) {
    used += data.lines[row].text.length;
    row++;
  }
  const inRow = Math.max(0, Math.min(data.lines[row].text.length, typed - used));
  const complete = typed >= data.chars;

  // Keep the caret four lines from the bottom, as an editor does.
  const codeX = x + rail + 18;
  const visible = Math.floor((h - 20) / CODE_LEAD);
  const first = Math.max(0, row - (visible - 4));
  for (let i = first; i < Math.min(data.lines.length, first + visible); i++) {
    const ly = y + 11 + (i - first) * CODE_LEAD;
    const line = data.lines[i];
    body(c, codeX - 15, ly + 1, String(i + 1).padStart(2, ' '), MUTED);
    let lx = codeX;
    let left = i < row || complete ? Infinity : i === row ? inRow : 0;
    for (const [kind, token] of line.tokens) {
      const shown = left === Infinity ? token : token.slice(0, Math.max(0, Math.floor(left)));
      if (shown) {
        const color = kind === 'kw' ? ACCENT : kind === 'fn' ? TOKEN : kind === 'str' || kind === 'num' ? GOLD : kind === 'com' ? MUTED : PAPER;
        text(c, lx, ly, shown, color, { clip: x + w - 6 - lx });
      }
      lx += measure(token);
      left -= token.length;
    }
    if (i === row && !complete && t % 1 < 0.6) {
      const cx = Math.min(x + w - 6, codeX + measure(line.text.slice(0, Math.floor(inRow))));
      c.rect(cx, ly, 1, 7, TOKEN);
    }
  }

  // Footer: the run button, progress and the passing check.
  c.rect(x + rail, y + h - 7, w - rail, 7, S.uiRail);
  body(c, x + rail + 5, y + h - 6, t < action.run ? 'NODE  WATCH' : 'NODE  CHECK', TOKEN);
  if (t >= action.run) {
    const progress = clamp01((t - action.run) / (action.done - action.run));
    c.rect(x + w - 58, y + h - 4, Math.round(44 * progress), 1, progress < 1 ? GOLD : TEAL);
    if (progress === 1) {
      c.line(x + w - 12, y + h - 5, x + w - 10, y + h - 3, TOKEN);
      c.line(x + w - 10, y + h - 3, x + w - 6, y + h - 7, TOKEN);
    }
  } else {
    body(c, x + w - 44, y + h - 6, 'TEST 12 MS', MUTED);
  }
}

// ---- Browser ---------------------------------------------------------------

let homePage = null;
let articlePage = null;
const PAGE_H = 300;

function buildHome(w) {
  const p = createCanvas();
  p.rect(0, 0, w, PAGE_H, PAPER);
  body(p, 10, 7, ARTICLE.site, MUTED);
  // A hero photograph: a long swell under a pale sky.
  p.rect(10, 15, w - 20, 26, S.uiImage);
  for (let xx = 0; xx < w - 20; xx++) {
    const edge = 15 + 18 + Math.round(Math.sin(xx * 0.06) * 4);
    p.rect(10 + xx, edge, 1, 41 - edge, S.uiImageDark);
  }
  label(p, 10, 46, cut(ARTICLE.title, 42), INK);
  body(p, 10, 56, ARTICLE.byline, MUTED);
  // Search results.
  const rows = ARTICLE.results;
  for (let i = 0; i < rows.length; i++) {
    const ry = 72 + i * 30;
    p.rect(10, ry, 18, 16, S.uiSelected);
    for (let xx = 1; xx < 18; xx++) {
      const ridge = ry + 11 - Math.round(Math.sin(xx * 0.4 + i * 2) * 3);
      p.rect(10 + xx, ridge, 1, ry + 16 - ridge, S.uiImageDark);
    }
    body(p, 33, ry + 1, rows[i].title, INK);
    body(p, 33, ry + 8, rows[i].domain, MUTED);
    p.rect(33, ry + 14, 34, 1, ACCENT);
  }
  body(p, 10, 170, 'MORE FROM FIELD NOTES', MUTED);
  for (let i = 0; i < 3; i++) {
    body(p, 10, 180 + i * 8, ['THE LONG TIDE OF AUTUMN', 'READING THE SKY AT NIGHT', 'A YEAR OF SMALL WEATHER'][i], INK);
  }
  return p;
}

function buildArticle(w) {
  const p = createCanvas();
  p.rect(0, 0, w, PAGE_H, PAPER);
  body(p, 10, 7, ARTICLE.site, MUTED);
  let y = 17;
  const title = wrap(ARTICLE.title, w - 24, false);
  for (const row of title) {
    label(p, 10, y, row, INK);
    y += LINE.big + 1;
  }
  body(p, 10, y + 1, ARTICLE.byline, MUTED);
  y += 12;
  p.rect(10, y, w - 20, 1, S.uiChrome);
  y += 7;
  for (const para of ARTICLE.paragraphs) {
    y += paragraph(p, 10, y, para, w - 22) + 4;
  }
  p.rect(10, y, w - 20, 1, S.uiChrome);
  body(p, 10, y + 5, 'MORE: HOW THE OCEAN MOVES HEAT', ACCENT);
  return p;
}

function browser(c, { x, y, w, h }, t, seed, document) {
  const action = WORK.web;
  homePage ??= buildHome(w);
  articlePage ??= buildArticle(w);
  c.rect(x, y, w, h, PAPER);
  c.rect(x, y, w, 9, S.uiChrome);
  c.line(x + 4, y + 4, x + 7, y + 2, INK);
  c.line(x + 4, y + 4, x + 7, y + 6, INK);
  c.rect(x + 15, y + 2, w - 30, 5, PAPER);
  const article = t >= action.link + 0.1 && t < action.back + 0.1;
  const site = 'oc.note';
  const path = article ? '/ocean-remembers-summer' : '/field-notes';
  const shown = Math.max(0, Math.floor((t - action.focus) * 40));
  body(c, x + 21, y + 3, cut(`${site}${path}`.slice(0, Math.min(shown, site.length + path.length)), 44), MUTED);
  const loading = t < action.loaded ? clamp01((t - action.focus) / (action.loaded - action.focus)) : t >= action.link && t < action.articleReady ? clamp01((t - action.link) / (action.articleReady - action.link)) : 1;
  if (loading < 1) c.rect(x, y + 9, Math.round(w * loading), 1, ACCENT);

  const homeScroll = t > action.back ? 0 : ease(0, 34, (t - action.scroll1) / (action.scroll1End - action.scroll1)) + ease(0, 52, (t - action.scroll2) / (action.scroll2End - action.scroll2));
  const articleScroll = article ? ease(0, 120, (t - action.articleScroll) / (action.articleScrollEnd - action.articleScroll)) : 0;
  const scroll = Math.round(article ? articleScroll : homeScroll);
  const page = article ? articlePage : homePage;
  const vh = h - 9;
  for (let dy = 0; dy < vh; dy++) {
    const sy = scroll + dy;
    if (sy >= PAGE_H) continue;
    c.index.set(page.index.subarray(sy * 640, sy * 640 + w), (y + 9 + dy) * 640 + x);
  }
  c.rect(x + w - 3, y + 2, 1, h - 4, S.uiChrome);
  const thumb = Math.round((scroll / (PAGE_H - vh)) * (h - 18));
  c.rect(x + w - 3, y + 4 + thumb, 1, 10, S.uiMuted);
}

// ---- Mail ------------------------------------------------------------------

function mail(c, { x, y, w, h }, t, seed) {
  const action = WORK.mail;
  c.rect(x, y, w, h, PAPER);
  c.rect(x, y, 23, h, S.uiChrome);
  c.rect(x + 4, y + 5, 12, 9, ACCENT);
  c.line(x + 7, y + 8, x + 12, y + 8, S.uiPaper);
  c.line(x + 7, y + 11, x + 12, y + 11, S.uiPaper);
  for (let i = 0; i < 4; i++) body(c, x + 5, y + 22 + i * 9, ['IN', 'SENT', 'DRAFTS'][i] ?? '', i === 0 ? INK : MUTED);
  const composing = t >= action.compose + 0.12 && t < action.sent;
  if (composing) {
    const letter = MAIL[0];
    body(c, x + 28, y + 5, 'TO', MUTED);
    body(c, x + 42, y + 5, letter.from, INK);
    body(c, x + 28, y + 13, 'RE', MUTED);
    body(c, x + 42, y + 13, cut(letter.subject, 33), INK);
    c.rect(x + 28, y + 20, w - 34, 1, S.uiChrome);
    const bodyWidth = w - 40;
    const all = wrap(letter.lines.join(' '), bodyWidth, true);
    const typed = Math.max(0, t - action.body) * 22;
    let left = typed;
    let ly = y + 25;
    for (const row of all) {
      if (left <= 0) break;
      body(c, x + 30, ly, row, INK, { reveal: left });
      left -= row.length;
      ly += LINE.tiny;
    }
    if (t > action.send - 2.5) {
      c.rect(x + w - 34, y + h - 12, 29, 9, t >= action.send ? TEAL : ACCENT);
      body(c, x + w - 27, y + h - 10, 'SEND', PAPER);
    }
  } else {
    for (let i = 0; i < MAIL.length; i++) {
      const letter = MAIL[i];
      const ly = y + 6 + i * 34;
      c.rect(x + 28, ly + 1, 5, 5, i === 0 ? ACCENT : MUTED);
      body(c, x + 38, ly, letter.from, i === 0 ? INK : MUTED);
      body(c, x + 38, ly + 7, cut(letter.subject, 30), MUTED);
      body(c, x + 38, ly + 14, cut(letter.lines[0], 34), MUTED);
      c.rect(x + 28, ly + 24, w - 34, 1, S.uiChrome);
    }
    body(c, x + 28, y + h - 10, `${MAIL.length} LETTERS`, MUTED);
    if (t > action.sent && t < action.toastEnd) {
      const rise = smooth(clamp01((t - action.sent) / 0.14)) * (1 - smooth(clamp01((t - action.toastEnd + 0.12) / 0.12)));
      const ty = Math.round(y + h - 4 - rise * 16);
      c.rect(x + w - 62, ty, 56, 12, S.uiImageDark);
      c.line(x + w - 56, ty + 6, x + w - 53, ty + 8, PAPER);
      c.line(x + w - 53, ty + 8, x + w - 49, ty + 3, PAPER);
      body(c, x + w - 44, ty + 4, 'SENT', PAPER);
    }
  }
}

// ---- Study: the globe and the notebook -------------------------------------

function study(c, { x, y, w, h }, t, seed, document) {
  const action = WORK.globe;
  c.rect(x, y, w, h, S.uiCode);
  const r = Math.min(24, h / 2 - 10);
  globe(c, x + r + 8, y + h / 2, r, t * 2.3 + document * 41, GLOBE);
  const nx = x + 62;
  c.rect(nx - 6, y + 6, 1, h - 12, S.uiBorder);
  label(c, nx, y + 4, NOTES.title, PAPER);
  c.rect(x + w - 16, y + 3, 8, 6, t >= action.save ? ACCENT : MUTED);
  if (t >= action.save) {
    c.line(x + w - 14, y + 6, x + w - 12, y + 8, PAPER);
    c.line(x + w - 12, y + 8, x + w - 9, y + 4, PAPER);
  }
  // Two notes arrive while the fox reads; the list keeps the newest in view.
  let total = NOTES.facts.length - 2;
  if (t >= action.note1 + 0.15) total++;
  if (t >= action.note2 + 0.15) total++;
  const width = w - (nx - x) - 8;
  const blocks = [];
  for (let i = 0; i < total; i++) {
    const rows = wrap(NOTES.facts[i].text, width, true);
    blocks.push({ i, rows, height: 6 + rows.length * LINE.tiny + 4 });
  }
  let used = 0;
  let first = blocks.length;
  while (first > 0 && used + blocks[first - 1].height <= h - 22) {
    first--;
    used += blocks[first].height;
  }
  let ly = y + 15;
  for (let k = first; k < blocks.length; k++) {
    const { i, rows } = blocks[k];
    body(c, nx, ly, cut(NOTES.facts[i].label, 9), TEAL);
    let ry = ly + 6;
    for (const row of rows) {
      body(c, nx, ry, row, PAPER);
      ry += LINE.tiny;
    }
    if (k === blocks.length - 1) c.rect(nx, ry + 1, Math.min(28, width), 1, ACCENT);
    ly = ry + 4;
  }
}

// ---- Chat ------------------------------------------------------------------

const CHAT_AT = [0.4, 2.1, 5.4, 7.8, 10.2, 12.4, 15.9, 18.6];

function chat(c, { x, y, w, h }, t, seed) {
  const action = WORK.chat;
  c.rect(x, y, w, h, PAPER);
  c.rect(x, y, 21, h, S.uiChrome);
  body(c, x + 4, y + 5, 'MAYA', INK);
  body(c, x + 4, y + 14, 'FOX', MUTED);
  c.rect(x + 4, y + 22, 13, 1, S.uiChrome);
  const shown = CHAT.filter((_, i) => t >= CHAT_AT[i]);
  const rows = Math.max(1, Math.floor((h - 26) / 17));
  const first = Math.max(0, shown.length - rows);
  const widths = [];
  for (const msg of shown) widths.push(wrap(msg.text, Math.floor(w * 0.52), true));
  for (let k = first; k < shown.length; k++) {
    const msg = shown[k];
    const own = msg.who.toLowerCase() === 'fox';
    const rowsText = widths[k];
    const bh = 6 + rowsText.length * LINE.tiny;
    const bw = Math.max(...rowsText.map((r) => measure(r, true))) + 10;
    const bx = own ? x + w - bw - 4 : x + 25;
    const by = y + 4 + (k - first) * 17;
    const top = Math.max(y + 2, by);
    const bottom = Math.min(y + h - 15, by + bh);
    if (bottom > top) {
      c.rect(bx, top, bw, bottom - top, own ? S.uiChrome : S.uiSelected);
      let ly = by + 3;
      for (const row of rowsText) {
        if (ly + 5 <= y + h - 14 && ly >= y + 2) body(c, bx + 5, ly, row, INK);
        ly += LINE.tiny;
      }
    }
  }
  c.rect(x + 24, y + h - 13, w - 29, 11, S.uiChrome);
  const draft = 'SHIPPED. GOING FOR A WALK';
  if (t >= action.input && t < action.sent) body(c, x + 28, y + h - 9, draft, INK, { reveal: Math.max(0, t - action.typing) * 16 });
  if (t >= action.sent) body(c, x + 28, y + h - 9, draft, MUTED);
  c.line(x + w - 12, y + h - 10, x + w - 8, y + h - 7, S.uiImageDark);
  c.line(x + w - 8, y + h - 7, x + w - 12, y + h - 4, S.uiImageDark);
}

export function paintApp(c, box, state, seed) {
  const variant = seed + state.document * 1103;
  ({ code, web: browser, mail, globe: study, chat })[state.app](c, box, state.elapsed, variant, state.document);
}
