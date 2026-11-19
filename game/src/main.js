// Palm Shores — boot and game loop. Builds the city, wires every system
// (driving, on-foot, police, air unit, combat, missions, traffic, crowds,
// collectibles, radio, save) and runs the frame: play mode with a start
// screen and pointer-lock aim, or a staged ?shot= scene for the dossier.

import * as THREE from 'three';
import { CITY, STORY_INTRO, LUNA } from './config.js';
import { mulberry32, clamp, dist2d } from './random.js';
import { buildWorld, updateSun } from './city.js';
import { makeCarEntity } from './vehicles.js';
import { createTraffic, spawnParkedCars } from './vehicles.js';
import { createHeroCar, stepDriving, chaseCamera, orbitCamera, carSpeedKmh, carGear } from './driving.js';
import { createPlayer, stepOnFoot, nearestCar, clampToCity } from './player.js';
import { createPolice } from './police.js';
import { createAirUnit } from './airunit.js';
import { createCombat } from './combat.js';
import { createCollectibles } from './collectibles.js';
import { createPedestrians } from './pedestrians.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { initInput, endFrameInput, keys, pressed, mouse } from './input.js';
import { loadSave, storeSave, respectForXp } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const seed = parseInt(params.get('seed') ?? '7', 10);
const rng = mulberry32(seed * 1000 + 17);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!SHOT });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(30, 9, 34);

const world = buildWorld(scene, rng);
const save = loadSave();
const audio = createAudio();
audio.setStation(save.station);

const heroCar = createHeroCar(scene);
heroCar.setPos(168, -6, -Math.PI / 2);
const player = createPlayer(scene);
player.setPos(163, -2, Math.PI / 2);

const traffic = createTraffic(scene, world, rng, 18);
const parked = spawnParkedCars(scene, world, rng);
const peds = createPedestrians(scene, world, rng, 16);
const pd = createPolice(scene, world, rng);
const heli = createAirUnit(scene);
const combat = createCombat(scene);
const collectibles = createCollectibles(scene, world, save.stars);

// ---- mutable run state -------------------------------------------------------
const G = {
  started: !!SHOT, inCar: false, car: null, health: 100, lastHitAt: -99,
  clockMin: CITY.dayStart, day: 1, camYaw: Math.PI, camPitch: 0.16,
  wheelT: 0, wheelSel: 0, radioTime: 0, trackIdx: 0, shake: 0,
  objective: null, saveT: 0, over: false, pointerLocked: false,
};

