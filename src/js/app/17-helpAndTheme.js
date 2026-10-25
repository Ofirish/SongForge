/* ================================================================
   helpAndTheme.js — light/dark theme button and the Help page
   ================================================================ */

/* ---------- theme: dark by default, the last choice is remembered ---------- */
const THEME_KEY = 'tabwright.theme';
const THEME_ICON = {
  // shown icon = the mode you switch TO
  light:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>',
  dark:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8a5.6 5.6 0 1 0 7.4 7.4z"/></svg>',
};
function currentTheme() { return document.documentElement.getAttribute('data-sf-theme') === 'light' ? 'light' : 'dark'; }
function setTheme(t) {
  document.documentElement.setAttribute('data-sf-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  renderThemeBtn();
}
function renderThemeBtn() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const b = $('#themeBtn');
  b.innerHTML = THEME_ICON[next] + (next === 'light' ? ' Light' : ' Dark');
  b.setAttribute('aria-label', `Switch to ${next} mode`);
  b.title = `Switch to ${next} mode`;
}

/* ---------- help content ---------- */
const K = s => `<kbd>${s}</kbd>`;
const HELP = [
 { id:'start', title:'Getting started', html:`
  <p>Tabwright is a songwriting bench for guitar. You write the song as chords over lyrics, hear it played back, study and pick chords, and write riffs, licks and solos as tab. Everything runs in your browser. Nothing is uploaded.</p>
  <h4>A first song in five minutes</h4>
  <ol>
    <li>Open <b>Import / Export → Import</b> and choose <b>Start a blank song</b>, or keep the example song to explore.</li>
    <li>Click the title at the top and type your song's name. Add an artist or a dedication under it.</li>
    <li>Pick the <b>Key</b>, <b>BPM</b> and <b>Strum</b> pattern in the row below the title.</li>
    <li>On a part, choose <b>Edit</b>. Type a chord line, then the lyric under it, and choose <b>Save part</b>.</li>
    <li>Press <b>Play song</b> (or ${K('Space')}) to hear it.</li>
    <li>Add more parts with the <b>Add part</b> buttons under the song sheet.</li>
  </ol>
  <div class="help-tip">Not sure which chord comes next? Tap the last chord on the sheet, then open <b>Chords tabs → Next chord</b>.</div>
  <h4>How the page is laid out</h4>
  <ul>
    <li><b>Top bar</b>: song details, playback buttons and the arrangement strip. It stays at the top while you scroll.</li>
    <li><b>Song sheet</b> with the <b>Now / Next</b> window beside it.</li>
    <li><b>Chords tabs</b>: Chord, Next chord and Circle of fifths.</li>
    <li><b>Neck</b> and <b>Tab</b> at the bottom.</li>
    <li>The round <b>guitar button</b> in the bottom-right corner jumps to any of these.</li>
  </ul>` },

 { id:'song', title:'Song details', html:`
  <table class="help-tbl">
   <tr><th>Setting</th><th>What it does</th></tr>
   <tr><td>Title, artist</td><td>Shown on the page, in the PDF and as the file name when you save.</td></tr>
   <tr><td>Key</td><td>Used to name chords (roman numerals), suggest next chords, draw the circle of fifths and the neck scales. Changing it does not move any chords.</td></tr>
   <tr><td>Transpose − / +</td><td>Moves every chord, the key, the progression and your riffs up or down a semitone.</td></tr>
   <tr><td>Capo</td><td>Playback and MIDI sound at capo pitch. The line next to the fields tells you the key the song sounds in.</td></tr>
   <tr><td>BPM</td><td>Tempo for playback, the click track, the play dot and MIDI.</td></tr>
   <tr><td>Tuning</td><td>Standard, Drop D, half-step down, open G, open D, open E and DADGAD. Chord shapes are recalculated for the tuning, so any shapes you picked are reset.</td></tr>
   <tr><td>Strum</td><td>The pattern used by playback and MIDI: ballad, quarter-note downs, straight eighths, fingerpicked arpeggio, or one strum per chord.</td></tr>
  </table>` },

 { id:'sheet', title:'Song sheet and parts', html:`
  <p>A song is a list of <b>parts</b>: intro, verse, pre-chorus, chorus, bridge, solo or outro. Each part has lines of chords over lyrics.</p>
  <h4>Editing a part</h4>
  <p>Choose <b>Edit</b> on a part. Put each chord line directly above its lyric line, and use spaces to place each chord over the syllable where it changes:</p>
  <pre>G              D/F#     Em
This song is under construction</pre>
  <ul>
    <li>A line with chords and no lyric plays one bar per chord, which is handy for intros and solos.</li>
    <li>A lyric line with chords is two bars long. The chords share those bars according to where they sit over the words.</li>
    <li>Chord names the app doesn't recognise show in red. Hover them to check.</li>
  </ul>
  <h4>Part controls</h4>
  <ul>
    <li><b>▶</b> plays just this part.</li>
    <li><b>×</b> sets how many times the part repeats.</li>
    <li><b>Riffs</b> places riffs in the part (see Riffs).</li>
    <li><b>Duplicate</b>, <b>▲ ▼</b> to move, and <b>Delete</b>, which asks you to confirm.</li>
  </ul>
  <h4>Arrangement strip</h4>
  <p>The coloured strip under the playback buttons shows every part at its length. Click a part to jump to it, or drag it to reorder the song. A dot means the part has riffs.</p>
  <h4>Chords in this song</h4>
  <p>The row of chord diagrams above the sheet lists every chord in the song with the shape that will be played. Tap one to study it. Turn on <b>Float</b> to keep the row in view while you scroll. The chord that's playing lights up.</p>` },

 { id:'play', title:'Playback', html:`
  <table class="help-tbl">
   <tr><th>Button</th><th>What it does</th></tr>
   <tr><td>Play song</td><td>Plays the whole song with the strum pattern, your chord shapes and any placed riffs. ${K('Space')} also plays and stops.</td></tr>
   <tr><td>Loop</td><td>Starts again from the top when it reaches the end.</td></tr>
   <tr><td>Click track</td><td>A woodblock on every beat, louder on beat 1. The button flashes on the beat.</td></tr>
   <tr><td>Follow</td><td>Scrolls the sheet so the playing line stays near the top with the next lines visible.</td></tr>
   <tr><td>Riffs</td><td>Turns the placed riffs on or off for song playback.</td></tr>
   <tr><td>Expand riffs</td><td>Shows the tab of every placed riff on the sheet.</td></tr>
   <tr><td>Mute</td><td>Silences the sound while playback and highlighting keep going.</td></tr>
  </table>
  <p>The current chord shows on the right of the top bar. Lines and chords light up as they play.</p>
  <div class="help-tip">Browsers only allow sound after you click something on the page. If you hear nothing, check Mute and your device volume.</div>` },

 { id:'nownext', title:'Now / Next window', html:`
  <p>The window beside the song shows the chord you're on, with its diagram, roman numeral and lyric line, and the next chord change underneath.</p>
  <ul>
    <li><b>While playing</b> it follows the song, with a progress bar and an "in 3 beats" countdown, plus the riff that's playing or coming next.</li>
    <li><b>When stopped</b> it shows the chord you tapped on the sheet. Tap <b>Next</b> to step through the song chord by chord, which is good for practising changes.</li>
  </ul>` },

 { id:'chords', title:'Chords tabs', html:`
  <h4>Chord</h4>
  <ul>
    <li>Shows the selected chord's diagram, notes, formula and its role in the key.</li>
    <li><b>Look up any chord</b>: type a name and press ${K('Enter')}.</li>
    <li><b>Voicings up the neck</b>: up to six playable shapes for your tuning. The shape you pick is used for playback, the neck view, the PDF and MIDI.</li>
    <li><b>Strum</b> plays it. <b>Add to progression</b> adds it to the Next chord pad.</li>
  </ul>
  <h4>Next chord</h4>
  <ul>
    <li>Suggests what could follow, based on harmony: chords of the key, the V7, secondary dominants and borrowed chords. Each one says why, for example "builds toward the cadence".</li>
    <li>Colours show the chord's job: <b>tonic</b> (home), <b>pre-dominant</b> (moving away), <b>dominant</b> (tension), <b>secondary dominant</b> and <b>borrowed</b>. The bar shows how strong the suggestion is.</li>
    <li>Tap a card to hear it. Tap <b>+</b> to add it to the <b>Progression</b> pad. Suggestions then follow the last chord of your progression.</li>
    <li>The pad can <b>Play</b> your sketch in a loop, turn it into a new part with <b>Add as new part</b>, or <b>Clear</b> it.</li>
  </ul>
  <h4>Circle of fifths</h4>
  <ul>
    <li>Major keys round the outside, relative minors inside. The key's chords are tinted and labelled with roman numerals.</li>
    <li>Dots mark chords used in your song, and the top next-chord picks.</li>
    <li>Tap a key to hear its chord. You can then <b>Set song key</b> (relabels only) or <b>Transpose song</b> to it (moves every chord).</li>
  </ul>` },

 { id:'neck', title:'Neck', html:`
  <ul>
    <li><b>Chord tones</b>: every place to play the selected chord's notes. The ringed notes are the current shape and the root is gold.</li>
    <li><b>Key scale</b> and <b>Pentatonic</b>: the notes of the song's key, for writing melodies and solos.</li>
    <li><b>All notes</b>: every note on the neck.</li>
    <li><b>Notes / Intervals</b> switches the labels between note names and intervals (1, ♭3, 5…).</li>
    <li>Tap any spot to hear it. With <b>Tapping writes to the tab</b> on, the note is also written into the Tab at the cursor, which then moves one step on. It's the quickest way to enter a riff.</li>
  </ul>` },

 { id:'tab', title:'Tab editor', html:`
  <p>The grid has six strings (high e on top) and is split into bars of eight steps (eighth notes).</p>
  <h4>Entering notes</h4>
  <ul>
    <li>Click a step, then type the fret. For 10 to 24, type both digits quickly.</li>
    <li>Or tap the Neck with "Tapping writes to the tab" on.</li>
  </ul>
  <h4>Keys in the grid</h4>
  <table class="help-tbl">
   <tr><td>${K('0')}–${K('9')}</td><td>Fret number</td></tr>
   <tr><td>${K('←')} ${K('→')} ${K('↑')} ${K('↓')}</td><td>Move the cursor</td></tr>
   <tr><td>${K('Space')}</td><td>Step forward</td></tr>
   <tr><td>${K('Delete')} / ${K('Backspace')}</td><td>Clear the note</td></tr>
   <tr><td>${K('Enter')}</td><td>Play the whole column</td></tr>
   <tr><td>${K('h')} ${K('p')} ${K('b')}</td><td>Hammer-on, pull-off, bend</td></tr>
   <tr><td>${K('/')} ${K('\\')}</td><td>Slide up, slide down</td></tr>
   <tr><td>${K('~')} ${K('x')} ${K('n')}</td><td>Vibrato, dead note, plain</td></tr>
  </table>
  <p>The technique buttons do the same. Every technique is heard in playback: a bend rises a whole step, a slide glides from the previous note on that string.</p>
  <h4>Other tools</h4>
  <p><b>Add bar</b> and <b>Remove bar</b> change the length (up to 16 bars). <b>Clear tab</b> asks you to confirm. <b>Play tab</b> plays the riff you're editing. With <b>Play with chords</b> on, its chords strum quietly underneath.</p>
  <div class="help-tip">While a riff plays, a dot glides along the tab and flashes as each note sounds.</div>` },

 { id:'riffs', title:'Riffs, licks and solos', html:`
  <h4>Your riffs</h4>
  <p>Every song keeps a library of riffs, shown as cards at the top of the Tab part. Tap a card to edit it, or its ▶ to hear it. Rename the riff in the name field. Use <b>Duplicate</b> to try a variation, <b>Delete</b> to remove it, and <b>+ New empty tab</b> to start one by hand.</p>
  <h4>Create from the song</h4>
  <ol>
    <li>Choose <b>Type</b>: Riff (low strings, a repeated pattern that loops), Lick (two bars on the high strings) or Solo (one pass through the part, higher up the neck, with bends and slides).</li>
    <li>Choose <b>Over</b>: the part whose chords it should follow.</li>
    <li>Press <b>Create</b>. Each press gives a new take, added as a new card. <b>Undo</b> removes the one you just made.</li>
  </ol>
  <h4>Placing riffs in the song</h4>
  <p>Right after creating, the quick buttons place it in that part. Or use the <b>Riffs</b> button on any part:</p>
  <table class="help-tbl">
   <tr><td><b>Lead-in</b></td><td>Plays just before the part starts. A lead-in on the first part plays before the song begins.</td></tr>
   <tr><td><b>Fill</b></td><td>Plays at the end of the part.</td></tr>
   <tr><td><b>Over the part</b></td><td>Plays along with the part, repeating if it's shorter.</td></tr>
  </table>
  <p>For repeated parts, choose whether a riff plays on every repeat. Placed riffs show as tags on the sheet. Tap a tag to open its tab there. The <b>Chords under riffs</b> slider sets how loud the strumming is while a riff plays.</p>` },

 { id:'windows', title:'Floating windows and the guitar menu', html:`
  <ul>
    <li>Every part of the page (Song sheet, Now / Next, Chords tabs, Neck, Tab) has an <b>Extract</b> button. It opens the part in a floating window you can drag by its title bar and resize from the corner, so you can arrange things side by side.</li>
    <li><b>Put back</b> returns it to the page. Window positions, and which parts are floating, are remembered.</li>
    <li>On a phone, extracted parts open as a sheet at the bottom of the screen.</li>
    <li>The <b>guitar button</b> in the corner opens a guitar split into zones: headstock = Top, neck = Song and Now / Next, body = Chords tabs, soundhole = Neck, lower body = Tab. Tap a zone to jump there. A ↗ means that part is floating, and tapping brings its window to the front.</li>
  </ul>` },

 { id:'saving', title:'Saving and backups', html:`
  <ul>
    <li>Your song is saved <b>in this browser on this device</b> as you work: after every change, every minute, and when you switch tabs or close the page. The top bar shows the last save time.</li>
    <li>Nothing is uploaded. Another browser or device won't see your songs. Use Export to move a song.</li>
    <li><b>Recent autosaves</b>: up to 12 earlier copies, under <b>Import / Export → Import</b>. Loading or starting another song keeps a copy of the current one first.</li>
    <li>Clearing your browser's site data deletes your songs, so export the ones you care about.</li>
  </ul>
  <div class="help-tip">To keep a song safely, save it as a .json file from Import / Export. Import reads it back exactly.</div>` },

 { id:'files', title:'Import and export', html:`
  <table class="help-tbl">
   <tr><th>Tab</th><th>What you get</th></tr>
   <tr><td>Song file (JSON)</td><td>The complete song: parts, riffs, placements and chosen shapes. Save it as a file or copy it. Best for backups.</td></tr>
   <tr><td>Chord sheet + tab</td><td>Plain text with chords over lyrics, riff placements and ASCII tab, to paste anywhere.</td></tr>
   <tr><td>MIDI</td><td>The song for a DAW or notation app (see MIDI).</td></tr>
   <tr><td>Import</td><td>Open a .json or .txt file, or paste a song. You can also load the example song, start a blank one, or restore a recent autosave.</td></tr>
  </table>
  <h4>Pasting a chord sheet</h4>
  <p>Import reads ordinary chord sheets. Put each part under a header in square brackets, with chords above lyrics. A first line like <code>Title — Artist</code> and a line with <code>Key: G</code>, <code>90 BPM</code> or <code>Capo 2</code> are picked up too.</p>
  <pre>[Verse 1]
G            C          G
Woke up at three with a melody
[Chorus] x2
C        D        G</pre>` },

 { id:'pdf', title:'Save as PDF', html:`
  <p><b>Save as PDF</b> in the top bar opens a panel with a live preview of every page. The preview is exactly what you'll get.</p>
  <ul>
    <li><b>Include</b>: chords, lyrics, chord charts, riff tabs (expanded where they play) and song details. Chords without lyrics prints a bar chart, and lyrics without chords prints a lyric sheet.</li>
    <li><b>Text size</b>: Small to Extra large.</li>
    <li><b>Page</b>: Auto, Portrait or Landscape, A4 or Letter, colour or ink saver. On Auto the panel picks landscape when it saves pages, and suggests it for large text.</li>
    <li><b>Borders and lines</b>: no borders, a box around each part in its colour, or a border around the whole page. Lines between columns are used in landscape.</li>
    <li><b>Background</b>: blank, warm paper, fretboard, wood header, line frame, or your own image (as a faded page or a header picture). Your image stays in this browser.</li>
  </ul>
  <p>Parts are kept whole where they fit. Long ones continue under "(continued)". Every page has a title and page number footer.</p>` },

 { id:'midi', title:'MIDI export', html:`
  <p>Open <b>Import / Export → MIDI</b>, choose what to include, then <b>Save MIDI</b>.</p>
  <ul>
    <li><b>Tracks</b>: Chords (strummed with your pattern and shapes), Riffs (bends, slides and vibrato become pitch bends) and an optional Click track.</li>
    <li><b>Song info</b>: part markers for your DAW timeline, lyrics (shown karaoke-style by some players) and sounding pitch (includes the capo).</li>
    <li><b>Save as</b>: one file with separate tracks (best for a DAW), one file merged into a single track, or separate files in a .zip.</li>
    <li>To export one riff, use <b>Save as MIDI</b> next to its name in the Tab part.</li>
  </ul>
  <p>Inside Claude, MIDI comes in a .zip because .mid files can't be saved there directly. The website saves a plain .mid.</p>` },

 { id:'names', title:'Chord names it understands', html:`
  <p>Type chords the way guitarists usually write them. Sharps use <code>#</code> and flats use <code>b</code>, as in <code>F#m</code> and <code>Bb</code>.</p>
  <table class="help-tbl">
   <tr><th>Type</th><th>Examples</th></tr>
   <tr><td>Major, minor, power</td><td><code>C</code> <code>Cm</code> <code>C5</code></td></tr>
   <tr><td>Sixths and sevenths</td><td><code>C6</code> <code>Cm6</code> <code>C7</code> <code>Cmaj7</code> <code>Cm7</code> <code>CmMaj7</code></td></tr>
   <tr><td>Ninths and added notes</td><td><code>C9</code> <code>Cmaj9</code> <code>Cm9</code> <code>Cadd9</code> <code>Cmadd9</code></td></tr>
   <tr><td>Suspended</td><td><code>Csus2</code> <code>Csus4</code> <code>C7sus4</code> (<code>Csus</code> = sus4)</td></tr>
   <tr><td>Diminished, augmented</td><td><code>Cdim</code> <code>Cdim7</code> <code>Cm7b5</code> <code>Caug</code> (also <code>C°</code> <code>Cø</code> <code>C+</code>)</td></tr>
   <tr><td>Slash chords</td><td><code>D/F#</code> <code>C/G</code>, played with the named bass note lowest</td></tr>
  </table>` },

 { id:'keys', title:'Keyboard shortcuts', html:`
  <table class="help-tbl">
   <tr><td>${K('Space')}</td><td>Play or stop the song (when you're not typing)</td></tr>
   <tr><td>${K('Esc')}</td><td>Close a pop-up or the guitar menu</td></tr>
   <tr><td>${K('Enter')}</td><td>In the song title: finish editing. In chord lookup: open the chord.</td></tr>
   <tr><td>${K('↑')} ${K('↓')}</td><td>Move between zones in the guitar menu</td></tr>
  </table>
  <p>For the tab editor's keys, see Tab editor.</p>` },

 { id:'faq', title:'Troubleshooting', html:`
  <h4>I hear nothing</h4>
  <p>Check the <b>Mute</b> button and your device volume. Sound starts only after you've clicked something on the page.</p>
  <h4>My song is gone</h4>
  <p>Look in <b>Import / Export → Import → Recent autosaves</b>. Songs live in one browser, so a different browser, device or private window starts empty.</p>
  <h4>A chord shows in red</h4>
  <p>The app doesn't recognise that name. Check <b>Chord names it understands</b>.</p>
  <h4>Hebrew lyrics show "?" in the PDF</h4>
  <p>The print fonts don't include Hebrew letters yet. The app itself shows them fine.</p>
  <h4>The page looks old after an update</h4>
  <p>Reload with ${K('Ctrl')}+${K('Shift')}+${K('R')} (${K('⌘')}+${K('Shift')}+${K('R')} on a Mac) to skip the browser's cached copy.</p>` },
];

