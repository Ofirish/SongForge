/* ================================================================
   phraseGenerator.js — riffs, licks and solos over a part's chords
   ================================================================ */
/** Small seeded PRNG (mulberry32) so each press gives a new but repeatable take. */
function makeRng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Chords of one part as [{sym, beats}], merging repeats of the same chord. */
function backingForSection(song, si) {
  const out = [];
  for (const e of buildTimeline(song, si).events) {
    if (!e.sym) continue;
    const last = out[out.length - 1];
    if (last && last.sym === e.sym) last.beats += e.beats; else out.push({ sym:e.sym, beats:e.beats });
  }
  return out;
}
function trimBacking(backing, beats) {
  const out = []; let acc = 0;
  for (const b of backing) { if (acc >= beats) break; const n = Math.min(b.beats, beats - acc); out.push({ sym:b.sym, beats:n }); acc += n; }
  if (acc < beats && out.length) out[out.length - 1].beats += beats - acc;
  return out;
}
function chordAtBeat(backing, beat) {
  let acc = 0;
  for (const c of backing) { if (beat < acc + c.beats) return c.sym; acc += c.beats; }
  return backing.length ? backing[backing.length - 1].sym : null;
}
/** Playable notes inside a fret box, one position per pitch, ordered low → high. */
function boxPositions(tuning, pcs, sMin, sMax, fMin, fMax) {
  const byMidi = new Map(), mid = (fMin + fMax) / 2;
  for (let s = sMin; s <= sMax; s++) for (let f = Math.max(0, fMin); f <= fMax; f++) {
    const m = tuning[s] + f;
    if (!pcs.has(mod12(m))) continue;
    const prev = byMidi.get(m);
    if (!prev || Math.abs(f - mid) < Math.abs(prev.f - mid)) byMidi.set(m, { s, f, m, pc:mod12(m) });
  }
  return [...byMidi.values()].sort((a, b) => a.m - b.m);
}
const RHYTHM = {
  riff: ['10101101', '10011010', '11010110', '10110100', '10100111'],
  lick: ['11110100', '10111010', '11101100', '01111010'],
  lickEnd: ['10101000', '11001000', '10110000'],
  solo: ['1011010110100000', '0101101111010000', '1111000010111000', '1001011010000000', '0011110101101000', '1010101011110000'],
};

/**
 * Create a riff, lick or solo over a chord backing.
 * @param {'riff'|'lick'|'solo'} kind
 * @param {{sym:string,beats:number}[]} backing  chords of the chosen part
 * @returns {{steps:number, notes:Object, backing:Array}}
 */
