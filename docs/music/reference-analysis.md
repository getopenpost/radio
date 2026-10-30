# Reference analysis, October 2026

The composer is built from four YouTube mixes the user chose as the target sound. This page records what was measured, and why the previous library read as noisy. Everything was done from audio: `tools/reference-analysis` separates stems with htdemucs and transcribes them. Reference audio stays local and no samples or melodies were taken from it. Drums are synthesised to measured targets, and the loops and rhythms below are generic genre shapes.

| Mix | Artist | Length | Songs | Tempo | Family |
| --- | --- | --- | --- | --- | --- |
| [Work Music for Serious Grind](https://www.youtube.com/watch?v=MYW0TgV67RE) | MM | 107 min | ~20 | 118-134 | melodic house, broken beat |
| Lock In, Build the Future | MM | 89 min | ~21 | 117-127 | melodic house |
| House Music to Conquer the World | Ivan | 58 min | ~13 | 120.2 | deep house |
| Let's Work Slow and Easy | roti. | 192 min, a 64-minute loop | ~16 | 80-96 | slow soul |

## Why our songs read as noisy

They were not noisy in the usual sense. The references have more top end and more roughness than the old library, so filtering highs was the wrong fix. What differed was how full the middle of the mix stayed over time.

| Measure, main body | References | Old library |
| --- | --- | --- |
| Band floor 250-1600 Hz, 10th percentile | -29 to -50 dB | -15 to -30 dB |
| Short-term loudness swing | 3.7-6.6 dB | 1.4-1.7 dB in focus, house, garage, wave |
| Pitches sounding in the "other" stem | median about 10-13, down to 4.6 | 12-20 |
| Hat level against the kick | about -22 dB | -1 to -10 dB |
| Chords per bar | 0-0.3 in house, 0.75 in slow | one per bar, most of them extended |
| Bass register | 37-65 Hz fundamental, held | an octave higher, weak sub |

Pads held through long halls, a new extended chord each bar, Strudel voicings of six or more notes and detuned doubles filled the pitch-time plane with stationary partials. Over hours that wall of sound is what reads as noise. The earlier direction note drew the opposite conclusion, "continuous harmonic coverage", from one excerpt.

## House families

Applies to the melodic, deep and broken styles.

- **Form.** Songs last 4-6 minutes in 16-bar blocks. Parts enter on block lines. Many blocks end in a one-bar kick dropout (`K15 -1`), and some songs drop it every fourth bar. Breakdowns run 16-32 bars: kick, clap, hats and usually sub leave, and chords come forward.
- **Movement.** The harmony's 2-5 kHz band rises 20 dB or more over a song, peaking late in the breakdown, then resets when the kick returns. This filter arc stands in for chord changes.
- **Kick.** 48-58 Hz with a short drop in the first 15 ms, then nearly flat. Down 20 dB after 120-160 ms. Most windows have a spectral centroid of 60-170 Hz. Identical in 21 of 21 Lock In songs: `x...x...x...x...`.
- **Drums.** Clap on two and four, offbeat hat `..x...x...x...x.`, sixteenths about 12 ms late, top end wide while the low end stays mono.
- **Low end.** MM songs hold one root for 1-4 bars and pump it from the kick. Ivan's songs add a plucked line of two or three notes a bar, avoiding the kick's steps.
- **Chords.** maj9 and m9 dominate, in rootless voicings of four or five notes around Bb3. Lock In mostly uses eight-bar loops changing every two bars; Ivan's songs vamp on one or two chords. MM holds the chord and lets the sidechain pump it 7-15 dB. Ivan stabs on offbeats.
- **Melody.** Not a running line. Short bright phrases cross the bar line every two or four bars, a call and a shorter answer, with echo after them. Some songs instead roll a sixteenth-note cascade down into each chord change, every four bars. Ivan adds short vocal chops around E5.
- **Broken beat.** Half of Serious Grind, at 128-134 BPM. Often only two kicks a bar, on steps 1 and 7 or 8 or 11, with steady sixteenths.

## Slow soul

- Keys lead the mix: "other" stem -2.9 dB, drums -5.2, bass -6.7. Lowest clutter of the four, a median of 7 pitches.
- Dark: -23.6 dB above 2 kHz, against -16 for house.
- Chord loops of four or eight bars, ii and vi leaning towards I, changing about every bar, sometimes landing a sixteenth or two early.
- Kick doubled late in the bar (`x.......x.x.....`), backbeat snare, eighth hats, loose timing.
- One long bass root with a chromatic approach before the next chord.
- Pentatonic fills at the ends of two- and four-bar phrases: pickups into the bar line and falling figures landing on it.

## Mastering

The references master near -10.5 LUFS with peaks at full scale and a crest factor around 11.5 dB. We deliver -14 LUFS, since YouTube normalises to about that, but drive a limiter to -11 LUFS first and trim back, so density matches.

## What did not work

Automatic numbers needed checking against the sheets. `.xxx.xxx.xxx.xxx` looked like a rolling bass until reading showed a held note re-swelling after the sidechain. Stem "vocals" in the slow mix are lead leakage. The Sonnet analysts read grids well but opened few sheets, so hook templates were taken from sheets read directly. No transcription replaces listening: these targets get the mix and the form right, and only the user can judge the songs.
