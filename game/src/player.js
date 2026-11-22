// Palm Shores — player.js
// One job: the player character on foot — mesh, walk/run movement, camera
// follow, entering and exiting cars.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createPlayer(G) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), jacket);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.66;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xff2e88, roughness: 0.7 }));
  cap.position.y = 1.84;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.15, 0.36, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), jacket);
  armL.position.set(-0.4, 1.05, 0);
  const armR = armL.clone(); armR.position.x = 0.4;
  g.add(body, head, cap, legL, legR, armL, armR);
  g.position.set(0, 0, -20);
  G.scene.add(g);
  const player = {
    mesh: g, pos: g.position, heading: 0, walkPhase: 0,
    health: PLAYER.health, armor: PLAYER.armor,
    cash: 0, ammo: PLAYER.pistolAmmo, car: null,
    legL, legR, armL, armR, speed: 0,
  };
  G.player = player;
  return player;
}

/** Move on foot. Returns true when the player actually moved. */
export function updatePlayerOnFoot(G, dt) {
  const { input, player } = G;
  const mouse = input.consumeMouse();
  // Orbit the camera with the mouse; movement is relative to the camera yaw.
  G.camYaw -= mouse.dx * 0.0032;
  G.camPitch = Math.max(-0.15, Math.min(0.55, G.camPitch + mouse.dy * 0.0022));
  let ix = 0, iz = 0;
  if (input.is('forward')) iz += 1;
  if (input.is('back')) iz -= 1;
  if (input.is('left')) ix -= 1;
  if (input.is('right')) ix += 1;
  const running = input.is('run');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(ix, iz);
  let moved = false;
  if (len > 0) {
    const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw);
    const mx = (ix * cy - iz * sy) / len;
    const mz = (-ix * sy - iz * cy) / len;
    const nx = player.pos.x + mx * speed * dt;
    const nz = player.pos.z + mz * speed * dt;
    if (!G.hitsBuilding(nx, player.pos.z)) player.pos.x = nx;
    if (!G.hitsBuilding(player.pos.x, nz)) player.pos.z = nz;
    player.pos.x = Math.max(-195, Math.min(195, player.pos.x));
    player.pos.z = Math.max(-195, Math.min(186, player.pos.z));
    player.heading = Math.atan2(mx, mz);
    player.mesh.rotation.y = player.heading;
    player.walkPhase += dt * speed * 1.6;
    player.speed = speed;
    moved = true;
  } else {
    player.speed = 0;
  }
  const swing = moved ? Math.sin(player.walkPhase) * 0.5 : 0;
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  player.armL.rotation.x = -swing * 0.7;
  player.armR.rotation.x = swing * 0.7;
  return moved;
}

/** Nearest stealable car within reach, or null. */
export function nearestCar(G, maxDist = 5) {
  let best = null, bd = maxDist;
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const { player } = G;
  player.car = car;
  car.driver = 'player';
  car.parked = false;
  car.traffic = false;
  player.mesh.visible = false;
  G.audio.unlock();
  G.audio.setEngine(0, true);
  if (!car.wasOwnedByPlayer) {
    // Stealing a car in front of witnesses is a crime.
    if (G.nearbyPedCount(14) > 0 || G.nearbyPoliceCount(40) > 0) {
      G.addWanted(1, 'Mencuri mobil');
    }
    car.wasOwnedByPlayer = true;
  }
  G.showMessage(`Mengemudi: ${car.type.name} — W/S gas & rem, A/D belok, E keluar`);
}

export function exitCar(G) {
  const { player } = G;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  player.car = null;
  const side = Math.cos(car.heading);
  player.pos.set(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 2.4 * Math.sign(side || 1), 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.4);
  player.mesh.visible = true;
  player.mesh.position.copy(player.pos);
  G.audio.setEngine(0, false);
}
