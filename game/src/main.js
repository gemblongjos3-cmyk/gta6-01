// Palm Shores — main.js
// Boot and game-loop wiring: renderer, world, every system, the state
// machine (menu / playing / paused / over), crimes and wanted heat,
// shooting, saves, and the ?shot= staging used for screenshots.

import * as THREE from 'three';
import { GAME_TITLE, PLAYER_TUNING, ECONOMY, WANTED } from './config.js';
import { makeRng, seedFromUrl } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City } from './city.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Driving } from './driving.js';
import { Police } from './police.js';
import { AirUnit } from './airunit.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Collectibles } from './collectibles.js';
import { HUD } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { shotFromUrl, stageShot } from './shots.js';
import { makeCar } from './vehicles.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 6, -30);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.addEventListener('error', (e) => { window.__gameError = String(e.message || e.error); });

const seed = seedFromUrl();
const rng = makeRng(seed);
const input = new Input(canvas);
const audio = new AudioEngine();
const hud = new HUD();
const city = new City(scene, rng);
const traffic = new Traffic(scene, city, rng);
const peds = new Pedestrians(scene, city, rng);
const player = new Player(scene, city);
const driving = new Driving(scene, city, traffic);
const police = new Police(scene, city, rng);
const airunit = new AirUnit(scene);
const combat = new Combat(scene, camera);
const missions = new Missions(scene, rng);
const collectibles = new Collectibles(scene, city, rng);

const game = {
  scene, camera, renderer, city, traffic, peds, player, driving, police,
  airunit, combat, missions, collectibles, hud, audio, rng,
  now: 0, cash: ECONOMY.startCash, state: 'menu', shotCam: null,
};

let save = loadSave();
if (save) {
  game.cash = save.cash;
  collectibles.coinsCollected = save.coins;
}

// --- Mission events -> HUD / cash / save ---
function persist() {
  writeSave({ cash: game.cash, missionIndex: missions.index, coinsCollected: collectibles.coinsCollected });
}
missions.events = {
  briefing: (t) => { hud.briefing(t); audio.radioBlip(); },
  objective: (t) => hud.setObjective(t),
  reward: (t) => {
    hud.toast(t);
    audio.chime();
    player.ammo += 48;
    persist();
  },
  fail: (t) => { hud.toast(t); audio.thud(); },
  storyDone: () => {
    hud.briefing('ROOK: That is the whole set, Jax. Palm Shores is yours now — free roam, collect the palm coins, keep the night alive.');
    persist();
  },
  toast: (t) => hud.toast(t),
};
police.onCrime = (stars, kind) => {
  if (stars > 0) hud.toast(stars >= 4 ? 'AIR UNIT OVERHEAD — lose them!' : `Wanted level ${stars} — the PD is on you`);
};

// --- Helpers ---
function playerPos() {
  return driving.driving ? driving.car.position : player.pos;
}
function spawnMarkedCar(type, x, z) {
  const g = makeCar(type, 0xff2e88);
  g.position.set(x, 0, z);
  g.rotation.y = 0;
  scene.add(g);
  traffic.stealables.push(g);
  traffic.parked.push(g);
  return g;
}
function missionCtx() {
  return {
    pos: playerPos(), driving: driving.driving, car: driving.car,
    police, peds, traffic, player, now: game.now,
    addCash: (n) => { game.cash += n; hud.setCash(game.cash); },
    spawnMarkedCar,
    onPlayerDown: () => gameOver('You went down in the neon. Rook will find another wheelman.'),
  };
}
function witnessed(radius = 40) {
  return police.playerSeenByPolice(playerPos()) ||
    police.cruisers.some((c) => Math.hypot(c.group.position.x - playerPos().x, c.group.position.z - playerPos().z) < radius);
}

