/* ================================================================
   tunings + voicingFinder.js — playable chord shapes for any tuning
   ================================================================ */
const TUNINGS = {
  standard: { name:'Standard (E A D G B E)',    midi:[40,45,50,55,59,64] },
  dropD:    { name:'Drop D (D A D G B E)',      midi:[38,45,50,55,59,64] },
  halfDown: { name:'Half-step down (E♭)',       midi:[39,44,49,54,58,63] },
  openG:    { name:'Open G (D G D G B D)',      midi:[38,43,50,55,59,62] },
  openD:    { name:'Open D (D A D F♯ A D)',     midi:[38,45,50,54,57,62] },
  openE:    { name:'Open E (E B E G♯ B E)',     midi:[40,47,52,56,59,64] },
  dadgad:   { name:'DADGAD',                     midi:[38,45,50,55,57,62] },
};

/** Assign fingers 1-4 to a fret array; returns null when the hand can't do it. */
function assignFingers(frets) {
  const notes = [];
  for (let s = 0; s < 6; s++) if (frets[s] > 0) notes.push({ s, f:frets[s] });
  const fingers = new Array(6).fill(0);
  if (!notes.length) return { fingers, barre:null, count:0 };
  const byOrder = (a, b) => a.f - b.f || a.s - b.s;
  if (notes.length <= 4) {
    notes.slice().sort(byOrder).forEach((n, i) => { fingers[n.s] = i + 1; });
    return { fingers, barre:null, count:notes.length };
  }
  const minF = Math.min(...notes.map(n => n.f));
  const atMin = notes.filter(n => n.f === minF);
  if (atMin.length < 2) return null;
  const from = atMin[0].s, to = atMin[atMin.length - 1].s;
  for (let s = from; s <= to; s++) if (frets[s] === 0) return null; // open string under a barre
  const rest = notes.filter(n => n.f > minF).sort(byOrder);
  if (rest.length > 3) return null;
  atMin.forEach(n => { fingers[n.s] = 1; });
  rest.forEach((n, i) => { fingers[n.s] = i + 2; });
  return { fingers, barre:{ fret:minF, from, to }, count:1 + rest.length };
}

/** Search every 4-fret window up the neck for playable shapes, score them, keep a spread. */
function findVoicings(c, tuning) {
  const tones = new Set(chordPcs(c));
  const fifth = mod12(c.rootPc + 7);
  const canDropFifth = tones.size >= 4 && c.iv.includes(7);
  const required = [...tones].filter(pc => !(canDropFifth && pc === fifth));
  const minStrings = tones.size <= 2 ? 3 : 4;
  const seen = new Map();
  const frets = new Array(6);

  function evaluate() {
    const snd = [];
    for (let s = 0; s < 6; s++) if (frets[s] >= 0) snd.push(s);
    if (snd.length < minStrings) return;
    const a = snd[0], b = snd[snd.length - 1];
    let interior = 0;
    for (let s = a; s <= b; s++) if (frets[s] < 0) interior++;
    if (interior > 1) return;
    const pcs = new Set(snd.map(s => mod12(tuning[s] + frets[s])));
    for (const r of required) if (!pcs.has(r)) return;
    const fr = snd.filter(s => frets[s] > 0).map(s => frets[s]);
    const minF = fr.length ? Math.min(...fr) : 0, maxF = fr.length ? Math.max(...fr) : 0;
    const fing = assignFingers(frets);
    if (!fing) return;
    const opens = snd.filter(s => frets[s] === 0).length;
    let score = minF * 0.22 + fing.count * 0.42 + (fing.barre ? 0.6 : 0) + interior * 2.4
      + a * 0.35 + (5 - b) * (c.q === '5' ? 0.15 : 1.0) - opens * 0.25 - (snd.length - 4) * 0.3 + (maxF - minF) * 0.2;
    if (canDropFifth && !pcs.has(fifth)) score += 0.3;
    if (opens && minF >= 5) score += 0.6;
    if (maxF >= 4) { // open strings ringing inside a stretched shape sound and feel awkward
      const lo = snd.find(s => frets[s] > 0), hiS = [...snd].reverse().find(s => frets[s] > 0);
      for (let s = lo + 1; s < hiS; s++) if (frets[s] === 0) score += 1.0;
    }
    const k = frets.join(',');
    if (!seen.has(k) || seen.get(k).score > score) {
      seen.set(k, { frets:[...frets], fingers:fing.fingers, barre:fing.barre, minF, maxF, opens, score,
                    pos: opens && minF <= 4 ? 0 : minF });
    }
  }
  for (let base = 1; base <= 12; base++) {
    const hi = base + 3, allowOpen = base <= 4;
    const opts = tuning.map(open => {
      const o = [-1];
      if (allowOpen && (tones.has(mod12(open)) || mod12(open) === c.bassPc)) o.push(0);
      for (let f = base; f <= hi; f++) { const pc = mod12(open + f); if (tones.has(pc) || pc === c.bassPc) o.push(f); }
      return o;
    });
    (function dfs(s, started) {
      if (s === 6) { evaluate(); return; }
      for (const f of opts[s]) {
        if (f >= 0) {
          const pc = mod12(tuning[s] + f);
          if (!started && pc !== c.bassPc) continue;       // lowest note must be the bass
          if (started && !tones.has(pc)) continue;          // slash bass only at the bottom
        }
        frets[s] = f;
        dfs(s + 1, started || f >= 0);
      }
    })(0, false);
  }
  const all = [...seen.values()].sort((x, y) => x.score - y.score);
  const picked = [];
  for (const v of all) {
    if (picked.length >= 6) break;
    if (picked.some(o => Math.abs(o.pos - v.pos) < 2)) continue;
    picked.push(v);
  }
  for (const v of all) { if (picked.length >= 6) break; if (!picked.includes(v)) picked.push(v); }
  if (!picked.length) return [];
  const [best, ...rest] = picked;
  return [best, ...rest.sort((x, y) => x.pos - y.pos || x.score - y.score)];
}
const voicingCache = new Map();
function getVoicings(sym, tuningId) {
  const k = sym + '|' + tuningId;
  if (voicingCache.has(k)) return voicingCache.get(k);
  const c = parseChord(sym);
  const res = c ? findVoicings(c, (TUNINGS[tuningId] || TUNINGS.standard).midi) : [];
  voicingCache.set(k, res);
  return res;
}
