/* ================================================================
   tabEditor.js
   ================================================================ */
const TECH = [['h','Hammer-on'],['p','Pull-off'],['b','Bend'],['/','Slide up'],['\\','Slide down'],['~','Vibrato'],['x','Dead note'],['','Plain']];
function renderTab() {
  const tab = song.tab, tun = tuning();
  $('#tabName').value = tab.name;
  let h = `<div class="tg-lab"></div>`;
  for (let c = 0; c < tab.steps; c++) h += `<div class="tg-bar${c % 8 === 0 ? ' start' : ''}">${c % 8 === 0 ? 'Bar ' + (c / 8 + 1) : ''}</div>`;
  if (tab.backing && tab.backing.length) {
    const starts = new Map(); let acc = 0;
    tab.backing.forEach(b => { starts.set(acc * 2, b.sym); acc += b.beats; });
    h += `<div class="tg-lab tg-chl">Chords</div>`;
    for (let c = 0; c < tab.steps; c++) h += `<div class="tg-ch">${starts.has(c) ? esc(pretty(starts.get(c))) : ''}</div>`;
  }
  for (const s of [5,4,3,2,1,0]) {
    const n = noteName(tun[s], false);
    h += `<div class="tg-lab">${s === 5 ? n.toLowerCase() : n}</div>`;
    for (let c = 0; c < tab.steps; c++) {
      const note = tab.notes[c + ':' + s];
      const cur = ui.cur.c === c && ui.cur.s === s;
      h += `<div class="tc${c % 8 === 0 ? ' bar' : ''}${c % 2 ? ' off' : ''}${cur ? ' cur' : ''}" data-c="${c}" data-s="${s}">${note ? `<span>${esc(tabCellText(note))}</span>` : ''}</div>`;
    }
  }
  const grid = $('#tabGrid');
  grid.style.setProperty('--steps', tab.steps);
  grid.innerHTML = h + '<span class="play-dot grid-dot" id="tabDot" hidden aria-hidden="true"></span>';
  const cn = tab.notes[ui.cur.c + ':' + ui.cur.s];
  document.querySelectorAll('[data-tech]').forEach(b => b.setAttribute('aria-pressed', !!cn && (b.dataset.tech === 'x' ? cn.f === 'x' : cn.f !== 'x' && (cn.t || '') === b.dataset.tech)));
  renderGenControls();
  $('#tabPos').textContent = `Bar ${Math.floor(ui.cur.c / 8) + 1}, step ${ui.cur.c % 8 + 1} · ${s2name(ui.cur.s)} string`;
}
function s2name(s) { const n = noteName(tuning()[s], false); return (s === 5 ? n.toLowerCase() : n) + ` (${6 - s})`; }
function setTabNote(c, s, f, t = '') {
  const k = c + ':' + s;
  if (f == null) delete song.tab.notes[k];
  else song.tab.notes[k] = { f, t };
  save();
}
function moveCursor(dc, ds) {
  ui.cur.c = clamp(ui.cur.c + dc, 0, song.tab.steps - 1);
  ui.cur.s = clamp(ui.cur.s + ds, 0, 5);
  renderTab();
  const el = document.querySelector(`.tc.cur`);
  if (el) el.scrollIntoView({ block:'nearest', inline:'nearest' });
}
function playTabNoteAt(c, s, when, tab = song.tab) {
  const n = tab.notes[c + ':' + s];
  if (!n) return null;
  const base = tuning()[s] + song.capo;
  if (n.f === 'x') return AudioEngine.pluck(base + 5, when, { gain:0.35, dead:true });
  let slideFrom = null;
  if (n.t === '/' || n.t === '\\') {
    for (let k = c - 1; k >= 0; k--) { const p = tab.notes[k + ':' + s]; if (p && p.f !== 'x') { slideFrom = base + p.f; break; } }
    if (slideFrom == null) slideFrom = base + n.f + (n.t === '/' ? -2 : 2);
  }
  return AudioEngine.pluck(base + n.f, when, { gain: n.t === 'h' || n.t === 'p' ? 0.34 : 0.55, dur: 60 / song.tempo * 2.2,
    bend: n.t === 'b' ? 2 : 0, slideFrom, vibrato: n.t === '~' });
}


