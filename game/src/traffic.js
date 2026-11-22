// Palm Shores — traffic.js
// One job: AI cars driving the road grid + parked cars, with simple following
// behaviour (slow down for the car ahead, wrap around the city edge).
import { TRAFFIC } from './config.js';
import { createCar } from './vehicles.js';
import { nearestStreetCoord } from './city.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'muscle'];

export function spawnTraffic(G) {
  const { rng } = G;
  for (let i = 0; i < TRAFFIC.cars; i++) {
    const horizontal = rng.chance(0.5);
    const street = G.city.streets[Math.floor(rng.next() * G.city.streets.length)];
    const along = rng.range(-170, 170);
    const dir = rng.chance(0.5) ? 1 : -1;
    const typeKey = TRAFFIC_TYPES[Math.floor(rng.next() * TRAFFIC_TYPES.length)];
    const car = createCar(G, typeKey,
      horizontal ? along : street + (dir > 0 ? 2.4 : -2.4),
      horizontal ? street + (dir > 0 ? 2.4 : -2.4) : along,
      horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      { traffic: true, randomColor: true, routeAxis: horizontal ? 'x' : 'z', routeCoord: street, direction: dir, targetSpeed: rng.range(8, 14) });
    car.driver = 'ai';
  }
  // Parked cars along the kerb — these are the ones you steal.
  for (let i = 0; i < TRAFFIC.parked; i++) {
    const horizontal = rng.chance(0.5);
    const street = G.city.streets[Math.floor(rng.next() * G.city.streets.length)];
    const along = rng.range(-160, 160);
    const typeKey = TRAFFIC_TYPES[Math.floor(rng.next() * TRAFFIC_TYPES.length)];
    createCar(G, typeKey,
      horizontal ? along : street + 6.5,
      horizontal ? street + 6.5 : along,
      horizontal ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      { parked: true, randomColor: true });
  }
}

function carAhead(G, car, dist) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  for (const other of G.cars) {
    if (other === car || other.parked) continue;
    const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
    const forward = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (forward > 0 && forward < dist && side < 2.6) return true;
  }
  return false;
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic || car.driver === 'player') continue;
    // Chase behaviour is owned by police.js; traffic just cruises its street.
    const blocked = carAhead(G, car, 9);
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += Math.max(-14, Math.min(8, (want - car.speed))) * dt;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    // Wrap around the city edge so traffic never runs out.
    if (car.routeAxis === 'x' && Math.abs(car.pos.x) > 185) car.pos.x = -Math.sign(car.pos.x) * 185;
    if (car.routeAxis === 'z' && Math.abs(car.pos.z) > 172) car.pos.z = -Math.sign(car.pos.z) * 172;
    // Keep exactly on its street line (no drifting off the road).
    if (car.routeAxis === 'x') car.pos.z = car.routeCoord + (car.direction > 0 ? 2.4 : -2.4);
    else car.pos.x = car.routeCoord + (car.direction > 0 ? 2.4 : -2.4);
    // Wheels spin with speed.
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
}

/** A street position the player can be dropped at (used by missions). */
export function randomStreetPoint(G) {
  const s = G.city.streets[Math.floor(G.rng.next() * G.city.streets.length)];
  return G.rng.chance(0.5)
    ? [G.rng.range(-160, 160), s]
    : [s, G.rng.range(-160, 160)];
}
export { nearestStreetCoord };
