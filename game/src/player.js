// Mara Voss on foot: a low-poly figure with a swinging walk cycle, third-person
// movement tied to the camera, and the carjacking interaction — walk up to any
// parked or crawling car, press F, and it is yours (its driver may disagree).

import * as THREE from 'three';
import { clamp, dist2d } from './random.js';

export function createPlayer(scene) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2b183, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x20131f, roughness: 0.85 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.24), jacket);
  torso.position.y = 1.12; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.12, 0.29), hair);
  hairTop.position.y = 1.78; g.add(hairTop);
  const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.1), hair);
  ponytail.position.set(0, 1.55, -0.17); ponytail.rotation.x = 0.25; g.add(ponytail);
  const limbs = {};
  for (const [name, x, y, mat, h] of [
    ['armL', -0.31, 1.18, jacket, 0.58], ['armR', 0.31, 1.18, jacket, 0.58],
    ['legL', -0.12, 0.5, pants, 0.78], ['legR', 0.12, 0.5, pants, 0.78]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, name.startsWith('leg') ? 0.86 : 1.4, 0);
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.13, h, 0.15), mat);
    limb.position.y = -h / 2; limb.castShadow = true; pivot.add(limb); g.add(pivot);
    limbs[name] = pivot;
  }
  scene.add(g);
  return {
    mesh: g, limbs, heading: 0, walkPhase: 0, aiming: false,
    setPos(x, z, heading) { g.position.set(x, 0, z); this.heading = heading; g.rotation.y = heading; },
  };
}

// WASD relative to the camera heading; Shift runs. Returns current speed.
export function stepOnFoot(player, input, dt, world, camHeading) {
  let mx = 0, mz = 0;
  const fx = Math.sin(camHeading), fz = Math.cos(camHeading);
  const rx = Math.cos(camHeading), rz = -Math.sin(camHeading);
  if (input.forward) { mx += fx; mz += fz; }
  if (input.back) { mx -= fx; mz -= fz; }
  if (input.right) { mx += rx; mz += rz; }
  if (input.left) { mx -= rx; mz -= rz; }
  const len = Math.hypot(mx, mz);
  const speed = input.run ? 7.4 : 4.6;
  if (len > 0.01) {
    mx /= len; mz /= len;
    const p = player.mesh.position;
    const fixed = world.collide(p.x + mx * speed * dt, p.z + mz * speed * dt, 0.45);
    p.x = fixed.x; p.z = fixed.z;
    if (!player.aiming) player.heading = Math.atan2(mx, mz);
    player.walkPhase += dt * (input.run ? 11 : 8);
  } else {
    player.walkPhase *= 0.8;
  }
  player.mesh.rotation.y = player.heading;
  const swing = Math.sin(player.walkPhase) * (len > 0.01 ? 0.55 : 0);
  player.limbs.legL.rotation.x = swing; player.limbs.legR.rotation.x = -swing;
  if (player.aiming) {
    player.limbs.armR.rotation.x = -1.35; player.limbs.armL.rotation.x = -1.1;
  } else {
    player.limbs.armL.rotation.x = -swing * 0.8; player.limbs.armR.rotation.x = swing * 0.8;
  }
  return len > 0.01 ? speed : 0;
}

// The closest car Mara can take or enter, and what the prompt should say.
export function nearestCar(player, cars, ownCar) {
  const p = player.mesh.position;
  let best = null, bd = 3.4;
  for (const car of cars) {
    if (car.dead || !car.mesh) continue;
    const d = dist2d(p.x, p.z, car.mesh.position.x, car.mesh.position.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (ownCar && !ownCar.dead) {
    const d = dist2d(p.x, p.z, ownCar.mesh.position.x, ownCar.mesh.position.z);
    if (d < bd) { bd = d; best = ownCar; }
  }
  if (!best) return null;
  const label = best === ownCar ? `F — GET IN THE ${best.model}` :
    best.driver === 'parked' ? `F — TAKE THE ${best.model}` :
    `F — PULL THE DRIVER OUT OF THE ${best.model}`;
  return { car: best, label, isOwn: best === ownCar };
}

export function clampToCity(player) {
  const p = player.mesh.position;
  p.x = clamp(p.x, -232, 336); p.z = clamp(p.z, -232, 232);
}
