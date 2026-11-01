#!/usr/bin/env bash
# Pre-download the live programme's lookahead window into the VPS relay cache.
#
# The relay starts ffmpeg only after its 11-chunk window is on disk. Restarting
# the service to adopt a NEW programme with a cold cache therefore leaves the
# YouTube ingest without data for as long as the fill takes (minutes), and
# YouTube answers a multi-minute gap by looping its buffered window on air.
# Run this BEFORE the restart: the old programme keeps streaming while the
# window downloads, and the restart then reconnects in seconds.
set -euo pipefail
vps="${RGO_MUSIC_VPS:-rgo-vps}"
nas="${RGO_MUSIC_NAS:-kraktoos@rgo-nas}"
root="${RGO_MUSIC_NAS_DIR:-/volume1/media/openpost-radio-music}"
cache="${RGO_MUSIC_CACHE:-/var/cache/openpost-radio}"
chunk_seconds=240
warm=13 # a little beyond the relay's 11-chunk window to cover drift while it downloads

manifest="$(ssh -oBatchMode=yes "$nas" "cat $root/programmes/current.json")"
read -r id anchor count < <(node -e '
const m = JSON.parse(process.argv[1]);
if (!m.complete || m.chunkSeconds !== 240 || !m.count) throw Error("programme not complete");
process.stdout.write(`${m.id} ${m.anchor} ${m.count}\n`);
' "$manifest")

now_ms="$(node -e 'process.stdout.write(String(Date.now()))')"
position=$(( ( (now_ms - anchor) / 1000 % (count * chunk_seconds) + count * chunk_seconds ) % (count * chunk_seconds) ))
start=$(( position / chunk_seconds ))
echo "programme $id, position ${position}s, warming chunks $start..$(( start + warm - 1 ))"

sudo_on_vps() { ssh -oBatchMode=yes "$vps" "sudo -n $*"; }

missing=0
for n in $(seq 0 $(( warm - 1 ))); do
  i=$(( (start + n) % count ))
  file="$(printf 'chunk-%05d.ts' "$i")"
  if ssh -oBatchMode=yes "$vps" "sudo -n test -f $cache/$id/$file.ready"; then
    continue
  fi
  missing=$(( missing + 1 ))
  echo "  fetching $file"
  ssh -oBatchMode=yes "$vps" "sudo -n mkdir -p $cache/$id"
  ssh -oBatchMode=yes "$nas" "cat $root/programmes/$id/$file" |
    ssh -oBatchMode=yes "$vps" "sudo -n tee $cache/$id/$file.partial >/dev/null && sudo -n mv $cache/$id/$file.partial $cache/$id/$file && printf ready | sudo -n tee $cache/$id/$file.ready >/dev/null"
done

# Fetched as root; the relay must own them to prune and refill this folder.
ssh -oBatchMode=yes "$vps" "sudo -n chown -R openpost-radio:openpost-radio $cache/$id"
echo "warmed $(( warm - missing ))/$warm chunks already present, fetched $missing"
echo "now restart: ssh $vps 'sudo systemctl restart openpost-radio'"
