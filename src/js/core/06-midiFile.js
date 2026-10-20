/* ================================================================
   midiFile.js — Standard MIDI File and ZIP writers (no DOM)
   ================================================================ */
const MIDI_PPQ = 480;                       // ticks per quarter note; one tab step (eighth) = 240

/** Growable byte buffer (avoids spreading huge arrays into push()). */
class ByteBuf {
  constructor() { this.a = []; }
  u8(...v) { for (const x of v) this.a.push(x & 0xFF); return this; }
  u16(n) { return this.u8(n >> 8, n); }
  u32(n) { return this.u8(n >>> 24, n >>> 16, n >>> 8, n); }
  le16(n) { return this.u8(n, n >> 8); }
  le32(n) { return this.u8(n, n >>> 8, n >>> 16, n >>> 24); }
  bytes(arr) { for (let i = 0; i < arr.length; i++) this.a.push(arr[i] & 0xFF); return this; }
  vlq(n) {
    n = Math.max(0, Math.round(n));
    const b = [n & 0x7F];
    while ((n >>= 7) > 0) b.unshift((n & 0x7F) | 0x80);
    return this.bytes(b);
  }
  toUint8() { return Uint8Array.from(this.a); }
}
const utf8 = s => Array.from(new TextEncoder().encode(String(s)));

/** Meta event at tick t. type: 0x03 track name, 0x05 lyric, 0x06 marker, 0x51 tempo, 0x58 time sig, 0x59 key sig. */
function midiMeta(t, type, data) { return { t, o:-1, d:[0xFF, type, ...vlqBytes(data.length), ...data] }; }
function vlqBytes(n) { const b = new ByteBuf(); b.vlq(n); return b.a; }
function midiTempo(t, bpm) { const us = Math.round(60000000 / bpm); return midiMeta(t, 0x51, [us >> 16 & 0xFF, us >> 8 & 0xFF, us & 0xFF]); }
function midiKeySig(t, key) {
  // sharps (+) / flats (-) of the key signature, from its relative major
  const major = key.minor ? mod12(key.tonic + 3) : key.tonic;
  const i = [0,7,2,9,4,11,6,1,8,3,10,5].indexOf(major);
  const sf = i <= 5 ? i : i === 6 ? (key.flat ? -6 : 6) : i - 12;
  return midiMeta(t, 0x59, [sf & 0xFF, key.minor ? 1 : 0]);
}
/** Pitch-bend event; `semis` relative to a bend range of `range` semitones. */
function midiBend(t, ch, semis, range) {
  const v = clamp(Math.round(8192 + semis / range * 8191), 0, 16383);
  return { t, o:0, d:[0xE0 | ch, v & 0x7F, v >> 7 & 0x7F] };
}
/** Notes [{t, dur, ch, key, vel}] → note on/off events. A repeated key cuts the previous one off first. */
function notesToEvents(notes) {
  const sorted = notes.slice().sort((a, b) => a.t - b.t);
  const open = new Map(), recs = [];
  for (const n of sorted) {
    const k = n.ch * 128 + n.key, prev = open.get(k);
    if (prev && prev.off > n.t) prev.off = n.t;
    const r = { n, on:Math.round(n.t), off:Math.round(n.t + Math.max(1, n.dur)) };
    open.set(k, r); recs.push(r);
  }
  const ev = [];
  for (const r of recs) {
    ev.push({ t:r.on, o:1, d:[0x90 | r.n.ch, clamp(r.n.key, 0, 127), clamp(Math.round(r.n.vel), 1, 127)] });
    ev.push({ t:Math.max(r.on + 1, r.off), o:0, d:[0x80 | r.n.ch, clamp(r.n.key, 0, 127), 0] });
  }
  return ev;
}
/** One MTrk chunk from events [{t, o, d}]; same-tick order: meta (-1), offs/bends (0), ons (1). */
function encodeMidiTrack(events) {
  const ev = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.t - b.t || (a.o || 0) - (b.o || 0) || a.i - b.i);
  const body = new ByteBuf();
  let last = 0;
  for (const e of ev) { const t = Math.max(0, Math.round(e.t)); body.vlq(t - last).bytes(e.d); last = t; }
  body.u8(0x00, 0xFF, 0x2F, 0x00);
  const out = new ByteBuf();
  out.bytes([0x4D, 0x54, 0x72, 0x6B]).u32(body.a.length).bytes(body.a);
  return out.a;
}
/** Whole file. format 0 = one track, 1 = several tracks played together. */
function encodeMidiFile(format, trackChunks) {
  const out = new ByteBuf();
  out.bytes([0x4D, 0x54, 0x68, 0x64]).u32(6).u16(format).u16(trackChunks.length).u16(MIDI_PPQ);
  trackChunks.forEach(c => out.bytes(c));
  return out.toUint8();
}

/* ---------- ZIP (stored, no compression) for several files in one download ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
/** files: [{name, data:Uint8Array}] → Uint8Array of a .zip */
function zipStore(files) {
  const out = new ByteBuf(), central = new ByteBuf();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  files.forEach(f => {
    const name = utf8(f.name), crc = crc32(f.data), offset = out.a.length;
    out.le32(0x04034B50).le16(20).le16(0x0800).le16(0).le16(dosTime).le16(dosDate).le32(crc).le32(f.data.length).le32(f.data.length).le16(name.length).le16(0).bytes(name).bytes(f.data);
    central.le32(0x02014B50).le16(20).le16(20).le16(0x0800).le16(0).le16(dosTime).le16(dosDate).le32(crc).le32(f.data.length).le32(f.data.length)
      .le16(name.length).le16(0).le16(0).le16(0).le16(0).le32(0).le32(offset).bytes(name);
  });
  const cdOffset = out.a.length;
  out.bytes(central.a).le32(0x06054B50).le16(0).le16(0).le16(files.length).le16(files.length).le32(central.a.length).le32(cdOffset).le16(0);
  return out.toUint8();
}
