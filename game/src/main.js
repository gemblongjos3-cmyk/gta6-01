// Palm Shores — the boot, the one loop, and the state machine.
//
// This module wires every system together and owns the evening's rhythm:
//   start → playing ⇄ paused, with busted / wasted as short detours,
//   and a deterministic shot mode (?shot=…) that stages one frame to be
//   photographed instead of played.
//
// Time moves in fixed steps (STEP from config) fed by an accumulator, so
// the simulation is the same on a 60 Hz laptop and a 144 Hz monitor. The
// camera is the one thing that does not step: GSAP quickTo eases it after
// the player every frame, which is what makes the chase feel smooth.
import { CAMERA, CRIME, PLAYER, SAVE_KEY, STARS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createCollectibles } from './collectibles.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { SHOT_TIME, stageShot } from './shots.js';

// ------------------------------------------------------------------- setup
const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;
const shotName = params.get('shot');

const random = createRandom(seed);
const world = createWorld(random);
const traffic = createTraffic(world, random);
const pedestrians = createPedestrians(world, random);
const player = createPlayer(world);
const police = createPolice(world, random);
const combat = createCombat(world);
const missions = createMissions(world, random);
const collectibles = createCollectibles(world, random);
const audio = createAudio();

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const hud = createHud(world);
const input = createInput(canvas);

const actors = []; // mission people, shared with missions and combat
const missionCars = []; // cars a mission spawned, apart from traffic
const camera = { x: 0, y: 0, zoom: CAMERA.walkZoom, tilt: 0 };

const gsap = window.gsap ?? null;
const cameraXTo = gsap ? gsap.quickTo(camera, 'x', { duration: 0.34, ease: 'power2.out' }) : null;
const cameraYTo = gsap ? gsap.quickTo(camera, 'y', { duration: 0.34, ease: 'power2.out' }) : null;

let screen = 'start'; // start | playing | paused | busted | wasted | shot
let time = 0;
let shotMarker = null;
let endTimer = 0; // counts down a busted/wasted banner before the respawn
let nextMissionTimer = -1; // >0 while the next mission waits to open
let hiddenTime = 0; // seconds spent out of police sight, for heat decay
let toastQueue = []; // mission intro lines waiting their turn
let dialogueTimer = 0; // seconds until the next queued line may show

/** Every car standing in the world, whatever system spawned it. */
function allCars() {
  return traffic.all().concat(missionCars, police.cars);
}

/** The bag missions.update reads and writes; one object all evening. */
const missionCtx = {
  player: player.state,
  police,
  cars: missionCars,
  allCars,
  actors,
  toast: (message) => hud.toast(message, 3.2),
  onActorShot: (actor, angle) => {
    combat.shoot(actor.x, actor.y, angle, { hostile: true, damage: 16 });
    audio.gunshot();
  },
  missionCar: null,
  boss: null,
};

// -------------------------------------------------------------------- save
/** The save on disk: missions banked and the cash the player kept. */
function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      completed: missions.completed,
      money: player.state.money,
      stars: collectibles.takenIds(),
    }));
  } catch {
    // A browser that refuses storage still gets a game; it just forgets.
  }
}

function resetSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to forget.
  }
  missions.load({ completed: 0 });
  collectibles.load([]);
  player.state.money = 250;
}

// ------------------------------------------------------------- mission flow
/** Queue a line of dialogue; the frame loop shows them one at a time. */
function announce(lines) {
  for (const line of lines) toastQueue.push(line);
}

/** Open the mission the chain points at, with its banner and intro lines. */
function beginMission(at = null) {
  const started = at === null ? missions.startNext(missionCtx) : missions.startAt(at, missionCtx);
  if (!started) return false;
  const current = missions.active;
  hud.banner(current.title, `Mission ${missions.index + 1} of ${missions.script.length}`, '');
  hud.setMissionTag(current.title);
  announce(current.intro);
  audio.missionJingle();
  return true;
}

