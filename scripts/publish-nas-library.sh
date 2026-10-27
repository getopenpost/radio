#!/usr/bin/env bash
# Publish audio before the catalog, keeping the live NAS library coherent.
set -euo pipefail
source_dir="${1:-library}"
nas="${RGO_MUSIC_NAS:-kraktoos@rgo-nas}"
remote_dir="${RGO_MUSIC_NAS_DIR:-/volume1/homes/kraktoos/openpost-radio-music}"
node src/cli/library.js --catalog --dir "$source_dir"
rsync -a --ignore-existing --exclude '*.partial' "$source_dir/tracks/" "$nas:$remote_dir/tracks/"
rsync -a --delay-updates "$source_dir/catalog.json" "$nas:$remote_dir/"
