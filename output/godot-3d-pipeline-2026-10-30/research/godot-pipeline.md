# Godot 4 pipeline for the endless fox stream: low-res 3D band + 2D parallax, palette-quantized with world-anchored 4x4 Bayer

Research recipe for the OpenPost Radio visual rebuild, 30 October 2026.
Target look per `output/visual-direction-2026-10-30/HANDOFF.md`, "Pixel and
environment treatment": 640x360 native grid, uniform integer enlargement with
no smoothing, solid colour clusters inside forms, restrained 4x4 Bayer
transitions between *neighbouring* palette shades, texture anchored to its
world layer so scrolling does not shimmer, no screen-wide noise filter, and
constant depth order (sky lightest, near foreground darkest) across the whole
lighting cycle, with night reading as blue-green terrain plus small warm
lights.

Engine version targeted: **Godot 4.7 (stable since June 2026)**. The release
policy table lists 4.7 as the current supported stable series (4.6 January
2026, 4.7 June 2026, 4.8 "Q4 2026 estimate" still in development), so on 30
October 2026 the shipping stable is a 4.7.x maintenance release.
[1] https://docs.godotengine.org/en/stable/about/release_policy.html
[2] https://godotengine.org/releases/4.7/

---

## 0. Architecture at a glance

```
Root window (1280x720 or whatever the encoder wants)
 └── TextureRect showing Composition SubViewport, filter = NEAREST, integer scale
      └── Composition SubViewport  640x360, snap 2D settings ON
           ├── CanvasLayer -50  sky (flat palette slots)
           ├── CanvasLayer -40  far mountains 2D parallax   } each layer has its own
           ├── CanvasLayer -30  mid ridges 2D parallax      } slot/Bayer shader with a
           ├── TextureRect      3D band (SubViewport 640x360, ortho Camera3D)
           │     └── ... low-poly meshes with per-material slot shaders
           │     └── full-screen post quad (global nearest-palette safety net)
           ├── CanvasLayer -20  near foreground foliage 2D parallax
           └── (weather/overlay canvas, palette-locked too)
```

Every band quantizes *itself* into the palette before leaving its own
viewport/layer; nothing smooth ever reaches the final upscale. 1 world unit =
1 native pixel everywhere (Camera3D orthographic height 360), which makes
"world position" and "dither pixel" the same coordinate system.

---

## 1. Low-resolution pipeline (Godot 4.7)

### 1.1 Viewport setup

1. Create a **SubViewport** node at exactly **640x360** (`size =
   Vector2i(640, 360)`). This is the composition viewport: the 3D band
   SubViewport and all 2D parallax CanvasLayers live *inside* it, so the
   single quantization look is applied to both (see 1.4).
2. On the SubViewport: `transparent_bg` off, `snap_2d_transforms_to_pixel =
   true`, `snap_2d_vertices_to_pixel = true` (per-viewport properties
   exist; the project-setting forms are
   `rendering/2d/snap/snap_2d_transforms_to_pixel` and
   `rendering/2d/snap/snap_2d_vertices_to_pixel`, both default false).
   [3] https://docs.godotengine.org/en/4.5/classes/class_projectsettings.html
   [4] https://docs.godotengine.org/en/4.7/classes/class_viewport.html
   These two settings replaced Godot 3's single "GPU Pixel Snap"; the
   recommendation at the time was to enable both for pixel art.
   [5] https://github.com/godotengine/godot/issues/55006
3. 3D anti-aliasing: MSAA 3D off, TAA off, screen-space AA off, FXAA off;
   `use_debanding` off (debanding would smooth exactly the banding we want).
4. Project settings for 2D texture filtering: `default_texture_filter =
   nearest`. All art is flat palette colour; there are no gradients to smooth.
5. 3D camera: **orthographic, side view**. Set `size = 360` (orthographic
   `size` is height in world units), so 1 world unit = 1 pixel vertically;
   640 units across. The fox stays centered: the camera never pans; the world
   scrolls (as in the current renderer), or the camera moves through a static
   world and geometry is placed at integer world coordinates. Pick one and
   apply the snapping in 1.2 consistently.

### 1.2 Snapping to kill sub-pixel shimmer

- If the camera moves: snap its position to whole units every frame:
  `camera.position = Vector3(round(p.x), round(p.y), p.z)`. With 1 unit = 1
  pixel this is exact integer snapping; nothing renders between pixels.
- If the world scrolls under a fixed camera: move each layer in whole-pixel
  steps (accumulate `scroll_px += speed * delta`, then
  `layer.position.x = -floor(scroll_px)`). The fractional remainder is carried
  in the accumulator, never in the transform.