/** The chain latched a completion: pay the reward, save, queue the next. */
function completeMission(finished) {
  if (finished) {
    player.addMoney(finished.reward);
    audio.cash();
    audio.missionJingle();
    hud.banner('Mission Passed', `${finished.title} · +$${finished.reward}`, '');
  }
  writeSave();
  if (missions.finished) {
    hud.banner('Palm Shores', 'Every debt is settled. The city is yours again.', '');
    hud.toast('Story complete — the city stays open. Drive anywhere.', 5);
  } else {
    nextMissionTimer = 3.2;
  }
}

/** The chain latched a failure: say so, then offer the same mission again. */
function failMission() {
  audio.missionFail();
  hud.banner('Mission Failed', 'Luna is patient. Once.', '');
  missions.load({ completed: missions.completed });
  nextMissionTimer = 3.2;
}

/** Heat, applied once per crime, with the stars to match. */
function reportCrime(stars) {
  if (stars <= 0 || screen !== 'playing') return;
  police.commitCrime(stars);
  hud.setWanted(police.wanted);
}

// ---------------------------------------------------------------- shooting
/** Fire the pistol if the trigger, the magazine and the clock all agree. */
function playerShoot() {
  const p = player.state;
  if (p.car || p.reloading > 0 || p.fireCooldown > 0) return;
  if (p.ammo <= 0) {
    startReload();
    return;
  }
  p.ammo -= 1;
  p.fireCooldown = PLAYER.fireDelay;
  combat.shoot(p.x, p.y, p.aim, { hostile: false, damage: 34 });
  audio.gunshot();
  pedestrians.panicNear(p.x, p.y, 300);
  reportCrime(CRIME.gunshot);
  hud.shake(3);
}

/** R: swap the magazine; empty reserves just click. */
function startReload() {
  const p = player.state;
  if (p.reloading > 0 || p.ammo >= PLAYER.magazine || p.reserve <= 0) return;
  p.reloading = PLAYER.reloadTime;
  hud.toast('Reloading…', 1.1);
}

/** A hostile round landed on the player. */
function onBulletHitPlayer(damage) {
  const dead = player.hurt(damage);
  audio.hit();
  hud.jolt();
  if (dead) triggerWasted();
}

/** A player round landed on something: sort out what, and what it costs. */
function onBulletHit(kind, entity) {
  audio.hit();
  if (kind === 'person') {
    if (pedestrians.fall(entity)) {
      player.state.kills += 1;
      reportCrime(CRIME.hitPedestrian);
    }
    return;
  }
  if (kind === 'actor') {
    entity.health -= 34;
    entity.hurt = 0.4;
    if (entity.health <= 0 && !entity.dead) {
      entity.dead = true;
      entity.down = 0;
      pedestrians.panicNear(entity.x, entity.y, 280);
      reportCrime(CRIME.hitPedestrian);
    }
    return;
  }
  if (kind === 'car') {
    entity.health -= 20;
    entity.hitFlash = 0.35;
    combat.spark(entity.x, entity.y, entity.angle, '#ffb46a');
  }
}

// --------------------------------------------------------------- collisions
/** Running someone over is slow, loud and very illegal. */
function checkPedestrianHits() {
  const car = player.state.car;
  if (!car || Math.abs(car.speed) < 60) return;
  for (const person of pedestrians.people) {
    if (person.dead) continue;
    if (Math.hypot(person.x - car.x, person.y - car.y) < 30) {
      pedestrians.fall(person);
      car.speed *= 0.55;
      reportCrime(CRIME.hitPedestrian);
      hud.shake(7);
      audio.hit();
    }
  }
}

