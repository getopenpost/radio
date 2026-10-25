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
- Check sound changes with `npm run analyze` on rendered tracks. Focus-family
  targets from the reference mix: 87-95% of energy below 400 Hz, centroid
  140-260 Hz, bass floor -7 to -14 dB, bed gaps near 0%, low-mid side/mid
  -1 to -8 dB.

## Stream

- Backpressure in the encoder comes from the video pipe only; waiting on the
  audio pipe deadlocks while x264 fills its lookahead.
- The scene draws palette indices at 640x360; colours come from the
  OpenPost Dither palettes in `scene.js`. Keep the Converge mark's geometry
  exact (`convergeMask`); add to it (legs), never redraw it.

## Verification

`npm test`, then a short render (`npm run compose -- --style <s> --seed 1 --render tmp/x.wav`)
and a stream preview (`npm run stream -- --output tmp/p.mp4 --duration 60`) for
changes in those areas.
