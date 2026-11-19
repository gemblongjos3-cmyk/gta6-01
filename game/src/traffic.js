// The city's cars that nobody drives for the player: traffic that keeps to the lanes, stops at
// junctions now and then, brakes for whatever is in front of it, and is carjackable. Parked cars
// are laid along the kerbs, and one of them is always a convertible waiting by the diner.
import { ROAD, TRAFFIC } from './config.js';
import { createCar, findParkingSpot, stepCarPhysics } from './vehicles.js';

/** How far a car may wander from the centre of its lane before it steers back. */
const LANE_TOLERANCE = 7;

export function createTraffic(world, random) {
  const cars = [];
  const parked = [];
  const skids = [];

  /** A car in the middle of a lane on a random road, heading either way. */
  function spawnTrafficCar() {
    const spawn = world.randomRoadSpawn(ROAD.laneOffset);
    const angle = spawn.axis === 'x' ? (spawn.dir > 0 ? 0 : Math.PI) : spawn.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const car = createCar(random, {
      x: spawn.x,
      y: spawn.y,
      angle,
      kind: 'traffic',
      model: random.chance(0.22) ? 'van' : random.chance(0.25) ? 'sport' : 'sedan',
    });
    car.axis = spawn.axis;
    car.dir = spawn.dir;
    car.laneCenter = spawn.heading;
    car.cruise = TRAFFIC.speed + random.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter);
    car.wait = 0;
    car.turnCountdown = random.range(3, 12);
    car.panic = 0;
    car.road = true;
    cars.push(car);
    return car;
  }

  /** Lay a parked car against the kerb near a named place, so the first theft is always there. */
  function spawnParkedCar(nearX, nearY, model = 'sport') {
    const spot = findParkingSpot(world, random, nearX, nearY);
    if (!spot) return null;
    const car = createCar(random, {
      x: spot.x,
      y: spot.y,
      angle: spot.angle,
      kind: 'parked',
      model,
      color: model === 'sport' ? '#e2574c' : null,
    });
    parked.push(car);
    return car;
  }

  for (let index = 0; index < TRAFFIC.cars; index += 1) spawnTrafficCar();
  for (const place of world.places.values()) {
    if (place.kind === 'diner' || place.kind === 'hotel' || place.kind === 'garage' || place.kind === 'marina') {
      spawnParkedCar(place.door.x, place.door.y, place.kind === 'garage' ? 'sport' : 'sedan');
    }
  }
  for (let index = 0; index < 10; index += 1) {
    const block = random.pick(world.blocks);
    spawnParkedCar((block.left + block.right) / 2, block.bottom + 40);
  }

  /** Steer a car back to the middle of its lane and keep it off the pavement. */
  function laneKeep(car) {
    const target = car.laneCenter;
    const across = car.axis === 'x' ? car.y : car.x;
    const error = target - across;
    if (Math.abs(error) < LANE_TOLERANCE) return 0;
    const correction = Math.max(-1, Math.min(1, error / 40));
    // Steering right turns the nose clockwise: on an x road that means +y, on a y road +x.
    const facing = Math.cos(car.angle) >= 0 ? 1 : -1;
    const sign = car.axis === 'x' ? facing : -facing;
    return correction * sign * 0.55;
  }

  /** Look down the lane for another car, a pedestrian or the player, and brake for it. */
  function obstacleAhead(car, others, bodies) {
    const look = TRAFFIC.lookAhead + Math.abs(car.speed) * 0.35;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    let closest = look;
    let found = false;
    for (const other of others) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * fx + dy * fy;
      const lateral = Math.abs(dx * fy - dy * fx);
      if (ahead > 0 && ahead < closest && lateral < 34) {
        closest = ahead;
        found = true;
      }
    }
    for (const body of bodies) {
      const dx = body.x - car.x;
      const dy = body.y - car.y;
      const ahead = dx * fx + dy * fy;
      const lateral = Math.abs(dx * fy - dy * fx);
      if (ahead > 0 && ahead < closest + 10 && lateral < 42) {
        closest = ahead;
        found = true;
      }
    }
    return found ? closest : null;
  }

  /**
   * One fixed step of every traffic car. `bodies` are the things to brake for (the player on foot,
   * mission targets); `player` is used to make cars scatter after a nearby gunshot.
   */
  function update(dt, bodies = []) {
    for (const car of cars) {
      if (car.driver === 'player') continue;
      car.panic = Math.max(0, car.panic - dt);
      car.turnCountdown -= dt;
      car.wait = Math.max(0, car.wait - dt);

      const gap = obstacleAhead(car, cars, bodies);
      let throttle = 1;
      let brake = 0;
      if (gap !== null) {
        if (gap < 48) {
          throttle = 0;
          brake = 1;
        } else {
          throttle = 0.15;
          brake = 0.35;
        }
      }
      if (car.wait > 0) {
        throttle = 0;
        brake = 1;
      }
      // Now and then a car pauses at a junction, as if yielding.
      const nearJunction = world
        .isOnRoad(car.x, car.y, 0)
        && ROAD.avenueX.some((x) => Math.abs(car.x - x) < 70)
        && ROAD.streetY.some((y) => Math.abs(car.y - y) < 70);
      if (nearJunction && car.wait === 0 && random.chance(dt * 0.35)) car.wait = TRAFFIC.stopTime * random.range(0.5, 1.2);

      // Turn a corner: at a junction, sometimes swing onto the crossing road and reset the lane.
      if (nearJunction && car.turnCountdown <= 0) {
        car.turnCountdown = random.range(5, 16);
        if (random.chance(0.42)) {
          const crossing = car.axis === 'x' ? 'y' : 'x';
          const roadAt = crossing === 'y'
            ? ROAD.avenueX.reduce((best, at) => (Math.abs(car.x - at) < Math.abs(car.x - best) ? at : best), ROAD.avenueX[0])
            : ROAD.streetY.reduce((best, at) => (Math.abs(car.y - at) < Math.abs(car.y - best) ? at : best), ROAD.streetY[0]);
          car.axis = crossing;
          car.dir = random.chance(0.5) ? 1 : -1;
          car.laneCenter = roadAt + TRAFFIC.laneOffset * car.dir;
          const target = crossing === 'x' ? (car.dir > 0 ? 0 : Math.PI) : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.angle = target;
          car.x = crossing === 'x' ? roadAt : car.x;
          car.y = crossing === 'y' ? roadAt : car.y;
        }
      }

      const steer = laneKeep(car);
      const controls = { throttle: car.speed > car.cruise ? 0 : throttle, brake, steer };
      const before = { x: car.x, y: car.y };
      const result = stepCarPhysics(car, dt, controls, world);
      // A traffic car that scrapes a wall slides along it rather than jittering: turn it to match the lane.
      if (result.crashed && Math.abs(car.speed) < 40) {
        car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (car.skid > 0.55 && Math.abs(car.speed) > 120) {
        skids.push({ x: before.x, y: before.y, angle: car.angle, life: 3.2 });
      }
      // Out of the world or stuck far off a lane: put it back in the flow.
      if (car.x < 20 || car.x > world.width - 20 || car.y < 20 || car.y > world.height - 20) {
        const spawn = world.randomRoadSpawn(ROAD.laneOffset);
        car.x = spawn.x;
        car.y = spawn.y;
        car.axis = spawn.axis;
        car.dir = spawn.dir;
        car.laneCenter = spawn.heading;
        car.angle = spawn.axis === 'x' ? (spawn.dir > 0 ? 0 : Math.PI) : spawn.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    for (let index = skids.length - 1; index >= 0; index -= 1) {
      skids[index].life -= dt;
      if (skids[index].life <= 0) skids.splice(index, 1);
    }
  }

  /** Every car that is still standing: traffic and parked, for collisions and for stealing. */
  function all() {
    return cars.concat(parked);
  }

  /** Remove a car from the world (it was destroyed or mission-flagged out). */
  function retire(car) {
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
    const parkedIndex = parked.indexOf(car);
    if (parkedIndex >= 0) parked.splice(parkedIndex, 1);
  }

  return { cars, parked, skids, update, all, retire, spawnTrafficCar, spawnParkedCar };
}

// Round 5 note: traffic now shares the avenue with staged roadblocks at four stars.