/** Scraping other cars: paint is shared, damage is mutual, police notice. */
function checkCarHits() {
  const mine = player.state.car;
  if (!mine) return;
  for (const other of allCars()) {
    if (other === mine) continue;
    const distance = Math.hypot(other.x - mine.x, other.y - mine.y);
    if (distance > 44 || distance === 0) continue;
    const closing = Math.abs(mine.speed) + Math.abs(other.speed ?? 0);
    if (closing < 40) continue;
    other.health -= Math.min(18, closing * 0.03);
    other.hitFlash = 0.3;
    mine.health -= Math.min(10, closing * 0.015);
    mine.speed *= 0.72;
    combat.spark((mine.x + other.x) / 2, (mine.y + other.y) / 2, mine.angle, '#ffc46a');
    hud.shake(6);
    audio.hit();
    if (other.kind === 'mission') other.hitFlash = 0.5;
  }
}

// ------------------------------------------------------------------ actions
/** One-shot presses, routed by the screen they land on. */
function handleActions(actions) {
  for (const action of actions) {
    if (action === 'mute') {
      const muted = audio.toggleMute();
      hud.toast(muted ? 'Sound off' : 'Sound on', 1.2);
      continue;
    }
    if (screen === 'start') {
      if (action === 'confirm') beginPlay(false);
      else if (action === 'continueSave') beginPlay(true);
      else if (action === 'resetSave') {
        resetSave();
        hud.toast('Save wiped. A fresh evening awaits.', 2.4);
      }
      continue;
    }
    if (screen === 'paused') {
      if (action === 'pause' || action === 'confirm') resumeGame();
      else if (action === 'reload') restartMission();
      else if (action === 'resetSave') {
        resetSave();
        resumeGame();
        hud.toast('Save wiped.', 2);
      }
      continue;
    }
    if (screen !== 'playing') continue;
    if (action === 'pause') pauseGame();
    else if (action === 'enter') toggleVehicle();
    else if (action === 'reload') startReload();
  }
  // Number keys hop straight to a mission (the map markers 1–6).
  if (screen === 'playing') {
    for (let n = 1; n <= 6; n += 1) {
      if (input.isDown(`Digit${n}`) && !missions.active) {
        missions.load({ completed: n - 1 });
        beginMission(n);
        break;
      }
    }
  }
}

/** Enter starts a fresh evening; C resumes the save beside it. */
function beginPlay(fromSave) {
  const save = fromSave ? readSave() : null;
  if (save) {
    missions.load({ completed: Number(save.completed) || 0 });
    player.state.money = Number(save.money) || 250;
    collectibles.load(save.stars);
  } else {
    missions.load({ completed: 0 });
    player.state.money = 250;
    collectibles.load([]);
  }
  player.spawnAt();
  police.reset();
  combat.clear();
  actors.length = 0;
  screen = 'playing';
  hud.enterPlay();
  hud.setWanted(0);
  snapCamera();
  beginMission();
}

/** Pause: freeze the step loop, keep the picture, show the panel. */
function pauseGame() {
  screen = 'paused';
  hud.showPause();
}

function resumeGame() {
  screen = 'playing';
  hud.hidePause();
}

/** Restart the mission being played, from the pause menu's R. */
function restartMission() {
  const at = missions.index + 1;
  missions.abandon(missionCtx);
  missions.load({ completed: at - 1 });
  hud.hidePause();
  screen = 'playing';
  beginMission(at);
}

/** E at a car door: climb in (and answer for it) or step out. */
function toggleVehicle() {
  const p = player.state;
  if (p.car) {
    player.exitCar();
    hud.toast('On foot', 1);
    return;
  }
  const car = player.carInReach(allCars());
  if (!car) {
    hud.hint('No car in reach — stand by a door and press E');
    return;
  }
  const result = player.enterCar(car);
  if (result.ejectedDriver) {
    pedestrians.spawnOne();
    const driver = pedestrians.people[pedestrians.people.length - 1];
    driver.x = result.ejectedDriver.x;
    driver.y = result.ejectedDriver.y;
    driver.state = 'flee';
    driver.panic = 4;
    driver.fleeX = Math.cos(car.angle);
    driver.fleeY = Math.sin(car.angle);
  }
  if (result.stolen) {
    reportCrime(result.crime);
    hud.toast('Borrowed. Try not to scratch it.', 2.2);
  }
}

