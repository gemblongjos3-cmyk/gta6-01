// The four scenes behind ?shot=cover|docks|delivery|start. Each one is a real moment of the game
// with its actors placed on purpose and every value driven to its final state with gsap.set (never
// a half-played tween), so the same seed always photographs the same frame. In shot mode the clock
// is frozen too: water shimmer, neon and siren flashes all read one fixed time.
import { CAMERA, COAST, PLAYER, ROAD } from './config.js';
import { createCar } from './vehicles.js';

const gsap = window.gsap;

/** Where downtown is: the junction of Sunset Avenue and the street through the bank. */
const DOWNTOWN = { x: ROAD.avenueX[4], y: ROAD.streetY[2] };

export const SHOT_NAMES = ['cover', 'docks', 'delivery', 'start'];

/** The fixed moment every screenshot is painted at. */
export const SHOT_TIME = 12.5;

/** A parked body for a scene, added to the shared car list so it drives, draws and blips. */
function placeCar(ctx, spec) {
  const car = createCar(ctx.random, spec);
  car.axis = Math.abs(Math.cos(car.angle)) > 0.5 ? 'x' : 'y';
  car.dir = Math.cos(car.angle) >= 0 ? 1 : -1;
  car.laneCenter = car.axis === 'x' ? car.y : car.x;
  car.cruise = spec.cruise ?? 150;
  if (spec.kind === 'police') {
    car.sirenPhase = spec.sirenPhase ?? 1.3;
    car.health = 160;
  }
  ctx.traffic.cars.push(car);
  return car;
}

/**
 * Stage `name` over the live systems in `ctx` (world, traffic, pedestrians, player, police,
 * missions, combat, hud, camera) and return the HUD values the frame should show.
 */
