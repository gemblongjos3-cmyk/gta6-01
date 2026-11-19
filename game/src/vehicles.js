// Vehicle factory and city traffic. Every car in Palm Shores — the hero
// Vespera GT, traffic, parked cars waiting to be borrowed, Shores PD
// cruisers — is built here from the same low-poly kit of boxes and cylinders,
// so the whole fleet shares one look and one entity shape.

import * as THREE from 'three';
import { TRAFFIC_MODELS, TRAFFIC_COLORS } from './config.js';
import { rngPick, rngRange, clamp } from './random.js';
import { ROAD_CENTERS } from './city.js';
import { signTexture, glowTexture } from './textures.js';

const glassMat = new THREE.MeshStandardMaterial({ color: 0x141c2c, metalness: 0.7, roughness: 0.08, envMapIntensity: 1.6 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.95 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8c4ce, metalness: 0.8, roughness: 0.35 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dee6, metalness: 0.9, roughness: 0.2 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0x30060c, emissive: 0xff2233, emissiveIntensity: 2.8 });
let glowTexShared = null;
const glowTex = () => glowTexShared ??= glowTexture();
// A soft pool of coloured light the car throws onto the wet asphalt.
function underGlow(g, color, w, l, opacity, x = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
    new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, 0); m.renderOrder = 2; g.add(m);
}
const headMat = new THREE.MeshStandardMaterial({ color: 0x444033, emissive: 0xffe9b0, emissiveIntensity: 2.4 });
let pdDoorTex = null;

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}

