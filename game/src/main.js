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
import { CAMERA, CAR, CRIME, PLAYER, SAVE_KEY, STARS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createAirUnit } from './airunit.js';
import { createMissions } from './missions.js';
import { createCollectibles } from './collectibles.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { computePdResponse, computeRoute, createHud } from './hud.js';
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
const airUnit = createAirUnit();
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

// The radio lives on one station all evening, WAVE 88.1: only the songs
// change, one track every ~8 s of play.
const RADIO_STATION = 'WAVE 88.1 · NEON DRIVE';
const RADIO_TRACKS = [
  ['Pink Horizon', 'Lumen Kids'],
  ['Neon Drive', 'Saltline Hearts'],
  ['Ultraviolet Hour', 'Marina Lights'],
];
let radioIndex = 0;
let radioTimer = 0;

// Luna's voice on the dispatch strip: short, calm, dry. Mission intros go
// through her too (announce below); these lines cover the live events —
// heat rising, the target coming close, a job closing out.
const LUNA_HEAT = [
  'Another star. Dispatch is reading your description out loud — keep moving.',
  'Heat just went up. Every unit in the district has your plate now.',
  'They are calling in more cars. Break their line of sight, then breathe.',
];
const LUNA_NEAR = [
  'You are close — a hundred and fifty metres, give or take. Eyes up.',
  'Nearly there. Do not get creative this close to the drop.',
];
const LUNA_DONE = [
  'Received and logged. Payment is moving. Nice driving.',
  'That is a wrap. Luna out — until the next one.',
];
let lunaHeatIndex = 0;
let lunaNearIndex = 0;
let lunaDoneIndex = 0;
let pdTimer = 0; // the PD panel recomputes at ~5 Hz, not every frame
let lastHudWanted = 0;
let nearStepKey = '';
let nearSaid = false;
let wheelShown = false; // the weapon wheel is up (Q held)
let wheelSelected = 0; // the segment the pointer is resting on
let lastWeaponName = '';

// Respect and XP: the city's standing, earned by work — a mission pays
// 150, a Sunset Star 25 — and levelled on a short ladder. Level 4 at 800
// is where the avenue starts using your name.
const XP_LEVELS = [0, 150, 400, 800, 1300, 1900, 2600, 3400, 4400];
let xp = 0;

/** The HUD's progress reading: the respect level and the fill toward the next. */
function xpProgress() {
  let level = 0;
  while (level < XP_LEVELS.length - 1 && xp >= XP_LEVELS[level + 1]) level += 1;
  const floor = XP_LEVELS[level];
  const next = XP_LEVELS[Math.min(level + 1, XP_LEVELS.length - 1)];
  return { respect: level + 1, xp: xp - floor, xpNext: Math.max(1, next - floor) };
}

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
      xp,
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
  xp = 0;
}

// ------------------------------------------------------------- mission flow
/**
 * Queue a line of dialogue. Story lines are Luna's, so they go to her
 * dispatch strip (hud.say queues them) instead of the system toast.
 */
