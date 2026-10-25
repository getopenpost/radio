# rgo-music

Generative music for a 24/7 OpenPost Radio stream on YouTube: work and focus
music written as [Strudel](https://strudel.cc) code, rendered offline into a
track library, and streamed with a calm dithered OpenPost scene.

```
compose (seeded Strudel code) → render (Node, no browser) → master (-14 LUFS FLAC)
      → library (local or S3/R2) → stream (director → crossfade → scene → ffmpeg → YouTube)
```

## Quick start

```bash
devenv shell          # or: nix shell nixpkgs#nodejs_24 nixpkgs#ffmpeg
npm install           # also bundles Strudel for Node (dist/strudel.js)

npm run compose -- --style focus --seed 42                  # print the track's Strudel code
npm run compose -- --style focus --seed 42 --render out.wav # render it
npm run library -- --count 40                               # build 40 mastered tracks in parallel
npm run stream -- --output preview.mp4 --duration 120       # preview the stream as a file
npm test
```

Every track is plain Strudel code. Paste `library/tracks/<id>.strudel` into
strudel.cc to hear it in the browser and edit it.

## Music

Six styles share one sound library and mixing system, so the stream changes
colour without changing world:

| style   | label         | bpm     | character |
| ------- | ------------- | ------- | --------- |
| focus   | deep focus    | 86-104  | bass-led downtempo and future beats: sustained sub, detail between the pulses, wide dark pads |
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
- **Sound** (`src/compose/instruments.js`): 70 presets across sub, bass,
  pad, keys, lead, arp and texture, plus 42 drum kit pieces from 9 classic
  machines and the CC0 VCSL percussion.
  Each style picks presets by tag.
- **Mix**: `npm run calibrate` measures every preset on a reference phrase and
  stores gain factors in `calibration.json`; styles set levels per role. Any
  preset combination therefore lands at the same balance. Fixed effect buses
  per orbit keep reverbs constant. The kick ducks the pads and, lightly, the
  bass.
- **Targets**: the focus sound was tuned against a reference mix with
  `npm run analyze`. That reference has 87-95% of its energy below 400 Hz, a
  140-260 Hz spectral centroid, a sustained bass floor, no gaps in the
  harmonic bed and wide low mids. Rendered focus and garage tracks measure
  81-86% below 400 Hz and a 220-290 Hz centroid.

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
- **Scene**: a 640x360 dithered landscape in OpenPost's Dither palettes (warm
  paper by day, charcoal by night, following Porto time). It has parallax
  ASCII-textured hills, the OpenPost mark walking one step per beat, postboxes
  and lamps passing by, and grass along the bottom that moves with the
  spectrum. The frame takes about 1.5 ms to draw.
- **Encoder**: one ffmpeg process upscales 3x with nearest neighbour (crisp
  1080p pixel art), draws the brand chip and now-playing text (Manrope,
  Geist Mono), and encodes H.264 + AAC to RTMP. The stream reconnects
  automatically if RTMP drops.

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
sops.secrets.rgo-music-rtmp = { };  # contains rtmp://a.rtmp.youtube.com/live2/<stream key>
services.rgo-music = {
  enable = true;
  rtmpUrlFile = config.sops.secrets.rgo-music-rtmp.path;
  libraryUrl = "https://<bucket host>/library";
  # scale = 2;  # 720p if the VPS needs headroom
};
```

YouTube settings that match: 1080p30, keyframes every 2 s (set),
4.5 Mbps video, 192 kbps AAC audio.

## Licences

Code: see the repository licence. Strudel packages are AGPL-3.0. Fonts:
Manrope and Geist Mono under the SIL Open Font License (`assets/fonts`).
Sounds come from Strudel's default libraries, fetched at render time: Tidal
drum machines, VCSL (CC0), the Salamander piano (CC-BY 3.0) and General MIDI
soundfonts. Check the sample licences before monetising the channel.