export function stageShot(name, ctx) {
  const { world, traffic, pedestrians, player, police, combat, hud, camera } = ctx;
  // Every value below is set to its FINAL state, so a frame is never caught mid-tween. The
  // global timeline must keep ticking for gsap.set to render at all: a paused one swallows it.
  gsap.set(document.getElementById('game'), { x: 0, y: 0, filter: 'none' });
  gsap.set('#flash', { opacity: 0 });
  hud.endBanner();
  hud.hideObjective();
  // The title and pause panels are HTML over the canvas: stay out of every framed scene.
  gsap.set('#start', { autoAlpha: 0, visibility: 'hidden' });
  gsap.set('#pause', { autoAlpha: 0, visibility: 'hidden' });

  if (name === 'start') return stageStart(ctx);
  if (name === 'docks') return stageDocks(ctx);
  if (name === 'delivery') return stageDelivery(ctx);
  return stageCover(ctx);

  // ---------- 1. cover: a downtown chase ----------

  function stageCover() {
    const avenue = DOWNTOWN.x;
    const street = DOWNTOWN.y;
    const car = createCar(ctx.random, {
      x: avenue + 34,
      y: street + 250,
      angle: -Math.PI / 2,
      kind: 'player',
      model: 'sport',
      color: '#e2574c',
    });
    car.speed = 250;
    car.driver = 'player';
    car.health = 88;
    traffic.cars.push(car);
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.aim = -Math.PI / 2;

    // Three cruisers closing from the south, light bars on.
    const cruisers = [
      { x: avenue + 30, y: street + 430, angle: -Math.PI / 2, phase: 0.4 },
      { x: avenue - 44, y: street + 500, angle: -Math.PI / 2 + 0.18, phase: 2.1 },
      { x: avenue + 96, y: street + 590, angle: -Math.PI / 2 - 0.12, phase: 3.4 },
    ];
    for (const cruiser of cruisers) {
      placeCar(ctx, {
        x: cruiser.x,
        y: cruiser.y,
        angle: cruiser.angle,
        kind: 'police',
        model: 'cruiser',
        color: '#e8eef5',
        sirenPhase: cruiser.phase,
      });
    }
    police.setWanted(4);

    // Ordinary traffic on the crossing street and up ahead, so the city reads as alive.
    placeCar(ctx, { x: avenue - 420, y: street - 70, angle: 0, kind: 'traffic', color: '#f0a24a' });
    placeCar(ctx, { x: avenue + 300, y: street + 70, angle: Math.PI, kind: 'traffic', color: '#4fa3c7' });
    placeCar(ctx, { x: avenue + 70, y: street - 260, angle: Math.PI / 2, kind: 'traffic', color: '#c9c9d1', model: 'van' });
    placeCar(ctx, { x: avenue - 150, y: street + 40, angle: Math.PI, kind: 'traffic', color: '#7bbf6a' });

    // A few pedestrians on the corner, one already running.
    for (let index = 0; index < 7; index += 1) {
      const person = pedestrians.people[index];
      person.x = avenue - 130 + index * 38;
      person.y = street - 110 + (index % 2) * 24;
      person.angle = index % 3 === 0 ? 0.4 : -1.2;
      person.state = index === 2 ? 'flee' : 'walk';
      person.speed = person.state === 'flee' ? 190 : 50;
    }
    pedestrians.people[2].panic = 4;

    // Bullets already in the air, one muzzle flash, smoke off the player's fender.
    combat.shoot(car.x + 24, car.y - 30, -Math.PI / 2 + 0.06, { hostile: false, damage: 30 });
    combat.shoot(avenue + 8, street + 392, -Math.PI / 2, { hostile: true, damage: 22 });
    combat.shoot(avenue - 30, street + 470, -Math.PI / 2 + 0.1, { hostile: true, damage: 22 });
    combat.muzzleHold = true;

    camera.x = avenue + 20;
    camera.y = street + 400;
    camera.zoom = 0.92;

    // A drift trail off the coupe's rear wheels: the car is mid-corner, not parked.
    for (let back = 0; back < 5; back += 1) {
      traffic.skids.push({ x: car.x - Math.sin(car.angle) * (30 + back * 26) - 12, y: car.y + 34 + back * 24, angle: car.angle, life: 2.6 - back * 0.3 });
      traffic.skids.push({ x: car.x - Math.sin(car.angle) * (30 + back * 26) + 12, y: car.y + 34 + back * 24, angle: car.angle, life: 2.6 - back * 0.3 });
    }

    player.health = 74;
    player.money = 1840;
    hud.setWanted(4);
    hud.setCash(1840);
    hud.setHealth(74, PLAYER.health);
    hud.setAmmo(9, 36, PLAYER.magazine);
    hud.setObjective('Heat Line · Mission 5 of 6', 'Shake the police — get the wanted level to zero', '1:12');
    hud.setMissionTag('Sunset Avenue · Downtown');
    hud.setSpeed(112, 'Sprint Coupe', true);
    hud.toast('Wanted 4 — the whole precinct is on you', 9);
    hud.hint('');
    return {
      wanted: 4,
      marker: { x: avenue + 34, y: street - 900 },
      speed: 112,
      carName: 'Sprint Coupe',
      radar: { x: car.x, y: car.y, aim: -Math.PI / 2, rotate: 0 },
      bannerVisible: false,
    };
  }

  // ---------- 2. docks: a gunfight on the waterfront ----------

  function stageDocks() {
    const warehouse = world.place('warehouse');
    const door = warehouse.door;
    player.car = null;
    player.x = door.x - 40;
    player.y = door.y + 150;
    player.aim = Math.atan2(door.y - player.y, door.x - player.x);
    player.health = 82;
    player.money = 3120;
    player.lastShot = 0;

    // Three targets in the yard, the nearest one lit by the muzzle flash.
    const spots = [
      { x: door.x + 30, y: door.y + 40, name: 'Dock Boss', hp: 42 },
      { x: door.x + 128, y: door.y + 12, name: 'Night Clerk', hp: 60 },
      { x: door.x - 30, y: door.y - 20, name: 'Toll Man', hp: 60 },
    ];
    ctx.actors.length = 0;
    for (const spot of spots) {
      ctx.actors.push({
        x: spot.x,
        y: spot.y,
        angle: Math.atan2(player.y - spot.y, player.x - spot.x),
        hp: spot.hp,
        maxHp: 60,
        dead: false,
        hostile: true,
        fireCooldown: 1,
        hurt: 0.2,
        name: spot.name,
        walkPhase: 0,
      });
    }

    // Rounds in flight both ways, sparks where one hit a crate.
    combat.shoot(player.x, player.y, player.aim, { hostile: false, damage: 30 });
    combat.shoot(spots[0].x, spots[0].y, Math.atan2(player.y - spots[0].y, player.x - spots[0].x), { hostile: true, damage: 20 });
    combat.shoot(spots[1].x, spots[1].y, Math.atan2(player.y - spots[1].y, player.x - spots[1].x), { hostile: true, damage: 20 });
    combat.spark(door.x + 62, door.y + 70, -0.6, '#e8d9c0');
    combat.muzzleHold = true;

    // People on the boardwalk scatter.
    for (let index = 0; index < 9; index += 1) {
      const person = pedestrians.people[index];
      person.x = door.x - 210 + index * 52;
      person.y = COAST.beachTop + 60 + (index % 3) * 34;
      person.state = 'flee';
      person.panic = 4;
      person.speed = 190;
      const angle = Math.atan2(person.y - player.y, person.x - player.x);
      person.angle = angle;
    }

    // Spent brass on the boards where the player has been standing.
    for (let shell = 0; shell < 6; shell += 1) {
      ctx.combat.casings.push({ x: player.x - 26 - shell * 7, y: player.y + 14 + (shell % 2) * 9, vx: 0, vy: 0, life: 1.4, spin: shell * 1.7 });
    }

    // Two cruisers rolling along the promenade, still a way off.
    placeCar(ctx, { x: door.x + 420, y: COAST.beachTop - 30, angle: Math.PI, kind: 'police', model: 'cruiser', color: '#e8eef5', sirenPhase: 0.6 });
    placeCar(ctx, { x: door.x - 380, y: COAST.beachTop - 30, angle: 0, kind: 'police', model: 'cruiser', color: '#e8eef5', sirenPhase: 2.8 });
    placeCar(ctx, { x: door.x + 190, y: COAST.beachTop + 24, angle: Math.PI / 2, kind: 'traffic', color: '#8a6fc0', model: 'van' });
    police.setWanted(2);

    camera.x = door.x + 20;
    camera.y = door.y + 110;
    camera.zoom = 1.08;

    hud.setWanted(2);
    hud.setCash(3120);
    hud.setHealth(82, PLAYER.health);
    hud.setAmmo(7, 24, PLAYER.magazine);
    hud.setObjective('Pier Nine · Mission 4 of 6', 'Clear the warehouse yard — 3 targets', '0:37');
    hud.setMissionTag('Pier Nine · Shrimp Row');
    hud.setSpeed(0, '', false);
    hud.toast('Shots fired — the whole pier heard it', 9);
    hud.hint('');
    return {
      wanted: 2,
      marker: { x: door.x + 30, y: door.y + 40 },
      speed: 0,
      radar: { x: player.x, y: player.y, aim: player.aim, rotate: 0 },
      bannerVisible: false,
    };
  }

  // ---------- 3. delivery: a timed run through the traffic ----------

  function stageDelivery() {
    const marina = world.place('marina');
    const garageDoor = world.place('garage').door;
    const avenue = ROAD.avenueX[3];
    const street = ROAD.streetY[3];

    const van = createCar(ctx.random, {
      x: avenue + 34,
      y: street + 300,
      angle: -Math.PI / 2,
      kind: 'player',
      model: 'van',
      color: '#f0c479',
    });
    van.speed = 190;
    van.driver = 'player';
    traffic.cars.push(van);
    player.car = van;
    player.x = van.x;
    player.y = van.y;
    player.money = 960;
    player.health = 96;

    // Traffic going the other way and one slow car ahead, so the lane reads busy.
    placeCar(ctx, { x: avenue - 34, y: street + 120, angle: Math.PI / 2, kind: 'traffic', color: '#4fa3c7' });
    placeCar(ctx, { x: avenue - 34, y: street + 560, angle: Math.PI / 2, kind: 'traffic', color: '#c9c9d1', model: 'van' });
    placeCar(ctx, { x: avenue + 34, y: street - 150, angle: -Math.PI / 2, kind: 'traffic', color: '#7bbf6a' });
    placeCar(ctx, { x: avenue + 300, y: street + 40, angle: Math.PI, kind: 'traffic', color: '#e2574c' });
    placeCar(ctx, { x: avenue + 34, y: street - 520, angle: -Math.PI / 2, kind: 'traffic', color: '#8a6fc0' });

    for (let index = 0; index < 6; index += 1) {
      const person = pedestrians.people[index];
      person.x = avenue - 96 - (index % 2) * 26;
      person.y = street + 60 + index * 74;
      person.angle = Math.PI / 2;
      person.state = 'walk';
      person.speed = 58;
    }
    police.setWanted(1);
    placeCar(ctx, { x: avenue - 34, y: street - 880, angle: Math.PI / 2, kind: 'police', model: 'cruiser', color: '#e8eef5', sirenPhase: 1.1 });

    camera.x = avenue + 10;
    camera.y = street + 40;
    camera.zoom = 0.9;

    const checkpoint = { x: garageDoor.x, y: garageDoor.y };
    hud.setWanted(1);
    hud.setCash(960);
    hud.setHealth(96, PLAYER.health);
    hud.setAmmo(12, 48, PLAYER.magazine);
    hud.setObjective('Borrowed Time · Mission 2 of 6', 'Deliver the package to Bayline Garage', '0:48');
    hud.setMissionTag(`${Math.round(Math.hypot(checkpoint.x - van.x, checkpoint.y - van.y) / 10)} m · Bayline`);
    hud.setSpeed(74, 'Cargo Van', true);
    hud.toast('Checkpoint in 980 m — keep it rolling', 9);
    hud.hint('');
    return {
      wanted: 1,
      marker: checkpoint,
      speed: 74,
      carName: 'Cargo Van',
      radar: { x: van.x, y: van.y, aim: -Math.PI / 2, rotate: 0 },
      bannerVisible: false,
      checkpoint: true,
    };
  }

  // ---------- 4. start: the title over the evening city ----------

  function stageStart() {
    const diner = world.place('diner');
    player.car = null;
    player.x = diner.door.x + 10;
    player.y = diner.door.y + 46;
    player.aim = -0.4;

    // A little life on the street behind the title card.
    placeCar(ctx, { x: diner.door.x + 260, y: diner.door.y + 96, angle: Math.PI, kind: 'traffic', color: '#e2574c' });
    placeCar(ctx, { x: diner.door.x - 220, y: diner.door.y + 60, angle: 0, kind: 'traffic', color: '#f0a24a', model: 'van' });
    placeCar(ctx, { x: diner.door.x + 60, y: diner.door.y + 260, angle: -Math.PI / 2, kind: 'parked', color: '#8a6fc0', model: 'sport' });
    for (let index = 0; index < 6; index += 1) {
      const person = pedestrians.people[index];
      person.x = diner.door.x - 180 + index * 64;
      person.y = diner.door.y + 40 + (index % 2) * 26;
      person.angle = index % 2 === 0 ? 0 : Math.PI;
      person.state = 'walk';
      person.speed = 55;
    }
    camera.x = diner.door.x + 40;
    camera.y = diner.door.y + 20;
    camera.zoom = 1.02;

    hud.hideHud();
    hud.enterStart();
    gsap.set('#start', { autoAlpha: 1, visibility: 'visible' });
    gsap.set('#startPanel', { autoAlpha: 1, y: 0, scale: 1 });
    gsap.set('#title', { autoAlpha: 1, y: 0, letterSpacing: '-1px' });
    gsap.set('#startMenu .item', { autoAlpha: 1, y: 0 });
    gsap.set('.controls span', { autoAlpha: 1 });
    // The first menu line reads as the one Enter would take.
    gsap.set('#startMenu .item', { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'transparent' });
    gsap.set('#startMenu .item:nth-child(1)', { backgroundColor: 'rgba(255,201,77,0.13)', borderColor: 'rgba(255,201,77,0.5)' });
    gsap.set('#pause', { autoAlpha: 0, visibility: 'hidden' });
    return {
      wanted: 0,
      marker: null,
      speed: 0,
      radar: { x: player.x, y: player.y, aim: 0, rotate: 0 },
      bannerVisible: false,
      startScreen: true,
    };
  }
}

export { CAMERA };
