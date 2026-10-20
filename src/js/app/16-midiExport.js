/* ================================================================
   midiExport.js — the song (or one riff) as MIDI
   Mirrors what playback does: same strum pattern, voicings, riff
   placement and lead-in offset, so the file sounds like the app.
   ================================================================ */
const MIDI_CH = { chords:0, riffs:1, click:9 };
const MIDI_PROGRAM = { chords:25, riffs:25 };          // GM 26 "Acoustic Guitar (steel)", zero-based
const RIFF_BEND_RANGE = 12;                            // semitones, so slides of up to an octave fit
let midiOpts = Object.assign({ chords:true, riffs:true, click:false, markers:true, lyrics:true, capo:true, output:'multi' }, prefs.midi || {});
function saveMidiOpts() { prefs.midi = midiOpts; savePrefs(); }

const ticksPerSec = () => MIDI_PPQ * song.tempo / 60;
const stepTick = k => k * MIDI_PPQ / 2;
const midiPitch = (s, f, o) => tuning()[s] + f + (o.capo ? song.capo : 0);
function voicingPitches(sym, o) {
  const v = voicingFor(sym);
  return v ? v.frets.map((f, s) => f >= 0 ? midiPitch(s, f, o) : null).filter(x => x != null) : [];
}

/**
 * Note lists for a timeline.
 * events: chord events {beat, beats, sym, si?, li?}; items: riffSchedule-style placements.
 * Returns { chords, riffs, riffExtra, click, conductor, totalBeats }.
 */
