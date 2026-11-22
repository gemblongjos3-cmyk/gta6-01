// Palm Shores — airunit.js
// One job: the police helicopter at 4+ stars — it circles overhead, tracks the
// player with a searchlight cone, and keeps the wanted level from decaying.
import * as THREE from 'three';
import { WANTED } from './config.js';

export function createHeli(G) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5.2), bodyMat);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), bodyMat);
  tail.position.set(0, 0.3, -4.2);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.4), rotorMat);
  rotor.position.y = 1.0;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), rotorMat);
  tailRotor.position.set(0, 0.4, -6.2);
  // Searchlight: a visible cone + a real spotlight aimed at the player.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -13;
  cone.rotation.x = Math.PI;
  const spot = new THREE.SpotLight(0xfff2b0, 900, 70, 0.28, 0.5, 1.2);
  spot.position.set(0, -0.5, 0);
  const spotTarget = new THREE.Object3D();
  g.add(body, tail, rotor, tailRotor, cone, spot, spotTarget);
  spot.target = spotTarget;
  g.visible = false;
  G.scene.add(g);
  const heli = { mesh: g, rotor, spot, spotTarget, angle: 0, active: false };
  G.heli = heli;
  return heli;
}

export function updateHeli(G, dt) {
  const heli = G.heli;
  const want = G.wanted >= WANTED.heliAt && G.mode === 'play';
  if (want && !heli.active) {
    heli.active = true;
    heli.mesh.visible = true;
    G.showMessage('Helikopter polisi di atasmu!');
  } else if (!want && heli.active) {
    heli.active = false;
    heli.mesh.visible = false;
  }
  if (!heli.active) return;
  heli.angle += dt * 0.45;
  const p = G.player.pos;
  const r = 24;
  heli.mesh.position.set(p.x + Math.sin(heli.angle) * r, 42, p.z + Math.cos(heli.angle) * r);
  heli.mesh.rotation.y = Math.atan2(p.x - heli.mesh.position.x, p.z - heli.mesh.position.z);
  heli.rotor.rotation.y += dt * 22;
  heli.spotTarget.position.set(p.x, 0, p.z);
  heli.spotTarget.updateMatrixWorld();
  // While the spotlight is on you, the heat does not cool off.
  G.wantedTimer = 0;
}