// ---- mission context ----------------------------------------------------------
let chaseEnt = null, rivalEnt = null;
function simpleDriver(ent, targetX, targetZ, speed, dt) {
  const p = ent.mesh.position;
  const want = Math.atan2(targetX - p.x, targetZ - p.z);
  let dh = want - ent.heading;
  while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
  ent.heading += clamp(dh, -1.7 * dt, 1.7 * dt);
  ent.speed += clamp(speed - ent.speed, -18 * dt, 8 * dt);
  let nx = p.x + Math.sin(ent.heading) * ent.speed * dt;
  let nz = p.z + Math.cos(ent.heading) * ent.speed * dt;
  const fixed = world.collide(nx + Math.sin(ent.heading) * 1.4, nz + Math.cos(ent.heading) * 1.4, 1.1);
  nx += fixed.x - (nx + Math.sin(ent.heading) * 1.4); nz += fixed.z - (nz + Math.cos(ent.heading) * 1.4);
  ent.mesh.position.set(nx, 0, nz); ent.mesh.rotation.y = ent.heading;
}
const missionCtx = {
  save, pd,
  say(text, label) { if (label) hud.toast(label); hud.say(text); },
  focusPos() { const e = G.inCar ? G.car : player; return e.mesh.position; },
  inCar: () => G.inCar,
  setObjective(o) { G.objective = o; },
  giveReward(cash, xp, title) {
    save.cash += cash; save.xp += xp; save.respect = respectForXp(save.xp);
    hud.toast('JOB COMPLETE', `${title} · +$${cash.toLocaleString('en-US')} · +${xp} XP`);
    audio.sting(); persist();
  },
  spawnHostiles(stage) {
    combat.clearHostiles();
    const spots = [[0, 0], [7, -5], [-6, 6], [3, 10], [-9, -3]];
    for (let i = 0; i < stage.count; i++) {
      const [ox, oz] = spots[i % spots.length];
      combat.spawnHostile(stage.x + ox, stage.z + oz, { color: [0xd94f70, 0x8d6fd1, 0xff8c42, 0x3fbf8f][i % 4] });
    }
  },
  clearHostiles: () => combat.clearHostiles(),
  hostilesAlive: () => combat.hostilesAlive().length,
  spawnChaseCar() {
    missionCtx.clearChase();
    chaseEnt = makeCarEntity(scene, { kind: 'coupe', color: 0x5b8def, model: 'VELMARA COUPE' });
    chaseEnt.driver = 'rival';
    const p = missionCtx.focusPos();
    chaseEnt.setPos(p.x + 26, p.z + 10, 0.6);
  },
  spawnRival() {
    missionCtx.clearChase();
    rivalEnt = makeCarEntity(scene, { kind: 'coupe', color: 0xe8c547, model: 'TARPON GT-R' });
    rivalEnt.driver = 'rival';
    rivalEnt.setPos(40, 6, -Math.PI / 2);
  },
  chaseCar: () => chaseEnt,
  rivalCar: () => rivalEnt,
  clearChase() {
    for (const e of [chaseEnt, rivalEnt]) if (e) { scene.remove(e.mesh); }
    chaseEnt = null; rivalEnt = null;
  },
  onMissionStart() { persist(); },
  onMissionComplete(m, idx) {
    if (!save.missionsDone.includes(idx)) save.missionsDone.push(idx);
    save.respect = respectForXp(save.xp); persist();
  },
  onMissionFail() { persist(); },
  onCheckpoint(n, total) { hud.toast(`CHECKPOINT ${n}/${total}`); audio.pickup(); },
};
const missions = createMissions(scene, missionCtx);

// ---- HUD ----------------------------------------------------------------------
const hud = createHud({
  onStart(fresh) {
    if (fresh) { const keep = save.station; Object.assign(save, { cash: 250, xp: 0, respect: 1, missionsDone: [], stars: [], upgrades: [], started: true, station: keep }); missions.index = 0; }
    save.started = true; persist();
    G.started = true;
    hud.hideStart();
    audio.unlock();
    hud.say('Sunset Avenue is yours, Mara. The Vespera is waiting on the Strand — and Luna is on comms.', LUNA);
  },
  onUpgrade(id) {
    const up = { engine: 900, nitro: 1400, armor: 1100 }[id];
    if (!up || save.upgrades.includes(id) || save.cash < up) return;
    save.cash -= up; save.upgrades.push(id); persist();
    hud.showGarage(save, save.cash);
    hud.toast('FITTED', id.toUpperCase());
    audio.sting();
  },
  onCloseGarage() { hud.hideGarage(); G.garageOpen = false; },
});

combat.onShoot = (w) => { audio.shot(w.kind); if (!SHOT) pd.raise(6); G.shake = Math.max(G.shake, 0.05); };
combat.onPlayerHit = (dmg) => {
  if (G.over || !G.started) return;
  G.health -= dmg; G.lastHitAt = perfNow();
  if (G.health <= 0) wasted();
};
combat.onHostileDown = () => { pd.raise(25); audio.pickup(); };
pd.onBusted = () => { if (!G.over) busted(); };

function perfNow() { return performance.now() / 1000; }
function persist() { storeSave(save); }

function respawn() {
  pd.clear(); missionCtx.clearChase(); combat.clearHostiles();
  if (missions.active !== null && missions.active !== undefined) missions.fail('');
  G.health = 100; G.inCar = false; G.car = null;
  player.mesh.visible = true;
  player.setPos(-150, 130, Math.PI);
  heroCar.setPos(-146, 124, -Math.PI / 2); heroCar.speed = 0; heroCar.vx = 0; heroCar.vz = 0; heroCar.condition = Math.max(heroCar.condition, 60);
  heroCar.driver = 'player';
}
function wasted() {
  if (G.over) return; G.over = true;
  flash('WASTED');
  save.cash = Math.max(0, Math.floor(save.cash * 0.92)); persist();
  setTimeout(() => { respawn(); G.over = false; }, 1400);
}
function busted() {
  if (G.over) return; G.over = true;
  flash('BUSTED');
  save.cash = Math.max(0, Math.floor(save.cash * 0.85)); persist();
  setTimeout(() => { respawn(); G.over = false; }, 1400);
}
function flash(text) {
  const el = document.getElementById('flashCard');
  document.getElementById('flashText').textContent = text;
  el.style.display = 'flex';
  setTimeout(() => el.style.display = 'none', 1300);
}