- Optionally snap vertices in 3D as PSX shaders do: quantize clip-space X/Y
  to a 640x360 grid in the vertex shader
  (`floor(ndc * res) / res * w`). The PSX ecosystem does exactly this to get
  stable retro edges:
  [6] https://github.com/MenacingMecha/godot-psx-style-demo/blob/master/shaders/psx_base.gdshaderinc
  [7] https://godotshaders.com/shader/psx-drag-drop-shader/
  With a fixed ortho camera and whole-unit placement you usually do not need
  vertex snapping, which is good: it causes the "wobble" PSX look, not the
  clean look we want.
- Known orthographic quirks to avoid: SDFGI and VoxelGI are not supported
  with orthographic cameras, and DirectionalLight3D shadows misbehave unless
  you set the camera's `far` or the light's first split explicitly. We use
  neither GI system, but configure the shadow split if we enable the sun
  shadow.
  [8] https://github.com/leopeltola/Godot-3d-pixelart-demo

### 1.3 Godot 4.5-4.7 scaling options worth using

- Stretch mode: set the project to **`viewport`** stretch mode with
  **Stretch Scale Mode = `integer`** (available since 4.2). Then the root
  viewport renders at the base size (640x360) and is integer-upscaled to the
  window; this matches "uniform integer enlargement with no smoothing"
  exactly and also decouples Movie Maker output resolution from window size
  (see 5.4).
  [9] https://docs.godotengine.org/en/4.7/tutorials/rendering/multiple_resolutions.html
- `canvas_items` stretch mode is the alternative, but it renders 2D directly
  at the window resolution (no 1:1 pixel correspondence), which is wrong for
  us. `viewport` keeps the guarantee.
- Godot 4.7 added a **nearest-neighbor 3D resolution scaling mode**
  (`Viewport.scaling_3d_mode = SCALING_3D_MODE_NEAREST`, i.e. project setting
  `rendering/scaling_3d/mode`): retro 3D stays crisp when scaling the 3D
  buffer. We do not need it (the 3D viewport is already exactly 640x360, and
  nearest mode forbids scale > 1.0), but it is the right tool if the 3D band
  is ever rendered at a different internal size.
  [2] https://godotengine.org/releases/4.7/
  [4] https://docs.godotengine.org/en/4.7/classes/class_viewport.html
- Community reference for the whole "SubViewport low-res + TextureRect
  nearest" pattern, including the classic trap that a `Node2D` root ignores
  Full Rect anchors (use a plain `Node` root):
  [10] https://wiseframe.dev/godot-pixel-art-shaders-pipeline-and-quantization
  [11] https://github.com/CBerry22/3d-Pixel-Art-In-Godot-4 (KrypticFractal's
  well-known Godot 4 3D pixel-art demo; camera+object snapping)
  [12] https://github.com/leopeltola/Godot-3d-pixelart-demo ("the shaders only
  work as intended when using a low game resolution... render the game part
  inside a sub-viewport")

### 1.4 Compositing 2D parallax + 3D band through the SAME quantization

Order inside the composition viewport (drawn back to front): sky CanvasLayer,
far/mid 2D mountain layers, `TextureRect` showing the 3D SubViewport
(`stretch_mode = stretch`, filter nearest, 640x360), near-foreground 2D
layers, weather overlay. Each layer's material already outputs *palette*
colours (sections 2-3), so the composite needs no additional quantization
pass; a screen-wide safety-net pass (2.2) can sit at the top if any input can
still be off-palette. Because both the 2D layers and the 3D band quantize in
their own shaders *before* compositing, both go through the same palette and
the same Bayer treatment; nothing is quantized twice. This mirrors how the
current 2D renderer paints palette slots per layer and dithers between
neighbouring slots.

---

## 2. The style shader: palette + 4x4 Bayer quantization

### 2.1 Prior art

- Bayer 4x4 as a `mat4` indexed by `FRAGCOORD` mod 4, used as a ColorRect
  overlay:
  [13] https://godotshaders.com/shader/bayer-dithering/
- Full quantize + Bayer 2x2/4x4/8x8 + arbitrary palette via a palette texture,
  including a "Snap To World" option that snaps pixel/dither coordinates to
  world rather than local coordinates (closest existing analogue of our
  requirement):
  [14] https://godotshaders.com/shader/arbitrary-color-reduction-ordered-dithering/
- Palette quantization with nearest-palette-color search over a 16-colour
  strip:
  [15] https://godotshaders.com/shader/pixeldither-color-quantizer-with-palette-support/
- Pre-planned dither *mixes* between 2+ palette colours baked into a LUT
  image (Yliluoma-style): this is strategy (b) in spirit, done with lookup
  textures:
  [16] https://godotshaders.com/shader/color-dither/
  [17] https://github.com/Donitzo/godot-color-dither
