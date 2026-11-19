// The wanted level and the police who answer it. Crimes add heat (one to five stars); with stars
// up, cruisers roll in from the edges of the map, chase what they can see, ram, and send a round at
// a player on foot. Stars cool off after a quiet spell, faster if the player is out of sight. A
// player on foot held inside a cruiser's reach for a couple of seconds is BUSTED; a health bar run
// to zero is WASTED; the main loop turns both into a screen and a respawn.
import { POLICE } from './config.js';
import { createCar, stepCarPhysics } from './vehicles.js';

export function createPolice(world, random) {
  const cars = [];
  const barricades = [];
  let wanted = 0;
  let quiet = 0;
  let bust = 0;
  let busted = false;
  let wasted = false;
  let siren = 0;
  let spawnTimer = 0;
  let roadblockTimer = 0;
  let roadblockCount = 0;

  /** Add stars (never above five) and restart the quiet timer. */
  function commitCrime(stars, reason = '') {
    if (stars <= 0) return;
    wanted = Math.min(5, wanted + stars);
    quiet = 0;
    siren = 1;
    return { wanted, reason };
  }

  function setWanted(level) {
    wanted = Math.max(0, Math.min(5, Math.floor(level)));
    quiet = 0;
  }

  function clearWanted() {
    wanted = 0;
    quiet = 0;
    bust = 0;
  }

  /** A cruiser at the edge of the map nearest the player, rolling toward the city. */
  function spawnCruiser(player) {
    const angle = random() * Math.PI * 2;
    const distance = 1200 + random() * 400;
    const x = Math.max(40, Math.min(world.width - 40, player.x + Math.cos(angle) * distance));
    const y = Math.max(40, Math.min(world.height - 40, player.y + Math.sin(angle) * distance));
    const car = createCar(random, { x, y, kind: 'police', model: 'cruiser', color: '#23262e' });
    car.axis = 'x';
    car.dir = 1;
    car.laneCenter = y;
    car.cruise = POLICE.carSpeed;
    car.angle = Math.random() * Math.PI * 2;
    car.health = 160;
    car.sirenPhase = random() * Math.PI * 2;
    cars.push(car);
    return car;
  }

  function retire(car) {
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
  }

  /**
   * Throw a roadblock across the road at (x, y): two cruisers parked nose
   * to tail across the lanes and a line of striped barricades between and
   * beside them. `axisAngle` runs along the road — the block stands
   * across it. The cruisers hold their ground; they never chase.
   */
  function spawnRoadblockAt(x, y, axisAngle) {
    roadblockCount += 1;
    const blockId = roadblockCount;
    const units = [];
    for (const offset of [-36, 36]) {
      const car = createCar(random, {
        x: x + Math.cos(axisAngle) * offset,
        y: y + Math.sin(axisAngle) * offset,
        angle: axisAngle + (offset < 0 ? 0.05 : -0.05),
        kind: 'police',
        model: 'cruiser',
        color: '#23262e',
      });
      car.health = 220;
      car.speed = 0;
      car.roadblock = true;
      car.blockId = blockId;
      car.sirenPhase = random() * Math.PI * 2;
      cars.push(car);
      units.push(car);
    }
    for (const offset of [-78, 0, 78]) {
      barricades.push({ x: x + Math.cos(axisAngle) * offset, y: y + Math.sin(axisAngle) * offset, angle: axisAngle, blockId });
    }
    siren = 1;
    return units;
  }

  /** Retire one whole roadblock — both cruisers and their barricades. */
  function retireRoadblock(blockId) {
    for (let index = cars.length - 1; index >= 0; index -= 1) {
      if (cars[index].blockId === blockId) cars.splice(index, 1);
    }
    for (let index = barricades.length - 1; index >= 0; index -= 1) {
      if (barricades[index].blockId === blockId) barricades.splice(index, 1);
    }
  }

  /** Want the police after all, as a scene setter (screenshots, scripted heat). */
  function spawnPursuit(player, count) {
    for (let index = 0; index < count; index += 1) {
      const car = spawnCruiser(player);
      car.x = headerPursuitX(player, index);
      car.y = headerPursuitY(player, index);
    }
    siren = 1;
  }

  function headerPursuitX(player, index) {
    const ring = [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1]];
    return player.x + ring[index % ring.length][0] * (110 + index * 30);
  }

  function headerPursuitY(player, index) {
    const ring = [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1]];
    return player.y + ring[index % ring.length][1] * (110 + index * 30);
  }

  /** Aim a cruiser at a point: turn its nose and give it a speed that closes the gap. */
  function chase(car, target, dt) {
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const distance = Math.hypot(dx, dy) || 1;
    const desired = Math.atan2(dy, dx);
    let delta = desired - car.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, delta));
    // Its speed: full tilt when far, gentler when closing on a pedestrian.
    const targetSpeed = distance > 260 ? POLICE.carSpeed + wanted * 22 : Math.max(60, distance * 1.1);
    const throttle = car.speed < targetSpeed ? 1 : 0;
    const brake = car.speed > targetSpeed + 60 ? 0.6 : 0;
    stepCarPhysics(car, dt, { throttle, brake, steer: Math.max(-1, Math.min(1, delta * 2)) }, world);
    car.angle = Math.atan2(Math.sin(car.angle), Math.cos(car.angle));
    return distance;
  }

  /**
   * One fixed step. `ctx` has the player, the car the player is in (or null), and callbacks for
   * when a cruiser's round lands and when the player is arrested.
   */
  function update(dt, ctx) {
    const player = ctx.player;
    const target = player.car ? player.car : player;
    if (wanted > 0) {
      quiet = 0;
      spawnTimer -= dt;
      const alive = cars.filter((car) => !car.roadblock).length;
      if (spawnTimer <= 0 && alive < Math.min(POLICE.maxCars, wanted + 1)) {
        if (Math.hypot(player.x - target.x, player.y - target.y) < POLICE.chaseRadius) spawnCruiser(target);
        spawnTimer = 2.4 - wanted * 0.22;
      }
      // At full heat the department stops chasing and starts blocking:
      // a roadblock across the road the player is running toward.
      if (wanted >= POLICE.roadblockMinWanted) {
        roadblockTimer -= dt;
        const hasBlock = cars.some((car) => car.roadblock);
        if (roadblockTimer <= 0 && !hasBlock) {
          const heading = player.car ? player.car.angle : player.aim;
          const ahead = world.nearestRoadPoint(target.x + Math.cos(heading) * 560, target.y + Math.sin(heading) * 560, 0, 1);
          spawnRoadblockAt(ahead.x, ahead.y, ahead.axis === 'x' ? 0 : Math.PI / 2);
          roadblockTimer = POLICE.roadblockCooldown;
        }
      }
    } else {
      quiet += dt;
    }

    // Out of sight (far away and driving) lets the heat bleed off; so does a quiet spell.
    if (wanted > 0 && quiet > POLICE.heatDecayDelay) {
      wanted = Math.max(0, wanted - POLICE.heatDecayRate * dt * (player.car ? 2.2 : 1));
    }
    if (wanted === 0 && cars.length > 0) {
      for (let index = cars.length - 1; index >= 0; index -= 1) {
        const car = cars[index];
        if (Math.hypot(car.x - target.x, car.y - target.y) > 2400) cars.splice(index, 1);
      }
    }

    let closest = Infinity;
    for (const car of cars) {
      car.sirenPhase += dt * 9;
      if (car.roadblock) {
        // A block holds its ground until the player is long past it.
        const blockDist = Math.hypot(car.x - target.x, car.y - target.y);
        closest = Math.min(closest, blockDist);
        if (blockDist > POLICE.roadblockRange) retireRoadblock(car.blockId);
        continue;
      }
      const distance = chase(car, target, dt);
      closest = Math.min(closest, distance);
      // A cruiser close behind fires at a player on foot.
      car.fireCooldown = Math.max(0, (car.fireCooldown ?? 0) - dt);
      if (!player.car && distance < 420 && wanted >= 1 && car.fireCooldown <= 0) {
        const angle = Math.atan2(player.y - car.y, player.x - car.x);
        if (ctx.onPoliceShot) ctx.onPoliceShot(car, angle);
        car.fireCooldown = 1.15 - wanted * 0.1;
      }
      // Ramming: a cruiser that runs into the player's car costs paint both ways.
      if (player.car && distance < 48 && Math.abs(car.speed) > 120) {
        car.speed *= 0.4;
        if (ctx.onRam) ctx.onRam(car);
      }
    }

    // Busted: held near a cruiser while on foot for a heartbeat.
    if (!player.car && wanted > 0 && closest < POLICE.bustRadius) {
      bust += dt;
      if (bust >= POLICE.bustTime) {
        busted = true;
        bust = 0;
      }
    } else {
      bust = Math.max(0, bust - dt * 1.6);
    }
    if (player.health <= 0) wasted = true;

    siren = Math.max(0, siren - dt * 0.4);
    return { closest, bust: Math.min(1, bust / POLICE.bustTime) };
  }

  /** Take the arrest or the wipeout once: the main loop looks at these and clears them. */
  function takeBusted() {
    const value = busted;
    busted = false;
    return value;
  }

  function takeWasted() {
    const value = wasted;
    wasted = false;
    return value;
  }

  function reset() {
    cars.length = 0;
    barricades.length = 0;
    roadblockTimer = 0;
    wanted = 0;
    quiet = 0;
    bust = 0;
    busted = false;
    wasted = false;
  }

  return {
    cars,
    barricades,
    get wanted() {
      return Math.ceil(wanted);
    },
    get heat() {
      return wanted;
    },
    get bustProgress() {
      return Math.min(1, bust / POLICE.bustTime);
    },
    commitCrime,
    setWanted,
    clearWanted,
    spawnPursuit,
    spawnRoadblockAt,
    retire,
    update,
    takeBusted,
    takeWasted,
    reset,
  };
}