// ---- interactions ---------------------------------------------------------------
function focusEntity() { return G.inCar ? G.car : player; }
function enterCar(car) {
  G.inCar = true; G.car = car;
  player.mesh.visible = false;
  if (car.driver === 'traffic') { pd.raise(35); hud.toast('CARJACKED', car.model); }
  if (car.driver !== 'player') car.driver = 'player';
  audio.unlock();
}
function exitCar() {
  if (!G.car) return;
  const car = G.car, p = car.mesh.position;
  const side = car.heading + Math.PI / 2;
  player.setPos(p.x + Math.sin(side) * 2.2, p.z + Math.cos(side) * 2.2, car.heading);
  player.mesh.visible = true;
  if (car !== heroCar) car.driver = 'parked';
  G.inCar = false; G.car = null;
}

// ---- the frame ------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  step(dt, false);
  renderer.render(scene, camera);
}

function step(dt, frozen) {
  const t = nowSec();
  for (const fn of world.updateFns) fn(dt, t);
  if (frozen) return;
  const focus = focusEntity();
  const fp = focus.mesh.position;

  if (!G.started) { // menu: the city lives behind the start card
    orbitCamera(camera, { x: 0, z: 0 }, 34, 10, t * 0.05);
    traffic.update(dt, null);
    peds.update(dt, t, []);
    updateSun(world, new THREE.Vector3(0, 0, 0));
    return;
  }
  if (G.over) return;

  G.clockMin += dt * 0.8;
  if (G.clockMin >= 1440) { G.clockMin -= 1440; G.day++; }

  // mission beacon: drive or walk into the gold ring to take the next job
  if (missions.available() && dist2d(fp.x, fp.z, -150, 138) < 3.6) missions.start(missions.index);
  missions.update(dt);
  if (chaseEnt) { // the courier runs the roads away from you
    const cp = chaseEnt.mesh.position;
    const away = Math.atan2(cp.x - fp.x, cp.z - fp.z);
    simpleDriver(chaseEnt, cp.x + Math.sin(away) * 60, cp.z + Math.cos(away) * 60, 15.5, dt);
  }
  if (rivalEnt && missions.stage?.type === 'race') {
    const cps = missions.stage.checkpoints, cp = cps[Math.min(missions.rivalCp, cps.length - 1)];
    simpleDriver(rivalEnt, cp[0], cp[1], 17.5, dt);
  }

  let prompt = null;
  if (G.inCar) {
    const car = G.car;
    const input = G.garageOpen ? { throttle: 0, steer: 0, handbrake: true, nitro: false } : {
      throttle: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
      steer: (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0),
      handbrake: keys.has('Space'), nitro: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    };
    const others = [...traffic.cars, ...parked, heroCar, ...pd.entities().filter(c => c.active)].filter(c => c !== car);
    const res = stepDriving(car, input, dt, world, others, {
      upgrades: car === heroCar ? save.upgrades : [],
      onCrash: (impact) => { audio.crash(impact); G.shake = Math.max(G.shake, Math.min(0.5, impact * 0.02)); if (impact > 12) pd.raise(8); },
    });
    if (res.nitroOn) G.shake = Math.max(G.shake, 0.06);
    G.shake = Math.max(0, G.shake - dt * 1.4);
    chaseCamera(camera, car, dt, G.shake * 0.4);
    G.camYaw = car.heading;
    if (pressed.has('KeyF')) exitCar();
    if (car === heroCar && dist2d(fp.x, fp.z, world.garage.x, 146) < 7.5) {
      prompt = 'E — BAYLINE GARAGE TUNING';
      if (pressed.has('KeyE')) { G.garageOpen = true; hud.showGarage(save, save.cash); }
    }
    if (pressed.has('KeyN')) {
      save.station = (save.station + 1) % 4; audio.setStation(save.station); G.trackIdx = 0; G.radioTime = 0; persist();
    }
    G.radioTime += dt;
    const trackCount = [5, 3, 3, 3][save.station];
    const ti = Math.floor(G.radioTime / 40) % trackCount;
    if (ti !== G.trackIdx) { G.trackIdx = ti; }
  } else {
    // on foot
    const move = {
      forward: keys.has('KeyW') || keys.has('ArrowUp'), back: keys.has('KeyS') || keys.has('ArrowDown'),
      left: keys.has('KeyA') || keys.has('ArrowLeft'), right: keys.has('KeyD') || keys.has('ArrowRight'),
      run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    };
    player.aiming = mouse.down || mouse.rightDown;
    stepOnFoot(player, move, dt, world, G.camYaw);
    clampToCity(player);
    // third-person camera on the pointer-lock yaw
    const back = 5.4, camX = fp.x - Math.sin(G.camYaw) * back, camZ = fp.z - Math.cos(G.camYaw) * back;
    const fixed = world.collide(camX, camZ, 0.4);
    camera.position.set(fixed.x, 2.15 + G.camPitch * 4.4, fixed.z);
    camera.lookAt(fp.x + Math.sin(G.camYaw) * 4, 1.35, fp.z + Math.cos(G.camYaw) * 4);
    if (Math.abs(camera.fov - 60) > 0.1) { camera.fov = 60; camera.updateProjectionMatrix(); }
    const near = nearestCar(player, [...traffic.cars, ...parked], heroCar);
    if (near) { prompt = near.label; if (pressed.has('KeyF')) enterCar(near.car); }
    // shooting toward the camera's forward
    if (mouse.down && !G.garageOpen) {
      const dir = new THREE.Vector3(Math.sin(G.camYaw), 0.06, Math.cos(G.camYaw)).normalize();
      const origin = new THREE.Vector3(fp.x + dir.x * 0.5, 1.32, fp.z + dir.z * 0.5);
      player.heading = G.camYaw;
      combat.tryFire(perfNow() * 1000, origin, dir, world, save.missionsDone.length);
    }
    if (pressed.has('KeyR')) combat.reload(perfNow() * 1000);
  }

  // weapon wheel: hold Q, pick with the mouse, release to confirm; tap cycles
  if (pressed.has('KeyQ')) { G.wheelT = 0; G.wheelSel = combat.current; }
  if (keys.has('KeyQ')) {
    G.wheelT += dt;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const ang = Math.atan2(mouse.y - cy, mouse.x - cx) * 180 / Math.PI;
    let best = 0, bd = 1e9;
    for (let i = 0; i < 3; i++) { const a = -90 + i * 120; const d = Math.abs(((ang - a + 540) % 360) - 180); if (d < bd) { bd = d; best = i; } }
    if (Math.hypot(mouse.x - cx, mouse.y - cy) > 40) G.wheelSel = best;
    combat.wheelOpen = true;
  } else if (combat.wheelOpen) {
    if (G.wheelT < 0.22) combat.cycle(save.missionsDone.length);
    else combat.select(G.wheelSel, save.missionsDone.length);
    combat.wheelOpen = false;
  }

  // city life and law
  traffic.update(dt, G.inCar ? G.car : null);
  const threats = [];
  if (G.inCar && Math.abs(G.car.speed) > 9) threats.push({ x: fp.x, z: fp.z, r: 7 });
  peds.update(dt, t, threats);
  const heliNear = heli.update(dt, { x: fp.x, z: fp.z, stars: pd.stars }, t);
  pd.update(dt, {
    x: fp.x, z: fp.z, vx: G.inCar ? G.car.vx ?? 0 : 0, vz: G.inCar ? G.car.vz ?? 0 : 0,
    speed: G.inCar ? G.car.speed : 0, heading: G.inCar ? G.car.heading : player.heading,
    inCar: G.inCar, onFoot: !G.inCar, heliNear,
  }, t);
  combat.update(dt, fp, G.health > 0);
  collectibles.update(dt, t, fp, (id) => {
    if (!save.stars.includes(id)) { save.stars.push(id); save.xp += 25; save.respect = respectForXp(save.xp); persist(); }
    hud.toast('SUNSET STAR', `${save.stars.length}/12 · +25 XP`); audio.pickup();
  });
  // gentle health recovery away from trouble
  if (perfNow() - G.lastHitAt > 7 && G.health > 0) G.health = Math.min(100, G.health + dt * 3.2);

  updateSun(world, fp);
  refreshHud(dt);
  audio.update(dt, { speed: G.inCar ? G.car.speed : 0, inCar: G.inCar, stars: pd.stars, radioOn: true });
  G.saveT += dt; if (G.saveT > 10) { G.saveT = 0; persist(); }
  endFrameInput();
}

