// Palm Shores — combat.js
// Pistol combat: mouse-aimed raycast shots, muzzle flash, ammo, hit
// reactions (pedestrians flee, guards fight back), and the armed dock
// guards used by the docks shootout mission.

import * as THREE from 'three';
import { PLAYER_TUNING } from './config.js';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.cooldown = 0;
    this.flash = new THREE.PointLight(0xffc36b, 0, 18, 1.8);
    scene.add(this.flash);
    this.flashUntil = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = PLAYER_TUNING.pistolRange;
    // Tracer line pool (one reusable line).
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0,
    }));
    scene.add(this.tracer);
    this.tracerUntil = 0;
  }

  update(dt, now) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (now > this.flashUntil) this.flash.intensity = 0;
    if (now > this.tracerUntil) this.tracer.material.opacity = 0;
  }

  canShoot() { return this.cooldown <= 0; }

  // Fire from `origin` along `dir`. `targets` is a list of {group, radius,
  // onHit(damage, point)} hit-test entries. Returns the hit entry or null.
  shoot(now, origin, dir, targets) {
    if (this.cooldown > 0) return null;
    this.cooldown = PLAYER_TUNING.pistolRate;
    this.flash.position.copy(origin).addScaledVector(dir, 1.2);
    this.flash.intensity = 60;
    this.flashUntil = now + 0.07;

    // Raycast against target meshes (sphere approx per target).
    this.raycaster.set(origin, dir);
    let best = null, bestDist = PLAYER_TUNING.pistolRange;
    for (const t of targets) {
      if (t.dead) continue;
      const c = t.group.position.clone(); c.y += 1.1;
      const toC = new THREE.Vector3().subVectors(c, origin);
      const along = toC.dot(dir);
      if (along < 0 || along > bestDist) continue;
      const perp = toC.clone().addScaledVector(dir, -along).length();
      if (perp < (t.radius || 1.0)) { best = t; bestDist = along; }
    }
    const end = origin.clone().addScaledVector(dir, best ? bestDist : PLAYER_TUNING.pistolRange);
    this.tracer.geometry.setFromPoints([origin.clone(), end]);
    this.tracer.material.opacity = 0.9;
    this.tracerUntil = now + 0.08;
    if (best) best.onHit(PLAYER_TUNING.pistolDamage, end);
    return best;
  }
}

// An armed dock guard: stands his ground, shoots at the player with
// inaccuracy, falls when his health runs out.
export class Guard {
  constructor(scene, x, z, rng) {
    this.scene = scene;
    this.group = new THREE.Group();
    const vest = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), vest);
    body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), skin);
    head.position.y = 1.66;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.8 }));
    gun.position.set(0.2, 1.15, 0.4);
    this.group.add(body, head, gun);
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.health = 100;
    this.dead = false;
    this.radius = 1.0;
    this.shootTimer = rng.range(0.8, 2.0);
    this.rng = rng;
  }

  update(dt, playerPos, combat, onShotAtPlayer) {
    if (this.dead) return;
    const d = Math.hypot(this.group.position.x - playerPos.x, this.group.position.z - playerPos.z);
    this.group.lookAt(playerPos.x, 0, playerPos.z);
    this.shootTimer -= dt;
    if (d < 42 && this.shootTimer <= 0) {
      this.shootTimer = this.rng.range(1.1, 2.2);
      // Inaccurate: 45% chance to actually land a hit.
      if (this.rng.chance(0.45)) onShotAtPlayer(8 + this.rng.range(0, 8));
      // Muzzle flash at the guard.
      const p = this.group.position.clone(); p.y = 1.3;
      combat.flash.position.copy(p);
      combat.flash.intensity = 40;
      combat.flashUntil = performance.now() / 1000 + 0.06;
    }
  }

  onHit(damage) {
    this.health -= damage;
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.3;
    }
  }

  remove() { this.scene.remove(this.group); }
}
