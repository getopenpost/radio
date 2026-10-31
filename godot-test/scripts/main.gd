extends Node
# M1 test scene: the endless fox in Godot. Architecture mirrors the plan in
# output/godot-3d-pipeline-2026-10-30/README.md:
#   - vp_sky: flat 2D palette layers (sky bands, parallax mountain ridges, stars)
#   - vp_world: the 3D band (fox + CC0 town props) with a transparent sky
#   - vp_comp: composites both at 640x360 and runs the quantize + world-anchored
#     4x4 Bayer pass, so every output pixel is an exact palette slot color
#   - the display TextureRect shows vp_comp nearest-upscaled 2x (1280x720)
# The day runs on a 60 s cycle: day, golden dusk, night with stars and warm
# windows, golden dawn. Deterministic: no randomness, fixed scroll pattern.
#
# Known M1 gaps (by design, see the README): global nearest-palette matching
# instead of per-material slot pairs; the fox's shipped Walk clip is an
# in-place cycle, so foot contact does not set the scroll speed.

const W := 640
const H := 360
const DAY_SECONDS := 60.0
const SPEED := 0.75             # m/s world scroll (tuned for the clip's gait)
const FOX_ANIM_HEIGHT := 2.637   # measured from the clip's animated pose
const FOX_Y := 0.19             # paw contact offset in the GLB, measured ditto
const V := 5.0 * FOX_ANIM_HEIGHT  # frame height in metres: fox is 1/5 of frame
const PX_PER_M := W / (V * 16.0 / 9.0)
const FRONT_Z := 1.3            # prop front faces sit here; fox at 2.0, path 1.4

const PATTERN := ["house", "none", "tree", "none", "bell", "fir", "tree", "bike",
	"none", "house", "tree", "none", "inn", "none", "tree", "fir",
	"none", "house", "tree", "none", "bell", "none", "fir", "house"]
const SLOT_SPACING := 3.6
const STRIP_LEN := 86.4  # PATTERN.size() (24) * SLOT_SPACING

const PROPS := {
	"house": {"file": "res://assets/house-1.glb", "h": 0.50},
	"inn": {"file": "res://assets/inn.glb", "h": 0.58},
	"bell": {"file": "res://assets/bell-tower.glb", "h": 0.85},
	"bike": {"file": "res://assets/bicycle.glb", "h": 0.22},
	"tree": {"kind": "round"},
	"fir": {"kind": "fir"},
}

# Prop material restyle: the houses' shared 'Windows' material becomes the
# glowing window slot, so native window geometry lights up at night.
const PROP_MAT_SLOT := {"Windows": "windowGlow"}

# Fox restyle: the GLB's material names map to palette slots, so lit surfaces
# quantize onto the intended fur tones instead of speckling between slots.
const FOX_MAT_SLOT := {"Main": "fur", "Main_Light": "cream", "Grey": "furDark", "Black": "outline", "Eyes": "outline"}

var time_s := 0.0
var scrolled_m := 0.0
var frames_dir := ""    # set via --frames-dir=... : offline frame capture mode
var frames_max := 0
var frame_i := 0
const FRAME_FPS := 30.0

var vp_sky: SubViewport
var vp_world: SubViewport
var backdrop: Node2D
var sky_base: ColorRect
var sky_band: ColorRect
var world3d: Node3D
var sun: DirectionalLight3D
var env: Environment
var world_root: Node3D
var fox_root: Node3D
var fox_anim: AnimationPlayer
var instances: Array = []
var ground_wall_mat: StandardMaterial3D
var floor_mat: StandardMaterial3D
var path_mat: StandardMaterial3D
var win_mat: StandardMaterial3D
var leaf_mat: StandardMaterial3D
var pine_mat: StandardMaterial3D
var trunk_mat: StandardMaterial3D
var dyn_mats: Array = []  # [[StandardMaterial3D, slot index], ...] updated per frame
var post_mat: ShaderMaterial

