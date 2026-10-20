# Song Forge

A browser-based songwriting, tab and composition tool for guitar. Everything runs in one HTML file: no install, no server, no account.

**Open it:** download `index.html` and double-click it, or use the hosted version on GitHub Pages: <https://ofirish.github.io/songforge/>.

## What it does

- **Song sheet** with chords over lyrics, parts (verse, chorus, bridge, solo…), repeats, drag-to-reorder arrangement, transpose, capo and tunings (standard, Drop D, open G/D/E, DADGAD, half-step down).
- **Playback** with a plucked-string guitar sound, strum patterns, loop, click track, mute and follow-along scrolling.
- **Now / Next** window showing the current chord and the next change in the song.
- **Chords tabs:** chord diagrams with voicings up the neck, next-chord suggestions from music theory (functions, cadences, secondary dominants, borrowed chords) and an interactive circle of fifths.
- **Neck** view of chord tones, the key's scale or pentatonic; tap to play and to write tab.
- **Tab editor** with hammer-ons, pull-offs, bends, slides, vibrato and dead notes.
- **Riffs, licks and solos:** create them from any part's chords, keep them in a library, place them as lead-ins, fills or over a part, and hear them in the song.
- **Floating windows:** pop any part of the page out and arrange them side by side.
- **Save as PDF** with choice of content, text size, portrait/landscape (suggested automatically for long songs), and backgrounds.
- **Import / export** as JSON or a plain-text chord sheet with ASCII tab.

Songs save automatically in your browser.

## Working on the code

The app is written as modules under `src/` and built into the single file `index.html`.

```
src/
  index.template.html   page markup with placeholders
  styles.css            all styles (design tokens at the top)
  modules.json          module load order
  js/core/              music theory, recommender, voicings, song model, generator (no DOM)
  js/app/               audio engine, renderers, editors, playback, windows, menu
  js/pdf/               PDF layout and export
  data/sample-song.json the example song
  vendor/               jsPDF (MIT) and the app fonts (SIL OFL), embedded for offline use
scripts/build.py        stitches src/ into index.html
```

After changing anything in `src/`:

```
python3 scripts/build.py          # rebuild index.html
python3 scripts/build.py --check  # confirm index.html matches src/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Credits

- [jsPDF](https://github.com/parallax/jsPDF) — MIT licence.
- Fonts: Young Serif, Figtree and JetBrains Mono — SIL Open Font License.
