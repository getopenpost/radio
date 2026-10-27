// Prepare a stream-copy broadcast on a workstation; publish only closed chunks.
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
const { values: v } = parseArgs({
  options: {
    hours: { type: "string", default: "8" },
    fps: { type: "string", default: "30" },
    scale: { type: "string", default: "2" },
    encoder: { type: "string", default: "libx264" },
    bitrate: { type: "string", default: "3000k" },
    nas: { type: "string", default: "kraktoos@rgo-nas" },
    root: {
      type: "string",
      default: "/volume1/homes/kraktoos/openpost-radio-music",
    },
    work: { type: "string", default: "tmp/program" },
  },
});
const seconds = Number(v.hours) * 3600,
  chunkSeconds = 240;
if (
  !(seconds > 0) ||
  !Number.isInteger(seconds / chunkSeconds) ||
  ![24, 30, 60].includes(Number(v.fps)) ||
  ![2, 3].includes(Number(v.scale))
)
  throw Error("programme must contain whole four-minute chunks");
const anchor = Math.floor(Date.now() / 2400000) * 2400000,
  id = `p-${anchor}-${v.fps}-${Date.now()}`;
const dir = join(v.work, id);
await mkdir(dir, { recursive: true });
const remote = `${v.root}/programmes`;
const command = (bin, args) => {
  const r = spawnSync(bin, args, {
    timeout: 600000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.error || r.status !== 0) throw Error(String(r.stderr).slice(-1000));
};
command("ssh", [v.nas, `mkdir -p '${remote}/${id}'`]);
const manifest = {
  id,
  anchor,
  seconds,
  chunkSeconds,
  count: seconds / chunkSeconds,
  fps: Number(v.fps),
  width: 640 * Number(v.scale),
  height: 360 * Number(v.scale),
  ready: 0,
  complete: false,
  season: [12, 1, 2].includes(new Date(anchor).getUTCMonth() + 1)
    ? "winter"
    : [3, 4, 5].includes(new Date(anchor).getUTCMonth() + 1)
      ? "spring"
      : [6, 7, 8].includes(new Date(anchor).getUTCMonth() + 1)
        ? "summer"
        : "autumn",
};
let done = false,
  code = null;
const child = spawn(
  process.execPath,
  [
    "src/stream/main.js",
    "--output",
    join(dir, "chunk-%05d.ts"),
    "--duration",
    String(seconds),
    "--clock",
    new Date(anchor).toISOString(),
    "--fps",
    v.fps,
    "--scale",
    v.scale,
    "--encoder",
    v.encoder,
    "--bitrate",
    v.bitrate,
    "--preset",
    "veryfast",
    "--loop-ready",
    "--state",
    join(dir, "state"),
  ],
  { stdio: ["ignore", "inherit", "inherit"] },
);
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGTERM"));
child.on("error", (error) => {
  console.error(error.message);
  code = 1;
  done = true;
});
child.on("close", (c) => {
  code = c;
  done = true;
});
async function publish() {
  const files = (await readdir(dir))
    .filter((f) => /^chunk-\d{5}\.ts$/.test(f))
    .sort();
  const closed = done ? files : files.slice(0, -1);
  for (const f of closed) {
    command("rsync", [
      "-a",
      "--remove-source-files",
      join(dir, f),
      `${v.nas}:${remote}/${id}/`,
    ]);
    manifest.ready = Math.max(manifest.ready, Number(f.slice(6, 11)) + 1);
  }
  manifest.complete = done && code === 0 && manifest.ready === manifest.count;
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
  command("rsync", [
    "-a",
    "--delay-updates",
    join(dir, "manifest.json"),
    `${v.nas}:${remote}/${id}/`,
  ]);
  // A replacement becomes current only when complete. Concurrent preparations
  // must not keep changing the manifest a restarting live sender will read.
  if (manifest.complete) {
    await writeFile(join(dir, "current.json"), JSON.stringify(manifest));
    command("rsync", [
      "-a",
      "--delay-updates",
      join(dir, "current.json"),
      `${v.nas}:${remote}/`,
    ]);
  }
  console.log(`published ${manifest.ready}/${manifest.count} broadcast chunks`);
}
try {
  while (!done) {
    await new Promise((r) => setTimeout(r, 2500));
    await publish();
  }
  await publish();
  if (code !== 0) throw Error(`programme renderer exited ${code}`);
  await writeFile(join(v.work, "done.json"), JSON.stringify(manifest));
  console.log("programme complete", id);
} finally {
  if (!done) child.kill("SIGTERM");
}