- PSX packs that combine vertex snap, low-res viewport and 15-bit ordered
  dither in Godot 4.x (useful for edge treatment and fog decisions):
  [18] https://github.com/dragthelake/godot-psx-shader
  [19] https://github.com/Rytelier/Godot-PSX-Visuals
  [20] https://github.com/GarrettGunnell/Godot-PSX (Acerola's PSX shader,
  ported: integer clip-space snapping, 15-bit dither/quantization)
- Godot shader language facts used below: `uniform` arrays are supported but
  cannot have default values; `set_shader_parameter("array", [Color(...),
  ...])` passes arrays; **global uniforms** (single value shared by all
  shaders, set at runtime with
  `RenderingServer.global_shader_parameter_set`) are exactly designed for
  environment-level parameters, and "assigning global uniform values can be
  done as many times as desired without impacting performance". Global
  *arrays* are not a supported global type, which is why the palette below
  is a small texture, not an array.
  [21] https://docs.godotengine.org/en/latest/tutorials/shaders/shader_reference/shading_language.html

### 2.2 Palette representation

Use a **palette texture**: an `ImageTexture` of size `16x1` RGBA8 (or
however many slots the final palette has), imported/bound with
`filter_nearest`. Slot index = depth order slot (slot 0 sky-lightest ... slot
N foreground-darkest) and *slot semantics never change*; only the RGBA
contents are swapped per lighting keyframe (section 4). Register it once as a
global shader uniform (`palette`) so every 2D and 3D material samples the
same texture:

```gdscript
# palette_driver.gd
var _tex := ImageTexture.create_from_image(_make_image(day_palette))
func _ready() -> void:
    RenderingServer.global_shader_parameter_add(
        "palette", RenderingServer.GLOBAL_VAR_TYPE_SAMPLER2D, _tex)
    # palette must also be declared in Project Settings > Shader Globals
func update_palette(img: Image) -> void:
    _tex.update(img)   # or swap between prebuilt textures, see 4.2
```

The 16-colour-strip convention (Lospec-style) is the standard used by the
reference shaders above [15].

### 2.3 The two strategies, evaluated honestly

**(a) Global nearest-palette-color with Bayer offset.** One post pass finds
the closest palette entry for every pixel and dithers between the two closest
entries based on a Bayer threshold. Pros: zero art direction needed, handles
any input, one shader. Cons: the match is not art-directed. A lit gradient on
a house wall can land on *any* palette colour, including ones reserved for
water or the fox's satchel; hue drifts as lighting changes; and it cannot
express "this layer dithers between exactly these two neighbouring shades",
which is the entire look of the reference. It also needs depth
reconstruction to anchor the dither (section 3), which is fine in 3D but
unavailable in 2D canvas shaders.

**(b) Per-material palette slot ids.** Each material declares the 1-2 palette
slots it dithers between (`slot_a`, `slot_b`), and a `bias` in 0..1 says where
lighting places it between them; the shader outputs `slot_b` when
`bias > bayer_threshold(world_pixel)` else `slot_a`. This is *exactly* how the
current 2D renderer works (palette slots per layer, restrained Bayer between
neighbouring shades, per-layer anchor) and what the handoff demands: "solid
colour clusters inside forms and restrained 4x4 Bayer transitions between
neighbouring palette shades". Pros: art-directed, deterministic, cheap (two
`texelFetch`es and one comparison); day/night is just a palette-texture
swap because materials store *slot ids*, not colours; and world-anchoring
comes for free from the vertex-stage world position (no depth pass needed).
Cons: every material must be assigned slots (this project already has a
slot-based palette system in `palette.js`, so the mapping is a translation,
not new work), and it cannot invent colours outside its two slots, so
lighting ranges must be authored per material.

**Recommendation: (b) as the primary mechanism, (a) as a one-pass safety
net.** Strategy (b) matches the existing art direction model and the
reference look; strategy (a) exists as an optional final pass over the
composite to catch anything off-palette (mostly antialiased edges and soft
particles). If only one is implemented, implement (b).

### 2.4 Complete shader C (primary): per-material slot dither, 3D meshes

