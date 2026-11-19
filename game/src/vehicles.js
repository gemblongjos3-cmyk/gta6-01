// Vehicle factory and city traffic. Every car in Palm Shores — the hero
// Vespera GT, traffic, parked cars waiting to be borrowed, Shores PD
// cruisers — is built here. Bodies are extruded side profiles (sloped hood,
// raked glasshouse, real wheel-arch cutouts), so a car reads as a car from
// any angle; wheels carry five-spoke alloy faces; paint is clearcoat
// physical material that picks up the sunset environment.

import * as THREE from 'three';
import { TRAFFIC_MODELS, TRAFFIC_COLORS } from './config.js';
import { rngPick, rngRange, clamp } from './random.js';
import { ROAD_CENTERS } from './city.js';
import { signTexture, glowTexture, rimTexture, streakTexture } from './textures.js';

const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1220, metalness: 0.7, roughness: 0.06, envMapIntensity: 2.5 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.92 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dee6, metalness: 0.9, roughness: 0.22 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x14151c, metalness: 0.3, roughness: 0.65 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0x30060c, emissive: 0xff2233, emissiveIntensity: 5 });
const headMat = new THREE.MeshStandardMaterial({ color: 0x444033, emissive: 0xffe9b0, emissiveIntensity: 5 });
let pdDoorTex = null, glowTexShared = null, rimTexShared = null, streakTexShared = null;
const glowTex = () => glowTexShared ??= glowTexture();
const streakTex = () => streakTexShared ??= streakTexture();
// Fake volumetric headlight cone: narrow at the lamp, wide at the far end.
const headConeGeo = new THREE.CylinderGeometry(0.95, 0.14, 5.2, 12, 1, true);
headConeGeo.rotateX(Math.PI / 2);
const headConeMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
// A long coloured streak the car's lights smear across the wet asphalt.
function roadStreak(g, color, w, l, x, z, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
    new THREE.MeshBasicMaterial({ map: streakTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.055, z); m.renderOrder = 2; g.add(m);
  return m;
}

// ---- profile geometry --------------------------------------------------------
// A car's side silhouette as an extruded shape: `top` lists the outline from
// the rear bumper, over the roofline, to the nose; the bottom edge is drawn
// back with an arch cut over each axle. Shape +x = front of the car.
function archBottom(L, axles, r = 0.47, y = 0.30) {
  const pts = [];
  for (const wx of [...axles].sort((a, b) => b - a)) {
    pts.push([wx + r, y]);
    for (let i = 1; i < 6; i++) { const a = (i / 6) * Math.PI; pts.push([wx + r * Math.cos(a), y + r * Math.sin(a)]); }
    pts.push([wx - r, y]);
  }
  pts.push([-L / 2, y]);
  return pts;
}
function profileGeo(top, L, width, axles) {
  const shape = new THREE.Shape();
  shape.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < top.length; i++) shape.lineTo(top[i][0], top[i][1]);
  if (axles) for (const [x, y] of archBottom(L, axles)) shape.lineTo(x, y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 14 });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2); // shape +x (the nose) becomes world +z
  return geo;
}

// Silhouettes per kind: [width, length, axles, bodyTop, cabinTop|null, cabinWidth scale]
const PROFILES = {
  coupe: {
    W: 1.88, L: 4.35, axles: [1.32, -1.32],
    body: [[-2.17, 0.82], [-1.50, 0.86], [0.95, 0.82], [1.90, 0.68], [2.17, 0.52], [2.17, 0.30]],
    cabin: [[-1.45, 0.84], [-0.80, 1.20], [0.15, 1.24], [0.95, 0.84]], cabinW: 0.80,
  },
  sedan: {
    W: 1.86, L: 4.50, axles: [1.40, -1.40],
    body: [[-2.25, 0.88], [-1.15, 0.90], [1.15, 0.86], [1.95, 0.76], [2.25, 0.58], [2.25, 0.30]],
    cabin: [[-1.50, 0.88], [-1.00, 1.34], [0.50, 1.36], [1.20, 0.88]], cabinW: 0.82,
  },
  hatch: {
    W: 1.82, L: 3.90, axles: [1.15, -1.15],
    body: [[-1.95, 0.92], [-0.90, 0.94], [1.10, 0.88], [1.75, 0.74], [1.95, 0.56], [1.95, 0.30]],
    cabin: [[-1.80, 0.92], [-1.15, 1.38], [0.35, 1.40], [1.05, 0.90]], cabinW: 0.82,
  },
  pickup: {
    W: 1.96, L: 4.90, axles: [1.55, -1.55],
    body: [[-2.45, 1.02], [-0.55, 1.02], [-0.55, 1.44], [0.75, 1.44], [1.55, 0.95], [2.20, 0.88], [2.45, 0.62], [2.45, 0.32]],
    cabin: null, cabinW: 0.86,
  },
  van: {
    W: 2.00, L: 4.70, axles: [1.50, -1.50],
    body: [[-2.35, 1.72], [1.60, 1.72], [2.35, 1.05], [2.35, 0.32]],
    cabin: null, cabinW: 0.9,
  },
};
PROFILES.taxi = PROFILES.sedan;
PROFILES.cruiser = PROFILES.sedan;

