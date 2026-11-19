// Palm Shores — player.js
// The player on foot: walk/run relative to the camera, a simple capsule
// look, building collision, and a third-person follow camera that the
// mouse orbits (pointer lock when playing).

import * as THREE from 'three';
import { PLAYER_TUNING } from './config.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), jacket);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skin);
  head.position.y = 1.66;
  // A backwards cap, the player's signature.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
  cap.position.y = 1.84;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
  brim.position.set(0, 1.82, -0.28);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.22), jeans);
  legL.position.set(-0.14, 0.34, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.15), jacket);
  armL.position.set(-0.35, 1.05, 0);
  const armR = armL.clone(); armR.position.x = 0.35;
  g.add(body, head, cap, brim, legL, legR, armL, armR);
  g.userData.parts = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene, city) {
    this.city = city;
    this.group = makePlayerMesh();
    this.group.position.set(0, 0, -20);
    scene.add(this.group);
    this.pos = this.group.position; // alias: Vector3
    this.yaw = Math.PI;             // facing north (+z is south on our map)
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 7;
    this.health = PLAYER_TUNING.health;
    this.armor = PLAYER_TUNING.armor;
    this.ammo = PLAYER_TUNING.pistolAmmo;
    this.walkPhase = 0;
    this.moving = false;
    this.speed = 0;
  }

  reset(x = 0, z = -20) {
    this.pos.set(x, 0, z);
    this.yaw = Math.PI;
    this.camYaw = Math.PI;
    this.health = PLAYER_TUNING.health;
    this.armor = PLAYER_TUNING.armor;
    this.ammo = PLAYER_TUNING.pistolAmmo;
    this.group.visible = true;
  }

  takeDamage(amount) {
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.6);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health = Math.max(0, this.health - rest);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(PLAYER_TUNING.health, this.health + amount);
  }

  update(dt, input, camera) {
    // Mouse orbits the follow camera.
    this.camYaw -= input.mouseDX * 0.0032;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + input.mouseDY * 0.0024, 0.08, 1.1);

    const axes = input.moveAxes();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? PLAYER_TUNING.runSpeed : PLAYER_TUNING.walkSpeed;
    const forward = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = new THREE.Vector3()
      .addScaledVector(forward, axes.y)
      .addScaledVector(right, axes.x);
    this.moving = move.lengthSq() > 0.001;
    if (this.moving) {
      move.normalize();
      this.speed = speed;
      const nx = this.pos.x + move.x * speed * dt;
      const nz = this.pos.z + move.z * speed * dt;
      const fixed = this.city.collide(nx, nz, 0.6);
      this.pos.x = THREE.MathUtils.clamp(fixed.x, -124, 124);
      this.pos.z = THREE.MathUtils.clamp(fixed.z, -124, 138);
      this.yaw = Math.atan2(move.x, move.z);
      this.group.rotation.y = this.yaw;
      this.walkPhase += dt * speed * 1.6;
    } else {
      this.speed = 0;
    }
    const parts = this.group.userData.parts;
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.6 : 0;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.8;
    parts.armR.rotation.x = swing * 0.8;

    // Follow camera: behind the camera yaw, above the player.
    const cx = this.pos.x + Math.sin(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cz = this.pos.z + Math.cos(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cy = 2 + Math.sin(this.camPitch) * this.camDist;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 10));
    camera.lookAt(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }

  // Aim direction from the camera (used by combat while on foot).
  aimDirection(camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir;
  }
}
