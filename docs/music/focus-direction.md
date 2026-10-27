# Focus music direction, October 2026

The target is bass-led electronic music for working, with chill house and future garage influences. The user's reference is [Work Music for Serious Grind | Stay Aligned](https://www.youtube.com/watch?v=MYW0TgV67RE). Search tags describe a broad family; they are not a reason to add a noisy texture, vocal chop or busy beat to every track.

## What the reference suggests

Analysis of the opening gives a pulse around 124 BPM. A 90-second body excerpt has a spectral centroid around 147 Hz, about 95% of its measured energy below 400 Hz, and continuous bass and harmonic coverage. Its low-mid stereo side/mid ratio is about -2.4 dB. These measurements describe this excerpt, rather than a rule for every track or a claim about the entire mix.

Keep a rounded, sustained mono sub, with movement from a separate low-register bass line. Give the lower mids a wide overlapping harmonic bed. Upper detail should be sparse and quiet. Alternate a gentle four-on-the-floor pulse with broken, slightly displaced grooves. Allow phrases and instrumentation to change over a track, while keeping the sound world coherent. Intro and outro remain beatless for crossfades between tempos.

## Primary examples and implementation sources

- [Strudel's official “coastline” example by eddyflux](https://strudel.cc/workshop/getting-started/) combines minor-nine harmony, electric piano, bass and phrase-dependent rhythmic and melodic variation. Its arrangement and voicing are useful examples; do not copy its composition into the broadcast library.
- [Side Brain's Future Garage workshop overview](https://sidebrain.net/product/future-garage/) identifies displaced accents, off-grid drums, dark chords, Reese bass, layered pads and evolving arrangements. Its public overview informs the vocabulary here. No paid materials were obtained or reproduced. Foley and vocal elements are optional genre conventions, and are omitted from this focus family.
- [Strudel's official effect documentation](https://strudel.cc/learn/effects/) explains that repeated filter and gain setters override earlier values. A preset's quiet parallel harmonic cannot rely on an inner `.gain()` when the builder later sets role gain. Use an independent relative level, and keep orbit reverb settings constant throughout a track.

## Additional listening references

[Phaeleh's Afterglow](https://phaeleh.bandcamp.com/track/afterglow) is available on the artist's own page. His stated palette spans dubstep, garage, electronica and house. It is a useful adjacent reference for this family, while this generator remains instrumental.

[Erased Tapes' notes for Kiasmos' Looped EP](https://www.erasedtapes.com/releases/eratp066-kiasmos-looped-ep) describe acoustic instruments, synthesizers, drum machines and tape delays. That combination supports a direction with a distinct groove and a soft, layered instrumental background. These are reference links and production notes, not claims that the generated tracks reproduce either recording. Quantitative comparisons here use the user's MM reference.

## Changes made after the Velvet Field report

The isolated 808 shaker is a repeated filtered-noise sound. The user also found it annoying when auditioned separately. This supports removing it, although it does not prove it was the only sound perceived in the live mix.

- Retire both shaker variants and cabasa from automatic kit selection.
- Use a short, quiet closed hat and sparse upper rhythms in focus. Disable focus hat rolls.
- Remove continuous noise textures from ambient, garage and lofi as well as focus.
- Move focus to 112–124 BPM with soft house and broken-beat patterns, fewer arpeggio events and lower melodic registers.
- Use a clean sine sub, smoother bass choices, wider low-register bass and a fuller pad. Keep sub frequencies centred.
- Fix the harmonic sub preset's overwritten gain by giving its upper layer its own relative velocity, then recalibrate.

The existing 96-track library is retained. Rebuild the 59 focus, garage, lofi and ambient tracks. The other 37 cafe, house and wave tracks contain none of the retired instruments or changed harmonic sub preset and remain unchanged. Replaced NAS audio and metadata are archived together before the updated catalog is published.

## Verification and listening limits

Analyze the main body of rendered FLACs, not only intros or source patterns. Check noise floor, energy distribution, stereo width, gaps, loudness and peak levels. Audition representative tracks and compare against the reference at matched levels. Audio-text model rankings can flag an obvious genre mismatch but do not establish musical quality or replace the listener's judgment.

Render the replacement 1080p60 programme from the repaired library. Keep the previous complete programme live until its replacement is completely uploaded, then verify public YouTube playback and measure the whole VPS sender, including NAS refills and RTMPS.

## Library validation

The rebuilt library contains 59 tracks: 30 focus, 13 lofi, 10 garage and 6 ambient. The other 37 tracks remain unchanged, for 96 total. All 59 saved scores match the current composer; retired shaker and cabasa selections and steady texture layers are absent. Across the rebuilt tracks, measured loudness ranges from -14.5 to -14.0 LUFS, true peak reaches -0.6 dBTP at its highest, and the maximum main-body HF floor is -29.954 dB. All 24 existing tests passed; no tests were added. Live playback and resource measurements are recorded separately.
