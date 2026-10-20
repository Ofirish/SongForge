/* ================================================================
   header + arrangement
   ================================================================ */
function renderHeader() {
  $('#songTitle').value = song.title;
  $('#songArtist').value = song.artist;
  $('#keySel').value = KEY_OPTIONS.includes(song.key) ? song.key : (() => { const o = document.createElement('option'); o.value = o.textContent = song.key; $('#keySel').append(o); return song.key; })();
  $('#capoIn').value = song.capo;
  $('#tempoIn').value = song.tempo;
  $('#tuneSel').value = song.tuning;
  $('#strumSel').value = song.strum;
  const k = parseKey(song.key);
  $('#soundsIn').textContent = song.capo ? `Capo ${song.capo}: sounds in ${pretty(keyNameFor(k.tonic + song.capo, k.minor))}` : '';
}
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
function renderArrangement() {
  const total = buildTimeline(song).totalBeats;
  $('#arr').innerHTML = song.sections.map((sec, si) => {
    const b = Math.max(1, buildTimeline(song, si).totalBeats);
    return `<button class="arr-chip" draggable="true" data-si="${si}" data-type="${sec.type}" style="flex-grow:${b}" title="${esc(sec.title)} · ${b / 4} bars">
      <span>${esc(sec.title.replace(/^\[|\]$/g, ''))}</span>${(sec.riffs || []).length ? `<i class="arr-riff" title="${sec.riffs.length} riff${sec.riffs.length > 1 ? 's' : ''}"></i>` : ''}${sec.repeat > 1 ? `<small>×${sec.repeat}</small>` : ''}</button>`;
  }).join('') || '<span class="empty">No parts yet</span>';
  $('#arrMeta').textContent = `${song.sections.length} parts · ${Math.round(total / 4)} bars · ${fmtTime(total * 60 / song.tempo)} at ${song.tempo} BPM`;
}
