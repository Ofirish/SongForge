/* ================================================================
   pdfExport.js — designed PDF song sheets
   One layout engine; two painters (canvas for the live preview,
   jsPDF for the file), so the preview is exactly what gets saved.
   Units are millimetres; font sizes are points.
   ================================================================ */
const MM_PER_PT = 0.3528;
const PAPER = { a4:[210, 297], letter:[215.9, 279.4] };
const TEXT_SIZE = { S:{ body:9.5, title:22 }, M:{ body:11, title:26 }, L:{ body:13, title:30 }, XL:{ body:16, title:34 } };
const MONO_ADV = 0.6;                       // JetBrains Mono advance width, em
const BG = {
  blank:    'Blank',
  paper:    'Warm paper',
  fretboard:'Fretboard',
  wood:     'Wood header',
  frame:    'Line frame',
  image:    'Your image',
};
const INK = {
  color: { ink:'#241b15', muted:'#76695e', rule:'#d9d0c4', accent:'#9b6510', lead:'#1f7b67', fill:'#7a4fa3', over:'#9b6510',
           verse:'#466684', chorus:'#9b6510', prechorus:'#1f7b67', bridge:'#7a4fa3', solo:'#b34f2f', intro:'#76695e', outro:'#76695e', root:'#9b6510' },
  saver: { ink:'#000000', muted:'#555555', rule:'#bbbbbb', accent:'#000000', lead:'#333333', fill:'#333333', over:'#333333',
           verse:'#333333', chorus:'#000000', prechorus:'#333333', bridge:'#333333', solo:'#333333', intro:'#555555', outro:'#555555', root:'#000000' },
};
const BG_IMG_KEY = 'tabwright.bgimg.v1';

let pdfOpts = Object.assign({ chords:true, lyrics:true, charts:true, tabs:true, details:true, size:'M', orient:'auto',
  paper:'a4', ink:'color', bg:'blank', imgMode:'faded', border:'none', colLines:true }, prefs.pdf || {});
let bgImage = null;                         // { src, w, h } raw upload (data URL)
try { const s = localStorage.getItem(BG_IMG_KEY); if (s) bgImage = JSON.parse(s); } catch (e) {}
const bgCache = new Map();                  // processed background JPEGs by key

/* ---------- text cleanup: the embedded fonts cover Latin only ---------- */
function pdfText(s) {
  return String(s ?? '').replace(/♯/g, '#').replace(/♭/g, 'b').replace(/×/g, 'x').replace(/[←↗]/g, '')
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…·]/g, '?');
}
const hasUnsupported = s => /[^\x00-\x7E -ÿ–—‘’“”•…·♯♭×]/.test(s);

/* ================================================================
   painters
   ================================================================ */
const FONT_CSS = { display:['400', '"Young Serif", Georgia, serif'], body:['400', 'Figtree, system-ui, sans-serif'],
  bodyBold:['700', 'Figtree, system-ui, sans-serif'], mono:['400', '"JetBrains Mono", ui-monospace, monospace'], monoBold:['700', '"JetBrains Mono", ui-monospace, monospace'] };
const FONT_PDF = { display:['YoungSerif', 'normal'], body:['Figtree', 'normal'], bodyBold:['Figtree', 'bold'], mono:['JBMono', 'normal'], monoBold:['JBMono', 'bold'] };

function canvasPainter(canvas, W, H, pxPerMm) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * pxPerMm * dpr); canvas.height = Math.round(H * pxPerMm * dpr);
  canvas.style.aspectRatio = `${W} / ${H}`;
  const c = canvas.getContext('2d'), k = pxPerMm * dpr;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  let pt = 10;
  return {
    font(role, size) { pt = size; const [w, fam] = FONT_CSS[role]; c.font = `${w} ${size * MM_PER_PT}px ${fam}`; },
    color(hex) { c.fillStyle = hex; },
    text(s, x, y, align) { c.textAlign = align || 'left'; c.textBaseline = 'alphabetic'; c.fillText(pdfText(s), x, y); },
    width(s) { return c.measureText(pdfText(s)).width; },
    line(x1, y1, x2, y2, w, hex) { c.strokeStyle = hex; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); },
    rect(x, y, w, h, o) {
      c.beginPath(); if (c.roundRect && o.r) c.roundRect(x, y, w, h, o.r); else c.rect(x, y, w, h);
      if (o.fill) { c.fillStyle = o.fill; c.fill(); }
      if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.width || 0.3; c.stroke(); }
    },
    circle(x, y, r, o) {
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      if (o.fill) { c.fillStyle = o.fill; c.fill(); }
      if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.width || 0.3; c.stroke(); }
    },
    path(pts, w, hex) { c.strokeStyle = hex; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); },
    image(img, x, y, w, h) { if (img.el) c.drawImage(img.el, x, y, w, h); },
  };
}
function pdfPainter(doc) {
  return {
    font(role, size) { const [f, st] = FONT_PDF[role]; doc.setFont(f, st); doc.setFontSize(size); },
    color(hex) { doc.setTextColor(hex); },
    text(s, x, y, align) { doc.text(pdfText(s), x, y, { align: align || 'left', baseline:'alphabetic' }); },
    width(s) { return doc.getTextWidth(pdfText(s)); },
    line(x1, y1, x2, y2, w, hex) { doc.setDrawColor(hex); doc.setLineWidth(w); doc.line(x1, y1, x2, y2); },
    rect(x, y, w, h, o) {
      if (o.fill) doc.setFillColor(o.fill);
      if (o.stroke) { doc.setDrawColor(o.stroke); doc.setLineWidth(o.width || 0.3); }
      const style = o.fill && o.stroke ? 'FD' : o.fill ? 'F' : 'S';
      if (o.r) doc.roundedRect(x, y, w, h, o.r, o.r, style); else doc.rect(x, y, w, h, style);
    },
    circle(x, y, r, o) {
      if (o.fill) doc.setFillColor(o.fill);
      if (o.stroke) { doc.setDrawColor(o.stroke); doc.setLineWidth(o.width || 0.3); }
      doc.circle(x, y, r, o.fill && o.stroke ? 'FD' : o.fill ? 'F' : 'S');
    },
    path(pts, w, hex) { doc.setDrawColor(hex); doc.setLineWidth(w); for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); },
    image(img, x, y, w, h) { doc.addImage(img.src, 'JPEG', x, y, w, h, undefined, 'FAST'); },
  };
}

