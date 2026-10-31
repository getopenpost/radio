shader_type canvas_item;

// Palette quantization with a restrained 4x4 Bayer band, world-anchored:
// the matrix x index shifts with the scrolled distance (scroll_shift), so the
// pattern rides the scenery instead of shimmering under a fixed camera.
//
// The palette travels as a plain uniform array (raw byte floats), not a
// texture: an RGB8 ImageTexture takes an sRGB round trip on some drivers,
// which shifts dark slots by a level and sprays near-palette noise across
// night frames. The dither follows the stream's 2D rule: exact slot colors
// stay solid, and pixels between their two nearest slots get an ordered band.
uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform vec3 pal[64];
uniform int pal_size = 38;
uniform int scroll_shift = 0;
uniform vec2 pixel_scale = vec2(2.0, 2.0);  // window pixels per native pixel

const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

void fragment() {
	vec3 c = texture(screen_tex, SCREEN_UV).rgb * 255.0;
	ivec2 p = ivec2(FRAGCOORD.xy / pixel_scale);
	int bx = (p.x + scroll_shift) & 3;
	int by = p.y & 3;
	float t = B[by * 4 + bx] / 16.0;
	vec3 c1 = vec3(0.0);
	vec3 c2 = vec3(0.0);
	float d1 = 1.0e9;
	float d2 = 1.0e9;
	for (int i = 0; i < 64; i++) {
		if (i >= pal_size) {
			break;
		}
		vec3 pc = pal[i] * 255.0;
		vec3 d3 = c - pc;
		float d = dot(d3, d3);
		if (d < d1) {
			d2 = d1;
			c2 = c1;
			d1 = d;
			c1 = pc;
		} else if (d < d2) {
			d2 = d;
			c2 = pc;
		}
	}
	// how far the pixel sits from its nearest slot toward the second nearest;
	// 0 at an exact slot color (solid), growing into an ordered band between.
	float mixv = clamp(d1 / max(d2, 1.0), 0.0, 1.0);
	vec3 outc = t < mixv ? c2 : c1;
	COLOR = vec4(outc / 255.0, 1.0);
}
