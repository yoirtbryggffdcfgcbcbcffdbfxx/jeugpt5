// audio.js : petits sons WebAudio (sans assets)
const AudioSys = {
  ctx: null,
  muted: false,
  ensure() {
    if (this.ctx || this.muted) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  mute(toggle) { this.muted = toggle ?? !this.muted; if (this.muted && this.ctx && this.ctx.state !== "closed") this.ctx.close(); this.ctx = null; },
  now() { this.ensure(); return this.ctx?.currentTime ?? 0; },
  envOsc({ type="sine", freq=440, dur=0.15, vol=0.2, sweep=0 }) {
    if (this.muted) return;
    this.ensure(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*sweep), t0 + dur*0.9);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise({ dur=0.2, vol=0.2 }) {
    if (this.muted) return;
    this.ensure(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * (1 - i/data.length);
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(this.ctx.destination);
    src.start(t0);
  },
  // API gameplay
  jump() { this.envOsc({ type:"square", freq:520, dur:0.12, vol:0.15, sweep:0.6 }); },
  coin() { this.envOsc({ type:"triangle", freq:900, dur:0.12, vol:0.15, sweep:1.3 }); },
  key() { this.envOsc({ type:"triangle", freq:650, dur:0.18, vol:0.18, sweep:1.5 }); },
  doorOpen() { this.envOsc({ type:"sawtooth", freq:300, dur:0.25, vol:0.2, sweep:1.8 }); },
  checkpoint() { this.envOsc({ type:"sine", freq:500, dur:0.25, vol:0.18, sweep:1.7 }); },
  death() { this.noise({ dur:0.25, vol:0.2 }); },
  goal() { this.envOsc({ type:"triangle", freq:420, dur:0.3, vol:0.2, sweep:1.6 }); }
};