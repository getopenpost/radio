# Animation implementation plan — 3D fox programme (Godot 4)

Research, 30 October 2026, for the 24/7 OpenPost Radio rebuild. Input model:
Quaternius "Ultimate Animated Animal Pack" fox, CC0,
`output/fox-model-candidates/quaternius-fox.glb` (1,848 tris, 51 bones, 12
clips; durations below were parsed from the GLB locally). Behaviours come from
`output/visual-direction-2026-10-30/HANDOFF.md` ("Direction", "Behaviour to
build later", "Movement notes"). Third-party measurements of the same clips
(ja blog, poly.pizza parses) round Walk to 1.04 s and Gallop to 0.54 s
[alcuesto]; our parsed values (Walk 1.07 s, Gallop 0.57 s) take precedence.

A project rule from `AGENTS.md` applies to everything here: renders must be
deterministic per absolute time, and any randomness must derive from absolute
time or parameters, never from random-call order. Every procedural gesture
timer below therefore derives from the world clock (a hash of absolute time),
not from `randi()`.

---

## 1. Stride-matched locomotion (no foot sliding)

### The formula

The Walk clip is one full gait cycle per loop: the same paw plants exactly
once per 1.07 s playback at rate 1.0. Two facts define the no-slide
condition:

- **Depicted (authored) speed** of a clip: `v_depicted = S / T`, where `S` is
  the stride length (world distance the body advances over one full cycle,
  i.e. between two successive plants of the same paw) and `T` the clip's
  cycle duration. For our clips: `v_walk = S_walk / 1.07`,
  `v_gallop = S_gallop / 0.57`.
- A planted foot has zero ground-relative velocity. The animation's foot
  velocity matches the world only when the character's world velocity equals
  the clip's depicted speed, so the playback rate must be scaled by:

```
speed_scale = v_world / v_depicted = v_world * T / S
```

This is the standard cycle-matching rule: Unreal's distance-matching library
notes that "cycle animations (walk, jog, etc) typically just adjust their
play rate to match the in-game movement speed", with play-rate clamps
[Epic, `set_playrate_to_match_speed`]; the s&box field guide states it as
`PlaybackRate = actualSpeed / depictedSpeed`, "zero foot-slide at any speed"
[sboxguide]; the sprite-era formulation is the same ratio: "Matching velocity
equals stride distance divided by loop duration" [framesprite]. Worked example
with a placeholder: if measuring gives `S_walk = 0.50 m`, then
`v_walk = 0.50 / 1.07 = 0.47 m/s`; at a world scroll of 0.40 m/s,
`speed_scale = 0.40 / 0.47 = 0.86`. **S must be measured, not guessed**
(fox bbox is 0.93 m long per the animasim registry [animasim], so a plausible
walk stride is 0.4-0.6 m, but the measured value wins).

Because our programme is a scenery scroll (fox horizontally centred, world
moving left [HANDOFF]), we invert the usual root-motion direction: the world
speed is the product requirement, and playback follows it. Godot also
supports the other direction — root motion via `AnimationTree`'s
`get_root_motion_position()` "allows animating characters in a way where
steps actually match the floor below" [Godot AnimationTree] — but with an
in-place clip set and a fixed camera there is no root to extract; drive
playback from scroll speed instead.

### Measuring stride length from the clip

Three methods, in order of cost:

1. **Root displacement** (if the clip has baked travel): net forward
   translation of the root/Body bone over one loop. "Measure the stride from
   your DCC tool: export the root motion distance over one loop, divide by
   loop duration" [sboxguide]. Check the Walk clip's `Body` bone translation
   channel in Blender; Quaternius clips are believed in-place, so this may be
   zero.
2. **Stance sweep** (for in-place clips): in the body frame, a planted paw
   sweeps backward exactly as far as the body advances over the ground during
   stance. So `S = sweep / duty`, where `sweep` is the paw's backward travel
   while planted and `duty = stance_duration / cycle_duration`. The anima
   project measures exactly this from the bones: "stride: how far a foot
   travels while planted, measured from the bones; impliedSpeed = stride /
   stepDuration — the speed at which these feet do not slip" [anima skate.md].
   Concretely: in Blender, sample `IKFrontLeg.L`'s local X each frame over the
   1.07 s Walk cycle, mark the stance interval (paw at its lowest Y), take
   `|X_start - X_end|` and divide by the stance fraction of the cycle.
3. **Empirical tune in Godot**: play Walk at scale 1.0, scroll the world at a
   candidate speed, watch the planted paw's world position drift, bisect
   until it holds. Verify with the automated checks below.

Do this once per clip and store `S` and `T` as per-clip constants. "Keep
depicted-mps as its own constant per clip. Do not reuse the movement
controller's top-speed value: they are independent" [sboxguide].

### Godot side

- Simplest path (no tree): `AnimationPlayer.speed_scale` multiplies playback;
  set it every frame from the scroll speed [Godot AnimationPlayer]. It scales
  *everything* in that player, including gesture layers, so it is the wrong
  lever once we layer clips.
- Inside the `AnimationTree`: wrap the locomotion output in an
  `AnimationNodeTimeScale` ("This node allows to scale the speed of the
  animation connected to its *in* input" [Godot AnimationTree]) and set
  `parameters/LocomotionTimeScale/scale = v_world * T / S` each frame. Write
  it unconditionally, so a gait switch can never leave a stale rate
  [sboxguide].
- Optional phase control: `AnimationNodeAnimation.start_offset` exists
  specifically for "adjusting which foot steps first in 3D walking
  animations" [Godot AnimationNodeAnimation] — use it after every crossfade
  or teleport so the cycle resumes on the correct foot.

### BlendSpace1D: Walk <-> Gallop by speed

Add an `AnimationNodeBlendSpace1D` with two points placed at their **depicted
speeds**: Walk at `v_walk`, Gallop at `v_gallop`, parameter = world speed
(blend positions are "a 1D blend space" over the parameter [Godot
AnimationTree]; Unreal forums recommend exactly this "animation matched at
100 cm/s... running matched at 400, blend between" layout [Epic forums]).

Two Godot-specific pieces make the blend safe with our unequal durations
(1.07 s vs 0.57 s):

- **Sync Mode**: BlendSpace1D's "Cyclic Mutable" mode time-scales all
  blend points so "their phases stay aligned. The shared cycle length is
  computed dynamically from the active blend weights" [Godot AnimationTree].
  Cyclic sync requires plain `AnimationNodeAnimation` blend points [Godot
  AnimationTree], which is what we use.
- If cycle normalization is preferred instead, `AnimationNodeAnimation`'s
  `use_custom_timeline` + `stretch_time_scale` "scales the time so that the
  length specified in timeline_length is one cycle. This is useful for
  matching the periods of walking and running animations" [Godot
  AnimationNodeAnimation]. (Warning: stretching Gallop's 0.57 s cycle to
  1.07 s would also divide its depicted speed by ~1.9; if you normalize
  periods, recompute the point position from the normalized cycle, or keep
  Cyclic Mutable and skip normalization.)

During the crossfade the effective stride is the blend of two strides, so
gate residual sliding with a TimeScale correction:
`scale = v_world / ((1-w)·v_walk + w·v_gallop)` — which is exactly 1.0 when
the parameter equals the depicted-speed line, so the correction only matters
if we ever blend off the line. Note that root motion does not blend linearly
in blend trees [marcospereira]; the practical mitigations are the ones the
community converged on: keep crossfade windows short (~0.25 s), and verify
with contact tests.

Recommended operating point: the programme walks at one constant speed
almost always, so run at `v_world = v_walk`, `speed_scale = 1.0`, and use
Gallop as a rare, brief variation with its own matched speed
`v_world = v_gallop`. This keeps 95% of runtime mathematically exact rather
than blended.

### Verifying no-slide

Automated, run in-editor on every clip change:

1. **Stance-pin test**: read `Skeleton3D.get_bone_global_pose()` for
   `IKFrontLeg.L/R` and `IKBackLeg.L/R` (the rig's paw IK targets) every
   frame; during each stance phase the world-space position must be constant.
   Gate: max drift < 2% of `S`. The anima project gates on
   "mismatch = speed / impliedSpeed - 1" computed from the same measurement
   [anima skate.md].
2. **Cycle-distance test**: world scroll between two successive contacts of
   the same paw must equal `S` (within the same 2%). This is the
   "measure... between equivalent contacts" check [framesprite].
3. **Visual**: draw the paw ground trail as a debug line — stance must be a
   straight horizontal segment. In snow scenes the planned footprint trail
   doubles as a free in-production check [HANDOFF].
4. The framesprite diagnosis table is a useful triage when a test fails:
   slides in the static overlay = contact keyframes bad; slides only in
   gameplay = the ratio; slides only during transitions = crossfade issue
   [framesprite].

---

## 2. AnimationTree state machine layout

One `AnimationTree` with `AnimationNodeStateMachine` root. States that share
a pose family get nested sub-state-machines (Godot state machines can hold
"animations, blendspaces, blendtrees, or even another StateMachine" [Godot
AnimationTree]).

```
                      ┌─────────────┐
                      │    WALK     │  (BlendSpace1D Walk<->Gallop,
                      │  default    │   stride-matched, TimeScale node)
                      └─────────────┘
        mount/dismount chains (one-shot states, Reset = true):

  WALK ──BIKE_MOUNT(1.2s)──> BIKE ──BIKE_DISMOUNT(1.0s)──> WALK
  WALK ──BOAT_BOARD(1.5s)──> PADDLE ──BOAT_EXIT(1.5s)──> WALK
  WALK ──BOAT_BOARD(1.5s)──> SAIL ──BOAT_EXIT(1.5s)──> WALK   (ocean variant)
  WALK ──BROOM_MOUNT(1.2s)─> BROOM ──BROOM_DISMOUNT(1.2s)──> WALK
  WALK ──WORKOUT(sub-SM)───> WALK      (enter / 20 pull-ups / 6 dips /
                                        3 muscle-ups / 8 push-ups / exit)
  WALK ──TELESCOPE_LOOK(5s one-shot)──> WALK

  Overlay (not states): wave/nod via filtered Blend2 or OneShot on top of
  WALK; blink/ear/tail procedural (section 3).
```

Transition rules:

- **Crossfades**: `Xfade Time` 0.15-0.25 s within locomotion; 0.1 s between
  workout reps so each rep stays legible [Godot AnimationTree].
- **One-shot chains**: mount states use `Reset = true` (play from the
  beginning), and the mount -> ride transition uses switch mode **At End**
  ("will wait for the current state playback to end, then switch" [Godot
  AnimationTree]).
- **Routing**: code only ever calls
  `playback.travel("BIKE")` etc. Godot's travel walks intermediate states via
  A* ("instruct the graph to go from the current state to another one, while
  visiting all the intermediate ones" [Godot AnimationTree]), so the mount
  one-shots sit *on the path* and play automatically. Assign `Priority` so
  travel prefers the mount path over a direct edge.
- **Advance expressions** for event exits, e.g. `activity != "bike"` on
  BIKE -> BIKE_DISMOUNT, and `reps_done < 20` holding the pull-up loop
  (Advance Expression "evaluates any expression... `velocity > 0`" [Godot
  AnimationTree]; the AnimationTree's `advance_expression_base_node` must
  point at the controller script).
- **Loops**: clips are exported with a `-loop` name suffix so Godot imports
  them with the loop flag set ("clips in the source 3D file that start or end
  with the token `loop` or `cycle` will be imported... with the loop flag
  set" [Godot node type customization]).

### Meeting the 95% target

The handoff's arithmetic: at most 60 s stationary per 20-minute window gives
95% moving time, and "all boarding, mounting, greetings, telescope looks and
exercise transitions count if world progress actually stops" [HANDOFF]. So
the state machine is designed to keep world scroll running through
transitions:

- Mount/dismount states animate the fox *relative to the vehicle* while the
  camera keeps scrolling (the broom "retains small forward progress during
  takeoff/landing" and bike mount is "a short transition" [HANDOFF]) — they
  never count against the budget.
- Wave/nod is an overlay, never a state: "Neither character stops" [HANDOFF].
- Stationary spend per 20-min window: workout 45-55 s + telescope 5 s = at
  most 60 s. The scheduler must not place a telescope look and a workout in
  the same window (50 + 5 = 55 s leaves 5 s slack), and must "not make every
  possible event happen each window" [HANDOFF] — enforce this in the event
  planner, not the animation layer.
- The WORKOUT sub-state-machine itself: WORKOUT_ENTER (~1 s) -> PULLUP loop
  x20 (~24 s) -> DIP x6 (~7 s) -> MUSCLEUP x3 (~5 s) -> PUSHUP x8 (~9 s) ->
  WORKOUT_EXIT (~1 s), At End advances with a rep counter, ~50 s total,
  inside the 45-55 s target [HANDOFF].

---

## 3. Secondary motion

Architecture: three stacked layers. (1) Base locomotion from the
AnimationTree. (2) Procedural bone control via `SkeletonModifier3D` nodes —
"if there is an AnimationMixer, a modification always performs after
playback process of the AnimationMixer" [Godot SkeletonModifier3D], which is
exactly the "independent of stride" requirement; the design article
deprecated `set_bone_global_pose_override` in favour of this pipeline
[Godot design article]. (3) Additive micro-clips layered with Blend2/3
filters ("filters... control individually which tracks get blended... useful
for layering animations on top of each other" [Godot AnimationTree]) or
`AnimationNodeAdd2/Add3` for true additive deltas.

| Gesture | Rig features | Recommended mechanism |
| --- | --- | --- |
| Ear flicks | `Ear1-4` per side | Custom `SkeletonModifier3D`: damped rotation impulses scheduled from an absolute-time hash (project determinism rule), plus an authored 0.4 s `ear_flick` additive clip for scripted reactions. |
| Tail sway | `Tail1-8` (a linear chain) | `SpringBoneSimulator3D`: built "to wiggle hair, cloth, and tails", and crucially it "attempts to return the original pose after modification" [Godot SpringBoneSimulator3D] — so it adds inertial lag *on top of* the Walk clip's counterbalancing tail instead of replacing it. Moderate stiffness, low drag, slight gravity. Four ear chains also work as separate spring entries (the node does not support branched chains [Godot SpringBoneSimulator3D], but ear and tail chains are linear). |
| Blink | **No eyelid bones** (verified against the parsed bone list; ears/tail/neck only) | See below — recommend the blend-shape route. |
| Glance | `Neck1-3`, `Head` | `LookAtModifier3D` (a SkeletonModifier3D subclass [Godot SkeletonModifier3D inherited-by list]) targeting the passing friend's node, with an `influence` envelope 0->1->0 (the `influence` property blends between original and modified pose [Godot design article]). Additive glance clips as the fallback if the modifier fights the walk head-bob. |
| Satchel lag | New `Satchel` bone chain under Torso | Satchel mesh parented to a torso bone; lag via a short `SpringBoneSimulator3D` chain (stiffness low, gravity slight) — the classic jiggle-chain use, "gentle satchel lag" [HANDOFF]. Alternative: a custom modifier implementing a spring-damper if we need exact tuning. |

**Blink options, evaluated:**

1. *Scale the eye mesh briefly* (procedural scale on the `Eyes` material's
   mesh): cheapest, but it visibly changes eye shape rather than covering it
   and reads as a squash at our quantized 640x360 output.
2. *Custom eyelid mesh on new bones in Blender*: two fur-coloured lids
   skinned to new `BlinkUpper/Lower` bones parented to `Head`. Most
   animatable, but adds bones to a skeleton we intend to keep identical to
   the rest of the Quaternius pack (section 5), and needs per-clip blink
   keying.
3. *Blend shape (shape key)*: author one `Blink` shape key in Blender that
   slides a fur-coloured eyelid over the eye (geometry built once into the
   mesh), export as a glTF morph target ("Export shape keys (morph
   targets)" [Blender glTF manual]), and drive the single blend-shape value
   procedurally from the clock (0.12 s close / 0.06 s open, interval 3-7 s
   from a time hash).

**Recommendation: option 3.** It needs no new bones, so the skeleton stays
byte-identical with the pack (retargeting stays clean), and a code-driven
value on a timer satisfies "blink independent of the stride" [HANDOFF]
directly. Godot imports glTF morph targets as blend shapes
(`ImporterMesh`/`ArrayMesh` blend shapes [Godot ImporterMesh]; PR #53865
implemented blend shape tracks [Godot PR 53865]), with one caveat from the
docs: with blend shapes present, Blender's glTF export must set
*Data > Armature > Export Deformation Bones Only* to Enabled or "exporting
non-deforming bones... will lead to incorrect shading" [Godot available
formats] — our rig's IK/pole helper bones make this mandatory. If morph
shading misbehaves on the flat-shaded mesh, fall back to option 2 (which
also survives palette quantization well, being solid fur colour).

Texture-swap blink was rejected: the model uses five flat-colour materials
with no eye texture region to swap (`Main`, `Main_Light`, `Black`, `Eyes`,
`Grey` [fox-model-candidates README]).

---

## 4. Custom clips to author in Blender

All clips are authored on the pack rig (the .blend ships in the official
pack zip [Quaternius pack page]) using its IK setup: paw planting uses the
`IKFrontLeg.L/R` / `IKBackLeg.L/R` target bones with `PoleTarget.L/R` /
`PoleTargetBack.L/R` controlling knee/elbow bend direction, and `FF.L/R` /
`FFB` as foot bones [fox-model-candidates README]. Planted-paw behaviours are
keyed by moving the IK *targets*, never by counter-posing legs in FK.

### Clip list (mapped 1:1 to handoff behaviours)

| Clip | Type / duration | Rig features / notes | Handoff behaviour |
| --- | --- | --- | --- |
| `BikeMount` | one-shot 1.2 s | Front paws reach handlebar grips (`IKFrontLeg` targets to bar nodes), hind feet onto pedals, small hop from walk pose. | "Discover it ahead, mount with a short transition" |
| `BikeRide-loop` | loop 1.0 s (one pedal revolution) | Paws planted on handlebars; feet follow opposite pedals; cadence stride-matched (see below); bag/tail clear of spokes (tail via SpringBone, tune to miss rear wheel). | "Paws stay on the handlebars; both feet follow opposite pedals; wheel rotation follows travel distance" |
| `BikeDismount` | one-shot 1.0 s | Mirror of mount; ends mid-stride, blend into Walk with `start_offset` matching foot phase [Godot AnimationNodeAnimation]. | "dismount into the walking stride" |
| `BoatBoard` | one-shot 1.5 s | Step/hop into hull (reuse `Jump_ToIdle` shape as reference), sit on thwart, paws plant gunwale via IK targets. | "Step into the cream dinghy" |
| `BoatPaddle-loop` | loop 1.2 s | Both paws on one paddle shaft (two `IKFrontLeg` targets on the grip), stroke phases keyed distinctly: entry, power, exit, recovery; body counter-lean; fox seated relative to hull. Boat speed is code-constant; the boat continues forward during recovery (no foot-slide constraint — paws hold the paddle, not ground). | "Paddle entry, power stroke, exit and recovery should read distinctly. Boat continues forward during recovery." |
| `BoatExit` | one-shot 1.5 s | Reverse of board, into walk. | "cross the water, step out and continue" |
| `SailTiller-loop` | loop ~3.0 s | Fox near stern, one paw on tiller (single IK target), subtle bob; sail flex and wake are scene/shader, not rig. Boat keeps moving. | "fox at the tiller, bow right"; "No stationary fishing pose" / no stationary sailing |
| `BroomMount` | one-shot 1.2 s | Two paws on shaft (IK targets on grip points), mount from walk while world scroll slows but continues. | "retain small forward progress during takeoff" |
| `BroomFly-loop` | loop ~1.6 s | Side-sitting straddle, ears back (`Ear1-4`), tail trailing (`Tail1-8`), readable face, restrained bounce; spark trail is scene code. | "two paws on the shaft and a readable face... restrained spark trail" |
| `BroomDismount` | one-shot 1.2 s | Land into walk transition. | — |
| `Pullup-loop` | single rep 1.2 s, looped 20x (24 s) | Paws planted on fixed bar (`IKFrontLeg` targets + `PoleTarget.L/R` so elbows bend correctly); hang (arms straight) and chin-over-bar distinct extremes; torso/neck/Head rise. | "20 pull-ups... full movement and clean contact" |
| `Dip-loop` | single rep 1.2 s, 6x (7.2 s) | Paws planted on two parallel bars (two IK target pairs); `dip_low` (elbows bent) and `dip_high` (arms straight) distinct keys. | "6 dips" |
| `MuscleUp-loop` | single rep 1.6 s, 3x (4.8 s) | Same single bar, but the support position *above* the bar distinguishes it from a pull-up; pole targets rotated so paws rotate over the bar. | "3 muscle-ups... The single-bar support above the bar distinguishes a muscle-up from a pull-up" |
| `Pushup-loop` | single rep 1.1 s, 8x (8.8 s) | Paws and toes planted: `IKFrontLeg` targets and `IKBackLeg`/`FFB` toes pinned to fixed ground points, `PoleTargetBack` for knee direction; straight body line through Torso chain; Head lifted. | "8 push-ups... straight body line, fixed paws/toes and the head lifted" |
| `WorkoutEnter` / `WorkoutExit` | one-shot ~1 s each | Enter: walk-to-bar, jump up. Exit: drop, collect the same satchel, face right, "enter the stride immediately" [HANDOFF]. | "collect the bag and immediately continue right" |
| `TelescopeLook` | one-shot 5.0 s (1 s lean-in, 3 s look, 1 s push-off) | One paw on scope body (single IK target), `Neck1-3`+`Head` lean to eyepiece; no sky panel overlay. | "one look through a small wayside scope... about five seconds" |
| `Wave-loop` | additive overlay ~1.6 s, fires once per pass-by | Front leg lifts and waves 2-3 cycles, head/neck toward the friend (or leave the neck to `LookAtModifier3D`); layered over WALK with a filtered Blend2 so legs below the shoulder keep walking. | "gives a brief nod or wave... Neither character stops" |
| `Nod-oneshot` | additive ~0.8 s | Neck/Head only; filter excludes everything else. | passing-friend nod variant |

Reused from the pack (no authoring): `Walk` 1.07 s (default travel),
`Gallop` 0.57 s (rare burst), `Gallop_Jump` 0.93 s (obstacle hop),
`Jump_ToIdle` 1.33 s (boarding hop reference), `Idle`/`Idle_2` 3.33 s and
`Idle_2_HeadLow` 4.00 s (emergency micro-pauses only — the programme avoids
standing still), `Eating` 2.53 s (unused for now: eating stops were removed).
`Attack`, `Death`, `Idle_HitReact1/2` are excluded — no combat in the
programme.

Bike cadence note: the handoff requires wheel rotation to follow travel
distance. Match the pedal loop the same way as stride: choose
`v_bike = wheel_circumference * gear_ratio / 1.0 s` (distance per pedal
revolution per loop second) so the 1.0 s ride loop is exact at scale 1.0;
wheels and crank rotate in code from scroll distance.

### Authoring and export workflow

1. **Author in the pack .blend** (from the official zip [Quaternius pack
   page]) on the existing `AnimalArmature`. One Action per clip; use the
   action's NLA track (Push Down / Stash) — the exporter "will be organized
   using the Nonlinear Animation editor" and Actions mode requires each
   action stashed to its own NLA track [Blender glTF manual].
2. **Name for Godot**: loops get a `-loop` suffix (`BikeRide-loop`) so Godot
   imports them looping; one-shots get no suffix [Godot node type
   customization]. Keep names stable — they become the state machine's state
   names.
3. **Export** per activity group (bike.glb, boat.glb, broom.glb, workout.glb,
   gestures.glb) plus the untouched fox scene: glTF 2.0, Animation mode
   **Actions** (default) — "This mode is useful if you are exporting for game
   engine, with an animation library of a character. Each action must be on
   its own NLA track" [Blender glTF manual]. Enable *Data > Shape Keys* (for
   the `Blink` morph) and, because of the blend shape, *Data > Armature >
   Export Deformation Bones Only* [Godot available formats]. Set "Set all
   glTF Animation starting at 0" for loop closure.
4. **Import into Godot as an AnimationLibrary**: select the glb in the
   FileSystem dock and change the import mode to **Animation Library** —
   "the glTF file will be imported as an AnimationLibrary instead of a
   PackedScene. This animation library can then be referenced in an
   AnimationPlayer node", which is the intended pipeline for "one set of
   animations for several characters, without having to duplicate animation
   data in every character" [Godot import configuration]. The fox scene and
   the AnimationPlayer reference these libraries; the wolf/husky/shibainu
   friends can reference the same libraries (section 5).
5. Verify per clip in the Advanced Import Settings preview (per-animation
   options, loop flags) [Godot advanced import settings]; keep
   `animation/fps` at the Blender baseline (30 default) [Godot import
   configuration].

---

## 5. Retargeting within the Quaternius pack

Facts established:

- The pack is 12 animals, "each with more than 12 unique animations", CC0,
  in FBX/OBJ/Blend/glTF [Quaternius pack page]; per-model GLBs are also on
  poly.pizza [alcuesto].
- **All 12 animals share one skeleton** ("AnimalArmature"), split into two
  rig variants by clip set: canine (Fox, Husky, Shibainu, Wolf — 12 clips
  including our exact set) and hoofed (Alpaca, Bull, Cow, Deer, Donkey,
  Horse, Horse_White, Stag — 13 clips) [animasim config.py].
- Fox and Wolf both have 51 bones, with 4 ear bones per side and an 8-bone
  tail; the head faces +Z in glTF. Hoofed rigs differ (Stag: 38 bones, no
  ear bones, 3-bone tail). Fox GLBs also carry duplicated clip names like
  `AnimalArmature|Gallop` — use the short names [alcuesto].

Implication for us: **clips transfer directly between the four canines**
(Walk, Gallop, idles, jumps, and all our custom clips), because they were
authored on the same armature. One caveat from the Godot docs: "you can't
share animations between multiple Skeletons just by using the same bone
names... it is necessary to match Bone Rests as well as Bone Names" [Godot
retargeting]. Since all four canines come from the same author's shared
armature their Bone Rests should be identical — **verify once** by diffing
rest matrices in Blender, and by playing a fox clip on the husky skeleton in
Godot and checking for distortion.

If a clip ever has to cross rig variants (canine -> hoofed), use Godot's
import-time retargeting: a `BoneMap` + custom `SkeletonProfile` (exported
from the Skeleton3D editor menu) with the options the docs describe —
including **Normalize Position Tracks**, which exists precisely because
"sharing the moving animation between models with different heights may
cause the appearance of slipping due to the difference in stride length"
[Godot retargeting]. For runtime sharing there is `RetargetModifier3D`
[Godot retargeting]. For locomotion we do not need either: re-measure `S`
per species from its own Walk clip and run the stride formula per
character (fox is 0.45 m tall vs wolf 0.80 m [animasim]; a shared clip with
a shared `S` would slide on one of them).

Rabbit/bear friends are **not** in this pack (confirmed against the animal
list [animasim]; the fox README notes the same). Recommendation, following
the pack's own architecture: build the rabbit and bear *meshes* skinned to a
copy of the same canine armature, rather than sourcing foreign rabbit/bear
rigs. Then every clip — pack clips and all customs — works on the friends
unchanged, and the passing-friend wave (section 4) is a single clip set.
A bear re-proportioned on a canine armature must keep ear/tail chain
positions sensible (4 ear bones/side, 8 tail bones are the readable-feature
minimum at 1/5 frame height [HANDOFF]).

---

## 6. Existing free quadruped animation libraries

**Mixamo is humanoid-only.** Adobe's Mixamo FAQ: "Currently, the auto-rigger
and animation libraries are for bipedal humanoids only" [Mixamo FAQ]. Mixamo
did sell quadruped motions (dogs, horses, wolves) in 2010 [PRNewswire], but
the Adobe-era library has dropped them (community confirmation [Adobe
community]). MonRig — a paid service that generates quadruped clips from
your own skeleton — exists specifically to fill that gap and confirms the
state of things: "Mixamo is made for humanoid characters... its animations
are human motions" [monrig.com].

**What does exist, CC0:**

- **Quaternius Ultimate Animated Animals** (in use): the only substantial
  CC0 quadruped locomotion set — 12 animals x 12-13 clips covering Walk,
  Gallop, Gallop_Jump, Jump, idles, Eating, Attack, Death, HitReact
  [Quaternius pack page; animasim]. Our base locomotion, already chosen.
- **Kenney Cube Pets v2.0 (2026)**: 24 CC0 animals (GLB/FBX/OBJ), each
  rigged and animated with idle/walk/run/action clips [HydeCo listing;
  gamemakers]. Notably includes a **bunny and a polar bear** — the two
  passing-friend species — but in a blocky voxel style that does not match
  the approved organic fox [fox-model-candidates README]. Useful only if
  the style ever pivots (it would survive the 640x360 dither pass
  extremely well).
- **Kenney Prototype Kit** (CC0): characters with 27 animations, animals
  with 4 animations [OpenGameArt] — grey blockout style, three or four
  basic clips at most.
- **Khronos glTF sample fox** (PixelMannen mesh CC0, tomkranis rig/anims
  CC-BY 4.0): 3 clips — Survey, Walk, Run [fox-model-candidates README;
  Khronos sample repo]. A 24-joint skeleton; retargeting its two extra
  locomotion loops onto the 51-bone Quaternius rig is more work than
  reusing the pack's own Walk/Gallop, so keep it as the proven fallback
  model only.
- **Sketchfab / OpenGameArt one-offs**: individual CC0 or CC-BY animated
  quadrupeds exist, but none ships a full locomotion + activity set;
  quality and licence hygiene vary (the fox candidates README already
  screened this space and rejected the NC/ND and AI-generated ones).
- **Unity Asset Store ports** (free "Animal Pack" style bundles): their
  licences do not clearly permit extraction for use outside Unity, so
  treat them as unusable for a Godot/Blender pipeline.

**Conclusion:** no free library anywhere ships bike, boat, broom,
calisthenics, telescope or paddle clips — for a fox or any quadruped. Those
are necessarily custom (section 4), which is why the rig's included IK
targets matter [fox-model-candidates README]. Base locomotion is fully
covered by the Quaternius pack; the only real external gap is the
rabbit/bear friends, best solved by skinning friend meshes to the shared
canine armature (section 5) rather than by adopting a second animation
style.

---

## References

- [Quaternius pack page] https://quaternius.com/packs/ultimateanimatedanimals.html
- [animasim config.py] https://github.com/danwahl/animasim/blob/main/src/animasim/config.py
- [alcuesto] https://pro.alcuesto.jp/blog/quaternius-animated-animal-pack
- [Godot AnimationTree] https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html
- [Godot AnimationNodeAnimation] https://docs.godotengine.org/en/stable/classes/class_animationnodeanimation.html
- [Godot AnimationPlayer] https://docs.godotengine.org/en/stable/classes/class_animationplayer.html
- [Godot SkeletonModifier3D] https://docs.godotengine.org/en/stable/classes/class_skeletonmodifier3d.html
- [Godot SpringBoneSimulator3D] https://docs.godotengine.org/en/latest/classes/class_springbonesimulator3d.html
- [Godot design article] https://godotengine.org/article/design-of-the-skeleton-modifier-3d/
- [Godot retargeting] https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/retargeting_3d_skeletons.html
- [Godot import configuration] https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/import_configuration.html
- [Godot node type customization] https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/node_type_customization.html
- [Godot advanced import settings] https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/advanced_import_settings.html
- [Godot available formats] https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html
- [Godot ImporterMesh] https://docs.godotengine.org/en/4.5/classes/class_importermesh.html
- [Godot PR 53865] https://github.com/godotengine/godot/pull/53865
- [Blender glTF manual] https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html
- [sboxguide] https://sboxguide.dev/fix/pace-locomotion-clips-by-stride
- [framesprite] https://www.framesprite.com/guides/fix-sprite-animation-foot-sliding
- [Epic, `set_playrate_to_match_speed`] https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AnimDistanceMatchingLibrary
- [Epic forums] https://forums.unrealengine.com/t/the-mismatch-between-animation-speed-and-character-speed/155482
- [anima skate.md] https://github.com/pariharshyamu/anima/blob/main/docs/skate.md
- [marcospereira.me] https://marcospereira.me/2023/12/02/unity-foot-sliding/
- [Mixamo FAQ] https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- [PRNewswire] https://www.prnewswire.com/news-releases/mixamo-extends-offering-to-include-animal-motions-92300849.html
- [Adobe community] https://community.adobe.com/questions-696/quadrupeds-in-mixamo-589917
- [monrig.com] https://monrig.com/mixamo-for-animals
- [HydeCo listing] https://hydecogames.com/art/packs/kenney-cube-pets/
- [gamemakers] https://gamemakers.jp/article/2026_03_16_133582/
- [OpenGameArt] https://opengameart.org/content/prototype-kit
- [Khronos sample repo] https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox
- Local: `output/fox-model-candidates/README.md`,
  `output/visual-direction-2026-10-30/HANDOFF.md`, project `AGENTS.md`.