const geoCache = {};
function kindGeos(kind) {
  if (geoCache[kind]) return geoCache[kind];
  const p = PROFILES[kind] || PROFILES.sedan;
  const geos = {
    body: profileGeo(p.body, p.L, p.W, p.axles),
    cabin: p.cabin ? profileGeo(p.cabin, p.L, p.W * p.cabinW, null) : null,
    p,
  };
  geoCache[kind] = geos;
  return geos;
}

// ---- shared small parts -------------------------------------------------------
const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18);
const rimGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.25, 12);
const rimFaceGeo = new THREE.CircleGeometry(0.2, 20);
const rimFaceMat = () => new THREE.MeshStandardMaterial({ map: rimTexShared ??= rimTexture(), metalness: 0.6, roughness: 0.35 });

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function glowSprite(g, color, x, y, z, sx, sy, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.position.set(x, y, z); s.scale.set(sx, sy, 1); g.add(s); return s;
}
// A soft pool of coloured light the car throws onto the wet asphalt.
function underGlow(g, color, w, l, opacity, x = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
    new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, 0); m.renderOrder = 2; g.add(m);
}
function makeWheel(sx) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(tireGeo, tireMat); tire.rotation.z = Math.PI / 2; tire.castShadow = true; spin.add(tire);
  const rim = new THREE.Mesh(rimGeo, chromeMat); rim.rotation.z = Math.PI / 2; spin.add(rim);
  const face = new THREE.Mesh(rimFaceGeo, rimFaceMat());
  face.position.x = sx * 0.128; face.rotation.y = sx * Math.PI / 2; spin.add(face);
  pivot.add(spin);
  return { pivot, spin };
}

