// Cars: how one is built, how it moves under a driver, what a crash costs it and when it starts
// to smoke. The player's car, the traffic, the police cruisers and the parked cars all use this
// same body, so a stolen car drives exactly like the one the player walked out of.
import { CAR, PALETTE, ROAD } from './config.js';

/** A fresh car body. `kind` is player, traffic, police, parked or mission; `driver` is filled in later. */
export function createCar(random, { x = 0, y = 0, angle = 0, kind = 'parked', color = null, model = 'sedan' } = {}) {
  const pick = color ?? PALETTE.car[Math.floor(random() * PALETTE.car.length)];
  return {
    x,
    y,
    angle,
    speed: 0,
    steer: 0,
    kind,
    model,
    driver: null,
    color: pick,
    roof: shade(pick, -18),
    glass: PALETTE.glass,
    length: model === 'sport' ? CAR.length + 6 : model === 'van' ? CAR.length + 12 : CAR.length,
    width: model === 'van' ? CAR.width + 6 : CAR.width,
    maxSpeed: model === 'sport' ? CAR.maxSpeed + 90 : model === 'van' ? CAR.maxSpeed - 70 : CAR.maxSpeed,
    accel: model === 'sport' ? CAR.accel + 90 : model === 'van' ? CAR.accel - 40 : CAR.accel,
    health: CAR.health,
    smoke: 0,
    wheelTurn: 0,
    skid: 0,
    hitFlash: 0,
    road: false,
    damaged: false,
  };
}

/** Lighten (positive) or darken (negative) a #rrggbb colour by `amount` per channel. */
export function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (value & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Drive one car for a fixed step. `controls` asks for throttle (0..1), brake (0..1), steer
 * (-1..1) and handbrake; the body answers with the new position, a speed that never runs past the
 * model's limit, and `crashed` when it ran into a building hard enough to hurt.
 */
export function stepCarPhysics(car, dt, controls, world) {
  const throttle = controls.throttle ?? 0;
  const brake = controls.brake ?? 0;
  const steerInput = controls.steer ?? 0;

  const before = { x: car.x, y: car.y };

  // A car only steers while it is actually rolling, and it rolls faster forward than back.
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  if (brake > 0) car.speed -= CAR.brake * brake * dt;
  const rollingResistance = car.road ? 0.6 : 2.2;
  car.speed -= car.speed * CAR.drag * rollingResistance * dt * 0.08;
  if (throttle === 0 && brake === 0) {
    const idle = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - 140 * dt);
    car.speed = idle * (1 - 0.9 * dt);
  }
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(car.maxSpeed, car.speed));

  car.steer += (steerInput - car.steer) * Math.min(1, dt * 10);
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 140);
  const turnRate = car.steer * CAR.steer * steerAuthority * Math.sign(car.speed || 1);
  car.angle += turnRate * dt;
  car.wheelTurn = car.steer;

  // Drift: the nose leads the direction of travel a little while turning hard and fast.
  const drift = Math.abs(car.steer) * Math.min(1, Math.abs(car.speed) / 260);
  car.skid = Math.max(0, Math.min(1, drift * 1.1));
  const heading = car.angle - car.steer * drift * 0.14 * Math.sign(car.speed || 1);
  car.x += Math.cos(heading) * car.speed * dt;
  car.y += Math.sin(heading) * car.speed * dt;

  car.road = world.isOnRoad(car.x, car.y, 0);

  // Buildings and the sea stop the car; a hard hit costs speed and paint.
  const body = { x: car.x, y: car.y };
  const hit = world.resolveCircle(body, CAR.radius);
  if (hit) {
    const moved = Math.hypot(body.x - car.x, body.y - car.y);
    car.x = body.x;
    car.y = body.y;
    if (Math.abs(car.speed) > 150) {
      car.health -= Math.min(26, Math.abs(car.speed) * 0.035);
      car.hitFlash = 0.35;
    }
    car.speed *= Math.max(0.1, 1 - moved * 0.06);
  }

  // Keep the car in the world's edges.
  car.x = Math.max(12, Math.min(world.width - 12, car.x));
  car.y = Math.max(12, Math.min(world.height - 12, car.y));

  car.hitFlash = Math.max(0, car.hitFlash - dt);
  if (car.health < CAR.health * 0.45) car.smoke = Math.min(1, car.smoke + dt * 0.4);
  car.damaged = car.health < CAR.health * 0.35;

  return {
    crashed: hit && Math.abs(before.x - car.x) + Math.abs(before.y - car.y) > 3,
    distance: Math.hypot(car.x - before.x, car.y - before.y),
  };
}

/** A place on the roadside where a parked car can stand, clear of buildings, or null. */
export function findParkingSpot(world, random, x, y) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const spot = world.nearestRoadPoint(
      x + random.range(-260, 260),
      y + random.range(-260, 260),
      ROAD.width / 2 - 16,
      random.chance(0.5) ? 1 : -1,
    );
    const solid = world.solids.some(
      (item) => item.kind === 'building' && Math.abs(spot.x - (item.x + item.w / 2)) < item.w / 2 + 40 && Math.abs(spot.y - (item.y + item.h / 2)) < item.h / 2 + 40,
    );
    if (solid) continue;
    if (!world.isOnRoad(spot.x, spot.y, 8) && !world.isOnPavement(spot.x, spot.y)) continue;
    return { x: spot.x, y: spot.y, angle: spot.axis === 'x' ? 0 : Math.PI / 2 };
  }
  return null;
}

/** The car nearest to (x, y) within `radius`, or null: what E climbs into. */
export function nearestCar(cars, x, y, radius) {
  let best = null;
  let bestDistance = radius;
  for (const car of cars) {
    const distance = Math.hypot(car.x - x, car.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = car;
    }
  }
  return best;
}
