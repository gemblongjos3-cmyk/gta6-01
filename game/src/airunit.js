// AIR-1 OSPREY, the Shores PD helicopter: it joins at three stars, hangs over
// the chase with a lagging orbit, and pins its searchlight on the player —
// which is why hiding stops working while it is overhead.

import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { dist2d } from './random.js';

export function createAirUnit(scene) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1b24, metalness: 0.5, roughness: 0.4 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, metalness: 0.4, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.7, 4.6), bodyMat); body.castShadow = true; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.5, 4.64), whiteMat); stripe.position.y = -0.2; g.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 4.4), bodyMat); tail.position.set(0, 0.25, -4.2); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.8), bodyMat); fin.position.set(0, 0.7, -6.2); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x0c0c10 }));
  rotor.position.y = 1.15; g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.16), rotor.material);
  tailRotor.position.set(0.2, 0.7, -6.2); g.add(tailRotor);
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), bodyMat);
    skid.position.set(s * 0.95, -1.15, 0); g.add(skid);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), bodyMat);
    strut.position.set(s * 0.9, -0.75, 0.6); g.add(strut);
  }
  // searchlight: a real spotlight plus a visible cone and a pool of light
  const spot = new THREE.SpotLight(0xcfe6ff, 900, 90, 0.32, 0.45, 1.2);
  g.add(spot); g.add(spot.target);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6.4, 27, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  cone.position.y = -14.2; g.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(5.6, 20),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(200,225,255,0.85)', 'rgba(200,225,255,0)'), transparent: true, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06;
  scene.add(pool); scene.add(g);
  g.position.set(320, 70, -320);

  const heli = {
    mesh: g, active: false, angle: 0,
    update(dt, target, t) {
      const want = target.stars >= 3;
      this.active = want;
      this.angle += dt * 0.24;
      const orbit = 13;
      const gx = want ? target.x + Math.sin(this.angle) * orbit : 320;
      const gz = want ? target.z + Math.cos(this.angle) * orbit : -320;
      const gy = want ? 27 : 70;
      const k = 1 - Math.exp(-dt * (want ? 1.6 : 0.7));
      g.position.x += (gx - g.position.x) * k;
      g.position.z += (gz - g.position.z) * k;
      g.position.y += (gy - g.position.y) * k;
      g.rotation.y = Math.atan2(target.x - g.position.x, target.z - g.position.z);
      rotor.rotation.y = t * 31; tailRotor.rotation.x = t * 40;
      const lit = want && g.position.y < 40;
      cone.visible = lit; pool.visible = lit;
      spot.visible = lit;
      if (lit) {
        spot.position.set(0, -0.8, 0.8);
        spot.target.position.set(target.x - g.position.x, -g.position.y, target.z - g.position.z);
        pool.position.set(target.x, 0.06, target.z);
      }
      return lit && dist2d(g.position.x, g.position.z, target.x, target.z) < 95;
    },
    unitForHud(target) {
      return { name: 'AIR-1 OSPREY', status: 'AIR SUPPORT', dist: Math.round(dist2d(g.position.x, g.position.z, target.x, target.z)) };
    },
  };
  return heli;
}
