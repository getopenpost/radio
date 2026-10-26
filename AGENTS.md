# AGENTS

Project-specific rules. The shared global instructions still apply.

## Rendering engine

- Renders must be deterministic per absolute time. Any randomness added to
  the engine or native nodes must derive from absolute time or parameters
  (see `globalThis.__renderOffset`), never from `Math.random` call order.
  Chunk seams are verified sample-for-sample and fail otherwise.
- Do not use superdough features that still run as AudioWorklets (pulse,
  coarse, djf, ladder filter, env/bmod modulators) unless you add a native
  replacement in `src/engine/native-nodes.js`. Render with worklets disabled
  so such features fail loudly.
- Patches to superdough live in `scripts/build-strudel.js` with exact anchors.
  When upgrading Strudel, rebuild with `node scripts/build-strudel.js`; a
  missing anchor means a patch must be re-checked.

## Composition

- After adding or changing an instrument preset or drum kit, run
  `npm run calibrate` and commit `src/compose/calibration.json`.
- Every style's intro and outro must stay beatless (pads, sub, texture): the
  stream crossfades between any two tempos.
- Keep each orbit's reverb settings constant within a track (`builder.js`
  buses). Changing room size per event regenerates the impulse response.
- Keep sections sparse: at most two harmonic layers (pad, keys, pad2) and one
  melodic voice (lead or arp) at a time. The user listens for hours and asked
  that tracks never feel crowded.
- Check sound changes with `npm run analyze` on rendered tracks, measuring the
  main body (`file@60+240`) since intros and outros drop the sub by design.
  Focus-family targets from the reference mix: 87-95% of energy below 400 Hz,
  centroid 140-260 Hz, bass floor -7 to -14 dB, bed gaps near 0%, low-mid
  side/mid -1 to -8 dB.
- Compare before and after with `npm run audition -- --label <name>` (run it
  inside `nix shell nixpkgs#uv`). A style should keep winning the forced choice
  against the generic alternatives. Raw sawtooth pads and 909 kits read as
  "synth demo" and "techno" in focus.

## Stream

- Backpressure in the encoder comes from the video pipe only; waiting on the
  audio pipe deadlocks while x264 fills its lookahead.
- The scene (`src/stream/scene`) draws palette slots at 640x360; colours are
  set per frame in `palette.js` for light, season and weather, so new art
  should use slots rather than fixed colours. Light follows the real sun:
  OpenPost's light scheme by day, its dark scheme by night. New art must read
  on both, and day and night palettes must keep the same depth order (sky
  lightest, foreground darkest) or dusk washes the landscape out. Dither as OpenPost does: two
  neighbouring slots with a 4x4 Bayer band between solid ends, anchored to the
  layer that moves.
- Sky, season, weather, region and activity derive from the wall clock
  (`clock.js`), so a restart shows the same world. Motion may keep state.
- The Converge mark appears only as the logo in the brand chip; keep its
  geometry exact (`convergeMask`). The host character is the fox in
  `character.js`.
- Several outputs share one encode through tee with a fifo per output; keep
  `-flags +global_header` or flv outputs lose their codec headers.

## Verification

`npm test`, then a short render (`npm run compose -- --style <s> --seed 1 --render tmp/x.wav`)
and a stream preview (`npm run stream -- --output tmp/p.mp4 --duration 60`) for
changes in those areas. For scene changes, look at stills across the day and
year (`npm run scene -- --at <iso> --at <iso>`); `--clock` and
`--clock-speed` on the stream preview start it at a chosen time, and
`npm run stream -- --tour` renders the scripted 10-minute tour in
`src/stream/tour.js` (extend it when adding scene features).
