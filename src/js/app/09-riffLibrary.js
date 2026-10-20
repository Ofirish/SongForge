/* ================================================================
   riffLibrary.js — many riffs per song, attached to parts
   ================================================================ */
const riffById = id => song.riffs.find(r => r.id === id) || null;
function riffUses(id) {
  const out = [];
  song.sections.forEach((s, si) => (s.riffs || []).forEach(a => { if (a.id === id) out.push({ si, place:a.place }); }));
  return out;
}
function openRiff(id) {
  const r = riffById(id);
  if (!r) return;
  if (Player.playing && ui.playing === 'tab') Player.stop();
  song.tab = r; song.activeRiff = r.id;
  ui.cur = { c:0, s:5 };
  renderTab();
}
function removeRiff(id) {
  song.riffs = song.riffs.filter(r => r.id !== id);
  song.sections.forEach(s => { s.riffs = (s.riffs || []).filter(a => a.id !== id); });
  if (!song.riffs.length) song.riffs.push(normalizeRiff({ name:'Riff 1' }));
  if (!riffById(song.tab.id)) { song.tab = song.riffs[0]; song.activeRiff = song.tab.id; }
}
function renderRiffLib() {
  const el = $('#riffLib');
  el.innerHTML = song.riffs.map(r => {
    const uses = riffUses(r.id);
    const notes = Object.keys(r.notes).length;
    return `<div class="rcard${r === song.tab ? ' on' : ''}" data-kind="${r.kind}">
      <button class="rc-main" data-ropen="${r.id}" aria-pressed="${r === song.tab}">
        <span class="rc-name">${esc(r.name)}</span>
        <span class="rc-meta"><span class="rc-kind">${KIND_LABEL[r.kind]}</span>${riffBars(r)} bars${r.from ? ' · over ' + esc(r.from) : ''}${notes ? '' : ' · empty'}</span>
        <span class="rc-used">${uses.length ? 'In ' + uses.map(u => esc(secName(song.sections[u.si]))).join(', ') : 'Not in the song yet'}</span>
      </button>
      <button class="ibtn" data-rplay="${r.id}" aria-label="Play ${esc(r.name)}">${ui.playing === 'riff:' + r.id ? ICON.stop : ICON.play}</button>
    </div>`;
  }).join('') + `<button class="rcard new" id="riffNew">+ New empty tab</button>`;
  $('#riffCount').textContent = `${song.riffs.length} saved in this song`;
  const del = $('#riffDel');
  del.textContent = ui.riffDelArm === song.tab.id ? 'Confirm delete' : 'Delete';
  del.classList.toggle('armed', ui.riffDelArm === song.tab.id);
  // quick attach after creating
  const g = ui.lastGen && riffById(ui.lastGen.id) && song.sections[ui.lastGen.si];
  $('#genAttach').hidden = !g;
  if (g) $('#genAttachTo').textContent = `Put “${riffById(ui.lastGen.id).name}” in ${secName(song.sections[ui.lastGen.si])} as:`;
}
function attachRiff(si, id, place) {
  const sec = song.sections[si];
  if (!sec || !riffById(id)) return;
  sec.riffs = sec.riffs || [];
  const ex = sec.riffs.find(a => a.id === id && a.place === place);
  if (ex) { toast('That riff is already in this part in that spot.'); return; }
  sec.riffs.push({ id, place, every:true });
  renderSheet(); renderArrangement(); renderRiffLib(); save();
  toast(`${PLACE_LABEL[place]}: “${riffById(id).name}” added to ${secName(sec)}.`);
}
function riffTagHTML(sec, si, a, idx) {
  const r = riffById(a.id);
  if (!r) return '';
  const key = si + ':' + idx, open = ui.expandAll ? !ui.texp.has(key) : ui.texp.has(key);   // texp holds exceptions to the global setting
  return `<div class="rtag" data-tag="${key}" data-place="${a.place}">
      <button class="rt-main" data-texp="${key}" aria-expanded="${open}"><span class="rt-place">${PLACE_LABEL[a.place]}</span><span class="rt-name">${esc(r.name)}</span><span class="rt-len">${riffBars(r)} bars${a.every || sec.repeat < 2 ? '' : ' · first time only'}</span></button>
      <button class="ibtn" data-rplay="${r.id}" aria-label="Play ${esc(r.name)}">${ICON.play}</button>
    </div>${open ? `<div class="rt-tabwrap">${(() => { const L = tabAsciiLayout(r, tuning()); return `<pre class="rt-tab" data-rid="${r.id}" data-tag="${key}" data-cols="${JSON.stringify(L.cols)}">${esc(L.text)}<span class="play-dot" hidden aria-hidden="true"></span></pre>`; })()}<button class="tbtn" data-redit="${r.id}">Edit in Tab</button></div>` : ''}`;
}
function attachPanelHTML(sec, si) {
  const rows = (sec.riffs || []).map((a, idx) => {
    const r = riffById(a.id); if (!r) return '';
    return `<div class="at-row">
      <span class="at-name">${esc(r.name)}</span>
      <select data-aplace="${idx}" id="ap-${si}-${idx}" aria-label="Where it plays">${Object.entries(PLACE_LABEL).map(([k, v]) => `<option value="${k}"${k === a.place ? ' selected' : ''}>${v}</option>`).join('')}</select>
      ${sec.repeat > 1 ? `<label class="chk"><input type="checkbox" data-aevery="${idx}" id="ae-${si}-${idx}"${a.every ? ' checked' : ''}> Every repeat</label>` : ''}
      <button class="tbtn" data-adel="${idx}">Remove</button>
    </div>`;
  }).join('');
  return `<div class="attach">
    <div class="at-h"><span class="sub">Riffs in this part</span><button class="tbtn" data-act="riffs">Done</button></div>
    ${rows || '<p class="empty">No riffs here yet.</p>'}
    <div class="at-row add">
      <select id="aid-${si}" aria-label="Riff">${song.riffs.map(r => `<option value="${r.id}">${esc(r.name)} (${riffBars(r)} bars)</option>`).join('')}</select>
      <select id="apl-${si}" aria-label="Where it plays">${Object.entries(PLACE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <button class="btn sm" data-act="aadd">Add riff</button>
    </div>
    <p class="hint">Lead-in plays just before the part starts. Fill plays at the end of the part. Over the part plays along with it, repeating if it's shorter.</p>
  </div>`;
}
