# Song Forge — notes for Claude

Browser guitar songwriting app (chords over lyrics, playback, chord tools, neck, tab, riffs, PDF export).
Owner: Ofir. The example song is "The Only Song That Brings Me Home", dedicated to Toy.

## How Ofir likes changes made
- For new features: check, plan and explain the plan first; build only after he approves.
  Small fixes and direct "execute" requests can go straight in.
- Keep the UI low-latency and musician-friendly; dark-first design with a light theme.

## Structure
- Source lives in `src/` as modules; `src/modules.json` sets the order they are concatenated in.
  Modules share one global scope per group (`core`, `app`, `pdf`), so order matters and
  top-level code that runs on load (state setup, `bind()`, `renderAll()`) must come after what it calls.
- `src/js/core/` has no DOM access (music theory, recommender, voicing finder, song model,
  riff/lick/solo generator) and can be tested in Node by concatenating the files.
- `index.html` at the root is a build output. **Always run `python3 scripts/build.py` after editing
  `src/` and commit `index.html` together with the source change**, so the downloadable file stays current.

## Deploy / update flow
- Push to `main` → `.github/workflows/deploy.yml` builds and deploys to GitHub Pages
  (Settings → Pages → Source must be "GitHub Actions"). Live URL: https://ofirish.github.io/SongForge/
- The same `index.html` can also be published as a Claude artifact. Inside the Claude viewer, file
  saves go through the `downloads` capability (publish with `capabilities: {downloads: true}`);
  standalone, `saveFile()` falls back to a normal browser download.

## Data model (song JSON)
- `sections[]`: `{type, title, repeat, lines:[{chords, lyrics}], riffs:[{id, place:'over'|'lead'|'fill', every}]}`
- `riffs[]`: `{id, name, kind:'riff'|'lick'|'solo'|'custom', from, steps, notes:[{c, s, f, t}], backing:[{sym, beats}]}`
  (`s` 0 = low string; `steps` are eighth notes, 8 per bar). `activeRiff` is the one open in the Tab editor.
- Older songs with a single `tab` object are migrated into `riffs` by `normalizeSong()`.

## Known limits
- Print fonts are Latin subsets: Hebrew lyrics print as "?" (the PDF panel warns). Adding a Hebrew font is a planned option.
- MIDI export is not built yet.
