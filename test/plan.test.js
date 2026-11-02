import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createPlan } from '../src/stream/plan.js';

test('planning preserves a continuous tone when the caller reuses its PCM buffer', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'music-plan-'));
  try {
    const fps = 60, rate = 48000, frames = rate / fps, seconds = 10;
    const plan = createPlan(dir, { fps });
    const mix = new Float32Array(frames * 2);
    for (let frame = 0; frame < fps * seconds; frame++) {
      for (let i = 0; i < frames; i++) {
        const value = .4 * Math.sin(2 * Math.PI * 440 * (frame * frames + i) / rate);
        mix[2 * i] = value;
        mix[2 * i + 1] = value;
      }
      await plan.record({ mix, bands: new Float32Array(64), beat: 0, scene: () => ({}) });
    }
    await plan.finish([]);
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', join(dir, 'audio.aac'), '-f', 'f32le', '-ac', '1', 'pipe:1'], { maxBuffer: 4e6, timeout: 30000 });
    assert.equal(decoded.status, 0, String(decoded.stderr));
    const samples = new Float32Array(decoded.stdout.buffer, decoded.stdout.byteOffset, decoded.stdout.length / 4);
    assert.ok(samples.length >= rate * seconds);
    // A continuous tone has all its energy at 440 Hz, independent of AAC delay.
    let sin = 0, cos = 0, energy = 0, n = 0;
    for (let i = rate; i < rate * (seconds - 1); i++, n++) {
      sin += samples[i] * Math.sin(2 * Math.PI * 440 * i / rate);
      cos += samples[i] * Math.cos(2 * Math.PI * 440 * i / rate);
      energy += samples[i] ** 2;
    }
    const fraction = 2 * (sin ** 2 + cos ** 2) / (n * energy);
    assert.ok(fraction > .99, `440 Hz accounts for only ${(100 * fraction).toFixed(2)}% of decoded energy`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
