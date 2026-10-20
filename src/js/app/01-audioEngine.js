/* ================================================================
   audioEngine.js — Karplus-Strong plucked strings on Web Audio
   ================================================================ */
const AudioEngine = (() => {
  let ctx = null, out = null, master = null, muted = false;
  const bufs = new Map();
  const voices = new Set();

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 210; body.gain.value = 3; body.Q.value = 0.9;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.3;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      out = ctx.createGain(); out.gain.value = 0.85;
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      out.connect(body); body.connect(tone); tone.connect(comp); comp.connect(master); master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  /** One cached string sample per MIDI note; playbackRate corrects the integer delay length. */
  function ksBuffer(midi) {
    if (bufs.has(midi)) return bufs.get(midi);
    const sr = ctx.sampleRate;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const len = Math.floor(sr * clamp(1.4 + (84 - midi) * 0.045, 1.2, 3.4));
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let prev = 0, mean = 0;
    for (let i = 0; i < N; i++) { prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55; d[i] = prev; mean += prev; }
    mean /= N;
    let peak = 0;
    for (let i = 0; i < N; i++) { d[i] -= mean; peak = Math.max(peak, Math.abs(d[i])); }
    for (let i = 0; i < N; i++) d[i] /= (peak || 1);
    const decay = 0.9965 - Math.max(0, midi - 55) * 0.00006;
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + (i - N - 1 >= 0 ? d[i - N - 1] : 0));
    const res = { buf, rate: f / (sr / (N + 0.5)), dur: len / sr };
    bufs.set(midi, res);
    return res;
  }
  function pluck(midi, when, o = {}) {
    if (!init()) return null;
    const { gain = 0.5, dur = 1.8, bend = 0, slideFrom = null, vibrato = false, dead = false } = o;
    const { buf, rate } = ksBuffer(midi);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    const pr = src.playbackRate;
    pr.setValueAtTime(slideFrom != null ? rate * Math.pow(2, (slideFrom - midi) / 12) : rate, when);
    if (slideFrom != null) pr.linearRampToValueAtTime(rate, when + 0.09);
    if (bend) { pr.setValueAtTime(rate, when + 0.06); pr.linearRampToValueAtTime(rate * Math.pow(2, bend / 12), when + 0.24); }
    if (vibrato) { const top = rate * (bend ? Math.pow(2, bend / 12) : 1); for (let t = when + 0.15, up = true; t < when + dur; t += 0.09, up = !up) pr.linearRampToValueAtTime(top * (up ? 1.012 : 0.988), t); }
    const end = when + (dead ? 0.05 : dur);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.003);
    g.gain.setTargetAtTime(0, end, dead ? 0.01 : 0.12);
    src.connect(g); g.connect(out);
    src.start(when);
    src.stop(Math.min(when + buf.duration + 0.05, end + 0.7));
    const v = { src, g };
    voices.add(v);
    src.onended = () => { voices.delete(v); try { g.disconnect(); } catch (e) {} };
    return v;
  }
  function release(v, when) { if (v) try { v.g.gain.setTargetAtTime(0, when, 0.015); } catch (e) {} }
  /** Strum a list of MIDI notes (low → high). */
  function strum(midis, when, o = {}) {
    const { dir = 'down', gain = 0.45, dur = 1.6, spread = 0.016 } = o;
    const list = dir === 'up' ? midis.slice(-4).reverse() : midis;
    const g = gain * 1.5 / Math.sqrt(Math.max(1, list.length));
    list.forEach((m, i) => pluck(m, when + i * (dir === 'up' ? spread * 0.6 : spread), { gain:g * (1 - i * 0.04), dur }));
  }
  function click(when, accent) {
    if (!init()) return;
    // Woodblock-style tick: a square-wave knock through a bandpass, loud enough to cut through a strum.
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1800 : 1250;
    bp.type = 'bandpass'; bp.frequency.value = accent ? 2400 : 1800; bp.Q.value = 2.5;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(accent ? 0.9 : 0.6, when + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.045);
    o.connect(bp); bp.connect(g); g.connect(master);
    o.start(when); o.stop(when + 0.06);
  }
  function stopAll() {
    if (!ctx) return;
    const now = ctx.currentTime;
    voices.forEach(v => { try { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 0.02); v.src.stop(now + 0.12); } catch (e) {} });
  }
  /** Silence everything at the output; scheduling and highlighting keep running. */
  function setMuted(m) { muted = !!m; if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02); }
  return { init, pluck, strum, click, release, stopAll, setMuted, get muted() { return muted; }, get ctx() { return ctx; } };
})();

/* ---------- transport: look-ahead scheduler on eighth-note steps ---------- */
const Player = {
  playing:false, k:0, nextT:0, total:0, timer:null, raf:0, visQ:[], ending:false, endAt:0, passT0:0, frameFn:null,
  /** Audio clock minus the device's output delay: what the listener is hearing right now. */
  heardTime() { const c = AudioEngine.ctx; return c.currentTime - (c.outputLatency || c.baseLatency || 0); },
  start({ steps, stepFn, visFn, onEnd, frameFn = null }) {
    this.stop(true);
    const ctx = AudioEngine.init();
    if (!ctx) { toast('This browser has no Web Audio support.'); return; }
    Object.assign(this, { total:steps, k:0, nextT:ctx.currentTime + 0.08, stepFn, visFn, onEnd, frameFn, playing:true, ending:false, visQ:[] });
    this.passT0 = this.nextT; this.passQ = [];
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    const draw = () => {
      const now = this.heardTime();
      while (this.visQ.length && this.visQ[0].t <= now) this.visFn(this.visQ.shift().k);
      while (this.passQ.length > 1 && this.passQ[1] <= now) this.passQ.shift();
      if (this.frameFn && !this.ending) this.frameFn((now - (this.passQ[0] ?? this.passT0)) / (60 / song.tempo / 2));
      if (this.ending && now > this.endAt) { this.stop(); return; }
      this.raf = requestAnimationFrame(draw);
    };
    this.raf = requestAnimationFrame(draw);
  },
  tick() {
    const ctx = AudioEngine.ctx;
    const stepDur = 60 / song.tempo / 2;
    while (this.playing && !this.ending && this.nextT < ctx.currentTime + 0.15) {
      if (this.k >= this.total) {
        if (ui.loop) { this.k = 0; this.passQ.push(this.nextT); }
        else { this.ending = true; this.endAt = this.nextT + 0.6; break; }
      }
      this.stepFn(this.k, this.nextT);
      this.visQ.push({ t:this.nextT, k:this.k });
      this.k++;
      this.nextT += stepDur;
    }
  },
  stop(silent) {
    clearInterval(this.timer); cancelAnimationFrame(this.raf);
    const was = this.playing;
    this.playing = false; this.ending = false; this.visQ = [];
    hidePlayDots();
    if (was) { AudioEngine.stopAll(); if (this.onEnd) this.onEnd(); }
    if (!silent) onTransportStop();
  },
};
