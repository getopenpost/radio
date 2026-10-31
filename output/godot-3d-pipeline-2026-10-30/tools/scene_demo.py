"""Build the side-scroller style-proof scene in Blender (headless) and render it.

Fox: Quaternius Ultimate Animated Animal Pack fox (CC0) with its Walk clip.
Props: CC0 samples downloaded by the asset research pass.
Layout mirrors the planned Godot scene: orthographic side camera, fox fixed
near frame center facing +X, the world scrolling left, distant peaks as flat
backdrop layers. Outputs raw renders; the palette + Bayer dither pass runs
separately in post_process.py.

The walk sequence is rendered in cycle-length segments because the clip's
action is looped by replay, not by NLA repeat: each segment renders the clip
frames 1..26 while a frame handler scrolls the world by the global frame
index. That is the same distance-driven phase the real pipeline would use.
"""
import bpy, os, json, math, traceback
from math import radians
from mathutils import Vector

BASE = '/Users/rgo/dev/rgo-music/output/godot-3d-pipeline-2026-10-30'
RAW = BASE + '/renders/raw'
FOX = '/Users/rgo/dev/rgo-music/output/fox-model-candidates/quaternius-fox.glb'
SAMPLES = BASE + '/assets-samples'
os.makedirs(RAW, exist_ok=True)
FPS = 24
FRAMES = 120
STILL_FRAME = 13  # mid-stride

meta = {'status': 'failed'}
log = lambda *a: print('[demo]', *a, flush=True)
seg_offset = [0]


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def flat_mat(name, hexcolor, rough=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*hex_rgb(hexcolor), 1.0)
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = rough
    for spec in ('Specular', 'Specular IOR Level'):
        if spec in bsdf.inputs:
            bsdf.inputs[spec].default_value = 0.0
    return m


def gltf_import(path):
    try:
        bpy.ops.wm.gltf_import(filepath=path)
    except AttributeError:
        bpy.ops.import_scene.gltf(filepath=path)


def imported_roots(before):
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    return new, roots


def static_bbox(objs):
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for c in o.bound_box:
            w = mw @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def animated_bbox(arm, objs, frame):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        mw = oe.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
        oe.to_mesh_clear()
    return lo, hi


def place_prop(path, x, front_y, target_h, rotz=0.0, name=''):
    """Place a prop so its camera-facing face sits at `front_y`, base at z=0.

    Layering contract: fox at y=-2 is nearest, then the path band at -1.4,
    then props' front faces at -1.3 (behind the fox so it is never occluded),
    the water band at -0.7, the ground wall at -0.5, the peaks far behind.
    """
    before = set(bpy.data.objects)
    gltf_import(path)
    new, roots = imported_roots(before)
    if not roots:
        raise RuntimeError('no root for ' + path)
    root = roots[0]
    lo, hi = static_bbox(new)
    s = target_h / max(1e-6, hi.z - lo.z)
    root.scale = (root.scale[0] * s, root.scale[1] * s, root.scale[2] * s)
    bpy.context.view_layer.update()
    lo, hi = static_bbox(new)
    root.location.x += x - (lo.x + hi.x) / 2
    root.location.y += front_y - lo.y
    root.location.z += -lo.z
    root.rotation_euler.rotate_axis('Z', radians(rotz))
    bpy.context.view_layer.update()
    lo, hi = static_bbox(new)  # after the move, for placement decisions
    root.parent = world_root
    root.matrix_parent_inverse = world_root.matrix_world.inverted()
    log('placed %-10s at x=%6.2f h=%6.2f front_y=%6.2f' % (name, x, hi.z - lo.z, lo.y))
    return lo, hi


