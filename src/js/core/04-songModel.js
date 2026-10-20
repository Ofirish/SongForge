/* ================================================================
   songModel.js — timeline, transposition, text formats
   ================================================================ */
const SECTION_TYPES = ['intro','verse','prechorus','chorus','bridge','solo','outro'];
const TYPE_LABEL = { intro:'Intro', verse:'Verse', prechorus:'Pre-chorus', chorus:'Chorus', bridge:'Bridge', solo:'Solo', outro:'Outro' };

function chordTokens(line) {
  const out = [], re = /\S+/g;
  let m;
  while ((m = re.exec(line || ''))) out.push({ sym:m[0], pos:m.index, idx:out.length, valid:!!parseChord(m[0]) });
  return out;
}
/** Split `total` beats across weights (largest remainder, at least 1 each). */
function allocate(w, total) {
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const raw = w.map(x => x / sum * total);
  const out = raw.map(x => Math.max(1, Math.floor(x)));
  let diff = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0; diff > 0; j++, diff--) out[order[j % order.length][1]]++;
  while (diff < 0) { out[out.indexOf(Math.max(...out))]--; diff++; }
  return out;
}
/**
 * Turn the chord sheet into timed events. A lyric line is two 4/4 bars; chords share
 * those 8 beats by where they sit over the words. Chord-only lines give each chord a bar.
 */
function buildTimeline(song, only = null) {
  const events = [];
  let beat = 0, last = null;
  song.sections.forEach((sec, si) => {
    if (only != null && si !== only) return;
    for (let r = 0; r < sec.repeat; r++) sec.lines.forEach((ln, li) => {
      const toks = chordTokens(ln.chords).filter(t => t.valid);
      if (!toks.length) {
        if (ln.lyrics.trim() && last) { events.push({ beat, beats:4, sym:last, si, li, ti:-1, rep:r }); beat += 4; }
        return;
      }
      let beats;
      if (!ln.lyrics.trim()) beats = toks.map(() => 4);
      else {
        const lastTok = toks[toks.length - 1];
        const L = Math.max(ln.lyrics.length, lastTok.pos + lastTok.sym.length + 2);
        const w = toks.map((t, i) => (i < toks.length - 1 ? toks[i + 1].pos : L) - t.pos);
        w[0] += toks[0].pos;
        beats = allocate(w.map(x => Math.max(1, x)), Math.max(8, toks.length));
      }
      toks.forEach((t, i) => { events.push({ beat, beats:beats[i], sym:t.sym, si, li, ti:t.idx, rep:r }); beat += beats[i]; last = t.sym; });
    });
  });
  return { events, totalBeats:beat };
}

function transposeSym(sym, n, flat) {
  const c = parseChord(sym);
  if (!c) return sym;
  const qText = sym.slice(c.root.length).split('/')[0];
  let s = noteName(c.rootPc + n, flat) + qText;
  if (c.bass) s += '/' + noteName(c.bassPc + n, flat);
  return s;
}
/** Transpose a chord line, keeping each chord over the same syllable where it fits. */
function transposeLine(line, n, flat) {
  let out = '';
  for (const t of chordTokens(line)) {
    const s = t.valid ? transposeSym(t.sym, n, flat) : t.sym;
    const pos = Math.max(t.pos, out.length ? out.length + 1 : 0);
    out += ' '.repeat(pos - out.length) + s;
  }
  return out;
}
function transposeSong(song, n) {
  const k = parseKey(song.key);
  song.key = keyNameFor(k.tonic + n, k.minor);
  const flat = parseKey(song.key).flat;
  song.sections.forEach(sec => sec.lines.forEach(l => { l.chords = transposeLine(l.chords, n, flat); }));
  song.progression = song.progression.map(s => transposeSym(s, n, flat));
  song.voicings = {};
}

