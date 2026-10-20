/* ================================================================
   playback wiring
   ================================================================ */
function setActive(ev) {
  document.querySelectorAll('.ch.playing, .ln.playing, .arr-chip.playing, .mini.playing').forEach(e => e.classList.remove('playing'));
  if (!ev) return;
  const ln = document.querySelector(`.ln[data-lk="${ev.si}-${ev.li}"]`);
  if (ln) { ln.classList.add('playing'); followLine(ln); }
  const ch = document.querySelector(`.ch[data-k="${ev.si}-${ev.li}-${ev.ti}"]`);
  if (ch) ch.classList.add('playing');
  const chip = document.querySelector(`.arr-chip[data-si="${ev.si}"]`);
  if (chip) chip.classList.add('playing');
  document.querySelectorAll('.mini').forEach(m => m.classList.toggle('playing', m.dataset.chord === ev.sym));
  setNow(ev.sym, song.sections[ev.si] ? song.sections[ev.si].title.replace(/^\[|\]$/g, '') : '');
}
/** Keep the playing line in the upper part of the view, so the next lines are visible below it. */
function followLine(ln) {
  if (!ui.follow) return;
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const r = ln.getBoundingClientRect();
  const box = ln.closest('.fwin-b');
  if (box) {
    const b = box.getBoundingClientRect();
    if (r.top < b.top + 30 || r.bottom > b.top + b.height * 0.7) box.scrollTo({ top: box.scrollTop + r.top - b.top - b.height * 0.25, behavior });
    return;
  }
  const dockH = $('.dock').offsetHeight;
  const stripH = ui.floatStrip ? $('#stripWrap').offsetHeight : 0;
  const topEdge = dockH + stripH + 16;
  if (r.top < topEdge || r.bottom > innerHeight * 0.7) window.scrollTo({ top: scrollY + r.top - topEdge - (innerHeight - topEdge) * 0.15, behavior });
}
let metroPulseT = 0;
function pulseMetro(accent) {
  const b = $('#metroBtn');
  b.classList.remove('tick', 'tick-a'); void b.offsetWidth;
  b.classList.add(accent ? 'tick-a' : 'tick');
  clearTimeout(metroPulseT); metroPulseT = setTimeout(() => b.classList.remove('tick', 'tick-a'), 120);
}
function setNow(sym, sub) {
  $('#nowCh').textContent = sym ? pretty(sym) : '—';
  $('#nowSub').textContent = sub;
}
function playChordStep(sym, k, t, change, level = 1) {
  const v = voicingFor(sym); const m = midisFor(v);
  if (!m.length) return;
  const ch = STRUMS[song.strum].p[k % 8];
  if (ch === 'A') {
    const n = m.length;
    const order = [0, n - 3, n - 2, n - 1, n - 2, n - 3, n - 2, n - 1].map(i => clamp(i, 0, n - 1));
    const idx = change ? 0 : order[k % 8];
    AudioEngine.pluck(m[idx], t, { gain: (idx === 0 ? 0.5 : 0.36) * level, dur: 1.5 });
    return;
  }
  if ((ch === '-' || ch === 'W') && !change) return;
  const dir = ch === 'U' && !change ? 'up' : 'down';
  const accent = change || k % 8 === 0;
  AudioEngine.strum(m, t, { dir, gain: (accent ? 0.55 : dir === 'up' ? 0.3 : 0.42) * level, dur: 60 / song.tempo * 1.8 });
}
/**
 * Play chord events, plus any scheduled riffs (items from riffSchedule).
 * Chords drop to the "chords under riffs" level while a riff is sounding.
 */
