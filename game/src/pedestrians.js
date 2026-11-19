// Palm Shores — pedestrians.js
// People on the sidewalks: they stroll between corners, chat in pairs,
// and sprint away from gunfire, speeding cars and police chases.

import * as THREE from 'three';
import { WORLD } from './config.js';

const SHIRT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xc084fc, 0x94a3b8, 0xf97316, 0x38bdf8, 0xf472b6];

function makePerson(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: rng.pick(SHIRT_COLORS), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac][rng.int(0, 3)], roughness: 0.8 });
  const legs = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), shirt);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), skin);
  head.position.y = 1.62;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), legs);
  legL.position.set(-0.13, 0.33, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), shirt);
  armL.position.set(-0.32, 1.05, 0);
  const armR = armL.clone();
  armR.position.x = 0.32;
  g.add(body, head, legL, legR, armL, armR);
  g.userData.ped = { legL, legR, armL, armR, walkPhase: rng.range(0, 6) };
  return g;
}

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    this._spawn(26);
  }

  _spawn(n) {
    for (let i = 0; i < n; i++) {
      const g = makePerson(this.rng);
      const road = this.rng.pick(WORLD.roads);
      const along = this.rng.range(-110, 110);
      const side = this.rng.chance(0.5) ? 1 : -1;
      if (this.rng.chance(0.5)) g.position.set(road + side * 8.4, 0, along);
      else g.position.set(along, 0, road + side * 8.4);
      g.rotation.y = this.rng.range(0, Math.PI * 2);
      this.scene.add(g);
      this.peds.push({
        group: g,
        speed: this.rng.range(1.2, 2.2),
        target: this._newTarget(g.position),
        fleeing: 0,
        dead: false,
      });
    }
  }

  _newTarget(pos) {
    const road = this.rng.pick(WORLD.roads);
    const along = this.rng.range(-110, 110);
    const side = this.rng.chance(0.5) ? 1 : -1;
    if (this.rng.chance(0.5)) return new THREE.Vector3(road + side * 8.4, 0, along);
    return new THREE.Vector3(along, 0, road + side * 8.4);
  }

  // Danger at (x,z): everyone nearby starts running away.
  scare(x, z, radius = 18) {
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.group.position.x - x, p.group.position.z - z);
      if (d < radius) {
        p.fleeing = 3 + (radius - d) * 0.1;
        const away = new THREE.Vector3(p.group.position.x - x, 0, p.group.position.z - z).normalize();
        p.target = p.group.position.clone().add(away.multiplyScalar(30));
      }
    }
  }

  update(dt) {
    for (const p of this.peds) {
      if (p.dead) continue;
      const g = p.group;
      const to = new THREE.Vector3().subVectors(p.target, g.position);
      to.y = 0;
      const dist = to.length();
      if (dist < 1.5) { p.target = this._newTarget(g.position); continue; }
      const speed = p.fleeing > 0 ? p.speed * 3.2 : p.speed;
      p.fleeing = Math.max(0, p.fleeing - dt);
      to.normalize();
      g.position.addScaledVector(to, speed * dt);
      const targetYaw = Math.atan2(to.x, to.z);
      let dy = targetYaw - g.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      g.rotation.y += dy * Math.min(1, 8 * dt);
      // Keep them on the sidewalk strip: steer back if they drift onto a road.
      const pd = g.userData.ped;
      pd.walkPhase += dt * speed * 4;
      const swing = Math.sin(pd.walkPhase) * 0.5;
      pd.legL.rotation.x = swing;
      pd.legR.rotation.x = -swing;
      pd.armL.rotation.x = -swing * 0.7;
      pd.armR.rotation.x = swing * 0.7;
      // Clamp inside the city.
      g.position.x = THREE.MathUtils.clamp(g.position.x, -120, 120);
      g.position.z = THREE.MathUtils.clamp(g.position.z, -120, 128);
    }
  }

  // Nearest living pedestrian within radius — used by combat hit tests.
  nearest(pos, radius = 3) {
    let best = null, bd = radius;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.group.position.x - pos.x, p.group.position.z - pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  kill(ped) {
    ped.dead = true;
    ped.group.rotation.x = -Math.PI / 2; // fall flat
    ped.group.position.y = 0.3;
  }
}