var _box := AABB(Vector3(1e9, 1e9, 1e9), Vector3(-1e9, -1e9, -1e9))


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--frames-dir="):
			frames_dir = arg.substr(13)
		elif arg.begins_with("--max-frames="):
			frames_max = int(arg.substr(13))
	if frames_dir != "":
		DirAccess.make_dir_recursive_absolute(frames_dir)
		print("frames mode: dir=", frames_dir, " max=", frames_max)
		print("DEBUG visible_rect=", get_viewport().get_visible_rect(),
			" window=", DisplayServer.window_get_size(),
			" scale=", get_viewport().get_content_scale_factor())

	# --- sky viewport: flat palette layers -------------------------------------
	vp_sky = SubViewport.new()
	vp_sky.size = Vector2i(W, H)
	add_child(vp_sky)
	sky_base = ColorRect.new()
	sky_base.position = Vector2.ZERO
	sky_base.size = Vector2(W, H)
	vp_sky.add_child(sky_base)
	sky_band = ColorRect.new()
	sky_band.position = Vector2(0, H * 0.55)
	sky_band.size = Vector2(W, H * 0.45)
	vp_sky.add_child(sky_band)
	backdrop = (load("res://scripts/backdrop.gd") as Script).new() as Node2D
	vp_sky.add_child(backdrop)

	# --- 3D band: transparent sky so the 2D backdrop shows through -------------
	vp_world = SubViewport.new()
	vp_world.size = Vector2i(W, H)
	vp_world.transparent_bg = true
	add_child(vp_world)
	world3d = Node3D.new()
	vp_world.add_child(world3d)
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	var we := WorldEnvironment.new()
	we.environment = env
	world3d.add_child(we)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = V
	cam.position = Vector3(0, 0.34 * V, 8.0)
	cam.current = true
	world3d.add_child(cam)
	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	world3d.add_child(sun)
	sun.position = Vector3(10, 26, 5)  # from upper right, camera side
	sun.look_at(Vector3.ZERO, Vector3.UP)

	floor_mat = StandardMaterial3D.new()
	ground_wall_mat = StandardMaterial3D.new()
	path_mat = StandardMaterial3D.new()
	win_mat = StandardMaterial3D.new()
	win_mat.emission_enabled = true
	leaf_mat = StandardMaterial3D.new()
	pine_mat = StandardMaterial3D.new()
	trunk_mat = StandardMaterial3D.new()
	dyn_mats = [
		[leaf_mat, Pal.idx("leaf0")],
		[pine_mat, Pal.idx("pine0")],
		[trunk_mat, Pal.idx("trunk")],
	]

	# Floor for contact shadows (edge-on, so it reads as grounding, not geometry).
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(400, 60)
	floor_mi.mesh = pm
	floor_mi.material_override = floor_mat
	world3d.add_child(floor_mi)
	# The ground fill and the path strip, as vertical bands like the 2D scene.
	var wall := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(400, 3.0 * V)
	wall.mesh = qm
	wall.material_override = ground_wall_mat
	wall.position = Vector3(0, -1.5 * V, 0.5)
	world3d.add_child(wall)
	var pathq := MeshInstance3D.new()
	var pq := QuadMesh.new()
	pq.size = Vector2(400, 0.09 * V)
	pathq.mesh = pq
	pathq.material_override = path_mat
	pathq.position = Vector3(0, -0.045 * V, 1.4)
	world3d.add_child(pathq)

	# --- the town strip ---------------------------------------------------------
	world_root = Node3D.new()
	world3d.add_child(world_root)
	build_strip()

	# --- the fox ----------------------------------------------------------------
	fox_root = (load("res://assets/fox.glb") as PackedScene).instantiate()
	world3d.add_child(fox_root)
	fox_root.position = Vector3(0, FOX_Y, 2.0)
	face_fox()
	restyle_fox()
	var players := fox_root.find_children("*", "AnimationPlayer", true, false)
	if not players.is_empty():
		fox_anim = players[0] as AnimationPlayer
		fox_anim.play("Walk")
		# The shipped clip is an in-place cycle; slow the gait so the stride
		# reads closer to the scroll speed. A real fix needs re-authored,
		# distance-driven clips (see the research README).
		fox_anim.speed_scale = 0.55
		if frames_dir != "":
			fox_anim.pause()  # stepped manually on the fixed frame clock

	# --- display: sky + world + the quantize pass, all in the window canvas ---
	# The quantizer runs LAST, in the window itself. Viewport textures take a
	# float/half-float round trip on some drivers that shifts dark bytes by a
	# level; running the palette pass on the window's own screen texture snaps
	# that drift to exact palette bytes, and the movie writer captures the
	# already-quantized window, so every frame is pure palette slots.
	var root_rect := Control.new()
	root_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(root_rect)
	var sky_rect := TextureRect.new()
	sky_rect.texture = vp_sky.get_texture()
	sky_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	sky_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sky_rect.stretch_mode = TextureRect.STRETCH_SCALE
	sky_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	root_rect.add_child(sky_rect)
	var world_rect := TextureRect.new()
	world_rect.texture = vp_world.get_texture()
	world_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	world_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	world_rect.stretch_mode = TextureRect.STRETCH_SCALE
	world_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	root_rect.add_child(world_rect)
	var post := ColorRect.new()
	post.set_anchors_preset(Control.PRESET_FULL_RECT)
	post.material = ShaderMaterial.new()
	(post.material as ShaderMaterial).shader = load("res://shaders/quantize.gdshader")
	post_mat = post.material as ShaderMaterial
	post_mat.set_shader_parameter("pal_size", 38)  # slots in scripts/palette.gd
	post_mat.set_shader_parameter("pixel_scale", Vector2(2.0, 2.0))
	root_rect.add_child(post)