// --- State changes ---
function startGame(fromSave) {
  audio.ensure();
  if (fromSave && save) {
    game.cash = save.cash;
    missions.start(save.missionIndex);
  } else {
    game.cash = ECONOMY.startCash;
    missions.start(0);
  }
  player.reset(0, -20);
  police.clear();
  airunit.update(0, 0, playerPos(), 0);
  hud.setCash(game.cash);
  hud.setHealth(player.health, player.armor);
  hud.setAmmo(player.ammo);
  hud.hideScreens();
  hud.toast('Welcome to Palm Shores. Follow the gold marker.');
  game.state = 'playing';
  input.lockPointer();
}
function gameOver(text) {
  game.state = 'over';
  input.unlockPointer();
  audio.engine(0, false);
  audio.siren(false);
  hud.showOver(text);
  persist();
}
function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    input.unlockPointer();
    hud.showPause();
    audio.engine(0, false);
    audio.siren(false);
  } else if (game.state === 'paused') {
    game.state = 'playing';
    hud.hideScreens();
    input.lockPointer();
  }
}

document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-restart').addEventListener('click', () => { game.state = 'menu'; hud.showStart(!!save); startGame(false); });
document.getElementById('btn-again').addEventListener('click', () => { player.reset(0, -20); police.clear(); game.state = 'playing'; hud.hideScreens(); input.lockPointer(); });

hud.showStart(!!save);
hud.setCash(game.cash);
hud.setStars(0);
hud.setObjective('Press START — Rook is waiting on the radio');

// --- Screenshot staging (?shot=) ---
const shotName = shotFromUrl();
if (shotName === 'start') {
  game.state = 'menu';
  hud.showStart(!!save);
} else if (shotName) {
  game.state = 'playing';
  hud.hideScreens();
  missions.events.briefing = () => {};
  game.shotCam = stageShot(game, shotName);
  hud.setCash(game.cash);
  hud.setHealth(player.health, player.armor);
  hud.setAmmo(player.ammo);
  hud.setStars(police.starCount());
  window.__shotReady = true;
}

