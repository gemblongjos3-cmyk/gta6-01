// Sound, synthesised live with WebAudio — no audio files in the entry at all.
// A two-oscillator engine, a two-tone siren, per-station music loops built
// from little note patterns, and noise-burst gunfire.

import { RADIO } from './config.js';

const SCALES = {
  synthwave: { bass: [55, 55, 82.4, 65.4], arp: [220, 261.6, 329.6, 392, 329.6, 261.6], tempo: 0.24 },
  chill: { bass: [65.4, 49, 55, 73.4], arp: [196, 246.9, 293.7, 246.9], tempo: 0.42 },
  dance: { bass: [55, 55, 65.4, 49], arp: [329.6, 392, 440, 392, 329.6, 293.7], tempo: 0.19 },
  latin: { bass: [82.4, 82.4, 98, 73.4], arp: [164.8, 196, 246.9, 196, 220, 196], tempo: 0.27 },
};

export function createAudio() {
  let ac = null, master, engineOsc, engineOsc2, engineGain, sirenOsc, sirenGain, musicGain;
  let station = 0, noteIdx = 0, nextNoteAt = 0, muted = false;
  function ensure() {
    if (ac) return true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      engineGain = ac.createGain(); engineGain.gain.value = 0; engineGain.connect(master);
      engineOsc = ac.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineOsc2 = ac.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 30;
      const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 420;
      engineOsc.connect(ef); engineOsc2.connect(ef); ef.connect(engineGain);
      engineOsc.start(); engineOsc2.start();
      sirenGain = ac.createGain(); sirenGain.gain.value = 0; sirenGain.connect(master);
      sirenOsc = ac.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain); sirenOsc.start();
      musicGain = ac.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      nextNoteAt = ac.currentTime + 0.1;
    } catch { ac = null; }
    return !!ac;
  }
  function blip(freq, dur, type, gain, when = 0, slide = 0) {
    if (!ac || muted) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + when + dur);
    g.gain.setValueAtTime(gain, ac.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + when + dur);
    o.connect(g); g.connect(musicGain ?? master);
    o.start(ac.currentTime + when); o.stop(ac.currentTime + when + dur + 0.02);
  }
  return {
    unlock() { ensure(); if (ac?.state === 'suspended') ac.resume(); },
    setStation(i) { station = i; noteIdx = 0; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    shot(kind) {
      if (!ensure() || muted) return;
      const dur = kind === 'SCATTERGUN' ? 0.22 : 0.1;
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'SMG' ? 2600 : 1500;
      const g = ac.createGain(); g.gain.value = 0.24;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    },
    pickup() { blip(880, 0.12, 'sine', 0.2); blip(1318, 0.2, 'sine', 0.18, 0.07); },
    sting() { blip(392, 0.16, 'triangle', 0.22); blip(523, 0.16, 'triangle', 0.22, 0.1); blip(659, 0.3, 'triangle', 0.24, 0.2); },
    crash(intensity) {
      if (!ensure() || muted) return;
      const dur = 0.18;
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ac.createBufferSource(); src.buffer = buf;
      const g = ac.createGain(); g.gain.value = Math.min(0.4, 0.08 + intensity * 0.02);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    },
    update(dt, { speed = 0, inCar = false, stars = 0, radioOn = true }) {
      if (!ac) return;
      const t = ac.currentTime;
      // engine follows speed; silent on foot
      const target = inCar ? 0.05 + Math.abs(speed) * 0.0016 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, t, 0.09);
      const rpm = 55 + Math.abs(speed) * 2.6;
      engineOsc.frequency.setTargetAtTime(rpm, t, 0.05);
      engineOsc2.frequency.setTargetAtTime(rpm * 0.5 + 1, t, 0.05);
      // siren: two-tone wail that only exists while the PD cares
      sirenGain.gain.setTargetAtTime(muted ? 0 : (stars > 0 ? 0.016 + stars * 0.002 : 0), t, 0.2);
      sirenOsc.frequency.setTargetAtTime(640 + Math.sin(t * 2.4) * 190, t, 0.03);
      // radio sequencer
      if (radioOn && inCar && !muted) {
        const scale = SCALES[RADIO[station].mood];
        while (nextNoteAt < t + 0.15) {
          const when = Math.max(0, nextNoteAt - t);
          const bar = Math.floor(noteIdx / 8) % scale.bass.length;
          if (noteIdx % 8 === 0) blip(scale.bass[bar], scale.tempo * 6, 'triangle', 0.5, when);
          blip(scale.arp[noteIdx % scale.arp.length] * (noteIdx % 16 >= 8 ? 1.5 : 1), scale.tempo * 0.9, 'square', 0.1, when);
          noteIdx++; nextNoteAt += scale.tempo;
        }
      } else nextNoteAt = t + 0.1;
    },
  };
}
