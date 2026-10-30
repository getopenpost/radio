# Fox model candidates for the 3D stream rebuild

Research, 30 October 2026. Candidates for the Godot rebuild discussed after the
visual direction package (`../visual-direction-2026-10-30/`). Nothing here is
wired into the stream.

## Downloaded files

### quaternius-fox.glb (recommended base)

Source: Quaternius "Ultimate Animated Animal Pack" (July 2021), CC0.
Official page: https://quaternius.com/packs/ultimateanimatedanimals.html
Downloaded from the gamedev.trebeljahr.com mirror of the pack's glTF export
(per-model GLB; same CC0 asset). Blend source is in the official pack zip.

Verified from the file itself:

- 1,848 triangles, one skinned mesh. Flat-shaded, low-poly.
- 51-bone skeleton with IK targets (`IKFrontLeg.*`, `IKBackLeg.*`) and pole
  bones included.
- Separate ear chains (Ear1-4 per side), an 8-bone tail chain, Neck1-3 and
  Head bones: enough for the blink/glance/ear/tail gestures in the handoff.
- 5 flat-color materials (`Main`, `Main_Light`, `Black`, `Eyes`, `Grey`),
  trivial to remap to the project's palette slots.
- 12 animation clips: Walk, Gallop, Gallop_Jump, Idle, Idle_2,
  Idle_2_HeadLow, Eating, Attack, Death, Idle_HitReact1, Idle_HitReact2,
  Jump_ToIdle.
- Exported by Blender's glTF I/O; imports natively in Godot 4 with clips
  as named AnimationLibrary entries.

License: CC0. No attribution required, modification allowed, safe for the
24/7 public stream.

### khronos-fox.glb (proven fallback)

Source: "Low poly fox by PixelMannen (Animated)" on Sketchfab, rig and
animation by tomkranis. Also the Khronos glTF sample model
(https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox),
so it is the single most-tested animated glTF in existence.

- ~576 triangles, 24-joint skeleton, 1 material.
- 3 clips: Survey, Walk, Run.
- License: mesh CC0 (PixelMannen, opengameart "Fox and Shiba"); rig and
  animations CC-BY 4.0 (tomkranis). If used, add a credit line, e.g.
  "Fox rig & animation: tomkranis (CC-BY 4.0)" in the stream description.

## Not downloaded, worth knowing

- Kenney "Cube Pets" fox, CC0, GLB/FBX/OBJ, idle/walk/run/eat/dance.
  https://kenney.nl/assets/cube-pets (v2.0, 2026). Blocky voxel style,
  not the approved organic look, but the same pack has a bunny and a polar
  bear that would match it if the style ever pivoted. A cube style would
  survive the 640x360 dither pass extremely well.
- antics.gg fox, CC-BY 4.0, 3,260 tris, 18-bone rig, GLB plus an MIT
  "recipe" script that regenerates the mesh with editable proportions.
  https://antics.gg/m/fox-77d4bf. Interesting for parametric proportion
  changes, weaker rig than Quaternius, small new site.
- Sketchfab "Tribal Fox" (CoolPixelpro): rigged, 5 clips, free with
  requested credit. Taller-than-fox proportions, tribal paint style.
- Avoided: "Low Poly Fox" by okamei.com (CC-BY-ND, no modifications
  allowed), AI-generated anthro foxes (unclear licensing, wrong style),
  realistic furred foxes (read as noise at 640x360, e.g. AnimalMesh's
  60-animation fox), paid store items (kaleta.3d chibi fox, 3DDisco base
  mesh, Game Props Factory "Fox Dog") unless we choose to buy.

## Fit against the handoff requirements

The approved reference (HANDOFF.md): burnt-orange fur, cream muzzle/chest/
tail tip, dark-rimmed ears, black nose, dark paws, brown satchel; head,
ears and tail readable at about 1/5 of frame height.

- The Quaternius fox is the closest starting point: correct species
  silhouette, chunky proportions, flat-color regions that quantize
  cleanly, and its `Main`/`Main_Light`/`Black` materials already map to
  the fur/cream/dark-paw split. A Blender recolor plus a larger head and
  fatter tail gets to the reference without retopology.
- No candidate ships bike, boat, broom, calisthenics or telescope clips.
  Those are custom animation either way. The Quaternius rig ships IK
  targets and pole bones, which makes planted-paw poses (bar, pedals,
  paddle, push-ups) much cheaper to author.
- Passersby (rabbit, bear) are not in the Quaternius animal pack; that
  needs a separate source if the rebuild goes ahead.

## Suggested next steps

1. Open both GLBs in Blender; restyle the Quaternius fox to the reference
   colors and proportions, add the satchel on a torso bone.
2. Import into a Godot 4 project, orthographic side camera, render a
   15-second day-to-night walk clip, quantize to 640x360 with the existing
   palette/dither treatment and compare against
   `../visual-direction-2026-10-30/scenes/01-autumn-valley.png`.
3. Only then commit to the full rebuild.