// --------------------------------------------------------------------- HUD
const CAR_NAMES = { sedan: 'Harbour Sedan', sport: 'Sprint Coupe', van: 'Cargo Van', cruiser: 'PD Cruiser' };

function carName(car) {
  if (!car) return '';
  if (car.kind === 'police') return 'PD Cruiser';
  return CAR_NAMES[car.model] ?? 'Sedan';
}

function formatClock(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Push every live value into the HUD once per frame. */
function updateHud() {
  const p = player.state;
  hud.setWanted(police.wanted);
  hud.setCash(p.money);
  hud.setHealth(p.health, PLAYER.health);
  hud.setAmmo(p.ammo, p.reserve, PLAYER.magazine);
  hud.setSpeed(p.car ? Math.abs(p.car.speed) * 0.62 : 0, carName(p.car), Boolean(p.car));
  if (missions.active) {
    const current = missions.active;
    const stepInfo = missions.step();
    const label = stepInfo ? stepInfo.entry.label : current.title;
    const extra = missions.status();
    hud.setObjective(
      `${current.title} · Mission ${missions.index + 1} of ${missions.script.length}`,
      extra ? `${label} — ${extra}` : label,
      formatClock(missions.remainingTime()),
    );
  } else if (!missions.finished) {
    hud.hideObjective();
  }
  // The context hint: what E would do right now.
  if (screen === 'playing') {
    if (p.car) hud.hint('E — step out · Shift — handbrake drift');
    else if (player.carInReach(allCars())) hud.hint('E — get in');
    else hud.hint('');
  }
}

// ---------------------------------------------------------------- the camera
/** Put the camera on the player instantly (teleports, respawns, boot). */
function snapCamera() {
  const p = player.state;
  camera.x = p.x;
  camera.y = p.y;
  camera.zoom = p.car ? CAMERA.driveZoom : CAMERA.walkZoom;
}

/** Ease the camera after the player with a look-ahead while driving. */
function followCamera(dt) {
  const p = player.state;
  const lead = p.car ? CAMERA.lead : 0.06;
  const targetX = p.x + (p.car ? Math.cos(p.car.angle) * Math.abs(p.car.speed) * lead : Math.cos(p.aim) * 26);
  const targetY = p.y + (p.car ? Math.sin(p.car.angle) * Math.abs(p.car.speed) * lead : Math.sin(p.aim) * 26);
  if (cameraXTo && cameraYTo) {
    cameraXTo(targetX);
    cameraYTo(targetY);
  } else {
    camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
    camera.y += (targetY - camera.y) * Math.min(1, dt * 6);
  }
  const targetZoom = p.car ? CAMERA.driveZoom : CAMERA.walkZoom;
  camera.zoom += (targetZoom - camera.zoom) * Math.min(1, dt * 3.2);
  camera.x = Math.max(0, Math.min(world.width, camera.x));
  camera.y = Math.max(0, Math.min(world.height, camera.y));
}

// ------------------------------------------------------------ busted/wasted
/** The arrest: blue flash, a fine, and a walk out of the hospital doors. */
function triggerBusted() {
  if (screen !== 'playing') return;
  screen = 'busted';
  endTimer = 2.6;
  audio.busted();
  hud.flash('blue');
  hud.shake(8);
  hud.banner('Busted', 'The Shores PD found you', 'busted');
  player.addMoney(-CRIME.fine);
}

/** The wipeout: red fade, the same hospital, a worse headache. */
function triggerWasted() {
  if (screen !== 'playing') return;
  screen = 'wasted';
  endTimer = 2.8;
  audio.wasted();
  hud.flash('red');
  hud.banner('Wasted', 'Mercy Shores patches you up', 'wasted');
  player.addMoney(-CRIME.fine);
}

/** Back on the street after either ending: health restored, heat gone. */
function respawn() {
  const spot = player.respawnPoint(world);
  missions.abandon(missionCtx);
  police.reset();
  combat.clear();
  player.spawnAt(spot.x, spot.y);
  player.state.health = PLAYER.respawnHealth;
  hud.setWanted(0);
  hud.endBanner();
  screen = 'playing';
  snapCamera();
  writeSave();
  if (!missions.finished) beginMission(missions.index + 1);
}

// -------------------------------------------------------------------- steps
/** Lay low and the stars cool: no cruiser in sight, no crime in memory. */
function updateHeatDecay(dt) {
  if (police.wanted <= 0) {
    hiddenTime = 0;
    return;
  }
  const p = player.state;
  const seen = police.cars.some((car) => Math.hypot(car.x - p.x, car.y - p.y) < 680);
  if (seen) {
    hiddenTime = 0;
    return;
  }
  hiddenTime += dt;
  if (hiddenTime > 5) {
    hiddenTime = 0;
    police.setWanted(police.wanted - 1);
    hud.setWanted(police.wanted);
    if (police.wanted === 0) hud.toast('Heat lost. The city forgets, for now.', 2.6);
  }
}

/** One fixed simulation step of the playing game. */
function stepGame(dt) {
  time += dt;
  const p = player.state;

  // Where is the mouse, in the world? Player aim and car aim both read it.
  const aimPoint = renderer.screenToWorld(input.pointer.x, input.pointer.y, camera);
  input.pointer.worldX = aimPoint.x;
  input.pointer.worldY = aimPoint.y;

  const before = missions.active;
  player.update(dt, input, aimPoint);
  if (input.pointer.down) playerShoot();
  if (input.takeClick()) playerShoot();

  traffic.update(dt, [p]);
  pedestrians.update(dt);
  checkPedestrianHits();
  checkCarHits();

  police.update(dt, {
    player: p,
    onPoliceShot: (car, angle) => {
      combat.shoot(car.x, car.y, angle, { hostile: true, damage: 11 });
      audio.gunshot();
    },
    onRam: () => {
      hud.shake(5);
      audio.hit();
    },
  });

  combat.update(dt, {
    player: p,
    pedestrians: pedestrians.people,
    actors,
    cars: allCars(),
    onHit: onBulletHit,
    onPlayerHit: onBulletHitPlayer,
    onWallHit: () => audio.hit(),
  });

  missions.update(dt, missionCtx);
  if (missions.takeCompleted()) completeMission(before);
  if (missions.takeFailed()) failMission();

  // The star hunt ticks beside the story: roll over a Sunset Star, bank its cash.
  collectibles.update(p, (star, banked) => {
    player.addMoney(STARS.reward);
    audio.cash();
    hud.toast(
      banked >= STARS.count
        ? `Sunset Star ${banked} of ${STARS.count} — the whole set. +$${STARS.reward}`
        : `Sunset Star ${banked} of ${STARS.count} — +$${STARS.reward}`,
      2.6,
    );
    writeSave();
  });

  if (nextMissionTimer > 0) {
    nextMissionTimer -= dt;
    if (nextMissionTimer <= 0 && !missions.active && screen === 'playing') beginMission();
  }

  updateHeatDecay(dt);
  if (police.takeBusted()) triggerBusted();
  if (police.takeWasted() || p.health <= 0) triggerWasted();

  // Dialogue lines, one toast at a time, paced so a two-line intro takes
  // a few seconds to read instead of flashing past inside a single step.
  dialogueTimer -= dt;
  if (toastQueue.length > 0 && dialogueTimer <= 0) {
    hud.toast(toastQueue.shift(), 3.4);
    dialogueTimer = 3.6;
  }

  audio.update(dt, {
    speed: p.car ? p.car.speed : 0,
    wanted: police.wanted,
    policeNear: police.cars.length > 0,
    driving: Boolean(p.car),
  });
}

// -------------------------------------------------------------------- paint
/** Draw the world and everything in it, back to front. */
function render() {
  const p = player.state;
  renderer.beginFrame(camera);
  renderer.drawCity(world, world.props, time);
  const marker = shotMarker ?? (missions.active ? missions.target() : null);
  if (marker && screen !== 'start') {
    renderer.drawMarker(marker, time, '#ffc94d', '!');
    renderer.drawObjectiveArrow(camera, marker, p);
  }
  const cars = allCars().slice().sort((a, b) => a.y - b.y);
  for (const car of cars) renderer.drawCar(car, time);
  for (const person of pedestrians.people) {
    if (renderer.visible(person.x, person.y)) renderer.drawPerson(person, time);
  }
  for (const actor of actors) renderer.drawActor(actor);
  renderer.drawPlayer(p, time);
  renderer.drawEffects(combat, traffic.skids, time);
  renderer.drawStars(collectibles.stars, time);
  renderer.endFrame(camera);
  if (screen !== 'start') {
    hud.drawRadar({
      x: p.x,
      y: p.y,
      aim: p.car ? p.car.angle : p.aim,
      rotate: 0,
      marker,
      traffic: traffic.all(),
      police: police.cars,
    });
  }
}

// --------------------------------------------------------------------- loop
let lastStamp = 0;
let accumulator = 0;

function frame(stamp) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (stamp - lastStamp) / 1000 || 0);
  lastStamp = stamp;
  renderer.resize();

  const actions = input.take();
  if (actions.length > 0) {
    audio.unlock();
    handleActions(actions);
  }

  if (screen === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 5) {
      stepGame(STEP);
      accumulator -= STEP;
      guard += 1;
      if (screen !== 'playing') {
        accumulator = 0;
        break;
      }
    }
    followCamera(dt);
  } else if (screen === 'busted' || screen === 'wasted') {
    time += dt;
    endTimer -= dt;
    if (endTimer <= 0) respawn();
  } else if (screen === 'start') {
    time += dt * 0.4;
    camera.x = world.place('diner').door.x + Math.sin(time * 0.11) * 120;
    camera.y = world.place('diner').door.y + 60;
    camera.zoom = 0.94;
  }

  render();
  if (screen === 'playing' || screen === 'paused') updateHud();
}

