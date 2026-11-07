const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const yt = '/nix/store/b0p6jaia0v47rzmqfvsa6308isx71bcm-yt-dlp-2026.10.21/bin/yt-dlp';
const ff = '/nix/store/x3fqx445h9yhi4ms3jbvr9wdjx3xzsg5-ffmpeg-headless-8.1.2-bin/bin/ffmpeg';
const url = 'https://www.youtube.com/live/KTiuHA62u4g';
const get = format => execFileSync(yt, ['--no-warnings', '-f', format, '-g', url], { timeout: 90000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const video = get('312'), audio = get('234');
fs.writeFileSync('output/live-one-hour/capture.json', JSON.stringify({ started: Date.now(), url }));
const result = spawnSync(ff, ['-v', 'error', '-live_start_index', '-2', '-i', video, '-live_start_index', '-2', '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-t', '30', '-c', 'copy', '-y', 'output/live-one-hour/served.mkv'], { timeout: 110000, stdio: ['ignore', 'ignore', 'pipe'] });
if (result.status !== 0) { console.error('YouTube capture failed', result.status, result.error?.message ?? ''); process.exit(1); }
for (const [args, out] of [
  [['-vn', '-ar', '8000', '-ac', '1', '-f', 's16le'], 'served.pcm'],
  [['-ss', '5', '-frames:v', '1'], 'served-frame.png']
]) {
  const r = spawnSync(ff, ['-v', 'error', '-i', 'output/live-one-hour/served.mkv', ...args, '-y', `output/live-one-hour/${out}`], { timeout: 30000, stdio: 'ignore' });
  if (r.status !== 0) throw Error(`extract ${out} failed`);
}
console.log('Captured 30 seconds of YouTube video and audio.');
