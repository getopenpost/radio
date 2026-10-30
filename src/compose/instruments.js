// Instrument presets grouped by role. A preset is a Strudel method chain that
// styles append to a note or chord pattern. Presets carry no gain: styles set
// levels per role and calibration.json evens out each preset's loudness, so
// any combination of presets lands at a predictable mix balance.
//
// Chord roles (pad, keys) receive voiced notes from the composer.
// Drum presets give a sound name plus modifiers for a mini-notation grid.
import calibration from './calibration.json' with { type: 'json' };

const p = (id, role, tags, chain, extra = {}) => ({ id, role, tags, chain, ...extra });

// Doubled a few cents apart and a few milliseconds late on the far side: the
// width of a stereo chorus, without the beating of a wider detune.
const wide = (cents = 0.05) => `.layer(y => y.pan(.12), y => y.add(note(${cents})).late(.008).pan(.88))`;

export const PRESETS = [
  // Sub: one held note under everything, with enough harmonics to read on
  // small speakers. The quiet layer has its own velocity because repeated
  // gain setters override each other.
  p('sub.round', 'sub', ['house'], () => '.layer(x => x.s("sine"), x => x.s("sawtooth").lpf(210).hpf(60).velocity(.5)).attack(.008).sustain(1).release(.06)'),
  p('sub.pure', 'sub', ['soul'], () => '.s("sine").attack(.01).sustain(1).release(.1)'),
  p('sub.warm', 'sub', ['house'], () => '.layer(x => x.s("sine"), x => x.s("triangle").add(note(12)).lpf(300).velocity(.4)).attack(.008).sustain(1).release(.06)'),

  // Bass: the moving part, short notes with a filter snap.
  p('bass.pluck', 'bass', ['house'], (r) => `.s("sawtooth").attack(.002).decay(.14).sustain(0).release(.05).lpf(${r.int(18, 24) * 10}).lpenv(4.5).lpdecay(.11).lpq(${r.step(2, 3.5, 0.5)}).hpf(90)`),
  p('bass.rubber', 'bass', ['house'], () => '.s("square").attack(.002).decay(.16).sustain(.1).release(.06).lpf(260).lpenv(3).lpdecay(.09).lpq(2).hpf(80)'),
  p('bass.round', 'bass', ['house'], () => '.s("triangle").attack(.004).decay(.18).sustain(.2).release(.06).lpf(520).hpf(70)'),
  p('bass.finger', 'bass', ['soul'], () => '.s("gm_electric_bass_finger").lpf(900).hpf(50).release(.08)'),
  p('bass.fretless', 'bass', ['soul'], () => '.s("gm_fretless_bass").lpf(800).hpf(50).release(.12)'),

  // Stabs: the rhythmic chord part. Short, filtered, wide.
  p('keys.saw', 'keys', ['house'], () => `.s("sawtooth").attack(.003).decay(.2).sustain(0).release(.12).lpf(560).lpenv(3).lpdecay(.14).lpq(1.2)${wide()}.hpf(190)`),
  p('keys.saw-soft', 'keys', ['house'], () => `.s("sawtooth").attack(.006).decay(.3).sustain(.05).release(.18).lpf(480).lpenv(2.2).lpdecay(.2).lpq(.8)${wide()}.hpf(190)`),
  p('keys.ep', 'keys', ['house', 'soul'], () => `.s("gm_epiano1:1").attack(.002).release(.18).clip(2.2)${wide()}.hpf(170)`),
  p('keys.fm', 'keys', ['house', 'soul'], () => `.s("sine").fm(1.2).fmh(1).fmdecay(.28).fmsustain(.1).attack(.002).decay(.42).sustain(.12).release(.2).clip(2.5)${wide()}.hpf(170)`),
  p('keys.piano', 'keys', ['house'], () => `.s("piano").release(.2).clip(2.5)${wide(0.03)}.hpf(170)`),
  p('keys.organ', 'keys', ['house'], () => `.s("gm_drawbar_organ").attack(.002).release(.1).clip(1.5)${wide()}.hpf(190)`),
  p('keys.rhodes', 'keys', ['soul'], () => `.s("gm_epiano1").attack(.003).release(.22)${wide(0.04)}.hpf(140)`),

  // Held chords: the breakdown and the intro. Slow enough to leave the attack to the stabs.
  p('pad.saw', 'pad', ['house'], () => `.s("sawtooth").attack(.4).decay(.6).sustain(.8).release(1.2).lpq(.7)${wide(0.06)}.hpf(180)`),
  p('pad.strings', 'pad', ['house'], () => `.s("gm_string_ensemble_1").attack(.5).release(1.4)${wide(0.04)}.hpf(180)`),
  p('pad.choir', 'pad', ['house'], () => `.s("gm_pad_choir").attack(.6).release(1.4)${wide(0.04)}.hpf(180)`),
  p('pad.warm', 'pad', ['soul'], () => `.s("gm_pad_warm").attack(.6).release(1.6)${wide(0.04)}.hpf(160)`),

  // Hooks: one short tone through the echo.
  p('lead.pluck', 'lead', ['house'], () => '.s("triangle").attack(.002).decay(.16).sustain(0).release(.1).lpf(3000)'),
  p('lead.bell', 'lead', ['house'], () => '.s("sine").fm(2).fmh(2).fmdecay(.09).fmsustain(0).attack(.002).decay(.3).sustain(0).release(.2)'),
  p('lead.piano', 'lead', ['house'], () => '.s("piano").release(.3).lpf(3200)'),
  p('lead.ep', 'lead', ['soul'], () => '.s("gm_epiano1:1").release(.3).lpf(1900)'),
  p('lead.guitar', 'lead', ['soul'], () => '.s("gm_electric_guitar_clean").release(.2).lpf(1800)'),
];