/* ================================================================
   layout: blocks with a height and a draw(p, x, y, w) function
   ================================================================ */
function pdfMetrics(o) {
  const t = TEXT_SIZE[o.size] || TEXT_SIZE.M;
  const b = t.body;
  return { body:b, title:t.title, cw: b * MONO_ADV * MM_PER_PT, lh: b * MM_PER_PT * 1.3, tabPt: b * 0.78,
    tabCw: b * 0.78 * MONO_ADV * MM_PER_PT, tabLh: b * 0.78 * MM_PER_PT * 1.18, small: Math.max(7, b * 0.72) };
}
/** Split a chord line + lyric line pair so both fit `max` characters, cutting at a space. */
function wrapPair(ch, ly, max) {
  const out = [];
  let indent = '';
  while (Math.max(ch.length, ly.length) > max && max > 12) {
    const room = max - indent.length;
    let cut = -1;
    for (let i = Math.min(room, ly.length - 1); i > room * 0.4; i--) if (ly[i] === ' ' && (ch[i] === undefined || ch[i] === ' ')) { cut = i; break; }
    if (cut < 0) for (let i = room; i > room * 0.4; i--) if (ch[i] === undefined || ch[i] === ' ') { cut = i; break; }
    if (cut < 0) cut = room;
    out.push([indent + ch.slice(0, cut).replace(/\s+$/, ''), indent + ly.slice(0, cut)]);
    ch = ch.slice(cut + 1); ly = ly.slice(cut + 1); indent = '  ';
    if (!ch.trim() && !ly.trim()) return out;
  }
  out.push([indent + ch.replace(/\s+$/, ''), indent + ly]);
  return out;
}
function wrapWords(text, max) {
  const words = text.split(/(\s+)/), out = [];
  let cur = '';
  for (const w of words) { if ((cur + w).length > max && cur.trim()) { out.push(cur.replace(/\s+$/, '')); cur = w.trimStart(); } else cur += w; }
  if (cur.trim() || !out.length) out.push(cur.replace(/\s+$/, ''));
  return out;
}
/** Bar-chart text for one lyric line: "| G  .  .  C  | .  .  G  .  |". */
function barChart(lineEvents) {
  const slots = [];
  lineEvents.forEach(e => { slots.push(pretty(e.sym).replace(/♯/g, '#').replace(/♭/g, 'b')); for (let i = 1; i < e.beats; i++) slots.push('.'); });
  while (slots.length % 4) slots.push('.');
  const w = Math.max(3, ...slots.map(s => s.length + 1));
  let s = '';
  for (let i = 0; i < slots.length; i++) { if (i % 4 === 0) s += '| '; s += slots[i].padEnd(w); }
  return s + '|';
}
/** Per-bar ASCII tab rows so long riffs wrap by whole bars. */
function tabBars(tab, tun) {
  const labels = [5,4,3,2,1,0].map(s => { const n = noteName(tun[s], false); return (s === 5 ? n.toLowerCase() : n).padEnd(2, ' '); });
  const bars = [];
  for (let b = 0; b < tab.steps / 8; b++) {
    const rows = ['', '', '', '', '', ''];
    for (let c = b * 8; c < b * 8 + 8; c++) {
      const cells = [5,4,3,2,1,0].map(s => tabCellText(tab.notes[c + ':' + s]));
      const w = Math.max(1, ...cells.map(x => x.length));
      cells.forEach((x, i) => { rows[i] += '-' + x.padEnd(w, '-'); });
    }
    bars.push(rows.map(r => '|' + r + '-'));
  }
  return { labels, bars };
}
function chordBoxDraw(p, sym, x, y, C) {
  // 13 mm wide box; y is the top of the chord name
  const c = parseChord(sym), v = voicingFor(sym), tun = tuning();
  p.font('monoBold', 9); p.color(C.ink); p.text(pretty(sym), x + 6, y + 3, 'center');
  const X0 = x, DX = 2.4, Y0 = y + 7.5, DY = 2.9;
  if (!v) { p.font('body', 7); p.color(C.muted); p.text('no shape', x + 6, Y0 + 7, 'center'); return; }
  const fr = v.frets.filter(f => f > 0), maxF = fr.length ? Math.max(...fr) : 0, minF = fr.length ? Math.min(...fr) : 0;
  const start = maxF <= 4 ? 1 : minF;
  for (let j = 0; j <= 5; j++) p.line(X0, Y0 + j * DY, X0 + 5 * DX, Y0 + j * DY, 0.18, C.muted);
  for (let i = 0; i < 6; i++) p.line(X0 + i * DX, Y0, X0 + i * DX, Y0 + 5 * DY, 0.18, C.ink);
  if (start === 1) p.rect(X0 - 0.15, Y0 - 0.7, 5 * DX + 0.3, 0.8, { fill:C.ink });
  else { p.font('mono', 6); p.color(C.muted); p.text(start + 'fr', X0 - 1, Y0 + DY * 0.75, 'right'); }
  if (v.barre) { const by = Y0 + (v.barre.fret - start + 0.5) * DY; p.rect(X0 + v.barre.from * DX - 1, by - 1, (v.barre.to - v.barre.from) * DX + 2, 2, { fill:C.ink, r:1 }); }
  v.frets.forEach((f, s) => {
    const sx = X0 + s * DX, root = f >= 0 && mod12(tun[s] + f) === c.rootPc;
    if (f < 0) { p.font('body', 6.5); p.color(C.muted); p.text('x', sx, Y0 - 1.6, 'center'); }
    else if (f === 0) p.circle(sx, Y0 - 2.4, 0.75, root ? { fill:C.root } : { stroke:C.ink, width:0.2 });
    else p.circle(sx, Y0 + (f - start + 0.5) * DY, 1.0, { fill: root ? C.root : C.ink });
  });
}

