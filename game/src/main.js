// Palm Shores — main.js
// One job: boot the game and run the loop — build the world, wire every system,
// drive the title/play/pause/game-over screens, and stage ?shot= scenes.
import * as THREE from 'three';
import { WORLD, STEP, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { buildCity } from './city.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians, removePed } from './pedestrians.js';
import { createPlayer, updatePlayerOnFoot, nearestCar, enterCar, exitCar } from './player.js';
import { updateDriving, drivingCamera, footCamera } from './driving.js';
import { addWanted, updateWanted, updatePolice } from './police.js';
import { createHeli, updateHeli } from './airunit.js';
import { createCombat, updateCombat } from './combat.js';
import { startMission, updateMissions, onThugKilled } from './missions.js';
import { spawnCollectibles, updateCollectibles } from './collectibles.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// --- Renderer, scene, camera ---
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, -30);

// --- The shared game state every system reads ---
const G = {
  scene, camera, renderer, rng: createRandom(seed), seed,
  mode: 'title', time: 0, alarm: 0, wanted: 0, wantedTimer: 0, bustedTimer: 0,
  cars: [], peds: [], pickups: [], police: [], heli: null, marker: null,
  mission: null, missionIndex: 0, objective: 'Selamat datang di Palm Shores',
  camYaw: 0, camPitch: 0.22, player: null, city: null, combat: null,
  input: createInput(canvas), audio: createAudio(), hud: null, shot: null,
  save: loadSave(),
};
G.city = buildCity(G);
createPlayer(G);
createCombat(G);
createHeli(G);
spawnTraffic(G);
spawnPedestrians(G);
spawnCollectibles(G);
G.hud = createHud(G);

// --- Helpers the systems call back into ---
G.hitsBuilding = (x, z) => {
  if (z > 186) return true;
  for (const c of G.city.colliders) {
    if (Math.abs(x - c.x) < c.hw + 0.9 && Math.abs(z - c.z) < c.hd + 0.9) return true;
  }
  return false;
};
G.nearbyPedCount = (r) => G.peds.filter((p) => Math.hypot(p.pos.x - G.player.pos.x, p.pos.z - G.player.pos.z) < r).length;
G.nearbyPoliceCount = (r) => G.police.filter((c) => Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < r).length;
G.addWanted = (stars, reason) => addWanted(G, stars, reason);
G.showMessage = (t) => G.hud.showMessage(t);
G.showBrief = (t) => G.hud.showBrief(t);
G.saveGame = () => storeSave(G);
G.damagePlayer = (amount, source) => {
  const p = G.player;
  if (G.mode !== 'play') return;
  if (G.shot) return; // staged screenshot scenes never die mid-capture
  let left = amount;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, left * 0.6); p.armor -= absorbed; left -= absorbed; }
  p.health -= left;
  if (p.health <= 0) { p.health = 0; G.gameOver(`Tewas — ${source}`); }
};
G.killPed = (ped, reason) => {
  onThugKilled(G, ped);
  if (!ped.thug) G.addWanted(2, `Pejalan kaki tewas (${reason})`);
  removePed(G, ped);
};
G.crashCar = (car, hitOther) => {
  G.audio.thud();
  if (G.shot) return; // staged screenshot scenes never wreck the hero car
  car.health -= 8;
  if (car.driver === 'player') {
    G.damagePlayer(3, 'kecelakaan');
    if (hitOther) G.addWanted(1, 'Tabrakan dengan mobil lain');
  }
  if (car.health <= 0 && car.driver === 'player') {
    car.speed = 0;
    G.showMessage('Mobilmu rusak parah — keluar dan cari mobil lain!');
  }
};
G.gameOver = (reason) => {
  if (G.mode !== 'play') return;
  G.mode = 'over';
  G.audio.setSiren(false);
  G.audio.setEngine(0, false);
  document.getElementById('over-reason').textContent = reason;
  document.getElementById('over-cash').textContent = `$${Math.floor(G.player.cash).toLocaleString('en-US')}`;
  document.getElementById('screen-over').classList.add('show');
  storeSave(G);
};

// --- Screens ---
const titleEl = document.getElementById('screen-title');
const pauseEl = document.getElementById('screen-pause');
const overEl = document.getElementById('screen-over');
const crosshair = document.getElementById('crosshair');

function showScreen(name) {
  titleEl.classList.toggle('show', name === 'title');
  pauseEl.classList.toggle('show', name === 'pause');
  overEl.classList.toggle('show', name === 'over');
  crosshair.style.display = name === 'play' && !G.player.car ? 'block' : 'none';
}

