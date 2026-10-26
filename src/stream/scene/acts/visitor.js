// A friend who joins the fox for a while: walks in from the right edge of
// the frame, settles at a spot in the set, and later walks off to the right.
const PACE = 10;
const STRIDE = 12;

/**
 * Draw the visitor for activity context `c`, or nothing outside its visit.
 * @param {object} v
 * @param {'bunny'|'bear'} v.species
 * @param {number} v.arrive  activity time when it appears at the right edge
 * @param {number} v.stay    seconds it stays once settled
 * @param {number} v.spot    where it settles, in set coordinates
 * @param {(settled: number) => object} v.settle pose while settled, given seconds since settling
 * @param {object} [v.dress] outfit (winter, raincoat)
 * @returns {null | { phase: 'in'|'here'|'out', x: number, settled: number, head: [number, number] }}
 */
export function visitor(c, { species, arrive, stay, spot, settle, dress = {} }) {
  const { canvas, chars, X, Y, t } = c;
  if (t < arrive) return null;
  const from = 664 - X;
  const walkIn = Math.max(0, (from - spot) / PACE);
  let x;
  let pose;
  let facing = -1;
  let phase;
  let settled = 0;
  if (t < arrive + walkIn) {
    x = from - (t - arrive) * PACE;
    pose = { legs: 'walk', step: ((t - arrive) * PACE) / STRIDE, tail: Math.sin(t * 3) };
    phase = 'in';
  } else if (t < arrive + walkIn + stay) {
    x = spot;
    settled = t - arrive - walkIn;
    pose = settle(settled);
    phase = 'here';
  } else {
    const w = t - arrive - walkIn - stay;
    x = spot + w * PACE;
    facing = 1;
    pose = { legs: 'walk', step: (w * PACE) / STRIDE, tail: Math.sin(t * 3), front: w < 1.5 ? [3 + Math.round(Math.sin(t * 9)), -10] : undefined, eyes: w < 1.5 ? 'happy' : 'open' };
    phase = 'out';
    if (X + x > 680) return null;
  }
  const paws = chars.draw(canvas, species, Math.round(X + x), Y, pose.facing ?? facing, { ...dress, ...pose });
  return { phase, x, settled, head: paws.top, paws };
}

/** What a visitor should wear for the weather. */
export const dressFor = (c) => ({ winter: c.season === 'winter', raincoat: c.rain > 0.3 });