/** Build every flowing block for the current options. */
function buildPdfBlocks(o, M) {
  const C = INK[o.ink], tun = tuning(), key = parseKey(song.key);
  const blocks = { head:[], parts:[] };
  const onBand = o.bg === 'wood' || (o.bg === 'image' && o.imgMode === 'header');
  // title block
  const metaLine = [`Key ${pretty(song.key).replace(/♯/g, '#').replace(/♭/g, 'b')}`, song.capo ? `Capo ${song.capo}` : 'No capo', `${song.tempo} BPM`, TUNINGS[song.tuning].name.replace(/♭/g, 'b').replace(/♯/g, '#')].join('  ·  ');
  const order = song.sections.map(s => secName(s) + (s.repeat > 1 ? ` x${s.repeat}` : '')).join('  >  ');
  const titleH = M.title * MM_PER_PT * 1.05;
  const headH = titleH + (song.artist ? 6.5 : 1.5) + (o.details ? 10 : 0) + 5;
  blocks.head.push({ h: headH, band: onBand, draw(p, x, y, w) {
    const ink = onBand ? '#f6ecdc' : C.ink, sub = onBand ? '#e7d5bb' : C.muted;
    p.font('display', M.title); p.color(ink); p.text(song.title, x, y + titleH * 0.82);
    let yy = y + titleH;
    if (song.artist) { p.font('body', 11); p.color(sub); p.text(song.artist, x, yy + 4.5); yy += 6.5; } else yy += 1.5;
    if (o.details) {
      p.font('mono', 8); p.color(onBand ? '#f6ecdc' : C.ink); p.text(metaLine, x, yy + 3.5);
      p.font('body', 7.5); p.color(sub); p.text(order.length > 140 ? order.slice(0, 137) + '...' : order, x, yy + 7.8);
      yy += 10;
    }
    if (!onBand) p.line(x, yy + 2.2, x + w, yy + 2.2, 0.35, C.rule);
  } });
  if (o.charts) {
    const chords = uniqueChords();
    if (chords.length) blocks.head.push({ chartRows:true, chords, h:0, layoutW(w) { const per = Math.max(1, Math.floor((w + 4) / 17)); this.per = per; this.h = Math.ceil(chords.length / per) * 25 + 2; return this.h; },
      draw(p, x, y) { chords.forEach((s, i) => chordBoxDraw(p, s, x + 1 + (i % this.per) * 17, y + Math.floor(i / this.per) * 25, C)); } });
  }
  // parts
  const tl = buildTimeline(song);
  song.sections.forEach((sec, si) => {
    const color = C[sec.type] || C.ink;
    const header = { kind:'header', h: M.lh * 1.25 + 2.5, draw(p, x, y, w, cont) {
      const cap = (TYPE_LABEL[sec.type] || 'Part').toUpperCase();
      p.font('bodyBold', 7); p.color(color); p.text(cap, x, y + 3);
      const capW = p.width(cap);
      p.font('display', M.body * 1.25); p.color(C.ink);
      const name = secName(sec) + (cont ? ' (continued)' : '');
      p.text(name, x + capW + 2.5, y + 3.4);
      const nameW = p.width(name);
      if (sec.repeat > 1 && !cont) { p.font('monoBold', 8); p.color(color); p.text('x' + sec.repeat, x + capW + 2.5 + nameW + 2.5, y + 3.3); }
      p.line(x, y + 5.3, x + w, y + 5.3, 0.25, color);
    } };
    const items = [];
    const riffTag = (a) => {
      const r = riffById(a.id);
      if (!r || !Object.keys(r.notes).length) return;
      const tc = C[a.place] || C.accent;
      const lab = { kind:'riffLabel', h: M.small * MM_PER_PT * 1.6 + 1, draw(p, x, y) {
        p.rect(x, y + 0.4, 1, M.small * MM_PER_PT * 1.25, { fill:tc });
        p.font('bodyBold', M.small); p.color(tc); const t = PLACE_LABEL[a.place].toUpperCase(); p.text(t, x + 2.5, y + M.small * MM_PER_PT * 1.2);
        const tw = p.width(t); p.font('bodyBold', M.small + 0.5); p.color(C.ink); p.text(`${r.name}`, x + 5 + tw, y + M.small * MM_PER_PT * 1.2);
        const nw = p.width(r.name); p.font('body', M.small); p.color(C.muted); p.text(`${barsLabel(r)}${a.every || sec.repeat < 2 ? '' : ', first time only'}`, x + 7.5 + tw + nw, y + M.small * MM_PER_PT * 1.2);
      } };
      items.push(lab);
      const tb = tabBars(r, tun);
      items.push({ kind:'tab', tb, h:0, layoutW(w) {
        const labW = 3 * M.tabCw; let rows = [], cur = [], curW = labW;
        tb.bars.forEach(b => { const bw = b[0].length * M.tabCw; if (cur.length && curW + bw > w) { rows.push(cur); cur = []; curW = labW; } cur.push(b); curW += bw; });
        if (cur.length) rows.push(cur);
        this.rows = rows; this.h = rows.length * (6 * M.tabLh + 1.6) + 1.5; return this.h;
      }, draw(p, x, y) {
        p.font('mono', M.tabPt); p.color(C.ink);
        this.rows.forEach((row, ri) => {
          const y0 = y + ri * (6 * M.tabLh + 1.6);
          for (let l = 0; l < 6; l++) p.text(tb.labels[l] + row.map(b => b[l]).join('') + '|', x, y0 + (l + 1) * M.tabLh);
        });
      } });
    };
    if (o.tabs) (sec.riffs || []).filter(a => a.place !== 'fill').forEach(riffTag);
    sec.lines.forEach((ln, li) => {
      items.push({ kind:'line', ln, li, h:0, layoutW(w) {
        const max = Math.max(16, Math.floor(w / M.cw));
        const hasCh = o.chords && ln.chords.trim(), hasLy = o.lyrics && ln.lyrics.trim();
        if (o.chords && !o.lyrics) {
          const evs = tl.events.filter(e => e.si === si && e.li === li && e.rep === 0);
          this.rows = evs.length ? wrapWords(barChart(evs), max).map(t => ['bars', t]) : [];
        } else if (!o.chords && o.lyrics) {
          const lmax = Math.floor(w / (M.body * 0.5 * MM_PER_PT));
          this.rows = hasLy ? wrapWords(ln.lyrics, lmax).map(t => ['lyric', t]) : [];
        } else if (hasCh || hasLy) {
          this.rows = [];
          wrapPair(hasCh ? ln.chords : '', hasLy ? ln.lyrics : '', max).forEach(([c, l]) => { if (c.trim()) this.rows.push(['chords', c]); if (l.trim()) this.rows.push(['mono', l]); });
        } else this.rows = [];
        this.h = this.rows.length ? this.rows.length * M.lh + 1.4 : 0;
        return this.h;
      }, draw(p, x, y) {
        this.rows.forEach(([k, t], i) => {
          const by = y + (i + 0.82) * M.lh;
          if (k === 'chords') { p.font('monoBold', M.body); p.color(C.accent); }
          else if (k === 'bars') { p.font('monoBold', M.body); p.color(C.ink); }
          else if (k === 'lyric') { p.font('body', M.body); p.color(C.ink); }
          else { p.font('mono', M.body); p.color(C.ink); }
          p.text(t, x, by);
        });
      } });
    });
    if (o.tabs) (sec.riffs || []).filter(a => a.place === 'fill').forEach(riffTag);
    blocks.parts.push({ header, items, si, color });
  });
  return blocks;
}

