#!/usr/bin/env bash
# Publish audio before the catalog, keeping the live NAS library coherent.
set -euo pipefail
source_dir="${1:-library}"
nas="${RGO_MUSIC_NAS:-kraktoos@rgo-nas}"
remote_dir="${RGO_MUSIC_NAS_DIR:-/volume1/media/openpost-radio-music}"
node src/cli/library.js --catalog --dir "$source_dir"
# Keep replaced audio and metadata together for a rollback. Rsync publishes
# each replacement by rename; the catalog is sent only after every track.
revision="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$remote_dir/revisions/$revision"
rsync -a --backup --backup-dir "$backup_dir/tracks" --exclude '*.partial' "$source_dir/tracks/" "$nas:$remote_dir/tracks/"
rsync -a --backup --backup-dir "$backup_dir" --delay-updates "$source_dir/catalog.json" "$nas:$remote_dir/"
