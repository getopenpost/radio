import { spawn } from 'node:child_process';

/** Decode any audio file to stereo float32 at the given rate using ffmpeg. */
export function decodeAudio(path, { sampleRate = 48000, start, duration } = {}) {
  const args = ['-v', 'error'];
  if (start != null) args.push('-ss', String(start));
  if (duration != null) args.push('-t', String(duration));
  args.push('-i', path, '-f', 'f32le', '-ac', '2', '-ar', String(sampleRate), 'pipe:1');
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.stderr.on('data', (c) => (stderr += c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg decode failed for ${path}: ${stderr.trim()}`));
      const buf = Buffer.concat(chunks);
      const all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
      const frames = all.length / 2;
      const left = new Float32Array(frames);
      const right = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        left[i] = all[2 * i];
        right[i] = all[2 * i + 1];
      }
      resolve({ left, right, sampleRate });
    });
  });
}
