// Sunset Stars: twelve golden stars hidden around Palm Shores — on the avenue
// median, at the end of the pier, behind the garage. Each one is +25 XP and a
// little more of the city's respect. They spin, they bob, they wait.

import * as THREE from 'three';
import { dist2d } from './random.js';

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.85 : 0.36, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
}

export function createCollectibles(scene, world, collectedIds) {
  const geo = starGeometry();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffc92e, emissive: 0xcc8a00, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.25 });
  const stars = world.starSpots.map((spot, i) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(spot.x, 1.5, spot.z);
    m.castShadow = true;
    m.visible = !collectedIds.includes(i);
    scene.add(m);
    return { mesh: m, id: i, taken: collectedIds.includes(i) };
  });
  return {
    stars,
    update(dt, t, focus, onCollect) {
      for (const s of stars) {
        if (s.taken) continue;
        s.mesh.rotation.y = t * 1.6 + s.id;
        s.mesh.position.y = 1.5 + Math.sin(t * 2 + s.id * 1.7) * 0.22;
        if (dist2d(s.mesh.position.x, s.mesh.position.z, focus.x, focus.z) < 2.4) {
          s.taken = true; s.mesh.visible = false;
          onCollect?.(s.id);
        }
      }
    },
    remaining() { return stars.filter(s => !s.taken).length; },
  };
}
