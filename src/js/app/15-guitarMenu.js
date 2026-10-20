/* ================================================================
   guitarMenu.js — guitar-shaped jump menu
   ================================================================ */
const GTR_SHAPE = '<path d="M88 12 Q110 2 132 12 L127 80 L93 80 Z"/><rect x="96" y="78" width="28" height="162"/><ellipse cx="110" cy="298" rx="74" ry="68"/><ellipse cx="110" cy="434" rx="100" ry="92"/><rect x="58" y="330" width="104" height="64"/>';
const GTR_ZONES = [
  { go:'top',    label:'Top',         y0:0,   y1:80,  fill:'gz-wood',  ink:'on-wood',  tx:110, ty:52 },
  { go:'song',   label:'Song',        y0:80,  y1:160, fill:'gz-wood2', ink:'on-wood',  tx:110, ty:120, vertical:true },
  { go:'now',    label:'Now / Next',  y0:160, y1:240, fill:'gz-wood',  ink:'on-wood',  tx:110, ty:200, vertical:true },
  { go:'chords', label:'Chords tabs', y0:240, y1:326, fill:'gz-b1',    ink:'on-brass', tx:110, ty:290 },
  { go:'neck',   label:'Neck',        y0:326, y1:404, fill:'gz-b2',    ink:'on-wood',  tx:110, ty:369 },
  { go:'tab',    label:'Tab',         y0:404, y1:530, fill:'gz-b3',    ink:'on-brass', tx:110, ty:484 },
];
function guitarIconSVG() {
  return `<svg viewBox="0 0 220 530" aria-hidden="true"><g class="g-neck"><path d="M88 12 Q110 2 132 12 L127 80 L93 80 Z"/><rect x="96" y="78" width="28" height="162"/></g><g class="g-body"><ellipse cx="110" cy="298" rx="74" ry="68"/><ellipse cx="110" cy="434" rx="100" ry="92"/><rect x="58" y="330" width="104" height="64"/></g><circle class="g-hole" cx="110" cy="364" r="27"/></svg>`;
}
function guitarMenuSVG() {
  let g = `<defs><clipPath id="gclip">${GTR_SHAPE}</clipPath></defs>`;
  GTR_ZONES.forEach(z => {
    const out = !!$('#win-' + z.go);
    g += `<g class="gz" data-go="${z.go}" tabindex="0" role="menuitem" aria-label="${z.label}${out ? ' (floating window)' : ''}">
      <rect class="gz-f ${z.fill}" x="0" y="${z.y0}" width="220" height="${z.y1 - z.y0}" clip-path="url(#gclip)"/>
      ${z.vertical ? `<rect x="64" y="${z.y0}" width="92" height="${z.y1 - z.y0}" fill="transparent"/>` : ''}</g>`;
  });
  // decorations (ignore pointer)
  for (let y = 100; y < 240; y += 20) g += `<line class="g-fret" x1="96" x2="124" y1="${y}" y2="${y}"/>`;
  [26, 46, 66].forEach(y => { g += `<circle class="g-peg" cx="83" cy="${y}" r="4.5"/><circle class="g-peg" cx="137" cy="${y}" r="4.5"/>`; });
  g += `<circle class="g-hole" cx="110" cy="364" r="27"/><rect class="g-bridge" x="80" y="438" width="60" height="11" rx="3"/>`;
  for (let i = 0; i < 6; i++) { const x = 101.5 + i * 3.4; g += `<line class="g-str" x1="${x}" x2="${x}" y1="14" y2="443"/>`; }
  GTR_ZONES.slice(1).forEach(z => { g += `<line class="g-line" x1="0" x2="220" y1="${z.y0}" y2="${z.y0}" clip-path="url(#gclip)"/>`; });
  GTR_ZONES.forEach(z => {
    const out = $('#win-' + z.go) ? ' ↗' : '';
    g += z.vertical
      ? `<text class="gz-t ${z.ink}" x="${z.tx}" y="${z.ty}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${z.tx} ${z.ty})">${z.label}${out}</text>`
      : `<text class="gz-t ${z.ink}" x="${z.tx}" y="${z.ty}" text-anchor="middle" dominant-baseline="central">${z.label}${out}</text>`;
  });
  return `<svg viewBox="0 0 220 530" role="menu" aria-label="Jump to">${g}</svg>`;
}
let gtrCloseT = 0;
function openGuitar() {
  const m = $('#gtrMenu');
  clearTimeout(gtrCloseT);
  m.innerHTML = guitarMenuSVG();
  m.hidden = false;
  $('#gtrBtn').setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
}
function closeGuitar(focusBtn) {
  const m = $('#gtrMenu');
  if (m.hidden) return;
  m.classList.remove('open');
  $('#gtrBtn').setAttribute('aria-expanded', 'false');
  gtrCloseT = setTimeout(() => { m.hidden = true; }, 260);
  if (focusBtn) $('#gtrBtn').focus();
}
function goTo(id) {
  closeGuitar();
  const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  if (id === 'top') { window.scrollTo({ top:0, behavior:smooth }); return; }
  if ($('#win-' + id)) { focusWin(id); return; }
  const el = $('#part-' + id);
  if (el) el.scrollIntoView({ block:'start', behavior:smooth });
}