/** Pack blocks into pages and columns. Returns { pages:[[{b,x,y,w,cont}]], W, H, cols } */
function packPdf(o, orient, cols) {
  const M = pdfMetrics(o);
  const [pw, ph] = PAPER[o.paper] || PAPER.a4;
  const W = orient === 'landscape' ? ph : pw, H = orient === 'landscape' ? pw : ph;
  const framed = o.bg === 'paper' || o.bg === 'frame' || o.border === 'page';
  const mx = 15, mt = framed ? 16 : 15, mb = framed ? 20 : 16, gutter = 9;
  const boxed = o.border === 'parts', pad = boxed ? 3 : 0, padY = boxed ? 2.4 : 0;   // inner padding of part boxes
  const blocks = buildPdfBlocks(o, M);
  const fullW = W - mx * 2;
  const colW = (fullW - gutter * (cols - 1)) / cols, innerW = colW - pad * 2;
  const pages = [];
  let page, col, y, colTop;
  const bottom = H - mb;
  const newPage = () => { page = []; page.boxes = []; page.usedCols = 0; pages.push(page); col = 0; colTop = mt + (pages.length > 1 && o.bg === 'wood' ? 6 : 0); page.colTop = colTop; y = colTop; };
  newPage();
  // full-width header blocks on page 1
  blocks.head.forEach((b, i) => {
    if (b.layoutW) b.layoutW(fullW);
    const extra = b.band ? 4 : 0;
    page.push({ b, x:mx, y:y + extra, w:fullW });
    y += b.h + extra + 3;
    if (i === 0) page.bandH = b.band ? y - 2 : 0;
    if (i === 0 && b.band) y += 4;              // breathing room under the band
  });
  colTop = y; page.colTop = y;
  const nextCol = () => { col++; if (col >= cols) { newPage(); } y = colTop; page.usedCols = Math.max(page.usedCols, col); };
  const colX = () => mx + col * (colW + gutter);
  for (const part of blocks.parts) {
    part.header.layoutW && part.header.layoutW(innerW);
    const its = part.items.map(it => { if (it.layoutW) it.layoutW(innerW); return it; }).filter(it => it.h > 0);
    if (!its.length) continue;
    const total = part.header.h + its.reduce((a, it) => a + it.h, 0) + 4 + padY * 2;
    const minStart = part.header.h + (its[0] ? its[0].h : 0) + padY * 2;
    if (y + total > bottom && (total <= bottom - colTop || y + minStart > bottom) && y > colTop + 0.1) nextCol();
    // a part can span columns/pages; each piece gets its own box
    let seg = null;
    const openSeg = cont => {
      seg = { x:colX(), y0:y, w:colW, color:part.color };
      y += padY;
      page.push({ b:part.header, x:colX() + pad, y, w:innerW, cont }); y += part.header.h;
    };
    const closeSeg = () => { if (boxed && seg) { y += padY; page.boxes.push({ ...seg, y1:y }); } seg = null; };
    openSeg(false);
    for (const it of its) {
      if (y + it.h + padY > bottom && y > colTop + part.header.h + padY + 0.1) { closeSeg(); nextCol(); openSeg(true); }
      page.push({ b:it, x:colX() + pad, y, w:innerW });
      y += it.h;
    }
    closeSeg();
    y += boxed ? 4 : 5;
  }
  return { pages, W, H, cols, M, mx, colW, gutter, bottom };
}
/** Pick orientation/columns. */
function planPdf(o) {
  const portrait = packPdf(o, 'portrait', 1);
  const M = pdfMetrics(o);
  const longest = Math.max(20, ...song.sections.flatMap(s => s.lines.map(l => Math.max(l.chords.length, l.lyrics.length))));
  const [pw, ph] = PAPER[o.paper] || PAPER.a4;
  const lw = ph - 30;
  let lc = 2;
  if ((lw - 18) / 3 / M.cw >= longest * 0.9 && o.size === 'S') lc = 3;
  const landscape = packPdf(o, 'landscape', lc);
  let pick = o.orient === 'portrait' ? portrait : o.orient === 'landscape' ? landscape
    : (landscape.pages.length < portrait.pages.length || (['L', 'XL'].includes(o.size) && landscape.pages.length <= portrait.pages.length)) ? landscape : portrait;
  return { pick, portrait, landscape, orient: pick === landscape ? 'landscape' : 'portrait' };
}

