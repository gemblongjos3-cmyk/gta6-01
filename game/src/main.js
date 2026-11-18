// Boot, the one loop, and the state machine (title -> playing -> paused / busted / wasted). Input
// is read every frame, the world advances in fixed 1/60 s steps, and the renderer paints the city
// in one pass. The camera is an object GSAP eases toward the player, so following a car has weight
// without a hand-written lerp; entering or leaving a car zooms with the same easing language.
//
// ?seed=N fixes the city, the traffic and the people. ?shot=cover|docks|delivery|start stages a
// scene, drives every animation to its end state and sets window.__shotReady for a screenshot.
import { CAMERA, CRIME, PLAYER, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { SHOT_TIME, stageShot } from './shots.js';

const gsap = window.gsap;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const traffic = createTraffic(world, random);
const pedestrians = createPedestrians(world, random);
const player = createPlayer(world);
const police = createPolice(world, random);
const combat = createCombat(world);
const missions = createMissions(world, random);
const audio = createAudio();
const renderer = createRenderer(canvas);
const hud = createHud(world);
const input = createInput(canvas);

const camera = { x: 0, y: 0, zoom: CAMERA.walkZoom, tilt: 0 };
const actors = [];
/** Mission and scene cars that are not traffic: they live here so nothing has to own them twice. */
const extraCars = [];
/** Every car in play right now: traffic, parked, police and mission. Rebuilt cheaply each frame. */
function allCars() {
  return traffic.cars.concat(traffic.parked, police.cars, extraCars).filter((car, at, list) => list.indexOf(car) === at);
}
const ctx = {
  world,
  traffic,
  pedestrians,
  player: player.state,
  police,
  combat,
  missions,
  actors,
  cars: extraCars,
  hud,
  camera,
  random,
  player: player.state,
  toast: (text, seconds) => hud.toast(text, seconds),
  onActorShot: (actor, angle) => {
    combat.shoot(actor.x, actor.y, angle, { hostile: true, damage: 8 });
    audio.gunshot();
    hud.jolt(3);
  },
};

/** Let GSAP own the camera's easing: quickTo is a tween per property, retargeted each frame. */
const cameraXTo = gsap.quickTo(camera, 'x', { duration: 0.34, ease: 'power2.out' });
const cameraYTo = gsap.quickTo(camera, 'y', { duration: 0.34, ease: 'power2.out' });

let screen = 'start';
/** The marker a staged screenshot draws in the world (null in normal play). */
let shotMarker = null;
let best = 0;
let time = 0;
let accumulator = 0;
let last = performance.now();
let radarClock = 0;
let saveClock = 0;
let started = false;

function announce(message) {
  statusLine.textContent = message;
}

// ---------- save and load ----------

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        money: player.state.money,
        completed: missions.completed,
        health: Math.round(player.state.health),
        x: Math.round(player.state.x),
        y: Math.round(player.state.y),
        at: Date.now(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

function resetSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be off; the save then simply never existed.
  }
}

// ---------- new game, continue, missions ----------

function newGame() {
  resetSave();
  player.state.money = 250;
  player.state.ammo = PLAYER.magazine;
  player.state.reserve = PLAYER.maxAmmo;
  player.spawnAt();
  missions.load({ completed: 0 });
  police.reset();
  combat.clear();
  actors.length = 0;
  beginMission(1);
}

function continueGame() {
  const save = readSave();
  if (!save) {
    newGame();
    return;
  }
  player.state.money = Number(save.money) || 0;
  missions.load({ completed: Number(save.completed) || 0 });
  police.reset();
  if (missions.finished) {
    player.spawnAt();
    hud.toast('The story is finished. The city is yours to roam.');
    return;
  }
  beginMission(missions.completed + 1);
}