/* ---------- play dot: glides along the tab and lands on each note as it sounds ---------- */
let lastHit = '';
function hidePlayDots() { document.querySelectorAll('.play-dot').forEach(d => { d.hidden = true; }); lastHit = ''; }
/** Move the dot(s) for `riff` to fractional step `pos` (0 = first step). */
function placePlayDots(riff, pos, tagKey) {
  const step = Math.floor(pos), frac = pos - step;
  const hit = frac < 0.22 && Object.keys(riff.notes).some(k => +k.split(':')[0] === step);
  const hitKey = riff.id + ':' + step;
  // Tab editor grid: columns are 30px after a 34px label column
  const gd = document.getElementById('tabDot');
  if (gd) {
    if (riff === song.tab && pos >= -0.5 && pos < riff.steps) {
      gd.hidden = false;
      gd.style.transform = `translateX(${34 + (pos + 0.5) * 30}px)`;
      gd.classList.toggle('hit', hit);
    } else gd.hidden = true;
  }
  // expanded ASCII tabs on the song sheet
  document.querySelectorAll('.rt-tab').forEach(pre => {
    const d = pre.querySelector('.play-dot');
    if (!d) return;
    const mine = pre.dataset.rid === riff.id && (!tagKey || pre.dataset.tag === tagKey);
    if (!mine || pos < -0.5 || pos >= riff.steps) { d.hidden = true; return; }
    const cols = JSON.parse(pre.dataset.cols);
    const i = clamp(step, 0, cols.length - 2), x = cols[i] + (cols[i + 1] - cols[i]) * clamp(pos - i, 0, 1);
    d.hidden = false;
    d.style.left = `calc(10px + ${x}ch)`;
    d.classList.toggle('hit', hit);
  });
  if (hit && hitKey !== lastHit) lastHit = hitKey;
}

/* ---------- riff / lick / solo creator ---------- */
const GEN_LABEL = { riff:'Riff', lick:'Lick', solo:'Solo' };
let genSeed = Math.floor(Math.random() * 1e6);
function defaultGenSection(kind) {
  const withChords = song.sections.map((s, i) => i).filter(i => backingForSection(song, i).length);
  if (ui.selK) { const si = +ui.selK.split('-')[0]; if (withChords.includes(si)) return si; }
  const prefer = kind === 'solo' ? ['solo', 'chorus', 'verse'] : kind === 'riff' ? ['intro', 'verse', 'chorus'] : ['chorus', 'verse'];
  for (const t of prefer) { const i = withChords.find(j => song.sections[j].type === t); if (i != null) return i; }
  return withChords[0] != null ? withChords[0] : -1;
}
function renderGenControls() {
  const sel = $('#genSrc'), kind = $('#genKind').value;
  const prev = sel.value;
  sel.innerHTML = song.sections.map((s, i) => {
    const bars = Math.round(buildTimeline(song, i).totalBeats / 4 / s.repeat);
    return bars ? `<option value="${i}">${esc(secName(s))} · ${bars} bar${bars === 1 ? '' : 's'}</option>` : '';
  }).join('') || '<option value="-1">No parts with chords</option>';
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  else sel.value = String(defaultGenSection(kind));
  $('#genBtn').textContent = 'Create ' + GEN_LABEL[kind].toLowerCase();
  $('#genUndo').hidden = !ui.tabUndo;
  renderRiffLib();
}
function createPhrase() {
  const kind = $('#genKind').value, si = +$('#genSrc').value;
  const sec = song.sections[si];
  if (!sec) { toast('Add chords to a part first, then create a ' + kind + ' over it.'); return; }
  const backing = backingForSection(song, si);
  const oneRep = trimBacking(backing, Math.max(4, buildTimeline(song, si).totalBeats / sec.repeat));
  const r = generatePhrase(kind, oneRep, parseKey(song.key), tuning(), ++genSeed);
  if (!Object.keys(r.notes).length) { toast('Couldn’t find enough notes for that in this tuning. Try another part or tuning.'); return; }
  if (Player.playing) Player.stop();
  const n = song.riffs.filter(x => x.from === secName(sec) && x.kind === kind).length + 1;
  const riff = { id:newRiffId(), name:`${secName(sec)} ${kind}${n > 1 ? ' ' + n : ''}`, kind, from:secName(sec), steps:r.steps, notes:r.notes, backing:r.backing };
  ui.tabUndo = { removeId:riff.id, prevActive:song.tab.id };
  ui.lastGen = { id:riff.id, si };
  song.riffs.push(riff);
  openRiff(riff.id);
  save();
  toast(`Added “${riff.name}” to your riffs. Press Create again for another take.`);
  playTab(riff);
}
function undoPhrase() {
  const u = ui.tabUndo;
  if (!u) return;
  if (Player.playing) Player.stop();
  removeRiff(u.removeId);
  if (song.riffs.some(r => r.id === u.prevActive)) openRiff(u.prevActive);
  ui.tabUndo = null; ui.lastGen = null;
  renderTab(); renderSheet(); renderArrangement(); save();
  toast('Removed the riff you just created.');
}
