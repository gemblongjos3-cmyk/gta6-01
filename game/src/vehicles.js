// Palm Shores — vehicles.js
// One job: build a car mesh from boxes and hold the runtime state of every car.
import * as THREE from 'three';
import { VEHICLE_TYPES } from './config.js';

const BODY_COLORS = [0x3b82f6, 0xff2e63, 0xfacc15, 0x94a3b8, 0x7c3aed, 0x22c55e, 0xf97316, 0xec4899, 0x0ea5e9];

export function makeCarMesh(typeKey, colorHex) {
  const type = VEHICLE_TYPES[typeKey];
  const group = new THREE.Group();
  const color = colorHex ?? type.color;
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
  const isVan = typeKey === 'van';
  const isCruiser = typeKey === 'cruiser';

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, isVan ? 4.6 : 4.2), bodyMat);
  body.position.y = 0.55; body.castShadow = false;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, isVan ? 2.6 : 2.0), glassMat);
  cabin.position.set(0, 1.12, isVan ? -0.2 : -0.25);
  group.add(cabin);
  if (isVan) {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.6), bodyMat);
    cargo.position.set(0, 1.15, 1.2);
    group.add(cargo);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1f3d });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    hl.position.set(sx, 0.55, isVan ? 2.32 : 2.12); group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    tl.position.set(sx, 0.55, isVan ? -2.32 : -2.12); group.add(tl);
  }
  if (isCruiser) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.32;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.32;
    bar.add(red, blue);
    bar.position.set(0, 1.5, -0.25);
    group.add(bar);
    group.userData.lightBar = bar;
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    badge.position.set(0, 0.7, 2.13); group.add(badge);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.36, wz);
    group.add(w); wheels.push(w);
  }
  group.userData.wheels = wheels;
  return group;
}

/** Create a car record (mesh + physics state). `parked` cars never move on their own. */
export function createCar(G, typeKey, x, z, heading, opts = {}) {
  const mesh = makeCarMesh(typeKey, opts.color ?? (opts.randomColor ? BODY_COLORS[Math.floor(G.rng.next() * BODY_COLORS.length)] : undefined));
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    mesh, typeKey, type: VEHICLE_TYPES[typeKey],
    pos: mesh.position, heading, speed: 0, steer: 0,
    parked: !!opts.parked, traffic: !!opts.traffic, police: !!opts.police,
    driver: opts.driver ?? null, // 'player' | 'ai' | null
    health: 100, targetSpeed: opts.targetSpeed ?? 0,
    routeAxis: opts.routeAxis ?? 'x', routeCoord: opts.routeCoord ?? z,
    direction: opts.direction ?? 1, stuckTimer: 0,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(G, car) {
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}
