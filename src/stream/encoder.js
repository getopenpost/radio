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
    // Brand chip (top left): the address right of the pixel logo, centred on the chip.
    `drawtext=fontfile='${mono}':text='${BRAND_TEXT}':${text}:x=${BRAND.textX * SCALE}:y=${(BRAND.y + BRAND.h / 2) * SCALE}-max_glyph_a/2-2`,
    // Now-playing pill: text after the note icon; the pill width comes from the scene.
    `drawtext=fontfile='${mono}':textfile='${escapePath(nowPlayingFile)}':reload=1:${text}:x=w-${16 * SCALE}-tw-${8 * SCALE}:y=${(BRAND.y + BRAND.h / 2) * SCALE}-max_glyph_a/2-2`,
  ].join(',');
}

export const isRtmp = (url) => /^rtmps?:\/\//.test(url);

/** Muxer arguments for the outputs: one file or server directly, several through tee. */
function outputArgs(outputs) {
  if (outputs.length === 1) {
    const [output] = outputs;
    // Each chunk resets MPEG-TS continuity counters. Declare that reset so the
    // sender can concatenate chunks without marking a video packet corrupt.
    if (/%0?\d*d\.ts$/.test(output)) return ['-f', 'segment', '-segment_time', '240', '-reset_timestamps', '0', '-segment_format', 'mpegts', '-segment_format_options', 'mpegts_flags=+initial_discontinuity', '-y', output];
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
export function encoderArgs({ outputs, fps, nowPlayingFile, scale = 3, videoBitrate = '4500k', audioBitrate = '160k', preset = 'veryfast', threads = 1, codec = 'libx264', device = '/dev/dri/renderD128' }) {
  if (!['libx264', 'h264_vaapi', 'h264_videotoolbox'].includes(codec)) throw new Error(`unsupported encoder ${codec}`);
  const hardware = codec !== 'libx264';
  const vaapi = codec === 'h264_vaapi';
  const filters = `${pictureFilters({ nowPlayingFile, scale })},${vaapi ? 'format=nv12,hwupload' : hardware ? 'format=nv12' : 'format=yuv420p'}`;
  const gop = fps * 2; // YouTube and Twitch want a keyframe every 2 seconds
  return [
    '-hide_banner', '-loglevel', process.env.RGO_MUSIC_FFMPEG_LOG ?? 'warning', '-nostats', '-progress', 'pipe:4', '-stats_period', '10',
    ...(vaapi ? ['-vaapi_device', device] : []),
    '-filter_complex_threads', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${WIDTH}x${HEIGHT}`, '-framerate', String(fps), '-probesize', '32', '-analyzeduration', '1', '-thread_queue_size', '4', '-i', 'pipe:0',
    // Both raw formats are known. Disable probing so the audio input never
    // waits for seconds of samples while the small video queue is full.
    '-f', 'f32le', '-ar', '48000', '-ac', '2', '-channel_layout', 'stereo', '-probesize', '32', '-analyzeduration', '1', '-thread_queue_size', '128', '-i', 'pipe:3',
    '-filter_complex', `[0:v]${filters}[v]`, '-map', '[v]', '-map', '1:a',
    '-c:v', codec, '-threads', String(threads),
    ...(vaapi ? ['-profile:v', 'high', '-bf', '0', '-async_depth', '1', '-rc_mode', 'CBR'] : hardware ? ['-profile:v', 'high', '-bf', '0', '-realtime', '0', '-allow_sw', '0'] : ['-preset', preset, '-tune', 'zerolatency', '-profile:v', 'high']),
    '-b:v', videoBitrate, '-maxrate', videoBitrate, '-bufsize', String(parseInt(videoBitrate) * 2) + 'k',
    '-g', String(gop), ...(hardware ? ['-force_key_frames', 'expr:gte(t,n_forced*2)'] : []), ...(hardware ? [] : ['-keyint_min', String(gop), '-sc_threshold', '0', '-pix_fmt', 'yuv420p']),
    // ffmpeg's AAC noise substitution and intensity stereo produce loud
    // one-channel bursts on this material; at these bitrates they gain nothing.
    // 160 kbps is Twitch's ceiling for audio.
    '-c:a', 'aac', '-aac_pns', '0', '-aac_is', '0', '-b:a', audioBitrate, '-ar', '48000',
    ...outputArgs(outputs),
  ];
}

export function startEncoder(options) {
  const ff = spawn('ffmpeg', encoderArgs(options), { stdio: ['pipe', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const video = ff.stdin;
  const audio = ff.stdio[3];
  let alive = true;
  const abort = () => {
    alive = false;
    video.destroy();
    audio.destroy();
    ff.kill('SIGTERM');
  };
  const stats = { seconds: 0, bytes: 0 };
  let progress = '';
  ff.stdio[4].on('data', (chunk) => {
    progress += chunk;
    const lines = progress.split('\n');
    progress = lines.pop();
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key === 'out_time_us' && Number.isFinite(Number(value))) stats.seconds = Number(value) / 1000000;
      if (key === 'total_size' && Number.isFinite(Number(value))) stats.bytes = Number(value);
    }
  });
  let errors = '';
  const log = (line) => process.stderr.write(line.replace(/rtmps?:\/\/[^\s'"\]]+/g, '<stream-output>'));
  ff.stderr.on('data', (chunk) => {
    errors += chunk;
    const end = errors.lastIndexOf('\n');
    if (end >= 0) {
      const lines = errors.slice(0, end + 1);
      log(lines);
      // A muxer failure can leave FFmpeg joining an audio reader that still
      // waits on our pipe. Close both inputs so it can finish and report failure.
      if (/Task finished with error code: -|Error (?:submitting|muxing|writing)/.test(lines)) abort();
      errors = errors.slice(end + 1);
    }
  });
  ff.stderr.on('end', () => { if (errors) log(errors); });
  const exited = new Promise((resolve) => ff.on('close', (code) => {
    alive = false;
    resolve(code);
  }));
  video.on('error', () => {});
  audio.on('error', () => {});
  const waitForDrain = (stream) => new Promise((resolve) => {
    const done = () => {
      stream.off('drain', done);
      stream.off('close', done);
      stream.off('error', done);
      ff.off('close', done);
      resolve();
    };
    stream.once('drain', done);
    stream.once('close', done);
    stream.once('error', done);
    ff.once('close', done);
  });
  const write = (stream, data) => {
    if (!alive || stream.destroyed) return null;
    return stream.write(data) || !alive || stream.destroyed ? null : waitForDrain(stream);
  };
  // FFmpeg 7's PCM demuxer still reads a block during stream discovery.
  // Prime that input before waiting on Linux's smaller video socket buffer.
  const primeFrames = Math.ceil(65536 / (48000 / options.fps * 8)) + 1;
  const startup = [];
  let primed = false;
  return {
    /**
     * Write one frame of video and its audio. Backpressure comes from the video
     * pipe only: ffmpeg pauses its audio input while x264 fills its lookahead,
     * so waiting on audio as well would deadlock. Audio queues here meanwhile
     * (bounded, as a safety net).
     */
    async frame(rgb, pcm) {
      const copy = Buffer.from(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
      audio.write(copy);
      if (!primed) {
        startup.push(Buffer.from(rgb));
        if (startup.length < primeFrames) return;
        primed = true;
        for (const frame of startup) await write(video, frame);
        startup.length = 0;
        return;
      }
      const waits = [write(video, rgb)];
      if (audio.writableLength > 32 * 1024 * 1024) waits.push(waitForDrain(audio));
      const pending = waits.filter(Boolean);
      if (pending.length) await Promise.all(pending);
    },
    async close() {
      audio.end();
      for (const frame of startup) await write(video, frame);
      startup.length = 0;
      video.end();
      return exited;
    },
    exited,
    stats,
    get alive() {
      return alive;
    },
  };
}
