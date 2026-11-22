// Palm Shores — city.js
// One job: build the whole static city — night sky, road grid, lit buildings,
// neon signs, palms, lamps, the docks and the sea, rain and wet-road streaks.
import * as THREE from 'three';
import { WORLD, DISTRICTS } from './config.js';
import { buildingTexture, roadTexture, neonSignTexture, waterTexture, sidewalkTexture } from './textures.js';

const STREETS = [];
for (let v = -160; v <= 160; v += WORLD.streetSpacing) STREETS.push(v);

const SIGNS = [
  ['PALM SHORES', '#ff2e88'], ['NEON ROW', '#22d3ee'], ['VICE MILE', '#a855f7'],
  ['CORAL BAY', '#fb923c'], ['TACOS 24H', '#facc15'], ['HOTEL LUNA', '#ff9de2'],
  ['DOCKS 9', '#34d399'], ['BAR ANCHOR', '#f87171'], ['PIZZA NIGHT', '#fde047'],
];

function districtAt(x, z) {
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) {
    const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

export function buildCity(G) {
  const { scene, rng } = G;
  scene.background = new THREE.Color(0x0a0618);
  scene.fog = new THREE.Fog(0x0a0618, 90, 320);

  const ambient = new THREE.AmbientLight(0x8a7bd8, 0.85);
  scene.add(ambient);
  // Hemisphere wash keeps the night readable: violet sky, dark asphalt below.
  const hemi = new THREE.HemisphereLight(0x7c6bb8, 0x14161d, 0.55);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xbfc8ff, 0.9);
  moonLight.position.set(-80, 140, -60);
  scene.add(moonLight);

  // --- Sky: stars + moon ---
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = rng.range(0, Math.PI * 2), e = rng.range(0.15, 1.4), r = 420;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdde4ff, size: 1.6, sizeAttenuation: false })));
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xf5f0d8, fog: false }),
  );
  moon.position.set(-180, 190, -300); moon.lookAt(0, 0, 0);
  scene.add(moon);

  // --- Ground, roads, sidewalks ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size + 260, WORLD.size + 260),
    new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
  scene.add(ground);

  const roadTex = new THREE.CanvasTexture(roadTexture());
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.35, metalness: 0.45 });
  const walkTex = new THREE.CanvasTexture(sidewalkTexture());
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping; walkTex.repeat.set(40, 40);
  const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.9 });
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.size), walkMat);
  walk.rotation.x = -Math.PI / 2; walk.position.y = 0.0;
  scene.add(walk);
  for (const s of STREETS) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.roadWidth), roadMat.clone());
      road.material.map = roadTex.clone();
      road.material.map.needsUpdate = true;
      road.material.map.repeat.set(WORLD.size / 12, 1);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.position.set(horizontal ? 0 : s, 0.02, horizontal ? s : 0);
      scene.add(road);
    }
  }
  // Wet-road light streaks: cheap additive ribbons that fake rain-slick reflections.
  const streakMat = new THREE.MeshBasicMaterial({ color: 0x3d6bff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 26; i++) {
    const s = STREETS[Math.floor(rng.next() * STREETS.length)];
    const len = rng.range(18, 60);
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(0.5, 1.4), len), streakMat);
    streak.rotation.x = -Math.PI / 2;
    streak.rotation.z = rng.chance(0.5) ? 0 : Math.PI / 2;
    streak.position.set(rng.range(-170, 170), 0.05, rng.chance(0.5) ? s + rng.range(-3, 3) : rng.range(-170, 170));
    if (streak.rotation.z !== 0) streak.position.set(s + rng.range(-3, 3), 0.05, rng.range(-170, 170));
    scene.add(streak);
  }

  // --- Buildings with lit windows + neon signs ---
  const texVariants = [0, 60, 180, 280, 320, 200].map((hue) => {
    const t = new THREE.CanvasTexture(buildingTexture(rng, hue));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const signTextures = SIGNS.map(([text, color]) => {
    const t = new THREE.CanvasTexture(neonSignTexture(text, color));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0d0f16, roughness: 0.9 });
  let signIndex = 0;
  const colliders = [];
  for (let bx = -160; bx < 160; bx += WORLD.streetSpacing) {
    for (let bz = -160; bz < 160; bz += WORLD.streetSpacing) {
      if (bz >= 160) continue; // docks row stays open
      const cx = bx + WORLD.streetSpacing / 2, cz = bz + WORLD.streetSpacing / 2;
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const w = rng.range(10, 18), d = rng.range(10, 18);
        const h = rng.range(9, 46) * (Math.abs(cx) < 45 && Math.abs(cz) < 45 ? 1.5 : 1);
        const px = cx + rng.range(-7, 7), pz = cz + rng.range(-7, 7);
        const mat = new THREE.MeshStandardMaterial({ map: texVariants[Math.floor(rng.next() * texVariants.length)], roughness: 0.85 });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d); b.position.set(px, h / 2, pz);
        scene.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.4, 0.5, d + 0.4); roof.position.set(px, h + 0.25, pz);
        scene.add(roof);
        colliders.push({ x: px, z: pz, hw: w / 2, hd: d / 2 });
        // Neon sign on some buildings, facing a street.
        if (rng.chance(0.45)) {
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(rng.range(9, 15), 2.4),
            new THREE.MeshBasicMaterial({ map: signTextures[signIndex % signTextures.length], transparent: true }),
          );
          signIndex += 1;
          const face = rng.pick([0, 1, 2, 3]);
          sign.position.set(px + (face === 0 ? w / 2 + 0.15 : face === 1 ? -w / 2 - 0.15 : 0),
            rng.range(6, Math.max(7, h - 4)),
            pz + (face === 2 ? d / 2 + 0.15 : face === 3 ? -d / 2 - 0.15 : 0));
          sign.rotation.y = face === 0 ? Math.PI / 2 : face === 1 ? -Math.PI / 2 : face === 2 ? 0 : Math.PI;
          scene.add(sign);
        }
      }
    }
  }

  // --- Palm trees along the streets ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 7, 6);
  const frondGeo = new THREE.ConeGeometry(2.6, 1.6, 7);
  for (let i = 0; i < 90; i++) {
    const s = STREETS[Math.floor(rng.next() * STREETS.length)];
    const along = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 7.5 : -7.5;
    const px = rng.chance(0.5) ? s + side : along;
    const pz = rng.chance(0.5) ? along : s + side;
    if (pz > 168) continue;
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = rng.range(-0.08, 0.08);
    const crown = new THREE.Mesh(frondGeo, frondMat);
    crown.position.y = 7.4; crown.scale.y = 0.7;
    const crown2 = new THREE.Mesh(frondGeo, frondMat);
    crown2.position.y = 8.2; crown2.scale.set(0.7, 0.5, 0.7); crown2.rotation.y = 1.1;
    palm.add(trunk, crown, crown2);
    palm.position.set(px, 0, pz);
    palm.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(palm);
  }

  // --- Street lamps (a few real lights, the rest emissive) ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.6 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6);
  const bulbGeo = new THREE.SphereGeometry(0.32, 8, 6);
  let lampLights = 0;
  for (const s of STREETS) {
    for (const a of [-140, -60, 20, 100, 160]) {
      const px = s + 6, pz = a;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(px, 3.25, pz); scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, lampGlowMat);
      bulb.position.set(px, 6.6, pz); scene.add(bulb);
      if (lampLights < 10 && ((s + a) % 80 === 0)) {
        const light = new THREE.PointLight(0xffd9a0, 18, 34, 1.8);
        light.position.set(px, 6.4, pz); scene.add(light);
        lampLights += 1;
      }
    }
  }

  // --- Old Docks: piers, containers, cranes, sea ---
  const waterTex = new THREE.CanvasTexture(waterTexture());
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(24, 8);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 130),
    new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.25, metalness: 0.6, color: 0x9fd8ff }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WORLD.seaLevel, WORLD.dockZ + 58);
  scene.add(water);
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 1 });
  for (const px of [-90, 0, 90]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 34), pierMat);
    pier.position.set(px, 0.6, WORLD.dockZ + 12);
    scene.add(pier);
    colliders.push({ x: px, z: WORLD.dockZ + 12, hw: 8, hd: 17 });
  }
  const containerColors = [0xb45309, 0x0e7490, 0x991b1b, 0x166534, 0x6d28d9];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.8 }));
    const w = 9, h = 3.4, d = 3.4;
    const px = rng.range(-120, 120), pz = rng.range(150, 168);
    c.scale.set(w, h, d); c.position.set(px, h / 2 + (rng.chance(0.3) ? 3.4 : 0), pz);
    c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    scene.add(c);
    colliders.push({ x: px, z: pz, hw: 4.6, hd: 4.6 });
  }
  // Two dock cranes: simple A-frame silhouettes.
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
  for (const cx of [-60, 70]) {
    const crane = new THREE.Group();
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), craneMat);
    leg1.position.set(-3, 13, 0);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), craneMat);
    leg2.position.set(3, 13, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 1.6), craneMat);
    arm.position.set(6, 26, 0); arm.rotation.z = 0.35;
    crane.add(leg1, leg2, arm);
    crane.position.set(cx, 0, 168);
    scene.add(crane);
  }

  // --- Rain: points that fall and wrap around the camera ---
  const RAIN_COUNT = 1400;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPos[i * 3] = rng.range(-60, 60);
    rainPos[i * 3 + 1] = rng.range(0, 45);
    rainPos[i * 3 + 2] = rng.range(-60, 60);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0x9db8ff, size: 0.14, transparent: true, opacity: 0.55,
  }));
  scene.add(rain);

  return {
    colliders,
    streets: STREETS,
    districtAt,
    update(dt, camPos) {
      // Rain falls and follows the camera so it never runs out.
      const pos = rainGeo.attributes.position;
      for (let i = 0; i < RAIN_COUNT; i++) {
        let y = pos.getY(i) - dt * 34;
        if (y < 0) y = 45;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + dt * 2.5); // wind slant
      }
      pos.needsUpdate = true;
      rain.position.set(camPos.x, 0, camPos.z);
      waterTex.offset.y += dt * 0.02;
      waterTex.offset.x += dt * 0.005;
    },
  };
}

/** Snap a point to the nearest street line (used to spawn cars/peds on roads). */
export function nearestStreetCoord(v) {
  let best = STREETS[0], bd = Infinity;
  for (const s of STREETS) { const d = Math.abs(s - v); if (d < bd) { bd = d; best = s; } }
  return best;
}
