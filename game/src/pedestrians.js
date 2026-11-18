// People on the pavements: they stroll their block, stop to look at the sea or a shop window, and
// when a shot rings out or a car ploughs through them they PANIC and run, arms up, away from it.
// Each one is a tiny state machine: walk, pause, flee; nothing touches the drawing code.
import { COAST, PEDESTRIAN } from './config.js';

const SHIRTS = ['#e4694f', '#4a8fc2', '#e8c05a', '#7cba6a', '#b58ad0', '#e08aaf', '#d5d0c4', '#3f4a5c'];
const SKIN = ['#8a5a3c', '#c08a63', '#e0b48c', '#6b4230', '#f0cfae'];

export function createPedestrians(world, random) {
  const people = [];

  function spawnOne() {
    const point = world.clearPavementPoint();
    const angle = random() * Math.PI * 2;
    const person = {
      x: point.x,
      y: point.y,
      angle,
      speed: 0,
      state: 'walk',
      timer: random.range(1, 5),
      panic: 0,
      fleeX: 0,
      fleeY: 0,
      dead: false,
      down: 0,
      shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
      skin: SKIN[Math.floor(random() * SKIN.length)],
      hat: random.chance(0.2),
      walkPhase: random() * Math.PI * 2,
      hurt: 0,
    };
    people.push(person);
    return person;
  }

  for (let index = 0; index < PEDESTRIAN.count; index += 1) spawnOne();

  /** Make everyone within `radius` of (x, y) run away from it for a while. */
  function panicNear(x, y, radius, seconds = PEDESTRIAN.panicTime) {
    let count = 0;
    for (const person of people) {
      if (person.dead) continue;
      const dx = person.x - x;
      const dy = person.y - y;
      if (Math.hypot(dx, dy) > radius) continue;
      const length = Math.hypot(dx, dy) || 1;
      person.state = 'flee';
      person.panic = seconds + random() * 1.5;
      person.fleeX = dx / length;
      person.fleeY = dy / length;
      count += 1;
    }
    return count;
  }

  /** A person takes a hit: they fall, and everyone around them scatters. */
  function fall(person) {
    if (person.dead) return false;
    person.dead = true;
    person.state = 'down';
    person.down = 0;
    panicNear(person.x, person.y, 260);
    return true;
  }

  function update(dt) {
    for (const person of people) {
      if (person.dead) {
        person.down = Math.min(1, person.down + dt * 3);
        continue;
      }
      person.hurt = Math.max(0, person.hurt - dt);
      person.timer -= dt;
      if (person.state === 'flee') {
        person.panic -= dt;
        person.speed = PEDESTRIAN.runSpeed;
        person.angle = Math.atan2(person.fleeY, person.fleeX);
        if (person.panic <= 0) {
          person.state = 'pause';
          person.timer = random.range(1.5, 3.5);
        }
      } else if (person.state === 'pause') {
        person.speed = 0;
        if (person.timer <= 0) {
          person.state = 'walk';
          person.angle = random() * Math.PI * 2;
          person.timer = random.range(2, 6);
        }
      } else {
        // Walk: change direction now and then, and slow right down after a fright.
        person.speed = PEDESTRIAN.walkSpeed * (person.panic > -8 ? 0.75 : 1);
        if (person.timer <= 0) {
          person.timer = random.range(1.5, 4);
          if (random.chance(0.3)) {
            person.state = 'pause';
            person.speed = 0;
          } else {
            person.angle += random.range(-1.6, 1.6);
          }
        }
        // Steer back toward the pavement when they wander into the road or the sea.
        if (world.isOnRoad(person.x, person.y, 0) || person.y > COAST.beachTop) {
          const toward = world.isOnRoad(person.x, person.y, 0) ? 'kerb' : 'beach';
          if (toward === 'kerb') {
            const spot = world.nearestRoadPoint(person.x, person.y, 90, 1);
            person.angle = Math.atan2(spot.y - person.y, spot.x - person.x) + Math.PI;
          } else {
            person.angle = random.range(-Math.PI, 0);
          }
          person.state = 'walk';
        }
      }

      const stepX = Math.cos(person.angle) * person.speed * dt;
      const stepY = Math.sin(person.angle) * person.speed * dt;
      const body = { x: person.x + stepX, y: person.y + stepY };
      const blocked = world.resolveCircle(body, 9);
      if (blocked) person.angle += random.range(-2.4, 2.4);
      person.x = Math.max(10, Math.min(world.width - 10, body.x));
      person.y = Math.max(10, Math.min(world.height - 10, body.y));
      person.walkPhase += person.speed * dt * 0.14;
    }
  }

  return { people, update, panicNear, fall, spawnOne };
}
