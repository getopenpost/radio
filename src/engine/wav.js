import { writeFile } from 'node:fs/promises';

/** Write stereo float32 PCM as a 32-bit float WAV file. */
export async function writeWav(path, left, right, sampleRate) {
  const frames = left.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + frames * 8, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 8, 28);
  header.writeUInt16LE(8, 32);
  header.writeUInt16LE(32, 34);
  header.write('data', 36);
  header.writeUInt32LE(frames * 8, 40);
  const interleaved = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    interleaved[2 * i] = left[i];
    interleaved[2 * i + 1] = right[i];
  }
  await writeFile(path, Buffer.concat([header, Buffer.from(interleaved.buffer)]));
}