```glsl
// slot_dither_3d.gdshader — for the low-poly meshes of the 3D band.
// Strategy (b): the material declares the two palette slots it mixes
// between; lighting is a single authored bias. Unshaded: all lighting
// decisions happen in the palette driver (GDScript), like the 2D original.
shader_type spatial;
render_mode unshaded, fog_disabled;

// Registered in Project Settings > Shader Globals; updated per frame (4.1).
global uniform sampler2D palette;

// The two NEIGHBOURING palette slots this surface dithers between.
// Slot ids are stable across day/night/season; only palette contents change.
uniform int slot_a = 0;
uniform int slot_b = 1;
// Where this surface sits between the slots: 0.0 = solid slot_a,
// 1.0 = solid slot_b. Driven per frame from sun/ambient (4.1).
uniform float bias : hint_range(0.0, 1.0) = 0.5;
// 0 disables dithering (solid slot), 1 = full 16-step Bayer mix.
uniform float dither_amount : hint_range(0.0, 1.0) = 1.0;

varying vec3 world_pos;

// 4x4 Bayer index matrix, standard arrangement.
const int BAYER[16] = int[16](
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5);

float bayer4x4(vec2 pixel) {
    // mod() keeps the pattern correct for negative/world-space coordinates.
    ivec2 ip = ivec2(mod(pixel, 4.0));
    return float(BAYER[ip.y * 4 + ip.x]) / 16.0;
}

void vertex() {
    // 1 world unit == 1 native pixel (Camera3D orthographic size = 360),
    // so world_pos.xy IS the dither pixel coordinate. The camera never
    // moves in the fixed-camera variant, so this anchors the pattern to
    // the geometry itself: scrolling can't shimmer it.
    world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
    float t = bayer4x4(world_pos.xy);
    vec3 a = texelFetch(palette, ivec2(slot_a, 0), 0).rgb;
    vec3 b = texelFetch(palette, ivec2(slot_b, 0), 0).rgb;
    // bias 0.5 with a 16-cell pattern gives the classic restrained mix;
    // dither_amount lets you pin a surface solid.
    float level = clamp(mix(0.5, bias, dither_amount), 0.0, 1.0);
    ALBEDO = level > t ? b : a;
}
```

Usage: one ShaderMaterial per surface family (terrain, distant ridge, tree
canopy, roof, wall, water, fox fur, muzzle...), each with its `slot_a/slot_b`
pair. `bias` is set per frame by the palette driver from the sun clock, e.g.
`terrain_mat.set_shader_parameter("bias",
lerp(0.25, 0.7, sun_height))`. Small warm night lights (windows) are simply
emissive quads pinned to a warm slot with `dither_amount = 0`.

### 2.5 Complete shader B: same treatment for the 2D parallax canvas layers

```glsl
// slot_dither_2d.gdshader — canvas_item, for flat sky/mountain layers.
shader_type canvas_item;
render_mode unshaded;

global uniform sampler2D palette;

uniform int slot_a = 0;
uniform int slot_b = 1;
uniform float bias : hint_range(0.0, 1.0) = 0.5;
uniform float dither_amount : hint_range(0.0, 1.0) = 1.0;
// Accumulated scroll of THIS layer, in native pixels
// (accumulated_travel * parallax_factor). See section 3.
uniform vec2 scroll_px = vec2(0.0);

const int BAYER[16] = int[16](
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5);

float bayer4x4(vec2 pixel) {
    ivec2 ip = ivec2(mod(pixel, 4.0));
    return float(BAYER[ip.y * 4 + ip.x]) / 16.0;
}

void fragment() {
    // Anchor: screen pixel + this layer's world scroll == world pixel.
    vec2 world_px = floor(FRAGCOORD.xy) + floor(scroll_px);
    float t = bayer4x4(world_px);
    vec3 a = texelFetch(palette, ivec2(slot_a, 0), 0).rgb;
    vec3 b = texelFetch(palette, ivec2(slot_b, 0), 0).rgb;
    float level = clamp(mix(0.5, bias, dither_amount), 0.0, 1.0);
    COLOR = vec4(level > t ? b : a, COLOR.a);
}
```

(FRAGCOORD is viewport-pixel coordinates; adding the layer's own accumulated
scroll makes the Bayer cell a function of world position, identical in
spirit to the "Snap To World" option in [14].)

### 2.6 Complete shader A (safety net / strategy (a)): global nearest-palette post pass for the 3D viewport

Full-screen quad inside the 3D SubViewport, per the official advanced
post-processing pattern (vertex `POSITION` override + `hint_depth_texture`):
[22] https://docs.godotengine.org/en/stable/tutorials/shaders/advanced_postprocessing.html

