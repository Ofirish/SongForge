/* ================================================================
   fretboardRenderer.js
   ================================================================ */
const FRETS = 15;
function neckSVG() {
  const tun = tuning(), key = parseKey(song.key), c = parseChord(ui.sel), v = voicingFor(ui.sel);
  const W = 1060, NUT = 56, END = W - 14, top = 26, gap = 27, H = top + gap * 5 + 40;
  const xs = f => NUT + (END - NUT) * (1 - Math.pow(2, -f / 12)) / (1 - Math.pow(2, -FRETS / 12));
  const ys = s => top + (5 - s) * gap;
  const mx = f => f === 0 ? NUT - 18 : (xs(f - 1) + xs(f)) / 2;
  let g = `<rect class="nk-wood" x="${NUT}" y="${top - 13}" width="${END - NUT}" height="${gap * 5 + 26}" rx="2"/>`;
  [3, 5, 7, 9, 15].forEach(f => { g += `<circle class="nk-inlay" cx="${mx(f)}" cy="${top + gap * 2.5}" r="5"/>`; });
  g += `<circle class="nk-inlay" cx="${mx(12)}" cy="${top + gap * 1.5}" r="5"/><circle class="nk-inlay" cx="${mx(12)}" cy="${top + gap * 3.5}" r="5"/>`;
  for (let f = 1; f <= FRETS; f++) g += `<line class="nk-fret" x1="${xs(f)}" x2="${xs(f)}" y1="${top - 13}" y2="${top + gap * 5 + 13}"/>`;
  g += `<rect class="nk-nut" x="${NUT - 5}" y="${top - 13}" width="6" height="${gap * 5 + 26}"/>`;
  for (let s = 0; s < 6; s++) {
    g += `<line class="nk-str" x1="${NUT - 30}" x2="${END}" y1="${ys(s)}" y2="${ys(s)}" style="stroke-width:${(2.6 - s * 0.32).toFixed(2)}"/>`;
    g += `<text class="nk-lab" x="10" y="${ys(s) + 4}">${pretty(noteName(tun[s], key.flat))}</text>`;
  }
  for (let f = 1; f <= FRETS; f++) g += `<text class="nk-num${[3,5,7,9,12,15].includes(f) ? ' strong' : ''}" x="${mx(f)}" y="${H - 8}" text-anchor="middle">${f}</text>`;
  const vPos = new Set(v ? v.frets.map((f, s) => f >= 0 ? s + ':' + f : null).filter(Boolean) : []);
  const mode = ui.neckMode;
  const scale = new Set((mode === 'penta' ? PENTA : SCALES)[key.minor ? 'minor' : 'major'].map(i => mod12(key.tonic + i)));
  const tones = new Set(chordPcs(c));
  let marks = '', hits = '';
  for (let s = 0; s < 6; s++) for (let f = 0; f <= FRETS; f++) {
    const pc = mod12(tun[s] + f), x = mx(f), y = ys(s);
    let show = false, cls = 'nk-m', lab = '';
    if (mode === 'chord') {
      show = tones.has(pc) || pc === c.bassPc;
      if (pc === c.rootPc) cls += ' root';
      lab = ui.neckLabel === 'note' ? pretty(noteName(pc, key.flat)) : intervalLabel(pc - c.rootPc, c);
      if (vPos.has(s + ':' + f)) cls += ' shape';
    } else if (mode === 'all') {
      show = true; cls += ' faint';
      lab = ui.neckLabel === 'note' ? pretty(noteName(pc, key.flat)) : IV_LABEL[mod12(pc - key.tonic)];
    } else {
      show = scale.has(pc);
      if (pc === key.tonic) cls += ' root';
      lab = ui.neckLabel === 'note' ? pretty(noteName(pc, key.flat)) : IV_LABEL[mod12(pc - key.tonic)];
    }
    if (show) marks += `<g class="${cls}"><circle cx="${x.toFixed(1)}" cy="${y}" r="10.5"/><text x="${x.toFixed(1)}" y="${y + 3.6}" text-anchor="middle">${lab}</text></g>`;
    const x0 = f === 0 ? 26 : xs(f - 1), x1 = f === 0 ? NUT - 4 : xs(f);
    hits += `<rect class="nk-hit" data-s="${s}" data-f="${f}" x="${x0.toFixed(1)}" y="${y - gap / 2}" width="${(x1 - x0).toFixed(1)}" height="${gap}"><title>${noteName(pc, key.flat)} · string ${6 - s}, fret ${f}</title></rect>`;
  }
  return `<svg class="neck-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fretboard in ${esc(TUNINGS[song.tuning].name)}">${g}${marks}${hits}</svg>`;
}
function renderNeck() {
  document.querySelectorAll('[data-neck]').forEach(b => b.setAttribute('aria-pressed', b.dataset.neck === ui.neckMode));
  document.querySelectorAll('[data-nlab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.nlab === ui.neckLabel));
  const k = parseKey(song.key);
  $('#neckCap').textContent = ui.neckMode === 'chord' ? `${pretty(ui.sel)} chord tones · ringed notes are the current shape`
    : ui.neckMode === 'penta' ? `${k.label} pentatonic` : ui.neckMode === 'scale' ? `${k.label} scale` : 'Every note on the neck';
  $('#neck').innerHTML = neckSVG();
}