export function makeCarEntity(scene, { kind = 'sedan', color = 0xffffff, police = false, model = '' } = {}) {
  const g = new THREE.Group();
  const { body: bodyGeo, cabin: cabinGeo, p } = kindGeos(kind);
  const { W, L, axles } = p;
  const paint = new THREE.MeshPhysicalMaterial({
    color: police ? 0x15151c : color, metalness: 0.25, roughness: 0.2,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.4,
    emissive: police ? 0x000000 : new THREE.Color(color).multiplyScalar(0.12),
  });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  if (cabinGeo) {
    const cab = new THREE.Mesh(cabinGeo, glassMat);
    cab.castShadow = true; g.add(cab);
  }
  if (kind === 'pickup') { // glasshouse band proud of the cab + an open bed behind it
    box(W + 0.04, 0.4, 1.24, glassMat, 0, 1.23, 0.1, g);
    box(W * 0.8, 0.08, 1.75, trimMat, 0, 1.0, -1.5, g); // bed floor
  }
  if (kind === 'van') { // a glass band around the upper body
    box(W + 0.05, 0.52, L * 0.6, glassMat, 0, 1.3, -0.15, g);
  }
  // nose and tail dressing: splitter, grille, diffuser, slim bumpers
  box(W * 0.96, 0.07, 0.34, trimMat, 0, 0.31, L / 2 - 0.04, g);
  box(W * 0.58, 0.15, 0.06, trimMat, 0, 0.55, L / 2 + 0.03, g);
  box(W * 0.99, 0.15, 0.14, trimMat, 0, 0.4, -L / 2 - 0.02, g);
  if (kind === 'coupe') { // rear wing on struts, diffuser fins, side skirts
    const wing = box(W * 0.94, 0.05, 0.32, trimMat, 0, 1.04, -L / 2 + 0.14, g); wing.rotation.x = -0.1;
    box(0.07, 0.2, 0.26, paint, -W * 0.3, 0.9, -L / 2 + 0.14, g);
    box(0.07, 0.2, 0.26, paint, W * 0.3, 0.9, -L / 2 + 0.14, g);
    box(W * 0.8, 0.16, 0.1, trimMat, 0, 0.3, -L / 2 - 0.02, g);
    for (const fx of [-0.3, 0, 0.3]) box(0.05, 0.13, 0.12, trimMat, fx * W, 0.3, -L / 2 - 0.03, g);
    for (const s of [-1, 1]) box(0.06, 0.13, L * 0.46, trimMat, s * (W / 2 - 0.01), 0.33, 0, g);
  }
  if (kind !== 'van' && kind !== 'pickup') for (const s of [-1, 1]) { // mirrors
    box(0.05, 0.04, 0.12, paint, s * (W / 2 + 0.04), 1.02, L * 0.16, g);
    box(0.05, 0.11, 0.2, glassMat, s * (W / 2 + 0.09), 1.06, L * 0.16, g);
  }
  if (kind === 'taxi') {
    const sign = box(0.72, 0.2, 0.3, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd23e, emissiveIntensity: 1.4 }), 0, 1.48, 0, g);
    sign.castShadow = false;
  }
  if (police) {
    const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f0ea, metalness: 0.25, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 2.1 });
    box(W + 0.07, 0.52, L * 0.36, white, 0, 0.72, 0.05, g);                    // white doors band
    box(W * 0.8, 0.06, L * 0.3, white, 0, 1.4, -0.25, g);                      // white roof cap
    box(W * 0.7, 0.3, 0.24, trimMat, 0, 0.52, L / 2 + 0.08, g);                // push bar
    if (!pdDoorTex) pdDoorTex = signTexture('SHORES PD', '#f2f0ea', '#14202e');
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ map: pdDoorTex }));
      door.position.set(s * (W / 2 + 0.055), 0.72, 0.05); door.rotation.y = s * Math.PI / 2; g.add(door);
    }
    const bar = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2038, emissiveIntensity: 3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2255ff, emissiveIntensity: 3 });
    box(0.55, 0.14, 0.3, red, -0.3, 0, 0, bar); box(0.55, 0.14, 0.3, blue, 0.3, 0, 0, bar);
    bar.position.set(0, 1.56, -0.25); g.add(bar);
    g.userData.lightbar = { red, blue };
    for (const [sx, col] of [[-0.32, 0xff2038], [0.32, 0x2255ff]]) {
      glowSprite(g, col, sx, 1.6, -0.25, 3.4, 3.4, 0.7);
      underGlow(g, col, 1.9, L * 1.35, 0.5, sx * 2.4);
      roadStreak(g, col, 1.7, 8, sx * 2.2, -L / 2 - 2.6, 0.4);
    }
  }
  if (kind === 'coupe' && !police) underGlow(g, color, 3.6, L * 1.35, 0.52);
  else if (!police) underGlow(g, color, 2.9, L * 1.18, 0.2);
  // lights, with additive halos so they bloom against the dusk
  box(0.36, 0.11, 0.06, headMat, -W * 0.3, 0.66, L / 2 + 0.02, g);
  box(0.36, 0.11, 0.06, headMat, W * 0.3, 0.66, L / 2 + 0.02, g);
  box(0.36, 0.1, 0.06, tailMat, -W * 0.3, 0.8, -L / 2 - 0.02, g);
  box(0.36, 0.1, 0.06, tailMat, W * 0.3, 0.8, -L / 2 - 0.02, g);
  if (kind === 'coupe') box(W * 0.66, 0.07, 0.05, tailMat, 0, 0.84, -L / 2 - 0.02, g); // full-width light bar
  for (const s of [-1, 1]) {
    glowSprite(g, 0xffe9b0, s * W * 0.3, 0.66, L / 2 + 0.16, 1.6, 1.6, 0.75);
    // the beam itself: a fake volumetric cone thrown onto the wet road
    const cone = new THREE.Mesh(headConeGeo, headConeMat);
    cone.position.set(s * W * 0.3, 0.6, L / 2 + 2.55); cone.renderOrder = 3; g.add(cone);
    roadStreak(g, 0xffe9b0, 1.5, 8.5, s * W * 0.3, L / 2 + 4.2, 0.34);
  }
  glowSprite(g, 0xff2233, 0, 0.8, -L / 2 - 0.16, 2.7, 0.95, 0.65);
  roadStreak(g, 0xff2233, 2.4, 6.5, 0, -L / 2 - 3.1, 0.34);
  if (kind === 'coupe') for (const s of [-1, 1]) { // twin exhausts
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), chromeMat);
    ex.rotation.x = Math.PI / 2; ex.position.set(s * 0.52, 0.3, -L / 2 - 0.06); g.add(ex);
  }
  // wheels on steering pivots at the front
  const wheels = [], pivots = [];
  for (const [sx, front] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const { pivot, spin } = makeWheel(sx);
    pivot.position.set(sx * (W / 2 - 0.05), 0.34, front ? axles[0] : axles[1]);
    g.add(pivot);
    wheels.push(spin); if (front) pivots.push(pivot);
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
    else ent.setPos(along, center - off, ent.dir > 0 ? Math.PI / 2 : -Math.PI / 2); // nose first, always
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
  else { p.z = car.roadCenter - off; car.setPos(p.x, p.z, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
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