let hudT = 0;
function refreshHud(dt) {
  hudT += dt;
  const focus = focusEntity(), fp = focus.mesh.position;
  hud.setCash(save.cash);
  hud.setClock(G.clockMin, G.day);
  hud.setStars(pd.stars);
  hud.setProgress(save.xp, save.respect);
  hud.setHealth(G.health);
  hud.setBusted(pd.stars > 0 ? pd.bustedMeter / 2.4 : 0);
  hud.setWeapons(combat, save.missionsDone.length);
  hud.wheel(combat.wheelOpen, combat, save.missionsDone.length, G.wheelSel);
  hud.setRadio(save.station, G.trackIdx);
  if (G.inCar) hud.setVehicle(true, G.car.model, carSpeedKmh(G.car), carGear(G.car), G.car.condition, G.car.nitro ?? 0);
  else hud.setVehicle(false);
  hud.setMission(missions.active !== null && missions.active !== undefined ? G.objective : null, world.districtAt(fp.x, fp.z));
  hud.els.district.textContent = world.districtAt(fp.x, fp.z);
  const units = pd.unitsForHud(fp);
  if (pd.stars >= 3) units.splice(1, 0, heli.unitForHud(fp));
  hud.setPd(units, pd.stars, pd.sighted);
  // prompt priority: garage / car / job
  let prompt = null;
  if (G.inCar && G.car === heroCar && dist2d(fp.x, fp.z, world.garage.x, 146) < 7.5) prompt = 'E — BAYLINE GARAGE TUNING';
  else if (!G.inCar) { const near = nearestCar(player, [...traffic.cars, ...parked], heroCar); if (near) prompt = near.label; }
  else if (missions.available()) prompt = null;
  hud.prompt(prompt);
  hud.update(dt);
  if (hudT > 0.12) {
    hudT = 0;
    hud.drawMinimap(world, fp, G.inCar ? G.car.heading : G.camYaw, pd.cruiserPositions(), objectivePoint(), collectibles.stars.filter(s => !s.taken).map(s => s.mesh.position));
  }
}
function objectivePoint() {
  if (missions.active === null || missions.active === undefined) return missions.available() ? { x: -150, z: 138 } : null;
  const s = missions.stage;
  if (!s) return null;
  if (s.type === 'chase' || s.type === 'race') { const c = missionCtx.chaseCar() ?? missionCtx.rivalCar(); return c ? c.mesh.position : null; }
  return s.x !== undefined ? { x: s.x, z: s.z } : { x: -150, z: 138 };
}
function nowSec() { return performance.now() / 1000; }

// pointer lock aim for the on-foot camera
renderer.domElement.addEventListener('click', () => {
  audio.unlock();
  if (G.started && !G.inCar && !SHOT) renderer.domElement.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => { G.pointerLocked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', (e) => {
  if (!G.pointerLocked) return;
  G.camYaw -= e.movementX * 0.0026;
  G.camPitch = clamp(G.camPitch + e.movementY * 0.0016, -0.05, 0.55);
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { const m = audio.toggleMute(); hud.toast(m ? 'SOUND OFF' : 'SOUND ON'); }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- boot -----------------------------------------------------------------------
initInput(window);
const game = {
  scene, camera, renderer, world, save, hud, pd, heli, combat, missions,
  heroCar, player, traffic, peds, storyLines: STORY_INTRO,
  setInCar(v) { G.inCar = v; G.car = v ? heroCar : null; player.mesh.visible = !v; },
  step, render() { renderer.render(scene, camera); },
};
if (SHOT) {
  hud.hideStart();
  stageShot(game, SHOT);
} else {
  hud.showStart(save, STORY_INTRO);
  requestAnimationFrame(frame);
}
