// Instrument presets grouped by role. A preset is a Strudel method chain that
// styles append to a note or chord pattern. Presets carry no gain: styles set
// levels per role and calibration.json evens out each preset's loudness, so
// any combination of presets lands at a predictable mix balance.
//
// Chord roles (pad, keys) receive a chord pattern and voice it themselves.
// Drum presets give a sound name plus modifiers for a mini-notation grid.
import calibration from './calibration.json' with { type: 'json' };

const p = (id, role, tags, chain, extra = {}) => ({ id, role, tags, chain, ...extra });

export const PRESETS = [
  // Sub: mono foundation below ~80 Hz.
  p('sub.sine', 'sub', ['clean'], () => '.s("sine").attack(.02).decay(.3).sustain(.95).release(.25)'),
  p('sub.sine-harm', 'sub', ['warm'], () => '.s("sine").attack(.02).decay(.3).sustain(.95).release(.25).superimpose(x => x.add(note(12)).s("triangle").lpf(320).gain(.22))'),
  p('sub.tri', 'sub', ['warm'], () => '.s("triangle").lpf(160).attack(.02).decay(.3).sustain(.95).release(.2)'),
  p('sub.shaped', 'sub', ['warm', 'gritty'], () => '.s("sine").attack(.015).decay(.3).sustain(.9).release(.2).shape(.3)'),
  p('sub.808', 'sub', ['punchy'], () => '.s("sine").attack(.005).decay(.6).sustain(.7).release(.3).penv(7).pdecay(.06).shape(.2)'),

  // Bass: the moving low-register line, 60-400 Hz.
  p('bass.saw-pluck', 'bass', ['synth', 'dark'], (r) => `.s("sawtooth").attack(.005).decay(.25).sustain(.35).release(.12).lpf(${r.int(26, 40) * 10}).lpenv(${r.step(1.5, 3, 0.5)}).lpdecay(.18).lpq(${r.step(2, 6, 1)}).layer(x => x.pan(.3), x => x.add(note(.1)).pan(.7))`),
  p('bass.reese', 'bass', ['synth', 'dark', 'garage'], () => '.s("sawtooth").add(note("0,.18")).attack(.01).sustain(.8).release(.15).lpf(260).lpsync(4).lpdepth(.5).lpq(2)'),
  p('bass.square', 'bass', ['synth', 'soft'], () => '.s("square").attack(.005).decay(.2).sustain(.4).release(.1).lpf(420).lpq(1)'),
  p('bass.fm', 'bass', ['synth', 'wave'], () => '.s("sine").fm(1.5).fmh(.5).fmdecay(.2).fmsustain(.2).attack(.005).decay(.3).sustain(.5).release(.1).lpf(900)'),
  p('bass.fretless', 'bass', ['acoustic', 'jazzy'], () => '.s("gm_fretless_bass").lpf(900).release(.15)'),
  p('bass.upright', 'bass', ['acoustic', 'jazzy', 'lofi'], () => '.s("gm_acoustic_bass").lpf(1100).release(.1)'),
  p('bass.finger', 'bass', ['acoustic', 'funky'], () => '.s("gm_electric_bass_finger").lpf(1000).release(.1)'),
  p('bass.pick', 'bass', ['funky', 'cafe'], () => '.s("gm_electric_bass_pick").lpf(800).release(.08)'),
  p('bass.synth2', 'bass', ['synth', 'wave'], () => '.s("gm_synth_bass_2").lpf(800).release(.1)'),
  p('bass.wave8', 'bass', ['synth', 'wave'], (r) => `.s("sawtooth").attack(.002).decay(.12).sustain(.2).release(.06).lpf(${r.int(5, 8) * 100}).lpenv(2).lpdecay(.1)`),

  // Pads: sustained harmony, wide, slow.
  p('pad.saw-stack', 'pad', ['synth', 'dark', 'wide'], (r) => `.s("sawtooth").attack(1.2).decay(1).sustain(.8).release(3).lpf(${r.int(7, 11) * 100}).lpq(1).layer(x => x.pan(.1), x => x.add(note(.12)).pan(.9))`),
  p('pad.supersaw', 'pad', ['synth', 'wide', 'wave'], (r) => `.s("supersaw").detune(${r.step(0.15, 0.3, 0.05)}).unison(5).spread(1).attack(1).decay(1).sustain(.8).release(3).lpf(${r.int(6, 10) * 100})`),
  p('pad.square', 'pad', ['synth', 'hollow'], (r) => `.s("square").attack(1.5).sustain(.8).release(3).lpf(${r.int(5, 8) * 100}).layer(x => x.pan(.25), x => x.add(note(.1)).pan(.75))`),
  p('pad.drift', 'pad', ['synth', 'dark', 'moving'], () => '.s("sawtooth").attack(2).sustain(.8).release(4).lpf(700).lpsync(1/8).lpdepth(.5).layer(x => x.pan(.2), x => x.add(note(.07)).pan(.8))'),
  p('pad.vowel', 'pad', ['synth', 'vocal', 'garage'], () => '.s("sawtooth").attack(1).sustain(.8).release(3).vowel("<a o e o>").lpf(1800).layer(x => x.pan(.2), x => x.add(note(.1)).pan(.8))'),
  p('pad.warm', 'pad', ['soft', 'warm'], () => '.s("gm_pad_warm").attack(.8).release(3).lpf(1600).layer(x => x.pan(.1), x => x.add(note(.1)).pan(.9))'),
  p('pad.halo', 'pad', ['soft', 'airy'], () => '.s("gm_pad_halo").attack(1).release(3).lpf(1800).layer(x => x.pan(.1), x => x.add(note(.1)).pan(.9))'),
  p('pad.poly', 'pad', ['synth', 'wave'], () => '.s("gm_pad_poly").attack(.6).release(2.5).lpf(1800).layer(x => x.pan(.1), x => x.add(note(.1)).pan(.9))'),
  p('pad.bowed', 'pad', ['soft', 'ambient'], () => '.s("gm_pad_bowed").attack(1.5).release(4).lpf(1500).layer(x => x.pan(.1), x => x.add(note(.1)).pan(.9))'),
  p('pad.choir', 'pad', ['vocal', 'airy', 'ambient'], () => '.s("gm_pad_choir").attack(1.2).release(3).lpf(1800).layer(x => x.pan(.25), x => x.add(note(.06)).pan(.75))'),
  p('pad.strings', 'pad', ['acoustic', 'soft'], () => '.s("gm_string_ensemble_1").attack(1).release(2.5).lpf(1600).layer(x => x.pan(.25), x => x.add(note(.06)).pan(.75))'),
  p('pad.synth-strings', 'pad', ['synth', 'wave'], () => '.s("gm_synth_strings_1").attack(.8).release(2.5).lpf(1800).layer(x => x.pan(.1), x => x.add(note(.1)).pan(.9))'),
  p('pad.organ', 'pad', ['jazzy', 'warm'], () => '.s("gm_drawbar_organ").attack(.4).release(1.5).lpf(1400).layer(x => x.pan(.3), x => x.add(note(.05)).pan(.7))'),
  // Electric pianos held through the bar: the chord rings out and fades like a played Rhodes.
  p('pad.rhodes', 'pad', ['cafe', 'warm'], () => '.s("gm_epiano1:5").release(1.5).lpf(1800).layer(x => x.pan(.08), x => x.add(note(.12)).late(.005).pan(.92))'),
  p('pad.wurli', 'pad', ['cafe', 'warm'], () => '.s("gm_epiano2").release(1.2).lpf(1500).layer(x => x.pan(.08), x => x.add(note(.12)).late(.005).pan(.92))'),

  // Keys: rhythmic chord comping.
  p('keys.rhodes', 'keys', ['jazzy', 'lofi', 'warm'], (r) => `.s("gm_epiano1:1").phaser(${r.pick(['.25', '.5'])}).phaserdepth(.4).lpf(${r.int(18, 26) * 100})`),
  p('keys.rhodes-dry', 'keys', ['jazzy', 'lofi'], () => '.s("gm_epiano1").lpf(2000)'),
  p('keys.wurli', 'keys', ['jazzy', 'lofi'], () => '.s("gm_epiano2").lpf(1800)'),
  p('keys.fm-epiano', 'keys', ['synth', 'wave', 'jazzy'], () => '.s("sine").fm(1.6).fmh(1).fmdecay(.35).fmsustain(.15).decay(.9).sustain(.2).release(.6).lpf(2400)'),
  p('keys.piano', 'keys', ['acoustic', 'lofi', 'ambient'], () => '.s("piano").lpf(2600).release(.4)'),
  p('keys.piano-felt', 'keys', ['acoustic', 'lofi', 'soft'], () => '.s("piano").lpf(1100).release(.6)'),
  p('keys.vibes', 'keys', ['jazzy', 'bright'], () => '.s("vibraphone_soft").lpf(3200)'),
  p('keys.marimba', 'keys', ['organic', 'bright'], () => '.s("marimba").lpf(2800)'),
  p('keys.organ', 'keys', ['jazzy', 'warm'], () => '.s("gm_drawbar_organ").lpf(1600).release(.2)'),
  p('keys.guitar', 'keys', ['acoustic', 'lofi'], () => '.s("gm_electric_guitar_jazz").lpf(2400)'),
  p('keys.nylon', 'keys', ['acoustic', 'lofi', 'soft'], () => '.s("gm_acoustic_guitar_nylon").lpf(2600)'),
  // Clean electric guitars for cafe comping, doubled a hair apart and spread wide.
  p('keys.jazz-guitar', 'keys', ['cafe', 'jazzy'], () => '.s("gm_electric_guitar_jazz").lpf(2200).release(.15).layer(x => x.pan(.12), x => x.add(note(.1)).late(.005).pan(.88))'),
  p('keys.clean-guitar', 'keys', ['cafe', 'funky'], () => '.s("gm_electric_guitar_clean").lpf(2300).release(.1).layer(x => x.pan(.12), x => x.add(note(.1)).late(.005).pan(.88))'),
  p('keys.muted-guitar', 'keys', ['cafe', 'funky'], () => '.s("gm_electric_guitar_muted").lpf(2600).layer(x => x.pan(.12), x => x.add(note(.1)).late(.005).pan(.88))'),
  p('keys.stab', 'keys', ['synth', 'house'], (r) => `.s("sawtooth").attack(.005).decay(.22).sustain(0).release(.1).lpf(${r.int(9, 14) * 100}).lpenv(2).lpdecay(.15).layer(x => x.pan(.35), x => x.add(note(.1)).pan(.65))`),
  p('keys.organ-stab', 'keys', ['house', 'warm'], () => '.s("gm_percussive_organ").lpf(2000).release(.1)'),

  // Leads and motifs: sparse melodic lines.
  p('lead.bell', 'lead', ['synth', 'bright'], () => '.s("triangle").fm(2.5).fmh(3.01).fmdecay(.4).fmsustain(0).decay(.8).sustain(0).release(.4).lpf(3200)'),
  p('lead.glass', 'lead', ['synth', 'bright'], () => '.s("sine").fm(4).fmh(2).fmdecay(.12).fmsustain(0).decay(.5).sustain(0).lpf(2800)'),
  p('lead.vibes', 'lead', ['jazzy', 'bright'], () => '.s("vibraphone_soft").lpf(3200)'),
  p('lead.kalimba', 'lead', ['organic'], () => '.s("kalimba").lpf(3500)'),
  p('lead.glock', 'lead', ['bright', 'organic'], () => '.s("gm_glockenspiel").lpf(3600)'),
  p('lead.music-box', 'lead', ['bright', 'soft'], () => '.s("gm_music_box").lpf(3500)'),
  p('lead.celesta', 'lead', ['bright', 'soft'], () => '.s("gm_celesta").lpf(3500)'),
  p('lead.flute', 'lead', ['organic', 'soft'], () => '.s("gm_flute").lpf(2600).attack(.05).release(.4)'),
  p('lead.ocarina', 'lead', ['organic', 'soft'], () => '.s("ocarina").lpf(2600)'),
  p('lead.sine', 'lead', ['synth', 'soft'], () => '.s("sine").attack(.04).decay(.4).sustain(.6).release(.5).vib(5).vibmod(.08)'),
  p('lead.square', 'lead', ['synth', 'wave'], () => '.s("square").attack(.02).decay(.3).sustain(.5).release(.4).lpf(1600).vib(5).vibmod(.1)'),
  p('lead.saw', 'lead', ['synth', 'wave'], () => '.s("sawtooth").attack(.03).decay(.3).sustain(.6).release(.5).lpf(1800).vib(5).vibmod(.08).add(note("0,.1"))'),
  p('lead.harmonics', 'lead', ['organic', 'bright'], () => '.s("gm_guitar_harmonics").lpf(3500)'),
  p('lead.jazz-guitar', 'lead', ['cafe', 'jazzy'], () => '.s("gm_electric_guitar_jazz").lpf(2600).release(.25)'),
  p('lead.rhodes', 'lead', ['cafe', 'jazzy'], () => '.s("gm_epiano1:1").lpf(2000).release(.4)'),
  p('lead.muted-trumpet', 'lead', ['cafe', 'soul'], () => '.s("gm_muted_trumpet").lpf(1600).attack(.03).release(.3)'),

  // Arps and plucks: 8th/16th figures.
  p('arp.tri', 'arp', ['synth', 'soft'], () => '.s("triangle").decay(.18).sustain(0).lpq(4)'),
  p('arp.square', 'arp', ['synth', 'wave'], () => '.s("square").decay(.12).sustain(0).lpf(1600).lpq(2)'),
  p('arp.saw', 'arp', ['synth', 'wave', 'dark'], () => '.s("sawtooth").decay(.15).sustain(0).lpf(900).lpenv(2.5).lpdecay(.1).lpq(5)'),
  p('arp.fm', 'arp', ['synth', 'bright'], () => '.s("sine").fm(3).fmh(2).fmdecay(.08).fmsustain(0).decay(.2).sustain(0)'),
  p('arp.marimba', 'arp', ['organic'], () => '.s("marimba").lpf(2600)'),
  p('arp.harp', 'arp', ['organic', 'soft'], () => '.s("harp").lpf(3000)'),
  p('arp.kalimba', 'arp', ['organic'], () => '.s("kalimba").lpf(3200)'),
  p('arp.music-box', 'arp', ['bright', 'soft'], () => '.s("gm_music_box").lpf(3200)'),
  p('arp.guitar', 'arp', ['cafe'], () => '.s("gm_electric_guitar_clean").lpf(2400).release(.2)'),

  // Texture: a little grain under the music, never a steady hiss (listeners
  // hear a noise bed as noise over hours). Not calibrated: sparse crackle has
  // little RMS, so its level is set by ear and the high-frequency floor.
  p('tex.vinyl', 'texture', ['lofi'], () => '.s("crackle").density(.02).slow(4).attack(.5).release(1).hpf(900).lpf(4500)'),
  p('tex.wind', 'texture', ['ambient'], () => '.s("white").slow(16).legato(1.1).attack(6).release(6).bpf(sine.slow(64).range(500, 1200)).bpq(2)'),
];

