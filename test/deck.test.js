import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeAudio } from '../src/audio/decode.js';
import { openDeck } from '../src/stream/deck.js';

test('a deck streams exactly the decoded audio, frame by frame', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deck-'));
  const file = join(dir, 'tone.flac');
  // 20 s of a chirp: every sample differs, so any misaligned or reused chunk shows up.
  spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'aevalsrc=0.5*sin(2*PI*(100+200*t)*t)|0.5*cos(2*PI*(150+100*t)*t):s=48000:d=20', '-c:a', 'flac', file]);
  const expected = await decodeAudio(file);
  const deck = openDeck(file);
  await deck.ready();
  const frames = 1600;
  const gains = new Float32Array(frames).fill(1);
  let maxError = 0;
  for (let f = 0; f + frames <= expected.left.length; f += frames) {
    const out = new Float32Array(frames * 2);
    deck.mixInto(out, frames, gains);
    for (let i = 0; i < frames; i++) {
      maxError = Math.max(maxError, Math.abs(out[2 * i] - expected.left[f + i]), Math.abs(out[2 * i + 1] - expected.right[f + i]));
    }
    await new Promise((r) => setImmediate(r)); // let the decoder deliver more
  }
  deck.close();
  rmSync(dir, { recursive: true, force: true });
  assert.equal(maxError, 0);
});
