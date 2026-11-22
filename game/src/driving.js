// Palm Shores — driving.js
// One job: car handling — acceleration, steering that bites harder at speed,
// braking, collisions with buildings and other cars, and the chase camera.
export function updateDriving(G, dt) {
  const { input, player } = G;
  const car = player.car;
  if (!car) return;
  const t = car.type;
  const mouse = input.consumeMouse();
  G.camYaw -= mouse.dx * 0.0032;
  G.camPitch = Math.max(0.05, Math.min(0.6, G.camPitch + mouse.dy * 0.0022));

  let throttle = 0;
  if (input.is('forward')) throttle = 1;
  if (input.is('back')) throttle = car.speed > 0.5 ? -1 : -0.55; // brake, then reverse
  // Steering: full lock at low speed, gentler at top speed so it stays drivable.
  const steerTarget = (input.is('left') ? 1 : 0) - (input.is('right') ? 1 : 0);
  const speedFactor = 1 / (1 + Math.abs(car.speed) * 0.045);
  car.steer += (steerTarget * t.grip * 0.55 * speedFactor - car.steer) * Math.min(1, dt * 8);
  car.speed += throttle * t.accel * dt;
  car.speed -= car.speed * 0.35 * dt; // drag + rolling resistance
  if (input.is('back') && car.speed < 0) car.speed = Math.max(car.speed, -t.topSpeed * 0.4);
  car.speed = Math.max(-t.topSpeed * 0.45, Math.min(t.topSpeed, car.speed));
  if (Math.abs(car.speed) < 0.08 && throttle === 0) car.speed = 0;

  car.heading += car.steer * (car.speed / t.topSpeed) * dt * 2.4 * Math.sign(car.speed || 1);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const nx = car.pos.x + fx * car.speed * dt;
  const nz = car.pos.z + fz * car.speed * dt;
  // Building collision: slide along the wall instead of stopping dead.
  if (!G.hitsBuilding(nx, car.pos.z)) car.pos.x = nx;
  else if (Math.abs(car.speed) > 6) { G.crashCar(car); }
  if (!G.hitsBuilding(car.pos.x, nz)) car.pos.z = nz;
  else if (Math.abs(car.speed) > 6) { G.crashCar(car); }
  car.pos.x = Math.max(-195, Math.min(195, car.pos.x));
  car.pos.z = Math.max(-195, Math.min(184, car.pos.z));
  car.mesh.rotation.y = car.heading;
  // Body roll into corners + a little bounce sells the speed.
  car.mesh.rotation.z = -car.steer * 0.05 * Math.sign(car.speed || 1);
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) {
    w.rotation.x += spin;
    w.rotation.y = 0;
  }
  // Ram other cars and pedestrians: damage, noise, and a wanted bump.
  // (Staged screenshot scenes skip police contact so the chase keeps rolling.)
  for (const other of G.cars) {
    if (other === car || other.parked) continue;
    if (G.shot && other.police) continue;
    const d = Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z);
    if (d < 3.4 && Math.abs(car.speed) > 4) {
      other.speed = Math.max(other.speed, car.speed * 0.55);
      other.traffic = false; // knocked loose from its route
      car.speed *= 0.55;
      G.crashCar(car, true);
    }
  }
  for (const ped of G.peds) {
    const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
    if (d < 2.2 && Math.abs(car.speed) > 3) {
      ped.fleeing = 3;
      ped.health -= 60;
      if (ped.health <= 0) G.killPed(ped, 'tabrakan');
      else G.addWanted(1, 'Menabrak pejalan kaki');
      G.audio.thud();
    }
  }
  if (input.wasPressed('horn')) G.audio.horn();
  G.audio.setEngine(Math.abs(car.speed) / car.type.topSpeed, true);
}

/** Chase camera: behind the car, looking slightly ahead of it. */
export function drivingCamera(G, dt) {
  const car = G.player.car;
  const back = 11 + Math.abs(car.speed) * 0.09;
  const up = 4.6 + G.camPitch * 4;
  const tx = car.pos.x - Math.sin(car.heading) * back;
  const tz = car.pos.z - Math.cos(car.heading) * back;
  G.camera.position.x += (tx - G.camera.position.x) * Math.min(1, dt * 5);
  G.camera.position.y += (up - G.camera.position.y) * Math.min(1, dt * 5);
  G.camera.position.z += (tz - G.camera.position.z) * Math.min(1, dt * 5);
  G.camera.lookAt(car.pos.x + Math.sin(car.heading) * 6, 1.6, car.pos.z + Math.cos(car.heading) * 6);
}

/** Third-person camera on foot: orbit around the player. */
export function footCamera(G, dt) {
  const p = G.player.pos;
  const dist = 8.5;
  const tx = p.x - Math.sin(G.camYaw) * dist * Math.cos(G.camPitch);
  const tz = p.z - Math.cos(G.camYaw) * dist * Math.cos(G.camPitch);
  const ty = 3.2 + Math.sin(G.camPitch) * dist;
  G.camera.position.x += (tx - G.camera.position.x) * Math.min(1, dt * 10);
  G.camera.position.y += (ty - G.camera.position.y) * Math.min(1, dt * 10);
  G.camera.position.z += (tz - G.camera.position.z) * Math.min(1, dt * 10);
  G.camera.lookAt(p.x, 1.6, p.z);
}
