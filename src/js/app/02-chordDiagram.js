/* ================================================================
   chordDiagram.js — SVG chord boxes
   ================================================================ */
function ordinal(n) { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function boxSVG(v, c, size) {
  const W = 112, X0 = 24, DX = 15, Y0 = 30, DY = 20, H = size === 'lg' ? 150 : 136;
  if (!v || !c) return `<svg class="cbox ${size}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><text x="56" y="80" class="cb-none" text-anchor="middle">no shape</text></svg>`;
  const tun = tuning();
  const fr = v.frets.filter(f => f > 0);
  const maxF = fr.length ? Math.max(...fr) : 0, minF = fr.length ? Math.min(...fr) : 0;
  const start = maxF <= 4 ? 1 : minF;
  let g = '';
  for (let j = 0; j <= 5; j++) g += `<line class="cb-fret" x1="${X0}" x2="${X0 + 5 * DX}" y1="${Y0 + j * DY}" y2="${Y0 + j * DY}"/>`;
  for (let i = 0; i < 6; i++) g += `<line class="cb-str" x1="${X0 + i * DX}" x2="${X0 + i * DX}" y1="${Y0}" y2="${Y0 + 5 * DY}"/>`;
  if (start === 1) g += `<rect class="cb-nut" x="${X0 - 1}" y="${Y0 - 4}" width="${5 * DX + 2}" height="5" rx="1"/>`;
  else g += `<text class="cb-pos" x="${X0 - 7}" y="${Y0 + DY * 0.5 + 4}" text-anchor="end">${start}fr</text>`;
  if (v.barre) {
    const y = Y0 + (v.barre.fret - start + 0.5) * DY;
    g += `<rect class="cb-barre" x="${X0 + v.barre.from * DX - 7}" y="${y - 7}" width="${(v.barre.to - v.barre.from) * DX + 14}" height="14" rx="7"/>`;
  }
  v.frets.forEach((f, s) => {
    const x = X0 + s * DX;
    const isRoot = f >= 0 && mod12(tun[s] + f) === c.rootPc;
    if (f < 0) g += `<text class="cb-mute" x="${x}" y="${Y0 - 9}" text-anchor="middle">×</text>`;
    else if (f === 0) g += `<circle class="cb-open${isRoot ? ' root' : ''}" cx="${x}" cy="${Y0 - 13}" r="4"/>`;
    else {
      const y = Y0 + (f - start + 0.5) * DY;
      g += `<circle class="cb-dot${isRoot ? ' root' : ''}" cx="${x}" cy="${y}" r="7"/>`;
      if (v.fingers[s]) g += `<text class="cb-fing${isRoot ? ' root' : ''}" x="${x}" y="${y + 3.5}" text-anchor="middle">${v.fingers[s]}</text>`;
    }
    if (size === 'lg' && f >= 0) g += `<text class="cb-note" x="${x}" y="${Y0 + 5 * DY + 15}" text-anchor="middle">${pretty(noteName(tun[s] + f, parseKey(song.key).flat))}</text>`;
  });
  return `<svg class="cbox ${size}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg>`;
}