function isChordLine(line) {
  const t = chordTokens(line);
  return t.length > 0 && t.every(x => x.valid || x.sym === '|' || /^N\.?C\.?$/i.test(x.sym));
}
function linesToRaw(lines) {
  const out = [];
  lines.forEach(l => {
    if (l.chords.trim()) out.push(l.chords.replace(/\s+$/, ''));
    if (l.lyrics.trim() || !l.chords.trim()) out.push(l.lyrics);
  });
  return out.join('\n');
}
function rawToLines(text) {
  const rows = String(text).replace(/\r/g, '').split('\n');
  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (isChordLine(r)) {
      const nxt = rows[i + 1];
      if (nxt !== undefined && nxt.trim() && !isChordLine(nxt)) { lines.push({ chords:r.replace(/\s+$/, ''), lyrics:nxt }); i++; }
      else lines.push({ chords:r.replace(/\s+$/, ''), lyrics:'' });
    } else if (r.trim()) lines.push({ chords:'', lyrics:r });
  }
  return lines;
}
function typeFromTitle(t) {
  t = t.toLowerCase();
  if (t.includes('pre') && t.includes('chorus')) return 'prechorus';
  for (const k of ['chorus','bridge','solo','intro','outro']) if (t.includes(k)) return k;
  if (t.includes('instrumental')) return 'solo';
  return 'verse';
}
/** Parse a plain chord sheet ("[Verse 1]" headers, chords above lyrics). */
function parseSheetText(text) {
  const rows = String(text).replace(/\r/g, '').split('\n');
  const meta = {}, sections = [];
  let cur = null, buf = [];
  const flush = () => { if (cur) { cur.lines = rawToLines(buf.join('\n')); sections.push(cur); } buf = []; };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (/^TAB\b/.test(r)) break;
    if (/^\s*\{.*\}\s*$/.test(r)) continue;   // riff placement notes from our own export
    const h = /^\s*\[(.+?)\]\s*(?:[x×](\d+))?\s*$/i.exec(r);
    if (h) { flush(); cur = { type:typeFromTitle(h[1]), title:'[' + h[1] + ']', repeat:+h[2] || 1 }; continue; }
    if (!cur) {
      const km = /key:\s*([A-G][#b♯♭]?m?)\b/i.exec(r); if (km) meta.key = km[1].replace('♯', '#').replace('♭', 'b');
      const tm = /(\d{2,3})\s*bpm/i.exec(r); if (tm) meta.tempo = +tm[1];
      const cm = /capo\s*(\d+)/i.exec(r); if (cm) meta.capo = +cm[1];
      if (!meta.title && r.trim() && !km && !tm) { const [t, a] = r.split(/\s+[—–-]\s+/); meta.title = t.trim(); if (a) meta.artist = a.trim(); }
      continue;
    }
    buf.push(r);
  }
  flush();
  return { ...meta, sections };
}

function tabCellText(n) {
  if (!n) return '';
  const f = String(n.f);
  switch (n.t) {
    case 'h': return 'h' + f;
    case 'p': return 'p' + f;
    case '/': return '/' + f;
    case '\\': return '\\' + f;
    case 'b': return f + 'b';
    case '~': return f + '~';
    default: return f;
  }
}
/** ASCII tab plus the character column where each step's note starts (for the play dot). */
function tabAsciiLayout(tab, tuning) {
  const rows = [5,4,3,2,1,0].map(s => {
    const n = noteName(tuning[s], false);
    return { s, label:(s === 5 ? n.toLowerCase() : n).padEnd(2, ' '), out:'' };
  });
  const cols = [];
  for (let c = 0; c < tab.steps; c++) {
    if (c % 8 === 0) rows.forEach(r => { r.out += '|'; });
    const cells = rows.map(r => tabCellText(tab.notes[c + ':' + r.s]));
    const w = Math.max(1, ...cells.map(x => x.length));
    cols.push(2 + rows[0].out.length + 1 + (w - 1) / 2);   // centre of this step's cell
    rows.forEach((r, i) => { r.out += '-' + cells[i].padEnd(w, '-'); });
  }
  rows.forEach(r => { r.out += '-|'; });
  cols.push(2 + rows[0].out.length - 1);                    // end of the last bar
  return { text: rows.map(r => r.label + r.out).join('\n'), cols };
}
function tabToAscii(tab, tuning) { return tabAsciiLayout(tab, tuning).text; }
const PLACE_LABEL = { over:'Over the part', lead:'Lead-in', fill:'Fill' };
const KIND_LABEL = { riff:'Riff', lick:'Lick', solo:'Solo', custom:'Tab' };
function riffBars(r) { return r.steps / 8; }
function songToText(song) {
  const tun = TUNINGS[song.tuning] || TUNINGS.standard;
  const byId = new Map(song.riffs.map(r => [r.id, r]));
  const head = [song.title + (song.artist ? ' — ' + song.artist : ''),
    `Key: ${song.key} · Capo ${song.capo} · ${song.tempo} BPM · ${tun.name}`, ''];
  const body = song.sections.map(sec => {
    const att = (sec.riffs || []).filter(a => byId.has(a.id)).map(a => `{${PLACE_LABEL[a.place]}: ${byId.get(a.id).name}${a.every ? '' : ' (first time only)'}}`);
    return sec.title + (sec.repeat > 1 ? ' x' + sec.repeat : '') + '\n' + (att.length ? att.join('\n') + '\n' : '') + linesToRaw(sec.lines);
  }).join('\n\n');
  let txt = head.join('\n') + '\n' + body + '\n';
  song.riffs.filter(r => Object.keys(r.notes).length).forEach(r => {
    txt += `\nTAB — ${r.name} (${KIND_LABEL[r.kind] || 'Tab'}, ${riffBars(r)} bars)\n` + tabToAscii(r, tun.midi) + '\n';
  });
  return txt;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const newRiffId = () => 'r' + Math.random().toString(36).slice(2, 8);
/** Clean one riff/tab object from any saved shape. */
function normalizeRiff(tab, fallbackName) {
  tab = tab || {};
  const notes = {};
  const addNote = (c, s, f, t) => {
    if (!(c >= 0 && s >= 0 && s < 6)) return;
    notes[c + ':' + s] = { f: f === 'x' ? 'x' : clamp(Math.round(+f || 0), 0, 24), t: ['h','p','b','/','\\','~'].includes(t) ? t : '' };
  };
  if (Array.isArray(tab.notes)) tab.notes.forEach(n => n && addNote(+n.c, +n.s, n.f, n.t));
  else if (tab.notes && typeof tab.notes === 'object') Object.entries(tab.notes).forEach(([k, v]) => { const [c, s] = k.split(':').map(Number); addNote(c, s, v.f, v.t); });
  const steps = clamp(Math.ceil((+tab.steps || 16) / 8) * 8, 8, 128);
  for (const k of Object.keys(notes)) if (+k.split(':')[0] >= steps) delete notes[k];
  const name = String(tab.name || fallbackName || 'Riff');
  const kind = ['riff','lick','solo','custom'].includes(tab.kind) ? tab.kind : /solo/i.test(name) ? 'solo' : /lick/i.test(name) ? 'lick' : /riff/i.test(name) ? 'riff' : 'custom';
  return {
    id: /^[\w-]{1,24}$/.test(tab.id || '') ? tab.id : newRiffId(),
    name, kind, from: String(tab.from || ''), steps, notes,
    backing: (Array.isArray(tab.backing) ? tab.backing : []).filter(b => b && parseChord(b.sym) && +b.beats > 0).map(b => ({ sym:b.sym, beats:Math.round(+b.beats) })),
  };
}
function normalizeSong(raw) {
  raw = raw || {};
  let riffs = (Array.isArray(raw.riffs) ? raw.riffs : []).map((r, i) => normalizeRiff(r, 'Riff ' + (i + 1)));
  if (!riffs.length) riffs = [normalizeRiff(raw.tab, 'Riff')];   // older single-tab songs
  const seen = new Set();
  riffs.forEach(r => { while (seen.has(r.id)) r.id = newRiffId(); seen.add(r.id); });
  const active = riffs.find(r => r.id === raw.activeRiff) || riffs[0];
  return {
    id: String(raw.id || 'song-' + Date.now().toString(36)),
    title: String(raw.title || 'Untitled song'),
    artist: String(raw.artist || ''),
    key: /^[A-G][#b]?m?$/.test(raw.key || '') ? raw.key : 'C',
    capo: clamp(+raw.capo || 0, 0, 12),
    tempo: clamp(+raw.tempo || 90, 40, 240),
    tuning: TUNINGS[raw.tuning] ? raw.tuning : 'standard',
    strum: raw.strum || 'ballad',
    sections: (Array.isArray(raw.sections) ? raw.sections : []).map(sec => ({
      type: SECTION_TYPES.includes(sec.type) ? sec.type : typeFromTitle(String(sec.title || sec.type || 'verse')),
      title: String(sec.title || '[' + (TYPE_LABEL[sec.type] || 'Verse') + ']'),
      repeat: clamp(+sec.repeat || 1, 1, 8),
      lines: (Array.isArray(sec.lines) ? sec.lines : []).map(l => ({ chords:String(l.chords || ''), lyrics:String(l.lyrics || '') })),
      riffs: (Array.isArray(sec.riffs) ? sec.riffs : []).filter(a => a && seen.has(a.id))
        .map(a => ({ id:a.id, place: PLACE_LABEL[a.place] ? a.place : 'over', every: a.every !== false })),
    })),
    riffs,
    activeRiff: active.id,
    tab: active,                      // the riff open in the Tab editor (same object as in riffs)
    progression: (Array.isArray(raw.progression) ? raw.progression : []).filter(s => parseChord(s)).slice(0, 32),
    voicings: raw.voicings && typeof raw.voicings === 'object' ? { ...raw.voicings } : {},
  };
}
function serializeRiff(r) {
  return { id:r.id, name:r.name, kind:r.kind, from:r.from, steps:r.steps,
    notes: Object.entries(r.notes).map(([k, v]) => { const [c, s] = k.split(':').map(Number); return v.t ? { c, s, f:v.f, t:v.t } : { c, s, f:v.f }; })
      .sort((a, b) => a.c - b.c || b.s - a.s),
    backing: r.backing || [] };
}
function serializeSong(song) {
  const { tab, ...rest } = song;
  return { ...rest, activeRiff: tab.id, riffs: song.riffs.map(serializeRiff) };
}

/**
 * Where attached riffs fall in a song timeline.
 * Returns { offset, items:[{riff, si, rep, place, idx, start, end}] } in beats.
 * offset > 0 means a lead-in starts before the first chord, so the song is shifted later.
 */
function riffSchedule(song, events) {
  const spans = new Map();
  events.forEach(e => {
    const k = e.si + ':' + e.rep, sp = spans.get(k);
    if (!sp) spans.set(k, { si:e.si, rep:e.rep, start:e.beat, end:e.beat + e.beats });
    else sp.end = Math.max(sp.end, e.beat + e.beats);
  });
  const byId = new Map(song.riffs.map(r => [r.id, r]));
  const items = [];
  for (const sp of spans.values()) {
    (song.sections[sp.si].riffs || []).forEach((a, idx) => {
      const riff = byId.get(a.id);
      if (!riff || !Object.keys(riff.notes).length || (!a.every && sp.rep > 0)) return;
      const len = riff.steps / 2;
      if (a.place === 'over') {
        for (let st = sp.start; st < sp.end; st += len) items.push({ riff, si:sp.si, rep:sp.rep, place:a.place, idx, start:st, end:Math.min(st + len, sp.end) });
      } else if (a.place === 'lead') items.push({ riff, si:sp.si, rep:sp.rep, place:a.place, idx, start:sp.start - len, end:sp.start });
      else items.push({ riff, si:sp.si, rep:sp.rep, place:a.place, idx, start:Math.max(sp.start, sp.end - len), end:sp.end });
    });
  }
  const minStart = Math.min(0, ...items.map(i => i.start));
  const offset = Math.ceil(-minStart / 4) * 4;            // keep bars aligned
  items.forEach(i => { i.start += offset; i.end += offset; });
  return { offset, items: items.sort((a, b) => a.start - b.start) };
}