function midiFromTimeline(events, totalBeats, items, o, meta) {
  const steps = Math.ceil(totalBeats * 2), T = ticksPerSec(), sec = s => Math.round(s * T);
  const out = { chords:[], riffs:[], riffExtra:[], click:[], conductor:[], totalBeats };

  // conductor: name, tempo, metre, key, part markers, lyrics
  out.conductor.push(midiMeta(0, 0x03, utf8(pdfSafe(meta.title))), midiTempo(0, song.tempo), midiMeta(0, 0x58, [4, 2, 24, 8]), midiKeySig(0, parseKey(song.key)));
  if (meta.markers || meta.lyrics) {
    const seenSec = new Set(), seenLine = new Set();
    events.forEach(e => {
      if (e.si == null) return;
      const sk = e.si + ':' + e.rep, lk = sk + ':' + e.li;
      if (meta.markers && !seenSec.has(sk)) {
        seenSec.add(sk);
        const s = song.sections[e.si];
        out.conductor.push(midiMeta(stepTick(e.beat * 2), 0x06, utf8(pdfSafe(secName(s) + (s.repeat > 1 ? ` (${e.rep + 1}/${s.repeat})` : '')))));
      }
      if (meta.lyrics && !seenLine.has(lk)) {
        seenLine.add(lk);
        const ly = (song.sections[e.si].lines[e.li] || {}).lyrics || '';
        if (ly.trim()) out.conductor.push(midiMeta(stepTick(e.beat * 2), 0x05, utf8(ly.trim() + ' ')));
      }
    });
  }

  // chords: the strum pattern, quieter while a riff plays (same as playback)
  if (o.chords) {
    const stepEv = new Int32Array(steps).fill(-1);
    events.forEach((e, i) => { for (let k = e.beat * 2; k < (e.beat + e.beats) * 2 && k < steps; k++) stepEv[k] = i; });
    const duck = new Uint8Array(steps);
    items.forEach(it => { for (let k = Math.round(it.start * 2); k < Math.min(steps, Math.round(it.end * 2)); k++) duck[k] = 1; });
    const pat = STRUMS[song.strum].p, ring = Math.round(MIDI_PPQ * 1.8);
    for (let k = 0; k < steps; k++) {
      const i = stepEv[k]; if (i < 0) continue;
      const e = events[i], m = voicingPitches(e.sym, o); if (!m.length) continue;
      const change = k === e.beat * 2, ch = pat[k % 8], t0 = stepTick(k);
      const lvl = duck[k] ? Math.max(0.35, prefs.duck / 100) : 1;
      if (ch === 'A') {
        const n = m.length, order = [0, n - 3, n - 2, n - 1, n - 2, n - 3, n - 2, n - 1].map(x => clamp(x, 0, n - 1));
        const idx = change ? 0 : order[k % 8];
        out.chords.push({ t:t0, dur:Math.round(MIDI_PPQ * 1.5), ch:MIDI_CH.chords, key:m[idx], vel:(idx === 0 ? 92 : 72) * lvl });
        continue;
      }
      if ((ch === '-' || ch === 'W') && !change) continue;
      const dir = ch === 'U' && !change ? 'up' : 'down', accent = change || k % 8 === 0;
      const list = dir === 'up' ? m.slice(-4).reverse() : m;
      const vel = (accent ? 100 : dir === 'up' ? 66 : 84) * lvl, spread = sec(dir === 'up' ? 0.0096 : 0.016);
      list.forEach((p, j) => out.chords.push({ t:t0 + j * spread, dur:ring, ch:MIDI_CH.chords, key:p, vel:vel * (1 - j * 0.04) }));
    }
  }

  // riffs: notes plus pitch bends for bends, slides and vibrato
  if (o.riffs && items.length) {
    const ch = MIDI_CH.riffs;
    out.riffExtra.push(  // pitch-bend range = 12 semitones (RPN 0), then close the RPN
      { t:0, o:-0.5, d:[0xB0 | ch, 101, 0] }, { t:0, o:-0.5, d:[0xB0 | ch, 100, 0] }, { t:0, o:-0.5, d:[0xB0 | ch, 6, RIFF_BEND_RANGE] },
      { t:0, o:-0.5, d:[0xB0 | ch, 38, 0] }, { t:0, o:-0.5, d:[0xB0 | ch, 101, 127] }, { t:0, o:-0.5, d:[0xB0 | ch, 100, 127] });
    let bent = false;
    const bend = (t, semis) => { out.riffExtra.push(midiBend(t, ch, semis, RIFF_BEND_RANGE)); bent = semis !== 0; };
    items.forEach(it => {
      const r = it.riff, s0 = Math.round(it.start * 2), s1 = Math.round(it.end * 2);
      for (let c = 0; c < r.steps && s0 + c < s1; c++) for (let s = 0; s < 6; s++) {
        const n = r.notes[c + ':' + s]; if (!n) continue;
        const t = stepTick(s0 + c);
        let next = null;
        for (let c2 = c + 1; c2 < r.steps && s0 + c2 < s1; c2++) if (r.notes[c2 + ':' + s]) { next = c2; break; }
        const dur = next != null ? (next - c) * MIDI_PPQ / 2 : Math.round(MIDI_PPQ * 2.2);
        if (n.f === 'x') { out.riffs.push({ t, dur:sec(0.05), ch, key:midiPitch(s, 5, o), vel:48 }); continue; }
        const key = midiPitch(s, n.f, o);
        if (bent) bend(t, 0);
        out.riffs.push({ t, dur, ch, key, vel: n.t === 'h' || n.t === 'p' ? 62 : 96 });
        if (n.t === 'b') {
          for (let j = 1; j <= 6; j++) bend(t + sec(0.06 + 0.18 * j / 6), 2 * j / 6);
          bend(t + dur - 2, 0);
        } else if (n.t === '/' || n.t === '\\') {
          let from = null;
          for (let c2 = c - 1; c2 >= 0; c2--) { const pn = r.notes[c2 + ':' + s]; if (pn && pn.f !== 'x') { from = midiPitch(s, pn.f, o); break; } }
          if (from == null) from = key + (n.t === '/' ? -2 : 2);
          const d = clamp(from - key, -RIFF_BEND_RANGE, RIFF_BEND_RANGE);
          for (let j = 0; j <= 5; j++) bend(t + sec(0.09 * j / 5), d * (1 - j / 5));
        } else if (n.t === '~') {
          let up = true;
          for (let tt = t + sec(0.15); tt < t + dur - sec(0.05); tt += sec(0.045), up = !up) bend(tt, up ? 0.2 : -0.2);
          bend(t + dur - 2, 0);
        }
      }
    });
  }

  // click: woodblock on the drum channel, accent on beat 1
  if (o.click) for (let b = 0; b < Math.ceil(totalBeats); b++) out.click.push({ t:stepTick(b * 2), dur:60, ch:MIDI_CH.click, key: b % 4 === 0 ? 76 : 77, vel: b % 4 === 0 ? 110 : 80 });
  return out;
}
const pdfSafe = s => String(s || '').replace(/♯/g, '#').replace(/♭/g, 'b');

