// The ffmpeg process that turns raw frames and PCM into the stream: 3x
// nearest-neighbour upscale (pixel art stays crisp), brand and now-playing
// text, H.264 + AAC, out to one or more RTMP servers (YouTube, Twitch) or a
// file. Several outputs share one encode through the tee muxer; each sits
// behind its own fifo that reconnects on its own, so one platform dropping
// never stalls the others.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { assetsDir } from '../paths.js';
import { BRAND, BRAND_TEXT, HEIGHT, WIDTH } from './scene/index.js';

// Text is sized in scene pixels, so it lines up at any output scale.
// Geist Mono advances 0.6 em, so 10 scene-pixel text is 6 scene pixels per character.
const TEXT_SIZE = 10;
export const CHAR_WIDTH = TEXT_SIZE * 0.6;

const escapePath = (p) => p.replaceAll('\\', '\\\\').replaceAll(':', '\\:').replaceAll("'", "\\'");

/** Upscale and text overlays, shared with the stills tool. */
export function pictureFilters({ nowPlayingFile, scale = 3 }) {
  const mono = escapePath(join(assetsDir, 'fonts', 'GeistMono-Medium.ttf'));
  const SCALE = scale;
  const text = `fontcolor=0xf4f1ea:fontsize=${TEXT_SIZE * SCALE}`;
  return [
    `scale=${WIDTH * SCALE}:${HEIGHT * SCALE}:flags=neighbor`,
    // Brand chip (bottom left): the address right of the pixel logo, centred on the chip.
    `drawtext=fontfile='${mono}':text='${BRAND_TEXT}':${text}:x=${BRAND.textX * SCALE}:y=${(BRAND.y + BRAND.h / 2) * SCALE}-max_glyph_a/2-2`,
    // Now-playing pill: text after the note icon; the pill width comes from the scene.
    `drawtext=fontfile='${mono}':textfile='${escapePath(nowPlayingFile)}':reload=1:${text}:x=w-${16 * SCALE}-tw-${8 * SCALE}:y=${25 * SCALE}-max_glyph_a/2-2`,
  ].join(',');
}

export const isRtmp = (url) => /^rtmps?:\/\//.test(url);

/** Muxer arguments for the outputs: one file or server directly, several through tee. */
function outputArgs(outputs) {
  if (outputs.length === 1) {
    const [output] = outputs;
    return isRtmp(output) ? ['-f', 'flv', '-flvflags', 'no_duration_filesize', output] : ['-y', output];
  }
  const slave = (output) => {
    if (!isRtmp(output)) return `[f=${output.endsWith('.mkv') ? 'matroska' : output.endsWith('.mp4') ? 'mp4' : 'flv'}]${output}`;
    const fifo = ['f=fifo', 'fifo_format=flv', 'format_opts=flvflags=no_duration_filesize', 'drop_pkts_on_overflow=1', 'attempt_recovery=1', 'recover_any_error=1', 'recovery_wait_time=5', 'queue_size=900'];
    return `[${fifo.join(':')}]${output}`;
  };
  // tee cannot ask encoders for global headers itself, and flv needs them.
  return ['-flags', '+global_header', '-f', 'tee', outputs.map(slave).join('|')];
}

/**
 * @param {object} o
 * @param {string[]} o.outputs RTMP URLs and/or file paths
 * @param {number} [o.scale=3] output = scene size x scale: 3 gives 1080p, 2 gives 720p (half the CPU)
 */
export function encoderArgs({ outputs, fps, nowPlayingFile, scale = 3, videoBitrate = '4500k', audioBitrate = '160k', preset = 'veryfast', threads = 4 }) {
  const filters = `${pictureFilters({ nowPlayingFile, scale })},format=yuv420p`;
  const gop = fps * 2; // YouTube and Twitch want a keyframe every 2 seconds
  return [
    '-hide_banner', '-loglevel', 'warning', '-nostats',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${WIDTH}x${HEIGHT}`, '-framerate', String(fps), '-thread_queue_size', '64', '-i', 'pipe:0',
    // x264 holds back dozens of frames while the muxer waits to interleave, so
    // the audio input needs a deep queue or ffmpeg stops reading it (deadlock).
    '-f', 'f32le', '-ar', '48000', '-ac', '2', '-thread_queue_size', '4096', '-i', 'pipe:3',
    '-filter_complex', `[0:v]${filters}[v]`, '-map', '[v]', '-map', '1:a',
    '-c:v', 'libx264', '-preset', preset, '-tune', 'animation', '-profile:v', 'high', '-threads', String(threads),
    '-b:v', videoBitrate, '-maxrate', videoBitrate, '-bufsize', String(parseInt(videoBitrate) * 2) + 'k',
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
    // ffmpeg's AAC noise substitution and intensity stereo produce loud
    // one-channel bursts on this material; at these bitrates they gain nothing.
    // 160 kbps is Twitch's ceiling for audio.
    '-c:a', 'aac', '-aac_pns', '0', '-aac_is', '0', '-b:a', audioBitrate, '-ar', '48000',
    ...outputArgs(outputs),
  ];
}

export function startEncoder(options) {
  const ff = spawn('ffmpeg', encoderArgs(options), { stdio: ['pipe', 'inherit', 'inherit', 'pipe'] });
  const video = ff.stdin;
  const audio = ff.stdio[3];
  let alive = true;
  const exited = new Promise((resolve) => ff.on('close', (code) => resolve((alive = false), code)));
  video.on('error', () => {});
  audio.on('error', () => {});
  const write = (stream, data) => (stream.write(data) ? null : new Promise((r) => stream.once('drain', r)));
  return {
    /**
     * Write one frame of video and its audio. Backpressure comes from the video
     * pipe only: ffmpeg pauses its audio input while x264 fills its lookahead,
     * so waiting on audio as well would deadlock. Audio queues here meanwhile
     * (bounded, as a safety net).
     */
    async frame(rgb, pcm) {
      const copy = Buffer.from(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
      audio.write(copy);
      const waits = [write(video, rgb)];
      if (audio.writableLength > 32 * 1024 * 1024) waits.push(new Promise((r) => audio.once('drain', r)));
      const pending = waits.filter(Boolean);
      if (pending.length) await Promise.race([Promise.all(pending), exited]);
    },
    async close() {
      video.end();
      audio.end();
      return exited;
    },
    exited,
    get alive() {
      return alive;
    },
  };
}