```glsl
// post_quantize_3d.gdshader — strategy (a): nearest-palette with ordered
// dither between the TWO CLOSEST entries, anchored to world X via depth.
// MeshInstance3D + QuadMesh (flip faces) as the last node of the 3D scene.
shader_type spatial;
render_mode unshaded, fog_disabled;

uniform sampler2D screen_tex : hint_screen_texture, repeat_disable, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, repeat_disable, filter_nearest;

global uniform sampler2D palette;
uniform int palette_size = 16;
// Dither reach in slot units; 0.5 is restrained, 1.0 is aggressive.
uniform float dither_strength : hint_range(0.0, 1.0) = 0.5;

const int BAYER[16] = int[16](
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5);

float bayer4x4(vec2 pixel) {
    ivec2 ip = ivec2(mod(pixel, 4.0));
    return float(BAYER[ip.y * 4 + ip.x]) / 16.0;
}

void vertex() {
    // Cover the screen at all times (docs pattern [22]).
    POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

void fragment() {
    vec4 s = texture(screen_tex, SCREEN_UV);
    // Sky shows through behind the 3D band: leave it to the 2D layers.
    if (s.a < 0.004) {
        ALPHA = 0.0;
    } else {
        // Reconstruct world position from depth (docs formula, Forward+;
        // for the Compatibility renderer use
        // vec3 ndc = vec3(SCREEN_UV, depth) * 2.0 - 1.0; instead [22]).
        float depth = texture(depth_tex, SCREEN_UV).x;
        vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, depth);
        vec4 world = INV_VIEW_MATRIX * INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
        vec3 world_pos = world.xyz / world.w;

        // World-anchored Bayer cell; 1 world unit = 1 pixel.
        float t = bayer4x4(world_pos.xy);

        // Two-closest palette entries, ordered-dithered between.
        int best = 0; float d_best = 1e9;
        int second = 1; float d_second = 1e9;
        for (int i = 0; i < palette_size; i++) {
            vec3 p = texelFetch(palette, ivec2(i, 0), 0).rgb;
            vec3 diff = p - s.rgb;
            float d = dot(diff, diff);
            if (d < d_best) {
                second = best; d_second = d_best;
                best = i; d_best = d;
            } else if (d < d_second) {
                second = i; d_second = d;
            }
        }
        // ratio ~0: solidly on best; ~0.5: between the two.
        float ratio = d_best / max(d_best + d_second, 1e-6);
        float level = clamp(ratio + (t - 0.5) * dither_strength, 0.0, 1.0);
        vec3 a = texelFetch(palette, ivec2(best, 0), 0).rgb;
        vec3 b = texelFetch(palette, ivec2(second, 0), 0).rgb;
        ALBEDO = level > 0.5 ? b : a;
        ALPHA = 1.0;
    }
}
```

