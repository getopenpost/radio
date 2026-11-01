// Prepare a stream-copy broadcast on a workstation; publish only closed chunks.
// One pass plans the music and the scene, then one worker per core draws and
// encodes chunks independently, so preparing scales with the machine.
import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
const { values: v } = parseArgs({
  options: {
    hours: { type: "string", default: "8" },
    fps: { type: "string", default: "30" },
    scale: { type: "string", default: "2" },
    preset: { type: "string", default: "veryfast" },
    jobs: { type: "string", default: String(availableParallelism()) },
    bitrate: { type: "string", default: "3000k" },
    nas: { type: "string", default: "kraktoos@rgo-nas" },
    root: {
      type: "string",
      default: "/volume1/media/openpost-radio-music",
    },
    work: { type: "string", default: "tmp/program" },
  },
});
const seconds = Number(v.hours) * 3600,
  chunkSeconds = 240;
if (
  !(seconds > 0) ||
  !Number.isInteger(seconds / chunkSeconds) ||
  seconds / chunkSeconds > 1000 ||
  ![24, 30, 60].includes(Number(v.fps)) ||
  ![2, 3].includes(Number(v.scale))
)
  throw Error("programme must contain 1–1000 whole four-minute chunks");
const anchor = Math.floor(Date.now() / 2400000) * 2400000,
  id = `p-${anchor}-${v.fps}-${Date.now()}`;
const dir = join(v.work, id);
await mkdir(dir, { recursive: true });
const remote = `${v.root}/programmes`;
const command = (bin, args, input) => {
  const r = spawnSync(bin, args, {
    timeout: 600000,
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(String(r.stderr).slice(-1000));
};
const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
const ssh = ["-oBatchMode=yes", "-oConnectTimeout=10", "-oServerAliveInterval=10", "-oServerAliveCountMax=3", v.nas];
command("ssh", [...ssh, `mkdir -p ${quote(`${remote}/${id}`)}`]);
const manifest = {
  id,
  sourceRevision: process.env.RGO_MUSIC_REVISION ?? null,
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
const fileName = (i) => `chunk-${String(i).padStart(5, "0")}.ts`;
const transfers = new Set();
let stopped = false, publishing = Promise.resolve(), planner = null;
const workers = new Set();
const abort = () => {
  stopped = true;
  for (const p of [planner, ...workers, ...transfers]) p?.kill("SIGKILL");
};
const publish = () => (publishing = publishing.then(publishNow));
async function publishNow() {
  const json = JSON.stringify(manifest);
  await writeFile(join(dir, "manifest.json"), json);
  const path = `${remote}/${id}/manifest.json`;
  command("ssh", [...ssh, `cat > ${quote(path + ".partial")} && mv ${quote(path + ".partial")} ${quote(path)}`], json);
  if (manifest.complete) {
    await writeFile(join(dir, "current.json"), json);
    const path = `${remote}/current.json`;
    const partial = `${remote}/current.${id}.partial`;
    command("ssh", [...ssh, `cat > ${quote(partial)} && mv ${quote(partial)} ${quote(path)}`], json);
  }
  console.log(`published ${manifest.ready}/${manifest.count} broadcast chunks`);
}
const finished = (p, label) => new Promise((resolve, reject) => {
  p.once("error", reject);
  p.once("close", (code) => code === 0 ? resolve() : reject(Error(`${label} exited ${code}`)));
});
// A stalled NAS write otherwise hangs the queue and freezes the whole programme.
const UPLOAD_WATCHDOG = 900000;
async function upload(i) {
  const file = join(dir, fileName(i));
  const target = `${remote}/${id}/${fileName(i)}`;
  const send = spawn("ssh", [...ssh, `cat > ${quote(target + ".partial")} && mv ${quote(target + ".partial")} ${quote(target)}`], { stdio: ["pipe", "ignore", "inherit"] });
  transfers.add(send);
  const watchdog = setTimeout(() => {
    console.error(`upload stalled: ${fileName(i)}`);
    send.kill("SIGKILL");
  }, UPLOAD_WATCHDOG);
  try {
    await Promise.all([finished(send, "NAS upload"), pipeline(createReadStream(file), send.stdin)]);
    await unlink(file);
    manifest.ready++;
    await publish();
  } finally {
    clearTimeout(watchdog);
    send.kill("SIGKILL");
    transfers.delete(send);
  }
}
const started = performance.now();
process.once("SIGTERM", abort);
process.once("SIGINT", abort);
planner = spawn(
  process.execPath,
  ["src/stream/main.js", "--plan", dir, "--duration", String(seconds), "--clock", new Date(anchor).toISOString(), "--fps", v.fps, "--loop-ready", "--state", join(dir, "state")],
  { stdio: ["ignore", "inherit", "inherit"] },
);
await finished(planner, "programme planner");
console.log(`planned in ${((performance.now() - started) / 1000).toFixed(0)}s`);
// Each worker draws and encodes one chunk on one core. Finished chunks wait for
// the uploaders, and workers pause if the queue grows, which bounds local disk.
const encoded = [];
let next = 0, drawing = true;
async function worker() {
  while (!stopped && next < manifest.count) {
    while (encoded.length >= 6 && !stopped) await new Promise((r) => setTimeout(r, 500));
    const i = next++;
    const p = spawn(process.execPath, ["src/stream/chunk.js", "--plan", dir, "--index", String(i), "--output", join(dir, fileName(i)), "--scale", v.scale, "--bitrate", v.bitrate, "--preset", v.preset], { stdio: ["ignore", "inherit", "inherit"] });
    workers.add(p);
    await finished(p, `chunk ${i}`).finally(() => workers.delete(p));
    encoded.push(i);
  }
}
async function uploader() {
  while (!stopped && (drawing || encoded.length)) {
    if (!encoded.length) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    await upload(encoded.shift());
  }
}
try {
  const uploads = Array.from({ length: 3 }, uploader);
  await Promise.all(Array.from({ length: Number(v.jobs) }, worker)).finally(() => { drawing = false; });
  await Promise.all(uploads);
  if (stopped || manifest.ready !== manifest.count) throw Error("programme preparation interrupted");
  // Keep the existing live programme until every remote chunk has closed and been atomically renamed.
  manifest.complete = true;
  await publish();
  await writeFile(join(v.work, "done.json"), JSON.stringify(manifest));
  console.log(`programme complete ${id} in ${((performance.now() - started) / 1000).toFixed(0)}s`);
} catch (error) {
  abort();
  throw error;
}
