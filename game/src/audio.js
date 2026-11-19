// Palm Shores — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, two-tone sirens, gunshots, pickup chimes, rain ambience.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.rainGain = null;
    this.enabled = true;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._startRain();
    } catch { this.ctx = null; }
  }

  _noiseBuffer(seconds = 1) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startRain() {
    // Looped filtered noise = steady night rain.
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.05;
    src.connect(filt); filt.connect(this.rainGain); this.rainGain.connect(this.master);
    src.start();
  }

  setRain(level) { if (this.rainGain) this.rainGain.gain.value = 0.03 + level * 0.05; }

  // Continuous engine hum; call with speed 0..1, 0 = silent.
  engine(speed, on) {
    if (!this.ctx) return;
    if (on && speed > 0.02) {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 500;
        this.engineOsc.connect(filt); filt.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 55 + speed * 130;
      this.engineGain.gain.value = 0.05 + speed * 0.06;
    } else if (this.engineOsc) {
      this.engineGain.gain.value = 0;
    }
  }

  // Two-tone police siren loop while wanted >= 1.
  siren(on) {
    if (!this.ctx) return;
    if (on) {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.035;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.9;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
        this.sirenOsc.frequency.value = 880;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start(); lfo.start();
        this._sirenLfo = lfo;
      }
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo?.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null; this.sirenGain = null;
    }
  }

  shot() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.18);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start();
    // Low thump under the crack.
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(140, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.4, this.ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    o.connect(og); og.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + 0.13);
  }

  chime() {
    if (!this.ctx) return;
    [880, 1318].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.4);
    });
  }

  thud() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 70;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + 0.22);
  }

  radioBlip() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 1150;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + 0.1);
  }
}
