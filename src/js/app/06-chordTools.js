/* ================================================================
   tools panel: chord · next chord · circle of fifths
   ================================================================ */
function renderTools() {
  document.querySelectorAll('#toolTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tool === ui.tool));
  const body = $('#toolBody');
  body.innerHTML = ui.tool === 'chord' ? chordToolHTML() : ui.tool === 'next' ? nextToolHTML() : circleToolHTML();
}
function chordToolHTML() {
  const c = parseChord(ui.sel), key = parseKey(song.key);
  const list = getVoicings(ui.sel, song.tuning), cur = voicingFor(ui.sel), rn = romanFor(ui.sel, key);
  const pcs = c.iv.map(i => mod12(c.rootPc + i));
  return `<div class="ct-head">
      <div class="ct-big">${boxSVG(cur, c, 'lg')}</div>
      <div class="ct-info">
        <div class="ct-name">${esc(pretty(ui.sel))}</div>
        <div class="ct-q">${c.qname}${c.bass ? ' over ' + esc(pretty(c.bass)) : ''}</div>
        <dl class="ct-dl">
          <div><dt>Notes</dt><dd>${pcs.map(p => pretty(noteName(p, key.flat))).join(' ')}</dd></div>
          <div><dt>Formula</dt><dd>${c.iv.map(i => intervalLabel(i, c)).join(' ')}</dd></div>
          <div><dt>In ${esc(key.label)}</dt><dd>${esc(rn.numeral)} · ${rn.fn}</dd></div>
        </dl>
        <div class="ct-acts"><button class="btn primary" data-act="strum">${ICON.play} Strum</button><button class="btn" data-act="addpad">Add to progression</button></div>
      </div>
    </div>
    <label class="search" for="chordSearch"><span>Look up any chord</span>
      <input id="chordSearch" placeholder="Cadd9, F#m7, D/F#, Bbmaj7" autocomplete="off" spellcheck="false"></label>
    <p class="msg" id="searchMsg">Press Enter to open it.</p>
    <h4 class="sub">Voicings up the neck <span>${list.length} shapes in ${esc(TUNINGS[song.tuning].name)}</span></h4>
    <div class="voicings">${list.map((v, i) => `<button class="vbtn${v === cur ? ' on' : ''}" data-vi="${i}" aria-pressed="${v === cur}">${boxSVG(v, c, 'sm')}<span>${v.pos === 0 ? 'Open' : ordinal(v.minF) + ' fret'}</span></button>`).join('') || '<p class="empty">No playable shape found in this tuning.</p>'}</div>
    <p class="hint">The shape you pick is used for playback and the neck view of this song.</p>`;
}
const FN_CLASS = { 'Tonic':'t', 'Pre-dominant':'p', 'Dominant':'d', 'Secondary dominant':'s', 'Borrowed':'b' };
function recContext() {
  const pad = song.progression;
  return { sym: pad.length ? pad[pad.length - 1] : ui.sel, prev2: pad.length > 1 ? pad[pad.length - 2] : null, fromPad: pad.length > 0 };
}
function nextToolHTML() {
  const key = parseKey(song.key), cx = recContext();
  const recs = recommend(cx.sym, cx.prev2, key);
  const max = Math.max(...recs.map(r => r.score), 0.01);
  const pad = song.progression;
  return `<div class="nx-ctx">After <b>${esc(pretty(cx.sym))}</b> in ${esc(key.label)}<span>${cx.fromPad ? 'last chord of your progression' : 'the chord selected on the sheet'}</span></div>
    <div class="recs">${recs.map(r => `<div class="rec" data-fn="${FN_CLASS[r.fn] || 'b'}">
        <button class="rec-main" data-aud="${esc(r.name)}" aria-label="Hear ${esc(r.name)}">
          ${boxSVG(voicingFor(r.name), parseChord(r.name), 'sm')}
          <span class="rec-txt"><span class="rec-top"><b>${esc(pretty(r.name))}</b><span class="rec-num">${esc(r.numeral)}</span></span>
          <span class="pill">${r.fn}</span><span class="why">${esc(r.why)}</span>
          <span class="meter" aria-hidden="true"><i style="width:${Math.max(6, Math.round(r.score / max * 100))}%"></i></span></span>
        </button>
        <button class="rec-add" data-add="${esc(r.name)}" aria-label="Add ${esc(r.name)} to progression">+</button>
      </div>`).join('')}</div>
    <div class="pad">
      <div class="pad-h"><h4 class="sub">Progression</h4>
        <div class="pad-acts"><button class="btn" data-act="padplay"${pad.length ? '' : ' disabled'}>${ui.playing === 'pad' ? ICON.stop + ' Stop' : ICON.play + ' Play'}</button>
        <button class="btn" data-act="padsec"${pad.length ? '' : ' disabled'}>Add as new part</button>
        <button class="btn" data-act="padclear"${pad.length ? '' : ' disabled'}>Clear</button></div></div>
      <div class="pad-chips">${pad.map((s, i) => `<span class="pchip" data-pi="${i}"><button data-paud="${i}">${esc(pretty(s))}</button><button class="px" data-pdel="${i}" aria-label="Remove ${esc(s)}">×</button></span>`).join('')
        || '<p class="empty">Tap + on a suggestion to sketch a progression. Suggestions then follow its last chord.</p>'}</div>
    </div>
    <p class="hint">Tap a card to hear it. Bars show relative strength; colour shows harmonic function.</p>`;
}

/* ---------- circleOfFifths.js ---------- */
const CIRCLE_MAJ = [0,7,2,9,4,11,6,1,8,3,10,5];
function circleName(i, minor, key) {
  const flat = i >= 7 || (i === 6 && key.flat);
  return minor ? noteName(CIRCLE_MAJ[i] + 9, flat) + 'm' : noteName(CIRCLE_MAJ[i], flat);
}
function circleSVG() {
  const key = parseKey(song.key);
  const rel = key.minor ? mod12(key.tonic + 3) : key.tonic;
  const ki = CIRCLE_MAJ.indexOf(rel);
  const C = 170, R1 = 162, R2 = 112, R3 = 66;
  const P = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const sector = (i, r0, r1) => {
    const a0 = (i * 30 - 105) * Math.PI / 180, a1 = (i * 30 - 75) * Math.PI / 180;
    const [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r1} ${r1} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r0} ${r0} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
  };
  const NUM_OUT = key.minor ? ['VI','III','VII'] : ['IV','I','V'];
  const NUM_IN = key.minor ? ['iv','i','v'] : ['ii','vi','iii'];
  const used = new Set(uniqueChords().map(s => { const c = parseChord(s), bt = baseTriad(c.q); return bt === '' ? 'o' + CIRCLE_MAJ.indexOf(c.rootPc) : bt === 'm' ? 'i' + CIRCLE_MAJ.indexOf(mod12(c.rootPc + 3)) : null; }));
  const selC = parseChord(ui.sel), selBt = baseTriad(selC.q);
  const selId = selBt === '' ? 'o' + CIRCLE_MAJ.indexOf(selC.rootPc) : selBt === 'm' ? 'i' + CIRCLE_MAJ.indexOf(mod12(selC.rootPc + 3)) : null;
  const cx = recContext();
  const recIds = new Set(recommend(cx.sym, cx.prev2, key).slice(0, 3).map(r => { const c = parseChord(r.name), bt = baseTriad(c.q); return bt === '' ? 'o' + CIRCLE_MAJ.indexOf(c.rootPc) : bt === 'm' ? 'i' + CIRCLE_MAJ.indexOf(mod12(c.rootPc + 3)) : null; }));
  let g = '';
  for (let i = 0; i < 12; i++) {
    const off = mod12(i - ki + 1); // 0,1,2 = the three diatonic positions
    for (const ring of ['o', 'i']) {
      const minor = ring === 'i';
      const id = ring + i;
      const dia = off <= 2;
      const tonic = (minor === key.minor) && i === ki;
      const name = circleName(i, minor, key);
      const [r0, r1] = minor ? [R3, R2] : [R2, R1];
      const mid = (r0 + r1) / 2, a = (i * 30 - 90) * Math.PI / 180;
      const [tx, ty] = P(mid, a);
      const cls = ['cf-sec', minor ? 'in' : 'out', dia ? 'dia' : '', tonic ? 'tonic' : '', selId === id ? 'sel' : ''].join(' ');
      g += `<g class="cf-g" data-cname="${name}" data-cminor="${minor ? 1 : 0}" tabindex="0" role="button" aria-label="${pretty(name)}">
        <path class="${cls}" d="${sector(i, r0, r1)}"/>
        <text class="cf-t${minor ? ' sm' : ''}${tonic ? ' tonic' : ''}" x="${tx.toFixed(1)}" y="${(ty + (dia ? -1 : 4)).toFixed(1)}" text-anchor="middle">${pretty(name)}</text>
        ${dia ? `<text class="cf-num${tonic ? ' tonic' : ''}" x="${tx.toFixed(1)}" y="${(ty + 12).toFixed(1)}" text-anchor="middle">${(minor ? NUM_IN : NUM_OUT)[off]}</text>` : ''}
        ${used.has(id) ? (() => { const [dx, dy] = P(r1 - 7, a - 0.2); return `<circle class="cf-used" cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="3"/>`; })() : ''}
        ${recIds.has(id) ? (() => { const [dx, dy] = P(r1 - 7, a + 0.2); return `<circle class="cf-rec" cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="3"/>`; })() : ''}
      </g>`;
    }
  }
  const nAcc = ki <= 5 ? ki : ki === 6 ? 6 : 12 - ki;
  const sharps = ki <= 5 || (ki === 6 && !key.flat);
  const accList = (sharps ? 'F C G D A E B' : 'B E A D G C F').split(' ').slice(0, nAcc).map(n => n + (sharps ? '♯' : '♭')).join(' ');
  const relName = key.minor ? pretty(noteName(rel, key.flat)) + ' major' : pretty(noteName(key.tonic + 9, key.flat)) + ' minor';
  g += `<circle class="cf-center" cx="${C}" cy="${C}" r="${R3 - 4}"/>
    <text class="cf-key" x="${C}" y="${C - 8}" text-anchor="middle">${esc(key.label)}</text>
    <text class="cf-sig" x="${C}" y="${C + 10}" text-anchor="middle">${nAcc ? nAcc + (sharps ? '♯' : '♭') + ' · ' + accList : 'no sharps or flats'}</text>
    <text class="cf-sig" x="${C}" y="${C + 25}" text-anchor="middle">relative ${relName}</text>`;
  return `<svg class="circle" viewBox="0 0 340 340" role="group" aria-label="Circle of fifths">${g}</svg>`;
}
function circleToolHTML() {
  const key = parseKey(song.key);
  const s = ui.circleSel;
  let acts = '<p class="hint">Tap a key on the circle to hear its chord and see key options.</p>';
  if (s) {
    const tk = parseKey(s.minor ? s.name : s.name);
    const sameMode = tk.minor === key.minor ? tk : parseKey(tk.minor ? keyNameFor(tk.tonic + 3, false) : keyNameFor(tk.tonic + 9, true));
    let n = mod12(sameMode.tonic - key.tonic); if (n > 6) n -= 12;
    acts = `<div class="cf-acts">
      <button class="btn" data-act="setkey" data-k="${esc(s.name)}"${s.name === song.key ? ' disabled' : ''}>Set song key to ${esc(tk.label)}</button>
      <button class="btn" data-act="transpose" data-n="${n}"${n === 0 ? ' disabled' : ''}>Transpose song to ${esc(sameMode.label)}${n ? ` (${n > 0 ? '+' : ''}${n})` : ''}</button>
    </div><p class="hint">“Set key” only relabels the key. “Transpose” moves every chord.</p>`;
  }
  return `<div class="cf-wrap">${circleSVG()}</div>
    <div class="cf-legend"><span><i class="lg dia"></i>In the key</span><span><i class="lg used"></i>Used in this song</span><span><i class="lg rec"></i>Top next-chord picks</span></div>
    <p class="cf-note">Neighbours on the circle share six of seven notes. Moving counter-clockwise (toward ${esc(pretty(circleName(mod12(CIRCLE_MAJ.indexOf(key.minor ? mod12(key.tonic + 3) : key.tonic) - 1), false, key)))}) is the classic resolving fifth motion. The diminished vii° in ${esc(key.label)} is ${esc(pretty(diatonic(key)[key.minor ? 1 : 6].name))}.</p>
    ${acts}`;
}