func build_strip() -> void:
	for copy in 3:
		for i in PATTERN.size():
			var kind: String = PATTERN[i]
			if kind == "none":
				continue
			var slot_x := (copy * PATTERN.size() + i - PATTERN.size()) * SLOT_SPACING
			var inst := make_prop(kind, copy * PATTERN.size() + i)
			inst.position.x = slot_x
			instances.append(inst)


func make_prop(kind: String, slot_index: int) -> Node3D:
	var def: Dictionary = PROPS[kind]
	if def.has("kind"):
		return make_tree(String(def["kind"]))
	var inst: Node3D = (load(def["file"]) as PackedScene).instantiate()
	world_root.add_child(inst)
	var box := aabb_of(inst)
	var s: float = float(def["h"]) * V / maxf(0.001, box.size.y)
	inst.scale = Vector3(s, s, s)
	box = aabb_of(inst)
	inst.position.y += -box.position.y
	inst.position.z += FRONT_Z - box.end.z
	if slot_index % 2 == 1:
		inst.rotate_y(PI)  # mirrored neighbours avoid the copy-paste look
		box = aabb_of(inst)
		inst.position.x += -(box.position.x + box.end.x) / 2.0
		inst.position.z += FRONT_Z - box.end.z
	restyle_prop(inst)
	return inst


# Palette-exact trees built in code, so the canopy reads as foliage and never
# competes with the fox's silhouette.
func make_tree(kind: String) -> Node3D:
	var root := Node3D.new()
	world_root.add_child(root)
	var trunk := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	if kind == "fir":
		cyl.top_radius = 0.02 * V
		cyl.bottom_radius = 0.035 * V
		cyl.height = 0.30 * V
		trunk.position = Vector3(0, 0.15 * V, 0)
		var cone_m := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.23 * V
		cone.height = 0.62 * V
		cone_m.mesh = cone
		cone_m.material_override = pine_mat
		cone_m.position = Vector3(0, 0.55 * V, 0)
		root.add_child(cone_m)
	else:
		cyl.top_radius = 0.022 * V
		cyl.bottom_radius = 0.032 * V
		cyl.height = 0.28 * V
		trunk.position = Vector3(0, 0.14 * V, 0)
		var can := MeshInstance3D.new()
		var sph := SphereMesh.new()
		sph.radius = 0.20 * V
		sph.height = 0.42 * V
		can.mesh = sph
		can.material_override = leaf_mat
		can.position = Vector3(0, 0.50 * V, 0)
		root.add_child(can)
	trunk.mesh = cyl
	trunk.material_override = trunk_mat
	root.add_child(trunk)
	return root


# House windows: swap the native 'Windows' material for the glowing one.
func restyle_prop(inst: Node3D) -> void:
	for node in inst.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		for s in mi.mesh.get_surface_count():
			var m := mi.mesh.surface_get_material(s) as Material
			if m == null:
				continue
			var slot: String = PROP_MAT_SLOT.get(m.resource_name, "")
			if slot == "":
				continue
			(mi.mesh as ArrayMesh).surface_set_material(s, win_mat)


func face_fox() -> void:
	var skels := fox_root.find_children("*", "Skeleton3D", true, false)
	if skels.is_empty():
		push_error("fox: no skeleton found")
		return
	var skel := skels[0] as Skeleton3D
	var ni := skel.find_bone("Neck1")
	var ti := skel.find_bone("Tail1")
	if ni < 0 or ti < 0:
		push_error("fox: Neck1/Tail1 bones missing")
		return
	var d := skel.get_bone_global_rest(ni).origin - skel.get_bone_global_rest(ti).origin
	var ang := 0.0
	if absf(d.x) >= absf(d.z):
		ang = 0.0 if d.x > 0 else PI  # already side-on
	else:
		ang = PI / 2 if d.z > 0 else -PI / 2  # faces +-Z; bring +Z to +X
	fox_root.rotate_y(ang)
	print("fox facing rotation: ", ang, " (neck-tail vector ", d, ")")


func restyle_fox() -> void:
	for node in fox_root.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		for s in mi.mesh.get_surface_count():
			var m := mi.mesh.surface_get_material(s) as Material
			if m == null:
				continue
			var slot: String = FOX_MAT_SLOT.get(m.resource_name, "")
			if slot == "":
				continue
			var nm := StandardMaterial3D.new()
			(mi.mesh as ArrayMesh).surface_set_material(s, nm)
			dyn_mats.append([nm, Pal.idx(slot)])


func aabb_of(node: Node) -> AABB:
	_box = AABB()
	_gather(node)
	if _box == AABB():
		return AABB(Vector3.ZERO, Vector3.ONE)  # degenerate guard
	return _box