/** The selected tracks as {name, events} lists. */
function midiTracks(parts, o) {
  const tracks = [];
  const named = (name, ch, program, notes, extra = []) => {
    const ev = [midiMeta(0, 0x03, utf8(name))];
    if (program != null) ev.push({ t:0, o:-0.5, d:[0xC0 | ch, program] });
    return { name, events: ev.concat(extra, notesToEvents(notes)) };
  };
  if (o.chords && parts.chords.length) tracks.push(named('Chords', MIDI_CH.chords, MIDI_PROGRAM.chords, parts.chords));
  if (o.riffs && parts.riffs.length) tracks.push(named('Riffs', MIDI_CH.riffs, MIDI_PROGRAM.riffs, parts.riffs, parts.riffExtra));
  if (o.click && parts.click.length) tracks.push(named('Click', MIDI_CH.click, null, parts.click));
  return tracks;
}
/** Build the file(s) for the chosen output: one multi-track file, one merged track, or one file per track. */
function midiOutputs(parts, o, baseName) {
  const tracks = midiTracks(parts, o);
  if (!tracks.length) return [];
  if (o.output === 'single') {
    const all = parts.conductor.concat(...tracks.map(t => t.events.filter(e => !(e.d[0] === 0xFF && e.d[1] === 0x03))));
    return [{ name: baseName + '.mid', data: encodeMidiFile(0, [encodeMidiTrack(all)]) }];
  }
  if (o.output === 'separate') {
    return tracks.map(t => ({ name: `${baseName} - ${t.name}.mid`, data: encodeMidiFile(1, [encodeMidiTrack(parts.conductor), encodeMidiTrack(t.events)]) }));
  }
  return [{ name: baseName + '.mid', data: encodeMidiFile(1, [encodeMidiTrack(parts.conductor), ...tracks.map(t => encodeMidiTrack(t.events))]) }];
}
function songMidiParts(o) {
  const tl = buildTimeline(song);
  const sched = o.riffs ? riffSchedule(song, tl.events) : { offset:0, items:[] };
  const events = tl.events.map(e => ({ ...e, beat:e.beat + sched.offset }));
  const total = Math.max(tl.totalBeats + sched.offset, ...sched.items.map(i => i.end), 1);
  return midiFromTimeline(events, total, sched.items, o, { title:song.title, markers:o.markers, lyrics:o.lyrics });
}
function riffMidiParts(riff, o, withChords) {
  let acc = 0;
  const events = withChords ? (riff.backing || []).map(b => { const e = { beat:acc, beats:b.beats, sym:b.sym }; acc += b.beats; return e; }) : [];
  const items = [{ riff, start:0, end:riff.steps / 2, si:null, idx:0, place:'over' }];
  return midiFromTimeline(events, riff.steps / 2, items, { ...o, chords:withChords && events.length > 0, riffs:true }, { title:riff.name, markers:false, lyrics:false });
}
/** Save: a lone .mid when possible; a .zip for several files, or inside the Claude viewer (which can't save .mid). */
async function saveMidiFiles(files, baseName) {
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');
  if (files.length === 1 && !inClaude) return { how: await saveFile(files[0].name, files[0].data, 'audio/midi'), zipped:false };
  const zip = zipStore(files.map(f => ({ name:f.name.replace(/[\\/:*?"<>|]+/g, ''), data:f.data })));
  return { how: await saveFile(baseName + ' MIDI.zip', zip, 'application/zip'), zipped:true };
}

/* ---------- UI: Import / Export → MIDI tab ---------- */
function midiTabHTML() {
  const o = midiOpts;
  const tl = buildTimeline(song);
  const placed = song.sections.reduce((a, s) => a + (s.riffs || []).length, 0);
  const tog = (k, label, sub, dis) => `<label class="pdf-tog${dis ? ' off' : ''}"><input type="checkbox" data-mo="${k}" id="mo-${k}"${o[k] ? ' checked' : ''}${dis ? ' disabled' : ''}><span><b>${label}</b><small>${sub}</small></span></label>`;
  const radio = (k, v, label, sub) => `<label class="pdf-tog"><input type="radio" name="mo-${k}" data-mr="${k}" value="${v}" id="mr-${k}-${v}"${o[k] === v ? ' checked' : ''}><span><b>${label}</b><small>${sub}</small></span></label>`;
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');
  return `<div class="midi-grid">
    <div>
      <h3 class="po-h">Tracks</h3>
      <div class="pdf-togs">
        ${tog('chords', 'Chords', `Strummed with “${STRUMS[song.strum].name}” and your chosen shapes`)}
        ${tog('riffs', 'Riffs', placed ? `${placed} placed in the song, with bends and slides` : 'No riffs are placed in the song yet', !placed)}
        ${tog('click', 'Click track', 'Woodblock on every beat, drum channel')}
      </div>
      <h3 class="po-h">Song info</h3>
      <div class="pdf-togs">
        ${tog('markers', 'Part markers', 'Verse, Chorus… shown in your DAW timeline')}
        ${tog('lyrics', 'Lyrics', 'As lyric events, shown karaoke-style by some players')}
        ${tog('capo', 'Sounding pitch', song.capo ? `Includes capo ${song.capo}; off writes the chord shapes' pitch` : 'Applies the capo when there is one')}
      </div>
    </div>
    <div>
      <h3 class="po-h">Save as</h3>
      <div class="pdf-togs">
        ${radio('output', 'multi', 'One file, separate tracks', 'Each part on its own track (best for a DAW)')}
        ${radio('output', 'single', 'One file, a single track', 'Everything merged into one track')}
        ${radio('output', 'separate', 'Separate files', 'One file per track, together in a .zip')}
      </div>
      <p class="msg">${fmtTime(tl.totalBeats * 60 / song.tempo)} at ${song.tempo} BPM · ${esc(TUNINGS[song.tuning].name)}</p>
      ${inClaude ? '<p class="hint">Inside Claude, MIDI files are saved in a .zip (the viewer can’t save .mid directly). The GitHub Pages version saves a plain .mid.</p>' : ''}
      <div class="ed-acts"><button class="btn primary" id="midiSave">Save MIDI</button></div>
      <p class="msg" id="midiMsg"></p>
    </div>
  </div>`;
}
async function doSaveMidi() {
  const o = midiOpts, base = safeName(song.title);
  const files = midiOutputs(songMidiParts(o), o, base);
  if (!files.length) { $('#midiMsg').textContent = 'Choose at least one track to save.'; return; }
  try {
    const r = await saveMidiFiles(files, base);
    $('#midiMsg').textContent = (r.how === 'saved' ? 'Saved' : 'Downloaded') + (r.zipped ? ` a .zip with ${files.length} MIDI file${files.length > 1 ? 's' : ''}.` : '.');
  } catch (e) { $('#midiMsg').textContent = saveErrorText(e, 'MIDI file'); }
}
async function saveRiffMidi() {
  const r = song.tab;
  if (!Object.keys(r.notes).length) { toast('This riff has no notes yet.'); return; }
  const withChords = $('#backingChk').checked && (r.backing || []).length > 0;
  const parts = riffMidiParts(r, { ...midiOpts, click:false }, withChords);
  const files = midiOutputs(parts, { ...midiOpts, chords:withChords, riffs:true, click:false, output:'multi' }, safeName(r.name));
  try { const res = await saveMidiFiles(files, safeName(r.name)); toast(`${res.how === 'saved' ? 'Saved' : 'Downloaded'} “${r.name}” as MIDI${withChords ? ' with its chords' : ''}${res.zipped ? ' (in a .zip)' : ''}.`); }
  catch (e) { toast(saveErrorText(e, 'MIDI file')); }
}
function bindMidi() {
  const body = $('#mBody');
  body.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.mo) { midiOpts[t.dataset.mo] = t.checked; saveMidiOpts(); }
    if (t.dataset.mr) { midiOpts[t.dataset.mr] = t.value; saveMidiOpts(); }
  });
  body.addEventListener('click', e => { if (e.target.id === 'midiSave') doSaveMidi(); });
  $('#riffMidi').addEventListener('click', saveRiffMidi);
}
bindMidi();
