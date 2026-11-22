// Palm Shores — collectibles.js
// One job: cash pickups and palm-star collectibles scattered around the city —
// spin, bob, and pay out when the player walks or drives through them.
import * as THREE from 'three';
import { COLLECTIBLES } from './config.js';

function makeCashMesh() {
  const g = new THREE.Group();
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.18 }));
  g.add(bill, band, glow);
  return g;
}

function makeStarMesh() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.85 : 0.38;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.3, metalness: 0.6, emissive: 0x664400 }));
  return mesh;
}

export function spawnCollectibles(G) {
  const { rng } = G;
  for (let i = 0; i < COLLECTIBLES.cashCount; i++) {
    const street = G.city.streets[Math.floor(rng.next() * G.city.streets.length)];
    const along = rng.range(-165, 165);
    const horizontal = rng.chance(0.5);
    const mesh = makeCashMesh();
    mesh.position.set(horizontal ? along : street + rng.range(-6, 6), 0.9, horizontal ? street + rng.range(-6, 6) : along);
    G.scene.add(mesh);
    G.pickups.push({ mesh, kind: 'cash', value: rng.int(COLLECTIBLES.cashMin, COLLECTIBLES.cashMax), spin: rng.range(0, 6) });
  }
  for (let i = 0; i < COLLECTIBLES.starCount; i++) {
    const mesh = makeStarMesh();
    const x = rng.range(-160, 160), z = rng.range(-160, 160);
    mesh.position.set(x, 1.2, z);
    G.scene.add(mesh);
    G.pickups.push({ mesh, kind: 'star', value: COLLECTIBLES.starValue, spin: rng.range(0, 6) });
  }
}

export function updateCollectibles(G, dt) {
  const p = G.player.pos;
  for (const item of [...G.pickups]) {
    item.spin += dt * 2.2;
    item.mesh.rotation.y = item.spin;
    item.mesh.position.y = (item.kind === 'star' ? 1.2 : 0.9) + Math.sin(G.time * 2 + item.spin) * 0.18;
    const d = Math.hypot(item.mesh.position.x - p.x, item.mesh.position.z - p.z);
    if (d < 2.6) {
      G.player.cash += item.value;
      if (item.kind === 'star') {
        G.player.armor = Math.min(100, G.player.armor + 25);
        G.showMessage(`Bintang Palm +$${item.value} & +25 armor!`);
      } else {
        G.showMessage(`+$${item.value} uang jalanan`);
      }
      G.audio.chime();
      G.scene.remove(item.mesh);
      G.pickups.splice(G.pickups.indexOf(item), 1);
    }
  }
}
