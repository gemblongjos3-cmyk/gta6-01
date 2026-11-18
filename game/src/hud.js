// The heads-up display: every DOM element the player reads at a glance.
//
// Canvas draws the world; this module owns the layer above it — wanted
// stars, cash, health and ammo bars, the objective card, the mission tag,
// the speedometer, banners, toasts, hints, flashes, the start and pause
// panels, and the radar minimap (a small canvas of its own).
//
// Motion belongs to GSAP. Every animated setter has two gears: the live
// gear tweens, the static gear (setStatic(true), used by screenshot mode)
// writes the end state with gsap.set so a photograph never catches a
// half-finished animation.
import { COAST, ROAD, WORLD } from './config.js';
import { HALF_ROAD } from './world.js';

/** Grab one element by id; a missing id is a markup bug, so say so loudly. */
function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`HUD element #${id} is missing from index.html`);
  return node;
}

export function createHud(world) {
  const el = {
    root: byId('hud'),
    wanted: byId('wanted'),
    stars: [...document.querySelectorAll('#wanted .star')],
    cashAmount: byId('cashAmount'),
    healthBar: byId('healthBar'),
    healthFill: document.querySelector('#healthBar > i'),
    ammoBar: byId('ammoBar'),
    ammoFill: document.querySelector('#ammoBar > i'),
    weapon: byId('weapon'),
    ammoCount: byId('ammoCount'),
    objective: byId('objective'),
    objectiveTitle: byId('objectiveTitle'),
    objectiveText: byId('objectiveText'),
    objectiveTimer: byId('objectiveTimer'),
    missionTag: byId('missionTag'),
    speedo: byId('speedo'),
    speedValue: byId('speedValue'),
    carName: byId('carName'),
    banner: byId('banner'),
    bannerBig: byId('bannerBig'),
    bannerSmall: byId('bannerSmall'),
    toast: byId('toast'),
    hint: byId('hint'),
    flash: byId('flash'),
    canvas: byId('game'),
    minimap: byId('minimap'),
    start: byId('start'),
    startPanel: byId('startPanel'),
    pause: byId('pause'),
    pausePanel: byId('pausePanel'),
    title: byId('title'),
    status: byId('status'),
  };
  const radarCtx = el.minimap.getContext('2d');

  const hasGsap = typeof window !== 'undefined' && Boolean(window.gsap);
  const gsap = hasGsap ? window.gsap : null;

  let staticMode = false;
  let lastWanted = 0;
  let lastCash = null;
  let bannerTimeline = null;
  let toastTimeline = null;
  let entranceTimeline = null;

  /** Run a tween, or jump straight to its end state in static mode. */
  function animate(targets, vars) {
    if (!gsap) return null;
    if (staticMode) {
      gsap.set(targets, vars);
      return null;
    }
    return gsap.to(targets, vars);
  }

  /** Switch every setter between tweened (play) and set (photograph). */
  function setStatic(value) {
    staticMode = Boolean(value);
    if (staticMode && gsap) gsap.globalTimeline.timeScale(1000);
    else if (gsap) gsap.globalTimeline.timeScale(1);
  }

  // ------------------------------------------------------------- the stars
  /**
   * Light `level` of the five stars. A rise earns a pulse — the whole row
   * swells and settles — because a new star should feel like bad news.
   */
  function setWanted(level) {
    const clamped = Math.max(0, Math.min(5, Math.round(level)));
    el.stars.forEach((star, i) => star.classList.toggle('lit', i < clamped));
    el.wanted.setAttribute('aria-label', `Wanted level ${clamped} of 5`);
    if (gsap && clamped > lastWanted && clamped > 0) {
      if (staticMode) {
        gsap.set(el.stars, { scale: 1 });
      } else {
        gsap.fromTo(
          el.stars,
          { scale: 1 },
          { scale: 1.35, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1, stagger: 0.045, overwrite: 'auto' },
        );
      }
    }
    lastWanted = clamped;
  }

  // -------------------------------------------------------------- the wallet
  /** Cash, counted with a quick roll when it changes during play. */
  function setCash(amount) {
    const value = Math.max(0, Math.round(amount));
    if (lastCash === value) return;
    const from = lastCash ?? value;
    lastCash = value;
    if (!gsap || staticMode || from === value) {
      el.cashAmount.textContent = `$${value.toLocaleString('en-US')}`;
      return;
    }
    const counter = { shown: from };
    gsap.to(counter, {
      shown: value,
      duration: 0.45,
      ease: 'power1.out',
      overwrite: 'auto',
      onUpdate: () => {
        el.cashAmount.textContent = `$${Math.round(counter.shown).toLocaleString('en-US')}`;
      },
    });
  }

  // -------------------------------------------------------------- the vitals
  /** Health as a bar that turns angry red when it runs low. */
  function setHealth(value, max = 100) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    el.healthFill.style.width = `${pct}%`;
    el.healthBar.classList.toggle('low', pct <= 30);
  }

  /** Ammo: the bar is the magazine against its reserve, the numbers exact. */
  function setAmmo(loaded, reserve, magazine = 12) {
    const pct = Math.max(0, Math.min(100, (loaded / magazine) * 100));
    // The stylesheet colours only the health fill; the ammo fill gets its
    // brass gradient here, and turns red when the magazine runs dry.
    el.ammoFill.style.background = loaded > 0
      ? 'linear-gradient(90deg, #d8a84e, #f0d089)'
      : 'linear-gradient(90deg, #ff4f4f, #ff9a5a)';
    el.ammoFill.style.width = `${pct}%`;
    el.ammoCount.textContent = `${loaded} / ${reserve}`;
  }

  /** Name the held weapon next to its ammo count. */
  function setWeapon(name) {
    const label = el.weapon.firstChild;
    if (label) label.textContent = `${name} · `;
  }

  // ------------------------------------------------------------ the objective
  /** Show the objective card; a repeat of the same text just updates it. */
  function setObjective(title, text, timer = '') {
    el.objectiveTitle.textContent = title;
    el.objectiveText.textContent = text;
    el.objectiveTimer.textContent = timer ?? '';
    el.objectiveTimer.classList.toggle('late', typeof timer === 'string' && timer.startsWith('0:'));
    animate(el.objective, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }

  /** Slide the objective card away when there is nothing to chase. */
  function hideObjective() {
    animate(el.objective, { autoAlpha: 0, y: -8, duration: 0.3, ease: 'power2.in' });
  }

  /** The small gold tag naming where the mission is happening. */
  function setMissionTag(text) {
    el.missionTag.textContent = text ?? '';
    animate(el.missionTag, { autoAlpha: text ? 1 : 0, duration: 0.3 });
  }

  // ----------------------------------------------------------- the speedometer
  /** Speed while driving; the whole cluster hides itself on foot. */
  function setSpeed(value, name, driving) {
    if (!driving) {
      animate(el.speedo, { autoAlpha: 0, y: 8, duration: 0.25 });
      return;
    }
    el.speedValue.textContent = `${Math.round(Math.abs(value))}`;
    el.carName.textContent = name ?? '';
    animate(el.speedo, { autoAlpha: 1, y: 0, duration: 0.25 });
  }

  // ---------------------------------------------------------------- banners
  /**
   * The big centre banner — MISSION PASSED, BUSTED, WASTED — as one GSAP
   * timeline: punch in, hold, drift out. endBanner cuts it short.
   */
  function banner(big, small = '', kind = '') {
    el.bannerBig.textContent = big;
    el.bannerSmall.textContent = small;
    el.banner.className = kind;
    el.banner.id = 'banner';
    if (!gsap) {
      el.banner.style.opacity = '1';
      return;
    }
    if (bannerTimeline) bannerTimeline.kill();
    if (staticMode) {
      gsap.set(el.banner, { autoAlpha: 1, scale: 1 });
      return;
    }
    bannerTimeline = gsap.timeline();
    bannerTimeline
      .fromTo(el.banner, { autoAlpha: 0, scale: 1.24 }, { autoAlpha: 1, scale: 1, duration: 0.32, ease: 'power3.out' })
      .to(el.banner, { autoAlpha: 1, duration: 1.5 })
      .to(el.banner, { autoAlpha: 0, scale: 0.96, duration: 0.45, ease: 'power2.in' });
  }

  /** Hide the banner now, whatever its timeline was doing. */
  function endBanner() {
    if (bannerTimeline) bannerTimeline.kill();
    bannerTimeline = null;
    if (gsap) gsap.set(el.banner, { autoAlpha: 0 });
    else el.banner.style.opacity = '0';
  }

  // ----------------------------------------------------------------- toasts
  /** A one-line message pill near the bottom; newer replaces older. */
  function toast(message, seconds = 2.6) {
    if (!message) {
      if (toastTimeline) toastTimeline.kill();
      if (gsap) gsap.set(el.toast, { autoAlpha: 0 });
      return;
    }
    el.toast.textContent = message;
    el.status.textContent = message;
    if (!gsap) {
      el.toast.style.opacity = '1';
      return;
    }
    if (toastTimeline) toastTimeline.kill();
    if (staticMode) {
      gsap.set(el.toast, { autoAlpha: 1, y: 0 });
      return;
    }
    toastTimeline = gsap.timeline();
    toastTimeline
      .fromTo(el.toast, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' })
      .to(el.toast, { autoAlpha: 0, duration: 0.4, ease: 'power1.in' }, `+=${Math.max(0.4, seconds)}`);
  }

  /** The quiet hint line under the toast; empty text hides it. */
  function hint(text) {
    el.hint.textContent = text ?? '';
    animate(el.hint, { autoAlpha: text ? 1 : 0, duration: 0.25 });
  }

  // ---------------------------------------------------------------- effects
  /** A full-screen colour wash: blue for the law, red for the hurt. */
  function flash(kind) {
    el.flash.className = kind === 'blue' ? 'blue' : 'red';
    el.flash.id = 'flash';
    if (!gsap) return;
    if (staticMode) {
      gsap.set(el.flash, { opacity: 0.85 });
      return;
    }
    gsap.fromTo(el.flash, { opacity: 0.9 }, { opacity: 0, duration: 0.7, ease: 'power2.out', overwrite: 'auto' });
  }

  /** Shake the whole game view — collisions and nearby gunfire live here. */
  function shake(amount = 6) {
    if (!gsap || staticMode) return;
    const strength = Math.max(2, Math.min(14, amount));
    gsap.fromTo(
      el.canvas,
      { x: -strength, y: strength * 0.6 },
      { x: 0, y: 0, duration: 0.32, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' },
    );
  }

  /** A smaller, sharper jolt for a single hit landing on the player. */
  function jolt() {
    if (!gsap || staticMode) return;
    gsap.fromTo(el.root, { x: -3 }, { x: 0, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
  }

  // ------------------------------------------------------------------ radar
  /**
   * The minimap: a 200px circle of city centred on the player. Roads and
   * the shoreline give the geography; dots give the life — traffic in grey,
   * police in blue, the objective in gold, the player as a white arrow.
   * state: { x, y, aim, marker, traffic, police, blink }
   */
  function drawRadar(state) {
    const g = radarCtx;
    const size = el.minimap.width || 200;
    const half = size / 2;
    const range = 1150; // world pixels from centre to rim
    const scale = half / range;
    const px = state.x;
    const py = state.y;

    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.clip();

    g.fillStyle = '#4c7350';
    g.fillRect(0, 0, size, size);
    // Sea along the bottom of the world, wherever the view reaches it.
    const seaY = half + (COAST.waterline - py) * scale;
    if (seaY < size) {
      g.fillStyle = '#2f7f8c';
      g.fillRect(0, Math.max(0, seaY), size, size - Math.max(0, seaY));
    }
    const sandY = half + (COAST.beachTop - py) * scale;
    if (sandY < size && seaY > 0) {
      g.fillStyle = '#cfae7a';
      g.fillRect(0, Math.max(0, sandY), size, Math.max(0, Math.min(size, seaY) - Math.max(0, sandY)));
    }
    // Roads as pale lines on the grid.
    g.strokeStyle = 'rgba(240,232,214,0.5)';
    g.lineWidth = Math.max(2, ROAD.width * scale * 0.7);
    for (const ax of ROAD.avenueX) {
      const sx = half + (ax - px) * scale;
      if (sx < -8 || sx > size + 8) continue;
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx, size);
      g.stroke();
    }
    for (const sy of ROAD.streetY) {
      const yy = half + (sy - py) * scale;
      if (yy < -8 || yy > size + 8) continue;
      g.beginPath();
      g.moveTo(0, yy);
      g.lineTo(size, yy);
      g.stroke();
    }
    void world;
    void HALF_ROAD;

    const blip = (wx, wy, r, color) => {
      const sx = half + (wx - px) * scale;
      const sy = half + (wy - py) * scale;
      const dx = sx - half;
      const dy = sy - half;
      const dist = Math.hypot(dx, dy);
      const rim = half - 6;
      const cx = dist > rim ? half + (dx / dist) * rim : sx;
      const cy = dist > rim ? half + (dy / dist) * rim : sy;
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      return dist > rim;
    };

    for (const car of state.traffic ?? []) blip(car.x, car.y, 2.2, 'rgba(220,220,228,0.75)');
    const blinkOn = state.blink === false ? true : Math.floor(performance.now() / 420) % 2 === 0;
    if (blinkOn) for (const car of state.police ?? []) blip(car.x, car.y, 3.2, '#5fb2ff');
    if (state.marker) blip(state.marker.x, state.marker.y, 4, '#ffc94d');

    // The player: a white arrow that turns with the aim.
    g.save();
    g.translate(half, half);
    g.rotate((state.aim ?? 0) + Math.PI / 2);
    g.fillStyle = '#fff7ea';
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(5.4, 6);
    g.lineTo(0, 3);
    g.lineTo(-5.4, 6);
    g.closePath();
    g.fill();
    g.restore();

    g.restore();
    // North tick, fixed to the rim.
    g.fillStyle = 'rgba(255,244,228,0.85)';
    g.font = '700 10px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('N', half, 13);
  }

  // ------------------------------------------------------------ start screen
  /**
   * The title entrance, one timeline: the name drops in, the menu staggers
   * up, and a little coupe silhouette crosses the panel's foot. Returned so
   * screenshot mode can drive it straight to its end state.
   */
  function enterStart() {
    if (gsap) gsap.set(el.start, { autoAlpha: 1, visibility: 'visible' });
    el.start.style.pointerEvents = 'none';
    if (!gsap) return null;
    if (entranceTimeline) entranceTimeline.kill();

    // A coupe that crosses once under the story text — pure decoration.
    let coupe = document.getElementById('startCoupe');
    if (!coupe) {
      coupe = document.createElement('div');
      coupe.id = 'startCoupe';
      coupe.style.cssText = [
        'position:absolute',
        'left:0',
        'bottom:12px',
        'width:64px',
        'height:20px',
        'border-radius:10px 14px 6px 6px',
        'background:linear-gradient(180deg,#f0a24a,#e2574c)',
        'box-shadow:0 4px 10px rgba(0,0,0,0.45)',
        'opacity:0.9',
      ].join(';');
      el.startPanel.appendChild(coupe);
    }

    entranceTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    entranceTimeline
      .fromTo(el.startPanel, { autoAlpha: 0, y: 26, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 })
      .fromTo(el.title, { autoAlpha: 0, y: -46 }, { autoAlpha: 1, y: 0, duration: 0.6 }, '-=0.25')
      .fromTo('#startMenu .item', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 }, '-=0.2')
      .fromTo(coupe, { x: -90, autoAlpha: 0 }, { x: 640, autoAlpha: 1, duration: 1.15, ease: 'power1.inOut' }, '-=0.5')
      .to(coupe, { autoAlpha: 0, duration: 0.25 }, '-=0.1');
    if (staticMode) entranceTimeline.progress(1);
    return entranceTimeline;
  }

  /** Fold the start screen away when the evening begins. */
  function hideStart() {
    if (!gsap) {
      el.start.style.opacity = '0';
      el.start.style.visibility = 'hidden';
      return;
    }
    animate(el.start, { autoAlpha: 0, duration: 0.45, ease: 'power2.inOut' });
  }

  // ------------------------------------------------------------------ pause
  /** Pause panel in, with a small rise; the game view stays behind it. */
  function showPause() {
    if (!gsap) {
      el.pause.style.opacity = '1';
      el.pause.style.visibility = 'visible';
      return;
    }
    if (staticMode) gsap.set(el.pause, { autoAlpha: 1 });
    else {
      gsap.to(el.pause, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo(el.pausePanel, { y: 14 }, { y: 0, duration: 0.35, ease: 'power3.out' });
    }
  }

  /** Pause panel out again. */
  function hidePause() {
    if (!gsap) {
      el.pause.style.opacity = '0';
      el.pause.style.visibility = 'hidden';
      return;
    }
    animate(el.pause, { autoAlpha: 0, duration: 0.25, ease: 'power2.in' });
  }

  // ------------------------------------------------------------ mode changes
  /**
   * Into play: the HUD groups arrive with a stagger — stars, cash, vitals,
   * radar — like instruments lighting up one after another.
   */
  function enterPlay() {
    hideStart();
    if (!gsap) return;
    const groups = ['#wanted', '#cash', '#vitals', '#minimapWrap', '#weapon'];
    if (staticMode) {
      gsap.set(groups, { autoAlpha: 1, y: 0 });
      return;
    }
    gsap.fromTo(groups, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.07, overwrite: 'auto' });
  }

  /** Hide every HUD group at once (the start screen owns the frame). */
  function hideHud() {
    const groups = ['#wanted', '#cash', '#vitals', '#minimapWrap', '#weapon', '#objective', '#speedo', '#missionTag', '#toast', '#hint'];
    if (gsap) gsap.set(groups, { autoAlpha: 0 });
  }

  /**
   * Freeze every animation at its current end state: screenshot mode calls
   * this after staging, so nothing on screen is mid-tween when photographed.
   */
  function freeze() {
    if (!gsap) return;
    for (const tween of gsap.globalTimeline.getChildren(true, true, true)) {
      tween.progress(1);
    }
  }

  return {
    el,
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
  };
}

export { WORLD };
