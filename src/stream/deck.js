// A deck streams one track's PCM (48 kHz stereo float) from an ffmpeg
// decoder, buffering a few seconds ahead so reads never wait.
import { spawn } from 'node:child_process';

const SAMPLE_RATE = 48000;
const AHEAD = SAMPLE_RATE * 2 * 8; // floats buffered before the decoder is paused

export function openDeck(path) {
  const ff = spawn('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', String(SAMPLE_RATE), 'pipe:1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chunks = [];
  let buffered = 0; // floats
  let ended = false;
  let failed = null;
  let carry = Buffer.alloc(0);
  ff.stderr.on('data', (c) => (failed = String(c).trim() || failed));
  ff.stdout.on('data', (data) => {
    const bytes = carry.length ? Buffer.concat([carry, data]) : data;
    const usable = bytes.length - (bytes.length % 8); // whole stereo frames
    carry = bytes.subarray(usable);
    const floats = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + usable));
    chunks.push(floats);
    buffered += floats.length;
    if (buffered > AHEAD) ff.stdout.pause();
  });
  ff.stdout.on('end', () => (ended = true));
  ff.on('error', (err) => {
    failed = err.message;
    ended = true;
  });

  return {
    /** Wait until some audio is buffered (or the decoder gave up). */
    async ready() {
      for (let i = 0; i < 200 && buffered < SAMPLE_RATE && !ended; i++) await new Promise((r) => setTimeout(r, 25));
      if (!buffered && failed) throw new Error(`decode ${path}: ${failed}`);
    },
    /**
     * Add the next stereo frames into `out` (interleaved), starting at frame
     * `offset`, scaled per frame by `gains`. Pads with silence at the end.
     */
    mixInto(out, frames, gains, offset = 0) {
      for (let f = offset; f < frames && chunks.length; ) {
        const chunk = chunks[0];
        const take = Math.min(frames - f, chunk.length / 2);
        for (let j = 0; j < take; j++) {
          const g = gains[f + j];
          out[2 * (f + j)] += chunk[2 * j] * g;
          out[2 * (f + j) + 1] += chunk[2 * j + 1] * g;
        }
        f += take;
        buffered -= take * 2;
        if (take * 2 === chunk.length) chunks.shift();
        else chunks[0] = chunk.subarray(take * 2);
      }
      if (buffered < AHEAD / 2 && !ended) ff.stdout.resume();
    },
    get finished() {
      return ended && buffered === 0;
    },
    close() {
      ff.kill('SIGKILL');
    },
  };
}