function startGame(fromSave) {
  G.audio.unlock();
  const save = fromSave ? loadSave() : null;
  // Fresh run: reset the player and the world state.
  G.player.health = 100; G.player.armor = 50; G.player.ammo = 60;
  G.player.cash = save ? save.cash : 0;
  G.missionIndex = save ? save.missionIndex : 0;
  G.wanted = 0; G.wantedTimer = 0; G.bustedTimer = 0; G.alarm = 0;
  if (G.player.car) { G.player.car.driver = null; G.player.car = null; }
  G.player.mesh.visible = true;
  G.player.pos.set(0, 0, -20);
  G.player.mesh.position.set(0, 0, -20);
  G.mode = 'play';
  showScreen('play');
  startMission(G, G.missionIndex);
  G.showMessage('Selamat datang di Palm Shores. Ikuti objektif di atas!');
}

document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-restart').addEventListener('click', () => startGame(false));
document.getElementById('btn-resume').addEventListener('click', () => {
  G.mode = 'play'; showScreen('play');
});
document.getElementById('btn-quit').addEventListener('click', () => {
  storeSave(G); G.mode = 'title'; showScreen('title');
});
if (!G.save) document.getElementById('btn-continue').style.display = 'none';
else document.getElementById('save-info').textContent = `Lanjutan: $${G.save.cash} — misi ${Math.min(G.save.missionIndex + 1, MISSIONS.length)}/5`;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Shot staging ---
let framesRendered = 0;
if (shotName) {
  G.shot = stageShot(G, shotName);
  showScreen(G.mode === 'title' ? 'title' : 'play');
  // Hide the title overlay's buttons for a clean start-screen shot.
  if (shotName === 'start') document.getElementById('title-buttons').style.opacity = '0.92';
}

// --- Fixed-step loop ---
let last = performance.now();
let accumulator = 0;

function step(dt) {
  G.time += dt;
  if (G.alarm > 0) G.alarm -= dt;
  if (G.mode !== 'play') return;
  const { input, player } = G;

  if (input.wasPressed('pause')) {
    G.mode = 'pause'; showScreen('pause');
    return;
  }
  if (player.car) {
    if (input.wasPressed('enter')) exitCar(G);
    else updateDriving(G, dt);
  } else {
    updatePlayerOnFoot(G, dt);
    if (input.wasPressed('enter')) {
      const car = nearestCar(G);
      if (car) enterCar(G, car);
      else G.showMessage('Tidak ada mobil di dekatmu — cari mobil parkir (E).');
    }
  }
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  updateHeli(G, dt);
  updateWanted(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  updateCollectibles(G, dt);
  // Shot mode: keep the chase car rolling forward for a lively cover frame,
  // looping back along the same street so the chase never leaves downtown.
  if (G.shot?.drive && player.car) {
    player.car.speed = Math.min(player.car.speed, 20);
    if (player.car.speed < 14) player.car.speed += dt * 6;
    player.car.pos.x += Math.sin(player.car.heading) * player.car.speed * dt;
    player.car.pos.z += Math.cos(player.car.heading) * player.car.speed * dt;
    if (player.car.pos.x > 175) {
      player.car.pos.x = -175;
      for (const c of G.police) c.pos.x -= 350;
    }
    for (const c of G.police) {
      const dx = player.car.pos.x - c.pos.x, dz = player.car.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 10) { c.pos.x += (dx / d) * 15 * dt; c.pos.z += (dz / d) * 15 * dt; }
      else if (d < 8) { c.pos.x -= (dx / d) * (8 - d); c.pos.z -= (dz / d) * (8 - d); }
      c.heading = Math.atan2(dx, dz);
      c.mesh.rotation.y = c.heading;
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  while (accumulator >= STEP) { step(STEP); accumulator -= STEP; }
  // Camera.
  if (G.shot?.follow === 'chase' && G.player.car) {
    // Cover shot: a cinematic three-quarter chase view that tracks the car.
    const car = G.player.car;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    camera.position.set(car.pos.x - fx * 13 + rx * 6, 5.2, car.pos.z - fz * 13 + rz * 6);
    camera.lookAt(car.pos.x + fx * 6, 1.4, car.pos.z + fz * 6);
  } else if (G.shot?.fixed) {
    camera.position.set(...G.shot.pos);
    camera.lookAt(...G.shot.look);
  } else if (G.mode === 'title') {
    // Slow orbit over Neon Row behind the title screen.
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 60, 30, -120 + Math.cos(t) * 30);
    camera.lookAt(0, 6, -60);
  } else if (G.player.car) drivingCamera(G, elapsed);
  else footCamera(G, elapsed);
  G.city.update(elapsed, camera.position);
  renderer.render(scene, camera);
  if (G.mode === 'play') G.hud.update();
  framesRendered += 1;
  if (shotName && framesRendered >= 45) window.__shotReady = true;
}

if (!shotName) showScreen('title');
requestAnimationFrame(frame);
