# Song Forge — notes for Claude

Browser guitar songwriting app (chords over lyrics, playback, chord tools, neck, tab, riffs, PDF export).
Owner: Ofir. The default example song (`src/data/sample-song.json`) is "This Song Is Under Construction",
a funny song about writing songs, with three example riffs (intro over the Intro, a fill on each chorus, a solo).

## How Ofir likes changes made
- For new features: check, plan and explain the plan first; build only after he approves.
  Small fixes and direct "execute" requests can go straight in.
- Keep the UI low-latency and musician-friendly; dark-first design with a light theme.
- Theme: dark by default; the Light/Dark button stores the choice in `localStorage['songforge.theme']` and an inline
  script in the template applies it (`data-sf-theme` on `<html>`) before first paint. The OS/viewer theme is ignored on purpose.
- Help: the Help button opens a searchable help page (`src/js/app/17-helpAndTheme.js`, `HELP` array).
  **When a feature is added or changed, update its help section in the same commit.**

## Structure
- Source lives in `src/` as modules; `src/modules.json` sets the order they are concatenated in.
  Modules share one global scope per group (`core`, `app`, `pdf`), so order matters and
  top-level code that runs on load (state setup, `bind()`, `renderAll()`) must come after what it calls.
- `src/js/core/` has no DOM access (music theory, recommender, voicing finder, song model,
  riff/lick/solo generator) and can be tested in Node by concatenating the files.
- `index.html` at the root is a build output (a full HTML document). **Always run `python3 scripts/build.py`
  after editing `src/` and commit `index.html` together with the source change**, so the downloadable file
  and the live site stay current. The build also writes `dist/artifact.html` (git-ignored): the same page as
  body content only, which is what gets published as a Claude artifact (the viewer adds its own skeleton).
- `src/styles.css` repeats the base rules the Claude viewer adds (`[hidden]{display:none!important}`, body margin)
  so the page behaves the same standalone. Don't remove them: several pop-ups use `display:grid/flex` and rely on it.
- Test in a real browser engine when layout matters: jsdom ignores `!important` and mis-sizes SVG.

## Deploy / update flow
- GitHub Pages deploys from the `main` branch root (Settings → Pages → "Deploy from a branch", main, /).
  It serves the committed `index.html`, so a change is live only after `index.html` is rebuilt and pushed.
  `.nojekyll` skips Jekyll processing. Live URL: https://ofirish.github.io/SongForge/
- The same `index.html` can also be published as a Claude artifact. Inside the Claude viewer, file
  saves go through the `downloads` capability (publish with `capabilities: {downloads: true}`);
  standalone, `saveFile()` falls back to a normal browser download.

## Saving (user data)
- Songs are stored only in the browser (`localStorage`): `songforge.song.v1` (current song),
  `songforge.backups.v1` (up to 12 recent autosaves, restorable from Import / Export → Import),
  `songforge.prefs.v1` (UI settings), `songforge.bgimg.v1` (PDF background image).
- Writes happen ~0.35 s after each change, every minute as a safety net, and when the tab is hidden or closed.
  Loading or starting another song backs up the current one first.
- User songs are never written to the repo. The repo holds only the app and the example song.

## Data model (song JSON)
- `sections[]`: `{type, title, repeat, lines:[{chords, lyrics}], riffs:[{id, place:'over'|'lead'|'fill', every}]}`
- `riffs[]`: `{id, name, kind:'riff'|'lick'|'solo'|'custom', from, steps, notes:[{c, s, f, t}], backing:[{sym, beats}]}`
  (`s` 0 = low string; `steps` are eighth notes, 8 per bar). `activeRiff` is the one open in the Tab editor.
- Older songs with a single `tab` object are migrated into `riffs` by `normalizeSong()`.

## MIDI export
- `src/js/core/06-midiFile.js`: Standard MIDI File + stored ZIP writers (pure). `src/js/app/16-midiExport.js`: builds notes the
  same way playback does (strum pattern, voicings, riff placement, lead-in offset); Import / Export → MIDI tab and the
  "Save as MIDI" button for the open riff. Tracks: Chords (ch 1), Riffs (ch 2, bend range 12 via RPN), Click (ch 10).
  Outputs: one type-1 file, one merged type-0 track, or one file per track in a .zip. Inside the Claude viewer `.mid`
  isn't an allowed download type, so MIDI is always zipped there.

## Known limits
- Print fonts are Latin subsets: Hebrew lyrics print as "?" (the PDF panel warns). Adding a Hebrew font is a planned option.
