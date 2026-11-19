// Every sound in the city is synthesised, no sample files: an engine whose pitch follows the
// speed, a two-tone siren that only sounds when the police are near, pistol cracks, a cash chime,
// the mission jingle and a slow sunset pad that loops under it all. M mutes everything; the audio
// graph is only built after the first key or click, as browsers insist.

const NOTES = {
  // A warm A-minor-ish pad: A3, C4, E4, G4, then a lift to F and G.
  chords: [
    [220.0, 261.63, 329.63, 392.0],
    [174.61, 220.0, 261.63, 349.23],
    [196.0, 246.94, 293.66, 392.0],
    [164.81, 207.65, 246.94, 329.63],
  ],
  siren: [740, 988],
};

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let engine = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let started = false;
  let padTimer = 0;
  let chordIndex = 0;
  let sirenPhase = 0;

  function ensure() {
    if (context) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    return true;
  }

  /** A short tone: the building block of every one-shot sound here. */
  function tone({ frequency, type = 'sine', duration = 0.18, volume = 0.2, slideTo = null, delay = 0, attack = 0.005 }) {
    if (!context) return;
    const now = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Noise burst through a band-pass: a gunshot, a tyre squeal or an engine backfire. */
  function noise({ duration = 0.16, volume = 0.35, filter = 1200, q = 0.8, delay = 0 }) {
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = filter;
    band.Q.value = q;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(band);
    band.connect(gain);
    gain.connect(master);
    source.start(context.currentTime + delay);
  }

  function startEngine() {
    if (!context || engine) return;
    engine = context.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 48;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = context.createGain();
    engineGain.gain.value = 0.0001;
    engine.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engine.start();
  }

  function startSiren() {
    if (!context || sirenOsc) return;
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = NOTES.siren[0];
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    sirenGain = context.createGain();
    sirenGain.gain.value = 0.0001;
    sirenOsc.connect(filter);
    filter.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  /** Called on the first gesture: build the graph and start the pad. */
  function unlock() {
    if (started && context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    if (!ensure()) return;
    started = true;
    if (context.state === 'suspended') context.resume();
    startEngine();
    startSiren();
    padTimer = 0;
  }

  /** The backing pad: one slow chord every few seconds, quiet under the city. */
  function updatePad(dt) {
    if (!context) return;
    padTimer -= dt;
    if (padTimer > 0) return;
    padTimer = 4.6;
    const chord = NOTES.chords[chordIndex % NOTES.chords.length];
    chordIndex += 1;
    for (const frequency of chord) {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 1.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.6);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(now);
      osc.stop(now + 4.8);
    }
  }

  /** Update the continuous sounds once a frame: engine pitch, siren warble, pad. */
  function update(dt, { speed = 0, wanted = 0, policeNear = false, driving = false }) {
    if (!context) return;
    updatePad(dt);
    if (engineGain) {
      const target = driving ? Math.min(0.09, 0.02 + Math.abs(speed) / 6000) : 0.0001;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.12);
      if (engine) engine.frequency.setTargetAtTime(44 + Math.abs(speed) * 0.28, context.currentTime, 0.15);
    }
    if (sirenGain && sirenOsc) {
      const active = wanted > 0 && policeNear;
      sirenGain.gain.setTargetAtTime(active ? 0.035 : 0.0001, context.currentTime, 0.3);
      if (active) {
        sirenPhase += dt * 2.4;
        const note = NOTES.siren[Math.floor(sirenPhase) % 2];
        sirenOsc.frequency.setTargetAtTime(note, context.currentTime, 0.04);
      }
    }
  }

  function gunshot() {
    if (!context) return;
    noise({ duration: 0.15, volume: 0.4, filter: 1500, q: 0.6 });
    tone({ frequency: 180, slideTo: 60, type: 'square', duration: 0.09, volume: 0.16 });
  }

  function hit() {
    if (!context) return;
    noise({ duration: 0.09, volume: 0.22, filter: 800 });
  }

  function cash() {
    if (!context) return;
    tone({ frequency: 880, type: 'triangle', duration: 0.1, volume: 0.18 });
    tone({ frequency: 1320, type: 'triangle', duration: 0.16, volume: 0.14, delay: 0.07 });
  }

  function missionJingle() {
    if (!context) return;
    const notes = [392, 494, 587, 784];
    notes.forEach((frequency, at) => tone({ frequency, type: 'triangle', duration: 0.24, volume: 0.14, delay: at * 0.09 }));
  }

  function missionFail() {
    if (!context) return;
    tone({ frequency: 320, slideTo: 150, type: 'sawtooth', duration: 0.55, volume: 0.12 });
  }

  function busted() {
    if (!context) return;
    tone({ frequency: 660, type: 'square', duration: 0.2, volume: 0.14 });
    tone({ frequency: 440, type: 'square', duration: 0.3, volume: 0.14, delay: 0.18 });
    tone({ frequency: 220, type: 'square', duration: 0.5, volume: 0.13, delay: 0.36 });
  }

  function wasted() {
    if (!context) return;
    tone({ frequency: 110, slideTo: 40, type: 'sawtooth', duration: 1.1, volume: 0.16 });
    noise({ duration: 0.6, volume: 0.12, filter: 300 });
  }

  function unlock2() {
    if (context && context.state === 'suspended') context.resume();
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, context.currentTime, 0.05);
    return muted;
  }

  function setMuted(value) {
    muted = value;
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.55, context.currentTime, 0.05);
  }

  return {
    unlock,
    unlock2,
    update,
    gunshot,
    hit,
    cash,
    missionJingle,
    missionFail,
    busted,
    wasted,
    toggleMute,
    setMuted,
    get muted() {
      return muted;
    },
    get ready() {
      return Boolean(context);
    },
  };
}

// Round 5 note: this module is part of the eight-mission build — weapon wheel, air unit, roadblocks, respect/XP.
