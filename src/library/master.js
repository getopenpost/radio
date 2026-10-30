// Mastering: level the render, lift the presence band, run a glue compressor,
// drive a limiter until the mix reaches the density of the reference masters
// (they ship near -10.5 LUFS, with crest factors around 11.5 dB), trim to the
// delivery loudness and write a dithered 16-bit FLAC.
import { spawn } from 'node:child_process';

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-nostats', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (c) => (stderr += c));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg failed: ${stderr.slice(-800)}`))));
  });
}

/** Integrated loudness (LUFS) and true peak (dBTP) of a file after an optional filter. */
export async function measure(path, filter) {
  const chain = [filter, 'ebur128=peak=true'].filter(Boolean).join(',');
  const log = await ffmpeg(['-i', path, '-af', chain, '-f', 'null', '-']);
  const summary = log.slice(log.lastIndexOf('Summary:'));
  const lufs = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const peak = Number(summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1]);
  if (!Number.isFinite(lufs)) throw new Error(`could not measure loudness of ${path}`);
  return { lufs, truePeak: peak };
}

/**
 * @param {string} input float WAV from the renderer
 * @param {string} output .flac path
 * @returns {Promise<{lufs: number, truePeak: number, seconds: number}>}
 */
export async function master(input, output, { lufs: target = -14, density = -11, truePeak = -1.5, presence = 3 } = {}) {
  const raw = await measure(input);
  // Bring every render to the same level before the compressor so its
  // threshold means the same thing for every track.
  const glue = `volume=${(-20 - raw.lufs).toFixed(2)}dB,equalizer=f=2500:t=q:w=0.9:g=${presence},acompressor=threshold=-24dB:ratio=2.2:attack=14:release=170:knee=6`;
  const glued = await measure(input, glue);
  const drive = density - glued.lufs;
  const limit = Math.pow(10, (truePeak + 0.5) / 20); // the trim below leaves headroom for inter-sample peaks
  let gain = target - density;
  for (let attempt = 0; ; attempt++) {
    const chain = [
      glue,
      `volume=${drive.toFixed(2)}dB`,
      `alimiter=limit=${limit.toFixed(4)}:attack=3:release=60:level=false`,
      `volume=${gain.toFixed(2)}dB`,
      'silenceremove=stop_periods=1:stop_duration=1:stop_threshold=-70dB',
      'aresample=48000:osf=s16:dither_method=triangular',
    ].join(',');
    await ffmpeg(['-y', '-i', input, '-af', chain, '-c:a', 'flac', '-compression_level', '8', '-f', 'flac', output]);
    const result = await measure(output);
    if (Math.abs(result.lufs - target) <= 0.5 || attempt === 2) {
      const seconds = await duration(output);
      return { lufs: result.lufs, truePeak: result.truePeak, seconds };
    }
    gain += target - result.lufs; // the limiter shaved some loudness; correct and redo
  }
}

async function duration(path) {
  return new Promise((resolve, reject) => {
    const probe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]);
    let out = '';
    probe.stdout.on('data', (c) => (out += c));
    probe.on('error', reject);
    probe.on('close', () => resolve(Number(out.trim())));
  });
}
