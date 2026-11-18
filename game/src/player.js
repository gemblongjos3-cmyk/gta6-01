// The player: on foot with WASD and a mouse aim, or behind the wheel of whatever car they last
// climbed into. Health, money and ammo live here; getting into a car is a theft the police may see;
// dying or being arrested hands the player back to the street near a landmark.
import { CRIME, PLAYER, ROAD } from './config.js';
import { nearestCar, stepCarPhysics } from './vehicles.js';

export function createPlayer(world) {
  const player = {
    x: 0,
    y: 0,
    angle: 0,
    aim: 0,
    walking: false,
    running: false,
    health: PLAYER.health,
    money: 250,
    ammo: PLAYER.magazine,
    reserve: PLAYER.maxAmmo,
    reloading: 0,
    fireCooldown: 0,
    car: null,
    kills: 0,
    walkPhase: 0,
    hurtFlash: 0,
    footstep: 0,
  };

  /** Put the player on the pavement outside the diner, on foot and whole. */
  function spawnAt(x, y) {
    const diner = world.place('diner');
    player.x = x ?? diner.door.x;
    player.y = y ?? diner.door.y;
    player.health = PLAYER.health;
    player.car = null;
    player.walking = true;
    player.aim = -Math.PI / 2;
    player.hurtFlash = 0;
  }

  /** Walk (or ride) for one fixed step. Returns what the body did, for other systems to read. */
  function update(dt, input, aimPoint) {
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) {
        const need = PLAYER.magazine - player.ammo;
        const load = Math.min(need, player.reserve);
        player.ammo += load;
        player.reserve -= load;
      }
    }

    if (player.car) return updateInCar(dt, input);

    const axis = input.axis();
    const length = Math.hypot(axis.x, axis.y) || 1;
    player.running = input.running();
    player.walking = axis.x !== 0 || axis.y !== 0;
    const speed = (player.running ? PLAYER.runSpeed : PLAYER.walkSpeed) * (player.reloading > 0 ? 0.6 : 1);
    const before = { x: player.x, y: player.y };
    const body = {
      x: player.x + (axis.x / length) * speed * dt * (player.walking ? 1 : 0),
      y: player.y + (axis.y / length) * speed * dt * (player.walking ? 1 : 0),
    };
    world.resolveCircle(body, PLAYER.radius);
    player.x = Math.max(16, Math.min(world.width - 16, body.x));
    player.y = Math.max(16, Math.min(world.height - 16, body.y));
    player.aim = Math.atan2(aimPoint.y - player.y, aimPoint.x - player.x);
    player.angle = player.walking ? Math.atan2(axis.y, axis.x) : player.aim;
    player.walkPhase += speed * dt * 0.09;
    const distance = Math.hypot(player.x - before.x, player.y - before.y);
    player.footstep += distance;
    return { x: player.x, y: player.y, distance, driving: false };
  }

  function updateInCar(dt, input) {
    const car = player.car;
    const axis = input.axis();
    // W drives, S reverses (then brakes), A and D steer; Shift is the handbrake.
    const throttle = axis.y < 0 ? Math.min(1, car.speed / car.maxSpeed + 0.55) : 0;
    const brakeInput = axis.y > 0 ? (car.speed > 4 ? 0.8 : 1) : 0;
    const steer = axis.x * 1.4;
    stepCarPhysics(car, dt, { throttle, brake: brakeInput, steer }, world);
    player.x = car.x;
    player.y = car.y;
    player.aim = Math.atan2(input.pointer.worldY - car.y, input.pointer.worldX - car.x);
    return {
      x: car.x,
      y: car.y,
      distance: Math.abs(car.speed) * dt,
      driving: true,
      speed: car.speed,
      crashed: car.hitFlash > 0.3,
    };
  }

  /** Climb into `car`; if a traffic driver is in it, they bail out and the police hear about it. */
  function enterCar(car, opts = {}) {
    const wasOccupied = car.kind === 'traffic' || car.kind === 'parked' || car.kind === 'police';
    car.driver = 'player';
    player.car = car;
    player.walking = false;
    car.speed = Math.min(car.speed, 60);
    return {
      stolen: wasOccupied,
      /** A traffic car's driver leaves the street and runs. */
      ejectedDriver: wasOccupied ? { x: car.x + Math.cos(car.angle + Math.PI) * 24, y: car.y + Math.sin(car.angle + Math.PI) * 24 } : null,
      crime: wasOccupied ? CRIME.stealCar : 0,
    };
  }

  /** Step out beside the car, clear of its body. */
  function exitCar() {
    const car = player.car;
    if (!car) return null;
    const side = { x: car.x - Math.sin(car.angle) * (car.width / 2 + 16), y: car.y + Math.cos(car.angle) * (car.width / 2 + 16) };
    const body = { x: side.x, y: side.y };
    world.resolveCircle(body, PLAYER.radius + 2);
    player.x = body.x;
    player.y = body.y;
    player.aim = car.angle;
    player.car = null;
    car.driver = null;
    car.speed *= 0.3;
    return { x: player.x, y: player.y };
  }

  /** Damage the player; returns true when it was the killing blow. */
  function hurt(amount) {
    player.health = Math.max(0, player.health - amount);
    player.hurtFlash = 0.5;
    return player.health <= 0;
  }

  function heal(amount) {
    player.health = Math.min(PLAYER.health, player.health + amount);
  }

  function addMoney(amount) {
    player.money = Math.max(0, player.money + amount);
  }

  /** The car the player could climb into: the nearest within a few steps. */
  function carInReach(cars) {
    if (player.car) return null;
    return nearestCar(cars, player.x, player.y, ROAD.width / 2 + 10);
  }

  /** A safe place to come back after an arrest or a wipeout: the nearest hospital or diner. */
  function respawnPoint(world2) {
    const hospital = world2.place('hospital');
    return { x: hospital.door.x, y: hospital.door.y };
  }

  return {
    state: player,
    spawnAt,
    update,
    enterCar,
    exitCar,
    hurt,
    heal,
    addMoney,
    carInReach,
    respawnPoint,
  };
}