function playEvents(events, totalBeats, tag, vis, riffItems = []) {
  const steps = Math.ceil(totalBeats * 2);
  const stepEv = new Int32Array(steps).fill(-1);
  events.forEach((e, i) => { for (let k = e.beat * 2; k < (e.beat + e.beats) * 2 && k < steps; k++) stepEv[k] = i; });
  const riffNotes = new Map(), duck = new Uint8Array(steps), tagAt = new Array(steps).fill(null);
  riffItems.forEach(it => {
    const s0 = Math.round(it.start * 2), s1 = Math.min(steps, Math.round(it.end * 2));
    for (let k = s0; k < s1; k++) {
      duck[k] = 1; tagAt[k] = it.si + ':' + it.idx;
      const c = k - s0;
      for (let s = 0; s < 6; s++) if (it.riff.notes[c + ':' + s]) {
        if (!riffNotes.has(k)) riffNotes.set(k, []);
        riffNotes.get(k).push({ riff:it.riff, c, s });
      }
    }
  });
  const ringing = new Array(6).fill(null);
  let last = null, lastTag = null;
  ui.playing = tag;
  ui.riffQueue = riffItems;
  if (events.length && events[0].beat > 0) renderNowNext(nnAt(events, 0, false), true);   // lead-in: show what's coming
  Player.start({
    steps,
    frameFn: pos => {
      const it = riffItems.find(i => pos >= i.start * 2 - 1 && pos < i.end * 2);
      if (it) placePlayDots(it.riff, pos - it.start * 2, it.si + ':' + it.idx); else hidePlayDots();
    },
    stepFn: (k, t) => {
      if (ui.metro && k % 2 === 0) AudioEngine.click(t, k % 8 === 0);
      const e = stepEv[k] >= 0 ? events[stepEv[k]] : null;
      if (e && e.sym) playChordStep(e.sym, k, t, k === e.beat * 2, duck[k] ? prefs.duck / 100 : 1);
      const rn = riffNotes.get(k);
      if (rn) rn.forEach(n => { AudioEngine.release(ringing[n.s], t); ringing[n.s] = playTabNoteAt(n.c, n.s, t, n.riff); });
    },
    visFn: k => {
      if (ui.metro && k % 2 === 0) pulseMetro(k % 8 === 0);
      const i = stepEv[k], e = i >= 0 ? events[i] : null;
      if (e && e !== last) { last = e; vis(e); renderNowNext(nnAt(events, i, ui.loop), true); }
      if (tagAt[k] !== lastTag) {
        lastTag = tagAt[k];
        document.querySelectorAll('.rtag.playing').forEach(x => x.classList.remove('playing'));
        if (lastTag) document.querySelectorAll(`.rtag[data-tag="${lastTag}"]`).forEach(x => x.classList.add('playing'));
      }
      if (!e && !last) setNow(null, 'Lead-in');
      updateNowNextClock(k / 2);
    },
  });
  syncTransport();
}
function playSong(only = null) {
  const tag = only == null ? 'song' : 'sec:' + only;
  if (Player.playing) { const was = ui.playing; Player.stop(); if (was === tag) return; }
  const tl = buildTimeline(song, only);
  if (!tl.events.length) { toast('There are no chords to play yet.'); return; }
  const sched = ui.riffsOn ? riffSchedule(song, tl.events) : { offset:0, items:[] };
  const events = tl.events.map(e => ({ ...e, beat:e.beat + sched.offset }));
  const total = Math.max(tl.totalBeats + sched.offset, ...sched.items.map(i => i.end));
  playEvents(events, total, tag, setActive, sched.items);
}
function playPad() {
  if (Player.playing) { const was = ui.playing; Player.stop(); if (was === 'pad') return; }
  const events = song.progression.map((sym, i) => ({ beat:i * 4, beats:4, sym, pi:i }));
  if (!events.length) return;
  playEvents(events, events.length * 4, 'pad', e => {
    document.querySelectorAll('.pchip.playing').forEach(x => x.classList.remove('playing'));
    const el = document.querySelector(`.pchip[data-pi="${e.pi}"]`); if (el) el.classList.add('playing');
    setNow(e.sym, 'Progression');
  });
}
function playTab(riff = song.tab) {
  const tag = riff === song.tab ? 'tab' : 'riff:' + riff.id;
  if (Player.playing) { const was = ui.playing; Player.stop(); if (was === tag) return; }
  if (!Object.keys(riff.notes).length) { toast(riff === song.tab ? 'The tab is empty. Tap the neck or type frets to add notes.' : 'That riff has no notes yet.'); return; }
  ui.playing = tag;
  const ringing = new Array(6).fill(null);
  const backAt = new Map();
  if ($('#backingChk').checked && riff.backing && riff.backing.length) {
    let acc = 0;
    riff.backing.forEach(b => { for (let bt = acc; bt < acc + b.beats; bt++) if (bt === acc || bt % 4 === 0) backAt.set(bt * 2, b.sym); acc += b.beats; });
  }
  const level = prefs.duck / 100;
  const editing = riff === song.tab;
  Player.start({
    steps: riff.steps,
    frameFn: pos => placePlayDots(riff, pos, null),
    stepFn: (k, t) => {
      if (ui.metro && k % 2 === 0) AudioEngine.click(t, k % 8 === 0);
      if (backAt.has(k)) AudioEngine.strum(midisFor(voicingFor(backAt.get(k))), t, { gain:0.5 * level, dur:60 / song.tempo * 3.6, spread:0.02 });
      for (let s = 0; s < 6; s++) {
        if (!riff.notes[k + ':' + s]) continue;
        AudioEngine.release(ringing[s], t);
        ringing[s] = playTabNoteAt(k, s, t, riff);
      }
    },
    visFn: k => {
      if (ui.metro && k % 2 === 0) pulseMetro(k % 8 === 0);
      if (editing) {
        document.querySelectorAll('.tc.playcol').forEach(e => e.classList.remove('playcol'));
        document.querySelectorAll(`.tc[data-c="${k}"]`).forEach(e => e.classList.add('playcol'));
      }
      setNow(riff.name, `Riff · bar ${Math.floor(k / 8) + 1}`);
    },
  });
  syncTransport();
}
function onTransportStop() {
  ui.playing = null;
  setActive(null);
  document.querySelectorAll('.tc.playcol, .pchip.playing, .rtag.playing').forEach(e => e.classList.remove('playcol', 'playing'));
  ui.riffQueue = [];
  setNow(null, 'Ready');
  renderNowNext(nnFromSelection(), false);
  syncTransport();
}
function syncTransport() {
  const p = ui.playing === 'song';
  $('#playBtn').innerHTML = p ? ICON.stop + ' Stop' : ICON.play + ' Play song';
  $('#playBtn').classList.toggle('on', p);
  $('#tabPlay').innerHTML = ui.playing === 'tab' ? ICON.stop + ' Stop' : ICON.play + ' Play tab';
  document.querySelectorAll('[data-rplay]').forEach(b => { b.innerHTML = ui.playing === 'riff:' + b.dataset.rplay || (ui.playing === 'tab' && song.tab.id === b.dataset.rplay) ? ICON.stop : ICON.play; });
  document.querySelectorAll('.sec [data-act="play"]').forEach(b => { b.innerHTML = ui.playing === 'sec:' + b.closest('.sec').dataset.si ? ICON.stop : ICON.play; });
  const pb = document.querySelector('[data-act="padplay"]');
  if (pb) pb.innerHTML = ui.playing === 'pad' ? ICON.stop + ' Stop' : ICON.play + ' Play';
}
