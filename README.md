# rgo-music

Generative music for a 24/7 OpenPost Radio stream on YouTube and Twitch: work
and focus music written as [Strudel](https://strudel.cc) code, rendered offline
into a track library, and streamed with a calm dithered scene.

```
compose (seeded Strudel code) → render (Node, no browser) → master (-14 LUFS FLAC)
      → library (local or S3/R2) → stream (director → crossfade → scene → ffmpeg → YouTube, Twitch)
```

## Quick start

```bash
devenv shell          # or: nix shell nixpkgs#nodejs_24 nixpkgs#ffmpeg
npm install           # also bundles Strudel for Node (dist/strudel.js)

npm run compose -- --style focus --seed 42                  # print the track's Strudel code
npm run compose -- --style focus --seed 42 --render out.wav # render it
npm run library -- --count 40                               # build 40 mastered tracks in parallel
npm run stream -- --output preview.mp4 --duration 120       # preview the stream as a file
npm run scene -- --at 2026-01-12T17:40                      # still of the scene at a time (tmp/scene)
npm run stream -- --tour --output tour.mp4                  # 13-minute fast-forward through every scene
npm run audition -- --styles focus --seeds 1,2              # score excerpts with earshot (needs uv)
npm test
```

Every track is plain Strudel code. Paste `library/tracks/<id>.strudel` into
strudel.cc to hear it in the browser and edit it.

## Music

Seven styles share one sound library and mixing system, so the stream changes
colour without changing world:

| style   | label         | bpm     | character |
| ------- | ------------- | ------- | --------- |
| focus   | deep focus    | 84-98   | bass-led downtempo and future beats: sustained sub, electric piano over soft pads, detail between the pulses |
| cafe    | cafe          | 76-88   | coffee-shop chillhop: fingerpicked jazz guitar over Rhodes, plucked finger bass, soft lazy drums, dark and clean |
| garage  | future garage | 128-136 | two-step shuffle, reese bass, vowel pads, crackle |
| house   | chill house   | 112-122 | soft four on the floor, stabs, rolling bass |
| lofi    | lofi          | 70-88   | jazzy keys with tape wobble, swung boom-bap, upright bass, vinyl |
| wave    | night drive   | 84-108  | pumping eighth-note bass, polysynth pads, arpeggios, reverb snare |
| ambient | ambient       | 60-76   | beatless chords over a drone; the stream's breathing space |

What keeps 8 hours from getting boring:

- **Composition** (`src/compose`): progressions from a curated library in any
  key, bass lines resolved against each chord (approach notes, octave moves),
  motifs that walk the chord scale and land on chord tones, comping and
  arpeggio vocabularies, and several arrangement plans per style. Sections
  swap progressions, bass rhythms and drum grooves so a track moves through
  different bass and harmonic profiles.
- **Sound** (`src/compose/instruments.js`): 73 presets across sub, bass,
  pad, keys, lead, arp and texture, plus 42 drum kit pieces from 9 classic
  machines and the CC0 VCSL percussion.
  Each style picks presets by tag or names them outright.
- **Restraint**: a section carries at most two harmonic layers (pad, keys,
  second pad) and one melodic voice (lead or arpeggio), so tracks stay easy to
  work to. Keys, bass, leads and arpeggios land a few milliseconds late and
  drift in velocity, so parts sound played rather than gridded.
- **Mix**: `npm run calibrate` measures every preset on a reference phrase and
  stores gain factors in `calibration.json`; styles set levels per role. Any
  preset combination therefore lands at the same balance. Fixed effect buses
  per orbit keep reverbs constant. The kick ducks the pads and, lightly, the
  bass.
- **Targets**: the focus sound was tuned against a reference mix with
  `npm run analyze`. That reference has 87-95% of its energy below 400 Hz, a
  140-260 Hz spectral centroid, a sustained bass floor, no gaps in the
  harmonic bed and wide low mids. The main sections of rendered focus tracks
  measure about 85% below 400 Hz, a 205-225 Hz centroid and a continuous bass.
  The cafe style was tuned against a coffee-shop chillhop mix: 80-95 bpm,
  mostly major keys, a 255-346 Hz centroid, almost nothing above 3 kHz and a
  plucked bass with air between the notes; cafe renders measure 272-330 Hz.
  Its guitar picks broken chords, because the soundfont guitars struck as
  block chords read as an electric piano. No style carries a steady noise
  bed: `analyze` reports the high-frequency floor, which stays near -30 dB
  or lower.
- **Listening**: `npm run audition` renders the opening of a few seeds per
  style and scores them with [earshot](https://github.com/Leonxlnx/earshot):
  how well each matches its style's description against "cheap synth demo",
  "corporate" and "video game" alternatives, and how produced it sounds.
  Results land in `tmp/audition/<label>`, so changes can be compared before
  and after. Treat the scores as a guard against regressions, not as taste.

Intros and outros are always beatless, so the stream can crossfade between
any two tempos.

## Rendering without a browser

`src/engine` runs Strudel's own evaluator and superdough on
[node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api). The
library needed several fixes, all in `src/engine` and
`scripts/build-strudel.js`:

- Tracks render in 4-bar chunks, each in a fresh `OfflineAudioContext` with 6
  seconds of pre-roll. A single context is quadratic in length, and adding
  voices mid-render with `suspend()` intermittently froze the output. Chunks
  are checked for frozen output, and each seam must match its neighbour
  sample-for-sample; a failing chunk is rendered again.
- superdough's per-voice AudioWorklets (LFOs, shape, distort, crush,
  supersaw) are replaced with equivalent native nodes. Worklet nodes are never
  freed offline in node-web-audio-api.
- Reverb impulse responses, noise, crackle, FM modulator phase and supersaw
  phases are deterministic, so separately rendered chunks agree.
- Sidechain ducking is written as direct gain automation.
- WAV files the native decoder rejects fall back to ffmpeg.

Renders run 3-40x faster than real time per core. The library builder runs one
track per CPU core. Sample maps and samples are cached in `cache/`, so renders
after the first work offline.

Fidelity against strudel.cc (Chrome) was A/B tested. Oscillators, filters,
samples and soundfonts match. FM timbres differ slightly because modulators
now start in phase with each note.

## The stream

`npm run stream` (`src/stream/main.js`):

- **Director**: styles move only between neighbours (focus can drift into
  garage or lofi but never jumps from ambient to house). Style runs are a few
  tracks long, keys stay Camelot-compatible, tempos stay close, nothing repeats
  until about 60% of the library has played, and late nights lean calmer.
- **Mixer**: equal-power crossfades across the outgoing outro and the incoming
  intro (6-24 s).
- **Scene** (`src/stream/scene`): a 640x360 landscape that follows the real
  sun: OpenPost's light scheme (warm paper and ink) by day, its dark Dither
  scheme (warm charcoal) by night, blended through dawn and dusk. It is drawn
  in palette slots and dithered the way OpenPost's Dither material is: two
  neighbouring colours with a 4x4 Bayer band between solid ends. A fox with a
  postbag walks it one step per beat, in the middle of the frame. Everything follows the wall clock in Porto: the sun
  rises on the right and sets on the left, the moon follows its real phase and
  hours, seasons recolour and rebuild the land (snow, autumn trees, blossom,
  fireflies), weather comes and goes (cloud, rain, fog, snow, wind), and every
  two hours the walk crosses into new country (hills, alpine, forest, village,
  coast, highlands). Every 15 minutes the fox may stop:
  - cleaning a lake from a pier: a look under the water follows the hook
    down to discarded boots, bottles and cans, which it reels in and puts
    in a collection sack;
  - working in its studio: it walks in, the front wall dissolves through the
    dither, and it sits at the desk with headphones and laptop, then leaves
    by the far door. Its screen shows a desktop with overlapping windows:
    code, mail, chat, scrolling websites, and a study app with notes beside
    a rotating dithered globe (land from Natural Earth, public domain).
    A connected work session ties the pointer to file changes, browser
    navigation, sending messages and taking notes. It rests during typing
    and reading; miniature code uses varied syntax and indentation;
  - on cold days, curling up at home in an armchair by the fire with a book
    and cocoa, the cat asleep on the rug and the fireplace centred in view;
  - a workout in a calisthenics park, with the park centred at native pixel
    scale: pull-ups, dips, push-ups, freestanding handstand push-ups on
    parallettes, and muscle-ups. Hands stay planted on bars and
    floor, with straight arms in a full hang and muscle-up support;
    it counts reps, picks up and tilts its bottle for a sip, and sometimes
    a friend trains alongside;
  - rowing across a wide river past ducks, leaving the boat at the far jetty;
  - a campfire where friends join, reading on a bench (we read over its
    shoulder, following a quiet reading guide and printed page turns,
    with brief pauses for a chat), or stargazing, where a round view opens in the sky on what the
    telescope sees (the moon at its real phase, Saturn, Jupiter, a galaxy);
  - flying: it unfolds a letter from its bag into a paper plane and flies
    over the hills in an aviator cap (on a broom around Halloween).

  On the way, friends pass by and wave, or stop for a short chat in speech
  bubbles about their projects; in the rain everyone has an umbrella or a
  raincoat, and in winter a knitted beanie and scarf. Creeks cross the path
  under little footbridges, light aircraft tow encouraging banners (some about
  the hour, the weekday, the month or the season), the sea glitters along a
  path under a low sun or the moon, birds and shooting stars go by, and four visualizer looks (grass, dithered bars, dot
  matrix, ridge) change with the track. A frame takes about 2 ms to draw.
- **Encoder**: one ffmpeg process upscales 3x with nearest neighbour (crisp
  1080p pixel art), draws the `openpo.st/radio` chip (top left) and now-playing text
  (Geist Mono), and encodes H.264 + AAC once for every output. Several
  outputs (YouTube and Twitch) share the encode through ffmpeg's tee muxer,
  each behind its own fifo, so a platform that drops reconnects without
  stalling the others. If ffmpeg itself exits, the stream restarts it.

Measured on an M4, the whole stream at 1080p30 with x264 `veryfast` uses about
0.7 CPU cores. A Skylake VPS core is roughly 2-3x slower, so expect about
1.5-2 cores there. `RGO_MUSIC_SCALE=2` (720p) roughly halves that, and
`--fps 24` saves another 20%. These are estimates; measure on the target host.

## Library storage

`library/` holds `tracks/<id>.flac`, its metadata `.json` and source
`.strudel`, plus `catalog.json`. Tracks are 16-bit FLAC at -14 LUFS, about
35 MB for five minutes.

```bash
RGO_MUSIC_REMOTE=r2:bucket/library scripts/upload-library.sh
```

The stream reads either a local directory (`RGO_MUSIC_LIBRARY`) or a base URL
(`RGO_MUSIC_LIBRARY_URL`, for example a public R2 bucket). With a URL it
downloads each track shortly before it plays and keeps only a few, so the
streaming host needs almost no disk.

## Deploying (rgo-vps)

The flake exports a NixOS module. The host needs only Node and ffmpeg; it does
not render. In `~/.config/home`:

```nix
# flake inputs
rgo-music.url = "git+ssh://git@github.com/<owner>/rgo-music";

# rgo-vps host module
imports = [ inputs.rgo-music.nixosModules.default ];
sops.secrets.rgo-music-youtube = { };  # rtmp://a.rtmp.youtube.com/live2/<stream key>
sops.secrets.rgo-music-twitch = { };   # rtmp://live.twitch.tv/app/<stream key>
services.rgo-music = {
  enable = true;
  rtmpUrlFiles = [
    config.sops.secrets.rgo-music-youtube.path
    config.sops.secrets.rgo-music-twitch.path
  ];
  libraryUrl = "https://<bucket host>/library";
  # scale = 2;  # 720p if the VPS needs headroom
};
```

Settings that suit both platforms: 1080p30, keyframes every 2 s, 4.5 Mbps
video (under Twitch's 6 Mbps ceiling), 160 kbps AAC audio.

## Licences

Code: see the repository licence. Strudel packages are AGPL-3.0. Font: Geist
Mono under the SIL Open Font License (`assets/fonts`).
Sounds come from Strudel's default libraries, fetched at render time: Tidal
drum machines, VCSL (CC0), the Salamander piano (CC-BY 3.0) and General MIDI
soundfonts. Check the sample licences before monetising the channel.

### Low-resource NAS deployment

The normal programme now runs a complete dawn/day/dusk/night every **40 real
minutes**, independent of a viewer's timezone. The real date still selects
the season. Each world day chooses 1–4 activities, alternating stops with
walking. The schedule reserves 50% for walking; reading, work and flying
are the main stops. Fishing and telescope visits are rare. Rain can move
an outdoor stop into the studio. `--day-minutes 0` retains real solar time;
the scripted `--tour` continues to use its own dates.

The Synology NAS can encode H.264 on its Intel GPU. The owned manifest and
pinned runtime Dockerfile live in
`~/.config/home/modules/services/openpost-radio/nas/`, together with rollout
and credential instructions. Production uses `--encoder h264_vaapi --fps 24
--scale 2 --bitrate 3000k`. This keeps the VPS out of the streaming workload.
There is no browser, Strudel runtime, native audio engine, or music synthesis
in the streaming container. Composition happens offline on a workstation.

The NAS library is `/volume1/homes/kraktoos/openpost-radio-music`.
`./scripts/publish-nas-library.sh` copies finished tracks before publishing
the catalog. The player plans ten compatible songs ahead, preserving that
queue through restarts. Direct NAS playback reads the originals. For an
HTTP library (`--library-url`), those same ten upcoming tracks are downloaded
in the background, two at a time, with atomic files and a bounded cache.
The current and fading tracks stay protected during eviction. Playback
continues from cached tracks when catalog refreshes fail.

Useful environment settings include `RGO_MUSIC_ENCODER`,
`RGO_MUSIC_DAY_MINUTES`, `RGO_MUSIC_AHEAD`, `RGO_MUSIC_FPS`,
`RGO_MUSIC_SCALE`, and `RGO_MUSIC_VIDEO_BITRATE`. `status.json` in the state
directory records the track, queue length, scene, and actual encoder output
progress. RTMP URLs are redacted from encoder diagnostics.

The generated, badge-free livestream thumbnail is
[`output/livestream-thumbnail.png`](output/livestream-thumbnail.png).
Its full-resolution original and generation prompt are in `assets/marketing/`.
