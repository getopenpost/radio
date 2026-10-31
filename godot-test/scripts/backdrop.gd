extends Node2D
# The flat 2D backdrop inside the sky viewport: clouds, sun and moon, two
# parallax mountain ranges and the night stars, all drawn in exact palette
# slot colors (no lighting, so the palette's depth order holds by
# construction). Ridges and clouds are tileable and deterministic (index
# hashes, no randomness), scrolling at fractions of the ground speed.
# The sun's slot color at night is nearly the night sky color, so it fades
# out by itself; the moon is only drawn at night.

var far_color := Color("#d7cfc2")
var near_color := Color("#c9c0b2")
var star_color := Color("#fff6e5")
var sun_color := Color("#f2b36b")
var moon_color := Color("#ece7df")
var cloud_color := Color("#fbf9f4")
var cloud_shade := Color("#ddd6ca")
var star_alpha := 0.0
var offset_far := 0.0
var offset_near := 0.0
var offset_cloud := 0.0

const W := 640
const H := 360
const TW := 1280.0  # tile width, pixels; ridges repeat exactly on it
const SEG := 40.0   # horizontal resolution of the ridges


func _draw() -> void:
	draw_clouds()
	draw_ridge(fmod(offset_far, TW), 0.40, 0.11, 90.0, far_color)
	draw_ridge(fmod(offset_near, TW), 0.52, 0.075, 210.0, near_color)
	# the sun sits above the tallest trees; its slot color goes dark at night,
	# so it fades out by itself
	draw_circle(Vector2(W * 0.72, H * 0.10), 14.0, sun_color)
	if star_alpha > 0.6:
		draw_circle(Vector2(W * 0.25, H * 0.17), 11.0, moon_color)
	if star_alpha > 0.02:
		for i in 48:
			var x := fmod(i * 97.31 + 13.0, W)
			var y := fmod(i * 53.7 + 7.0, H * 0.38)
			var b := 0.75 + 0.25 * star_h(i)
			draw_circle(Vector2(x, y), 0.9 + fmod(i, 3.0) * 0.35, Color(star_color.r * b, star_color.g * b, star_color.b * b, star_alpha))


func star_h(i: int) -> float:
	return abs(fmod(sin(i * 127.1) * 43758.5453, 1.0))


func draw_clouds() -> void:
	var n := 3
	for k in n:
		var base_x := fmod(k * 271.0 + 60.0 - offset_cloud, W + 260.0) - 130.0
		var base_y := 34.0 + star_h(k + 40) * 52.0
		var s := 0.75 + 0.45 * star_h(k + 9)
		for j in 4:
			var cx := base_x + j * 26.0 * s - 39.0 * s
			var cy := base_y + 4.0 * sin(j * 2.1)
			draw_circle(Vector2(cx, cy), (13.0 + 5.0 * star_h(k * 7 + j)) * s, cloud_color)
		for j in 2:
			draw_circle(Vector2(base_x + j * 30.0 * s - 20.0 * s, base_y + 7.0), 11.0 * s, cloud_shade)


# base_frac: ridge baseline from the top; amp_frac: peak amplitude vs H;
# seed: changes the two ranges' silhouettes. Heights hash the segment index
# modulo the tile period, so copies join seamlessly.
func draw_ridge(off: float, base_frac: float, amp_frac: float, seed: float, col: Color) -> void:
	var base_y := H * base_frac
	var amp := H * amp_frac
	var n := int(TW / SEG)
	var pts := PackedVector2Array()
	# three tile copies so the wrap always covers the screen
	for k in 3:
		var x0 := k * TW - TW
		for i in n + 1:
			var im := i % n  # periodic: copy boundaries match
			var h := star_h(int(seed) * 131 + im)
			var peak: float = 0.55 + 0.45 * abs(sin(im * 2.39996 + star_h(int(seed))))
			pts.append(Vector2(x0 + i * SEG - off, base_y - amp * peak * h - amp * 0.15))
	# close the polygon down to the bottom of the sky viewport
	pts.append(Vector2(2.0 * TW - off, H + 4.0))
	pts.append(Vector2(-TW - off, H + 4.0))
	draw_polygon(pts, PackedColorArray([col]))
