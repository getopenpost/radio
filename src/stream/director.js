// Chooses what plays next. Styles flow between neighbours (melodic and deep
// house trade places, broken beats and slow soul come as a change of pace),
// runs of one style are a few tracks long, keys stay compatible on the Camelot
// wheel, tempos stay close, and nothing repeats until most of the library has
// played.
import { keyDistance } from '../compose/theory.js';

// Relative chance of moving from a style (rows) to another (columns).
export const STYLE_FLOW = {
  melodic: { melodic: 6, deep: 3, broken: 1.5, slow: 1.2 },
  deep: { deep: 4, melodic: 3.5, broken: 1, slow: 1 },
  broken: { broken: 2, melodic: 3, deep: 1.5, slow: 0.8 },
  slow: { slow: 5, melodic: 1.5, deep: 1, broken: 0.5 },
};

// Late at night the stream leans calmer.
const NIGHT = { slow: 2, melodic: 1, deep: 1, broken: 0.6 };

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
