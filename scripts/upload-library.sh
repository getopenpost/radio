#!/usr/bin/env bash
# Upload the local library to S3-compatible storage with rclone.
# Usage: RGO_MUSIC_REMOTE=r2:my-bucket/library scripts/upload-library.sh [library-dir]
# Tracks go first and are never overwritten; catalog.json goes last, so the
# stream never sees a catalog entry whose audio is missing.
set -euo pipefail
dir="${1:-library}"
remote="${RGO_MUSIC_REMOTE:?set RGO_MUSIC_REMOTE to an rclone path, e.g. r2:bucket/library}"
rclone copy --immutable --transfers 8 --include '*.flac' --include '*.json' --include '*.strudel' "$dir/tracks" "$remote/tracks"
rclone copyto "$dir/catalog.json" "$remote/catalog.json"
echo "uploaded $(ls "$dir"/tracks/*.flac | wc -l | tr -d ' ') tracks to $remote"
