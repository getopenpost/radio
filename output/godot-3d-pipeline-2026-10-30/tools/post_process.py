"""Palette quantization + 4x4 Bayer dither pass for the style-proof renders.

Reproduces the stream's 2D rules on top of ordinary 3D renders: every pixel
snaps to a palette slot from src/stream/scene/palette.js (day or night table),
with a restrained ordered dither between neighbouring slots. The dither
matrix is anchored to the WORLD, not the screen: its x index shifts with the
distance the world has scrolled, so the pattern rides the scenery instead of
shimmering while the camera is fixed. A second, screen-anchored variant is
emitted to show the difference.
"""
import json, math, os, re
import numpy as np
from PIL import Image

BASE = '/Users/rgo/dev/rgo-music/output/godot-3d-pipeline-2026-10-30'
RAW = BASE + '/renders/raw'
OUT = BASE + '/style-demo'
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(BASE + '/renders/meta.json'))
V = meta['frame_height_m']
V_MS = meta['walk_speed_mps']
FPS = meta['fps']
CLIP = meta['clip_len']
PX_PER_M = 640 / (V * 16 / 9)

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
STRENGTH = 36.0  # of 255, restrained band between neighbouring slots


def rgb_hex(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def oklch(L, C, H):
    a = C * math.cos(math.radians(H))
    b = C * math.sin(math.radians(H))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
    out = []
    for v in lin:
        c = 12.92 * v if v <= 0.0031308 else 1.055 * max(0.0, v) ** (1 / 2.4) - 0.055
        out.append(max(0, min(255, round(c * 255))))
    return out


DAY = {
    'sky0': '#e8e2d6', 'sky1': '#f1ede4', 'sky2': '#f6f1e6', 'cloud': '#fbf9f4', 'cloudShade': '#ddd6ca',
    'far0': '#d7cfc2', 'far1': '#c9c0b2', 'hill0': '#b8af9f', 'hill1': '#a39a8b',
    'pine0': '#6e715a', 'pine1': '#565a46', 'leaf0': '#7d855f', 'leaf1': '#636b4a',
    'trunk': '#5a4b3f', 'roof': '#7c3a07', 'wall': '#e9e4da', 'window': '#7a7266',
    'ground0': '#d3cab9', 'ground1': '#bcb2a1', 'path': '#e6dfd2', 'pathEdge': '#9b9081',
    'water0': '#c3c9c6', 'water1': '#a7b0ae', 'grass': '#2b2623', 'grassTip': '#5c544b',
    'door': '#6b5242', 'metal': '#8f8a84', 'metalDark': '#5f5a55', 'sun': '#f2b36b',
    'fur': ('oklch', 0.6, 0.14, 45), 'furDark': ('oklch', 0.46, 0.12, 45),
    'cream': '#f7ecdc', 'bag': ('oklch', 0.36, 0.06, 55),
}
NIGHT = {
    'sky0': '#26211e', 'sky1': '#2d2723', 'sky2': '#3b332d', 'cloud': '#3a332e', 'cloudShade': '#302a26',
    'far0': '#352e29', 'far1': '#2d2723', 'hill0': '#2a2420', 'hill1': '#231e1b',
    'pine0': '#1e1d18', 'pine1': '#181713', 'leaf0': '#221e18', 'leaf1': '#1b1814',
    'trunk': '#16120f', 'roof': '#2c1c13', 'wall': '#2c2622', 'window': '#fdb36b', 'windowOff': '#2c2622',
    'ground0': '#231e1a', 'ground1': '#1c1815', 'path': '#302924', 'pathEdge': '#17130f',
    'water0': '#262b2b', 'water1': '#1c2020', 'grass': '#110e0c', 'grassTip': '#2f2823',
    'door': '#2a201b', 'metal': '#4f4a45', 'lampLight': '#ffd9a0', 'star': '#fff6e5', 'moon': '#ece7df',
    'fur': ('oklch', 0.56, 0.11, 45), 'furDark': ('oklch', 0.42, 0.09, 45),
    'cream': '#a79a89', 'bag': ('oklch', 0.26, 0.04, 55),
}


def table(spec):
    cols = []
    for v in spec.values():
        cols.append(oklch(*v[1:]) if isinstance(v, tuple) else rgb_hex(v))
    return np.array(cols, dtype=np.float32)


PAL_DAY = table(DAY)
PAL_NIGHT = table(NIGHT)
NAMES_DAY = list(DAY)


def quantize(img, pal, shift_x=0, strength=STRENGTH):
    arr = np.asarray(img.convert('RGB'), dtype=np.float32)
    H, W = arr.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    bx = (xx + int(round(shift_x))) % 4
    t = BAYER[yy % 4, bx] / 16.0 - 0.5
    out = np.empty_like(arr)
    step = 96  # row chunks keep memory bounded
    for r0 in range(0, H, step):
        r1 = min(H, r0 + step)
        shifted = arr[r0:r1] + t[r0:r1, :, None] * strength
        d = ((shifted[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1)
        out[r0:r1] = pal[d.argmin(-1)]
    return Image.fromarray(out.astype(np.uint8))


def palette_image(pal):
    p = Image.new('P', (1, 1))
    flat = []
    for c in pal:
        flat += [int(x) for x in c]
    flat += [0] * (768 - len(flat))
    p.putpalette(flat)
    return p


def save_gif(frames, path, pal):
    pi = palette_image(pal)
    imgs = [f.quantize(palette=pi, dither=Image.Dither.NONE) for f in frames]
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=1000 // FPS, loop=0)


def share_report(img, pal, names):
    arr = np.asarray(img.convert('RGB'), dtype=np.float32)
    d = ((arr[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1)
    idx = d.argmin(-1)
    shares = sorted(((float((idx == k).mean()), names[k]) for k in range(len(pal))), reverse=True)[:8]
    return [{'slot': n, 'share': round(s * 100, 1)} for s, n in shares]


# --- stills -------------------------------------------------------------------
day_raw = Image.open(RAW + '/still_day.png')
night_raw = Image.open(RAW + '/still_night.png')
shift_still = -(STILL := 13 - 1) / FPS * V_MS * PX_PER_M  # scroll at the still frame
day_styled = quantize(day_raw, PAL_DAY, shift_x=shift_still)
night_styled = quantize(night_raw, PAL_NIGHT, shift_x=shift_still)
day_styled.save(OUT + '/day_styled.png')
night_styled.save(OUT + '/night_styled.png')

# before/after board (raw above, styled below), 2x nearest
def board(a, b):
    A = np.asarray(a.convert('RGB').resize((1280, 720), Image.NEAREST))
    B = np.asarray(b.convert('RGB').resize((1280, 720), Image.NEAREST))
    gap = np.full((8, 1280, 3), 40, dtype=np.uint8)
    return Image.fromarray(np.vstack([A, gap, B]))

board(day_raw, day_styled).save(OUT + '/day_before_after.png')
board(night_raw, night_styled).save(OUT + '/night_before_after.png')

# --- walk sequence ------------------------------------------------------------
files = {}
for f in os.listdir(RAW):
    m = re.match(r'seg(\d+)_(\d+)\.png', f)
    if m:
        files[(int(m.group(1)), int(m.group(2)))] = f
ordered = [files[k] for k in sorted(files)]

world_frames, screen_frames = [], []
for g, fname in enumerate(ordered):
    img = Image.open(RAW + '/' + fname)
    shift = -(g) / FPS * V_MS * PX_PER_M  # world-anchored: rides the scroll
    world_frames.append(quantize(img, PAL_DAY, shift_x=shift))
    screen_frames.append(quantize(img, PAL_DAY, shift_x=0))

save_gif(world_frames, OUT + '/walk_world_anchored.gif', PAL_DAY)
save_gif(screen_frames, OUT + '/walk_screen_anchored.gif', PAL_DAY)

summary = {
    'frames': len(ordered),
    'palette_day': len(PAL_DAY),
    'palette_night': len(PAL_NIGHT),
    'dither_strength': STRENGTH,
    'world_shift_px_per_frame': round(V_MS * PX_PER_M / FPS, 3),
    'day_share': share_report(day_styled, PAL_DAY, NAMES_DAY),
    'outputs': sorted(os.listdir(OUT)),
}
json.dump(summary, open(OUT + '/summary.json', 'w'), indent=1)
print(json.dumps(summary, indent=1)[:1200])
