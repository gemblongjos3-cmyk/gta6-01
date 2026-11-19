// Palm Shores — collectibles.js
// Cash pickups and palm coins scattered around the city: walk or drive
// over them to collect. Collected coins persist in the save.

import * as THREE from 'three';
import { ECONOMY } from './config.js';

export class Collectibles {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.items = []; // {group, kind, value, taken}
    this.coinsCollected = 0;
    this._spawn();
  }

  _placeOnSidewalk() {
    for (let tries = 0; tries < 20; tries++) {
      const road = this.rng.pick([-92, -46, 0, 46, 92]);
      const along = this.rng.range(-108, 108);
      const side = this.rng.chance(0.5) ? 1 : -1;
      const x = this.rng.chance(0.5) ? road + side * 8.4 : along;
      const z = this.rng.chance(0.5) ? along : road + side * 8.4;
      if (!this.city.insideBuilding(x, z, 1.5)) return { x, z };
    }
    return { x: 0, z: -8 };
  }

  _spawn() {
    // Cash pickups: spinning green bills.
    for (let i = 0; i < 16; i++) {
      const p = this._placeOnSidewalk();
      const g = new THREE.Group();
      const bill = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.04, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.6, roughness: 0.5 }),
      );
      g.add(bill);
      g.position.set(p.x, 0.8, p.z);
      this.scene.add(g);
      this.items.push({ group: g, kind: 'cash', value: this.rng.pick(ECONOMY.pickupCash), taken: false });
    }
    // Palm coins: golden discs, one per district corner and along the beach.
    for (let i = 0; i < ECONOMY.collectibleCount; i++) {
      const p = i < 4
        ? { x: [-100, 100][i % 2], z: [-100, 100][Math.floor(i / 2) % 2] }
        : this._placeOnSidewalk();
      const g = new THREE.Group();
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.1, 20),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.9 }),
      );
      coin.rotation.x = Math.PI / 2;
      g.add(coin);
      g.position.set(p.x, 1.0, p.z);
      this.scene.add(g);
      this.items.push({ group: g, kind: 'coin', value: 0, taken: false });
    }
  }

  update(dt, now, pos, onCollect) {
    for (const item of this.items) {
      if (item.taken) continue;
      item.group.rotation.y += dt * 2;
      item.group.position.y = (item.kind === 'coin' ? 1.0 : 0.8) + Math.sin(now * 2 + item.group.position.x) * 0.15;
      const d = Math.hypot(item.group.position.x - pos.x, item.group.position.z - pos.z);
      if (d < 2.2) {
        item.taken = true;
        this.scene.remove(item.group);
        if (item.kind === 'coin') this.coinsCollected += 1;
        onCollect(item);
      }
    }
  }

  get coinsLeft() {
    return this.items.filter((i) => i.kind === 'coin' && !i.taken).length;
  }
}
