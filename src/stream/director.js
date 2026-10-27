// Chooses what plays next. Styles flow between neighbours (a block of focus
// can drift into garage or lofi, never jump from ambient straight into
// house), runs of one style are a few tracks long, keys stay compatible on
// the Camelot wheel, tempos stay close, and nothing repeats until most of the
// library has played.
import { keyDistance } from '../compose/theory.js';

// Relative chance of moving from a style (rows) to another (columns).
export const STYLE_FLOW = {
  focus: { focus: 6, garage: 2, cafe: 1.5, house: 1.5, lofi: 1.2, ambient: 1, wave: 1 },
  cafe: { cafe: 4, lofi: 2, focus: 1.5, ambient: 1, house: 0.6 },
  garage: { garage: 3, focus: 3, ambient: 1, house: 0.8, wave: 0.5 },
  house: { house: 3, focus: 2.5, garage: 1, wave: 1, cafe: 0.8 },
  lofi: { lofi: 4, cafe: 2.5, focus: 1.5, ambient: 1.5, wave: 0.5 },
  wave: { wave: 3, focus: 1.5, house: 1, ambient: 1, lofi: 0.5 },
  ambient: { ambient: 1, focus: 2, lofi: 1.5, cafe: 1.2, wave: 1, garage: 0.5 },
};

// Late at night the stream leans calmer.
const NIGHT = { ambient: 2, lofi: 1.5, cafe: 1.2, focus: 1, wave: 1, garage: 0.8, house: 0.5 };

export function createDirector({ rng, history = [], hourOf = () => new Date().getHours() }) {
  const played = [...history]; // most recent last: { id, style, at }
  let run = 0;

  function choose(catalog, current) {
    const byStyle = new Map();
    for (const t of catalog) byStyle.set(t.style, [...(byStyle.get(t.style) ?? []), t]);
    const recent = new Set(played.slice(-Math.floor(catalog.length * 0.6)).map((p) => p.id));
    const hour = hourOf();
    const night = hour < 6 || hour >= 23;

    const flow = current ? STYLE_FLOW[current.style] ?? {} : Object.fromEntries(Object.keys(STYLE_FLOW).map((s) => [s, 1]));
    const styleWeights = [];
    for (const [style, base] of Object.entries(flow)) {
      const fresh = (byStyle.get(style) ?? []).filter((t) => !recent.has(t.id));
      if (!fresh.length) continue;
      let w = base * (night ? NIGHT[style] ?? 1 : 1);
      if (current && style === current.style) w *= run < 2 ? 2 : run >= 5 ? 0.15 : 1;
      styleWeights.push([w, style]);
    }
    // Small or exhausted library: fall back to whatever played least recently.
    if (!styleWeights.length) {
      const order = new Map(played.map((p, i) => [p.id, i]));
      return [...catalog].sort((a, b) => (order.get(a.id) ?? -1) - (order.get(b.id) ?? -1))[0];
    }
    const style = rng.weighted(styleWeights);
    const candidates = byStyle.get(style).filter((t) => !recent.has(t.id) && t.id !== current?.id);
    const scored = candidates.map((t) => [current ? fit(current, t) : 1, t]);
    return rng.weighted(scored);
  }

  return {
    next(catalog, current) {
      const track = choose(catalog, current);
      run = current && track.style === current.style ? run + 1 : 0;
      played.push({ id: track.id, style: track.style, at: Date.now() });
      if (played.length > 5000) played.splice(0, played.length - 5000);
      return track;
    },
    history: () => played,
  };
}

/** How well `next` follows `current`: compatible key, nearby tempo, similar energy. */
export function fit(current, next) {
  const key = [3, 2, 1, 0.3, 0.1][Math.min(4, keyDistance(current.key, next.key))];
  const ratio = next.bpm / current.bpm;
  const tempo = Math.max(...[1, 2, 0.5].map((r) => Math.exp(-Math.abs(Math.log2(ratio / r)) * 6)));
  const energy = Math.exp(-Math.abs((next.energy ?? 3) - (current.energy ?? 3)) / 2);
  return key * (0.3 + tempo) * energy;
}
