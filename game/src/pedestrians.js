// Pedestrians: evening crowds walking the block perimeters of Palm Shores.
// They stroll, they chat in pairs, and they scatter when a car comes at them
// too fast or a shot cracks out — the city has to feel inhabited to steal.

import * as THREE from 'three';
import { rngPick, rngRange, dist2d } from './random.js';

const COATS = [0xff8c42, 0x7fd4c1, 0xf6c6d8, 0x5b8def, 0xe8c547, 0xf2f0ea, 0x3fbf8f, 0xd94f70];

export function createPedestrians(scene, world, rng, count = 16) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: rngPick(rng, COATS), roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.22), coat); torso.position.y = 1.1; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), new THREE.MeshStandardMaterial({ color: rngPick(rng, [0xf2b183, 0xc98a5e, 0x8a5a34, 0x6e4530]) })); head.position.y = 1.58; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.78, 0.19), new THREE.MeshStandardMaterial({ color: 0x2a2733 })); legs.position.y = 0.4; g.add(legs);
    scene.add(g);
    const rect = world.blockRects[i % world.blockRects.length];
    const ped = {
      mesh: g, rect, edge: i % 4, u: rng(), speed: rngRange(rng, 1.1, 1.7),
      fleeT: 0, fleeDir: 0, phase: rng() * 9,
    };
    peds.push(ped);
  }
  function rectPoint(rect, edge, u) {
    const hw = rect.w / 2 - 1.2, hd = rect.d / 2 - 1.2;
    if (edge === 0) return { x: rect.x - hw + u * hw * 2, z: rect.z - hd };
    if (edge === 1) return { x: rect.x + hw, z: rect.z - hd + u * hd * 2 };
    if (edge === 2) return { x: rect.x + hw - u * hw * 2, z: rect.z + hd };
    return { x: rect.x - hw, z: rect.z + hd - u * hd * 2 };
  }
  return {
    peds,
    update(dt, t, threats) {
      for (const ped of peds) {
        const p = ped.mesh.position;
        // scatter from fast cars and gunfire
        if (ped.fleeT <= 0) for (const th of threats) {
          if (dist2d(p.x, p.z, th.x, th.z) < th.r) { ped.fleeT = 1.6; ped.fleeDir = Math.atan2(p.x - th.x, p.z - th.z); break; }
        }
        if (ped.fleeT > 0) {
          ped.fleeT -= dt;
          p.x += Math.sin(ped.fleeDir) * dt * 5.4; p.z += Math.cos(ped.fleeDir) * dt * 5.4;
          ped.mesh.rotation.y = ped.fleeDir;
        } else {
          ped.u += (ped.speed * dt) / (ped.rect.w + ped.rect.d);
          if (ped.u >= 1) { ped.u = 0; ped.edge = (ped.edge + 1) % 4; }
          const pt = rectPoint(ped.rect, ped.edge, ped.u);
          const heading = Math.atan2(pt.x - p.x, pt.z - p.z);
          p.x = pt.x; p.z = pt.z;
          if (Math.abs(pt.x) > 0.01) ped.mesh.rotation.y = heading;
        }
        ped.mesh.position.y = Math.abs(Math.sin(t * 6.4 + ped.phase)) * 0.045;
      }
    },
  };
}
