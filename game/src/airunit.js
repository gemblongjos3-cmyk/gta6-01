// Palm Shores — airunit.js
// The police helicopter: appears at 4+ stars, circles above the player
// with a visible searchlight cone that tracks them and keeps the heat
// from decaying while it watches.

import * as THREE from 'three';
import { WANTED } from './config.js';

function makeHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), bodyMat);
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x0e1626, roughness: 0.1, metalness: 0.9 }));
  glass.position.set(0, 0.1, 2.0);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), bodyMat);
  tail.position.set(0, 0.3, -4.0);
  g.add(tail);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), rotorMat);
  rotor.position.y = 1.0;
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), rotorMat);
  tailRotor.position.set(0.3, 0.4, -5.8);
  g.add(tailRotor);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.7 });
  for (const sx of [-0.8, 0.8]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.0), skidMat);
    skid.position.set(sx, -1.0, 0.4);
    g.add(skid);
  }
  // Searchlight: a real spotlight + a fake translucent cone.
  const spot = new THREE.SpotLight(0xfff2c0, 900, 90, 0.28, 0.5, 1.2);
  spot.position.set(0, -0.8, 0.5);
  g.add(spot);
  g.add(spot.target);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.10,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  cone.position.set(0, -17.5, 0.5);
  cone.rotation.x = Math.PI; // apex up at the heli
  g.add(cone);
  g.userData.heli = { rotor, spot, cone };
  return g;
}

export class AirUnit {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.angle = 0;
    this.active = false;
  }

  update(dt, now, playerPos, stars) {
    const want = stars >= WANTED.heliAtStars;
    if (want && !this.active) {
      this.group = makeHeli();
      this.group.position.set(playerPos.x + 20, 42, playerPos.z);
      this.scene.add(this.group);
      this.active = true;
    } else if (!want && this.active) {
      this.scene.remove(this.group);
      this.group = null;
      this.active = false;
    }
    if (!this.active) return;
    this.angle += dt * 0.45;
    const r = 24;
    this.group.position.set(
      playerPos.x + Math.cos(this.angle) * r,
      42 + Math.sin(now * 0.5) * 1.5,
      playerPos.z + Math.sin(this.angle) * r,
    );
    this.group.rotation.y = Math.atan2(playerPos.x - this.group.position.x, playerPos.z - this.group.position.z);
    const heli = this.group.userData.heli;
    heli.rotor.rotation.y += dt * 22;
    // Searchlight tracks the player.
    heli.spot.target.position.set(
      playerPos.x - this.group.position.x,
      -this.group.position.y,
      playerPos.z - this.group.position.z,
    );
    heli.spot.target.updateMatrixWorld();
  }

  // While the heli watches, the player counts as "seen" for heat decay.
  watching() { return this.active; }
}