export const KITS = {
  kick: [
    { id: 'kick.909', sound: 'bd', mods: '.bank("RolandTR909").n(1).lpf(2400)', tags: ['house'] },
    { id: 'kick.909-soft', sound: 'bd', mods: '.bank("RolandTR909").n(3).lpf(1800)', tags: ['house'] },
    { id: 'kick.808', sound: 'bd', mods: '.bank("RolandTR808").n(3).decay(.45).lpf(2000)', tags: ['focus', 'garage'] },
    { id: 'kick.808-long', sound: 'bd', mods: '.bank("RolandTR808").n(8).lpf(1600)', tags: ['garage', 'lofi'] },
    { id: 'kick.linn', sound: 'bd', mods: '.bank("LinnDrum").lpf(3000)', tags: ['wave', 'focus'] },
    { id: 'kick.dmx', sound: 'bd', mods: '.bank("OberheimDMX").n(1).lpf(3000)', tags: ['wave'] },
    { id: 'kick.707', sound: 'bd', mods: '.bank("RolandTR707").lpf(3000)', tags: ['wave', 'house'] },
    { id: 'kick.sp12', sound: 'bd', mods: '.bank("EmuSP12").n(4).lpf(2600)', tags: ['lofi', 'focus', 'cafe'] },
    { id: 'kick.sp12-b', sound: 'bd', mods: '.bank("EmuSP12").n(9).lpf(2400)', tags: ['lofi', 'cafe'] },
    { id: 'kick.mpc60', sound: 'bd', mods: '.bank("AkaiMPC60").lpf(2400)', tags: ['lofi', 'cafe'] },
    { id: 'kick.xr10', sound: 'bd', mods: '.bank("AkaiXR10").n(2).lpf(2600)', tags: ['focus', 'lofi', 'cafe'] },
  ],
  snare: [
    { id: 'snare.909-clap', sound: 'cp', mods: '.bank("RolandTR909").n(2).hpf(400).lpf(5000)', tags: ['house'] },
    { id: 'snare.808-rim', sound: 'rim', mods: '.bank("RolandTR808").hpf(300).lpf(6000)', tags: ['focus', 'garage'] },
    { id: 'snare.808-clap', sound: 'cp', mods: '.bank("RolandTR808").n(1).hpf(400).lpf(5000)', tags: ['garage', 'focus'] },
    { id: 'snare.linn', sound: 'sd', mods: '.bank("LinnDrum").n(1).hpf(250).lpf(4500)', tags: ['wave', 'focus'] },
    { id: 'snare.dmx', sound: 'sd', mods: '.bank("OberheimDMX").n(1).hpf(200).lpf(5000)', tags: ['wave'] },
    { id: 'snare.707', sound: 'sd', mods: '.bank("RolandTR707").hpf(200).lpf(5000)', tags: ['wave'] },
    { id: 'snare.m1-clap', sound: 'cp', mods: '.bank("KorgM1").hpf(500).lpf(5000)', tags: ['house', 'focus'] },
    { id: 'snare.sp12', sound: 'sd', mods: '.bank("EmuSP12").n(9).hpf(300).lpf(4000)', tags: ['lofi', 'focus', 'cafe'] },
    { id: 'snare.sp12-b', sound: 'sd', mods: '.bank("EmuSP12").n(14).hpf(250).lpf(3800)', tags: ['lofi', 'cafe'] },
    { id: 'snare.mpc60', sound: 'sd', mods: '.bank("AkaiMPC60").n(1).hpf(250).lpf(4200)', tags: ['lofi', 'cafe'] },
    { id: 'snare.rim', sound: 'snare_rim', mods: '.hpf(300).lpf(5000)', tags: ['lofi', 'focus', 'cafe'] },
  ],
  hat: [
    { id: 'hat.909', sound: 'hh', mods: '.bank("RolandTR909").n(2)', tags: ['house'] },
    { id: 'hat.808', sound: 'hh', mods: '.bank("RolandTR808")', tags: ['garage', 'focus'] },
    { id: 'hat.linn', sound: 'hh', mods: '.bank("LinnDrum")', tags: ['wave', 'focus'] },
    { id: 'hat.dmx', sound: 'hh', mods: '.bank("OberheimDMX")', tags: ['wave'] },
    { id: 'hat.sp12', sound: 'hh', mods: '.bank("EmuSP12")', tags: ['lofi', 'cafe'] },
    { id: 'hat.mpc60', sound: 'hh', mods: '.bank("AkaiMPC60")', tags: ['lofi', 'cafe'] },
    { id: 'hat.shaker', sound: 'shaker_small', mods: '', tags: ['lofi', 'focus', 'organic'] },
    { id: 'hat.808-shaker', sound: 'sh', mods: '.bank("RolandTR808")', tags: ['focus', 'garage'] },
    { id: 'hat.xr10', sound: 'hh', mods: '.bank("AkaiXR10")', tags: ['focus', 'lofi', 'cafe'] },
  ],
  openhat: [
    { id: 'oh.909', sound: 'oh', mods: '.bank("RolandTR909").n(1)', tags: ['house'] },
    { id: 'oh.808', sound: 'oh', mods: '.bank("RolandTR808").n(1)', tags: ['garage', 'focus'] },
    { id: 'oh.linn', sound: 'oh', mods: '.bank("LinnDrum")', tags: ['wave'] },
  ],
  perc: [
    { id: 'perc.linn-tom', sound: 'lt', mods: '.bank("LinnDrum").lpf(1800)', tags: ['focus', 'wave'] },
    { id: 'perc.conga', sound: 'conga', mods: '.n(1).lpf(2400)', tags: ['focus', 'house', 'organic', 'cafe'] },
    { id: 'perc.bongo', sound: 'bongo', mods: '.lpf(3000)', tags: ['house', 'organic', 'lofi', 'cafe'] },
    { id: 'perc.909-tom', sound: 'lt', mods: '.bank("RolandTR909").n(3).lpf(1800)', tags: ['house'] },
    { id: 'perc.clave', sound: 'clave', mods: '.lpf(4000)', tags: ['house', 'organic'] },
    { id: 'perc.rim', sound: 'rim', mods: '.bank("RolandTR909").lpf(4000)', tags: ['focus', 'house', 'cafe'] },
    { id: 'perc.woodblock', sound: 'woodblock', mods: '.lpf(3500)', tags: ['lofi', 'organic'] },
    { id: 'perc.cabasa', sound: 'cabasa', mods: '.hpf(3000)', tags: ['house', 'organic'] },
  ],
};

export const presetsByRole = (role) => PRESETS.filter((x) => x.role === role);

/** Pick a preset for a role, preferring ones that share tags with the style. */
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