export function makeCarEntity(scene, { kind = 'sedan', color = 0xffffff, police = false, model = '' } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: police ? 0x15151c : color, metalness: 0.45, roughness: 0.16, envMapIntensity: 1.5, emissive: police ? 0x000000 : new THREE.Color(color).multiplyScalar(0.14) });
  const dims = { coupe: [1.86, 4.35, 0.46], sedan: [1.84, 4.5, 0.6], hatch: [1.8, 3.9, 0.62], pickup: [1.95, 4.9, 0.72], van: [2.0, 4.7, 0.8], taxi: [1.84, 4.5, 0.6], cruiser: [1.9, 4.7, 0.62] }[kind] || [1.84, 4.5, 0.6];
  const [W, L, bodyH] = dims;
  box(W, bodyH, L, paint, 0, 0.42 + bodyH / 2, 0, g);                       // body
  box(W * 0.94, 0.16, L * 0.96, paint, 0, 0.46, 0, g);                      // lower skirt
  if (kind === 'van') {
    box(W * 0.96, 1.05, L * 0.86, paint, 0, 1.5, -0.2, g);
    box(W * 0.9, 0.62, 0.1, glassMat, 0, 1.42, L * 0.24, g);
  } else if (kind === 'pickup') {
    box(W * 0.92, 0.55, L * 0.34, glassMat, 0, 1.18, L * 0.22, g);
    box(W * 0.94, 0.5, L * 0.4, paint, 0, 0.98, -L * 0.28, g);               // bed walls
    box(W * 0.86, 0.08, L * 0.36, tireMat, 0, 0.78, -L * 0.28, g);          // bed floor
  } else {
    const cab = box(W * 0.8, 0.44, L * 0.42, glassMat, 0, 0.92 + bodyH * 0.4, -L * 0.05, g);
    cab.scale.z = 0.92;
    box(W * 0.82, 0.06, L * 0.38, paint, 0, 1.17 + bodyH * 0.4, -L * 0.05, g); // roof
    box(W * 0.97, 0.2, L * 0.16, paint, 0, 0.62, L * 0.42, g);               // nose
    for (const s of [-1, 1]) { // mirrors on slim stalks
      box(0.05, 0.04, 0.12, paint, s * (W / 2 + 0.05), 1.04, L * 0.16, g);
      box(0.05, 0.11, 0.2, glassMat, s * (W / 2 + 0.1), 1.08, L * 0.16, g);
    }
  }
  if (kind === 'coupe') { // the Vespera's wing and diffuser
    box(W * 0.92, 0.07, 0.34, chromeMat, 0, 1.06, -L / 2 + 0.1, g);
    box(0.08, 0.22, 0.3, paint, -W * 0.32, 0.9, -L / 2 + 0.12, g);
    box(0.08, 0.22, 0.3, paint, W * 0.32, 0.9, -L / 2 + 0.12, g);
  }
  if (kind === 'taxi') {
    const sign = box(0.72, 0.2, 0.3, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd23e, emissiveIntensity: 1.4 }), 0, 1.62, 0, g);
    sign.castShadow = false;
  }
  if (police) {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, metalness: 0.4, roughness: 0.4 });
    box(W + 0.03, bodyH * 0.8, L * 0.34, white, 0, 0.46 + bodyH / 2, 0.1, g);   // white doors band
    box(W * 0.88, 0.07, L * 0.4, white, 0, 1.3, -L * 0.04, g);                 // white roof
    box(W * 0.7, 0.3, 0.24, tireMat, 0, 0.52, L / 2 + 0.05, g);                // push bar
    if (!pdDoorTex) pdDoorTex = signTexture('SHORES PD', '#f2f0ea', '#14202e');
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ map: pdDoorTex }));
      door.position.set(s * (W / 2 + 0.03), 0.72, 0.1); door.rotation.y = s * Math.PI / 2; g.add(door);
    }
    const bar = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2038, emissiveIntensity: 3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2255ff, emissiveIntensity: 3 });
    box(0.55, 0.14, 0.3, red, -0.3, 0, 0, bar); box(0.55, 0.14, 0.3, blue, 0.3, 0, 0, bar);
    bar.position.set(0, 1.66, -L * 0.04); g.add(bar);
    g.userData.lightbar = { red, blue };
    // strobe halos + the red/blue wash the bar throws on the wet road
    for (const [sx, col] of [[-0.32, 0xff2038], [0.32, 0x2255ff]]) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      halo.position.set(sx, 1.7, -L * 0.04); halo.scale.setScalar(2.6); g.add(halo);
      underGlow(g, col, 1.9, L * 1.35, 0.30, sx * 2.4);
    }
  }
  if (kind === 'coupe' && !police) underGlow(g, color, 3.4, L * 1.3, 0.30); // the Vespera's pink sheen on the asphalt
  // lights
  box(0.34, 0.12, 0.06, headMat, -W * 0.3, 0.72, L / 2 + 0.01, g);
  box(0.34, 0.12, 0.06, headMat, W * 0.3, 0.72, L / 2 + 0.01, g);
  box(0.36, 0.1, 0.06, tailMat, -W * 0.3, 0.78, -L / 2 - 0.01, g);
  box(0.36, 0.1, 0.06, tailMat, W * 0.3, 0.78, -L / 2 - 0.01, g);
  if (kind === 'coupe') box(W * 0.62, 0.07, 0.05, tailMat, 0, 0.82, -L / 2 - 0.01, g); // full-width light bar
  // wheels on steering pivots at the front
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
  const wheels = [], pivots = [];
  for (const [sx, sz, front] of [[-1, 1, 1], [1, 1, 1], [-1, -1, 0], [1, -1, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 - 0.05), 0.34, sz * (L / 2 - 0.85));
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.rotation.z = Math.PI / 2; wheel.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 8), rimMat);
    rim.rotation.z = Math.PI / 2; wheel.add(rim);
    pivot.add(wheel); g.add(pivot);
    wheels.push(wheel); if (front) pivots.push(pivot);
  }
  scene.add(g);
  const ent = {
    mesh: g, kind, model: model || kind.toUpperCase(), color, isPolice: police,
    heading: 0, speed: 0, steer: 0, radius: 2.3, condition: 100,
    wheels, pivots, driver: 'parked', dead: false,
    setPos(x, z, heading) { this.mesh.position.set(x, 0, z); this.heading = heading; this.mesh.rotation.y = heading; },
  };
  g.rotation.order = 'YXZ';
  return ent;
}

export function spinWheels(ent, dt) {
  const w = (ent.speed * dt) / 0.34;
  for (const wheel of ent.wheels) wheel.rotation.x += w;
  for (const p of ent.pivots) p.rotation.y = ent.steer * 0.55;
}

// ---- traffic ----------------------------------------------------------------
const laneOffset = (c) => (c === 0 ? 5.1 : 3.6);