/** Start mission number `at` (1-based) and show its intro as a centre banner. */
function beginMission(at) {
  const started2 = missions.startAt(at, ctx);
  ctx.cars = traffic.all();
  if (!started2) return;
  audio.missionJingle();
  hud.setMissionTag(`${started2.mission.title} · Mission ${missions.index + 1} of ${missions.script.length}`);
  hud.banner(started2.mission.title, started2.dialogue[0] ?? 'Mission start', '');
  hud.toast(started2.dialogue[1] ?? '', 7);
  announce(`Mission ${missions.index + 1}: ${started2.mission.title}.`);
}

function completeMission() {
  const reward = missions.script[missions.index - 1]?.reward ?? 0;
  player.addMoney(reward);
  audio.cash();
  audio.missionJingle();
  hud.banner('Mission Passed', `+$${reward}`, '');
  hud.toast(`$${reward} banked. ${missions.finished ? 'The city is yours.' : 'Luna will call again.'}`, 6);
  writeSave();
  announce(`Mission passed. $${reward} earned.`);
  if (!missions.finished) {
    const nextAt = missions.completed + 1;
    window.setTimeout(() => {
      if (screen === 'play') beginMission(nextAt);
    }, 3600);
  }
}

function failMission() {
  audio.missionFail();
  hud.toast('Mission failed. Restart it from the pause menu.', 5);
  hud.hideObjective();
}

// ---------- crime, combat and consequences ----------

function reportCrime(stars) {
  const result = police.commitCrime(stars);
  if (result) hud.setWanted(police.wanted);
}

function playerShoot() {
  const p = player.state;
  if (p.reloading > 0 || p.fireCooldown > 0) return;
  if (p.ammo <= 0) {
    if (p.reserve > 0) startReload();
    else hud.toast('Out of ammo. Shores Supply sells more.');
    return;
  }
  p.ammo -= 1;
  p.fireCooldown = PLAYER.fireDelay;
  const origin = p.car ? { x: p.car.x + Math.cos(p.car.angle) * 30, y: p.car.y + Math.sin(p.car.angle) * 30 } : { x: p.x, y: p.y };
  combat.shoot(origin.x, origin.y, p.aim, { damage: 34, spread: 0.045 });
  audio.gunshot();
  hud.shake(3, 0.1);
  reportCrime(CRIME.gunshot);
  pedestrians.panicNear(p.x, p.y, 380);
}

function startReload() {
  const p = player.state;
  if (p.reloading > 0 || p.reserve <= 0 || p.ammo >= PLAYER.magazine) return;
  p.reloading = PLAYER.reloadTime;
  hud.toast('Reloading…', 1.2);
}

function onBulletHitPlayer(damage) {
  const dead = player.hurt(damage);
  hud.jolt(5);
  audio.hit();
  if (dead) announce('Wasted.');
}

/** Player or car against a pedestrian: a bump at walking pace, a crime at speed. */
function checkPedestrianHits(moved) {
  const p = player.state;
  const vehicle = p.car;
  if (!vehicle) return;
  const speed = Math.abs(vehicle.speed);
  for (const person of pedestrians.people) {
    if (person.dead) continue;
    if (Math.hypot(person.x - vehicle.x, person.y - vehicle.y) > 26) continue;
    if (speed < 60) continue;
    pedestrians.fall(person);
    pedestrians.panicNear(person.x, person.y, 300);
    reportCrime(CRIME.hitPedestrian);
    hud.jolt(4);
    audio.hit();
    vehicle.speed *= 0.86;
    hud.toast('Hit and run. Somebody saw that.', 3);
    void moved;
  }
}

/** Car against car: both lose paint, both slow, and the player feels it. */
function checkCarHits() {
  const p = player.state;
  const mine = p.car;
  if (!mine) return;
  for (const car of allCars()) {
    if (car === mine) continue;
    const gap = Math.hypot(car.x - mine.x, car.y - mine.y);
    if (gap > 34) continue;
    const closing = Math.abs(mine.speed) + Math.abs(car.speed);
    if (closing < 90) continue;
    mine.health -= closing * 0.02;
    car.health -= closing * 0.03;
    mine.speed *= 0.55;
    car.speed *= 0.4;
    combat.spark((mine.x + car.x) / 2, (mine.y + car.y) / 2, mine.angle, '#ffcf8a');
    hud.shake(5, 0.18);
    if (car.kind === 'police') hud.toast('Ramming a cruiser only makes it worse.', 3);
  }
}

