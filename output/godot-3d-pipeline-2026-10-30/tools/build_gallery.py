"""Generate index.html: the visual gallery for the 3D pipeline feasibility pass.

Embeds the real GLBs as base64 data URIs (file:// pages cannot fetch local
files), uses three.js from a CDN, and references the renders, GIFs and pack
previews by relative path. Stdlib only.
"""
import base64, os

BASE = '/Users/rgo/dev/rgo-music/output/godot-3d-pipeline-2026-10-30'
FOX = '/Users/rgo/dev/rgo-music/output/fox-model-candidates/quaternius-fox.glb'

ASSETS = [
    ('house-1', 'house-1.glb', 'Quaternius Medieval Village: cottage'),
    ('inn', 'inn.glb', 'Quaternius Medieval Village: inn'),
    ('bell-tower', 'bell-tower.glb', 'Quaternius Medieval Village: bell tower'),
    ('tree-1', 'quaternius-tree-1.glb', 'Quaternius Simple Nature: tree'),
    ('tree-2', 'kaykit-tree-1.glb', 'KayKit Forest Nature: tree'),
    ('bicycle', 'bicycle.glb', 'Quaternius Public Transport: bicycle'),
    ('sailboat', 'boatwsail.glb', 'Quaternius Ships: sailboat'),
    ('dinghy', 'kenney-boat-row-small.glb', 'Kenney Pirate Kit: rowboat'),
]


def b64(path):
    return base64.b64encode(open(path, 'rb').read()).decode()


assets_js = ',\n'.join(
    '  {id: %r, label: %r, b64: FOX_B64_PLACEHOLDER_NEVER, data: %r}' % (a, l, b64(os.path.join(BASE, 'assets-samples', f)))
    for a, f, l in ASSETS
)

HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Endless fox, 3D: style proof and candidates</title>
<style>
  body { background:#1b1a17; color:#d9d2c4; font-family: ui-monospace, Menlo, monospace; margin:0; padding:32px 40px; line-height:1.55; }
  h1 { font-size:20px; margin-bottom:4px; }
  h2 { font-size:15px; color:#f2b36b; margin-top:52px; border-bottom:1px solid #3a352c; padding-bottom:8px; }
  p, li { font-size:13px; max-width:1080px; }
  img.pix { image-rendering: pixelated; }
  .row { display:flex; gap:18px; flex-wrap:wrap; align-items:flex-start; }
  canvas { background:#12110f; border-radius:6px; display:block; }
  button { background:#2a2620; color:#e8e2d6; border:1px solid #4a4336; padding:6px 10px; margin:2px; font-size:12px; border-radius:4px; cursor:pointer; font-family:inherit; }
  button.on { background:#7c3a07; border-color:#f2b36b; }
  table { border-collapse:collapse; font-size:12px; max-width:1080px; }
  td, th { border:1px solid #3a352c; padding:5px 9px; text-align:left; vertical-align:top; }
  th { color:#f2b36b; }
  a { color:#8abeb3; }
  .note { color:#8a8171; font-size:11px; }
  figure { margin:0 0 18px 0; }
  figcaption { font-size:11px; color:#8a8171; margin-top:6px; max-width:640px; }
</style>
</head>
<body>
<h1>Endless fox, 3D pipeline: style proof + candidates</h1>
<p class="note">30 October 2026. OpenPost Radio feasibility pass. A Blender 5.2 render of real CC0 assets (the Quaternius fox plus sampled town, boat, bicycle and tree models) pushed through a palette quantize + 4x4 Bayer dither pass using the actual stream palette from <code>src/stream/scene/palette.js</code>. Nothing is wired into the stream yet. One question: does ordinary 3D become the approved look?</p>

<h2>1. The style pass: raw 3D render vs palette + Bayer dither</h2>
<p>Top: the straight render, 640x360, orthographic side camera, EEVEE. Bottom: the same frame quantized into the stream's day palette (34 landscape slots), with a restrained 4x4 Bayer dither between neighbouring slots, shown at 2x nearest. The fox plays its shipped Walk clip; the scenery scrolls left at the stride-matched speed.</p>
<figure><img class="pix" width="1280" src="style-demo/day_before_after.png"><figcaption>Day, golden side light. Note the dither bands on the roof slopes and the fox's back, and the solid flat fills elsewhere.</figcaption></figure>
<figure><img class="pix" width="1280" src="style-demo/night_before_after.png"><figcaption>Night, the same scene with the night palette: readable blue-green terrain, warm windows, no glowing fox. Same depth order as day, per the stream rules.</figcaption></figure>

<h2>2. Walking, and the dither anchor</h2>
<p>The walk was rendered so the world scrolls and the fox stays centred. The 2D scene anchors its dither pattern to each moving layer; a 3D pass must do the equivalent or the pattern swims. Both GIFs below are the same 120 frames of the same render. Left: the Bayer matrix is anchored to the world, so the grain rides the scenery. Right: the identical pass anchored to the screen, the naive version, which shimmers as the world slides under the pattern.</p>
<div class="row">
<figure><img class="pix" width="640" src="style-demo/walk_world_anchored.gif"><figcaption>World-anchored dither (correct): pattern fixed to scenery.</figcaption></figure>
<figure><img class="pix" width="640" src="style-demo/walk_screen_anchored.gif"><figcaption>Screen-anchored dither (wrong for us): visible swimming.</figcaption></figure>
</div>
<p class="note">The Quaternius Walk clip is an in-place cycle: its paws sweep only ~3 cm with zero root motion, so the clip's own foot contact cannot set the speed. The demo scrolls at a chosen speed; production needs distance-driven clips (see research/animation.md, the no-slide section) or re-authored cycles.</p>

<h2>3. The fox itself, live, all 12 shipped clips</h2>
<p>The actual CC0 GLB being considered (51-bone rig, IK targets, ear and tail chains). Drag to orbit, scroll to zoom, click a clip to play it. Walking is the default.</p>
<canvas id="fox" width="720" height="420"></canvas>
<div id="clips"></div>

<h2>4. Sample assets from the shortlisted packs</h2>
<p>Every model below is CC0, downloaded and verified during the asset pass. Load each one; these are the exact files rendered in the stills above.</p>
<canvas id="asset" width="720" height="420"></canvas>
<div id="assets"></div>

<h2>5. Pack previews</h2>
<div class="row">
<figure><img width="500" src="previews/medievalvillagemegakit.jpg"><figcaption><a href="https://quaternius.com/packs/medievalvillagemegakit.html">Quaternius Medieval Village MegaKit</a>: 304 models, CC0. The village core candidate.</figcaption></figure>
<figure><img width="500" src="previews/medievalvillage.jpg"><figcaption><a href="https://quaternius.com/packs/medievalvillage.html">Quaternius Medieval Village Pack</a>: the sampled houses, inn and bell tower come from here.</figcaption></figure>
<figure><img width="500" src="previews/stylizednaturemegakit.jpg"><figcaption><a href="https://quaternius.com/packs/stylizednaturemegakit.html">Quaternius Stylized Nature MegaKit</a>: vegetation for the middle band.</figcaption></figure>
<figure><img width="500" src="previews/ships.jpg"><figcaption><a href="https://quaternius.com/packs/ships.html">Quaternius Ships Pack</a>: the sailboat; the rowboat is Kenney Pirate Kit.</figcaption></figure>
<figure><img width="500" src="previews/simplebuildings.jpg"><figcaption><a href="https://quaternius.com/packs/simplebuildings.html">Quaternius Simple Buildings</a>: lightweight filler massing.</figcaption></figure>
</div>

<h2>6. Shortlist summary</h2>
<table>
<tr><th>Pack</th><th>Contents</th><th>License</th><th>Formats</th><th>Role</th></tr>
<tr><td><a href="https://quaternius.com/packs/medievalvillagemegakit.html">Quaternius Medieval Village MegaKit</a></td><td>304 modular village models</td><td>CC0</td><td>FBX/OBJ/Blend/glTF</td><td>Village and town core; hill villages, market towns</td></tr>
<tr><td><a href="https://quaternius.com/packs/medievalvillage.html">Quaternius Medieval Village Pack</a></td><td>Houses, inns, tower, props</td><td>CC0</td><td>FBX/OBJ/Blend</td><td>Sampled in the renders above</td></tr>
<tr><td><a href="https://kenney.nl/assets/pirate-kit">Kenney Pirate Kit</a></td><td>Harbour, docks, rowboat</td><td>CC0</td><td>GLB/FBX/OBJ</td><td>Fishing harbour stops, lake crossings</td></tr>
<tr><td><a href="https://quaternius.com/packs/ships.html">Quaternius Ships Pack</a></td><td>Boats incl. small sailboat</td><td>CC0</td><td>FBX/OBJ/Blend</td><td>Ocean sailing variation</td></tr>
<tr><td><a href="https://quaternius.com/packs/publictransport.html">Quaternius Public Transport Pack</a></td><td>Bicycle</td><td>CC0</td><td>FBX/OBJ/Blend</td><td>The found-bicycle variation</td></tr>
<tr><td><a href="https://quaternius.com/packs/stylizednaturemegakit.html">Quaternius Stylized Nature MegaKit</a></td><td>Stylized trees, bushes, rocks</td><td>CC0</td><td>FBX/OBJ/Blend/glTF</td><td>Middle-band vegetation</td></tr>
<tr><td><a href="https://kaylousberg.itch.io/">KayKit Forest Nature Pack</a></td><td>Flat-shaded trees</td><td>CC0</td><td>GLB/Blend</td><td>Style-consistency comparison</td></tr>
<tr><td>Telescope (pixor.art / poly.pizza)</td><td>Low-poly telescope</td><td>CC0</td><td>GLB/Blend</td><td>Five-second wayside encounter</td></tr>
<tr><td colspan="5" class="note">Gaps with no clean CC0 source found: broom, pull-up/dip bars (both trivial custom builds), plus chalets, canal-house rows, lighthouse and station (custom, or individually licensed Sketchfab models with checks). Distant mountains stay 2D parallax layers, per the plan, so terrain packs are out of scope.</td></tr>
</table>

<h2>7. Read the research</h2>
<ul>
<li><a href="README.md">README.md</a>: the full feasibility plan (architecture, animation, pipeline, open questions)</li>
<li><a href="research/assets.md">research/assets.md</a>: 18 evaluated asset candidates with licenses and links</li>
<li><a href="research/godot-pipeline.md">research/godot-pipeline.md</a>: the Godot 4.7 pixel/dither recipe, 3 runnable shaders, Movie Maker commands</li>
<li><a href="research/animation.md">research/animation.md</a>: the no-slide formula, AnimationTree layout, clip list</li>
<li><a href="../visual-direction-2026-10-30/HANDOFF.md">../visual-direction-2026-10-30/HANDOFF.md</a>: the approved visual direction this must match</li>
<li><a href="../fox-model-candidates/README.md">../fox-model-candidates/README.md</a>: the fox model decision</li>
</ul>
<p class="note">Reproduce the renders: <code>blender -b -P tools/scene_demo.py</code> then <code>nix-shell -p python312Packages.pillow python312Packages.numpy --run "python3 tools/post_process.py"</code> from this directory.</p>

<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FOX_B64 = '@@FOX@@';
const ASSETS = [@@ASSETS@@];

function buf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function viewer(canvasId) {
  const canvas = document.getElementById(canvasId);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.width, canvas.height);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12110f);
  const grid = new THREE.GridHelper(10, 20, 0x3a352c, 0x26221d);
  scene.add(grid);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2b2623, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  let current;
  function show(model, dist) {
    if (current) scene.remove(current);
    current = model;
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const d = dist || size * 1.2;
    camera.position.set(c.x + d * 0.7, c.y + d * 0.4, c.z + d * 0.8);
    controls.target.copy(c);
    camera.near = size / 100;
    camera.far = size * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }
  return { renderer, scene, camera, controls, show };
}

const loader = new GLTFLoader();
const clock = new THREE.Clock();

// fox
const foxView = viewer('fox');
let mixer = null;
loader.parse(buf(FOX_B64), '', (gltf) => {
  foxView.show(gltf.scene);
  mixer = new THREE.AnimationMixer(gltf.scene);
  const bar = document.getElementById('clips');
  let active = null;
  const play = (clip) => {
    if (active) active.fadeOut(0.2).stop();
    active = mixer.clipAction(clip);
    active.reset().fadeIn(0.2).play();
    [...bar.children].forEach(b => b.classList.toggle('on', b.dataset.name === clip.name));
  };
  gltf.animations.forEach((clip) => {
    const b = document.createElement('button');
    b.textContent = clip.name;
    b.dataset.name = clip.name;
    b.onclick = () => play(clip);
    bar.appendChild(b);
  });
  play(gltf.animations.find(a => a.name === 'Walk') || gltf.animations[0]);
  foxView.controls.autoRotate = true;
  foxView.controls.autoRotateSpeed = 1.2;
  foxView.controls.addEventListener('start', () => foxView.controls.autoRotate = false);
});
(function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  foxView.controls.update();
  assetView.controls.update();
  foxView.renderer.render(foxView.scene, foxView.camera);
  assetView.renderer.render(assetView.scene, assetView.camera);
})();

// assets
const assetView = viewer('asset');
const bar2 = document.getElementById('assets');
let assetMixer = null;
function loadAsset(i) {
  const a = ASSETS[i];
  loader.parse(buf(a.data), '', (gltf) => {
    assetView.show(gltf.scene);
    if (assetMixer) { assetMixer.stopAllAction(); assetMixer = null; }
    if (gltf.animations && gltf.animations.length) {
      assetMixer = new THREE.AnimationMixer(gltf.scene);
      assetMixer.clipAction(gltf.animations[0]).play();
    }
    [...bar2.children].forEach((b, k) => b.classList.toggle('on', k === i));
  });
}
ASSETS.forEach((a, i) => {
  const b = document.createElement('button');
  b.textContent = a.id;
  b.onclick = () => loadAsset(i);
  bar2.appendChild(b);
});
loadAsset(0);
</script>
</body>
</html>
'''

html = HTML.replace('@@FOX@@', b64(FOX)).replace('@@ASSETS@@', assets_js)
out = os.path.join(BASE, 'index.html')
open(out, 'w').write(html)
print('wrote', out, '%.1f MB' % (os.path.getsize(out) / 1e6))
