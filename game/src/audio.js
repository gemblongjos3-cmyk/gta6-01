// Palm Shores — audio.js
// One job: all sound is synthesized with WebAudio — engine hum, sirens, shots,
// pickup chimes and rain ambience. No audio files. Starts only after a user gesture.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, rainSrc = null, started = false;

  function ensure() {
    if (started) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      // Engine: two detuned saw oscillators through a low-pass filter.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 28;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
      engineOsc.connect(filter); engineOsc2.connect(filter);
      filter.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Rain: looped filtered noise, quiet bed under everything.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      rainSrc = ctx.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter(); rainFilter.type = 'highpass'; rainFilter.frequency.value = 1800;
      const rainGain = ctx.createGain(); rainGain.gain.value = 0.035;
      rainSrc.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(master);
      rainSrc.start();
      started = true;
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEngine(speed01, on) {
      if (!ensure()) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 160, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.05;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 320;
        lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 750;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try { sirenOsc._lfo.stop(); sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
      }
    },
    shot() { noiseBurst(0.14, 0.5, 2600); blip(160, 0.08, 'square', 0.18, 60); },
    enemyShot() { noiseBurst(0.1, 0.2, 1800); },
    chime() { blip(880, 0.18, 'sine', 0.25); setTimeout(() => blip(1318, 0.25, 'sine', 0.22), 90); },
    thud() { blip(90, 0.2, 'sine', 0.4, 40); noiseBurst(0.08, 0.25, 500); },
    horn() { blip(370, 0.35, 'square', 0.12, 370); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.25), i * 120)); },
  };
}
