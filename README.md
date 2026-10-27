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
- **Scene** (`src/stream/scene`): a 640x360 landscape with a 40-minute world day: OpenPost's light scheme (warm paper and ink) by day, its dark Dither
  scheme (warm charcoal) by night, blended through dawn and dusk. It is drawn
  in palette slots and dithered the way OpenPost's Dither material is: two
  neighbouring colours with a 4x4 Bayer band between solid ends. A fox with a
  postbag walks it one step per beat, in the middle of the frame. The wall clock anchors the programme: the sun
  rises on the right and sets on the left, the moon keeps its real phase, and
  calendar seasons recolour and rebuild the land (snow, autumn trees, blossom,
  fireflies), weather comes and goes (cloud, rain, fog, snow, wind), and every
  world day the walk crosses into new country (hills, alpine, forest, village,
  coast, highlands). Each day chooses 1–4 stops:
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
- **Encoder**: one ffmpeg process upscales with nearest neighbour (2x for
  720p, 3x for 1080p pixel art), draws the `openpo.st/radio` chip (top left) and now-playing text
  (Geist Mono), and encodes H.264 + AAC once for every output. Several
  outputs (YouTube and Twitch) share the encode through ffmpeg's tee muxer,
  each behind its own fifo, so a platform that drops reconnects without
  stalling the others. If ffmpeg itself exits, the stream restarts it.

## Library storage

`library/` holds `tracks/<id>.flac`, its metadata `.json` and source
`.strudel`, plus `catalog.json`. Tracks are 16-bit FLAC at -14 LUFS, about
35 MB for five minutes.

```bash
RGO_MUSIC_REMOTE=r2:bucket/library scripts/upload-library.sh
```

The stream reads either a local directory (`RGO_MUSIC_LIBRARY`) or a base URL
(`RGO_MUSIC_LIBRARY_URL`, for example a public R2 bucket). With a URL it
prefetches ten compatible upcoming tracks in the background. Its cache
protects current, fading, and queued audio while pruning older tracks.

## VPS deployment

The live sender runs on `rgo-vps`. The NAS is storage only. To minimize CPU
and RAM, prepare the complete video and audio on a workstation, then let
`src/stream/relay.js` forward H.264/AAC packets with FFmpeg `-c copy`.
There is no scene renderer, decoder, synthesizer, or video encoder on the VPS.

```bash
node src/cli/program.js --hours 8 --fps 30
```

This publishes closed four-minute MPEG-TS chunks and an atomic manifest to
`/volume1/homes/kraktoos/openpost-radio-music/programmes/` on the NAS. The
initial programme is 1280x720 at 30fps, 3 Mbps H.264 plus 160 kbps AAC, with
two-second keyframes. Its music crossfades and visualizer are baked into the
video. The eight-hour programme repeats, with a 12-second audio fade and a
short dither at the loop boundary. Fresh compositions and seasonal changes
require preparing and publishing another programme, then restarting the relay.
The live sender does not generate new music or weather indefinitely.

The VPS keeps the current chunk and ten ahead, at most eleven chunks. That gives about 40 minutes of
NAS-outage headroom after the buffer fills, using roughly 1.1 GB of bounded
cache instead of the entire library. A dedicated restricted SSH key can
read only radio assets, with a pinned NAS host key. Only two downloads run
at once. Startup waits until the lookahead has been published. A reconnect
seeks to the current wall-clock position in the programme.

The service and encrypted credentials are owned by
`~/.config/home/modules/services/openpost-radio/default.nix`. Copy reviewed
`src/`, `assets/`, and `package.json` into root-owned
`/opt/openpost-radio/app`, set `RGO_MUSIC_REVISION` in the module, and apply
with the configuration repository's rebuild wizard (`rebuild --vps`). Never
put stream keys in source, command arguments, or logs. The unit has a
128 MiB memory limit and a 50% CPU quota. `status.json` in
`/var/lib/openpost-radio` records output bytes, playback time and format;
measure actual cgroup CPU and memory separately from these limits.

The normal programme completes dawn/day/dusk/night every **40 real
minutes**, independent of a viewer's timezone. The preparation date selects
the season. Each world day chooses 1–4 activities, alternating stops with
walking. The schedule reserves 50% for walking; reading, work and flying
are the main stops. Fishing and telescope visits are rare. Rain can move
an outdoor stop into the studio. `--day-minutes 0` retains real solar time
for direct rendering; the scripted `--tour` uses its own dates.

The original audio library remains on the NAS at
`/volume1/homes/kraktoos/openpost-radio-music`. Generate compositions on a
workstation and publish with `scripts/publish-nas-library.sh`, which copies
finished audio before the catalog. Direct `npm run stream` playback still
supports a local library or an HTTP source with ten compatible tracks ahead,
atomic downloads, and protection for playing and fading tracks.

The generated, badge-free livestream thumbnail is
[`output/livestream-thumbnail.png`](output/livestream-thumbnail.png).
Its full-resolution original and generation prompt are in `assets/marketing/`.

## Licences

Code: see the repository licence. Strudel packages are AGPL-3.0. Font: Geist
Mono under the SIL Open Font License (`assets/fonts`).
Sounds come from Strudel's default libraries, fetched at render time: Tidal
drum machines, VCSL (CC0), the Salamander piano (CC-BY 3.0) and General MIDI
soundfonts. Check the sample licences before monetising the channel.
