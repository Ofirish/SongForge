/* ================================================================
   floatingWindows.js — extract any part into a draggable window
   ================================================================ */
const PARTS = {
  song:  { title:'Song sheet',  w:640, h:560 },
  now:   { title:'Now / Next',  w:340, h:440 },
  chords:{ title:'Chords tabs', w:500, h:620 },
  neck:  { title:'Neck',        w:980, h:330 },
  tab:   { title:'Tab',         w:880, h:380 },
};
let zTop = 40, winSaveT = 0;
const isPhone = () => matchMedia('(max-width: 640px)').matches;
const winObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(entries => { clearTimeout(winSaveT); const t = entries.map(e => e.target); winSaveT = setTimeout(() => t.forEach(saveWin), 300); })
  : { observe() {}, unobserve() {} };
function saveWin(win) {
  if (!win.isConnected || isPhone()) return;
  const r = win.getBoundingClientRect();
  prefs.windows[win.id.slice(4)] = { x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height) };
  savePrefs();
}
function extractPart(id, restoring) {
  if ($('#win-' + id)) { focusWin(id); return; }
  const part = $('#part-' + id), p = PARTS[id];
  if (!part || !p) return;
  const body = part.querySelector('.part-body');
  const n = document.querySelectorAll('.fwin').length, sv = prefs.windows[id] || {};
  const w = clamp(sv.w || p.w, 260, Math.max(260, innerWidth - 16));
  const h = clamp(sv.h || p.h, 160, Math.max(160, innerHeight - 16));
  const x = clamp(sv.x != null ? sv.x : innerWidth - w - 24 - n * 28, 8, Math.max(8, innerWidth - w - 8));
  const y = clamp(sv.y != null ? sv.y : 96 + n * 28, 8, Math.max(8, innerHeight - 60));
  const win = document.createElement('div');
  win.className = 'fwin'; win.id = 'win-' + id;
  win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', p.title);
  win.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++zTop}`;
  win.innerHTML = `<div class="fwin-h" title="Drag to move. Drag the corner to resize."><span class="fwin-t">${p.title}</span><button class="btn sm" data-dock="${id}">Put back</button></div><div class="fwin-b"></div>`;
  win.querySelector('.fwin-b').append(body);
  document.body.append(win);
  part.classList.add('out');
  const ph = part.querySelector('.part-ph');
  ph.hidden = false;
  ph.innerHTML = `<span>${p.title} is open in a floating window.</span><button class="btn sm" data-focus="${id}">Show it</button><button class="btn sm" data-dock="${id}">Put back</button>`;
  if (!prefs.open.includes(id)) { prefs.open.push(id); savePrefs(); }
  winObserver.observe(win);
  if (!restoring) focusWin(id);
}
function dockPart(id) {
  const win = $('#win-' + id), part = $('#part-' + id);
  if (!win || !part) return;
  part.querySelector('.part-ph').hidden = true;
  part.append(win.querySelector('.part-body'));
  part.classList.remove('out');
  winObserver.unobserve(win);
  win.remove();
  prefs.open = prefs.open.filter(x => x !== id);
  savePrefs();
}
function focusWin(id) {
  const w = $('#win-' + id);
  if (!w) return;
  w.style.zIndex = ++zTop;
  w.classList.add('flash');
  setTimeout(() => w.classList.remove('flash'), 650);
}
function keepWindowsInView() {
  if (isPhone()) return;
  document.querySelectorAll('.fwin').forEach(w => {
    const r = w.getBoundingClientRect();
    w.style.left = clamp(r.left, 8, Math.max(8, innerWidth - Math.min(r.width, innerWidth - 16) - 8)) + 'px';
    w.style.top = clamp(r.top, 8, Math.max(8, innerHeight - 60)) + 'px';
  });
}
