// Palm Shores — combat.js
// One job: the pistol — aim with the mouse, click to shoot, muzzle flash,
// raycast hits on pedestrians and cars, ammo and reload.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createCombat(G) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0 }),
  );
  G.scene.add(flash);
  const combat = { cooldown: 0, flash, flashTimer: 0 };
  G.combat = combat;
  return combat;
}

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();

export function updateCombat(G, dt) {
  const c = G.combat;
  c.cooldown -= dt;
  if (c.flashTimer > 0) {
    c.flashTimer -= dt;
    c.flash.material.opacity = Math.max(0, c.flashTimer * 6);
  }
  const { input, player } = G;
  if (player.car || G.mode !== 'play') return;
  if (input.wasPressed('reload')) {
    player.ammo = PLAYER.pistolAmmo;
    G.showMessage('Pistol diisi ulang.');
  }
  const wantShoot = input.mouseDown() || input.wasPressed('shoot');
  if (!wantShoot || c.cooldown > 0) return;
  if (player.ammo <= 0) {
    G.showMessage('Ammo habis — tekan R untuk isi ulang.');
    c.cooldown = 0.35;
    return;
  }
  c.cooldown = PLAYER.pistolRate;
  player.ammo -= 1;
  G.audio.shot();
  G.alarm = 2.5; // a gunshot is heard across the block
  // Muzzle flash at the gun hand, in front of the player.
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  c.flash.position.set(player.pos.x + fx * 0.9, 1.35, player.pos.z + fz * 0.9);
  c.flash.material.opacity = 1;
  c.flashTimer = 0.09;
  // Shoot along the camera aim: centre of the screen.
  G.camera.getWorldDirection(_dir);
  _ray.set(new THREE.Vector3(player.pos.x, 1.4, player.pos.z), _dir);
  _ray.far = PLAYER.pistolRange;
  // Hit a pedestrian?
  let bestPed = null, bestDist = Infinity;
  for (const ped of G.peds) {
    const toPed = new THREE.Vector3(ped.pos.x - player.pos.x, 1.2, ped.pos.z - player.pos.z);
    const dist = toPed.length();
    if (dist > PLAYER.pistolRange) continue;
    toPed.normalize();
    if (toPed.dot(_dir) > 0.985 && dist < bestDist) { bestDist = dist; bestPed = ped; }
  }
  if (bestPed) {
    bestPed.health -= PLAYER.pistolDamage;
    bestPed.fleeing = 3;
    G.addWanted(1, 'Menembak di jalanan');
    if (bestPed.health <= 0) G.killPed(bestPed, 'tembakan');
    return;
  }
  // Hit a car? Damage it and scare the driver out of the way.
  for (const car of G.cars) {
    const toCar = new THREE.Vector3(car.pos.x - player.pos.x, 0.8, car.pos.z - player.pos.z);
    const dist = toCar.length();
    if (dist > PLAYER.pistolRange) continue;
    toCar.normalize();
    if (toCar.dot(_dir) > 0.98) {
      car.health -= PLAYER.pistolDamage;
      G.addWanted(1, 'Menembak mobil');
      if (car.health <= 0 && car.traffic) {
        car.traffic = false; car.targetSpeed = 0; car.speed = 0;
        G.showMessage('Mobil itu mogok.');
      }
      return;
    }
  }
}
