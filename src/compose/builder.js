// Assembles a track's Strudel code from named layers and an arrangement.
//
// Mixing conventions shared by every style:
// - each role (sub, kick, pad, ...) has a level, multiplied by the preset's
//   calibration so any preset lands at the same loudness for its role;
// - effects live on fixed orbits with constant reverb settings per orbit, so
//   superdough never regenerates an impulse response mid-track:
//   1 drums (small dark room), 2 harmony (large dark hall, ducked by the kick),
//   3 bass (dry, lightly ducked), 4 fx (tempo delay + hall; `hall` sends
//   there without the delay), 5 texture (dry).
import { calibrated } from './instruments.js';
import { num } from './mini.js';

export function createBuilder({ rng, levels }) {
  const lines = [];
  const hall = { room: rng.step(0.45, 0.75, 0.05), size: rng.step(4, 7, 0.5) };
  const delay = { amount: rng.step(0.25, 0.4, 0.05), sync: rng.pick(['3/16', '3/8', '1/4']), feedback: rng.step(0.35, 0.5, 0.05) };
  const bus = {
    drums: `.room(${num(rng.step(0.15, 0.3, 0.05))}).roomsize(1.4).roomlp(5000).roomdim(1200).orbit(1)`,
    harmony: `.room(${num(hall.room)}).roomsize(${num(hall.size)}).roomlp(3500).roomdim(700).orbit(2)`,
    bass: '.orbit(3)',
    fx: `.delay(${num(delay.amount)}).delaysync(${delay.sync}).delayfeedback(${num(delay.feedback)}).room(.45).roomsize(4).roomlp(4000).roomdim(900).orbit(4)`,
    hall: '.room(.6).roomsize(4).roomlp(4000).roomdim(900).orbit(4)', // the fx orbit's reverb without the delay
    texture: '.orbit(5)',
  };
  const gain = (role, id, scale = 1) => num((levels[role] ?? 0.5) * calibrated(id) * scale, 3);

  const b = {
    bus,
    comment: (text) => lines.push(`\n// ${text}`),
    def: (name, code) => lines.push(`const ${name} = ${code}`),

    /** A chord-pattern instrument: `name(c)` voices the chords of `c`. */
    chords(name, preset, { role = preset.role, anchor = 'a4', struct, extra = '', on = 'harmony', scale = 1 } = {}) {
      const rhythm = struct ? `.struct("${struct}")` : '';
      b.def(name, `c => c${rhythm}.anchor("${anchor}").voicing()${preset.chain(rng)}${extra}\n  .gain(${gain(role, preset.id, scale)})${bus[on]}`);
    },

    /** An arpeggio over the chords of `c`; `shape` indexes the voicing. */
    arp(name, preset, { shape, anchor = 'c5', extra = '', on = 'fx', scale = 1 } = {}) {
      b.def(name, `c => c.n("${shape}").anchor("${anchor}").voicing()${preset.chain(rng)}${extra}\n  .gain(${gain('arp', preset.id, scale)})${bus[on]}`);
    },

    /** A note-pattern instrument: `name(n)` plays the notes of `n`. */
    notes(name, preset, { role = preset.role, extra = '', on, scale = 1 } = {}) {
      on ??= role === 'sub' || role === 'bass' ? 'bass' : role === 'texture' ? 'texture' : 'fx';
      b.def(name, `n => n${preset.chain(rng)}${extra}\n  .gain(${gain(role, preset.id, scale)})${bus[on]}`);
    },

    /** A texture layer that needs no notes. */
    texture(name, preset, { scale = 1 } = {}) {
      b.def(name, `note("a3")${preset.chain(rng)}.gain(${gain('texture', preset.id, scale)})${bus.texture}`);
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

    /** Final code: definitions followed by the arrangement. */
    code(sections) {
      const arrangement = sections.map(({ name, bars, stack }) => `  [${bars}, stack(\n    ${stack.join(',\n    ')}\n  )], // ${name}`);
      return `${lines.join('\n')}\n\narrange(\n${arrangement.join('\n')}\n)\n`;
    },
  };
  return b;
}

/** Sidechain duck applied to a kick: pumps the harmony and, lightly, the bass. */
export function duck(rng, depth = rng.step(0.35, 0.6, 0.05)) {
  return `.duckorbit("2:3").duckdepth("${num(depth)}:${num(depth * 0.45)}").duckattack("${num(rng.step(0.22, 0.35, 0.01))}:0.15")`;
}