function renderHelp(q = '') {
  const needle = q.trim().toLowerCase();
  const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  const hits = HELP.filter(s => !needle || (s.title + ' ' + strip(s.html)).toLowerCase().includes(needle));
  const mark = h => !needle ? h : h.replace(/>([^<]+)</g, (m, txt) => '>' + txt.replace(new RegExp('(' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>') + '<');
  $('#helpToc').innerHTML = hits.map(s => `<a href="#help-${s.id}" data-hid="${s.id}">${s.title}</a>`).join('');
  $('#helpMain').innerHTML = hits.length
    ? hits.map(s => `<section id="help-${s.id}"><h3>${mark(s.title)}</h3>${mark(s.html)}</section>`).join('')
    : `<p class="help-empty">Nothing in the help matches “${esc(q)}”.</p>`;
}
function openHelp(topic) {
  $('#helpModal').hidden = false;
  if (!$('#helpMain').innerHTML) renderHelp();
  if (topic) { const el = document.getElementById('help-' + topic); if (el) el.scrollIntoView({ block:'start' }); }
  $('#helpSearch').focus();
}
function closeHelp() { $('#helpModal').hidden = true; $('#helpBtn').focus(); }

function bindHelpAndTheme() {
  renderThemeBtn();
  $('#themeBtn').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  $('#helpBtn').addEventListener('click', () => openHelp());
  $('#helpClose').addEventListener('click', closeHelp);
  $('#helpModal').addEventListener('click', e => { if (e.target.id === 'helpModal') closeHelp(); });
  $('#helpSearch').addEventListener('input', e => renderHelp(e.target.value));
  $('#helpToc').addEventListener('click', e => {
    const a = e.target.closest('[data-hid]'); if (!a) return;
    e.preventDefault();
    const el = document.getElementById('help-' + a.dataset.hid);
    if (el) el.scrollIntoView({ block:'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  // highlight the topic being read
  $('#helpMain').addEventListener('scroll', () => {
    const main = $('#helpMain'), top = main.getBoundingClientRect().top + 30;
    let cur = null;
    main.querySelectorAll('section').forEach(s => { if (s.getBoundingClientRect().top <= top) cur = s.id.slice(5); });
    if (!cur) { const f = main.querySelector('section'); cur = f && f.id.slice(5); }
    document.querySelectorAll('#helpToc a').forEach(a => a.classList.toggle('on', a.dataset.hid === cur));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#helpModal').hidden) closeHelp(); });
}
bindHelpAndTheme();
