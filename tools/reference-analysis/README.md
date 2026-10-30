# Reference analysis

Scripts behind [docs/music/reference-analysis.md](../../docs/music/reference-analysis.md).
They turn a long YouTube mix into songs, stems and transcriptions, and measure
our renders the same way. Nothing here runs at render time.

## Setup

Run from a scratch directory, because the scripts read and write relative
paths (`decoded/`, `stems/`, `corpus/`, `reports/`, `scripts/`):

```sh
mkdir -p tmp/refkit/{decoded,stems,corpus,reports} && cd tmp/refkit
cp -r ../../tools/reference-analysis scripts
nix shell nixpkgs#uv nixpkgs#ffmpeg
uv venv --python 3.11 .venv
uv pip install --python .venv numpy scipy librosa soundfile matplotlib demucs torch torchaudio
```

`htdemucs` runs about 12 times faster than real time on an M4 through MPS.

## Workflow

| Step | Command | Output |
| --- | --- | --- |
| Stem features for a whole mix | `fullsep.py mix.mp3 decoded/NAME-full.npz` | per-stem band energy, chroma and drum onsets, small enough to keep |
| Songs and arrangement | `arrange.py NAME` | `reports/NAME-songs2.json`, a layer map, kick on/off runs per song |
| Every song | `corpus.sh NAME mix.mp3` | one sheet and report per window in `corpus/` |
| Distributions | `aggregate.py NAME` | tempo, keys, loops, drum and stem statistics |
| How a song moves | `evolve.py NAME 3` | stem levels and brightness per 8 bars |
| Drum one-shots | `oneshot.py stems/X` | hits averaged on the beat grid: kick pitch, decay, level against kick |
| Our render against references | `cmp.py new=path.flac@60+50` | spectrum, floor, width and perceptual metrics side by side |

## Reading a sheet

`deep.py` draws eight bars: the mix, the bass stem, drum onsets, the "other"
stem and the vocal stem as piano rolls. Triangles rising from the bottom are
kicks. Horizontal lines are held notes. Stacked lines at multiples of the lowest
are one note's harmonics.

Two traps: a held note under a sidechain looks like `.xxx.xxx.xxx.xxx` in the
onset grids, and chord names are template guesses, so trust the pitch rows.
Comparisons always measure the main body of a track, not its beatless ends.
