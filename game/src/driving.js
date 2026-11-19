// Driving: an arcade velocity model (forward thrust, lateral grip, handbrake
// drift) shared by the player's car, plus the chase camera that sells the
// speed. Collisions resolve against the city's AABBs and against other cars
// as circles; hard hits cost condition and can rattle the camera.

import * as THREE from 'three';
import { HERO_CAR } from './config.js';
import { clamp } from './random.js';
import { makeCarEntity, spinWheels } from './vehicles.js';
import { glowTexture } from './textures.js';

export function createHeroCar(scene) {
  const ent = makeCarEntity(scene, { kind: 'coupe', color: HERO_CAR.color, model: HERO_CAR.model });
  ent.driver = 'player';
  ent.vx = 0; ent.vz = 0; ent.nitro = 1;
  const beamTex = glowTexture('rgba(255,240,200,0.9)', 'rgba(255,240,200,0)');
  const coneGeo = new THREE.CylinderGeometry(1.5, 0.16, 9.5, 14, 1, true);
  coneGeo.rotateX(Math.PI / 2);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (const s of [-1, 1]) {
    const spot = new THREE.SpotLight(0xffe9b0, 240, 62, 0.55, 0.6, 1.1);
    spot.position.set(s * 0.6, 0.8, 2.1);
    spot.target.position.set(s * 0.9, 0.2, 18);
    ent.mesh.add(spot); ent.mesh.add(spot.target);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: beamTex, transparent: true, opacity: 0.8, depthWrite: false }));
    glow.position.set(s * 0.6, 0.72, 2.25); glow.scale.setScalar(1.6);
    ent.mesh.add(glow);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(s * 0.62, 0.58, 2.15 + 4.75); cone.renderOrder = 3;
    ent.mesh.add(cone);
  }
  return ent;
}

export function carSpeedKmh(ent) { return Math.abs(ent.speed) * 3.3; }
export function carGear(ent) {
  if (ent.speed < -0.4) return 'R';
  const kmh = carSpeedKmh(ent);
  return 'D' + (kmh < 28 ? 1 : kmh < 58 ? 2 : kmh < 92 ? 3 : kmh < 128 ? 4 : 5);
}