// ---------- actions ----------

function handleActions(actions) {
  for (const action of actions) {
    if (action === 'mute') {
      audio.unlock();
      const muted = audio.toggleMute();
      hud.toast(muted ? 'Sound off' : 'Sound on', 2);
      continue;
    }
    if (screen === 'start') {
      if (action === 'confirm') beginPlay(false);
      else if (action === 'continueSave' || action === 'reload') beginSaveContinue();
      else if (action === 'resetSave') {
        resetSave();
        hud.toast('Save cleared. A fresh evening.', 2.5);
        announce('Save cleared.');
      }
      continue;
    }
    if (screen === 'paused') {
      if (action === 'confirm' || action === 'pause') {
        screen = 'play';
        hud.hidePause();
        announce('Playing.');
      } else if (action === 'reload') {
        const at = Math.max(1, missions.index + 1);
        missions.load({ completed: at - 1 });
        screen = 'play';
        hud.hidePause();
        beginMission(at);
      } else if (action === 'resetSave') {
        resetSave();
        missions.load({ completed: 0 });
        police.reset();
        combat.clear();
        actors.length = 0;
        extraCars.length = 0;
        screen = 'play';
        hud.hidePause();
        newGame();
        hud.toast('Save reset. Back to the diner.', 3);
      }
      continue;
    }
    if (screen !== 'play') continue;
    if (action === 'pause') {
      screen = 'paused';
      hud.showPause();
      announce('Paused.');
    } else if (action === 'enter') {
      audio.unlock();
      toggleVehicle();
    } else if (action === 'reload') startReload();
    else if (action === 'fireKey') playerShoot();
  }
}

function beginSaveContinue() {
  if (readSave()) {
    hud.toast('Save loaded.', 3);
    beginPlay(true);
  } else {
    hud.toast('No save yet — starting fresh.', 3);
    beginPlay(false);
  }
}

function beginPlay(continuing) {
  audio.unlock();
  // The click that started the evening must not also pull the trigger.
  input.pointer.down = false;
  input.pointer.clicked = false;
  gsap.killTweensOf(canvas);
  gsap.set(canvas, { x: 0, y: 0, filter: 'none' });
  hud.hideStart(() => {
    screen = 'play';
    hud.enterPlay();
    announce('Playing.');
  });
  if (continuing) continueGame();
  else newGame();
  // Snap the camera to the player and let the first zoom ease in.
  const focus = player.state.car ?? player.state;
  camera.x = focus.x;
  camera.y = focus.y;
  camera.zoom = 0.86;
  gsap.to(camera, { zoom: player.state.car ? CAMERA.driveZoom : CAMERA.walkZoom, duration: 1.2, ease: 'power2.out' });
  time = 0;
  accumulator = 0;
}

function toggleVehicle() {
  const p = player.state;
  if (p.car) {
    const spot = player.exitCar();
    p.car = null;
    gsap.to(camera, { zoom: CAMERA.walkZoom, duration: 0.5, ease: 'power2.out' });
    if (spot) hud.toast('On foot.', 1.5);
    return;
  }
  const car = player.carInReach(allCars());
  if (!car) {
    hud.toast('No car close enough. Walk up to one.', 2);
    return;
  }
  const result = player.enterCar(car);
  if (result.ejectedDriver) {
    const person = pedestrians.spawnOne();
    person.x = result.ejectedDriver.x;
    person.y = result.ejectedDriver.y;
    person.state = 'flee';
    person.panic = 3;
  }
  gsap.to(camera, { zoom: CAMERA.driveZoom, duration: 0.55, ease: 'power2.out' });
  if (result.stolen) {
    hud.toast('Car stolen. The owner is shouting.', 3);
    reportCrime(result.crime || CRIME.stealCar);
    pedestrians.panicNear(car.x, car.y, 260);
  }
  announce('Driving.');
}