Notes: the depth texture is only readable within the viewport being rendered
[22] [23](https://docs.godotengine.org/en/stable/tutorials/shaders/screen-reading_shaders.html),
which is why this pass lives *inside* the 3D SubViewport and not in the 2D
composite. Use the docs' exact world-reconstruction formula; the
VisualShaderNodeWorldPositionFromDepth variant had a known bug (missing
perspective divide), so do not rely on that node
[24] https://github.com/godotengine/godot/issues/100345.

---

## 3. World-anchored dither (the critical requirement)

Problem: a Bayer threshold computed from `FRAGCOORD` alone is glued to the
screen. When the world scrolls one pixel under a fixed camera, every surface
point lands on a *different* Bayer cell, so dithered areas crawl and shimmer
exactly the way the current renderer was fixed to avoid.

Three concrete options:

1. **World position from depth in the post pass** (shader A, 2.6). The
   official reconstruction gives each 3D pixel its true world coordinate, so
   the Bayer cell is a function of the world point, not the screen position:
   correct for any parallax rate, any camera motion, including 3D layers at
   different Z. Costs one depth fetch + two matrix multiplies per pixel,
   trivial at 640x360. Limits: only works for 3D (canvas_item shaders cannot
   read the 3D depth buffer [22][23]), and transparent pixels (sky) have no
   meaningful depth.
2. **Scroll-offset uniform per layer** (shader B, 2.5; also usable as the
   anchor for the whole 3D band when the band scrolls as one unit). Feed each
   layer's accumulated scroll in pixels:
   ```gdscript
   # each frame; delta is constant in movie mode (section 5)
   travel_px += speed_px_per_s * delta
   sky_mat.set_shader_parameter("scroll_px", Vector2(travel_px * 0.1, 0.0))
   ridge_mat.set_shader_parameter("scroll_px", Vector2(travel_px * 0.35, 0.0))
   band_mat.set_shader_parameter("scroll_px", Vector2(travel_px * 1.0, 0.0))
   ```
   `floor(FRAGCOORD.xy) + floor(scroll_px)` is a world coordinate as long as
   the layer actually moves by `-scroll_px` on screen (parallax scroll). For
   the 3D band under a *moving* camera this degrades (the band's parallax is
   not 1.0 unless the camera moves 1:1 with travel), so use it for the 2D
   layers and for a fixed-camera 3D band.
3. **Fixed world-snap rendering.** Move the world only in whole-pixel steps
   (1.2). This removes sub-pixel crawl but does NOT by itself anchor a
   screen-space Bayer pattern: after a 1px scroll, a screen-anchored pattern
   still reassigns cells. World-snap is necessary hygiene, not a solution.

**Recommendation: use option 1 for the 3D band (shader A already implements
it), option 2 for every 2D parallax layer (shader B), and rely on shader C's
vertex-stage `world_pos` for per-material 3D surfaces, which is world
anchoring for free and needs neither depth nor uniforms.** This trio covers
every band with its correct world coordinate:

| Band | Anchor mechanism | Cost |
| --- | --- | --- |
| 3D meshes (primary look) | `world_pos` varying, vertex stage | none |
| 3D safety-net pass | depth reconstruction (docs formula) | 1 depth fetch/px |
| 2D sky/ridges/foreground | accumulated-scroll uniform per layer | 1 uniform update/layer/frame |

Verification: render two stills 1 world-pixel apart and diff them; a
correctly anchored dither must produce identical output for identical world
regions (the current renderer's chunk-seam check, applied to pixels).

---

## 4. Day/night/season palette handling

### 4.1 Updating uniforms per frame from the clock

- One autoload (`palette_driver.gd`) owns wall-clock time, season and
  weather, mirroring the current `clock.js`/`palette.js` split.
- The palette texture is registered as a **global shader uniform**
  (`palette`, type sampler2D) so a single `global_shader_parameter_set`
  (or `ImageTexture.update`) repaints every material in the scene at once.
  The docs explicitly bless frequent updates: assigning global uniforms "can
  be done as many times as desired without impacting performance".
  [21] https://docs.godotengine.org/en/latest/tutorials/shaders/shader_reference/shading_language.html
- Per-material `bias` (lighting position between the two slots) is a regular
  uniform set with `material.set_shader_parameter("bias", v)`; with a few
  dozen materials this is negligible per frame. If it ever matters, group
  materials by slot pair and drive them through the same global uniform.
- Do NOT use the shader `TIME` built-in as the clock for long renders: it
  wraps every 3600 s by default (rollover configurable), which would glitch
  exactly at minute 60 of a 3-hour render.
  [25] https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/spatial_shader.html
  Pass your own uniform driven from the scene clock instead.

### 4.2 Keeping depth order and the night look

- Slot ids are semantic and constant (slot 0 = sky-lightest ... slot N =
  foreground-darkest); a lighting state is just a different 16x1 RGBA8
  texture whose contents keep that ordering. Precompute one texture per
  keyframe (dawn/noon/dusk/night x 4 seasons, plus weather variants) at
  build time and crossfade by sampling two textures and mixing in the
  driver before upload, or by giving materials `palette_a`/`palette_b` +
  a `palette_mix` global uniform.
- Night: author night palettes so terrain slots land in blue-green values
  (not black), and reserve 1-2 warm slots for windows/lights; a window quad
  with `dither_amount = 0` on the warm slot reads as a small warm light
  against blue-green terrain, per the handoff's requirement. Because
  materials reference slots, not colors, "night" is purely a palette-texture
  decision and cannot break depth order.
- Keep the sun/lighting rig out of the materials entirely (shaders are
  unshaded): lighting = choosing `bias` per material from the clock. This is
  what makes a 40-minute world day repaintable per frame with no shader
  recompiles, and it reproduces the current engine's "remap lighting through
  palette slots" model.

---

## 5. Offline rendering: Movie Maker mode for a ~3h seamless loop

### 5.1 What it is

Godot records **non-real-time** ("offline rendering"): with `--write-movie`,
the engine forces the reported `delta` in `_process` to exactly
`1 / fixed_fps` on every frame regardless of how long the frame took to
render, so output has perfect frame pacing and is independent of hardware
speed.
[26] https://docs.godotengine.org/en/stable/classes/class_moviewriter.html
[27] https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html

### 5.2 Exact commands

PNG image sequence (recommended, see 5.3):

```bash
# 3 h at 30 fps = 10800 s * 30 = 324000 frames, frame-exact loop by construction
godot --path /path/to/project \
  --write-movie renders/loop.png \
  --fixed-fps 30 \
  --quit-after 324000
```

- `--write-movie renders/loop.png` writes `renders/loop00000000.png`,
  `loop00000001.png`, ... (8-digit zero-padded, starting at 0) plus
  `renders/loop.wav` with the audio.
- `--fixed-fps 30` sets both simulation delta and output FPS.
- `--quit-after 324000` quits cleanly after exactly N frames; the docs list
  this flag explicitly for movie writing. Clean quit matters: killing the
  process (Ctrl+C / F8) leaves an AVI without duration information and a WAV
  without duration information (PNGs survive, but quit cleanly anyway).
- `--write-movie`, `--fixed-fps` and `--quit-after` are documented movie
  flags of the command line tutorial.
  [28] https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
- Output resolution = viewport resolution when using the `viewport` stretch
  mode (1.3); the window can be made small independently via
  **Display > Window > Size > Window Width/Height Override**, which the
  docs recommend for exactly this. With stretch mode `disabled`/`canvas_items`
  you can instead pass `--resolution 640x360`, clamped by your display.
  [27] https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html

AVI alternative (not recommended at 3 h):

```bash
godot --path /path/to/project --write-movie renders/loop.avi \
  --fixed-fps 30 --quit-after 324000
```

MJPEG/AVI is lossy (quality via **Editor > Movie Writer > Video Quality**,
recommended 0.75-0.9) and **capped at 4 GB per file**, which a 3 h render
will exceed; it is fine for short test clips. OGV/Theora exists but records
only in editor builds. [26][27]

Encode the PNG sequence with FFmpeg (docs' own pattern, adapted to the
project's H.264/AAC house style):

```bash
ffmpeg -r 30 -i renders/loop%08d.png -i renders/loop.wav \
  -c:v libx264 -crf 15 -pix_fmt yuv420p -c:a aac renders/loop.mp4
```

`-r` must match `--fixed-fps` or the video plays at the wrong speed and
desyncs from the WAV. [27]

### 5.3 PNG sequence + external encode vs direct AVI

Use **PNG + external x264**: lossless (the palette look survives encode
untouched until the final x264 pass), no 4 GB cap, and it feeds the existing
FFmpeg programme pipeline unchanged. AVI/MJPEG would add a lossy generation
before x264 and caps out mid-render. Disk math at 640x360: flat-colour
palette PNGs compress hard; assume 30-150 KB/frame, i.e. roughly 10-50 GB
for 324,000 frames, so budget disk accordingly.

### 5.4 Throughput and rendering context (incl. macOS/headless)

- Movie Maker needs a **real rendering context**. `--headless` is defined as
  `--display-driver headless --audio-driver Dummy` and is intended for
  servers and scripts; in headless mode rendering/window functions are
  disabled. The Movie Maker documentation never offers a headless path; it
  records viewports rendered by a GPU. Practical consequences: render on a
  desktop session (this project already prepares programmes on a
  workstation with `src/cli/program.js`); on a display-less Linux box you
  would need a virtual display (Xvfb) plus a real GL/Vulkan context. No
  macOS-specific limitation is documented; a normal GUI login session is
  sufficient, and since output resolution follows the *viewport* (not the
  window) in `viewport` stretch mode, the recording window can stay tiny.
  [27][28] https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_dedicated_servers.html
- Throughput at 640x360: rendering a simple low-poly scene is far from the
  bottleneck (a trivial scene at this resolution renders at hundreds to
  thousands of FPS on any modern GPU); PNG compression + disk writes
  dominate, and PNG writing is the documented "slow encoding" path. Expect
  well above real time on an Apple-silicon Mac (measure once; a 3 h loop
  should land in the tens-of-minutes-to-few-hours range, not overnight).
  Movie Maker ignores wall-clock time entirely, so nothing degrades if it
  runs slower.
- `Editor > Movie Writer > Disable V-Sync` can speed writing when the
  machine renders faster than the display refresh. Audio mix rate must be
  divisible by the movie FPS to avoid desync (docs). [27]

### 5.5 Determinism and the frame-exact seamless loop

Guarantees: `delta` in `_process` is exactly `1/fps` every frame (forced by
movie mode) [26]; physics ticks at fixed `physics_ticks_per_second`, and if
fps divides evenly into it, every rendered frame advances the simulation
the same number of ticks. To be safe, drive all world motion manually in
`_process` from an accumulator (`t += delta`), never from wall time
(`Time.get_ticks_usec`, `OS.get_ticks_msec`), and seed any randomness
deterministically from the scene seed (the current engine's rule:
randomness derives from absolute time/parameters, never call order).

Loop by construction: choose N = duration * fps (324000 for 3 h @ 30), make
every periodic driver's period divide N exactly (walk cycle, water shimmer,
weather, palette keyframes), and render exactly N frames with
`--quit-after N`. The world at frame N equals the world at frame 0, so the
programme loops seamlessly when the relay repeats the file; verify by
rendering frame N+1 and pixel-diffing it against frame 0 (same
sample-for-sample seam discipline the engine uses for audio chunks). The
`movie` feature tag lets you bump quality settings for render runs only.
[27]

---

## 6. Alternatives worth flagging

1. **Render at 2x (1280x720) and downsample into the palette pass.** The 3D
   viewport renders at 2x with normal (bilinear) scaling; the quantizer then
   samples the downsampled image. This stabilizes diagonal edges and lets
   lighting gradients land more precisely in the two-closest-slot dither,
   at the cost of 4x fragments (still trivial at this size) and a slight
   softness the current look may not want. Godot supports it natively via
   `scaling_3d_scale = 2.0` supersampling (bilinear only; nearest mode
   forbids scale > 1.0) [4][9], or simply a 1280x720 3D SubViewport sampled
   by the composite. Worth an A/B test if edge crawl survives snapping.
2. **Quantize + dither in FFmpeg instead of the engine.** `palettegen` +
   `paletteuse` with `dither=bayer` (and `bayer_scale`) applies ordered
   palette dither as a filter
   [29] https://ffmpeg.org/ffmpeg-filters.html#paletteuse.
   The tradeoff is disqualifying for the live look: the dither is anchored
   to the *video frame*, not the world, so it crawls as the world scrolls
   (exactly the shimmer section 3 exists to kill), it cannot consult depth
   or per-layer scroll, and the palette match is not art-directed. Fine as a
   quick grading experiment on a still/short clip; wrong for the stream.
3. **Custom MovieWriter via GDExtension** to pipe frames straight to FFmpeg
   from the render process (docs suggest GDExtension for custom writers
   [26]) — saves the PNG round-trip for very long renders, at the cost of
   maintaining native code. Only worth it if PNG throughput becomes the
   bottleneck in practice.

---

## Source list

1. Release policy / current stable versions: https://docs.godotengine.org/en/stable/about/release_policy.html
2. Godot 4.7 release notes (nearest-neighbor 3D scaling): https://godotengine.org/releases/4.7/
3. ProjectSettings (4.5) incl. `rendering/2d/snap/*`: https://docs.godotengine.org/en/4.5/classes/class_projectsettings.html
4. Viewport class (4.7): `SCALING_3D_MODE_NEAREST`, `snap_2d_transforms_to_pixel`: https://docs.godotengine.org/en/4.7/classes/class_viewport.html
5. Godot 3 "GPU Pixel Snap" -> the two 4.x snap settings: https://github.com/godotengine/godot/issues/55006
6. PSX vertex-snap shader (clip-space grid snap): https://github.com/MenacingMecha/godot-psx-style-demo/blob/master/shaders/psx_base.gdshaderinc
7. PSX drag-and-drop shader (vertex snapping, affine): https://godotshaders.com/shader/psx-drag-drop-shader/
8. Ortho-camera quirks (SDFGI/shadows): https://github.com/leopeltola/Godot-3d-pixelart-demo
9. Multiple resolutions (stretch modes, integer scale): https://docs.godotengine.org/en/4.7/tutorials/rendering/multiple_resolutions.html
10. Pixel-art shader pipeline series (SubViewport + nearest TextureRect): https://wiseframe.dev/godot-pixel-art-shaders-pipeline-and-quantization
11. 3D pixel art in Godot 4 (camera/object snapping demo): https://github.com/CBerry22/3d-Pixel-Art-In-Godot-4
12. leopeltola demo README (low-resolution requirement, sub-viewport advice): https://github.com/leopeltola/Godot-3d-pixelart-demo
13. Bayer dithering overlay shader: https://godotshaders.com/shader/bayer-dithering/
14. Arbitrary color reduction + palette ordered dithering (incl. "Snap To World"): https://godotshaders.com/shader/arbitrary-color-reduction-ordered-dithering/
15. PixelDither palette quantizer: https://godotshaders.com/shader/pixeldither-color-quantizer-with-palette-support/
16. Color Dither (pre-planned palette mixes): https://godotshaders.com/shader/color-dither/
17. Donitzo/godot-color-dither (2D/3D/post dither set, Yliluoma-derived): https://github.com/Donitzo/godot-color-dither
18. dragthelake/godot-psx-shader (PSX for Godot 4.7, low-res SubViewport + dither): https://github.com/dragthelake/godot-psx-shader
19. Rytelier/Godot-PSX-Visuals (screen downscale + color reduction + dither): https://github.com/Rytelier/Godot-PSX-Visuals
20. GarrettGunnell/Godot-PSX (Acerola PSX shader port): https://github.com/GarrettGunnell/Godot-PSX
21. Shading language (uniforms, arrays, global uniforms, set_shader_parameter): https://docs.godotengine.org/en/latest/tutorials/shaders/shader_reference/shading_language.html
22. Advanced post-processing (depth texture, world reconstruction, fullscreen quad): https://docs.godotengine.org/en/stable/tutorials/shaders/advanced_postprocessing.html
23. Screen-reading shaders (screen/depth texture rules): https://docs.godotengine.org/en/stable/tutorials/shaders/screen-reading_shaders.html
24. WorldPositionFromDepth bug (use the docs formula, not the node): https://github.com/godotengine/godot/issues/100345
25. Spatial shader reference (TIME 3600 s rollover): https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/spatial_shader.html
26. MovieWriter class (non-real-time delta, formats, 4 GB AVI cap): https://docs.godotengine.org/en/stable/classes/class_moviewriter.html
27. Creating movies (CLI, formats, config, quit, ffmpeg patterns): https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html
28. Command line tutorial (`--write-movie`, `--fixed-fps`, `--quit-after`, `--headless`): https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
29. FFmpeg paletteuse (bayer dither options): https://ffmpeg.org/ffmpeg-filters.html#paletteuse
30. Exporting for dedicated servers (headless = no GPU/display): https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_dedicated_servers.html