function announce(lines) {
  for (const line of lines) hud.say(line.replace(/^Luna:\s*/, ''));
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
    xp += 150;
    audio.cash();
    audio.missionJingle();
    hud.banner('Mission Passed', `${finished.title} · +$${finished.reward}`, '');
    hud.say(LUNA_DONE[lunaDoneIndex % LUNA_DONE.length]);
    lunaDoneIndex += 1;
    // Story payouts on the weapon shelf: the third job earns the SMG,
    // the fifth the scattergun. Luna announces both like deliveries.
    if (missions.completed >= 3 && !combat.weaponStates()[1].unlocked) {
      combat.unlockWeapon(1);
      hud.say('A package for you at the garage: one WASP 6149. Hold Q and pick it up.');
      hud.toast('New weapon — WASP 6149 SMG (hold Q)', 3.6);
    }
    if (missions.completed >= 5 && !combat.weaponStates()[2].unlocked) {
      combat.unlockWeapon(2);
      hud.say('And the MARLIN 12 scattergun is yours. Try not to redecorate the marina.');
      hud.toast('New weapon — MARLIN 12 scattergun (hold Q)', 3.6);
    }
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
/** Bank the live counts back onto the shelf weapon they belong to. */
function stashWeapon() {
  const shelf = combat.weapon();
  shelf.mag = player.state.ammo;
  shelf.reserve = player.state.reserve;
}

/** Load the shelf weapon in hand into the player's hands and HUD. */
function applyWeapon() {
  const shelf = combat.weapon();
  const p = player.state;
  p.ammo = shelf.mag;
  p.reserve = shelf.reserve;
  p.magazineSize = shelf.def.magazine;
  p.reloading = 0;
  hud.setWeapon(shelf.def.name);
  lastWeaponName = shelf.def.name;
}

/** Switch to another shelf weapon, counts and all; locked ones refuse. */
function switchWeapon(index) {
  stashWeapon();
  if (!combat.selectWeapon(index)) {
    hud.toast('Locked — the story pays that one out later', 1.8);
    return;
  }
  applyWeapon();
}

/** Fire the held weapon if the trigger, the magazine and the clock agree. */
function playerShoot() {
  const p = player.state;
  if (p.car || p.reloading > 0 || p.fireCooldown > 0) return;
  if (p.ammo <= 0) {
    startReload();
    return;
  }
  const def = combat.weapon().def;
  p.ammo -= 1;
  stashWeapon();
  p.fireCooldown = def.fireDelay;
  for (let pellet = 0; pellet < def.pellets; pellet += 1) {
    combat.shoot(p.x, p.y, p.aim, { hostile: false, damage: def.damage, spread: def.spread });
  }
  audio.gunshot();
  pedestrians.panicNear(p.x, p.y, 300);
  reportCrime(CRIME.gunshot);
  hud.shake(3);
}

/** R: swap the magazine; empty reserves just click. */
function startReload() {
  const p = player.state;
  if (p.reloading > 0 || p.ammo >= p.magazineSize || p.reserve <= 0) return;
  p.reloading = combat.weapon().def.reloadTime;
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
function onBulletHit(kind, entity, bullet) {
  audio.hit();
  if (kind === 'person') {
    if (pedestrians.fall(entity)) {
      player.state.kills += 1;
      reportCrime(CRIME.hitPedestrian);
    }
    return;
  }
  if (kind === 'actor') {
    entity.health -= bullet?.damage ?? 34;
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
    entity.health -= Math.max(6, Math.round((bullet?.damage ?? 34) * 0.6));
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
  // Number keys hop straight to a mission (the map markers 1–8).
  if (screen === 'playing') {
    for (let n = 1; n <= 8; n += 1) {
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
    xp = Number(save.xp) || 0;
  } else {
    missions.load({ completed: 0 });
    player.state.money = 250;
    collectibles.load([]);
    xp = 0;
  }
  // The weapon shelf restarts full; the story's payouts are re-earned
  // instantly from the banked mission count.
  combat.resetWeapons();
  if (missions.completed >= 3) combat.unlockWeapon(1);
  if (missions.completed >= 5) combat.unlockWeapon(2);
  applyWeapon();
  player.spawnAt();
  police.reset();
  airUnit.reset();
  combat.clear();
  actors.length = 0;
  screen = 'playing';
  hud.enterPlay();
  radioIndex = 0;
  radioTimer = 0;
  hud.setRadio(RADIO_STATION, RADIO_TRACKS[0][0], RADIO_TRACKS[0][1]);
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
const CAR_NAMES = { sedan: 'Harbour Sedan', sport: 'Vespera GT', van: 'Cargo Van', cruiser: 'PD Cruiser' };

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

/** Where the live step happens, named: its place, or the place its kind implies. */
function missionDistrict(entry) {
  if (!entry) return '';
  if (entry.place) {
    try {
      return world.place(entry.place).name;
    } catch {
      return '';
    }
  }
  if (entry.kind === 'steal' || entry.kind === 'escort') return 'Anchor Diner';
  if (entry.kind === 'ram') return 'Bayline Garage';
  if (entry.kind === 'race') return 'Bayline Block';
  if (entry.kind === 'evade') return 'Citywide';
  return '';
}

/** Push every live value into the HUD once per frame. */
function updateHud() {
  const p = player.state;
  hud.setWanted(police.wanted);
  hud.setCash(p.money);
  hud.setHealth(p.health, PLAYER.health);
  hud.setAmmo(p.ammo, p.reserve, p.magazineSize);
  if (combat.weapon().def.name !== lastWeaponName) {
    lastWeaponName = combat.weapon().def.name;
    hud.setWeapon(lastWeaponName);
  }
  hud.setWeaponSlots(combat.weaponStates());
  // The evening clock: 18:52 at first light, one game minute a second.
  const clockMinutes = 18 * 60 + 52 + Math.floor(time);
  hud.setClock(`DAY 1 · ${String(Math.floor(clockMinutes / 60) % 24).padStart(2, '0')}:${String(clockMinutes % 60).padStart(2, '0')}`);
  hud.setProgress(xpProgress());
  const kmh = p.car ? Math.abs(p.car.speed) * 0.62 : 0;
  const gear = !p.car ? '' : p.car.speed < -4 ? 'R' : `D${kmh < 28 ? 1 : kmh < 55 ? 2 : kmh < 90 ? 3 : kmh < 130 ? 4 : 5}`;
  hud.setSpeed(kmh, carName(p.car), Boolean(p.car), gear);
  // Cars carry no maxHealth field; their spawn health (CAR.health) is the max.
  if (p.car) hud.setCarCondition(p.car.health, p.car.maxHealth ?? CAR.health);
  if (missions.active) {
    const current = missions.active;
    const stepInfo = missions.step();
    const label = stepInfo ? stepInfo.entry.label : current.title;
    const extra = missions.status();
    const objectiveText = extra ? `${label} — ${extra}` : label;
    const timer = formatClock(missions.remainingTime());
    hud.setObjective(
      `${current.title} · Mission ${missions.index + 1} of ${missions.script.length}`,
      objectiveText,
      timer,
    );
    // The dossier on the rail: the same data, plus the stage bar (the
    // mission's own steps — earlier steps filled, the live one half-lit)
    // and the real successor: the next step's label, or the next mission.
    const position = stepInfo ? stepInfo.position : 0;
    const nextStep = current.steps[position + 1];
    const nextMission = missions.script[missions.index + 1];
    const district = missionDistrict(stepInfo ? stepInfo.entry : null);
    // The dossier's quiet second line: the condition the step is really
    // about — sight, cargo, or the race itself.
    const entry = stepInfo ? stepInfo.entry : null;
    const inSight = police.wanted > 0 && police.cars.some((car) => Math.hypot(car.x - p.x, car.y - p.y) <= 900);
    let sub = '';
    if (entry?.kind === 'evade') sub = inSight ? 'They can see you — break line of sight' : 'Out of sight — stay dark and keep rolling';
    else if (entry?.kind === 'deliver') sub = 'The bag stays in the car — so do you';
    else if (entry?.kind === 'race') sub = 'Six checkpoints around the block. The violet coupe is already rolling';
    else if (entry?.kind === 'guns') sub = 'Armed hands in the yard — watch the corners';
    else if (entry?.kind === 'escort') sub = 'Whatever follows you, outrun it';
    hud.setDossier({
      header: `CH ${missions.index + 1} — ${current.title.toUpperCase()}`,
      objective: objectiveText,
      sub,
      stageFilled: position,
      stageTotal: current.steps.length,
      stageIndex: position,
      next: nextStep ? nextStep.label : nextMission ? nextMission.title : 'The city is yours',
      timer,
      district,
    });
    hud.setDistrict(district);
    // Luna, on the radio: the target just came within 150 m on this step.
    const stepKey = `${missions.index}:${position}:${label}`;
    if (stepKey !== nearStepKey) {
      nearStepKey = stepKey;
      nearSaid = false;
    }
    const target = missions.target();
    if (target && !nearSaid && Math.hypot(target.x - p.x, target.y - p.y) <= 1500) {
      nearSaid = true;
      hud.say(LUNA_NEAR[lunaNearIndex % LUNA_NEAR.length]);
      lunaNearIndex += 1;
    }
  } else if (!missions.finished) {
    hud.hideObjective();
  }
  // Luna again: a fresh star is worth a word from dispatch.
  if (police.wanted > lastHudWanted) {
    hud.say(LUNA_HEAT[lunaHeatIndex % LUNA_HEAT.length]);
    lunaHeatIndex += 1;
  }
  lastHudWanted = police.wanted;
  // The PD panel, refreshed at ~5 Hz from the same cruiser list the radar
  // blips — computePdResponse (hud.js) derives names, statuses, distances
  // and the sight chip from those real cars, and says when to hide.
  if (pdTimer >= 0.2) {
    pdTimer = 0;
    const focus = { x: p.x, y: p.y, heading: p.car ? p.car.angle : p.aim };
    hud.setResponse(computePdResponse(police.cars, focus, police.wanted, airUnit.active ? [airUnit.panelUnit(focus)] : []));
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
  airUnit.reset();
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
  airUnit.update(dt, { player: p, wanted: police.wanted });

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
    xp += 25;
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
  renderer.drawBarricades(police.barricades, time);
  renderer.drawAirUnit(airUnit.unit, time);
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
      route: marker ? computeRoute(p, marker) : null,
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
    // The weapon wheel: Q held opens it, the pointer picks a segment,
    // releasing Q takes the pick (or leaves the held weapon alone).
    if (input.isDown('KeyQ')) {
      if (!wheelShown) {
        wheelShown = true;
        wheelSelected = combat.currentWeaponIndex;
        hud.showWheel(combat.weaponStates(), wheelSelected);
      } else {
        const dx = input.pointer.x - window.innerWidth / 2;
        const dy = input.pointer.y - window.innerHeight / 2;
        if (Math.hypot(dx, dy) > 34) {
          const angle = Math.atan2(dy, dx);
          const pick = angle < -Math.PI / 3 ? 0 : dx < 0 ? 1 : 2;
          if (pick !== wheelSelected) {
            wheelSelected = pick;
            hud.showWheel(combat.weaponStates(), wheelSelected);
          }
        }
      }
    } else if (wheelShown) {
      wheelShown = false;
      hud.hideWheel();
      if (wheelSelected !== combat.currentWeaponIndex) switchWeapon(wheelSelected);
    }
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
    // The next song rolls around every ~8 s; the station never changes.
    radioTimer += dt;
    if (radioTimer >= 8) {
      radioTimer = 0;
      radioIndex = (radioIndex + 1) % RADIO_TRACKS.length;
      hud.setRadio(RADIO_STATION, RADIO_TRACKS[radioIndex][0], RADIO_TRACKS[radioIndex][1]);
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

  // Shot mode keeps the one staged frame runShot froze (its radar carries
  // the staged cruisers); repainting here would redraw the radar from the
  // live police list, which is empty before play starts.
  if (screen !== 'shot') render();
  if (screen === 'playing' || screen === 'paused') {
    pdTimer += dt;
    updateHud();
  }
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
    airUnit,
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
  hud.freeze();
  render();
  if (result.radar) {
    // The shot's own radar state wins where it provides one (route, the
    // staged cruisers as police, traffic with those cruisers filtered out).
    // It is drawn last, after the final render, so the frozen photograph
    // keeps it instead of the live radar's empty police list.
    hud.drawRadar({ marker: result.marker, traffic: traffic.all(), police: police.cars, blink: false, ...result.radar });
  }
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
