/* ================================================================
   musicTheory.js — notes, chord parsing, keys, roman numerals
   ================================================================ */
const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const LETTER = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const mod12 = n => ((n % 12) + 12) % 12;

/** Pitch class (0-11) of a note name like "F#", "Bb", "E". */
function notePc(name) {
  const m = /^([A-G])(#|b)?/.exec(name || '');
  if (!m) return null;
  return mod12(LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
}
function noteName(pc, flat) { return (flat ? FLATS : SHARPS)[mod12(pc)]; }
/** Display form with real accidentals (data stays ASCII). */
function pretty(s) { return String(s).replace(/#/g, '♯').replace(/([A-G])b/g, '$1♭'); }

const QUALITY = {
  '':      { iv:[0,4,7],      name:'major' },
  'm':     { iv:[0,3,7],      name:'minor' },
  '5':     { iv:[0,7],        name:'power chord' },
  '6':     { iv:[0,4,7,9],    name:'major 6th' },
  'm6':    { iv:[0,3,7,9],    name:'minor 6th' },
  '7':     { iv:[0,4,7,10],   name:'dominant 7th' },
  'maj7':  { iv:[0,4,7,11],   name:'major 7th' },
  'm7':    { iv:[0,3,7,10],   name:'minor 7th' },
  'mmaj7': { iv:[0,3,7,11],   name:'minor-major 7th' },
  '9':     { iv:[0,4,7,10,2], name:'dominant 9th' },
  'maj9':  { iv:[0,4,7,11,2], name:'major 9th' },
  'm9':    { iv:[0,3,7,10,2], name:'minor 9th' },
  'add9':  { iv:[0,4,7,2],    name:'added 9th' },
  'madd9': { iv:[0,3,7,2],    name:'minor added 9th' },
  'sus2':  { iv:[0,2,7],      name:'suspended 2nd' },
  'sus4':  { iv:[0,5,7],      name:'suspended 4th' },
  '7sus4': { iv:[0,5,7,10],   name:'7th suspended 4th' },
  'dim':   { iv:[0,3,6],      name:'diminished' },
  'dim7':  { iv:[0,3,6,9],    name:'diminished 7th' },
  'm7b5':  { iv:[0,3,6,10],   name:'half-diminished' },
  'aug':   { iv:[0,4,8],      name:'augmented' },
};
const ALIAS = { M:'', maj:'', min:'m', '-':'m', M7:'maj7', 'Δ':'maj7', 'Δ7':'maj7', min7:'m7', '-7':'m7',
  '°':'dim', o:'dim', '°7':'dim7', o7:'dim7', 'ø':'m7b5', 'ø7':'m7b5', '+':'aug', sus:'sus4',
  '2':'sus2', '4':'sus4', add2:'add9', min6:'m6', mM7:'mmaj7', mMaj7:'mmaj7' };

const chordCache = new Map();
/** Parse "F#m7", "D/F#", "Cadd9" → chord object, or null if it isn't a chord. */
function parseChord(sym) {
  sym = String(sym || '').trim();
  if (chordCache.has(sym)) return chordCache.get(sym);
  let res = null;
  const m = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/.exec(sym);
  if (m) {
    let q = m[2];
    if (ALIAS[q] !== undefined) q = ALIAS[q];
    if (QUALITY[q]) {
      const rootPc = notePc(m[1]);
      res = { sym, root:m[1], q, rootPc, bass:m[3] || null, bassPc: m[3] ? notePc(m[3]) : rootPc,
              iv: QUALITY[q].iv, qname: QUALITY[q].name };
    }
  }
  chordCache.set(sym, res);
  return res;
}
function chordPcs(c) { return [...new Set(c.iv.map(i => mod12(c.rootPc + i)))]; }
/** Reduce any quality to its underlying triad family. */
function baseTriad(q) {
  if (q === 'dim' || q === 'dim7' || q === 'm7b5') return 'dim';
  if (q === 'aug') return 'aug';
  if (q === '5') return '5';
  if (/^m(?!aj)/.test(q)) return 'm';
  return '';
}
const IV_LABEL = ['1','♭2','2','♭3','3','4','♭5','5','♯5','6','♭7','7'];
function intervalLabel(semi, chord) {
  semi = mod12(semi);
  if (chord) {
    if (semi === 2 && chord.iv.includes(2) && chord.q !== 'sus2') return '9';
    if (semi === 9 && chord.q === 'dim7') return '♭♭7';
  }
  return IV_LABEL[semi];
}

/* ---------- keys ---------- */
const FLAT_MAJORS = [5, 10, 3, 8, 1]; // F Bb Eb Ab Db
function parseKey(name) {
  name = String(name || 'C');
  const tonic = notePc(name);
  if (tonic == null) return parseKey('C');
  const minor = /m$/.test(name);
  const rel = minor ? mod12(tonic + 3) : tonic;
  const acc = name.slice(1);
  const flat = acc.startsWith('b') ? true : acc.startsWith('#') ? false : FLAT_MAJORS.includes(rel);
  return { name, tonic, minor, flat, label: pretty(noteName(tonic, flat)) + (minor ? ' minor' : ' major') };
}
function keyNameFor(pc, minor) {
  const rel = mod12(minor ? pc + 3 : pc);
  return noteName(pc, FLAT_MAJORS.includes(rel)) + (minor ? 'm' : '');
}
const SCALES = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10] };
const PENTA  = { major:[0,2,4,7,9],      minor:[0,3,5,7,10] };
const ROMAN = ['I','II','III','IV','V','VI','VII'];

function functionOf(deg, minor) {
  if (minor) return [0,2].includes(deg) ? 'Tonic' : [1,3,5].includes(deg) ? 'Pre-dominant' : 'Dominant';
  return [0,2,5].includes(deg) ? 'Tonic' : [1,3].includes(deg) ? 'Pre-dominant' : 'Dominant';
}
/** The seven diatonic triads of a key, built by stacking scale thirds. */
function diatonic(key) {
  const sc = SCALES[key.minor ? 'minor' : 'major'];
  return sc.map((r, d) => {
    const third = mod12(sc[(d + 2) % 7] - r), fifth = mod12(sc[(d + 4) % 7] - r);
    const q = third === 4 && fifth === 7 ? '' : third === 3 && fifth === 7 ? 'm' : third === 3 && fifth === 6 ? 'dim' : '';
    const pc = mod12(key.tonic + r);
    let numeral = ROMAN[d];
    if (q === 'm') numeral = numeral.toLowerCase();
    if (q === 'dim') numeral = numeral.toLowerCase() + '°';
    return { deg:d, pc, q, name: noteName(pc, key.flat) + q, numeral, fn: functionOf(d, key.minor) };
  });
}
const SUFFIX = { '':'', m:'', dim:'°', '7':'7', maj7:'maj7', m7:'7', m7b5:'ø7', dim7:'°7', aug:'+', sus2:'sus2',
  sus4:'sus4', '7sus4':'7sus4', add9:'add9', madd9:'add9', '6':'6', m6:'6', '9':'9', maj9:'maj9', m9:'9', '5':'5', mmaj7:'maj7' };
const CHROM = ['I','♭II','II','♭III','III','IV','♯IV','V','♭VI','VI','♭VII','VII'];

/** Diatonic degree a chord plays in this key (or null). */
function degreeOf(c, key, dia) {
  const bt = baseTriad(c.q);
  const d = dia.find(x => x.pc === c.rootPc && x.q === bt);
  if (d) return d.deg;
  if (key.minor && bt === '' && c.rootPc === mod12(key.tonic + 7)) return 4; // harmonic-minor V
  return null;
}
/** Roman numeral + harmonic function of any chord in a key. */
function romanFor(sym, key) {
  const c = parseChord(sym);
  if (!c) return { numeral:'?', fn:'' };
  const dia = diatonic(key), bt = baseTriad(c.q), suf = SUFFIX[c.q] ?? '';
  const d = dia.find(x => x.pc === c.rootPc && x.q === bt);
  if (d) { const base = ROMAN[d.deg]; return { numeral:(bt === '' ? base : base.toLowerCase()) + suf, fn:d.fn, diatonic:true }; }
  if (bt === '' && ['', '7', '9'].includes(c.q)) {
    const target = dia.find(x => x.pc === mod12(c.rootPc + 5) && x.q !== 'dim' && x.deg !== 0);
    if (target && !(key.minor && c.rootPc === mod12(key.tonic + 7))) return { numeral:'V' + suf + '/' + target.numeral, fn:'Secondary dominant' };
  }
  if (key.minor && bt === '' && c.rootPc === mod12(key.tonic + 7)) return { numeral:'V' + suf, fn:'Dominant' };
  let n = CHROM[mod12(c.rootPc - key.tonic)];
  if (bt === 'm' || bt === 'dim') n = n.replace(/[IV]+/, s => s.toLowerCase());
  return { numeral: n + suf, fn:'Borrowed' };
}
