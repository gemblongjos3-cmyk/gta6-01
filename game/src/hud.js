// Palm Shores — hud.js
// All DOM UI: start / pause / game-over screens, health and armor bars,
// cash, ammo, wanted stars, objective line, speedometer, radio briefings,
// toasts, and a live canvas minimap (streets, player, police, marker).

import { WORLD, DISTRICTS } from './config.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this._build();
    this.minimap = this.root.querySelector('#minimap');
    this.mm = this.minimap.getContext('2d');
  }

  _el(tag, id, cls, parent, html = '') {
    const e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    e.innerHTML = html;
    (parent || this.root).appendChild(e);
    return e;
  }

  _build() {
    // Top-left: wanted stars + cash.
    const top = this._el('div', 'hud-top');
    this.starsEl = this._el('div', 'hud-stars', '', top, '☆☆☆☆☆');
    this.cashEl = this._el('div', 'hud-cash', '', top, '$120');
    // Top-centre: objective.
    this.objectiveEl = this._el('div', 'hud-objective', '', null, '');
    this.timerEl = this._el('div', 'hud-timer', '', null, '');
    this.timerEl.style.cssText = 'position:absolute;top:58px;left:50%;transform:translateX(-50%);font-size:22px;font-weight:800;color:#ffd166;text-shadow:0 2px 8px #000;display:none';
    // Bottom-left: health / armor.
    const bl = this._el('div', 'hud-bl');
    this._el('div', '', 'hud-label', bl, 'HEALTH');
    this.healthBar = this._el('div', '', 'bar', bl);
    this.healthFill = this._el('div', '', 'fill health', this.healthBar);
    this._el('div', '', 'hud-label', bl, 'ARMOR');
    this.armorBar = this._el('div', '', 'bar', bl);
    this.armorFill = this._el('div', '', 'fill armor', this.armorBar);
    this.ammoEl = this._el('div', 'hud-ammo', '', bl, 'PISTOL ∞');
    // Bottom-right: speedometer + minimap.
    const br = this._el('div', 'hud-br');
    this.speedEl = this._el('div', 'hud-speed', '', br, '');
    const mmCanvas = this._el('canvas', 'minimap', '', br);
    mmCanvas.width = 190;
    mmCanvas.height = 190;
    // Centre: crosshair, briefing banner, toasts, damage flash.
    this.crosshair = this._el('div', 'crosshair', '', null, '+');
    this.briefingEl = this._el('div', 'hud-briefing', '', null, '');
    this.toastEl = this._el('div', 'hud-toast', '', null, '');
    this.flashEl = this._el('div', 'hud-flash');
    // Screens.
    this.startScreen = this._el('div', 'screen-start', 'screen');
    this.startScreen.innerHTML = `
      <h1>PALM SHORES</h1>
      <p class="tagline">A neon-night open-world crime story</p>
      <p class="story">You are <b>Jax Marlowe</b>, a wheelman new to Palm Shores — a coastal city
      that never sleeps and never forgives. The fixer <b>Rook</b> has work for you:
      five jobs, one way up. Steal cars, lose the cops, settle the docks, and run
      the neon finale. The city is yours — if you can survive it.</p>
      <div class="controls">
        <div><b>W A S D</b> move / drive</div>
        <div><b>Mouse</b> look &amp; aim (click to lock)</div>
        <div><b>Left click</b> shoot pistol</div>
        <div><b>E</b> enter / exit car</div>
        <div><b>Shift</b> run &nbsp; <b>Space</b> handbrake</div>
        <div><b>P / Esc</b> pause &nbsp; <b>R</b> restart after game over</div>
      </div>
      <button id="btn-start">START THE NIGHT</button>
      <button id="btn-continue" class="secondary" style="display:none">CONTINUE — LOAD SAVE</button>
      <p class="hint">Desktop Chrome · keyboard + mouse · fully offline</p>`;
    this.pauseScreen = this._el('div', 'screen-pause', 'screen');
    this.pauseScreen.style.display = 'none';
    this.pauseScreen.innerHTML = `
      <h1>PAUSED</h1>
      <p class="story">The city waits. Rook is still on the radio.</p>
      <button id="btn-resume">RESUME</button>
      <button id="btn-restart" class="secondary">RESTART NIGHT</button>`;
    this.overScreen = this._el('div', 'screen-over', 'screen');
    this.overScreen.style.display = 'none';
    this.overScreen.innerHTML = `
      <h1>BUSTED / FLATLINED</h1>
      <p class="story" id="over-text">The night got you. Palm Shores keeps your cash — unless you take it back.</p>
      <button id="btn-again">TRY AGAIN (R)</button>`;
  }

  showStart(canContinue) {
    this.startScreen.style.display = 'flex';
    this.pauseScreen.style.display = 'none';
    this.overScreen.style.display = 'none';
    this.root.querySelector('#btn-continue').style.display = canContinue ? 'inline-block' : 'none';
  }
  showPause() { this.pauseScreen.style.display = 'flex'; this.startScreen.style.display = 'none'; this.overScreen.style.display = 'none'; }
  showOver(text) {
    this.overScreen.style.display = 'flex';
    if (text) this.root.querySelector('#over-text').textContent = text;
  }
  hideScreens() {
    this.startScreen.style.display = 'none';
    this.pauseScreen.style.display = 'none';
    this.overScreen.style.display = 'none';
  }

  setStars(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.starsEl.classList.toggle('hot', n >= 3);
  }
  setCash(n) { this.cashEl.textContent = `$${Math.floor(n)}`; }
  setHealth(h, a) {
    this.healthFill.style.width = `${Math.max(0, h)}%`;
    this.armorFill.style.width = `${Math.max(0, a)}%`;
  }
  setAmmo(n) { this.ammoEl.textContent = `PISTOL ${n} rds`; }
  setObjective(text) { this.objectiveEl.textContent = text; }
  setTimer(seconds) {
    if (seconds == null || seconds <= 0) { this.timerEl.style.display = 'none'; return; }
    const s = Math.ceil(seconds);
    this.timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.timerEl.style.display = 'block';
    this.timerEl.style.color = s <= 20 ? '#ff4040' : '#ffd166';
  }
  setSpeed(kmh, driving) {
    this.speedEl.textContent = driving ? `${Math.round(kmh)} km/h` : '';
  }

  briefing(text) {
    this.briefingEl.textContent = text;
    this.briefingEl.classList.add('show');
    clearTimeout(this._briefT);
    this._briefT = setTimeout(() => this.briefingEl.classList.remove('show'), 7000);
  }
  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('show'), 3500);
  }
  damageFlash() {
    this.flashEl.classList.add('show');
    setTimeout(() => this.flashEl.classList.remove('show'), 180);
  }

  // Minimap: violet streets, gold marker, blue player arrow, red police.
  drawMinimap(state) {
    const g = this.mm, S = 190, pad = 12;
    const span = WORLD.bounds * 2 + 40;
    const toMap = (x, z) => [
      pad + ((x + WORLD.bounds + 20) / span) * (S - pad * 2),
      pad + ((z + WORLD.bounds + 20) / span) * (S - pad * 2),
    ];
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(10,6,28,0.82)';
    g.fillRect(0, 0, S, S);
    // Water strip at the bottom (south).
    g.fillStyle = '#12204d';
    const [, wy] = toMap(0, WORLD.waterZ - 10);
    g.fillRect(0, wy, S, S - wy);
    // Streets.
    g.strokeStyle = '#3b3b5e';
    g.lineWidth = 4;
    for (const r of WORLD.roads) {
      const [x1, y1] = toMap(r, -130);
      const [x2, y2] = toMap(r, 150);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [x3, y3] = toMap(-130, r);
      const [x4, y4] = toMap(150, r);
      g.beginPath(); g.moveTo(x3, y3); g.lineTo(x4, y4); g.stroke();
    }
    // District dots.
    for (const d of DISTRICTS) {
      const [x, y] = toMap(d.cx, d.cz);
      g.fillStyle = d.color;
      g.globalAlpha = 0.5;
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // Mission marker.
    if (state.target) {
      const [x, y] = toMap(state.target.x, state.target.z);
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff3c4'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke();
    }
    // Collectibles.
    g.fillStyle = '#fbbf24';
    for (const c of state.collectibles || []) {
      const [x, y] = toMap(c.x, c.z);
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police cruisers.
    g.fillStyle = '#ff4040';
    for (const p of state.police || []) {
      const [x, y] = toMap(p.x, p.z);
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.player.x, state.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(state.playerYaw);
    g.fillStyle = '#22d3ee';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath();
    g.fill();
    g.restore();
  }
}