func _gather(node: Node) -> void:
	if node is MeshInstance3D:
		var mi := node as MeshInstance3D
		var a := mi.get_aabb()
		var t := mi.global_transform
		for i in 8:
			var p := t * (a.position + Vector3(a.size.x * float(i & 1), a.size.y * float((i >> 1) & 1), a.size.z * float((i >> 2) & 1)))
			if _box == AABB():
				_box = AABB(p, Vector3.ONE * 0.001)
			_box = _box.expand(p)
	for c in node.get_children():
		_gather(c)


func _process(delta: float) -> void:
	if frames_dir != "":
		delta = 1.0 / FRAME_FPS  # fixed clock: renders are deterministic
		if fox_anim:
			fox_anim.advance(delta)
	time_s += delta
	var phase := fmod(time_s / DAY_SECONDS, 1.0)
	var light := light_curve(phase)
	var warm := warm_curve(phase)
	var pal := Pal.compute(1.0 - light, warm)
	apply_palette(pal, light, warm)
	scrolled_m += SPEED * delta
	world_root.position.x = -scrolled_m
	for inst in instances:
		if inst.position.x - scrolled_m < -40.0:
			inst.position.x += 3.0 * STRIP_LEN
	var scroll_px := scrolled_m * PX_PER_M
	if post_mat:
		post_mat.set_shader_parameter("scroll_shift", int(scroll_px) % 4)
		post_mat.set_shader_parameter("pixel_scale", get_viewport().get_visible_rect().size / Vector2(W, H))
	backdrop.offset_far = scroll_px * 0.22
	backdrop.offset_near = scroll_px * 0.42
	backdrop.offset_cloud = scroll_px * 0.08
	backdrop.queue_redraw()
	if frames_dir != "":
		frame_i += 1
		if frame_i > 1:  # frame 1 captures the blank initial canvas
			get_viewport().get_texture().get_image().save_png(
				frames_dir + "/frame_%05d.png" % frame_i)
		if frames_max > 0 and frame_i >= frames_max + 1:
			get_tree().quit()


func apply_palette(pal: PackedColorArray, light: float, warm: float) -> void:
	var night := 1.0 - light
	sky_base.color = Pal.color_of(pal, "sky1")
	sky_band.color = Pal.color_of(pal, "sky0")
	backdrop.far_color = Pal.color_of(pal, "far0")
	backdrop.near_color = Pal.color_of(pal, "far1")
	backdrop.star_color = Pal.color_of(pal, "star")
	backdrop.sun_color = Pal.color_of(pal, "sun")
	backdrop.moon_color = Pal.color_of(pal, "moon")
	backdrop.cloud_color = Pal.color_of(pal, "cloud")
	backdrop.cloud_shade = Pal.color_of(pal, "cloudShade")
	backdrop.star_alpha = night * (1.0 - 0.6 * warm)
	ground_wall_mat.albedo_color = Pal.color_of(pal, "ground0")
	floor_mat.albedo_color = Pal.color_of(pal, "ground1")
	path_mat.albedo_color = Pal.color_of(pal, "path")
	win_mat.albedo_color = Pal.color_of(pal, "windowOff")
	win_mat.emission = Pal.color_of(pal, "window")
	win_mat.emission_energy_multiplier = night * 1.2
	for e in dyn_mats:
		(e[0] as StandardMaterial3D).albedo_color = pal[e[1]]
	sun.light_color = Color(1.0, 0.94, 0.84).lerp(Color(0.62, 0.72, 1.0), night).lerp(Color(1.0, 0.72, 0.42), warm)
	sun.light_energy = 0.25 + 0.95 * light
	env.ambient_light_color = Pal.color_of(pal, "sky1")
	env.ambient_light_energy = 0.45 + 0.45 * light
	var arr := PackedVector3Array()
	arr.resize(64)
	for i in pal.size():
		var pc: Color = pal[i]
		arr[i] = Vector3(pc.r, pc.g, pc.b)
	post_mat.set_shader_parameter("pal", arr)


func light_curve(p: float) -> float:
	if p < 0.42:
		return 1.0
	if p < 0.58:
		return 1.0 - smoothstepf((p - 0.42) / 0.16)
	if p < 0.92:
		return 0.0
	return smoothstepf((p - 0.92) / 0.08)


func warm_curve(p: float) -> float:
	return maxf(bell(p, 0.5, 0.07), bell(p, 0.965, 0.06))


func bell(p: float, c: float, w: float) -> float:
	var t := clampf(1.0 - absf(p - c) / w, 0.0, 1.0)
	return t * t


func smoothstepf(t: float) -> float:
	var x := clampf(t, 0.0, 1.0)
	return x * x * (3.0 - 2.0 * x)