// ---------- the loop ----------

function updateHud() {
  const p = player.state;
  hud.setWanted(police.wanted);
  hud.setCash(p.money);
  hud.setHealth(p.health, PLAYER.health);
  hud.setAmmo(p.ammo, p.reserve, PLAYER.magazine);
  if (p.car) hud.setSpeed(Math.abs(p.car.speed) * 0.42, carName(p.car), true);
  else hud.setSpeed(0, '', false);

  if (missions.active) {
    const target = missions.target();
    const timer = missions.remainingTime();
    hud.setObjective(
      `${missions.active.title} · Mission ${missions.index + 1} of ${missions.script.length}`,
      missions.step()?.entry.label ?? '',
      timer === null ? '' : `0:${String(Math.ceil(timer)).padStart(2, '0')}`,
    );
    void target;
  }

  const near = player.carInReach(allCars());
  if (p.car) hud.hint('');
  else if (near) hud.hint('E · get in');
  else hud.hint('');
}

function carName(car) {
  if (car.kind === 'police') return 'Police Cruiser';
  if (car.model === 'sport') return 'Sprint Coupe';
  if (car.model === 'van') return 'Cargo Van';
  if (car.model === 'cruiser') return 'Cruiser';
  return 'Sedan';
}

function stepGame(dt) {
  time += dt;
  const p = player.state;
  input.pointer.worldX = renderer.screenToWorld(input.pointer.x, input.pointer.y, camera).x;
  input.pointer.worldY = renderer.screenToWorld(input.pointer.x, input.pointer.y, camera).y;

  player.update(dt, input, { x: input.pointer.worldX, y: input.pointer.worldY });

  // The player's round leaves the barrel while the mouse is held, at the pistol's own rate.
  if (input.pointer.down) playerShoot();

  traffic.update(dt, [p]);
  pedestrians.update(dt);
  checkPedestrianHits(0);

  const crimeThisStep = missions.active ? 0 : 0;
  void crimeThisStep;

  missions.update(dt, {
    ...ctx,
    player: p,
    police,
    actors,
    cars: ctx.cars,
    allCars,
    toast: (text, seconds) => hud.toast(text, seconds),
    onActorShot: ctx.onActorShot,
  });
  if (missions.takeCompleted()) completeMission();
  if (missions.takeFailed()) failMission();

  police.update(dt, {
    player: p,
    onPoliceShot: (car, angle) => {
      combat.shoot(car.x + Math.cos(angle) * 26, car.y + Math.sin(angle) * 26, angle, { hostile: true, damage: 7, spread: 0.12 });
      audio.gunshot();
    },
    onRam: () => {
      if (p.car) {
        p.car.health -= 6;
        hud.shake(5, 0.2);
      }
    },
  });
  if (police.takeBusted()) triggerBusted();
  if (police.takeWasted()) triggerWasted();

  combat.update(dt, {
    player: p,
    pedestrians: pedestrians.people,
    actors,
    cars: allCars(),
    onPlayerHit: onBulletHitPlayer,
    onHit: (kind, entity) => {
      if (kind === 'person') {
        pedestrians.fall(entity);
        reportCrime(CRIME.hitPedestrian);
        audio.hit();
      } else if (kind === 'actor') {
        entity.hp -= 34;
        entity.hurt = 0.25;
        if (entity.hp <= 0) entity.dead = true;
        audio.hit();
      } else if (kind === 'car') {
        entity.health -= 8;
        entity.hitFlash = 0.2;
        if (entity.kind === 'police') hud.toast('Shooting at the police costs you nothing but trouble.', 3);
      }
    },
    onWallHit: () => {
      /* the spark already shows it */
    },
  });

  checkCarHits();

  // The camera: lead the car a little the way it is going, then ease to it with GSAP.
  const focus = p.car ?? p;
  const lead = p.car ? Math.cos(p.car.angle) * p.car.speed * CAMERA.lead : 0;
  const leadY = p.car ? Math.sin(p.car.angle) * p.car.speed * CAMERA.lead : 0;
  cameraXTo(focus.x + lead);
  cameraYTo(focus.y + leadY);

  // The car engine and siren follow what is happening; the pad runs under both.
  let nearestCop = Infinity;
  for (const car of police.cars) nearestCop = Math.min(nearestCop, Math.hypot(car.x - focus.x, car.y - focus.y));
  audio.update(dt, {
    speed: p.car ? p.car.speed : 0,
    wanted: police.wanted,
    policeNear: nearestCop < 900,
    driving: Boolean(p.car),
  });

  saveClock += dt;
  if (saveClock > 20) {
    saveClock = 0;
    writeSave();
  }
}