function renderMute() {
  const b = $('#muteBtn'), m = AudioEngine.muted;
  b.innerHTML = m ? ICON.muted + ' Muted' : ICON.sound + ' Mute';
  b.setAttribute('aria-pressed', m);
  b.setAttribute('aria-label', m ? 'Sound is muted. Turn sound on' : 'Mute sound');
}

function bindExtras() {
  // dock height feeds the sticky offsets
  const dock = $('.dock');
  const setDock = () => document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px');
  setDock();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(setDock).observe(dock);
  window.addEventListener('resize', () => { setDock(); keepWindowsInView(); });

  $('#muteBtn').addEventListener('click', () => { AudioEngine.setMuted(!AudioEngine.muted); prefs.muted = AudioEngine.muted; savePrefs(); renderMute(); });
  $('#floatBtn').addEventListener('click', () => {
    ui.floatStrip = !ui.floatStrip; prefs.floatStrip = ui.floatStrip; savePrefs();
    $('#stripWrap').classList.toggle('float', ui.floatStrip);
    $('#floatBtn').setAttribute('aria-pressed', ui.floatStrip);
  });
  $('#nowNext').addEventListener('click', e => {
    const b = e.target.closest('[data-nnext]');
    if (b && !Player.playing) selectChord(b.dataset.nnext, true, b.dataset.nk || null);
  });

  // extract / put back / show — buttons live both in the page and in windows
  document.addEventListener('click', e => {
    const x = e.target.closest('[data-extract]'); if (x) { extractPart(x.dataset.extract); return; }
    const d = e.target.closest('[data-dock]'); if (d) { dockPart(d.dataset.dock); return; }
    const f = e.target.closest('[data-focus]'); if (f) focusWin(f.dataset.focus);
  });
  // bring to front + drag by the title bar
  document.addEventListener('pointerdown', e => {
    const w = e.target.closest('.fwin');
    if (!w) return;
    w.style.zIndex = ++zTop;
    const h = e.target.closest('.fwin-h');
    if (!h || e.target.closest('button') || isPhone()) return;
    e.preventDefault();
    const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    try { h.setPointerCapture(e.pointerId); } catch (x) {}
    const move = ev => {
      w.style.left = clamp(ev.clientX - ox, 8 - r.width + 80, innerWidth - 80) + 'px';
      w.style.top = clamp(ev.clientY - oy, 0, innerHeight - 44) + 'px';
    };
    const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); saveWin(w); };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });

  // guitar menu
  $('#gtrBtn').innerHTML = guitarIconSVG();
  $('#gtrBtn').addEventListener('click', () => { if ($('#gtrMenu').hidden || !$('#gtrMenu').classList.contains('open')) openGuitar(); else closeGuitar(); });
  $('#gtrMenu').addEventListener('click', e => { const z = e.target.closest('.gz'); if (z) goTo(z.dataset.go); });
  $('#gtrMenu').addEventListener('keydown', e => {
    const z = e.target.closest('.gz');
    if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goTo(z.dataset.go); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const all = [...document.querySelectorAll('#gtrMenu .gz')], i = all.indexOf(z);
      all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus();
    }
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#gtr')) closeGuitar(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#gtrMenu').hidden) closeGuitar(true); });

  renderMute();
  prefs.open.filter(id => PARTS[id]).forEach(id => extractPart(id, true));
}

bind();
renderAll();
bindExtras();
setNow(null, 'Ready');
syncTransport();
