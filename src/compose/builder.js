// Assembles a track's Strudel code from named layers and an arrangement.
//
// Mixing conventions shared by every style:
// - each role (sub, kick, stab, ...) has a level, multiplied by the preset's
//   calibration so any preset lands at the same loudness for its role;
// - effects live on fixed orbits with constant settings per orbit, so
//   superdough never regenerates an impulse response mid-track:
//   1 drums (almost dry), 2 harmony (short dark room and dotted echo, ducked),
//   3 bass (dry, ducked), 4 melody (longer echo and room, lightly ducked).
//   Rooms stay small and dark: long halls fill the gaps between stabs, and
//   those gaps are what separate the reference mixes from a wall of sound.
import { calibrated } from './instruments.js';
import { num } from './mini.js';

// superdough's duck gain is 1 - sqrt(depth); this is the depth for a dB target.
const duckDepth = (db) => (1 - Math.pow(10, -db / 20)) ** 2;

export function createBuilder({ rng, levels, swing = 0.1, echo: harmonyEcho = 0.24 }) {
  const lines = [];
  const room = rng.step(0.22, 0.34, 0.02);
  const size = rng.step(1.6, 2.4, 0.2);
  const echo = rng.pick(['3/16', '3/16', '1/8']);
  const bus = {
    drums: '.room(.1).roomsize(1).roomlp(6000).roomdim(1500).orbit(1)',
    harmony: `.delay(${num(harmonyEcho)}).delaysync(${echo}).delayfeedback(.32).room(${num(room)}).roomsize(${num(size)}).roomlp(3800).roomdim(800).orbit(2)`,
    bass: '.orbit(3)',
    fx: `.delay(.38).delaysync(${echo}).delayfeedback(.44).room(${num(room + 0.06)}).roomsize(${num(size + 0.4)}).roomlp(4000).roomdim(900).orbit(4)`,
  };
  const gain = (role, id, scale = 1) => num((levels[role] ?? 0.5) * calibrated(id) * scale, 3);

  const b = {
    bus,
    swing: swing ? `.swingBy(${num(swing)}, 8)` : '',
    comment: (text) => lines.push(`\n// ${text}`),
    def: (name, code) => lines.push(`const ${name} = ${code}`),

    /** A chord part: `name(c)` plays the notes of `c`, on `struct` when given. */
    pattern(name, preset, { role = preset.role, struct, extra = '', on = 'harmony', scale = 1 } = {}) {
      const rhythm = struct ? `.struct("${struct}")` : '';
      b.def(name, `c => c${rhythm}${preset.chain(rng)}${extra}\n  .gain(${gain(role, preset.id, scale)})${bus[on]}`);
    },

    /** A note-pattern instrument: `name(n)` plays the notes of `n`. */
    notes(name, preset, { role = preset.role, extra = '', on, scale = 1 } = {}) {
      on ??= role === 'sub' || role === 'bass' ? 'bass' : 'fx';
      b.def(name, `n => n${preset.chain(rng)}${extra}\n  .gain(${gain(role, preset.id, scale)})${bus[on]}`);
    },

    /**
     * A drum part from a kit and a mini-notation rhythm using "x" for hits.
     * `humanize` varies velocity a little so loops do not sound machine-flat.
     */
    drum(name, kit, rhythm, { role, extra = '', on = 'drums', scale = 1, humanize = 0.15 } = {}) {
      const g = Number(gain(role, kit.id, scale));
      const level = humanize ? `perlin.range(${num(g * (1 - humanize), 3)}, ${num(g, 3)})` : num(g, 3);
      b.def(name, `s("${rhythm.replaceAll('x', kit.sound)}")${kit.mods}${extra}\n  .gain(${level})${bus[on]}`);
    },

    /** Sidechain the harmony, bass and melody orbits from a kick. Depths in dB. */
    duck({ harmony = 7, bass = 6, melody = 4, recover = 0.3 } = {}) {
      const depth = [harmony, bass, melody].map((db) => num(duckDepth(db))).join(':');
      return `.duckorbit("2:3:4").duckdepth("${depth}").duckattack("${num(recover)}:${num(recover * 0.8)}:${num(recover)}")`;
    },

    /** Final code: definitions followed by the arrangement. */
    code(sections) {
      const arrangement = sections.map(({ name, bars, stack }) => `  [${bars}, stack(\n    ${stack.join(',\n    ')}\n  )], // ${name}`);
      return `${lines.join('\n')}\n\narrange(\n${arrangement.join('\n')}\n)\n`;
    },
  };
  return b;
}