function triggerBusted() {
  if (screen !== 'play') return;
  screen = 'busted';
  audio.busted();
  hud.banner('Busted', 'The Shores PD found you', 'busted');
  hud.flash('blue', 1);
  hud.shake(9, 0.3);
  const fine = Math.min(player.state.money, 150);
  player.addMoney(-fine);
  player.hurt(20);
  announce('Busted.');
  window.setTimeout(() => {
    if (screen !== 'busted') return;
    const spot = player.respawnPoint(world);
    player.spawnAt(spot.x, spot.y);
    player.state.health = Math.max(40, player.state.health);
    police.reset();
    hud.setWanted(0);
    camera.x = player.state.x;
    camera.y = player.state.y;
    gsap.to(camera, { zoom: CAMERA.walkZoom, duration: 0.6, ease: 'power2.out' });
    screen = 'play';
    hud.toast(`Busted. $${fine} in "fees".`, 4);
  }, 3200);
}

function triggerWasted() {
  if (screen !== 'play') return;
  screen = 'wasted';
  audio.wasted();
  hud.banner('Wasted', 'The evening got the better of you', 'wasted');
  hud.flash('red', 1);
  gsap.fromTo(canvas, { scale: 1 }, { scale: 1.06, duration: 0.8, ease: 'power2.out', yoyo: true, repeat: 1 });
  announce('Wasted.');
  window.setTimeout(() => {
    if (screen !== 'wasted') return;
    const spot = player.respawnPoint(world);
    player.spawnAt(spot.x, spot.y);
    player.state.health = PLAYER.respawnHealth;
    player.state.money = Math.round(player.state.money * 0.9);
    police.reset();
    hud.setWanted(0);
    camera.x = player.state.x;
    camera.y = player.state.y;
    screen = 'play';
    hud.toast('Patched up at Mercy Shores. $' + Math.round(player.state.money * 0.1) + ' lighter.', 4);
  }, 3200);
}

