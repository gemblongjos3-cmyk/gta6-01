// The HUD: DOM panels laid over the 3D view, styled after the reference the
// crew works from — mission dossier top-left, Shores PD response under it,
// cash and wanted stars top-right, a round minimap bottom-left, Luna's
// dispatch dialogue bottom-centre, radio and the big speedometer bottom-right.

import { WEAPONS, RADIO, UPGRADES, LUNA } from './config.js';
import { formatTime } from './missions.js';
import { lunaPortraitTexture } from './textures.js';
import { XP_PER_LEVEL, xpIntoLevel } from './save.js';
import { ROAD_CENTERS } from './city.js';

const $ = (id) => document.getElementById(id);

export function createHud(callbacks) {
  const els = {
    mission: $('missionPanel'), mpHead: $('mpHead'), mpTimer: $('mpTimer'), mpObjective: $('mpObjective'),
    mpSub: $('mpSub'), mpStage: $('mpStage'), mpBar: $('mpBar'), mpNext: $('mpNext'), mpDistrict: $('mpDistrict'),
    pd: $('pdPanel'), pdHead: $('pdHead'), pdUnits: $('pdUnits'), pdFoot: $('pdFoot'), pdSight: $('pdSight'),
    clock: $('clockLine'), cash: $('cash'), stars: $('stars'), slots: $('weaponSlots'), ammo: $('ammoLine'),
    district: $('districtChip'), respectFill: $('respectFill'), respectLabel: $('respectLabel'),
    xpFill: $('xpFill'), xpLabel: $('xpLabel'), healthFill: $('healthFill'),
    dlg: $('dialogue'), dlgText: $('dlgText'), dlgName: $('dlgName'), dlgImg: $('dlgPortrait'),
    radio: $('radioPanel'), radioFreq: $('radioFreq'), radioTrack: $('radioTrack'),
    veh: $('vehPanel'), vehName: $('vehName'), vehCond: $('vehCondFill'), speedo: $('speedoNum'), gear: $('gearLabel'),
    prompt: $('prompt'), toast: $('toast'), wheel: $('wheel'), busted: $('bustedWrap'), bustedFill: $('bustedFill'),
    minimap: $('minimap'), start: $('startScreen'), garage: $('garageMenu'),
  };
  els.dlgImg.src = lunaPortraitTexture().image.toDataURL();
  els.dlgName.textContent = LUNA;
  let dlgTimer = 0, toastTimer = 0;
  const mm = els.minimap.getContext('2d');

  const hud = {
    els,
    showStart(save, story) {
      els.start.style.display = 'flex';
      $('startStory').innerHTML = story.map(l => `<div>${l}</div>`).join('');
      $('btnContinue').style.display = save.started ? 'block' : 'none';
      $('btnNew').textContent = save.started ? 'NEW GAME' : 'START — DAY 1';
    },
    hideStart() { els.start.style.display = 'none'; },
    say(text, name = LUNA) {
      els.dlg.style.opacity = '1';
      els.dlgName.textContent = name;
      els.dlgText.textContent = text;
      dlgTimer = 7;
    },
    toast(text, sub = '') {
      els.toast.innerHTML = text + (sub ? `<div class="toast-sub">${sub}</div>` : '');
      els.toast.style.opacity = '1'; toastTimer = 3.2;
    },
    prompt(text) {
      els.prompt.style.opacity = text ? '1' : '0';
      if (text) els.prompt.textContent = text;
    },
    setCash(v) { els.cash.textContent = '$' + Math.round(v).toLocaleString('en-US'); },
    setClock(minutes, day) {
      const h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60);
      els.clock.textContent = `DAY ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
    setStars(n) {
      els.stars.innerHTML = [1, 2, 3, 4, 5].map(i => `<span class="star ${i <= n ? 'on' : ''}">★</span>`).join('');
    },
    setProgress(xp, respect) {
      els.respectLabel.textContent = 'RESPECT ' + respect;
      els.respectFill.style.width = ((respect - 1) / 8 * 100) + '%';
      els.xpLabel.textContent = xpIntoLevel(xp) + '/' + XP_PER_LEVEL;
      els.xpFill.style.width = (xpIntoLevel(xp) / XP_PER_LEVEL * 100) + '%';
    },
    setHealth(v) { els.healthFill.style.width = Math.max(0, v) + '%'; },
    setBusted(frac) {
      els.busted.style.opacity = frac > 0.02 ? '1' : '0';
      els.bustedFill.style.width = (frac * 100) + '%';
    },
    setMission(obj, districtName) {
      els.mpDistrict.textContent = districtName;
      if (!obj) {
        els.mpHead.textContent = 'PALM SHORES — FREE ROAM';
        els.mpObjective.textContent = 'The gold beacon at Bayline Garage has your next job.';
        els.mpSub.textContent = 'Sunset Stars, parked cars and trouble are all yours meanwhile.';
        els.mpStage.textContent = ''; els.mpNext.textContent = '';
        els.mpTimer.textContent = ''; els.mpBar.innerHTML = '';
        return;
      }
      els.mpHead.textContent = `CH ${obj.chapter} — ${obj.title}`;
      els.mpObjective.textContent = obj.label;
      els.mpSub.textContent = obj.sighted === false ? 'They lost you — keep it that way' :
        (obj.timer != null && obj.timer < 30 ? 'The clock is loud, Mara' : 'They can see you — break line of sight');
      els.mpStage.textContent = `STAGE ${obj.stage}/${obj.stages}`;
      els.mpBar.innerHTML = Array.from({ length: obj.stages }, (_, i) =>
        `<span class="seg ${i < obj.stage - 1 ? 'done' : i === obj.stage - 1 ? 'now' : ''}"></span>`).join('');
      els.mpNext.textContent = 'NEXT: ' + obj.next;
      els.mpTimer.textContent = obj.timer != null ? formatTime(obj.timer) : '';
    },
    setPd(units, stars, sighted) {
      if (stars <= 0) { els.pd.style.display = 'none'; return; }
      els.pd.style.display = 'block';
      els.pdHead.textContent = `SHORES PD RESPONSE — ${units.length} UNITS • CODE ${stars}`;
      els.pdSight.textContent = sighted ? 'IN SIGHT' : 'EVADING';
      els.pdSight.className = 'sight ' + (sighted ? 'seen' : 'lost');
      els.pdUnits.innerHTML = units.slice(0, 5).map(u =>
        `<div class="unit"><span class="uname">${u.name}</span><span class="udist">${u.dist} m</span><span class="uchip ${u.status.toLowerCase().replace(' ', '')}">${u.status}</span></div>`).join('');
      els.pdFoot.textContent = units.length > 5 ? `+${units.length - 5} more units on Tac-3 — break line of sight` : '';
    },
    setWeapons(combat, missionsDone) {
      els.slots.innerHTML = WEAPONS.map((w, i) => {
        const un = combat.unlocked(i, missionsDone);
        return `<div class="slot ${i === combat.current ? 'sel' : ''} ${un ? '' : 'locked'}"><div class="sname">${w.name}</div><div class="skind">${un ? w.kind : 'LOCKED'}</div></div>`;
      }).join('');
      const a = combat.ammo();
      els.ammo.textContent = combat.weapon().kind + ' · ' + a.mag + (a.reserve === Infinity ? ' / ∞' : ' / ' + a.reserve);
    },
    setVehicle(inCar, model, kmh, gear, condition, nitro) {
      els.veh.style.display = inCar ? 'block' : 'none';
      els.radio.style.display = inCar ? 'block' : 'none';
      if (!inCar) return;
      els.vehName.textContent = model;
      els.speedo.textContent = Math.round(kmh);
      els.gear.textContent = gear;
      els.vehCond.style.width = Math.max(0, condition) + '%';
      els.vehCond.style.background = condition > 55 ? '#57e389' : condition > 28 ? '#ffd23e' : '#ff5c5c';
      const n = $('nitroFill'); if (n) n.style.width = (nitro * 100) + '%';
    },
    setRadio(stationIdx, trackIdx) {
      const st = RADIO[stationIdx], tr = st.tracks[trackIdx % st.tracks.length];
      els.radioFreq.textContent = `${st.freq} · ${st.name}`;
      els.radioTrack.textContent = `'${tr[0]}' — ${tr[1]}`;
    },
    wheel(open, combat, missionsDone, selected) {
      els.wheel.style.display = open ? 'block' : 'none';
      if (!open) return;
      els.wheel.innerHTML = WEAPONS.map((w, i) => {
        const un = combat.unlocked(i, missionsDone);
        const ang = -90 + i * 120;
        return `<div class="wedge ${selected === i ? 'sel' : ''} ${un ? '' : 'locked'}" style="transform: rotate(${ang}deg) translateY(-92px) rotate(${-ang}deg)">
          <div class="wname">${w.name}</div><div class="wkind">${un ? w.kind : 'LOCKED'}</div></div>`;
      }).join('') + '<div class="wheel-hub">WEAPONS</div>';
    },
    showGarage(save, cash) {
      els.garage.style.display = 'flex';
      $('garageCash').textContent = '$' + Math.round(cash).toLocaleString('en-US');
      $('garageList').innerHTML = UPGRADES.map(u => {
        const owned = save.upgrades.includes(u.id);
        return `<div class="upg"><div><div class="uname2">${u.name}</div><div class="ublurb">${u.blurb}</div></div>
          <button data-upg="${u.id}" ${owned || cash < u.cost ? 'disabled' : ''}>${owned ? 'FITTED' : '$' + u.cost.toLocaleString('en-US')}</button></div>`;
      }).join('');
      els.garage.querySelectorAll('button[data-upg]').forEach(b =>
        b.addEventListener('click', () => callbacks.onUpgrade(b.dataset.upg)));
    },
    hideGarage() { els.garage.style.display = 'none'; },
    update(dt) {
      if (dlgTimer > 0) { dlgTimer -= dt; if (dlgTimer <= 0) els.dlg.style.opacity = '0'; }
      if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) els.toast.style.opacity = '0'; }
    },
    // The round minimap: 120 m of city around the player, north up, gold route.
    drawMinimap(world, focus, heading, blips, objective, starPts) {
      const S = els.minimap.width, C = S / 2, scale = C / 120;
      mm.clearRect(0, 0, S, S);
      mm.save();
      mm.beginPath(); mm.arc(C, C, C - 2, 0, 7); mm.clip();
      mm.fillStyle = '#1d1830'; mm.fillRect(0, 0, S, S);
      const toMap = (x, z) => [C + (x - focus.x) * scale, C + (z - focus.z) * scale];
      // water
      mm.fillStyle = '#2c4a7d';
      const [wx] = toMap(252, 0); mm.fillRect(wx, 0, S - wx, S);
      // blocks
      mm.fillStyle = '#3a3050';
      for (const b of world.blockRects) {
        const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
        mm.fillRect(x, y, b.w * scale, b.d * scale);
      }
      // roads
      mm.strokeStyle = '#57496e'; mm.lineWidth = 5;
      for (const c of ROAD_CENTERS) {
        let [a] = toMap(c, 0); mm.beginPath(); mm.moveTo(a, 0); mm.lineTo(a, S); mm.stroke();
        [, a] = toMap(0, c); mm.beginPath(); mm.moveTo(0, a); mm.lineTo(S, a); mm.stroke();
      }
      // route: along the nearest avenue of roads, Manhattan style
      if (objective) {
        const [ox, oy] = toMap(objective.x, objective.z);
        const rx = ROAD_CENTERS.reduce((a, b) => Math.abs(b - objective.x) < Math.abs(a - objective.x) ? b : a);
        const [px] = toMap(rx, 0);
        mm.strokeStyle = '#ffc92e'; mm.lineWidth = 2.4; mm.beginPath();
        mm.moveTo(C, C); mm.lineTo(px, C); mm.lineTo(px, oy); mm.lineTo(ox, oy); mm.stroke();
        mm.fillStyle = '#ffc92e';
        mm.beginPath(); mm.arc(ox, oy, 4.4, 0, 7); mm.fill();
      }
      // sunset stars still out there
      mm.fillStyle = '#ffe27a';
      for (const s of starPts) { const [x, y] = toMap(s.x, s.z); mm.fillRect(x - 1.4, y - 1.4, 2.8, 2.8); }
      // police blips flash red/blue
      const flash = Math.floor(performance.now() / 280) % 2;
      for (const b of blips) {
        const [x, y] = toMap(b.x, b.z);
        mm.fillStyle = flash ? '#ff4050' : '#3a7bff';
        mm.beginPath(); mm.moveTo(x, y - 4); mm.lineTo(x - 3.4, y + 3); mm.lineTo(x + 3.4, y + 3); mm.closePath(); mm.fill();
      }
      // player arrow
      mm.translate(C, C); mm.rotate(heading);
      mm.fillStyle = '#ffffff';
      mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(-4.6, 5); mm.lineTo(0, 2.4); mm.lineTo(4.6, 5); mm.closePath(); mm.fill();
      mm.restore();
      mm.strokeStyle = 'rgba(255,255,255,0.35)'; mm.lineWidth = 2;
      mm.beginPath(); mm.arc(C, C, C - 2, 0, 7); mm.stroke();
      mm.fillStyle = '#fff'; mm.font = '700 10px system-ui'; mm.textAlign = 'center';
      mm.fillText('N', C, 12);
    },
  };
  $('btnNew').addEventListener('click', () => callbacks.onStart(true));
  $('btnContinue').addEventListener('click', () => callbacks.onStart(false));
  $('btnGarageClose').addEventListener('click', () => callbacks.onCloseGarage());
  return hud;
}
