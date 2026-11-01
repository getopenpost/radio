// A programme's plan: everything decided once, in order, so that any number of
// workers can then draw and encode its chunks at the same time. The music is
// mixed and encoded here. For every chunk the plan keeps its slice of AAC, what
// the picture must know about each frame, and the scene's state at its first frame.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CHUNK_SECONDS = 240;
const BANDS = 64;
export const RECORD = BANDS + 4; // bytes per frame: bands, beat
const AAC_FRAME = 1024;
const SAMPLE_RATE = 48000;

export const fileOf = (dir, kind, index) => join(dir, `${kind}-${String(index).padStart(5, '0')}`);

export function createPlan(dir, { fps, clockStart, clockSpeed, timeZone, dayMinutes, audioBitrate = '160k' }) {
  const chunkFrames = fps * CHUNK_SECONDS;
  const audio = spawn('ffmpeg', ['-v', 'error', '-f', 'f32le', '-ar', String(SAMPLE_RATE), '-ac', '2', '-channel_layout', 'stereo', '-i', 'pipe:0', '-c:a', 'aac', '-aac_pns', '0', '-aac_is', '0', '-b:a', audioBitrate, '-f', 'adts', '-y', join(dir, 'audio.aac')], { stdio: ['pipe', 'ignore', 'inherit'] });
  const records = Buffer.alloc(chunkFrames * RECORD);
  let frames = 0;

  return {
    /** One frame's worth of picture facts and sound. */
    async record({ bands, beat, mix, scene }) {
      const chunk = Math.floor(frames / chunkFrames);
      const at = frames % chunkFrames;
      if (at === 0) writeFileSync(`${fileOf(dir, 'state', chunk)}.json`, JSON.stringify(scene()));
      const o = at * RECORD;
      for (let i = 0; i < BANDS; i++) records[o + i] = Math.round(bands[i] * 255);
      records.writeFloatLE(beat, o + BANDS);
      frames++;
      if (frames % chunkFrames === 0) writeFileSync(`${fileOf(dir, 'frames', chunk)}.bin`, records);
      if (!audio.stdin.write(Buffer.from(mix.buffer, mix.byteOffset, mix.byteLength))) await once(audio.stdin, 'drain');
    },
    async finish(titles) {
      audio.stdin.end();
      await once(audio, 'close');
      if (audio.exitCode !== 0) throw new Error(`audio encoder exited ${audio.exitCode}`);
      sliceAudio(dir, Math.round((CHUNK_SECONDS * SAMPLE_RATE) / AAC_FRAME));
      writeFileSync(join(dir, 'plan.json'), JSON.stringify({ fps, chunkFrames, frames, clockStart, clockSpeed, timeZone, dayMinutes, titles }));
    },
  };
}

/** Cut the AAC at frame boundaries. Four minutes is a whole number of AAC frames, so chunks join exactly. */
function sliceAudio(dir, perChunk) {
  const aac = readFileSync(join(dir, 'audio.aac'));
  let at = 0;
  let start = 0;
  let count = 0;
  let chunk = 0;
  while (at + 7 <= aac.length) {
    if (aac[at] !== 0xff || (aac[at + 1] & 0xf0) !== 0xf0) throw new Error(`lost ADTS sync at ${at}`);
    at += ((aac[at + 3] & 3) << 11) | (aac[at + 4] << 3) | (aac[at + 5] >> 5);
    if (++count === perChunk) {
      writeFileSync(`${fileOf(dir, 'audio', chunk++)}.aac`, aac.subarray(start, at));
      start = at;
      count = 0;
    }
  }
  if (at > start) writeFileSync(`${fileOf(dir, 'audio', chunk)}.aac`, aac.subarray(start, at));
}
