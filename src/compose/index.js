// Turns (style, seed) into a complete Strudel track plus metadata.
import { createRng, hashString } from './rng.js';
import { camelot, keyName, MINOR_MODES, PROGRESSIONS, progressionBars } from './theory.js';
import { styles } from './styles/index.js';
import { makeTitle } from './titles.js';

function pickProgressions(rng, style) {
  const fits = (p) => p.moods.some((m) => style.moods.includes(m)) && style.modes.includes(p.mode);
  const pool = PROGRESSIONS.filter(fits);
  if (!pool.length) throw new Error(`no progressions for style ${style.id}`);
  const a = rng.pick(pool);
  const minor = MINOR_MODES.has(a.mode);
  // B shares A's tonic and major/minor family; it may borrow a neighbouring mode.
  const others = pool.filter((p) => p !== a && MINOR_MODES.has(p.mode) === minor);
  const b = others.length ? rng.pick(others) : a;
  return [a, b];
}

/**
 * @param {object} options
 * @param {string} options.style style id
 * @param {number} options.seed
 * @param {number} [options.tonic] force a key tonic (0-11), used for smooth transitions
 * @param {number} [options.bpm] force a tempo
 */
export function composeTrack({ style: styleId, seed, tonic, bpm }) {
  const style = styles[styleId];
  if (!style) throw new Error(`unknown style ${styleId}; known: ${Object.keys(styles).join(', ')}`);
  const rng = createRng(seed ^ hashString(styleId));
  const progressions = pickProgressions(rng, style);
  const key = { tonic: tonic ?? rng.int(0, 11), mode: progressions[0].mode };
  bpm ??= rng.int(style.bpm[0], style.bpm[1]);
  const title = makeTitle(createRng(seed ^ 0x5eed));

  const track = style.compose({ rng, key, bpm, progressions, title });
  const barSeconds = 240 / bpm;
  const bars = track.sections.reduce((sum, [, n]) => sum + n, 0);
  const id = `${styleId}-${seed}`;
  const header = [
    `// "${title}" · rgo-music ${style.label}`,
    `// ${bpm} bpm · ${keyName(key)} · seed ${seed}`,
    `// progressions: ${progressions.map((p) => `${p.id} (${progressionBars(p)} bars)`).join(', ')}`,
    `// arrangement: ${track.sections.map(([n, b]) => `${n} ${b}`).join(' · ')}`,
    '',
  ].join('\n');

  return {
    id,
    title,
    style: styleId,
    styleLabel: style.label,
    seed,
    bpm,
    key: { ...key, name: keyName(key), camelot: camelot(key) },
    energy: style.energy,
    bars,
    seconds: bars * barSeconds,
    introSeconds: track.introBars * barSeconds,
    outroSeconds: track.outroBars * barSeconds,
    instruments: track.instruments,
    code: header + track.code,
  };
}

export { styles };
