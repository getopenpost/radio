// Helpers that turn rhythmic note events into compact mini-notation.

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * One bar of events on a step grid as mini-notation.
 * events: [{ step, len, value }] with value a note name, sound or "[c3,e3]" chord.
 * Notes last until `len` steps; gaps become rests.
 */
export function barMini(events, steps = 16) {
  const sorted = [...events].sort((a, b) => a.step - b.step);
  const parts = [];
  let cursor = 0;
  for (const { step, len = 1, value } of sorted) {
    if (step < cursor) continue; // overlapping events are dropped
    if (step > cursor) parts.push(['~', step - cursor]);
    const length = Math.min(len, steps - step);
    parts.push([value, length]);
    cursor = step + length;
  }
  if (cursor < steps) parts.push(['~', steps - cursor]);
  // Merge consecutive rests.
  const merged = [];
  for (const part of parts) {
    if (part[0] === '~' && merged.at(-1)?.[0] === '~') merged.at(-1)[1] += part[1];
    else merged.push([...part]);
  }
  if (merged.length === 1) return merged[0][0];
  const divisor = merged.reduce((g, [, w]) => gcd(g, w), 0);
  return `[${merged.map(([v, w]) => (w / divisor === 1 ? v : `${v}@${w / divisor}`)).join(' ')}]`;
}

/**
 * Bars as an alternation, folding repeats: ["a", "a", "b"] -> "<a!2 b>".
 * With `tie`, repeats become one long event, so a held note is not struck again.
 */
export function barsMini(bars, { tie = false } = {}) {
  if (bars.length === 1) return bars[0];
  const parts = [];
  for (const bar of bars) {
    const last = parts.at(-1);
    if (last && last.bar === bar) last.count++;
    else parts.push({ bar, count: 1 });
  }
  if (parts.length === 1 && !tie) return parts[0].bar;
  return `<${parts.map(({ bar, count }) => (count > 1 ? `${bar}${tie ? '@' : '!'}${count}` : bar)).join(' ')}>`;
}

/** Compact numbers for generated code: 0.30000000004 -> "0.3". */
export const num = (x, digits = 3) => String(Number(x.toFixed(digits)));
