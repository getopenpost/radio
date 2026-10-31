# 3D pipeline for the endless fox: feasibility pass

30 October 2026. Research and proof renders only; the live stream, the compose
engine, the relay and deployment are untouched. This package answers the
question set after the visual direction pass: can the endless fox journey be
built as pre-rendered 3D, and how would it actually run?

**Open `index.html` first.** It shows the style proof (raw render vs palette +
Bayer dither, day and night), the walking clip with world-anchored vs
screen-anchored dither, the actual fox GLB with all 12 shipped clips playable,
and every sampled asset orbitable in 3D.

## Verdict

1. **The look converts.** Ordinary low-poly 3D renders, pushed through the
   real stream palette with a restrained 4x4 Bayer pass, land in the approved
   direction: solid slot fills, dither bands on lit gradients, readable night.
   See `style-demo/day_before_after.png` and `night_before_after.png`.
2. **The assets exist.** A single CC0 ecosystem (Quaternius medieval village
   packs + Kenney harbour + nature kits) covers towns, harbours, boats, a
   bicycle and a telescope. Broom and exercise bars need small custom builds.
   18 candidates evaluated in `research/assets.md`.
3. **Animation is the real cost.** No free library ships bike, boat, broom or
   calisthenics clips for quadrupeds (Mixamo is humanoid-only). The rig we
   chose ships IK targets, so authoring is tractable, and all four Quaternius
   canids share one armature, so passing friends inherit clips for free.
   Full plan in `research/animation.md`.
4. **The 3h loop needs zero pipeline changes.** A 3-hour programme is 45
   chunks of 240 s, inside every limit the programme and relay code already
   enforce. The VPS relays it exactly as it relays today's programmes.

## Proposed architecture

- **Sky and distant mountains stay 2D parallax layers**, scrolling at
  fractions of the ground speed, as the current scene already does. They are
  painted, not modelled, per the direction that distant ranges are simpler,
  softer and lighter.
- **The middle band is 3D**: the Quaternius fox (CC0, 51-bone rig) walking a
  fixed side-on orthographic lane, with CC0 towns, harbours, trees and props
  streaming past. Layering is explicit: fox nearest, path, props, water,
  ground wall, peaks, sky; depth order preserved across lighting.
- **One quantization pass over everything** at 640x360, palette slots set per
  frame for light, season and weather, then integer upscale to the encoder,
  exactly like today.
- **Godot 4.7 as the renderer** (recipe in `research/godot-pipeline.md`):
  SubViewport at 640x360, per-material palette-slot shader, Movie Maker
  offline rendering to PNG, then x264. Blender EEVEE already proved the look
  for this package (`tools/scene_demo.py`), but Godot supplies the runtime
  state machine, live palette uniforms and Movie Maker determinism.

## What the proof run established

- Renders: Blender 5.2 EEVEE, orthographic side camera, 120 frames plus day
  and night stills, about 45 s total on this machine. The frame puts the path
  line at 84% of frame height and the fox at one fifth of frame height,
  matching the handoff.
- **World-anchored dither works and matters.** The Bayer x index shifts with
  the scrolled distance (`style-demo/walk_world_anchored.gif`); the
  screen-anchored variant (`walk_screen_anchored.gif`) visibly swims. The
  Godot recipe gets the same effect from a vertex-stage `world_pos` varying.
- **Global nearest-palette matching is not art-directable enough.** In the
  day still, sunlit surfaces land on whatever slot is nearest (cloudShade
  took 12.7% of pixels, including lit walls). Production should use the
  per-material slot-pair shader from `research/godot-pipeline.md`, where a
  wall only ever dithers between wall and wallShade. That also preserves the
  day/night depth order rule by construction.
- **The pack's Walk clip cannot set the travel speed.** Its paws sweep about
  3 cm per cycle with zero root motion. The demo scrolls at a chosen speed;
  production must use distance-driven phase (`research/animation.md`, the
  no-slide formula) and re-author or retime the cycle so contact reads.
- The fox GLB's 12 clips (Walk, Gallop, two Idles, Eating, Jump and more)
  all import and play correctly in the browser viewer in `index.html`.

## The 3h loop, end to end

Today: `node src/cli/program.js --hours 3` would already produce a valid
45-chunk programme, with the 2D scene rendering inside `src/stream/main.js`
and music crossfaded from the library. For the 3D rebuild the renderer child
(`program.js:117-145`) is swapped for the Godot output plus a segmenter, and
the upload, manifest and atomic `current.json` flip all stay:

1. Render the loop offline: `godot --write-movie loop.png --fixed-fps 30
   --quit-after 324000` (frame-exact by construction; all periodic drivers
   divide the frame count; verify by pixel-diffing frame N+1 against frame 0).
2. Encode with the pipeline's contracts: 2-second GOP (`-g 60 -keyint_min 60
   -sc_threshold 0`), `yuv420p`, AAC 48k stereo, then segment to 240 s
   MPEG-TS chunks (`-f segment -segment_time 240 -reset_timestamps 0
   -segment_format mpegts`), exactly as `src/stream/encoder.js:41` does.
3. Publish: chunks + manifest (45 chunks, `seconds: 10800`, `complete: true`)
   to the NAS programme folder, atomically replace `current.json`, restart
   `openpost-radio.service`.
4. The VPS keeps streaming with stream copy: its cache holds the current
   chunk plus ten, roughly 44 minutes of head start, length-independent.
   Nothing on the VPS changes.

Loop shape decision needed: 3 hours is 4.5 world days at the current 40-minute
day, which cuts mid-day at the seam. Options: stretch the world day to 45
minutes (exactly 4 days per loop), 36 minutes (5 days), or keep 40 and let
the seam hide in a beatless transition. A baked loop also stops following
the real wall clock; seasons and weather become part of the loop's content,
so the natural plan is one loop per season, swapped from the real calendar.

## Open decisions

1. Does the style pass land close enough to the approved boards? (Compare
   `style-demo/day_styled.png` against
   `../visual-direction-2026-10-30/scenes/01-autumn-valley.png`.)
2. Palette matching: per-material slot pairs (recommended) vs global nearest.
3. World day length inside the loop, and one loop per season?
4. Passersby: rabbit and bear skinned to the Quaternius armature (clips
   inherit), or Kenney Cube Pets style, which would change the fox too.
5. Renderer commitment: Godot (recommended, recipe ready) vs Blender EEVEE
   (already proven here, but no runtime palette/state machine).

## Milestones, if approved

- **M1**: Godot test project. Fox walking right, palette shader, 15 s
  day-to-night clip, compared against the autumn valley board.
- **M2**: Town strip from the medieval village pack over 2D parallax ranges;
  bike and boat sections; passing friends.
- **M3**: Calisthenics park sequence (about 50 s, per the handoff budget)
  and the five-second telescope stop, all custom clips.
- **M4**: Full 3 h loop render, publish as a programme, restart the service,
  watch the live relay.

## Reproduce

```
cd output/godot-3d-pipeline-2026-10-30
blender -b -P tools/scene_demo.py
nix-shell -p python312Packages.pillow python312Packages.numpy \\
  --run "python3 tools/post_process.py"
python3 tools/build_gallery.py   # rewrites index.html with embedded GLBs
```

Research files: `research/assets.md` (18 candidates), `research/godot-pipeline.md`
(Godot 4.7 recipe, 3 runnable shaders, Movie Maker commands, 30 sources),
`research/animation.md` (no-slide formula, AnimationTree layout, clip list,
33 sources). Fox model decision: `../fox-model-candidates/README.md`.
All sampled assets are CC0, with sources and licenses in
`assets-samples/manifest.json`.
