// Prepare a stream-copy broadcast on a workstation; publish only closed chunks.
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile, lstat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
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
const pipes = Array.from({ length: manifest.count }, (_, i) => join(dir, fileName(i)));
// MPEG-TS needs no seeking. Two FIFO readers upload the current and next
// segments directly, keeping local storage independent of programme length.
command("mkfifo", pipes);
const transfers = new Set();
let stopped = false, publishing = Promise.resolve();
const abort = () => {
  stopped = true;
  if (!manifest.complete) {
    try { process.kill(-child.pid, "SIGKILL"); } catch (e) { if (e.code !== "ESRCH") throw e; }
  }
  for (const p of transfers) p.kill("SIGKILL");
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
async function upload(i) {
  const target = `${remote}/${id}/${fileName(i)}`;
  const cat = spawn("cat", [pipes[i]], { stdio: ["ignore", "pipe", "inherit"] });
  const send = spawn("ssh", [...ssh, `cat > ${quote(target + ".partial")} && mv ${quote(target + ".partial")} ${quote(target)}`], { stdio: ["pipe", "ignore", "inherit"] });
  transfers.add(cat); transfers.add(send);
  try {
    await Promise.all([finished(cat, "FIFO reader"), finished(send, "NAS upload"), pipeline(cat.stdout, send.stdin)]);
    await unlink(pipes[i]);
    manifest.ready++;
    await publish();
  } finally {
    cat.kill("SIGKILL"); send.kill("SIGKILL");
    transfers.delete(cat); transfers.delete(send);
  }
}
await publish();
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
  { detached: true, stdio: ["ignore", "inherit", "inherit"] },
);
process.once("SIGTERM", abort);
process.once("SIGINT", abort);
const rendered = finished(child, "programme renderer");
let next = 0;
try {
  await Promise.all([rendered, ...Array.from({ length: 2 }, async () => {
    while (!stopped && next < manifest.count) await upload(next++);
  })]);
  if (stopped || manifest.ready !== manifest.count) throw Error("programme preparation interrupted");
  // Keep the existing live programme until the renderer exited successfully
  // and every remote chunk has closed and been atomically renamed.
  manifest.complete = true;
  await publish();
  await writeFile(join(v.work, "done.json"), JSON.stringify(manifest));
  console.log("programme complete", id);
} finally {
  abort();
  for (const path of pipes) if (await lstat(path).then(s => s.isFIFO(), () => false)) await unlink(path);
}
