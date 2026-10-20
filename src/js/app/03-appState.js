/* ================================================================
   app state + persistence
   ================================================================ */
const STORE_KEY = 'songforge.song.v1';
const STRUMS = {
  ballad:   { name:'Ballad (D · D U · U D U)', p:'D-DU-UDU' },
  quarters: { name:'Quarter-note downs',       p:'D-D-D-D-' },
  eighths:  { name:'Straight eighths',         p:'DUDUDUDU' },
  arpeggio: { name:'Fingerpicked arpeggio',    p:'AAAAAAAA' },
  whole:    { name:'One strum per chord',      p:'W-------' },
};
const KEY_OPTIONS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B','Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','G#m','Am','Bbm','Bm'];

let song;
try { const s = localStorage.getItem(STORE_KEY); song = normalizeSong(s ? JSON.parse(s) : SAMPLE_SONG); }
catch (e) { song = normalizeSong(SAMPLE_SONG); }
if (!STRUMS[song.strum]) song.strum = 'ballad';

const ui = { sel:null, tool:'chord', neckMode:'chord', neckLabel:'note', neckToTab:true, editing:new Set(),
  loop:false, metro:false, circleSel:null, selK:null, floatStrip:false, cur:{ c:0, s:5 }, pending:null, playing:null, active:null, delArm:null };
ui.sel = uniqueChords()[0] || 'C';
const PREFS_KEY = 'songforge.prefs.v1';
let prefs = { muted:false, floatStrip:false, windows:{}, open:[] };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch (e) {}
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }
ui.floatStrip = !!prefs.floatStrip;
ui.tabUndo = null; ui.lastGen = null; ui.texp = new Set(); ui.attachOpen = null; ui.riffDelArm = null; ui.riffQueue = [];
ui.riffsOn = prefs.riffsOn !== false;
ui.expandAll = !!prefs.expandAll;
if (!(prefs.duck >= 0 && prefs.duck <= 100)) prefs.duck = 50;
ui.follow = prefs.follow !== false;
AudioEngine.setMuted(prefs.muted);

/* ---------- local saving ----------
   Songs live only in this browser (localStorage); nothing is ever sent anywhere.
   - every change is written ~0.35 s later
   - a safety write runs every minute, and when the tab is hidden or closed
   - each minute with changes also keeps a copy in a rolling list of recent autosaves */
const BACKUP_KEY = 'songforge.backups.v1';
const MAX_BACKUPS = 12;
let saveTimer = 0, dirty = false, backupDirty = false, lastSaved = 0;
function save() {
  dirty = true; backupDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 350);
}
/** Write the song now. Returns the JSON written, or null if the browser refused. */
function writeNow() {
  clearTimeout(saveTimer);
  let json;
  try { json = JSON.stringify(serializeSong(song)); localStorage.setItem(STORE_KEY, json); }
  catch (e) { showSaveState(false); return null; }
  dirty = false; lastSaved = Date.now(); showSaveState(true);
  return json;
}
function showSaveState(ok) {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.textContent = ok ? 'Saved in this browser · ' + new Date(lastSaved).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
    : 'Couldn’t save in this browser. Use Import / Export to keep a copy.';
  el.title = ok ? 'Your song is stored only on this device, in this browser. Autosaves every minute.' : '';
  el.classList.toggle('bad', !ok);
}
function readBackups() { try { const l = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
/** Keep a copy of `json` in the recent-autosave list (skips exact duplicates). */
function backupNow(json) {
  if (!json) return;
  let list = readBackups();
  if (list[0] && list[0].json === json) return;
  let title = 'Untitled'; try { title = JSON.parse(json).title || title; } catch (e) {}
  list.unshift({ t:Date.now(), title, json });
  list = list.slice(0, MAX_BACKUPS);
  while (list.length > 1) {                      // stay well inside the browser's storage quota
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); break; } catch (e) { list.pop(); }
  }
  if (list.length === 1) try { localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); } catch (e) {}
}
setInterval(() => {
  const json = dirty ? writeNow() : (() => { try { return JSON.stringify(serializeSong(song)); } catch (e) { return null; } })();
  if (backupDirty && json) { backupNow(json); backupDirty = false; }
}, 60000);
window.addEventListener('pagehide', () => { const j = writeNow(); if (backupDirty) backupNow(j); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { const j = writeNow(); if (backupDirty) { backupNow(j); backupDirty = false; } } });

/* ---------- helpers ---------- */
/**
 * Save a generated file. Inside the Claude viewer this goes through the viewer's save prompt
 * (the `downloads` capability); opened as a standalone file it uses a normal browser download.
 * Resolves 'saved' | 'downloaded'; rejects { code, message } like the downloads capability.
 */
async function saveFile(filename, data, mime) {
  if (window.claude && typeof window.claude.use === 'function') {
    const d = await window.claude.use('downloads');
    if (!d) throw { code:'unavailable', message:'Saving files isn’t available in this view.' };
    await d.save({ filename, data });
    return 'saved';
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.hidden = true;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
const safeName = s => (String(s || 'Song').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'Song');
function saveErrorText(e, what) {
  const code = e && e.code;
  return code === 'declined' ? 'Not saved.'
    : code === 'rate_limited' ? 'A save prompt is already open. Finish that one first.'
    : code && /unavailable|not_granted|capability/.test(code) ? `Saving files isn’t available in this view. Copy the text instead, or open the page on claude.ai.`
    : `The ${what} couldn’t be saved: ${(e && e.message) || 'unknown error'}.`;
}
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const tuning = () => TUNINGS[song.tuning].midi;
function uniqueChords() {
  const out = [];
  song.sections.forEach(sec => sec.lines.forEach(l => chordTokens(l.chords).forEach(t => { if (t.valid && !out.includes(t.sym)) out.push(t.sym); })));
  return out;
}
function voicingFor(sym) {
  const list = getVoicings(sym, song.tuning);
  const pref = song.voicings[sym];
  return (pref && list.find(v => v.frets.join(',') === pref)) || list[0] || null;
}
function midisFor(v) { return v ? v.frets.map((f, s) => f >= 0 ? tuning()[s] + f + song.capo : null).filter(x => x != null) : []; }
function audition(sym) {
  const ctx = AudioEngine.init(); if (!ctx) return;
  AudioEngine.strum(midisFor(voicingFor(sym)), ctx.currentTime + 0.02, { gain:0.55, dur:2 });
}
let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
const ICON = {
  play:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.6v10.8L13 8z"/></svg>',
  stop:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5"/></svg>',
  up:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4l4.5 6h-9z"/></svg>',
  down:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12L3.5 6h9z"/></svg>',
  sound:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3.2v10.4L5 10H2z"/><path d="M11 5.2a4 4 0 010 5.6M12.8 3.5a6.4 6.4 0 010 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  muted:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3.2v10.4L5 10H2z"/><path d="M11 5.5l4 5M15 5.5l-4 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
