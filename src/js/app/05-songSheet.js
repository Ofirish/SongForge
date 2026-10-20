/* ================================================================
   songSheet.js — chords over lyrics, section blocks
   ================================================================ */
function chordRowHTML(line, si, li) {
  let html = '', col = 0;
  for (const t of chordTokens(line)) {
    if (t.pos > col) html += ' '.repeat(t.pos - col);
    html += t.valid
      ? `<button class="ch${t.sym === ui.sel ? ' sel' : ''}" data-chord="${esc(t.sym)}" data-k="${si}-${li}-${t.idx}">${esc(pretty(t.sym))}</button>`
      : `<span class="ch bad" title="Not a chord name">${esc(t.sym)}</span>`;
    col = t.pos + pretty(t.sym).length;
  }
  return html;
}
function sectionHTML(sec, si) {
  const bars = buildTimeline(song, si).totalBeats / 4 / sec.repeat;
  const name = sec.title.replace(/^\[|\]$/g, '');
  const armed = ui.delArm === si;
  return `<section class="sec" data-type="${sec.type}" data-si="${si}" id="sec-${si}">
    <header class="sec-h">
      <span class="sec-tag">${TYPE_LABEL[sec.type]}</span>
      <h3>${esc(name)}</h3>
      <span class="sec-meta">${sec.lines.length} lines · ${Math.round(bars)} bars</span>
      <div class="sec-tools">
        <button class="ibtn" data-act="play" title="Play this part" aria-label="Play ${esc(name)}">${ui.playing === 'sec:' + si ? ICON.stop : ICON.play}</button>
        <label class="rep" title="Times this part repeats">×<input type="number" min="1" max="8" value="${sec.repeat}" data-act="repeat" id="rep-${si}" aria-label="Repeats"></label>
        <button class="tbtn${ui.attachOpen === si ? ' on' : ''}" data-act="riffs" aria-expanded="${ui.attachOpen === si}">Riffs${(sec.riffs || []).length ? ' · ' + sec.riffs.length : ''}</button>
        <button class="tbtn" data-act="edit">Edit</button>
        <button class="tbtn" data-act="dup">Duplicate</button>
        <button class="ibtn" data-act="up" title="Move earlier" aria-label="Move earlier"${si === 0 ? ' disabled' : ''}>${ICON.up}</button>
        <button class="ibtn" data-act="down" title="Move later" aria-label="Move later"${si === song.sections.length - 1 ? ' disabled' : ''}>${ICON.down}</button>
        <button class="tbtn danger${armed ? ' armed' : ''}" data-act="del">${armed ? 'Confirm delete' : 'Delete'}</button>
      </div>
    </header>
    ${ui.attachOpen === si ? attachPanelHTML(sec, si) : ''}
    ${(sec.riffs || []).map((a, idx) => a.place !== 'fill' ? riffTagHTML(sec, si, a, idx) : '').join('')}
    <div class="lines">${sec.lines.map((l, li) => `<div class="ln" data-lk="${si}-${li}">${l.chords.trim() ? `<div class="crow">${chordRowHTML(l.chords, si, li)}</div>` : ''}${l.lyrics ? `<div class="lrow">${esc(l.lyrics)}</div>` : ''}</div>`).join('') || '<p class="empty">This part is empty. Choose Edit to add chords and lyrics.</p>'}</div>
    ${(sec.riffs || []).map((a, idx) => a.place === 'fill' ? riffTagHTML(sec, si, a, idx) : '').join('')}
  </section>`;
}
function editHTML(sec, si) {
  return `<section class="sec editing" data-type="${sec.type}" data-si="${si}" id="sec-${si}">
    <div class="ed-row">
      <label class="fld">Part<select data-ed="type" id="edtype-${si}">${SECTION_TYPES.map(t => `<option value="${t}"${t === sec.type ? ' selected' : ''}>${TYPE_LABEL[t]}</option>`).join('')}</select></label>
      <label class="fld grow">Name<input data-ed="title" id="edtitle-${si}" value="${esc(sec.title.replace(/^\[|\]$/g, ''))}"></label>
    </div>
    <textarea data-ed="body" id="edbody-${si}" spellcheck="false" rows="${Math.max(6, sec.lines.length * 2 + 2)}" aria-label="Chords and lyrics">${esc(linesToRaw(sec.lines))}</textarea>
    <p class="hint">Put each chord line directly above its lyric. Spaces line chords up with the syllable where they change.</p>
    <div class="ed-acts"><button class="btn primary" data-act="save">Save part</button><button class="btn" data-act="cancel">Cancel</button></div>
  </section>`;
}
function renderSheet() {
  $('#stripWrap').classList.toggle('float', ui.floatStrip);
  $('#floatBtn').setAttribute('aria-pressed', ui.floatStrip);
  $('#chordStrip').innerHTML = uniqueChords().map(sym => `<button class="mini${sym === ui.sel ? ' on' : ''}" data-chord="${esc(sym)}" aria-label="${esc(sym)}">${boxSVG(voicingFor(sym), parseChord(sym), 'sm')}<span>${esc(pretty(sym))}</span></button>`).join('');
  if (window.syncExpand) window.syncExpand();
  $('#sheet').innerHTML = song.sections.map((sec, si) => ui.editing.has(si) ? editHTML(sec, si) : sectionHTML(sec, si)).join('')
    || '<p class="empty big">Add a part below to start writing.</p>';
}
function markSelected() {
  document.querySelectorAll('[data-chord]').forEach(b => b.classList.toggle(b.classList.contains('mini') ? 'on' : 'sel', b.dataset.chord === ui.sel));
}
