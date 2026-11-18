// The HUD, in DOM so it can be animated with GSAP: the wanted stars, the wallet, the health and
// ammo bars, the mission card with its clock, the speedometer, centre banners (BUSTED, WASTED,
// mission passed) and the radar. The radar is its own little canvas; everything else is HTML that
// GSAP tweens. Nothing here reads the game state directly: main.js pushes values in.
import { COAST, ROAD, WORLD } from './config.js';
import { HALF_ROAD } from './world.js';

const gsap = window.gsap;

export function createHud(world) {
  const el = {
    wanted: document.getElementById('wanted'),
    stars: Array.from(document.querySelectorAll('#wanted .star')),
    cash: document.getElementById('cashAmount'),
    health: document.getElementById('healthBar'),
    healthFill: document.querySelector('#healthBar > i'),
    ammoBar: document.querySelector('#ammoBar > i'),
    ammoCount: document.getElementById('ammoCount'),
    weapon: document.getElementById('weapon'),
    objective: document.getElementById('objective'),
    objectiveTitle: document.getElementById('objectiveTitle'),
    objectiveText: document.getElementById('objectiveText'),
    objectiveTimer: document.getElementById('objectiveTimer'),
    missionTag: document.getElementById('missionTag'),
    speedo: document.getElementById('speedo'),
    speedValue: document.getElementById('speedValue'),
    carName: document.getElementById('carName'),
    banner: document.getElementById('banner'),
    bannerBig: document.getElementById('bannerBig'),
    bannerSmall: document.getElementById('bannerSmall'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    flash: document.getElementById('flash'),
    canvas: document.getElementById('game'),
    minimap: document.getElementById('minimap'),
    start: document.getElementById('start'),
    startPanel: document.getElementById('startPanel'),
    pause: document.getElementById('pause'),
    pausePanel: document.getElementById('pausePanel'),
    title: document.getElementById('title'),
  };

  const radar = el.minimap.getContext('2d');
  let shownWanted = -1;
  let cashShown = -1;
  let lastBanner = null;
  let objectiveVisible = false;
  let kick = null;
  /** In screenshot mode every HUD change is applied instantly, never as a tween. */
  let staticMode = false;

  // ---------- wanted stars ----------

  /** Light the first `level` stars; a new star punches in and the row flashes. */
  function setWanted(level) {
    const value = Math.max(0, Math.min(5, level));
    if (value === shownWanted) return;
    const rising = value > shownWanted;
    shownWanted = value;
    el.stars.forEach((star, index) => {
      star.classList.toggle('lit', index < value);
    });
    if (rising && !staticMode) {
      const fresh = el.stars[value - 1];
      if (fresh) {
        gsap.fromTo(
          fresh,
          { scale: 0.4, rotate: -25 },
          { scale: 1.35, rotate: 0, duration: 0.28, ease: 'back.out(3)', yoyo: true, repeat: 1, yoyoEase: 'power1.in', overwrite: true },
        );
        gsap.fromTo(fresh, { filter: 'brightness(2.4)' }, { filter: 'brightness(1)', duration: 0.9, ease: 'power2.out', overwrite: true });
      }
      gsap.fromTo(el.wanted, { x: -3 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.35)', overwrite: true });
    }
  }

  // ---------- wallet, health, ammo ----------

  function setCash(money) {
    const rounded = Math.round(money);
    if (rounded === cashShown) return;
    const gained = rounded > cashShown && cashShown >= 0;
    cashShown = rounded;
    el.cash.textContent = `$${rounded.toLocaleString('en-US')}`;
    if (gained && !staticMode) {
      gsap.fromTo(el.cash, { scale: 1.22, color: '#eaffd6' }, { scale: 1, color: '#b9f0a6', duration: 0.5, ease: 'power3.out', overwrite: true });
    }
  }

  function setHealth(health, max) {
    const ratio = Math.max(0, Math.min(1, health / max));
    el.healthFill.style.width = `${ratio * 100}%`;
    el.health.classList.toggle('low', ratio < 0.35);
  }

  function setAmmo(ammo, reserve, magazine) {
    el.ammoCount.textContent = `${ammo} / ${reserve}`;
    el.ammoBar.style.width = `${Math.max(0, Math.min(1, (ammo + reserve) / (magazine + 72))) * 100}%`;
  }

  function setWeapon(name) {
    el.weapon.firstChild.textContent = `${name} · `;
  }

  // ---------- mission card ----------

  function setObjective(title, text, timer) {
    if (title) el.objectiveTitle.textContent = title;
    if (text !== undefined) el.objectiveText.textContent = text;
    el.objectiveTimer.textContent = timer ?? '';
    el.objectiveTimer.classList.toggle('late', Boolean(timer) && Number.parseFloat(timer) < 10);
    if (staticMode) {
      objectiveVisible = true;
      gsap.set(el.objective, { autoAlpha: 1, y: 0 });
      return;
    }
    if (!objectiveVisible) {
      objectiveVisible = true;
      gsap.fromTo(el.objective, { autoAlpha: 0, y: -18 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', overwrite: true });
    }
  }

  function hideObjective() {
    if (!objectiveVisible) return;
    objectiveVisible = false;
    gsap.to(el.objective, { autoAlpha: 0, y: -14, duration: 0.35, ease: 'power2.in', overwrite: true });
  }

  function setMissionTag(text) {
    el.missionTag.textContent = text;
    if (staticMode) {
      gsap.set(el.missionTag, { autoAlpha: 0.9, x: 0 });
      return;
    }
    gsap.fromTo(el.missionTag, { autoAlpha: 0, x: -12 }, { autoAlpha: 0.9, x: 0, duration: 0.5, ease: 'power2.out', overwrite: true });
  }

  // ---------- speedometer ----------

  function setSpeed(kph, name, visible) {
    if (staticMode) {
      el.speedValue.textContent = String(Math.round(kph));
      el.carName.textContent = name;
      gsap.set(el.speedo, { autoAlpha: visible ? 1 : 0, y: 0 });
      return;
    }
    if (visible) {
      el.speedValue.textContent = String(Math.round(kph));
      el.carName.textContent = name;
      if (gsap.getProperty(el.speedo, 'opacity') < 0.5) {
        gsap.to(el.speedo, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', overwrite: true });
      }
    } else if (gsap.getProperty(el.speedo, 'opacity') > 0.05) {
      gsap.to(el.speedo, { autoAlpha: 0, y: 10, duration: 0.3, ease: 'power2.in', overwrite: true });
    }
  }

  // ---------- centre banner ----------

  /**
   * A big centre message: BUSTED, WASTED, MISSION PASSED. A timeline slides the title in, holds
   * it, and lifts it away; `onDone` runs after the exit so the game can move on.
   */
  function banner(big, small, kind = '', onDone = null) {
    lastBanner = { big, small, kind };
    el.bannerBig.textContent = big;
    el.bannerSmall.textContent = small;
    el.banner.className = kind;
    if (kick) kick.kill();
    kick = gsap.timeline({ onComplete: () => gsap.set(el.banner, { autoAlpha: 0 }) });
    kick
      .fromTo(el.banner, { autoAlpha: 0, scale: 0.82 }, { autoAlpha: 1, scale: 1, duration: 0.32, ease: 'back.out(2.2)' })
      .fromTo(el.bannerBig, { letterSpacing: '18px' }, { letterSpacing: '2px', duration: 0.7, ease: 'power3.out' }, 0)
      .fromTo(el.bannerSmall, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.12)
      .to(el.banner, { autoAlpha: 0, scale: 1.06, duration: 0.45, ease: 'power2.in' }, 2.6)
      .add(() => {
        if (onDone) onDone();
      }, 3.0);
    return kick;
  }

  function endBanner() {
    if (kick) kick.kill();
    kick = null;
    gsap.set(el.banner, { autoAlpha: 0 });
  }

  /** A short line of help: "Press E to get in", "The coupe is here". */
  function toast(text, seconds = 4) {
    el.toast.textContent = text;
    if (staticMode) {
      gsap.set(el.toast, { autoAlpha: text ? 1 : 0, y: 0, scale: 1 });
      return;
    }
    gsap.killTweensOf(el.toast);
    gsap.timeline()
      .fromTo(el.toast, { autoAlpha: 0, y: 8, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' })
      .to(el.toast, { autoAlpha: 0, y: -6, duration: 0.4, ease: 'power2.in' }, seconds);
  }

  function hint(text) {
    if (!text) {
      gsap.to(el.hint, { autoAlpha: 0, duration: 0.2, overwrite: true });
      return;
    }
    if (el.hint.textContent === text && gsap.getProperty(el.hint, 'opacity') > 0.5) return;
    el.hint.textContent = text;
    gsap.to(el.hint, { autoAlpha: 1, duration: 0.2, overwrite: true });
  }

  // ---------- flashes and shakes ----------

  function flash(kind, strength = 1) {
    el.flash.className = kind;
    gsap.fromTo(el.flash, { opacity: 0 }, { opacity: 0.85 * strength, duration: 0.1, ease: 'power2.out', overwrite: true }).then(() => {
      gsap.to(el.flash, { opacity: 0, duration: 0.8, ease: 'power2.in' });
    });
  }

  function shake(strength = 6, duration = 0.15) {
    gsap.killTweensOf(el.canvas);
    gsap.fromTo(
      el.canvas,
      { x: 0, y: 0 },
      {
        keyframes: [
          { x: -strength, y: strength * 0.4, duration: duration * 0.25 },
          { x: strength * 0.8, y: -strength * 0.3, duration: duration * 0.25 },
          { x: -strength * 0.4, y: strength * 0.2, duration: duration * 0.25 },
          { x: 0, y: 0, duration: duration * 0.25 },
        ],
        ease: 'power1.out',
      },
    );
  }

  /** A damage wobble on the whole HUD layer, so a bad hit is felt. */
  function jolt(strength = 4) {
    gsap.fromTo(el.canvas, { filter: 'brightness(1.5) saturate(1.4)' }, { filter: 'brightness(1) saturate(1)', duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    shake(strength, 0.15);
  }

  // ---------- the radar ----------

  const RADAR_RANGE = 620;

  /** Paint the round minimap: roads, the sea band, then the player, police, traffic and marker. */
  function drawRadar(state) {
    const size = el.minimap.width;
    const radius = size / 2;
    const range = RADAR_RANGE;
    const scale = radius / range;
    radar.setTransform(1, 0, 0, 1, 0, 0);
    radar.clearRect(0, 0, size, size);
    radar.save();
    radar.beginPath();
    radar.arc(radius, radius, radius, 0, Math.PI * 2);
    radar.clip();
    radar.fillStyle = '#201a2a';
    radar.fillRect(0, 0, size, size);
    radar.translate(radius, radius);
    radar.scale(scale, scale);
    radar.translate(-state.x, -state.y);
    radar.rotate(-state.rotate ?? 0);

    // Sea.
    if (state.y + range > COAST.waterline) {
      radar.fillStyle = '#1d5a67';
      radar.fillRect(state.x - range, COAST.waterline, range * 2, range * 2);
      radar.fillStyle = '#e8c891';
      radar.fillRect(state.x - range, COAST.waterline - 90, range * 2, 90);
    }
    // Roads, clipped to the visible disc's world bounds.
    radar.fillStyle = '#4a4356';
    radar.fillRect(state.x - range, state.y - range, range * 2, range * 2);
    radar.fillStyle = '#111018';
    for (const avenue of ROAD.avenueX) radar.fillRect(avenue - HALF_ROAD, state.y - range, HALF_ROAD * 2, range * 2);
    for (const street of ROAD.streetY) radar.fillRect(state.x - range, street - HALF_ROAD, range * 2, HALF_ROAD * 2);
    // Blocks in the gaps look like the buildings they hold.
    radar.fillStyle = 'rgba(255, 214, 160, 0.10)';
    for (const block of world.blocks) {
      if (block.left > state.x + range || block.right < state.x - range) continue;
      if (block.top > state.y + range || block.bottom < state.y - range) continue;
      radar.fillRect(block.left, block.top, block.width, block.height);
    }

    // Traffic: soft white dashes.
    radar.fillStyle = 'rgba(235, 235, 245, 0.55)';
    for (const car of state.traffic ?? []) {
      if (Math.abs(car.x - state.x) > range || Math.abs(car.y - state.y) > range) continue;
      radar.fillRect(car.x - 5, car.y - 5, 10, 10);
    }
    // Police: flashing blue dots.
    for (const car of state.police ?? []) {
      if (Math.abs(car.x - state.x) > range || Math.abs(car.y - state.y) > range) continue;
      radar.fillStyle = state.blink ? '#8fd0ff' : '#3f8fe8';
      radar.beginPath();
      radar.arc(car.x, car.y, 8, 0, Math.PI * 2);
      radar.fill();
    }
    radar.restore();

    // The mission marker sits on the rim when it is out of range, so the radar always points the way.
    if (state.marker) {
      const dx = state.marker.x - state.x;
      const dy = state.marker.y - state.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) - (state.rotate ?? 0);
      const clamped = Math.min(distance * scale, radius - 11);
      const mx = radius + Math.cos(angle) * clamped;
      const my = radius + Math.sin(angle) * clamped;
      radar.save();
      radar.translate(mx, my);
      radar.rotate(Math.PI / 4);
      radar.fillStyle = '#ffc94d';
      radar.shadowColor = '#ffc94d';
      radar.shadowBlur = 8;
      radar.fillRect(-5.5, -5.5, 11, 11);
      radar.restore();
    }

    // The player: a white arrow pointing where they face.
    radar.save();
    radar.translate(radius, radius);
    radar.rotate((state.aim ?? 0) - (state.rotate ?? 0));
    radar.fillStyle = '#fff4e4';
    radar.beginPath();
    radar.moveTo(9, 0);
    radar.lineTo(-6, -6);
    radar.lineTo(-3, 0);
    radar.lineTo(-6, 6);
    radar.closePath();
    radar.fill();
    radar.restore();

    // A north tick, so the radar reads as a compass.
    radar.fillStyle = 'rgba(255, 244, 228, 0.7)';
    radar.font = '700 11px system-ui, sans-serif';
    radar.textAlign = 'center';
    radar.textBaseline = 'middle';
    radar.fillText('N', radius, 12);
  }

  // ---------- the title and pause screens ----------

  /** Build the start screen's entrance: title drops in, menu items stagger, controls fade up. */
  function enterStart() {
    el.start.style.visibility = 'visible';
    gsap.set(el.start, { autoAlpha: 1 });
    const items = el.startPanel.querySelectorAll('.item');
    const controls = el.startPanel.querySelectorAll('.controls span');
    const timeline = gsap.timeline();
    timeline
      .fromTo(el.startPanel, { autoAlpha: 0, y: 26, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' })
      .fromTo(el.title, { y: -34, autoAlpha: 0, letterSpacing: '14px' }, { y: 0, autoAlpha: 1, letterSpacing: '-1px', duration: 0.9, ease: 'power3.out' }, 0.05)
      .fromTo(items, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.08, ease: 'power2.out' }, 0.3)
      .fromTo(controls, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.03, ease: 'power1.out' }, 0.5);
    return timeline;
  }

  function hideStart(onDone) {
    gsap.to(el.start, {
      autoAlpha: 0,
      duration: 0.45,
      ease: 'power2.inOut',
      onComplete: () => {
        el.start.style.visibility = 'hidden';
        if (onDone) onDone();
      },
    });
  }

  function showPause() {
    el.pause.style.visibility = 'visible';
    gsap.timeline()
      .to(el.pause, { autoAlpha: 1, duration: 0.25, ease: 'power2.out' })
      .fromTo(el.pausePanel, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' }, 0);
  }

  function hidePause(onDone) {
    gsap.to(el.pause, {
      autoAlpha: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        el.pause.style.visibility = 'hidden';
        if (onDone) onDone();
      },
    });
  }

  /** The HUD slides in when play begins: each corner group eases in from its edge. */
  function enterPlay() {
    gsap.fromTo(el.wanted, { autoAlpha: 0, x: -26 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' });
    gsap.fromTo(document.getElementById('cash'), { autoAlpha: 0, x: 26 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out', delay: 0.05 });
    gsap.fromTo(document.getElementById('vitals'), { autoAlpha: 0, x: 26 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out', delay: 0.12 });
    gsap.fromTo(document.getElementById('minimapWrap'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.08 });
    gsap.fromTo(el.weapon, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, delay: 0.2 });
  }

  function hideHud() {
    gsap.to([el.wanted, document.getElementById('cash'), document.getElementById('vitals'), document.getElementById('minimapWrap'), el.weapon], {
      autoAlpha: 0,
      duration: 0.4,
      ease: 'power2.in',
    });
    hideObjective();
  }

  /** Clear every running HUD tween: used when a staged screenshot is taken. */
  function freeze() {
    gsap.killTweensOf([el.banner, el.bannerBig, el.bannerSmall, el.toast, el.objective, el.flash, el.canvas, el.speedo]);
    gsap.set(el.canvas, { x: 0, y: 0, filter: 'none' });
    gsap.set(el.flash, { opacity: 0 });
  }

  /** Screenshot mode: from here on every HUD write lands at its final value at once. */
  function setStatic(value) {
    staticMode = Boolean(value);
    if (staticMode) {
      gsap.set([el.wanted, document.getElementById('cash'), document.getElementById('vitals'), document.getElementById('minimapWrap'), el.weapon], { autoAlpha: 1, x: 0, y: 0 });
      gsap.set(el.canvas, { x: 0, y: 0, filter: 'none' });
      gsap.set(el.flash, { opacity: 0 });
    }
  }

  return {
    setStatic,
    setWanted,
    setCash,
    setHealth,
    setAmmo,
    setWeapon,
    setObjective,
    hideObjective,
    setMissionTag,
    setSpeed,
    banner,
    endBanner,
    toast,
    hint,
    flash,
    shake,
    jolt,
    drawRadar,
    enterStart,
    hideStart,
    showPause,
    hidePause,
    enterPlay,
    hideHud,
    freeze,
    get bannerShown() {
      return lastBanner;
    },
    el,
  };
}

export { WORLD };
