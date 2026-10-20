/* ================================================================
   chordRecommender.js — next-chord suggestions
   ================================================================ */
// Weighted degree-to-degree motion (common practice + pop usage). Index = scale degree 0-6.
const T_MAJOR = {
  0:{3:.9, 4:.9, 5:.8, 1:.6, 2:.35, 6:.15},
  1:{4:1, 6:.5, 3:.35, 0:.3},
  2:{5:.9, 3:.7, 1:.3},
  3:{4:.9, 0:.85, 1:.6, 5:.4},
  4:{0:1, 5:.75, 3:.4},
  5:{3:.85, 1:.8, 4:.6, 2:.3},
  6:{0:1, 2:.5},
};
const T_MINOR = {
  0:{3:.9, 5:.85, 6:.7, 4:.7, 2:.5, 1:.3},
  1:{4:1, 6:.4},
  2:{5:.8, 3:.7, 6:.5},
  3:{4:.9, 0:.8, 6:.6, 1:.4},
  4:{0:1, 5:.7},
  5:{6:.85, 3:.6, 4:.6, 2:.5, 0:.4},
  6:{2:.9, 0:.8, 5:.4},
};
const MOVES = {
  'Tonic>Pre-dominant':'moves away from home',
  'Tonic>Dominant':'jumps straight to tension',
  'Tonic>Tonic':'swaps to a tonic relative',
  'Pre-dominant>Dominant':'builds toward the cadence',
  'Pre-dominant>Tonic':'plagal “amen” return home',
  'Pre-dominant>Pre-dominant':'stretches the pre-dominant',
  'Dominant>Tonic':'resolves the tension',
  'Dominant>Pre-dominant':'backs off the tension',
  'Dominant>Dominant':'extends the dominant',
};
function isDominantShape(c, key, dia) {
  if (['7','9','7sus4'].includes(c.q)) return true;
  return c.q === '' && degreeOf(c, key, dia) === null;
}

/**
 * Rank likely next chords.
 * @param {string|null} prevSym  chord the progression is currently on
 * @param {string|null} prev2Sym chord before that (avoids ping-pong)
 * @param {object} key           parseKey() result
 */
function recommend(prevSym, prev2Sym, key) {
  const dia = diatonic(key);
  const prev = prevSym ? parseChord(prevSym) : null;
  const prev2 = prev2Sym ? parseChord(prev2Sym) : null;
  const T = key.minor ? T_MINOR : T_MAJOR;
  const cands = new Map();
  const add = (name, meta) => { if (!cands.has(name) && parseChord(name)) cands.set(name, { name, ...meta }); };

  dia.forEach(d => add(d.name, { kind:'diatonic', deg:d.deg, fn:d.fn, numeral:d.numeral }));
  add(noteName(key.tonic + 7, key.flat) + '7', { kind:'dom7', deg:4, fn:'Dominant', numeral:'V7' });
  dia.filter(d => d.deg !== 0 && d.q !== 'dim').forEach(t => {
    add(noteName(t.pc + 7, key.flat) + '7', { kind:'secdom', target:t, fn:'Secondary dominant', numeral:'V7/' + t.numeral });
  });
  if (!key.minor) {
    add(noteName(key.tonic + 10, true), { kind:'borrowed', fn:'Borrowed', numeral:'♭VII' });
    add(noteName(key.tonic + 5, key.flat) + 'm', { kind:'borrowed', fn:'Borrowed', numeral:'iv' });
    add(noteName(key.tonic + 8, true), { kind:'borrowed', fn:'Borrowed', numeral:'♭VI' });
  } else {
    add(noteName(key.tonic + 5, key.flat), { kind:'borrowed', fn:'Borrowed', numeral:'IV' });
  }

  const pd = prev ? degreeOf(prev, key, dia) : null;
  const prevFn = pd != null ? functionOf(pd, key.minor) : null;
  const out = [];
  for (const c of cands.values()) {
    const cp = parseChord(c.name);
    const why = [];
    let s = c.kind === 'diatonic' ? 0.35 : c.kind === 'dom7' ? 0.3 : c.kind === 'secdom' ? 0.12 : 0.08;

    if (prev) {
      const same = prev.rootPc === cp.rootPc && baseTriad(prev.q) === baseTriad(cp.q);
      if (same) s -= 0.9;
      if (pd != null && c.deg != null && !same) {
        const w = (T[pd] || {})[c.deg] || 0;
        if (w) {
          s += w;
          const toFn = functionOf(c.deg, key.minor);
          let phrase = MOVES[prevFn + '>' + toFn] || '';
          if (!key.minor && pd === 4 && c.deg === 5) phrase = 'deceptive cadence';
          if (pd === 4 && c.deg === 0) phrase = 'authentic cadence, resolves home';
          why.push(phrase);
        }
      }
      const rootMove = mod12(cp.rootPc - prev.rootPc);
      if (rootMove === 5 && !same) { s += 0.3; why.push('root falls a fifth around the circle'); }
      if (rootMove === 2 || rootMove === 10) s += 0.06;
      if (isDominantShape(prev, key, dia) && mod12(prev.rootPc + 5) === cp.rootPc && c.kind !== 'secdom') {
        s += 0.9; why.unshift(`${pretty(prev.sym)} acts as its V and pulls here`);
      }
      if (c.kind === 'secdom' && pd != null) {
        const w = (T[pd] || {})[c.target.deg] || 0;
        s += w * 0.55;
        why.push(`borrowed dominant that leads into ${pretty(c.target.name)}`);
      }
      if (prev2 && prev2.sym === c.name) s -= 0.15;
    } else {
      if (c.kind === 'diatonic' && c.deg === 0) { s += 1; why.push('establishes the key'); }
      else if (c.kind === 'diatonic' && (c.deg === 3 || c.deg === 5)) s += 0.4;
    }
    if (!why.length) {
      why.push(c.kind === 'diatonic' ? 'stays inside the key' :
               c.kind === 'secdom' ? `borrowed dominant that leads into ${pretty(c.target.name)}` :
               c.kind === 'dom7' ? 'adds a stronger pull home' : 'colour from the parallel key');
    }
    out.push({ ...c, score:s, why: [...new Set(why)].slice(0, 2).join(' · ') });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