// input: {throttle -1..1, steer -1..1, handbrake, nitro}
export function stepDriving(ent, input, dt, world, others, opts = {}) {
  const tuned = opts.upgrades?.includes('engine');
  const armored = opts.upgrades?.includes('armor');
  const maxF = tuned ? 52 : 46, maxR = 10;
  const fwdX = Math.sin(ent.heading), fwdZ = Math.cos(ent.heading);
  ent.vx ??= 0; ent.vz ??= 0; ent.nitro ??= 1;
  let fSpeed = ent.vx * fwdX + ent.vz * fwdZ;
  // steering bites less as speed rises; the wheel visual follows
  const steerAuthority = 1 / (1 + Math.abs(fSpeed) * 0.05);
  ent.steer += clamp((input.steer * steerAuthority) - ent.steer, -dt * 7, dt * 7);
  if (Math.abs(fSpeed) > 0.4) {
    const dirSign = fSpeed >= 0 ? 1 : -1;
    ent.heading += ent.steer * dirSign * Math.min(Math.abs(fSpeed), 22) * dt * 0.088 * (input.handbrake ? 1.5 : 1);
  }
  const nfx = Math.sin(ent.heading), nfz = Math.cos(ent.heading);
  fSpeed = ent.vx * nfx + ent.vz * nfz;
  let latX = ent.vx - nfx * fSpeed, latZ = ent.vz - nfz * fSpeed;
  // throttle / brake / reverse
  const nitroOn = input.nitro && opts.upgrades?.includes('nitro') && ent.nitro > 0.02 && input.throttle > 0;
  if (input.throttle > 0) fSpeed += (nitroOn ? 21 : 12.5) * dt * (tuned ? 1.18 : 1);
  else if (input.throttle < 0) fSpeed += (fSpeed > 0.6 ? -26 : -8) * dt;
  if (nitroOn) ent.nitro = Math.max(0, ent.nitro - dt * 0.55); else ent.nitro = Math.min(1, ent.nitro + dt * 0.05);
  fSpeed -= fSpeed * dt * (input.handbrake ? 0.65 : 0.16); // drag
  fSpeed = clamp(fSpeed, -maxR, maxF);
  const grip = input.handbrake ? 2.0 : 9.5;
  latX -= latX * Math.min(1, dt * grip); latZ -= latZ * Math.min(1, dt * grip);
  ent.vx = nfx * fSpeed + latX; ent.vz = nfz * fSpeed + latZ;
  let nx = ent.mesh.position.x + ent.vx * dt;
  let nz = ent.mesh.position.z + ent.vz * dt;
  // building collision at nose and tail
  let crashed = 0;
  for (const off of [1.45, -1.45]) {
    const px = nx + nfx * off, pz = nz + nfz * off;
    const fixed = world.collide(px, pz, 1.05);
    const pushX = fixed.x - px, pushZ = fixed.z - pz;
    if (Math.abs(pushX) > 0.001 || Math.abs(pushZ) > 0.001) {
      nx += pushX; nz += pushZ;
      const impact = Math.abs(fSpeed);
      if (impact > 6) crashed = Math.max(crashed, impact);
      fSpeed *= 0.35; ent.vx *= 0.4; ent.vz *= 0.4;
    }
  }
  // car-to-car: soft circles, a nudge and a crunch
  for (const other of others) {
    if (other === ent || other.dead || !other.mesh) continue;
    const op = other.mesh.position;
    const dx = nx - op.x, dz = nz - op.z, d = Math.hypot(dx, dz), min = 3.4;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      nx += (dx / d) * push; nz += (dz / d) * push;
      if (other.driver === 'parked' || other.driver === 'traffic') {
        other.mesh.position.x -= (dx / d) * push; other.mesh.position.z -= (dz / d) * push;
        if (other.driver === 'traffic') { other.speed = Math.max(0, other.speed - 2); }
      }
      const impact = Math.abs(fSpeed) + Math.abs(other.speed ?? 0);
      if (impact > 7) crashed = Math.max(crashed, impact * 0.8);
      fSpeed *= 0.72; ent.vx *= 0.75; ent.vz *= 0.75;
    }
  }
  if (crashed > 0) {
    ent.condition = Math.max(4, ent.condition - (crashed - 5) * (armored ? 0.45 : 0.9));
    opts.onCrash?.(crashed);
  }
  ent.speed = fSpeed;
  ent.mesh.position.set(nx, 0, nz);
  ent.mesh.rotation.y = ent.heading;
  // body roll and pitch sell the forces
  ent.mesh.rotation.z = clamp(-ent.steer * Math.abs(fSpeed) * 0.0035, -0.05, 0.05);
  ent.mesh.rotation.x = clamp((input.throttle * -0.006) + (crashed ? 0.02 : 0), -0.03, 0.03);
  spinWheels(ent, dt);
  return { crashed, nitroOn };
}

// The chase camera: low, close, breathing with speed, FOV stretching as the
// Vespera pulls. `shake` is fed by crashes and near misses.
export function chaseCamera(camera, ent, dt, shake = 0) {
  const fx = Math.sin(ent.heading), fz = Math.cos(ent.heading);
  const speed = Math.abs(ent.speed);
  const dist = 7.4 + speed * 0.055, height = 2.7 + speed * 0.012;
  const want = new THREE.Vector3(
    ent.mesh.position.x - fx * dist + (Math.random() - 0.5) * shake,
    height + (Math.random() - 0.5) * shake * 0.5,
    ent.mesh.position.z - fz * dist + (Math.random() - 0.5) * shake,
  );
  const k = 1 - Math.exp(-dt * 5.2);
  camera.position.lerp(want, k);
  if (camera.position.y < 1.1) camera.position.y = 1.1;
  const look = new THREE.Vector3(
    ent.mesh.position.x + fx * 7, 1.25, ent.mesh.position.z + fz * 7);
  camera.lookAt(look);
  const fov = 62 + Math.min(13, speed * 0.26);
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// Free-orbit cinematic camera for the start screen and staged scenes.
export function orbitCamera(camera, center, radius, height, angle, lookUp = 1.2) {
  camera.position.set(center.x + Math.sin(angle) * radius, height, center.z + Math.cos(angle) * radius);
  camera.lookAt(center.x, lookUp, center.z);
  if (Math.abs(camera.fov - 58) > 0.1) { camera.fov = 58; camera.updateProjectionMatrix(); }
}