/* ---------- backgrounds ---------- */
function bgProcessed(kind, W, H) {
  // returns { src, el } JPEG with the fade baked in, cropped to the target aspect
  if (!bgImage) return null;
  const k = `${kind}:${W}x${H}:${bgImage.src.length}`;
  if (bgCache.has(k)) return bgCache.get(k);
  if (!bgImage.el) return null;
  const img = bgImage.el, tw = 1400, th = Math.round(tw * H / W);
  const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
  const c = cv.getContext('2d');
  const s = Math.max(tw / img.naturalWidth, th / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  c.drawImage(img, (tw - dw) / 2, (th - dh) / 2, dw, dh);
  if (kind === 'faded') { c.fillStyle = 'rgba(255,255,255,0.84)'; c.fillRect(0, 0, tw, th); }
  else { const g = c.createLinearGradient(0, 0, 0, th); g.addColorStop(0, 'rgba(20,12,6,0.55)'); g.addColorStop(1, 'rgba(20,12,6,0.72)'); c.fillStyle = g; c.fillRect(0, 0, tw, th); }
  const out = { src: cv.toDataURL('image/jpeg', 0.82), el: cv };
  bgCache.set(k, out);
  return out;
}
function drawBackground(p, o, W, H, pageIdx, bandH) {
  const C = INK[o.ink];
  if (o.bg === 'paper') {
    if (o.ink === 'color') p.rect(0, 0, W, H, { fill:'#fbf6ee' });
    p.rect(6, 6, W - 12, H - 12, { stroke: o.ink === 'color' ? '#d6c3a5' : '#999999', width:0.45 });
    p.rect(7.4, 7.4, W - 14.8, H - 14.8, { stroke: o.ink === 'color' ? '#e4d6c0' : '#cccccc', width:0.15 });
  } else if (o.bg === 'frame') {
    p.rect(8, 8, W - 16, H - 16, { stroke:C.ink, width:0.35, r:2.5 });
    [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(([x, y]) => p.circle(x, y, 1.1, { fill:C.accent }));
  } else if (o.bg === 'fretboard') {
    const col = o.ink === 'color' ? '#ece2d3' : '#e2e2e2', col2 = o.ink === 'color' ? '#e1d3be' : '#d4d4d4';
    const x0 = W - 12, sx = 1.3;
    for (let s = 0; s < 6; s++) p.line(x0 + s * sx, 0, x0 + s * sx, H, 0.12 + (5 - s) * 0.05, col2);
    let y = 10, gap = 26;
    for (let f = 0; f < 22 && y < H; f++) { p.line(x0 - 1, y, x0 + 5 * sx + 1, y, 0.45, col); if ([3,5,7,9,15,17].includes(f + 1)) p.circle(x0 + 2.5 * sx, y + gap * 0.47, 0.9, { fill:col }); if (f + 1 === 12) { p.circle(x0 + 1.2 * sx, y + gap * 0.47, 0.9, { fill:col }); p.circle(x0 + 3.8 * sx, y + gap * 0.47, 0.9, { fill:col }); } y += gap; gap *= 0.97; }
  } else if (o.bg === 'wood') {
    const h = pageIdx === 0 ? Math.max(20, bandH + 5) : 9;
    p.rect(0, 0, W, h, { fill: o.ink === 'color' ? '#5b3d29' : '#444444' });
    if (o.ink === 'color') {
      const rng = makeRng(17);
      for (let i = 0; i < 14; i++) {
        const yy = rng() * h, amp = 0.5 + rng() * 1.6, ph = rng() * 6, pts = [];
        for (let x = 0; x <= W; x += 6) pts.push([x, clamp(yy + Math.sin(x / 23 + ph) * amp, 0.3, h - 0.3)]);
        p.path(pts, 0.25 + rng() * 0.35, rng() < 0.5 ? '#6b4a33' : '#4d3322');
      }
    }
  } else if (o.bg === 'image' && bgImage) {
    if (o.imgMode === 'faded') { const im = bgProcessed('faded', W, H); if (im) p.image(im, 0, 0, W, H); }
    else if (pageIdx === 0) { const h = Math.max(20, bandH + 5); const im = bgProcessed('header', W, h); if (im) p.image(im, 0, 0, W, h); }
  }
}
function drawPdfPage(p, plan, page, idx, o) {
  const { W, H } = plan, C = INK[o.ink];
  drawBackground(p, o, W, H, idx, plan.pages[0].bandH || 0);
  if (o.border === 'page') p.rect(9, 9, W - 18, H - 18, { stroke:C.ink, width:0.4, r:1.5 });
  // boxes around parts (drawn under the text)
  (page.boxes || []).forEach(bx => p.rect(bx.x, bx.y0, bx.w, bx.y1 - bx.y0, { stroke: o.ink === 'color' ? bx.color : C.muted, width:0.35, r:2 }));
  // vertical lines between columns (landscape), only beside columns that hold something
  if (plan.cols > 1 && o.colLines) {
    for (let i = 0; i < plan.cols - 1 && i < (page.usedCols || 0); i++) {
      const x = plan.mx + plan.colW * (i + 1) + plan.gutter * (i + 0.5);
      p.line(x, page.colTop + 1, x, plan.bottom - 1, 0.25, C.rule);
    }
  }
  page.forEach(e => e.b.draw(p, e.x, e.y, e.w, e.cont));
  // footer (lifted clear of the border on framed pages)
  const fy = o.bg === 'paper' || o.bg === 'frame' || o.border === 'page' ? H - 11.5 : H - 6.8;
  p.line(15, fy - 3.7, W - 15, fy - 3.7, 0.2, C.rule);
  p.font('body', 7.5); p.color(C.muted);
  p.text(song.title + (song.artist ? ' — ' + song.artist : ''), 15, fy);
  p.text(`Page ${idx + 1} of ${plan.pages.length}`, W - 15, fy, 'right');
}

/* ================================================================
   export panel UI
   ================================================================ */
let pdfPlan = null, pdfRenderT = 0;
function openPdf() {
  $('#pdfModal').hidden = false;
  renderPdfOptions();
  schedulePdfPreview(0);
  $('#pdfClose').focus();
}
function closePdf() { $('#pdfModal').hidden = true; $('#pdfBtn').focus(); }
function savePdfOpts() { prefs.pdf = pdfOpts; savePrefs(); }
function renderPdfOptions() {
  const o = pdfOpts;
  const tog = (k, label, sub) => `<label class="pdf-tog"><input type="checkbox" data-po="${k}" id="po-${k}"${o[k] ? ' checked' : ''}><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  const seg = (k, opts) => `<div class="seg small" role="group">${opts.map(([v, l]) => `<button data-ps="${k}" data-v="${v}" aria-pressed="${o[k] === v}">${l}</button>`).join('')}</div>`;
  $('#pdfOpts').innerHTML = `
    <h3 class="po-h">Include</h3>
    <div class="pdf-togs">
      ${tog('chords', 'Chords', 'Names above the words')}
      ${tog('lyrics', 'Lyrics', 'The words')}
      ${tog('charts', 'Chord charts', 'Diagrams under the title')}
      ${tog('tabs', 'Riff tabs', 'Expanded where they play')}
      ${tog('details', 'Song details', 'Key, capo, tempo, order')}
    </div>
    <h3 class="po-h">Text size</h3>${seg('size', [['S', 'Small'], ['M', 'Medium'], ['L', 'Large'], ['XL', 'Extra large']])}
    <h3 class="po-h">Page</h3>
    <div class="po-row">${seg('orient', [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']])}${seg('paper', [['a4', 'A4'], ['letter', 'Letter']])}</div>
    <div class="po-row">${seg('ink', [['color', 'Colour'], ['saver', 'Ink saver']])}</div>
    <h3 class="po-h">Borders and lines</h3>
    <div class="po-row">${seg('border', [['none', 'No borders'], ['parts', 'Around parts'], ['page', 'Around page']])}</div>
    <div class="pdf-togs">${tog('colLines', 'Lines between columns', 'Used when the page has columns, as in landscape')}</div>
    <h3 class="po-h">Background</h3>
    <div class="bg-tiles">${Object.entries(BG).map(([k, l]) => `<button class="bg-tile" data-bg="${k}" aria-pressed="${o.bg === k}"><i class="bt-${k}"${k === 'image' && bgImage ? ` style="background-image:url('${bgImage.thumb || bgImage.src}')"` : ''}></i><span>${l}</span></button>`).join('')}</div>
    <div class="bg-img"${o.bg === 'image' ? '' : ' hidden'}>
      <label class="fld block">${bgImage ? 'Replace image' : 'Choose an image'}<input type="file" id="bgFile" accept="image/*"></label>
      ${bgImage ? `<div class="po-row">${seg('imgMode', [['faded', 'Faded page'], ['header', 'Header picture']])}<button class="tbtn" id="bgRemove">Remove image</button></div>` : '<p class="hint">Your image stays in this browser only.</p>'}
    </div>
    <p class="msg" id="pdfNote"></p>`;
}
function schedulePdfPreview(delay = 120) { clearTimeout(pdfRenderT); pdfRenderT = setTimeout(renderPdfPreview, delay); }
async function renderPdfPreview() {
  if ($('#pdfModal').hidden) return;
  try { await Promise.all(['400 12px "Young Serif"', '400 12px Figtree', '700 12px Figtree', '400 12px "JetBrains Mono"', '700 12px "JetBrains Mono"'].map(f => document.fonts.load(f))); } catch (e) {}
  const o = pdfOpts;
  const plan = planPdf(o);
  pdfPlan = plan.pick;
  const n = pdfPlan.pages.length;
  // suggestion banner
  const lp = plan.landscape.pages.length, pp = plan.portrait.pages.length;
  let sug = '';
  if (o.orient !== 'landscape' && plan.orient === 'portrait' && lp < pp) sug = `Landscape fits this on ${lp} page${lp > 1 ? 's' : ''} instead of ${pp}, with parts in ${plan.landscape.cols} labelled columns.`;
  else if (o.orient === 'portrait' && (lp < pp || ['L', 'XL'].includes(o.size))) sug = `Landscape would ${lp < pp ? `fit this on ${lp} page${lp > 1 ? 's' : ''} instead of ${pp}` : 'give large text more room'}, with parts in ${plan.landscape.cols} labelled columns.`;
  const sb = $('#pdfSuggest');
  sb.hidden = !sug;
  if (sug) sb.innerHTML = `<span>${sug}</span><button class="btn sm" data-ps="orient" data-v="landscape">Use landscape</button>`;
  $('#pdfSummary').textContent = `${n} page${n > 1 ? 's' : ''} · ${plan.orient === 'landscape' ? 'Landscape' : 'Portrait'}${pdfPlan.cols > 1 ? ', ' + pdfPlan.cols + ' columns' : ''} · ${o.paper === 'a4' ? 'A4' : 'Letter'}${o.orient === 'auto' ? ' (chosen automatically)' : ''}`;
  const unsupported = hasUnsupported(song.title + song.artist + song.sections.map(s => s.title + s.lines.map(l => l.lyrics).join('')).join(''));
  $('#pdfNote').textContent = (!o.chords && !o.lyrics && !o.tabs ? 'Turn on chords, lyrics or riff tabs to print the song itself. ' : '') +
    (unsupported ? 'Some characters (for example Hebrew letters) aren’t in the print fonts yet and show as “?”. ' : '') +
    (o.bg === 'image' && !bgImage ? 'Choose an image to use it as the background.' : '');
  if (o.bg === 'image' && bgImage && !bgImage.el) await loadBgEl();
  const wrap = $('#pdfPages');
  wrap.innerHTML = '';
  const pxPerMm = 2.4;
  pdfPlan.pages.forEach((pg, i) => {
    const fig = document.createElement('figure'); fig.className = 'pdf-page';
    const cv = document.createElement('canvas');
    fig.append(cv);
    const cap = document.createElement('figcaption'); cap.textContent = `Page ${i + 1}`; fig.append(cap);
    wrap.append(fig);
    drawPdfPage(canvasPainter(cv, pdfPlan.W, pdfPlan.H, pxPerMm), pdfPlan, pg, i, o);
  });
}
function loadBgEl() {
  return new Promise(res => { if (!bgImage) return res(); const im = new Image(); im.onload = () => { bgImage.el = im; res(); }; im.onerror = () => res(); im.src = bgImage.src; });
}
function readBgFile(file) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      // keep a moderate JPEG so it fits browser storage
      const s = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      const src = cv.toDataURL('image/jpeg', 0.85);
      const tc = document.createElement('canvas'); tc.width = 120; tc.height = Math.round(120 * cv.height / cv.width);
      tc.getContext('2d').drawImage(cv, 0, 0, tc.width, tc.height);
      bgImage = { src, thumb: tc.toDataURL('image/jpeg', 0.7) };
      bgCache.clear();
      try { localStorage.setItem(BG_IMG_KEY, JSON.stringify(bgImage)); }
      catch (e) { toast('The image works for now but is too large to remember in this browser.'); }
      pdfOpts.bg = 'image'; savePdfOpts();
      renderPdfOptions(); schedulePdfPreview(0);
    };
    im.onerror = () => toast('That file couldn’t be opened as an image.');
    im.src = r.result;
  };
  r.readAsDataURL(file);
}

/* ---------- making the file ---------- */
let jsPdfLoading = null;
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jsPdfLoading) jsPdfLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => window.jspdf ? res(window.jspdf) : rej(new Error('jsPDF did not load'));
    s.onerror = () => { jsPdfLoading = null; rej(new Error('jsPDF could not be downloaded')); };
    document.head.append(s);
  });
  return jsPdfLoading;
}
async function buildPdfFile() {
  const { jsPDF } = await loadJsPdf();
  const o = pdfOpts, plan = planPdf(o).pick;
  const doc = new jsPDF({ unit:'mm', format: o.paper === 'letter' ? 'letter' : 'a4', orientation: plan.W > plan.H ? 'landscape' : 'portrait', compress:true });
  [['YoungSerif.ttf', 'YoungSerif', 'normal', 'YoungSerif'], ['Figtree.ttf', 'Figtree', 'normal', 'Figtree'], ['FigtreeBold.ttf', 'Figtree', 'bold', 'FigtreeBold'],
   ['JBMono.ttf', 'JBMono', 'normal', 'JBMono'], ['JBMonoBold.ttf', 'JBMono', 'bold', 'JBMonoBold']].forEach(([file, fam, st, k]) => { doc.addFileToVFS(file, PDF_FONTS[k]); doc.addFont(file, fam, st); });
  doc.setProperties({ title: pdfText(song.title), subject: 'Song sheet', creator: 'Tabwright' });
  if (o.bg === 'image' && bgImage && !bgImage.el) await loadBgEl();
  const p = pdfPainter(doc);
  plan.pages.forEach((pg, i) => { if (i) doc.addPage(); drawPdfPage(p, plan, pg, i, o); });
  return doc.output('arraybuffer');
}
async function savePdf() {
  const btn = $('#pdfSave');
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'Making PDF…';
  try {
    const data = await buildPdfFile();
    const r = await saveFile(safeName(song.title) + '.pdf', data, 'application/pdf');
    toast(r === 'saved' ? 'PDF saved.' : 'PDF downloaded.');
  } catch (e) {
    $('#pdfNote').textContent = e && e.code === 'declined' ? 'Not saved. Press Save PDF again when you’re ready.' : saveErrorText(e, 'PDF');
  } finally { btn.disabled = false; btn.textContent = label; }
}

/* ---------- offline screen fonts: reuse the embedded print fonts if Google Fonts can't load ---------- */
(function registerEmbeddedFonts() {
  if (typeof FontFace === 'undefined' || !document.fonts || !PDF_FONTS) return;
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  [['Young Serif', 'YoungSerif', '400'], ['Figtree', 'Figtree', '400'], ['Figtree', 'FigtreeBold', '700'],
   ['JetBrains Mono', 'JBMono', '400'], ['JetBrains Mono', 'JBMonoBold', '700']].forEach(([fam, k, w]) => {
    try { const f = new FontFace(fam, b64(PDF_FONTS[k]), { weight:w, style:'normal' }); document.fonts.add(f); f.load().catch(() => {}); } catch (e) {}
  });
})();

function bindPdf() {
  $('#pdfBtn').addEventListener('click', openPdf);
  $('#pdfClose').addEventListener('click', closePdf);
  $('#pdfModal').addEventListener('click', e => {
    if (e.target.id === 'pdfModal') { closePdf(); return; }
    const s = e.target.closest('[data-ps]');
    if (s) { pdfOpts[s.dataset.ps] = s.dataset.v; savePdfOpts(); renderPdfOptions(); schedulePdfPreview(0); return; }
    const b = e.target.closest('[data-bg]');
    if (b) { pdfOpts.bg = b.dataset.bg; savePdfOpts(); renderPdfOptions(); schedulePdfPreview(0); return; }
    if (e.target.id === 'bgRemove') { bgImage = null; bgCache.clear(); try { localStorage.removeItem(BG_IMG_KEY); } catch (x) {} pdfOpts.bg = 'blank'; savePdfOpts(); renderPdfOptions(); schedulePdfPreview(0); return; }
    if (e.target.id === 'pdfSave') savePdf();
  });
  $('#pdfModal').addEventListener('change', e => {
    if (e.target.dataset.po) { pdfOpts[e.target.dataset.po] = e.target.checked; savePdfOpts(); schedulePdfPreview(); }
    if (e.target.id === 'bgFile' && e.target.files[0]) readBgFile(e.target.files[0]);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pdfModal').hidden) closePdf(); });
}
bindPdf();
