/* ================================================================
   actions
   ================================================================ */
function selectChord(sym, play, k = null) {
  if (!parseChord(sym)) return;
  ui.sel = sym;
  ui.selK = k;
  if (!Player.playing) renderNowNext(nnFromSelection(), false);
  markSelected();
  renderTools();
  renderNeck();
  if (play) audition(sym);
}
function renderAll() { renderHeader(); renderArrangement(); renderSheet(); renderTools(); renderNeck(); renderTab(); if (!Player.playing) renderNowNext(nnFromSelection(), false); }
function songChanged() { renderArrangement(); renderSheet(); renderTools(); renderNeck(); if (!Player.playing) renderNowNext(nnFromSelection(), false); save(); }
function addSection(type) {
  if (Player.playing) Player.stop();
  const n = song.sections.filter(s => s.type === type).length + 1;
  song.sections.push({ type, title:`[${TYPE_LABEL[type]}${['verse','chorus'].includes(type) ? ' ' + n : ''}]`, repeat:1, lines:[] });
  ui.editing.add(song.sections.length - 1);
  songChanged();
  const ta = document.querySelector(`#edbody-${song.sections.length - 1}`);
  if (ta) { ta.focus(); ta.scrollIntoView({ block:'center' }); }
}
function moveSection(from, to) {
  if (to < 0 || to >= song.sections.length || from === to) return;
  if (Player.playing) Player.stop();
  const [s] = song.sections.splice(from, 1);
  song.sections.splice(to, 0, s);
  forgetPartIndexes();
  songChanged();
}
/** Part-index UI state (open editors, riff panels, expanded riff tabs) is stale once parts move. */
function forgetPartIndexes() { ui.editing.clear(); ui.attachOpen = null; ui.texp.clear(); ui.delArm = null; }
function loadSong(raw, msg) {
  if (Player.playing) Player.stop();
  try { backupNow(JSON.stringify(serializeSong(song))); } catch (e) {}   // the song being replaced stays recoverable
  song = normalizeSong(raw);
  if (!STRUMS[song.strum]) song.strum = 'ballad';
  ui.editing.clear(); ui.circleSel = null; ui.selK = null; ui.cur = { c:0, s:5 }; ui.tabUndo = null; ui.lastGen = null; ui.texp.clear(); ui.attachOpen = null;
  ui.sel = uniqueChords()[0] || 'C';
  renderAll(); save();
  toast(msg || `Loaded “${song.title}”.`);
}

/* ---------- import / export modal ---------- */
let modalTab = 'json';
function renderModal() {
  document.querySelectorAll('#mTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.m === modalTab));
  const body = $('#mBody');
  if (modalTab === 'midi') { body.innerHTML = midiTabHTML(); return; }
  if (modalTab === 'import') {
    body.innerHTML = `<label class="fld block">Open a file<input type="file" id="impFile" accept=".json,.txt,.chordpro,text/plain,application/json"></label>
      <label class="fld block">Or paste song JSON or a chord sheet<textarea id="impText" rows="9" spellcheck="false" placeholder="[Verse 1]&#10;G        C        G&#10;The highway dust is settling…"></textarea></label>
      <div class="ed-acts"><button class="btn primary" id="impGo">Load song</button><button class="btn" id="impSample">Load the example song</button><button class="btn" id="impNew">Start a blank song</button></div>
      <p class="msg" id="impMsg">Loading replaces the song on screen. The current song is kept in Recent autosaves first.</p>
      <h3 class="po-h">Recent autosaves</h3>
      ${(() => { const l = readBackups(); return l.length ? `<div class="backups">${l.map((b, i) => `<div class="bk-row"><span class="bk-t">${esc(b.title)}</span><span class="bk-when">${new Date(b.t).toLocaleString([], { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span><button class="btn sm" data-restore="${i}">Restore</button></div>`).join('')}</div>`
        : '<p class="empty">Copies appear here as you work. One is kept each minute you make changes, up to 12.</p>'; })()}
      <p class="hint">Everything stays in this browser on this device. Nothing is uploaded or written to GitHub.</p>`;
  } else {
    const txt = modalTab === 'json' ? JSON.stringify(serializeSong(song), null, 2) : songToText(song);
    body.innerHTML = `<textarea id="expText" rows="16" readonly spellcheck="false">${esc(txt)}</textarea>
      <div class="ed-acts"><button class="btn primary" id="expSave">Save ${modalTab === 'json' ? '.json' : '.txt'} file</button><button class="btn" id="expCopy">Copy to clipboard</button></div>
      <p class="msg" id="expMsg">${modalTab === 'json' ? 'Paste this into a file named <code>' + esc(song.id) + '.json</code> to keep it. Import reads it back exactly.' : 'Plain text with chords over lyrics and ASCII tab. Import can read this format too.'}</p>`;
  }
}
function importText(text) {
  text = String(text || '').trim();
  if (!text) { $('#impMsg').textContent = 'Paste something or choose a file first.'; return; }
  try {
    const raw = JSON.parse(text);
    if (!raw || !Array.isArray(raw.sections)) throw new Error('no sections');
    loadSong(raw); closeModal();
  } catch (e) {
    const parsed = parseSheetText(text);
    if (!parsed.sections.length) { $('#impMsg').textContent = 'That isn’t song JSON, and no [Section] headers were found. Add a line like [Verse 1] above each part.'; return; }
    loadSong({ ...parsed, title: parsed.title || 'Imported song' }); closeModal();
  }
}
function openModal(tab) { modalTab = tab || 'json'; $('#modal').hidden = false; renderModal(); $('#mClose').focus(); }
function closeModal() { $('#modal').hidden = true; $('#filesBtn').focus(); }
