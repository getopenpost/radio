# One-hour livestream rollout

Published and activated 2026-11-02 at 20:42:52 UTC.

- Video source: `bb2ce53`, including the approved painted walk and raincoat overlay.
- Programme: `p-1793649600000-60-1793651071176`.
- Duration: 3600 seconds, 15 complete four-minute chunks, 1920×1080 at 60 fps.
- Existing relay revision `ca96202` and MP3 ingest normalization preserved.
- Existing public broadcast: https://www.youtube.com/live/KTiuHA62u4g
- All 46 repository tests passed before activation.
- Programme preparation and NAS publication completed in 625 seconds.
- Thirteen chunks were prewarmed in a staging directory, then moved into the relay cache during the brief sender restart.
- YouTube's served video was captured and visually inspected. Captured audio matched the new programme across five separate windows, correlations 0.9996166–0.9998187.
- This verifies the observed playback window. A complete one-hour live wrap has not yet been observed.

Evidence: `manifest.json`, `switched-at.txt`, `after-status.json`, `audio-verification.json`, `served.mkv`, `served-frame.png`.

The application repository has no configured Git remote, so there was no source push. The already committed source was rendered locally, published to the NAS, and activated on the VPS.
