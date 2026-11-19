// The city of Palm Shores, built procedurally in three.js: a 7 x 7 grid of
// art-deco blocks wrapped around Sunset Avenue, a beach and bay to the east,
// the Pier Nine docks in the south-east and the Bayline Garage in the
// south-west. Everything the other systems need — colliders, road centrelines,
// parking spots, the garage bay, star spots — is indexed here as it is built.

import * as THREE from 'three';
import { CITY, DISTRICTS } from './config.js';
import { rngRange, rngInt, rngPick, clamp } from './random.js';
import * as TX from './textures.js';

const P = CITY.pitch;
export const ROAD_CENTERS = [-3, -2, -1, 0, 1, 2, 3].map(k => k * P);
const roadHalf = (c) => (c === 0 ? CITY.avenue : CITY.road) / 2;

export function districtAt(x, z) {
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) { const dd = (d.x - x) ** 2 + (d.z - z) ** 2; if (dd < bd) { bd = dd; best = d; } }
  return best.name;
}

function palmCrownGeometry(leafTex) {
  // Eight alpha-cut fronds fanned from one point, drooping at the tips.
  const pos = [], uv = [], idx = [];
  for (let f = 0; f < 8; f++) {
    const a = (f / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const px = -sa, pz = ca, base = f * 4;
    const tipX = ca * 3.9, tipZ = sa * 3.9;
    pos.push(-px * 0.06, 0, -pz * 0.06, px * 0.06, 0, pz * 0.06, tipX - px * 0.3, -1.3, tipZ - pz * 0.3, tipX + px * 0.3, -1.3, tipZ + pz * 0.3);
    uv.push(0, 0, 1, 0, 0.08, 1, 0.92, 1);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildWorld(scene, rng) {
  const world = {
    colliders: [], parkingSpots: [], starSpots: [], blockRects: [],
    garage: { x: -150, z: 168, heading: Math.PI }, pier: { x: 268, z: 150 },
    updateFns: [], focus: new THREE.Vector3(),
    sun: null, sunTarget: null,
  };
  const addCollider = (x, z, w, d) => world.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  // ---- sky, light and air -------------------------------------------------
  scene.fog = new THREE.Fog(0xc64b74, 90, 460);
  scene.environment = TX.sunsetEnvTexture(); // the sunset every glossy surface reflects
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 24, 16),
    new THREE.MeshBasicMaterial({ map: TX.skyTexture(), side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const glowTex = TX.glowTexture('rgba(255,214,150,1)', 'rgba(255,120,60,0)');
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc46b, transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
  sunSprite.position.set(-760, 74, -60); sunSprite.scale.setScalar(340);
  scene.add(sunSprite);
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3c4, transparent: true, fog: false, depthWrite: false }));
  sunCore.position.copy(sunSprite.position); sunCore.scale.setScalar(90);
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a9c, transparent: true, opacity: 0.3, fog: false, depthWrite: false }));
  sunHalo.position.copy(sunSprite.position); sunHalo.scale.setScalar(620); scene.add(sunHalo);
  scene.add(sunCore);
  // horizontal glare streak through the sun — the lens flare of the reference shot
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb37a, transparent: true, opacity: 0.5, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  flare.position.copy(sunSprite.position); flare.scale.set(620, 46, 1); scene.add(flare);
  scene.add(new THREE.HemisphereLight(0xffc79a, 0x4a2a63, 1.35));
  // warm sky bounce from the east, so faces turned from the sun still read
  const bounce = new THREE.DirectionalLight(0xff8a66, 0.55);
  bounce.position.set(300, 90, 120); scene.add(bounce);
  const sun = new THREE.DirectionalLight(0xff9448, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
  sun.shadow.camera.far = 700; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  world.sun = sun; world.sunTarget = sun.target;
  const fill = new THREE.DirectionalLight(0x7a5cff, 0.35); fill.position.set(120, 80, 200); scene.add(fill);
  // pink clouds
  const cloudTex = TX.glowTexture('rgba(255,170,190,0.55)', 'rgba(255,120,160,0)');
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    s.position.set(rngRange(rng, -700, 500), rngRange(rng, 120, 260), rngRange(rng, -600, 400));
    s.scale.set(rngRange(rng, 180, 320), rngRange(rng, 26, 44), 1);
    scene.add(s);
  }
  // distant silhouette skyline + hills so the horizon is never empty
  const silMat = new THREE.MeshBasicMaterial({ color: 0x3a1c50, fog: false });
  for (let i = 0; i < 16; i++) {
    const h = rngRange(rng, 30, 110);
    const b = new THREE.Mesh(new THREE.BoxGeometry(rngRange(rng, 24, 44), h, 24), silMat);
    const side = i % 3;
    if (side === 0) b.position.set(-430, h / 2, rngRange(rng, -420, 420));
    else if (side === 1) b.position.set(rngRange(rng, -420, 200), h / 2, -430);
    else b.position.set(rngRange(rng, -420, 200), h / 2, 430);
    scene.add(b);
  }

  // ---- ground, roads, beach, water ---------------------------------------
  const base = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshStandardMaterial({ color: 0x241a30, roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.05; base.receiveShadow = true; scene.add(base);
  const roadTex = TX.roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.18, metalness: 0.7, envMapIntensity: 1.4 });
  const cwMat = new THREE.MeshStandardMaterial({ map: TX.crosswalkTexture(), roughness: 0.7 });
  const span = P * 7 + CITY.road;
  for (const c of ROAD_CENTERS) {
    const w = roadHalf(c) * 2;
    for (const horiz of [false, true]) {
      const len = horiz ? span : span, wid = w;
      const geo = new THREE.PlaneGeometry(wid, len);
      const m = new THREE.Mesh(geo, roadMat.clone());
      m.material.map = roadTex.clone(); m.material.map.needsUpdate = true;
      m.material.map.repeat.set(1, len / 24);
      m.rotation.x = -Math.PI / 2; m.rotation.z = horiz ? Math.PI / 2 : 0;
      if (horiz) m.position.set(0, 0.02, c); else m.position.set(c, 0.02, 0);
      m.receiveShadow = true; scene.add(m);
    }
    for (const c2 of ROAD_CENTERS) {
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(roadHalf(c) * 2 + 2, roadHalf(c2) * 2 + 2), cwMat);
      cw.rotation.x = -Math.PI / 2; cw.position.set(c, 0.035, c2); cw.receiveShadow = true; scene.add(cw);
    }
  }
  // the avenue wears the sunset: a long wet-light streak running at the sun
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(380, 15),
    new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9a5c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  streak.rotation.x = -Math.PI / 2; streak.position.set(0, 0.045, 0); scene.add(streak);
  // Sunset Avenue median: palms and lamps between the lanes
  const medianMat = new THREE.MeshStandardMaterial({ color: 0x4a3550, roughness: 0.9 });
  for (let k = -3; k < 3; k++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(P - CITY.road - 4, 0.22, 2.6), medianMat);
    seg.position.set(k * P + P / 2, 0.11, 0); seg.receiveShadow = true; scene.add(seg);
  }
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(30, span + 160), new THREE.MeshStandardMaterial({ map: TX.sandTexture(), roughness: 1 }));
  sand.material.map.repeat.set(3, 40);
  sand.rotation.x = -Math.PI / 2; sand.position.set(238, 0.015, 0); sand.receiveShadow = true; scene.add(sand);
  const waterTex = TX.waterTexture(); waterTex.repeat.set(10, 10);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(560, span + 320),
    new THREE.MeshPhongMaterial({ map: waterTex, shininess: 90, specular: 0xff9a5c }));
  water.rotation.x = -Math.PI / 2; water.position.set(CITY.waterX + 278, -0.35, 0); scene.add(water);
  world.updateFns.push((dt, t) => { waterTex.offset.y = t * 0.008; waterTex.offset.x = Math.sin(t * 0.05) * 0.02; });

  // ---- blocks: sidewalks, buildings, lots ---------------------------------
  const sideMat = new THREE.MeshStandardMaterial({ map: TX.sidewalkTexture(), roughness: 0.95 });
  sideMat.map.repeat.set(6, 6);
  const roofMats = [];
  const facadeMats = [];
  for (let i = 0; i < 10; i++) {
    facadeMats.push(new THREE.MeshStandardMaterial({ map: TX.facadeTexture(rng, 6, 5), roughness: 0.85 }));
    roofMats.push(new THREE.MeshStandardMaterial({ map: TX.roofTexture(rng), roughness: 1 }));
  }
  const neonTrims = [0xff4fa3, 0x22d3ee, 0xffd23e, 0x7dff6a, 0xff8c42].map(col =>
    new THREE.MeshStandardMaterial({ color: 0x181020, emissive: col, emissiveIntensity: 2.2 }));
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a6a42, roughness: 0.9 });
  const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x4f7d8a, roughness: 0.9 });

  function building(x, z, w, d, h, matIdx) {
    const mats = [facadeMats[matIdx], facadeMats[matIdx], roofMats[matIdx % roofMats.length], roofMats[matIdx % roofMats.length], facadeMats[matIdx], facadeMats[matIdx]];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true; scene.add(b);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.35, d + 0.35), neonTrims[matIdx % neonTrims.length]);
    trim.position.set(x, h - 0.4, z); scene.add(trim);
    if (rng() < 0.5) { // rooftop clutter: AC boxes and a water tank
      const ac = new THREE.Mesh(new THREE.BoxGeometry(rngRange(rng, 2, 4), 1.1, rngRange(rng, 2, 3)), crateMat2);
      ac.position.set(x + rngRange(rng, -w / 4, w / 4), h + 0.55, z + rngRange(rng, -d / 4, d / 4)); ac.castShadow = true; scene.add(ac);
    }
    addCollider(x, z, w, d);
    return b;
  }

  const cells = [];
  for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) {
    const x0 = ROAD_CENTERS[i + 3] + roadHalf(ROAD_CENTERS[i + 3]), x1 = ROAD_CENTERS[i + 4] - roadHalf(ROAD_CENTERS[i + 4]);
    const z0 = ROAD_CENTERS[j + 3] + roadHalf(ROAD_CENTERS[j + 3]), z1 = ROAD_CENTERS[j + 4] - roadHalf(ROAD_CENTERS[j + 4]);
    cells.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 });
  }
  const GARAGE_CELL = cells.reduce((a, b) => (Math.hypot(b.cx + 150, b.cz - 150) < Math.hypot(a.cx + 150, a.cz - 150) ? b : a));
  const WAREHOUSE_CELL = cells.reduce((a, b) => (Math.hypot(b.cx - 174, b.cz - 150) < Math.hypot(a.cx - 174, a.cz - 150) ? b : a));

  for (const cell of cells) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(cell.w + 3.4, 0.16, cell.d + 3.4), sideMat);
    walk.position.set(cell.cx, 0.08, cell.cz); walk.receiveShadow = true; scene.add(walk);
    world.blockRects.push({ x: cell.cx, z: cell.cz, w: cell.w + 3.4, d: cell.d + 3.4 });
    if (cell === GARAGE_CELL || cell === WAREHOUSE_CELL) continue;
    const roll = rng();
    if (roll < 0.16) { // painted parking lot full of stealable cars
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(cell.w - 2, cell.d - 2), new THREE.MeshStandardMaterial({ color: 0x3a3444, roughness: 0.8 }));
      lot.rotation.x = -Math.PI / 2; lot.position.set(cell.cx, 0.18, cell.cz); lot.receiveShadow = true; scene.add(lot);
      for (let s = 0; s < 6; s++) {
        const px = cell.cx - cell.w / 2 + 8 + (s % 3) * 13, pz = cell.cz - 8 + Math.floor(s / 3) * 16;
        world.parkingSpots.push({ x: px, z: pz, heading: Math.PI / 2 });
      }
      continue;
    }
    if (roll < 0.24) { // plaza: palms, benches, crates — and a Sunset Star
      for (let s = 0; s < 5; s++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), s % 2 ? crateMat : crateMat2);
        crate.position.set(cell.cx + rngRange(rng, -14, 14), 0.95, cell.cz + rngRange(rng, -14, 14));
        crate.castShadow = true; scene.add(crate); addCollider(crate.position.x, crate.position.z, 1.7, 1.7);
      }
      world.starSpots.push({ x: cell.cx, z: cell.cz });
      continue;
    }
    const downtown = Math.hypot(cell.cx, cell.cz) < 130;
    const n = downtown ? rngInt(rng, 2, 3) : rngInt(rng, 1, 2);
    for (let bIdx = 0; bIdx < n; bIdx++) {
      const bw = rngRange(rng, 13, n === 1 ? 34 : 19), bd = rngRange(rng, 13, n === 1 ? 34 : 19);
      const bx = cell.cx + (n === 1 ? 0 : (bIdx % 2 ? 1 : -1) * (cell.w / 4 - 1)) + rngRange(rng, -1.5, 1.5);
      const bz = cell.cz + (n === 1 ? 0 : (bIdx < 2 ? -1 : 1) * (cell.d / 4 - 1)) + rngRange(rng, -1.5, 1.5);
      const h = downtown ? rngRange(rng, 16, 52) : rngRange(rng, 9, 26);
      building(bx, bz, bw, bd, h, rngInt(rng, 0, facadeMats.length - 1));
    }
  }

  // ---- Bayline Garage ------------------------------------------------------
  {
    const gx = world.garage.x, gz = world.garage.z - 18;
    const g = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 16),
      new THREE.MeshStandardMaterial({ map: TX.facadeTexture(rng, 2, 6), roughness: 0.85 }));
    g.position.set(gx, 5, gz); g.castShadow = true; g.receiveShadow = true; scene.add(g);
    addCollider(gx, gz, 34, 16);
    const bay = new THREE.Mesh(new THREE.BoxGeometry(11, 6.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x120c1c, roughness: 0.4, metalness: 0.4 }));
    bay.position.set(gx, 3.2, gz + 8.2); scene.add(bay);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.6),
      new THREE.MeshBasicMaterial({ map: TX.billboardTexture('BAYLINE GARAGE', 'SALES • TUNING • RESPECT', '#1c1030', '#ffd23e', '#ff4fa3'), side: THREE.DoubleSide }));
    sign.position.set(gx, 11.6, gz + 8.4); scene.add(sign);
    world.garage.bayZ = gz + 10;
  }

  // ---- Pier Nine docks ------------------------------------------------------
  {
    const pierTex = TX.pierTexture(); pierTex.wrapS = pierTex.wrapT = THREE.RepeatWrapping; pierTex.repeat.set(11, 4.5);
    const deckMat = new THREE.MeshStandardMaterial({ map: pierTex, roughness: 1 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(86, 1.0, 34), deckMat);
    deck.position.set(292, -0.48, 150); deck.receiveShadow = true; scene.add(deck);
    const wh = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 26),
      new THREE.MeshStandardMaterial({ map: TX.facadeTexture(rng, 2, 5), roughness: 0.9 }));
    wh.position.set(WAREHOUSE_CELL.cx, 6, WAREHOUSE_CELL.cz); wh.castShadow = true; wh.receiveShadow = true; scene.add(wh);
    addCollider(WAREHOUSE_CELL.cx, WAREHOUSE_CELL.cz, 30, 26);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 3.6),
      new THREE.MeshBasicMaterial({ map: TX.signTexture('PIER NINE — CARGO', '#14202e', '#7fd4c1'), side: THREE.DoubleSide }));
    sign.position.set(WAREHOUSE_CELL.cx, 13.4, WAREHOUSE_CELL.cz + 13.4); scene.add(sign);
    const contCols = [0xd94f70, 0x3fbf8f, 0x5b8def, 0xe8a547];
    for (let i = 0; i < 10; i++) {
      const cont = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4),
        new THREE.MeshStandardMaterial({ color: contCols[i % 4], roughness: 0.7, metalness: 0.3 }));
      const cxp = 262 + (i % 5) * 13, czp = 138 + Math.floor(i / 5) * 22;
      cont.position.set(cxp, 1.35, czp); cont.castShadow = true; scene.add(cont);
      if (i >= 5) addCollider(cxp, czp, 6, 2.4);
    }
    for (let i = 0; i < 7; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), i % 2 ? crateMat : crateMat2);
      crate.position.set(rngRange(rng, 258, 322), 0.95, rngRange(rng, 136, 164)); crate.castShadow = true; scene.add(crate);
    }
    world.starSpots.push({ x: 330, z: 150 });
  }

  // ---- billboards ------------------------------------------------------------
  const billboards = [
    { main: 'FLAMINGO FM', sub: '104.5 — THE FLAMINGO', bg: '#ff4fa3', fg: '#ffffff', ac: '#ffd23e', x: 44, z: -27, ry: Math.PI * 0.78, big: true },
    { main: 'HOTEL SOLANA', sub: 'ROOMS FROM $40', bg: '#14224a', fg: '#7fd4c1', ac: '#ff8c42', x: -70, z: 26, ry: -Math.PI * 0.2 },
    { main: 'VESPERA GT', sub: 'TEST DRIVE — ISLA VERDE', bg: '#1c1030', fg: '#ff4fa3', ac: '#ffffff', x: -128, z: -27, ry: Math.PI * 0.85 },
    { main: 'CAFE BRISA', sub: 'OPEN ALL NIGHT', bg: '#3fbf8f', fg: '#10301f', ac: '#ffd23e', x: 120, z: 27, ry: Math.PI * 1.1 },
  ];
  for (const b of billboards) {
    const w = b.big ? 30 : 20, h = w / 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 13, 8), new THREE.MeshStandardMaterial({ color: 0x2c2438 }));
    pole.position.set(b.x, 6.5, b.z); pole.castShadow = true; scene.add(pole);
    const boardTex = TX.billboardTexture(b.main, b.sub, b.bg, b.fg, b.ac);
    for (const flip of [0, Math.PI]) { // back-to-back pair, so the art reads from both approaches
      const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: boardTex }));
      board.position.set(b.x, 13 + h / 2, b.z); board.rotation.y = b.ry + flip; scene.add(board);
    }
    addCollider(b.x, b.z, 1.2, 1.2);
  }

  // ---- palms and streetlights (instanced) ------------------------------------
  const palmSpots = [];
  for (const c of ROAD_CENTERS) {
    for (let s = -200; s <= 200; s += 29) {
      palmSpots.push({ x: c + roadHalf(c) + 2.6, z: s + (c % 2 ? 8 : 0) });
      palmSpots.push({ x: s + (c % 2 ? 0 : 11), z: c + roadHalf(c) + 2.6 });
    }
  }
  for (let s = -190; s <= 190; s += 24) palmSpots.push({ x: 230, z: s });
  for (let k = -3; k < 3; k++) palmSpots.push({ x: k * P + P / 2, z: 0, median: true });
  // Sunset Avenue gets a dense double row, big crowns leaning over the lanes
  for (let s = -204; s <= 204; s += 17) {
    palmSpots.push({ x: s, z: -12.8, big: true });
    palmSpots.push({ x: s + 8, z: 12.8, big: true });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.24, 6.4, 6);
  trunkGeo.translate(0, 3.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a40, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ map: TX.palmLeafTexture(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x14401f, emissiveIntensity: 0.55 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crowns = new THREE.InstancedMesh(palmCrownGeometry(), crownMat, palmSpots.length);
  const dummy = new THREE.Object3D();
  palmSpots.forEach((p, i) => {
    const lean = rngRange(rng, -0.09, 0.09), h = p.big ? rngRange(rng, 1.25, 1.55) : p.median ? 1.05 : rngRange(rng, 0.95, 1.3);
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(lean, rng() * Math.PI * 2, lean * 0.7);
    dummy.scale.setScalar(h); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 6.4 * h - 0.15; dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = true; crowns.castShadow = true;
  scene.add(trunks); scene.add(crowns);

  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6); lampGeo.translate(0, 2.8, 0);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x241c30 });
  const bulbGeo = new THREE.BoxGeometry(0.5, 0.18, 0.5);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x110a18, emissive: 0xffc46b, emissiveIntensity: 3 });
  const lampSpots = [];
  for (const c of ROAD_CENTERS) for (let s = -200; s <= 200; s += 58) { lampSpots.push({ x: c - roadHalf(c) - 1.4, z: s + 14 }); lampSpots.push({ x: c + roadHalf(c) + 1.4, z: s + 43 }); }
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampSpots.length);
  lampSpots.forEach((p, i) => {
    dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
    dummy.position.set(p.x, 0, p.z); dummy.updateMatrix(); lamps.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 5.65; dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix);
  });
  scene.add(lamps); scene.add(bulbs);

  // ---- Sunset Avenue dressing: lamp halos and neon blade signs -------------
  const lampGlowTex = TX.glowTexture('rgba(255,214,150,1)', 'rgba(255,160,60,0)');
  for (const p of lampSpots) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlowTex, color: 0xffc46b, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(p.x, 5.65, p.z); halo.scale.setScalar(3.4); scene.add(halo);
  }
  const NEON_SIGNS = [
    { x: -166, z: -13.4, text: 'HOTEL', color: '#ff4fa3', hex: 0xff4fa3 },
    { x: -76, z: 13.4, text: 'SOLANA', color: '#22d3ee', hex: 0x22d3ee },
    { x: 14, z: -13.4, text: 'MARINA', color: '#ffd23e', hex: 0xffd23e },
    { x: 92, z: 13.4, text: 'BAHIA', color: '#7dff6a', hex: 0x7dff6a },
    { x: 154, z: -13.4, text: 'CLUB', color: '#ff8c42', hex: 0xff8c42 },
    { x: 202, z: 13.4, text: 'NEON', color: '#e0527a', hex: 0xe0527a },
  ];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1428, roughness: 0.8 });
  for (const s of NEON_SIGNS) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 8.4, 6), poleMat);
    pole.position.set(s.x, 4.2, s.z); scene.add(pole);
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 5.2),
      new THREE.MeshBasicMaterial({ map: TX.neonSignTexture(s.text, s.color), side: THREE.DoubleSide }));
    blade.position.set(s.x, 5.6, s.z); blade.rotation.y = s.z < 0 ? 0 : Math.PI; scene.add(blade);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlowTex, color: s.hex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(s.x, 5.6, s.z); halo.scale.set(6, 9, 1); scene.add(halo);
    // the sign's colour bleeding onto the wet asphalt below
    const bleed = new THREE.Mesh(new THREE.PlaneGeometry(5, 11),
      new THREE.MeshBasicMaterial({ map: lampGlowTex, color: s.hex, transparent: true, opacity: 0.20, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    bleed.rotation.x = -Math.PI / 2; bleed.position.set(s.x, 0.05, s.z * 0.55); bleed.renderOrder = 2; scene.add(bleed);
  }

  // beach umbrellas on Coral Strand, like the ones in every holiday photo
  const umbMat = new THREE.MeshStandardMaterial({ color: 0xff5c7a, roughness: 0.8, side: THREE.DoubleSide });
  const umbMat2 = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const u = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), lampMat); pole.position.y = 1.3; u.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.7, 8), i % 2 ? umbMat : umbMat2); top.position.y = 2.7; top.castShadow = true; u.add(top);
    u.position.set(234 + (i % 2) * 6, 0, -120 + i * 32);
    scene.add(u);
  }

  // remaining Sunset Stars: avenue median, beach, garage forecourt, heights
  world.starSpots.push(
    { x: -29, z: 0 }, { x: 236, z: -60 }, { x: -150, z: 138 }, { x: -174, z: -116 },
    { x: 58, z: -174 }, { x: -58, z: 58 }, { x: 116, z: 116 }, { x: 0, z: -58 },
  );

  world.nearestRoadPoint = (x, z) => {
    const rx = ROAD_CENTERS.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
    const rz = ROAD_CENTERS.reduce((a, b) => Math.abs(b - z) < Math.abs(a - z) ? b : a);
    return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
  };
  world.collide = (x, z, r) => {
    let px = x, pz = z;
    for (const c of world.colliders) {
      const nx = clamp(px, c.minX, c.maxX), nz = clamp(pz, c.minZ, c.maxZ);
      const dx = px - nx, dz = pz - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); px = nx + (dx / d) * r; pz = nz + (dz / d) * r; }
        else { // centre inside the box: push out along the smallest exit
          const exits = [px - c.minX + r, c.maxX - px + r, pz - c.minZ + r, c.maxZ - pz + r];
          const m = Math.min(...exits);
          if (m === exits[0]) px = c.minX - r; else if (m === exits[1]) px = c.maxX + r;
          else if (m === exits[2]) pz = c.minZ - r; else pz = c.maxZ + r;
        }
      }
    }
    return { x: px, z: pz };
  };
  world.districtAt = districtAt;
  return world;
}

// Keeps the sun and its shadow frustum centred on the action.
export function updateSun(world, focus) {
  world.focus.copy(focus);
  world.sun.position.set(focus.x - 190, 95, focus.z - 26);
  world.sunTarget.position.copy(focus);
}
