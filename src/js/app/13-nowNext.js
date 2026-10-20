/* ================================================================
   nowNext.js — current chord and the next change in the song
   ================================================================ */
let nnState = null;
const secName = sec => sec ? sec.title.replace(/^\[|\]$/g, '') : '';
const fmtBeats = n => n % 4 === 0 ? `${n / 4} bar${n === 4 ? '' : 's'}` : `${n} beat${n === 1 ? '' : 's'}`;
/** Chord run containing event i, and the next chord that differs from it. */
function nnAt(events, i, wrap) {
  const e = events[i];
  if (!e) return null;
  let s0 = i;
  while (s0 > 0 && events[s0 - 1].sym === e.sym && events[s0 - 1].si === e.si) s0--;
  let j = i + 1;
  while (j < events.length && events[j].sym === e.sym) j++;
  const end = j < events.length ? events[j].beat : events[j - 1].beat + events[j - 1].beats;
  let nx = events[j] || null, wrapped = false;
  if (!nx && wrap && events.length && events[0].sym !== e.sym) { nx = events[0]; wrapped = true; }
  return { sym:e.sym, ev:e, start:events[s0].beat, end, next:nx ? nx.sym : null, nextEv:nx, wrapped };
}
function nnFromSelection() {
  const { events } = buildTimeline(song);
  let i = ui.selK ? events.findIndex(e => `${e.si}-${e.li}-${e.ti}` === ui.selK) : -1;
  if (i < 0) i = events.findIndex(e => e.sym === ui.sel);
  if (i < 0) return { sym:ui.sel, next:null, loose:true };
  return nnAt(events, i, false);
}
function renderNowNext(st, playing) {
  const el = $('#nowNext');
  if (!el) return;
  nnState = st ? { ...st, playing } : null;
  if (!st || !parseChord(st.sym)) { el.innerHTML = '<p class="empty">Tap a chord on the song sheet.</p>'; return; }
  const key = parseKey(song.key), c = parseChord(st.sym), rn = romanFor(st.sym, key);
  const ev = st.ev, sec = ev && song.sections[ev.si];
  const where = !ev ? 'Not on the song sheet' : ev.pi != null ? `Progression · chord ${ev.pi + 1}` : sec ? `${secName(sec)} · line ${ev.li + 1}` : '';
  const lyric = ev && sec && sec.lines[ev.li] ? sec.lines[ev.li].lyrics : '';
  let when = '';
  if (st.nextEv && !playing) {
    const len = fmtBeats(st.end - st.start);
    when = st.nextEv.si !== ev.si && st.nextEv.pi == null ? `${secName(song.sections[st.nextEv.si])}, after ${len}` : `after ${len}`;
  }
  const nk = st.nextEv && st.nextEv.ti != null ? `${st.nextEv.si}-${st.nextEv.li}-${st.nextEv.ti}` : '';
  el.innerHTML = `<div class="nn-wrap">
    <div class="nn-now"><span class="nn-lab">${playing ? 'Now playing' : 'Selected'}</span>
      <div class="nn-row">${boxSVG(voicingFor(st.sym), c, 'lg')}<div><div class="nn-name">${esc(pretty(st.sym))}</div><div class="nn-num">${esc(rn.numeral)} · ${rn.fn}</div><div class="nn-where">${esc(where)}</div></div></div>
      <div class="nn-bar"${playing ? '' : ' hidden'}><i id="nnBar"></i></div></div>
    <div class="nn-next"><span class="nn-lab">Next${st.wrapped ? ' · from the top' : ''}</span>
      ${st.next ? `<button class="nn-row nn-nextbtn" data-nnext="${esc(st.next)}" data-nk="${nk}" ${playing ? 'tabindex="-1"' : ''} aria-label="Next chord ${esc(st.next)}${playing ? '' : '. Select it'}">
        ${boxSVG(voicingFor(st.next), parseChord(st.next), 'sm')}<div><div class="nn-name">${esc(pretty(st.next))}</div><div class="nn-when" id="nnWhen">${esc(when)}</div></div></button>`
      : `<p class="empty">${st.loose ? 'This chord isn’t on the song sheet yet.' : 'That’s the last chord of the song.'}</p>`}
    </div>
    ${lyric ? `<p class="nn-lyric">${esc(lyric)}</p>` : ''}
    ${nnRiffHTML(st, playing)}
  </div>
  ${playing ? '' : `<p class="hint">${st.next ? 'Tap Next to step through the song chord by chord.' : 'Tap a chord on the sheet to see what follows it.'}</p>`}`;
}
function nnRiffHTML(st, playing) {
  if (playing) return ui.riffQueue && ui.riffQueue.length ? `<p class="nn-riff" id="nnRiff"></p>` : '';
  const sec = st.ev && song.sections[st.ev.si];
  const list = sec ? (sec.riffs || []).map(a => riffById(a.id) ? `${PLACE_LABEL[a.place]}: ${esc(riffById(a.id).name)}` : '').filter(Boolean) : [];
  return list.length ? `<p class="nn-riff">Riffs in this part<br>${list.join('<br>')}</p>` : '';
}
/** Called every eighth note while playing: progress bar and countdown only. */
function updateNowNextClock(beat) {
  if (!nnState || !nnState.playing) return;
  const span = Math.max(0.5, nnState.end - nnState.start);
  const bar = document.getElementById('nnBar');
  if (bar) bar.style.width = clamp((beat - nnState.start + 0.5) / span * 100, 0, 100) + '%';
  const rl = document.getElementById('nnRiff');
  if (rl) {
    const q = ui.riffQueue || [];
    const now = q.find(i => i.start <= beat && beat < i.end), nx = q.find(i => i.start > beat);
    rl.innerHTML = now ? `<b>Riff now</b> ${esc(now.riff.name)} · ${PLACE_LABEL[now.place].toLowerCase()}`
      : nx ? `<b>Next riff</b> ${esc(nx.riff.name)} in ${Math.ceil(nx.start - beat)} beats` : '';
    rl.classList.toggle('live', !!now);
  }
  const w = document.getElementById('nnWhen');
  if (w && nnState.nextEv) { const left = Math.ceil(nnState.end - beat - 0.01); w.textContent = left > 0 ? `in ${left} beat${left === 1 ? '' : 's'}` : 'now'; }
}