/** One painted frame: the city, its people, the effects, the HUD and the radar. */
function render() {
  const p = player.state;
  renderer.beginFrame(camera);
  renderer.drawCity(world, world.props, time);

  const marker = shotMarker ?? (missions.active ? missions.target() : null);
  if (marker) renderer.drawMarker(marker, time, '#ffc94d', '!');
  if (marker && screen !== 'start' && screen !== 'paused') renderer.drawObjectiveArrow(camera, marker, p);

  // Everything that stands on the ground is sorted by its feet, so cars pass in front of people
  // they are nearer than, never through them.
  const drawables = [];
  for (const car of allCars()) {
    if (car.x < renderer.visible.left || car.x > renderer.visible.right) continue;
    if (car.y < renderer.visible.top || car.y > renderer.visible.bottom) continue;
    drawables.push({ y: car.y, draw: () => renderer.drawCar(car, time) });
  }
  for (const person of pedestrians.people) drawables.push({ y: person.y, draw: () => renderer.drawPerson(person, time) });
  for (const actor of actors) drawables.push({ y: actor.y, draw: () => renderer.drawActor(actor) });
  if (!p.car) drawables.push({ y: p.y + 1, draw: () => renderer.drawPlayer(p, time) });
  drawables.sort((a, b) => a.y - b.y);
  for (const item of drawables) item.draw();

  renderer.drawEffects(combat, traffic.skids, time);
  renderer.endFrame(camera);

  radarClock += 1;
  if (radarClock % 2 === 0) {
    hud.drawRadar({
      x: p.car ? p.car.x : p.x,
      y: p.car ? p.car.y : p.y,
      aim: p.aim,
      rotate: 0,
      marker,
      traffic: allCars(),
      police: police.cars,
      blink: Math.floor(time * 4) % 2 === 0,
    });
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;

  if (screen === 'start' || screen === 'play' || screen === 'paused') {
    handleActions(input.take());
  }

  if (screen === 'play') {
    accumulator += delta;
    let steps = 0;
    while (accumulator >= STEP && steps < 8) {
      stepGame(STEP);
      accumulator -= STEP;
      steps += 1;
      if (screen !== 'play') break;
    }
    updateHud();
  } else if (screen === 'start' || screen === 'paused' || screen === 'busted' || screen === 'wasted') {
    accumulator = 0;
    // The title and the pause screen still let the city breathe behind them.
    if (screen === 'start' || screen === 'paused') {
      time += delta;
      traffic.update(delta, []);
      pedestrians.update(delta);
    }
  }

  render();
}

// ---------- screenshot mode ----------

function runShot(name) {
  screen = 'shot';
  hud.setStatic(true);
  const result = stageShot(name, ctx);
  shotMarker = result.marker ?? null;
  ctx.cars = allCars();
  hud.setWanted(result.wanted ?? 0);
  if (result.radar) {
    hud.drawRadar({ ...result.radar, marker: result.marker, traffic: ctx.cars, police: police.cars, blink: true });
  }
  hud.freeze();
  // No timeline may still be running when the shutter opens: kill what the panels started, then
  // write every HUD value at its end state so a screenshot never catches a half-played tween.
  gsap.killTweensOf(['#start', '#startPanel', '#title', '#startMenu .item', '.controls span', '#banner', '#toast', '#objective', '#speedo', '#missionTag']);
  gsap.set('#startPanel', { autoAlpha: 1, y: 0, scale: 1 });
  gsap.set('#title', { autoAlpha: 1, y: 0, letterSpacing: '-1px' });
  gsap.set('#startMenu .item', { autoAlpha: 1, y: 0 });
  gsap.set('.controls span', { autoAlpha: 1 });
  gsap.set('#banner', { autoAlpha: 0 });
  gsap.set('#toast', { autoAlpha: 1, y: 0, scale: 1 });
  // Paint a handful of frames at one frozen time so nothing mid-tween is captured.
  let painted = 0;
  function paint() {
    time = SHOT_TIME;
    camera.x = result.radar?.x ?? camera.x;
    camera.y = result.radar?.y ?? camera.y;
    render();
    painted += 1;
    if (painted < 5) requestAnimationFrame(paint);
    else {
      document.documentElement.dataset.shotReady = '1';
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

// ---------- entry ----------

function boot() {
  const diner = world.place('diner');
  camera.x = diner.door.x;
  camera.y = diner.door.y;
  player.spawnAt();

  // The first click or key builds the audio graph.
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('pointerdown', unlock, { once: true });

  // A click anywhere on the canvas starts the game from the title.
  canvas.addEventListener('pointerdown', () => {
    if (screen === 'start' && !shotName) beginPlay(false);
  });

  if (shotName) {
    runShot(shotName);
    return;
  }

  gsap.set('#start', { autoAlpha: 1, visibility: 'visible' });
  hud.enterStart();
  announce('Palm Shores. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

boot();