// --- Main loop ---
const clock = new THREE.Clock();
let minimapTick = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.now += dt;
  const now = game.now;

  if (game.state === 'playing') {
    // Pause keys.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) togglePause();

    // Enter / exit car.
    if (input.wasPressed('KeyE')) {
      audio.ensure();
      if (driving.driving) {
        driving.exit(player);
        hud.toast('On foot.');
      } else {
        const car = traffic.nearestStealable(player.pos, 5.5);
        if (car) {
          const label = driving.enter(car);
          player.group.visible = false;
          hud.toast(`You took the ${label}.`);
          audio.thud();
          if (witnessed(35)) police.addHeat(WANTED.crimeHeat.theft, 'theft', now);
          peds.scare(playerPos().x, playerPos().z, 12);
        }
      }
    }

    // Shooting (on foot only).
    if (!driving.driving && input.clicked && combat.canShoot() && player.ammo > 0) {
      audio.ensure();
      player.ammo -= 1;
      hud.setAmmo(player.ammo);
      audio.shot();
      const origin = camera.position.clone();
      const dir = player.aimDirection(camera);
      const targets = [
        ...peds.peds.map((p) => ({
          group: p.group, radius: 1.0, dead: p.dead,
          onHit: (dmg) => {
            peds.kill(p);
            police.addHeat(WANTED.crimeHeat.pedestrian, 'pedestrian', now);
            peds.scare(p.group.position.x, p.group.position.z, 20);
          },
        })),
        ...missions.guardTargets(),
      ];
      const hit = combat.shoot(now, origin, dir, targets);
      if (!hit) {
        police.addHeat(witnessed(40) ? WANTED.crimeHeat.shot : 4, 'shot', now);
        peds.scare(playerPos().x, playerPos().z, 16);
      }
      if (player.ammo === 0) hud.toast('Out of ammo — finish a mission to restock.');
    }
    if (!driving.driving && input.mouseDown && !input.locked) input.lockPointer();

    // Move: drive or walk.
    if (driving.driving) {
      driving.update(dt, input, camera, player, (speed) => {
        audio.thud();
        if (witnessed(40)) police.addHeat(WANTED.crimeHeat.collision, 'collision', now);
        hud.damageFlash();
        // Running someone over.
        const hit = peds.nearest(driving.car.position, 2.6);
        if (hit && Math.abs(driving.car.userData.car.speed) > 5) {
          peds.kill(hit);
          police.addHeat(WANTED.crimeHeat.pedestrian, 'pedestrian', now);
          peds.scare(driving.car.position.x, driving.car.position.z, 20);
        }
      });
    } else {
      player.update(dt, input, camera);
    }

    // Fixed screenshot camera overrides the follow cameras.
    if (game.shotCam) {
      camera.position.copy(game.shotCam.pos);
      camera.lookAt(game.shotCam.look);
    }

    // World systems.
    traffic.update(dt, playerPos());
    peds.update(dt);
    missions.update(dt, missionCtx());
    missions.updateGuards(dt, missionCtx(), combat);
    collectibles.update(dt, now, playerPos(), (item) => {
      audio.chime();
      if (item.kind === 'cash') {
        game.cash += item.value;
        player.ammo += 6;
        hud.toast(`+$${item.value} cash`);
      } else {
        game.cash += 50;
        hud.toast(`Palm coin ${collectibles.coinsCollected}/${ECONOMY.collectibleCount} — +$50`);
        if (collectibles.coinsCollected >= ECONOMY.collectibleCount) {
          game.cash += ECONOMY.collectibleBonus;
          hud.toast(`All palm coins! Bonus +$${ECONOMY.collectibleBonus}`);
        }
      }
      hud.setCash(game.cash);
      hud.setAmmo(player.ammo);
      persist();
    });

    // Wanted + police + heli.
    const seen = police.playerSeenByPolice(playerPos()) || airunit.watching();
    police.decay(dt, now, seen);
    police.update(dt, now, playerPos(), driving.driving, (speed, isDriving) => {
      audio.thud();
      hud.damageFlash();
      const died = player.takeDamage(isDriving ? speed * 0.5 : speed * 0.9);
      hud.setHealth(player.health, player.armor);
      if (died) gameOver('The PD rammed you into the ground. The night got you.');
    });
    airunit.update(dt, now, playerPos(), police.starCount());
    hud.setStars(police.starCount());
    combat.update(dt, now);

    // Sound: engine hum by speed, siren by wanted level.
    const speedFrac = driving.driving
      ? Math.abs(driving.car.userData.car.speed) / driving.car.userData.car.spec.top
      : (player.moving ? 0.15 : 0);
    audio.engine(speedFrac, driving.driving || player.moving);
    audio.siren(police.starCount() >= 1);

    // HUD.
    hud.setHealth(player.health, player.armor);
    hud.setSpeed(driving.speedKmh, driving.driving);
    hud.setCash(game.cash);
    hud.setTimer(missions.timer > 0 ? missions.timer : null);
    document.getElementById('crosshair').style.display = driving.driving ? 'none' : 'block';
    minimapTick += dt;
    if (minimapTick > 0.12) {
      minimapTick = 0;
      hud.drawMinimap({
        player: playerPos(),
        playerYaw: driving.driving ? driving.car.rotation.y : player.yaw,
        target: missions.target,
        police: police.cruisers.map((c) => c.group.position),
        collectibles: collectibles.items.filter((i) => !i.taken).map((i) => i.group.position),
      });
    }
  } else if (game.state === 'menu') {
    // Slow cinematic orbit behind the start screen.
    const t = now * 0.05;
    camera.position.set(Math.sin(t) * 60, 26, Math.cos(t) * 60 - 10);
    camera.lookAt(0, 8, 0);
    traffic.update(dt, playerPos());
    peds.update(dt);
    if (input.wasPressed('Enter')) startGame(false);
  }

  // Rain always falls, centred on the camera.
  city.updateRain(dt, camera.position);
  if (input.wasPressed('KeyR') && game.state === 'over') {
    player.reset(0, -20);
    police.clear();
    game.state = 'playing';
    hud.hideScreens();
    input.lockPointer();
  }

  renderer.render(scene, camera);
  input.endFrame();
}
frame();

document.title = `${GAME_TITLE} — a neon-night open-world crime game`;
console.log(`[${GAME_TITLE}] boot ok, seed=${seed}, shot=${shotName || 'none'}`);