export const KITS = {
  kick: [
    { id: 'kick.deep', sound: 'kick_deep', mods: '', tags: ['deep', 'melodic'] },
    { id: 'kick.punch', sound: 'kick_punch', mods: '', tags: ['melodic'] },
    { id: 'kick.round', sound: 'kick_round', mods: '', tags: ['soul'] },
  ],
  snare: [
    { id: 'clap.tight', sound: 'clap_tight', mods: '', tags: ['deep', 'melodic'] },
    { id: 'clap.soft', sound: 'clap_soft', mods: '', tags: ['deep', 'melodic', 'soul'] },
    { id: 'clap.909', sound: 'cp', mods: '.bank("RolandTR909").n(2).hpf(400)', tags: ['deep'] },
    { id: 'snare.rim', sound: 'rim_wood', mods: '', tags: ['soul'] },
    { id: 'snare.mpc', sound: 'sd', mods: '.bank("AkaiMPC60").n(1).hpf(180).lpf(3600)', tags: ['soul'] },
    { id: 'snare.sp12', sound: 'sd', mods: '.bank("EmuSP12").n(9).hpf(180).lpf(3400)', tags: ['soul'] },
  ],
  hat: [
    { id: 'hat.offbeat', sound: 'hat_offbeat', mods: '', tags: ['deep', 'melodic'] },
    { id: 'hat.tight', sound: 'hat_closed', mods: '.lpf(7000)', tags: ['soul'] },
    { id: 'hat.909', sound: 'oh', mods: '.bank("RolandTR909").n(1).decay(.09).hpf(6000)', tags: ['deep', 'melodic'] },
  ],
  tick: [{ id: 'tick.closed', sound: 'hat_closed', mods: '', tags: ['deep', 'melodic', 'soul'] }],
  openhat: [{ id: 'oh.long', sound: 'hat_open', mods: '', tags: ['deep', 'melodic', 'soul'] }],
  perc: [
    { id: 'perc.rim', sound: 'rim_wood', mods: '', tags: ['deep', 'melodic', 'soul'] },
    { id: 'perc.conga', sound: 'conga', mods: '.n(1).lpf(2400)', tags: ['deep', 'soul'] },
    { id: 'perc.bongo', sound: 'bongo', mods: '.lpf(3000)', tags: ['deep', 'soul'] },
  ],
};

export const presetsByRole = (role) => PRESETS.filter((x) => x.role === role);

/** Pick a preset for a role by shared tags, or from an explicit list of preset ids. */
export function pickPreset(rng, role, tags = [], exclude = []) {
  const items = presetsByRole(role).filter((x) => !exclude.includes(x.id));
  if (tags.length && tags.every((t) => t.includes('.'))) {
    const named = items.filter((x) => tags.includes(x.id));
    if (named.length) return rng.pick(named);
  }
  return pickTagged(rng, items, tags);
}

export function pickKit(rng, part, tags = []) {
  return pickTagged(rng, KITS[part], tags);
}

// Only items sharing a tag with the style are eligible (if any do); more
// shared tags make an item more likely.
function pickTagged(rng, items, tags) {
  const scored = items.map((x) => [x.tags.filter((t) => tags.includes(t)).length, x]);
  const matching = scored.filter(([n]) => n > 0);
  return rng.weighted((matching.length ? matching : scored).map(([n, x]) => [1 + 2 * n, x]));
}

/** Gain multiplier that brings a preset to its role's reference loudness. */
export const calibrated = (id) => calibration[id] ?? 1;