// --------------------------------------------------------------- shot mode
/**
 * Stage one deterministic scene, drive every tween to its end state, draw
 * it, and raise window.__shotReady for the camera outside. The scene runs
 * the real systems for a few fixed steps first, so traffic and people sit
 * where the simulation would have put them.
 */
function runShot(name) {
  screen = 'shot';
  hud.setStatic(true);
  player.spawnAt();
  const ctx = {
    world,
    random,
    traffic,
    pedestrians,
    player: player.state,
    police,
    combat,
    missions,
    collectibles,
    hud,
    camera,
    actors,
    cars: traffic.cars,
    time: SHOT_TIME,
  };
  const result = stageShot(name, ctx);
  shotMarker = result.marker ?? null;
  hud.setWanted(result.wanted ?? 0);
  time = SHOT_TIME;
  render();
  if (result.radar) {
    hud.drawRadar({ ...result.radar, marker: result.marker, traffic: traffic.all(), police: police.cars, blink: true });
  }
  hud.freeze();
  render();
  document.documentElement.dataset.shotReady = '1';
  window.__shotReady = true;
}

// --------------------------------------------------------------------- boot
player.spawnAt();
snapCamera();
if (shotName) {
  runShot(shotName);
} else {
  hud.hideHud();
  hud.enterStart();
  hud.setWanted(0);
  hud.setCash(player.state.money);
  hud.setHealth(player.state.health, PLAYER.health);
  hud.setAmmo(player.state.ammo, player.state.reserve, PLAYER.magazine);
}
requestAnimationFrame(frame);
