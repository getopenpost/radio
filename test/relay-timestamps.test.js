import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shiftTransportTimestamps } from "../src/stream/relay-timestamps.js";

function ffmpeg(args, input) {
  const result = spawnSync("ffmpeg", ["-v", "warning", ...args], { input, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result;
}

test("programme restarts keep both media clocks continuous across repeated wraps", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-clock-"));
  try {
    const base = join(dir, "base.ts");
    ffmpeg(["-f", "lavfi", "-i", "testsrc2=s=64x64:r=30:d=2", "-f", "lavfi", "-i", "sine=frequency=997:sample_rate=48000:duration=2", "-c:v", "libx264", "-preset", "ultrafast", "-g", "30", "-bf", "2", "-c:a", "aac", "-mpegts_flags", "+initial_discontinuity", base]);
    const segments = [];
    const sourceTimes = [10800, 28798, 0, 10800, 28798, 0];
    for (const [ordinal, seconds] of sourceTimes.entries()) {
      const path = join(dir, ordinal + ".ts");
      ffmpeg(["-i", base, "-c", "copy", "-output_ts_offset", String(seconds), "-mpegts_flags", "+initial_discontinuity", path]);
      segments.push(shiftTransportTimestamps(readFileSync(path), ordinal * 2 - seconds));
    }
    const output = join(dir, "output.flv");
    const result = ffmpeg(["-f", "mpegts", "-i", "pipe:0", "-c", "copy", output], Buffer.concat(segments));
    assert.doesNotMatch(result.stderr.toString(), /timestamp discontinuity|out of order/);
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_packets", "-of", "json", output], { maxBuffer: 8 * 1024 * 1024 });
    assert.equal(probe.status, 0);
    const packets = JSON.parse(probe.stdout).packets;
    for (const type of ["audio", "video"]) {
      const times = packets.filter(p => p.codec_type === type).map(p => Number(p.dts_time));
      assert.ok(times.length > 300);
      assert.ok(times.at(-1) > 11.9 && times.at(-1) < 12.2);
      assert.ok(times.every((t, i) => i === 0 || t - times[i - 1] >= 0 && t - times[i - 1] < .1));
    }
    const audio = data => ffmpeg(["-f", "mpegts", "-i", "pipe:0", "-map", "0:a", "-c", "copy", "-f", "adts", "pipe:1"], data).stdout;
    // Timestamp edits must preserve the AAC frames exactly.
    assert.deepEqual(audio(Buffer.concat(segments)), Buffer.concat(Array.from({ length: 6 }, () => audio(readFileSync(base)))));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