export function createTraffic(scene, world, rng, count = 14) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const spec = TRAFFIC_MODELS[i % TRAFFIC_MODELS.length];
    const ent = makeCarEntity(scene, { kind: spec.kind, color: rngPick(rng, TRAFFIC_COLORS), model: spec.model });
    ent.driver = 'traffic';
    const vertical = rng() < 0.5;
    const center = rngPick(rng, ROAD_CENTERS);
    ent.axis = vertical ? 'z' : 'x';
    ent.roadCenter = center;
    ent.dir = rng() < 0.5 ? 1 : -1;
    ent.cruise = rngRange(rng, 8.5, 12.5);
    const along = rngRange(rng, -205, 205);
    // right-hand traffic: offset to the right of the direction of travel
    const off = laneOffset(center) * ent.dir * (vertical ? 1 : -1);
    if (vertical) ent.setPos(center + off, along, ent.dir > 0 ? 0 : Math.PI);
    else ent.setPos(along, center - off, ent.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    ent.speed = ent.cruise;
    cars.push(ent);
  }
  return {
    cars,
    update(dt, playerCar) {
      for (const car of cars) {
        if (car.driver !== 'traffic') continue;
        const p = car.mesh.position;
        // slow for a car ahead in the same lane, or for the player's car
        let target = car.cruise;
        const others = playerCar && playerCar.driver !== 'traffic' ? [...cars, playerCar] : cars;
        for (const other of others) {
          if (other === car || !other.mesh) continue;
          const op = other.mesh.position;
          const dx = (op.x - p.x), dz = (op.z - p.z);
          const ahead = car.axis === 'z' ? dz * car.dir : dx * car.dir;
          const side = car.axis === 'z' ? Math.abs(dx) : Math.abs(dz);
          if (ahead > 0 && ahead < 9 && side < 2.2) target = Math.min(target, other.speed ?? 6);
        }
        car.speed = clamp(car.speed + (target - car.speed) * Math.min(1, dt * 2.2), 0, car.cruise + 2);
        if (car.axis === 'z') p.z += car.dir * car.speed * dt; else p.x += car.dir * car.speed * dt;
        // turn at some intersections, wrap at the city edge
        const cross = car.axis === 'z' ? p.x : p.z;
        const alongNow = car.axis === 'z' ? p.z : p.x;
        for (const c of ROAD_CENTERS) {
          if (Math.abs(alongNow - c) < 0.6 && Math.abs(cross - car.roadCenter) > 1 && rngTurn(car)) {
            turnCar(car, c);
            break;
          }
        }
        if (Math.abs(alongNow) > 218) {
          if (car.axis === 'z') p.z = -Math.sign(alongNow) * 218; else p.x = -Math.sign(alongNow) * 218;
        }
        spinWheels(car, dt);
      }
    },
  };
}

let turnSeed = 7;
function rngTurn() { turnSeed = (turnSeed * 16807) % 2147483647; return (turnSeed / 2147483647) < 0.012; }
function turnCar(car, crossCenter) {
  const p = car.mesh.position;
  if (car.axis === 'z') { p.z = crossCenter; car.axis = 'x'; car.roadCenter = crossCenter; }
  else { p.x = crossCenter; car.axis = 'z'; car.roadCenter = crossCenter; }
  car.dir = Math.random() < 0.5 ? 1 : -1;
  const off = laneOffset(car.roadCenter) * car.dir;
  if (car.axis === 'z') { p.x = car.roadCenter + off; car.setPos(p.x, p.z, car.dir > 0 ? 0 : Math.PI); }
  else { p.z = car.roadCenter - off; car.setPos(p.x, p.z, car.dir > 0 ? -Math.PI / 2 : Math.PI / 2); }
  car.mesh.position.y = 0;
}

// Parked cars in the painted lots — unlocked, unattended, asking for it.
export function spawnParkedCars(scene, world, rng) {
  const parked = [];
  world.parkingSpots.forEach((spot, i) => {
    if (i % 3 === 2) return; // leave some bays empty
    const spec = TRAFFIC_MODELS[i % TRAFFIC_MODELS.length];
    const ent = makeCarEntity(scene, { kind: spec.kind, color: rngPick(rng, TRAFFIC_COLORS), model: spec.model });
    ent.driver = 'parked';
    ent.setPos(spot.x, spot.z, spot.heading + (i % 2 ? 0 : Math.PI));
    parked.push(ent);
  });
  return parked;
}