try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.render.resolution_x = 640
    scene.render.resolution_y = 360
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.frame_start = 1
    scene.frame_end = 26

    world = bpy.data.worlds.new('Sky')
    world.use_nodes = True  # a node world renders the sky AND lights the scene
    bg_node = world.node_tree.nodes.get('Background')
    bg_node.inputs['Color'].default_value = (*hex_rgb('#f1ede4'), 1.0)  # palette.js sky1, day
    bg_node.inputs['Strength'].default_value = 0.85
    scene.world = world

    world_root = bpy.data.objects.new('WorldRoot', None)
    scene.collection.objects.link(world_root)
    bpy.context.view_layer.update()

    # --- fox ------------------------------------------------------------------
    before = set(bpy.data.objects)
    gltf_import(FOX)
    fox_new, fox_roots = imported_roots(before)
    fox = next((o for o in fox_new if o.type == 'ARMATURE'), fox_roots[0])
    log('actions:', sorted(a.name for a in bpy.data.actions))
    walk = next((a for a in bpy.data.actions if 'walk' in a.name.lower()), None)
    if walk is None:
        raise RuntimeError('no Walk action found')

    db = fox.data.bones
    fox.rotation_euler.rotate_axis('Z', radians(-90 if db['Neck1'].head_local.y > db['Tail1'].head_local.y else 90))
    bpy.context.view_layer.update()

    clip_len = int(round(walk.frame_range[1] - walk.frame_range[0]))
    ad = fox.animation_data_create()
    track = ad.nla_tracks.new()
    track.mute = False
    track.strips.new(walk.name, 1, walk)
    ad.action = None

    # True animated dimensions (the glTF bind pose is spread, not the stance),
    # measured from both endpoints of every bone: bones can point either way,
    # and the mesh bbox includes the drooping tail tip, not the ground line.
    lo_a, hi_a = animated_bbox(fox, fox_new, STILL_FRAME)
    log('animated mesh bbox: z %.2f..%.2f' % (lo_a.z, hi_a.z))
    stats = {}
    for f in range(1, clip_len + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        for pb in fox.pose.bones:
            mw = fox.matrix_world @ pb.matrix
            for end, vec in (('head', Vector((0, 0, 0))), ('tail', Vector((0, pb.length, 0)))):
                w = mw @ vec
                st = stats.setdefault('%s.%s' % (pb.name, end), {'xs': [], 'zs': []})
                st['xs'].append(w.x)
                st['zs'].append(w.z)
    legs = {k: st for k, st in stats.items()
            if k.split('.')[0].startswith(('Front', 'Back', 'IKF', 'IKB'))}
    low = sorted(legs.items(), key=lambda kv: min(kv[1]['zs']))[:10]
    for name, st in low:
        log('%-26s minz=%6.2f zrange=%5.2f xsweep=%6.3f' % (name, min(st['zs']), max(st['zs']) - min(st['zs']), max(st['xs']) - min(st['xs'])))
    paw_ground = min(min(st['zs']) for st in legs.values())
    paw_top = hi_a.z
    fox_h = paw_top - paw_ground
    log('paw ground z=%.2f, visual fox height=%.2f' % (paw_ground, fox_h))
    fox.location.z += -paw_ground  # paws on the ground line
    fox.location.y = -2.0          # fox is the nearest layer
    bpy.context.view_layer.update()
    meta['fox_height_m'] = fox_h
    V = 5.0 * fox_h  # frame height: fox = 1/5 of frame height, per HANDOFF
    meta['frame_height_m'] = V

    # Stride from the four lowest paw endpoints (front and back paws).
    paws = sorted(legs.items(), key=lambda kv: min(kv[1]['zs']))[:4]
    stride = max(max(st['xs']) - min(st['xs']) for _, st in paws)
    body = stats.get('Body.head') or stats.get('Torso.head')
    body_travel = max(body['xs']) - min(body['xs']) if body else 0.0
    meta['paw_sweep_m'] = stride
    meta['body_travel_m'] = body_travel
    clip_speed = stride / (clip_len / FPS)
    # The pack's Walk clip sweeps its paws only a few centimetres (authored as
    # an in-place cycle), so the world speed is chosen for the picture: about
    # 1/8 of a frame width per second. Production clips must be re-authored
    # distance-driven per research/animation.md; this demo scrolls visually.
    v = 0.12 * V / (16 / 9)  # m/s -> 0.12 * frame_width per second
    meta['walk_speed_mps'] = v
    meta['clip_authored_speed_mps'] = clip_speed
    log('paw sweep=%.3fm body_travel=%.3f clip speed=%.3fm/s; demo scroll=%.3fm/s' % (stride, body_travel, clip_speed, v))

    def scroll_world(sc, depsgraph=None):
        world_root.location.x = -((seg_offset[0] + sc.frame_current - 1) / FPS) * v
    bpy.app.handlers.frame_change_pre.append(scroll_world)

    # --- backdrop layers ------------------------------------------------------
    def band(name, hexcolor, zlo, zhi, xlo, xhi, y):
        m = bpy.data.meshes.new(name)
        m.from_pydata([(xlo, y, zlo), (xhi, y, zlo), (xhi, y, zhi), (xlo, y, zhi)], [], [(0, 1, 2, 3)])
        o = bpy.data.objects.new(name, m)
        o.data.materials.append(flat_mat(name, hexcolor))
        scene.collection.objects.link(o)
        o.parent = world_root
        o.matrix_parent_inverse = world_root.matrix_world.inverted()
        return o

    band('ground', '#d3cab9', -3.0, 0.0, -120, 120, -0.5)      # ground0
    band('path', '#e6dfd2', -0.08, 0.0, -120, 120, -1.4)       # path
    band('water', '#c3c9c6', -1.6, 0.0, -10.5, -3.0, -0.7)     # water0

    for i, (x, r, d, col, y) in enumerate([
        (-14, 5.5, 9.5, '#d7cfc2', 50), (-6, 4.0, 7.5, '#d7cfc2', 50),
        (2, 6.5, 11.0, '#d7cfc2', 50), (10, 5.0, 8.5, '#d7cfc2', 50),
        (-10, 3.4, 6.0, '#c9c0b2', 40), (-2, 4.8, 7.8, '#c9c0b2', 40),
        (6, 3.6, 5.5, '#c9c0b2', 40), (13, 5.6, 9.0, '#c9c0b2', 40),
    ]):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=r, depth=d, location=(x, y, d / 2 - 0.2))
        cone = bpy.context.active_object
        cone.data.materials.append(flat_mat('peak%d' % i, col))
        cone.parent = world_root
        cone.matrix_parent_inverse = world_root.matrix_world.inverted()

    # --- CC0 props along the strip -------------------------------------------
    place_prop(SAMPLES + '/kenney-boat-row-small.glb', -9.0, -0.9, 0.16 * V, 0, 'dinghy')
    place_prop(SAMPLES + '/boatwsail.glb', -6.6, -0.9, 0.30 * V, 0, 'sailboat')
    h1lo, h1hi = place_prop(SAMPLES + '/house-1.glb', -2.6, -1.3, 0.50 * V, 0, 'house1')
    place_prop(SAMPLES + '/bicycle.glb', -1.2, -2.6, 0.22 * V, 0, 'bicycle')
    h2lo, h2hi = place_prop(SAMPLES + '/inn.glb', 1.9, -1.3, 0.58 * V, 0, 'inn')
    place_prop(SAMPLES + '/quaternius-tree-1.glb', 3.5, -1.3, 0.55 * V, 0, 'tree1')
    place_prop(SAMPLES + '/kaykit-tree-1.glb', 5.0, -1.3, 0.50 * V, 0, 'tree2')
    place_prop(SAMPLES + '/bell-tower.glb', 7.2, -1.3, 0.85 * V, 0, 'belltower')
    place_prop(SAMPLES + '/quaternius-tree-1.glb', 9.4, -1.3, 0.58 * V, 180, 'tree3')

    # --- warm windows for the night render ------------------------------------
    win_mat = bpy.data.materials.new('window')
    win_mat.use_nodes = True
    bsdf = win_mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*hex_rgb('#7a7266'), 1.0)
    if 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = (*hex_rgb('#fdb36b'), 1.0)
    if 'Emission Strength' in bsdf.inputs:
        bsdf.inputs['Emission Strength'].default_value = 0.0
    bpy.ops.mesh.primitive_plane_add(size=1)
    win_proto = bpy.context.active_object
    win_proto.data.materials.append(win_mat)
    win_proto.rotation_euler = (radians(90), 0, 0)
    for (cx, front_y, h) in [(-2.6, h1lo.y, h1hi.z), (1.9, h2lo.y, h2hi.z)]:
        for k in (-1, 0, 1):
            w = win_proto.copy()
            w.data = win_proto.data
            w.scale = (0.045 * V, 0.06 * V, 1)
            w.location = (cx + k * 0.10 * V, front_y - 0.03 * V, 0.38 * h)
            scene.collection.objects.link(w)
            w.parent = world_root
            w.matrix_parent_inverse = world_root.matrix_world.inverted()
    bpy.data.objects.remove(win_proto, do_unlink=True)

    # --- lights ---------------------------------------------------------------
    # Light travels along the sun's local -Z: down, to the left, and slightly
    # away from the camera, so it comes from the upper right, warm, and lights
    # the faces we see.
    bpy.ops.object.light_add(type='SUN', location=(12, -6, 14))
    sun = bpy.context.active_object
    sun.data.angle = radians(2.5)
    sun.data.color = (1.0, 0.94, 0.84)
    sun.data.energy = 0.45
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = Vector((-11, 7, -15)).normalized().to_track_quat('-Z', 'X')

    # --- camera ----------------------------------------------------------------
    camd = bpy.data.cameras.new('Cam')
    camd.type = 'ORTHO'
    camd.sensor_fit = 'VERTICAL'
    camd.ortho_scale = V
    cam = bpy.data.objects.new('Cam', camd)
    # The path line lands at 84% of frame height (HANDOFF), so the bottom 16%
    # of the frame is foreground ground and the fox stands at 20%..84%.
    cam.location = (0, -8, 0.34 * V)
    cam.rotation_euler = (radians(90), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    # --- engine pick -------------------------------------------------------------
    engine = None
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = eng
            engine = eng
            break
        except Exception:
            pass
    if engine is None:
        scene.render.engine = 'CYCLES'
        engine = 'CYCLES'
    if engine == 'CYCLES':
        scene.cycles.samples = 24
        try:
            scene.cycles.device = 'GPU'
        except Exception:
            scene.cycles.device = 'CPU'
    meta['engine'] = engine
    log('engine:', engine)

    def render_still(path, frame):
        scene.frame_set(frame)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)

    def frame_mean(path):
        img = bpy.data.images.load(path)
        px = img.pixels[:]
        bpy.data.images.remove(img)
        return sum(px[::4]) / (len(px) / 4)

    # Day still
    render_still(RAW + '/still_day.png', STILL_FRAME)
    m_day = frame_mean(RAW + '/still_day.png')
    log('day still mean luma: %.3f' % m_day)
    if m_day < 0.12:  # EEVEE produced a black frame: no GPU context.
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 24
        try:
            scene.cycles.device = 'GPU'
        except Exception:
            scene.cycles.device = 'CPU'
        meta['engine'] = 'CYCLES (EEVEE black)'
        render_still(RAW + '/still_day.png', STILL_FRAME)

    # Night still: moonlight sun + warm windows.
    sun.data.energy = 0.45
    sun.data.color = (0.65, 0.75, 1.0)
    bg_node.inputs['Color'].default_value = (*hex_rgb('#2d2723'), 1.0)  # night sky1
    bg_node.inputs['Strength'].default_value = 0.55
    if 'Emission Strength' in bsdf.inputs:
        bsdf.inputs['Emission Strength'].default_value = 2.5
    render_still(RAW + '/still_night.png', STILL_FRAME)

    # Day walk sequence, rendered in cycle-length segments.
    sun.data.energy = 0.45
    sun.data.color = (1.0, 0.94, 0.84)
    bg_node.inputs['Color'].default_value = (*hex_rgb('#f1ede4'), 1.0)
    bg_node.inputs['Strength'].default_value = 0.85
    bsdf.inputs['Emission Strength'].default_value = 0.0
    done = 0
    seg = 0
    while done < FRAMES:
        n = min(clip_len, FRAMES - done)
        seg_offset[0] = done
        scene.frame_start = 1
        scene.frame_end = n
        scene.render.filepath = RAW + ('/seg%02d_' % seg)
        bpy.ops.render.render(animation=True)
        done += n
        seg += 1
        log('segment rendered, total frames %d' % done)

    frames_out = sorted(f for f in os.listdir(RAW) if f.startswith('seg') and f.endswith('.png'))
    log('walk frames rendered:', len(frames_out))
    meta['status'] = 'ok'
    meta['frames'] = len(frames_out)
    meta['fps'] = FPS
    meta['clip_len'] = clip_len
except Exception:
    meta['error'] = traceback.format_exc()
    print(meta['error'], flush=True)
finally:
    with open(BASE + '/renders/meta.json', 'w') as f:
        json.dump(meta, f, indent=1)
    log('meta:', json.dumps(meta)[:400])