function generatePhrase(kind, backing, key, tuning, seed) {
  const rng = makeRng(seed);
  const pick = a => a[Math.floor(rng() * a.length)];
  const total = backing.reduce((a, b) => a + b.beats, 0) || 4;
  const bars = clamp(Math.ceil(total / 4), 1, kind === 'riff' ? 4 : kind === 'lick' ? 2 : 16);
  const steps = bars * 8;
  const back = trimBacking(backing.length ? backing : [{ sym:noteName(key.tonic, key.flat) + (key.minor ? 'm' : ''), beats:steps / 2 }], steps / 2);
  const symAt = st => chordAtBeat(back, st / 2);
  const tonesAt = st => { const c = parseChord(symAt(st) || ''); return c ? new Set(chordPcs(c)) : new Set([key.tonic]); };
  const rootAt = st => { const c = parseChord(symAt(st) || ''); return c ? c.rootPc : key.tonic; };
  const mode = key.minor ? 'minor' : 'major';
  const pent = PENTA[mode].map(i => mod12(key.tonic + i));
  const scale = SCALES[mode].map(i => mod12(key.tonic + i));
  const allChordTones = new Set(back.flatMap(b => chordPcs(parseChord(b.sym))));
  const minorRoot = key.minor ? key.tonic : mod12(key.tonic + 9);   // pentatonic box anchor
  let pcs, pos;
  if (kind === 'riff') {
    pcs = new Set([...pent, ...allChordTones]);
    pos = boxPositions(tuning, pcs, 0, 3, 0, 5);
  } else {
    let base = mod12(minorRoot - tuning[0]);
    if (kind === 'solo' && base < 5) base += 12;
    pcs = new Set(kind === 'solo' ? [...pent, ...scale] : pent);
    if (kind === 'lick') pcs = new Set([...pent, ...allChordTones].filter(p => scale.includes(p) || pent.includes(p)));
    pos = boxPositions(tuning, pcs, kind === 'lick' ? 2 : 1, 5, Math.max(0, base - 1), base + (kind === 'solo' ? 4 : 3));
  }
  if (pos.length < 4) return { steps, notes:{}, backing:back };
  const nearestTone = (idx, set, reach = 3) => {
    let best = idx, bd = 99;
    for (let d = -reach; d <= reach; d++) { const j = idx + d; if (j >= 0 && j < pos.length && set.has(pos[j].pc) && Math.abs(d) < bd) { best = j; bd = Math.abs(d); } }
    return best;
  };
  const line = [];   // [{step, idx}]

  if (kind === 'riff') {
    const rhythm = pick(RHYTHM.riff);
    const slots = [...rhythm].map((c, i) => c === '1' ? i : -1).filter(i => i >= 0);
    // one motif (offsets from the chord root), reused on every bar so the riff hangs together
    let o = 0; const motif = slots.map((_, j) => { if (j === 0) return 0; o = clamp(o + pick([1, 2, 1, -1, 2, 3, 0]), -1, 5); return o; });
    const rootIdx = st => { const r = rootAt(st); const low = pos.findIndex(p => p.pc === r && p.s <= 1); return low >= 0 ? low : Math.max(0, pos.findIndex(p => p.pc === r)); };
    for (let b = 0; b < bars; b++) slots.forEach((sl, j) => {
      const st = b * 8 + sl;
      let idx = clamp(rootIdx(st) + motif[j], 0, pos.length - 1);
      if (sl % 4 === 0) idx = j === 0 ? rootIdx(st) : nearestTone(idx, tonesAt(st), 2);
      line.push({ step:st, idx });
    });
    // last bar: walk down into the first chord's root for the loop back
    const target = rootIdx(0), tail = line.filter(n => n.step >= (bars - 1) * 8 + 4);
    tail.forEach((n, i) => { n.idx = clamp(target + (tail.length - i), 0, pos.length - 1); });
  } else {
    let rhythm = '';
    if (kind === 'lick') { for (let b = 0; b < bars; b++) rhythm += b === bars - 1 ? pick(RHYTHM.lickEnd) : pick(RHYTHM.lick); }
    else { while (rhythm.length < steps) rhythm += pick(RHYTHM.solo); rhythm = rhythm.slice(0, steps); if (!rhythm.slice(-8).includes('1')) rhythm = rhythm.slice(0, -8) + '10100000'; }
    let idx = nearestTone(Math.floor(pos.length * (kind === 'solo' ? 0.45 : 0.55)), tonesAt(0));
    let dir = rng() < 0.5 ? 1 : -1;
    for (let st = 0; st < steps; st++) {
      if (rhythm[st] !== '1') continue;
      const phrasePos = (st % 16) / 16;
      if (rng() < 0.25) dir = -dir;
      if (phrasePos > 0.5 && rng() < 0.35) dir = -1;              // phrases tend to fall at the end
      const r = rng(), step = r < 0.5 ? 1 : r < 0.8 ? 2 : r < 0.92 ? 0 : 3;
      idx += dir * step;
      if (idx < 1) { idx = 1 + (1 - idx); dir = 1; }
      if (idx > pos.length - 2) { idx = pos.length - 2 - (idx - pos.length + 2); dir = -1; }
      idx = clamp(idx, 0, pos.length - 1);
      if (st % 4 === 0) idx = nearestTone(idx, tonesAt(st));
      line.push({ step:st, idx });
    }
    // land the final note on the root of the last chord
    if (line.length) { const last = line[line.length - 1]; const r = rootAt(last.step); last.idx = nearestTone(last.idx, new Set([r]), 5); }
  }

  // turn the line into tab notes and add techniques
  const notes = {};
  line.forEach((n, i) => {
    const p = pos[n.idx], prev = line[i - 1] && pos[line[i - 1].idx], next = line[i + 1];
    let f = p.f, t = '';
    const gapNext = next ? next.step - n.step : steps - n.step;
    if (prev && prev.s === p.s && n.step - line[i - 1].step <= 2) {
      const d = p.f - prev.f;
      if (d > 0 && d <= 3) t = rng() < 0.75 ? 'h' : '';
      else if (d < 0 && d >= -3) t = rng() < 0.7 ? 'p' : '';
      else if (Math.abs(d) >= 3 && kind !== 'riff' && rng() < 0.6) t = d > 0 ? '/' : '\\';
    }
    // bends: a long note on a chord tone is played two frets lower and bent up to it
    if (!t && kind !== 'riff' && gapNext >= 3 && p.s >= 2 && p.f >= 3 && tonesAt(n.step).has(p.pc) && rng() < (kind === 'solo' ? 0.55 : 0.3)) { f = p.f - 2; t = 'b'; }
    if (!t && kind !== 'riff' && (i === line.length - 1 || gapNext >= 4) && rng() < 0.7) t = '~';
    notes[n.step + ':' + p.s] = { f, t };
  });
  return { steps, notes, backing:back };
}
