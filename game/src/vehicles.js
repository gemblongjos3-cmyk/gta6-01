// Palm Shores — vehicles.js
// Builds cars from boxes, cylinders and emissive lights: five civilian
// types with different handling plus the Shores PD cruiser with a strobing
// red/blue light bar. Every car is a Group with a `userData.car` record.

import * as THREE from 'three';
import { VEHICLE_TYPES } from './config.js';

const BODY_GEO = new THREE.BoxGeometry(1, 1, 1);
const WHEEL_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12);

function wheel(mat) {
  const w = new THREE.Mesh(WHEEL_GEO, mat);
  w.rotation.z = Math.PI / 2;
  return w;
}

export function makeCar(type, colorOverride) {
  const spec = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
  const color = colorOverride ?? spec.color;
  const g = new THREE.Group();

  const dims = {
    hatch: [1.9, 0.62, 3.9, 1.7, 0.55, 2.1],
    sedan: [1.95, 0.6, 4.5, 1.75, 0.55, 2.4],
    coupe: [1.95, 0.5, 4.3, 1.7, 0.48, 2.0],
    pickup: [2.0, 0.7, 4.6, 1.8, 0.6, 2.2],
    van: [2.05, 1.0, 4.8, 1.9, 0.9, 2.6],
    cruiser: [1.95, 0.62, 4.6, 1.75, 0.55, 2.4],
  }[type] || [1.95, 0.6, 4.5, 1.75, 0.55, 2.4];
  const [bw, bh, bl, cw, ch, cl] = dims;

  const paint = new THREE.MeshStandardMaterial({
    color, roughness: 0.25, metalness: 0.75,
  });
  const body = new THREE.Mesh(BODY_GEO, paint);
  body.scale.set(bw, bh, bl);
  body.position.y = 0.55;
  g.add(body);

  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1626, roughness: 0.1, metalness: 0.9 });
  const cabin = new THREE.Mesh(BODY_GEO, glass);
  cabin.scale.set(cw, ch, cl);
  cabin.position.set(0, 0.55 + bh / 2 + ch / 2 - 0.08, type === 'pickup' ? -0.9 : 0.1);
  g.add(cabin);

  // Pickup bed.
  if (type === 'pickup') {
    const bed = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
    bed.scale.set(1.8, 0.18, 1.6);
    bed.position.set(0, 0.95, 1.3);
    g.add(bed);
  }

  const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
  const hub = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-bw / 2, bl / 2 - 0.7], [bw / 2, bl / 2 - 0.7], [-bw / 2, -bl / 2 + 0.7], [bw / 2, -bl / 2 + 0.7]]) {
    const w = wheel(tyre);
    w.position.set(wx, 0.34, wz);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), hub);
    h.rotation.z = Math.PI / 2;
    h.position.copy(w.position);
    g.add(w, h);
    wheels.push(w);
  }

  // Headlights (warm) + tail lights (red), emissive so they read at night.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), headMat);
    h.position.set(sx * (bw / 1.9), 0.62, bl / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), tailMat);
    t.position.set(sx * (bw / 1.9), 0.66, -bl / 2 - 0.02);
    g.add(t);
  }
  // Fake headlight cones on the wet road ahead.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9b0, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 7), coneMat);
  cone.rotation.x = -Math.PI / 2;
  cone.rotation.z = Math.PI;
  cone.position.set(0, 0.06, bl / 2 + 3.6);
  g.add(cone);

  let lightBar = null;
  if (type === 'cruiser') {
    // White doors + black hood/trunk livery via a thin white box.
    const door = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.4 }));
    door.scale.set(bw + 0.02, 0.34, 2.2);
    door.position.set(0, 0.56, 0.1);
    g.add(door);
    const bar = new THREE.Group();
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
    barBase.position.y = 0;
    bar.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.34), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.32, 0.06, 0);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.34), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.32, 0.06, 0);
    bar.add(red, blue);
    bar.position.set(0, 1.18, 0.1);
    g.add(bar);
    lightBar = { red: red.material, blue: blue.material, phase: Math.random() * 10 };
  }

  g.userData.car = {
    type, spec, speed: 0, steer: 0, wheels, lightBar,
    length: bl, width: bw,
  };
  return g;
}

// Flash the cruiser light bar; call every frame with elapsed time.
export function updateLightBar(car, t) {
  const lb = car.userData.car.lightBar;
  if (!lb) return;
  const on = Math.sin((t + lb.phase) * 14) > 0;
  lb.red.color.setHex(on ? 0xff2020 : 0x330000);
  lb.blue.color.setHex(on ? 0x2244ff : 0x000033);
}
