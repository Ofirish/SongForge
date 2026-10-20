/* ================================================================
   events
   ================================================================ */
function bind() {
  // header fields
  $('#keySel').innerHTML = KEY_OPTIONS.map(k => `<option value="${k}">${pretty(parseKey(k).label)}</option>`).join('');
  $('#tuneSel').innerHTML = Object.entries(TUNINGS).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('');
  $('#strumSel').innerHTML = Object.entries(STRUMS).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('');
  $('#songTitle').addEventListener('input', e => { song.title = e.target.value; save(); });
  $('#songArtist').addEventListener('input', e => { song.artist = e.target.value; save(); });
  $('#keySel').addEventListener('change', e => { song.key = e.target.value; ui.circleSel = null; renderHeader(); renderTools(); renderNeck(); save(); });
  $('#capoIn').addEventListener('change', e => { song.capo = clamp(+e.target.value || 0, 0, 12); renderHeader(); save(); });
  $('#tempoIn').addEventListener('change', e => { song.tempo = clamp(+e.target.value || 90, 40, 240); renderHeader(); renderArrangement(); save(); });
  $('#tuneSel').addEventListener('change', e => { song.tuning = e.target.value; song.voicings = {}; renderSheet(); renderTools(); renderNeck(); renderTab(); save(); });
  $('#strumSel').addEventListener('change', e => { song.strum = e.target.value; save(); });
  $('#trDown').addEventListener('click', () => { transposeSong(song, -1); ui.sel = transposeSym(ui.sel, -1, parseKey(song.key).flat); renderHeader(); songChanged(); toast(`Transposed down to ${parseKey(song.key).label}.`); });
  $('#trUp').addEventListener('click', () => { transposeSong(song, 1); ui.sel = transposeSym(ui.sel, 1, parseKey(song.key).flat); renderHeader(); songChanged(); toast(`Transposed up to ${parseKey(song.key).label}.`); });

  // transport
  $('#playBtn').addEventListener('click', () => playSong());
  $('#loopBtn').addEventListener('click', e => { ui.loop = !ui.loop; e.currentTarget.setAttribute('aria-pressed', ui.loop); });
  $('#metroBtn').addEventListener('click', e => {
    ui.metro = !ui.metro; e.currentTarget.setAttribute('aria-pressed', ui.metro);
    if (ui.metro && !Player.playing) { const ctx = AudioEngine.init(); if (ctx) { AudioEngine.click(ctx.currentTime + 0.02, true); pulseMetro(true); } toast('Click track on. It plays along when you press Play.'); }
  });
  $('#followBtn').setAttribute('aria-pressed', ui.follow);
  $('#followBtn').addEventListener('click', e => { ui.follow = !ui.follow; prefs.follow = ui.follow; savePrefs(); e.currentTarget.setAttribute('aria-pressed', ui.follow); });

  // arrangement: click to jump, drag to reorder
  let dragFrom = null;
  const arr = $('#arr');
  arr.addEventListener('click', e => { const c = e.target.closest('.arr-chip'); if (c) { const s = $('#sec-' + c.dataset.si); if (s) s.scrollIntoView({ block:'start', behavior:'smooth' }); } });
  arr.addEventListener('dragstart', e => { const c = e.target.closest('.arr-chip'); if (!c) return; dragFrom = +c.dataset.si; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', c.dataset.si); } catch (x) {} });
  arr.addEventListener('dragover', e => { if (dragFrom == null) return; e.preventDefault(); document.querySelectorAll('.arr-chip.drop').forEach(x => x.classList.remove('drop')); const c = e.target.closest('.arr-chip'); if (c) c.classList.add('drop'); });
  arr.addEventListener('drop', e => { e.preventDefault(); const c = e.target.closest('.arr-chip'); if (c && dragFrom != null) moveSection(dragFrom, +c.dataset.si); dragFrom = null; });
  arr.addEventListener('dragend', () => { dragFrom = null; document.querySelectorAll('.arr-chip.drop').forEach(x => x.classList.remove('drop')); });

  // sheet
  $('#chordStrip').addEventListener('click', e => { const b = e.target.closest('[data-chord]'); if (b) selectChord(b.dataset.chord, true); });
  const sheet = $('#sheet');
  sheet.addEventListener('click', e => {
    const chord = e.target.closest('[data-chord]');
    if (chord) { selectChord(chord.dataset.chord, true, chord.dataset.k || null); return; }
    const tx = e.target.closest('[data-texp]');
    if (tx) { const k = tx.dataset.texp; ui.texp.has(k) ? ui.texp.delete(k) : ui.texp.add(k); renderSheet(); return; }
    const re = e.target.closest('[data-redit]');
    if (re) { openRiff(re.dataset.redit); goTo('tab'); return; }
    const ad = e.target.closest('[data-adel]');
    if (ad) { const si = +ad.closest('.sec').dataset.si; song.sections[si].riffs.splice(+ad.dataset.adel, 1); ui.texp.clear(); renderSheet(); renderArrangement(); renderRiffLib(); save(); return; }
    if (e.target.closest('[data-rplay]')) return;   // handled globally
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const secEl = btn.closest('.sec'), si = +secEl.dataset.si, sec = song.sections[si];
    const act = btn.dataset.act;
    if (act !== 'del') ui.delArm = null;
    if (act === 'play') playSong(si);
    else if (act === 'riffs') { ui.attachOpen = ui.attachOpen === si ? null : si; renderSheet(); }
    else if (act === 'aadd') { attachRiff(si, $('#aid-' + si).value, $('#apl-' + si).value); }
    else if (act === 'edit') { if (Player.playing) Player.stop(); ui.editing.add(si); renderSheet(); const ta = $('#edbody-' + si); if (ta) ta.focus(); }
    else if (act === 'cancel') { ui.editing.delete(si); renderSheet(); }
    else if (act === 'save') {
      sec.type = secEl.querySelector('[data-ed="type"]').value;
      const t = secEl.querySelector('[data-ed="title"]').value.trim() || TYPE_LABEL[sec.type];
      sec.title = '[' + t.replace(/^\[|\]$/g, '') + ']';
      sec.lines = rawToLines(secEl.querySelector('[data-ed="body"]').value);
      ui.editing.delete(si);
      songChanged();
    }
    else if (act === 'dup') { song.sections.splice(si + 1, 0, JSON.parse(JSON.stringify(sec))); ui.editing.clear(); songChanged(); }
    else if (act === 'up') moveSection(si, si - 1);
    else if (act === 'down') moveSection(si, si + 1);
    else if (act === 'del') {
      if (ui.delArm === si) { if (Player.playing) Player.stop(); song.sections.splice(si, 1); ui.delArm = null; ui.editing.clear(); songChanged(); toast('Part deleted.'); }
      else { ui.delArm = si; renderSheet(); setTimeout(() => { if (ui.delArm === si) { ui.delArm = null; renderSheet(); } }, 3500); }
    }
  });
  sheet.addEventListener('change', e => {
    if (e.target.dataset.aplace != null) { const si = +e.target.closest('.sec').dataset.si; song.sections[si].riffs[+e.target.dataset.aplace].place = e.target.value; ui.texp.clear(); renderSheet(); renderArrangement(); save(); return; }
    if (e.target.dataset.aevery != null) { const si = +e.target.closest('.sec').dataset.si; song.sections[si].riffs[+e.target.dataset.aevery].every = e.target.checked; renderSheet(); save(); return; }
    if (e.target.dataset.act === 'repeat') { const si = +e.target.closest('.sec').dataset.si; song.sections[si].repeat = clamp(+e.target.value || 1, 1, 8); renderArrangement(); save(); }
  });
  $('#addSec').addEventListener('click', e => { const b = e.target.closest('[data-add-type]'); if (b) addSection(b.dataset.addType); });

  // tools
  $('#toolTabs').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) { ui.tool = b.dataset.tool; renderTools(); } });
  const tb = $('#toolBody');
  tb.addEventListener('click', e => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-vi]'))) {
      const v = getVoicings(ui.sel, song.tuning)[+b.dataset.vi];
      if (v) { song.voicings[ui.sel] = v.frets.join(','); save(); renderTools(); renderNeck(); renderSheet(); audition(ui.sel); }
    } else if ((b = t.closest('[data-aud]'))) { audition(b.dataset.aud); if (song.progression.length) { ui.sel = b.dataset.aud; markSelected(); renderNeck(); } }
    else if ((b = t.closest('[data-add]'))) { song.progression.push(b.dataset.add); audition(b.dataset.add); renderTools(); save(); }
    else if ((b = t.closest('[data-paud]'))) audition(song.progression[+b.dataset.paud]);
    else if ((b = t.closest('[data-pdel]'))) { if (ui.playing === 'pad') Player.stop(); song.progression.splice(+b.dataset.pdel, 1); renderTools(); save(); }
    else if ((b = t.closest('.cf-g'))) circlePick(b);
    else if ((b = t.closest('[data-act]'))) {
      const a = b.dataset.act;
      if (a === 'strum') audition(ui.sel);
      else if (a === 'addpad') { song.progression.push(ui.sel); save(); ui.tool = 'next'; renderTools(); }
      else if (a === 'padplay') playPad();
      else if (a === 'padclear') { if (ui.playing === 'pad') Player.stop(); song.progression = []; renderTools(); save(); }
      else if (a === 'padsec') {
        const p = song.progression, lines = [];
        for (let i = 0; i < p.length; i += 4) lines.push({ chords:p.slice(i, i + 4).map(s => s.padEnd(8)).join('').trimEnd(), lyrics:'' });
        song.sections.push({ type:'verse', title:'[New part]', repeat:1, lines });
        songChanged();
        const el = $('#sec-' + (song.sections.length - 1)); if (el) el.scrollIntoView({ block:'center', behavior:'smooth' });
        toast('Added the progression as a new part at the end of the song.');
      }
      else if (a === 'setkey') { song.key = b.dataset.k; renderHeader(); renderTools(); renderNeck(); save(); toast(`Song key set to ${parseKey(song.key).label}.`); }
      else if (a === 'transpose') {
        const n = +b.dataset.n; transposeSong(song, n); ui.sel = transposeSym(ui.sel, n, parseKey(song.key).flat); ui.circleSel = null;
        renderHeader(); songChanged(); toast(`Transposed to ${parseKey(song.key).label}.`);
      }
    }
  });
  tb.addEventListener('keydown', e => {
    if (e.target.id === 'chordSearch' && e.key === 'Enter') {
      const v = e.target.value.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
      if (parseChord(v)) selectChord(v, true);
      else $('#searchMsg').textContent = `“${v}” isn’t a chord name I know. Try forms like Am7, Csus4, Bbmaj7 or D/F#.`;
    }
    const g = e.target.closest && e.target.closest('.cf-g');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); circlePick(g); }
  });
  function circlePick(g) {
    const name = g.dataset.cname, minor = g.dataset.cminor === '1';
    ui.circleSel = { name, minor };
    ui.sel = name; markSelected(); renderTools(); renderNeck(); audition(name);
  }

  // neck
  $('#neckCtl').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.neck) ui.neckMode = b.dataset.neck;
    if (b.dataset.nlab) ui.neckLabel = b.dataset.nlab;
    renderNeck();
  });
  $('#neckToTab').addEventListener('change', e => { ui.neckToTab = e.target.checked; });
  $('#neck').addEventListener('click', e => {
    const r = e.target.closest('.nk-hit'); if (!r) return;
    const s = +r.dataset.s, f = +r.dataset.f;
    const ctx = AudioEngine.init(); if (ctx) AudioEngine.pluck(tuning()[s] + f + song.capo, ctx.currentTime + 0.01, { gain:0.6 });
    if (ui.neckToTab) { setTabNote(ui.cur.c, s, f); ui.cur.s = s; moveCursor(1, 0); }
  });

  // tab
  const grid = $('#tabGrid');
  grid.addEventListener('click', e => {
    const c = e.target.closest('.tc'); if (!c) return;
    ui.cur = { c:+c.dataset.c, s:+c.dataset.s };
    renderTab(); grid.focus({ preventScroll:true });
    const ctx = AudioEngine.init(); if (ctx) playTabNoteAt(ui.cur.c, ui.cur.s, ctx.currentTime + 0.01);
  });
  grid.addEventListener('keydown', e => {
    const { c, s } = ui.cur, k = e.key;
    const note = song.tab.notes[c + ':' + s];
    if (/^\d$/.test(k)) {
      e.preventDefault();
      const now = Date.now(), p = ui.pending;
      let f = +k;
      if (p && p.c === c && p.s === s && now - p.t < 800 && p.f * 10 + f <= 24) f = p.f * 10 + f;
      setTabNote(c, s, f, note && note.f !== 'x' ? note.t : '');
      ui.pending = { c, s, f, t:now };
      renderTab();
      const ctx = AudioEngine.init(); if (ctx) playTabNoteAt(c, s, ctx.currentTime + 0.01);
      return;
    }
    const map = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,1], ArrowDown:[0,-1], ' ':[1,0], Tab:null };
    if (map[k]) { e.preventDefault(); moveCursor(...map[k]); return; }
    if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); setTabNote(c, s, null); renderTab(); return; }
    if (k === 'Enter') { e.preventDefault(); const ctx = AudioEngine.init(); if (ctx) for (let st = 0; st < 6; st++) playTabNoteAt(c, st, ctx.currentTime + 0.01); return; }
    const tech = { h:'h', p:'p', b:'b', '/':'/', '\\':'\\', '~':'~', x:'x', n:'' }[k.toLowerCase()];
    if (tech !== undefined && !e.metaKey && !e.ctrlKey) { e.preventDefault(); applyTech(tech); }
  });
  $('#tabTools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tech !== undefined) applyTech(b.dataset.tech);
    else if (b.id === 'tabPlay') playTab();
    else if (b.id === 'tabClearNote') { setTabNote(ui.cur.c, ui.cur.s, null); renderTab(); }
    else if (b.id === 'tabNext') moveCursor(1, 0);
    else if (b.id === 'tabAddBar') { if (song.tab.steps < 128) { song.tab.steps += 8; renderTab(); save(); } }
    else if (b.id === 'tabDelBar') {
      if (song.tab.steps > 8) {
        song.tab.steps -= 8;
        Object.keys(song.tab.notes).forEach(k => { if (+k.split(':')[0] >= song.tab.steps) delete song.tab.notes[k]; });
        ui.cur.c = Math.min(ui.cur.c, song.tab.steps - 1); renderTab(); save();
      }
    }
    else if (b.id === 'tabClear') {
      if (b.classList.contains('armed')) { song.tab.notes = {}; b.classList.remove('armed'); b.textContent = 'Clear tab'; renderTab(); save(); }
      else { b.classList.add('armed'); b.textContent = 'Confirm clear'; setTimeout(() => { b.classList.remove('armed'); b.textContent = 'Clear tab'; }, 3000); }
    }
  });
  $('#tabName').addEventListener('input', e => { song.tab.name = e.target.value || 'Untitled riff'; renderRiffLib(); renderSheet(); save(); });
  $('#genKind').addEventListener('change', () => { $('#genSrc').value = String(defaultGenSection($('#genKind').value)); renderGenControls(); });
  $('#genBtn').addEventListener('click', createPhrase);
  $('#genUndo').addEventListener('click', undoPhrase);
  $('#genAttach').addEventListener('click', e => { const b = e.target.closest('[data-gatt]'); if (b && ui.lastGen) attachRiff(ui.lastGen.si, ui.lastGen.id, b.dataset.gatt); });
  $('#riffLib').addEventListener('click', e => {
    const o = e.target.closest('[data-ropen]'); if (o) { openRiff(o.dataset.ropen); save(); return; }
    if (e.target.closest('#riffNew')) { const r = normalizeRiff({ name:'Riff ' + (song.riffs.length + 1), steps:16 }); song.riffs.push(r); openRiff(r.id); save(); $('#tabName').focus(); $('#tabName').select(); }
  });
  $('#riffDup').addEventListener('click', () => { const c = JSON.parse(JSON.stringify(song.tab)); c.id = newRiffId(); c.name = song.tab.name + ' copy'; song.riffs.splice(song.riffs.indexOf(song.tab) + 1, 0, c); openRiff(c.id); save(); toast('Duplicated. You are now editing the copy.'); });
  $('#riffDel').addEventListener('click', () => {
    const id = song.tab.id;
    if (ui.riffDelArm !== id) { ui.riffDelArm = id; renderRiffLib(); setTimeout(() => { if (ui.riffDelArm === id) { ui.riffDelArm = null; renderRiffLib(); } }, 3500); return; }
    ui.riffDelArm = null; if (Player.playing) Player.stop();
    const name = song.tab.name, used = riffUses(id).length;
    removeRiff(id); if (ui.lastGen && ui.lastGen.id === id) ui.lastGen = null; if (ui.tabUndo && ui.tabUndo.removeId === id) ui.tabUndo = null;
    openRiff(song.tab.id); renderSheet(); renderArrangement(); save();
    toast(`Deleted “${name}”${used ? ' and removed it from the song' : ''}.`);
  });
  $('#duckIn').value = prefs.duck;
  $('#duckIn').addEventListener('input', e => { prefs.duck = +e.target.value; $('#duckVal').textContent = prefs.duck + '%'; savePrefs(); });
  $('#duckVal').textContent = prefs.duck + '%';
  const syncExpand = () => {
    const n = song.sections.reduce((a, s) => a + (s.riffs || []).length, 0);
    const b = $('#expandBtn');
    b.setAttribute('aria-pressed', ui.expandAll);
    b.textContent = ui.expandAll ? 'Collapse riffs' : 'Expand riffs';
    b.disabled = !n;
    b.title = n ? (ui.expandAll ? 'Hide the tab under every riff on the sheet' : 'Show the tab under every riff on the sheet') : 'No riffs are placed in the song yet';
  };
  window.syncExpand = syncExpand;
  syncExpand();
  $('#expandBtn').addEventListener('click', () => {
    ui.expandAll = !ui.expandAll; ui.texp.clear(); prefs.expandAll = ui.expandAll; savePrefs();
    renderSheet(); syncExpand();
  });
  $('#riffsBtn').setAttribute('aria-pressed', ui.riffsOn);
  $('#riffsBtn').addEventListener('click', e => { ui.riffsOn = !ui.riffsOn; prefs.riffsOn = ui.riffsOn; savePrefs(); e.currentTarget.setAttribute('aria-pressed', ui.riffsOn); toast(ui.riffsOn ? 'Riffs play with the song.' : 'Riffs are off. Play song plays chords only.'); });
  document.addEventListener('click', e => { const p = e.target.closest('[data-rplay]'); if (p) { const r = riffById(p.dataset.rplay); if (r) playTab(r); } });

  // modal
  $('#filesBtn').addEventListener('click', () => openModal('json'));
  $('#mClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  $('#mTabs').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { modalTab = b.dataset.m; renderModal(); } });
  $('#mBody').addEventListener('click', e => {
    const id = e.target.id;
    if (id === 'expSave') {
      const json = modalTab === 'json';
      saveFile(safeName(song.title) + (json ? '.json' : '.txt'), $('#expText').value, json ? 'application/json' : 'text/plain')
        .then(r => { $('#expMsg').textContent = r === 'saved' ? 'Saved.' : 'Downloaded.'; }, e => { $('#expMsg').textContent = saveErrorText(e, 'file'); });
      return;
    }
    if (id === 'expCopy') {
      const ta = $('#expText');
      const fallback = () => { ta.focus(); ta.select(); $('#expMsg').textContent = 'Copy is blocked here. The text is selected, so press Ctrl+C or ⌘C.'; };
      try { navigator.clipboard.writeText(ta.value).then(() => { $('#expMsg').textContent = 'Copied.'; }, fallback); } catch (x) { fallback(); }
    }
    else if (id === 'impGo') importText($('#impText').value);
    else if (id === 'impSample') { loadSong(SAMPLE_SONG, 'Loaded the example song.'); closeModal(); }
    else if (id === 'impNew') { loadSong({ title:'Untitled song', key:'C', tempo:90, sections:[{ type:'verse', title:'[Verse 1]', lines:[{ chords:'C       G       Am      F', lyrics:'' }] }] }, 'Started a blank song.'); closeModal(); }
  });
  $('#mBody').addEventListener('change', e => {
    if (e.target.id !== 'impFile' || !e.target.files[0]) return;
    const r = new FileReader();
    r.onload = () => importText(r.result);
    r.onerror = () => { $('#impMsg').textContent = 'That file couldn’t be read.'; };
    r.readAsText(e.target.files[0]);
  });

  // global keys
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').hidden) { closeModal(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === ' ' && !['input','textarea','select','button'].includes(tag) && e.target.id !== 'tabGrid' && !e.target.closest('.cf-g')) { e.preventDefault(); if (Player.playing) Player.stop(); else playSong(); }
  });
}
function applyTech(tech) {
  const { c, s } = ui.cur;
  const note = song.tab.notes[c + ':' + s];
  if (tech === 'x') setTabNote(c, s, 'x');
  else if (note) setTabNote(c, s, note.f === 'x' ? 0 : note.f, tech);
  else { toast('Put a fret number on this step first, then add the technique.'); return; }
  renderTab();
}
