// Palm Shores — city.js
// Builds the whole night city: road grid, towers with lit windows and neon
// signs, palm trees, street lamps, the docks and the water, plus the violet
// sky, moon, stars and slanting rain. Also owns the collision boxes and
// the road graph the traffic and pedestrians walk on.

import * as THREE from 'three';
import { WORLD, DISTRICTS, NIGHT } from './config.js';
import { facadeTexture, neonSignTexture, roadTexture, sidewalkTexture, waterTexture } from './textures.js';

const NEON_SIGNS = [
  { text: 'VESPER', sub: 'bar • lounge', color: '#ff2e88' },
  { text: 'PALM', sub: 'hotel', color: '#22d3ee' },
  { text: 'CORAL', sub: 'casino', color: '#f59e0b' },
  { text: 'NEON', sub: 'arcade', color: '#c084fc' },
  { text: 'TIDE', sub: 'seafood', color: '#34d399' },
  { text: 'ROOK', sub: 'pawn • 24h', color: '#fb7185' },
];

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];      // {minX,maxX,minZ,maxZ}
    this.lamps = [];          // {x,z,color} for wet streaks + minimap
    this.palms = [];
    this.neonSpots = [];      // {x,z,color} neon sign anchors
    this.rain = null;
    this.rainVel = null;
    this.buildings = [];
    this._build();
  }

  _addCollider(x, z, w, d) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // Push a circle (x,z,r) out of every building box. Returns corrected pos.
  collide(x, z, r) {
    for (const b of this.colliders) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // Dead centre: push along the smallest penetration axis.
          const px = Math.min(x - b.minX, b.maxX - x);
          const pz = Math.min(z - b.minZ, b.maxZ - z);
          if (px < pz) x = (x - b.minX < b.maxX - x) ? b.minX - r : b.maxX + r;
          else z = (z - b.minZ < b.maxZ - z) ? b.minZ - r : b.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  insideBuilding(x, z, pad = 0) {
    return this.colliders.some(b =>
      x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad);
  }

  districtAt(x, z) {
    let best = DISTRICTS[4], bd = Infinity;
    for (const d of DISTRICTS) {
      const dd = (x - d.cx) ** 2 + (z - d.cz) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  _build() {
    const { scene, rng } = this;
    scene.background = new THREE.Color(NIGHT.sky);
    scene.fog = new THREE.Fog(NIGHT.fog, NIGHT.fogNear, NIGHT.fogFar);

    // --- Ground ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420),
      new THREE.MeshStandardMaterial({ color: NIGHT.ground, roughness: 0.35, metalness: 0.55 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 40);
    scene.add(ground);

    // --- Roads (asphalt strips with lane dashes) ---
    const roadTex = roadTexture();
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.25, metalness: 0.6 });
    for (const r of WORLD.roads) {
      for (const [w, d, x, z] of [
        [WORLD.roadWidth, 260, r, 0],
        [260, WORLD.roadWidth, 0, r],
      ]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.02, z);
        scene.add(m);
      }
    }
    // Sidewalk slabs around each block.
    const walkTex = sidewalkTexture();
    const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.8, metalness: 0.1 });
    const blockCenters = [-69, -23, 23, 69];
    for (const bx of blockCenters) for (const bz of blockCenters) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), walkMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(bx, 0.03, bz);
      scene.add(m);
    }

    // --- Buildings ---
    const glowTex = glowTexture();
    let signIdx = 0;
    for (const bx of blockCenters) {
      for (const bz of blockCenters) {
        const district = this.districtAt(bx, bz);
        const hue = parseInt(district.color.slice(1), 16);
        const nB = rng.int(1, 3);
        for (let i = 0; i < nB; i++) {
          const w = rng.range(10, 18), d = rng.range(10, 18);
          const h = rng.range(12, bz > 40 ? 22 : 58);
          const ox = rng.range(-7, 7), oz = rng.range(-7, 7);
          const x = bx + ox, z = bz + oz;
          const floors = Math.max(3, Math.round(h / 5));
          const tex = facadeTexture(rng, (hue >> 16) % 360, floors, Math.max(3, Math.round(w / 3)));
          const mat = new THREE.MeshStandardMaterial({
            map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9,
            roughness: 0.85, metalness: 0.1,
          });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(x, h / 2, z);
          scene.add(b);
          this.buildings.push(b);
          this._addCollider(x, z, w + 0.4, d + 0.4);
          // Rooftop beacon for tall towers.
          if (h > 34) {
            const beacon = new THREE.Mesh(
              new THREE.SphereGeometry(0.5, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xff2244 }),
            );
            beacon.position.set(x, h + 0.6, z);
            scene.add(beacon);
          }
          // Neon sign on some buildings, facing the nearest road.
          if (rng.chance(0.45) && signIdx < NEON_SIGNS.length * 2) {
            const sign = NEON_SIGNS[signIdx % NEON_SIGNS.length];
            signIdx++;
            const st = neonSignTexture(sign.text, sign.color, sign.sub);
            const sm = new THREE.Mesh(
              new THREE.PlaneGeometry(11, 4.1),
              new THREE.MeshBasicMaterial({ map: st, transparent: true, side: THREE.DoubleSide }),
            );
            const faceRoad = Math.abs(x) > Math.abs(z) ? 0 : 1;
            sm.position.set(x + (faceRoad ? 0 : (x > 0 ? w / 2 + 0.2 : -w / 2 - 0.2)),
              Math.min(h * 0.55, 26), z + (faceRoad ? (z > 0 ? d / 2 + 0.2 : -d / 2 - 0.2) : 0));
            sm.rotation.y = faceRoad ? (z > 0 ? 0 : Math.PI) : (x > 0 ? Math.PI / 2 : -Math.PI / 2);
            scene.add(sm);
            this.neonSpots.push({ x: sm.position.x, z: sm.position.z, color: sign.color });
            // Fake wet-road streak under the sign: a long additive plane.
            const streak = new THREE.Mesh(
              new THREE.PlaneGeometry(3.2, 26),
              new THREE.MeshBasicMaterial({
                map: glowTex, color: new THREE.Color(sign.color),
                transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
              }),
            );
            streak.rotation.x = -Math.PI / 2;
            streak.rotation.z = faceRoad ? 0 : Math.PI / 2;
            streak.position.set(sm.position.x + (faceRoad ? 0 : (x > 0 ? 6 : -6)), 0.05,
              sm.position.z + (faceRoad ? (z > 0 ? 6 : -6) : 0));
            scene.add(streak);
          }
        }
      }
    }

    // --- Palms: dark silhouettes with a neon rim light feel ---
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 1 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x0d3319, roughness: 1 });
    const palm = (x, z, s = 1) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 6.5 * s, 7), trunkMat);
      trunk.position.y = 3.25 * s;
      trunk.rotation.z = 0.06;
      g.add(trunk);
      for (let i = 0; i < 7; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 3.4 * s, 4), frondMat);
        const a = (i / 7) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 1.3 * s, 6.6 * s, Math.sin(a) * 1.3 * s);
        frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
        g.add(frond);
      }
      g.position.set(x, 0, z);
      scene.add(g);
      this.palms.push(g);
    };
    for (const r of WORLD.roads) {
      for (let t = -110; t <= 110; t += 23) {
        if (rng.chance(0.5)) palm(r + 8.5, t, rng.range(0.85, 1.2));
        if (rng.chance(0.4)) palm(t, r + 8.5, rng.range(0.85, 1.15));
      }
    }
    for (let i = 0; i < 10; i++) palm(rng.range(96, 128), rng.range(112, 140), rng.range(0.9, 1.3));

    // --- Street lamps + wet streaks ---
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.6, metalness: 0.7 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (const r of WORLD.roads) {
      for (let t = -104; t <= 104; t += 26) {
        const x = r + 7, z = t;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(x, 3.5, z);
        scene.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), lampGlowMat);
        head.position.set(x, 7.1, z);
        scene.add(head);
        const streak = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 18),
          new THREE.MeshBasicMaterial({
            map: glowTex, color: 0xffc06a, transparent: true, opacity: 0.13,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        streak.rotation.x = -Math.PI / 2;
        streak.position.set(x - 1.5, 0.05, z);
        scene.add(streak);
        this.lamps.push({ x, z, color: '#ffc06a' });
      }
    }

    // --- Docks district (south edge) ---
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 34), pierMat);
      pier.position.set(-60 + i * 40, 0.6, 132);
      scene.add(pier);
      this._addCollider(-60 + i * 40, 132, 10, 30);
    }
    const containerColors = [0xb3402e, 0x2e6fb3, 0x3a9e4f, 0xc98a1b, 0x7a4fb3];
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(8, 3, 3.4),
        new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.7, metalness: 0.4 }),
      );
      const x = rng.range(-100, 100), z = rng.range(112, 126);
      c.position.set(x, 1.5 + (i % 3 === 0 ? 3 : 0), z);
      c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
      scene.add(c);
      this._addCollider(x, z, 8.4, 3.8);
    }
    // Two gantry cranes, simple frames with a floodlight each.
    for (const cx of [-40, 50]) {
      const crane = new THREE.Group();
      const cm = new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.6, metalness: 0.5 });
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), cm);
      leg1.position.set(-4, 13, 0);
      const leg2 = leg1.clone(); leg2.position.x = 4;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 1.4), cm);
      beam.position.set(0, 26, 0);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 22), cm);
      jib.position.set(0, 26, 8);
      crane.add(leg1, leg2, beam, jib);
      crane.position.set(cx, 0, 122);
      scene.add(crane);
      const flood = new THREE.PointLight(0xffe6b0, 60, 40, 1.8);
      flood.position.set(cx, 24, 122);
      scene.add(flood);
    }

    // --- Water ---
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 90),
      new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.15, metalness: 0.8 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, WORLD.waterZ + 30);
    scene.add(water);

    // --- Sky: moon, stars ---
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }),
    );
    moon.position.set(-140, 150, -190);
    moon.lookAt(0, 0, 0);
    scene.add(moon);
    const moonHalo = new THREE.Mesh(
      new THREE.CircleGeometry(15, 32),
      new THREE.MeshBasicMaterial({ color: 0x8fa8ff, transparent: true, opacity: 0.25, fog: false }),
    );
    moonHalo.position.copy(moon.position).multiplyScalar(1.001);
    moonHalo.lookAt(0, 0, 0);
    scene.add(moonHalo);
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const a = rng.range(0, Math.PI * 2), e = rng.range(0.15, 1.4), r = 380;
      starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      starPos[i * 3 + 1] = Math.sin(e) * r;
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xcdd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85,
    })));

    // --- Rain: slanted streaks in a box that follows the camera ---
    const RAIN_N = 900;
    const pos = new Float32Array(RAIN_N * 3);
    this.rainVel = new Float32Array(RAIN_N);
    for (let i = 0; i < RAIN_N; i++) {
      pos[i * 3] = rng.range(-60, 60);
      pos[i * 3 + 1] = rng.range(0, 40);
      pos[i * 3 + 2] = rng.range(-60, 60);
      this.rainVel[i] = rng.range(28, 42);
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
      color: 0x9fb4ff, size: 0.14, transparent: true, opacity: 0.55,
    }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    // A few real lights: moonlight + cold ambient.
    scene.add(new THREE.HemisphereLight(0x4a5a9e, 0x0c0a18, 0.9));
    const moonLight = new THREE.DirectionalLight(NIGHT.moon, 1.1);
    moonLight.position.set(-80, 120, -60);
    scene.add(moonLight);
  }

  updateRain(dt, center) {
    if (!this.rain) return;
    const p = this.rain.geometry.attributes.position;
    const arr = p.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= this.rainVel[i / 3] * dt;
      arr[i] += 4 * dt; // slant from the wind
      if (arr[i + 1] < 0) {
        arr[i + 1] = 38;
        arr[i] = center.x + (this.rng.next() - 0.5) * 120;
        arr[i + 2] = center.z + (this.rng.next() - 0.5) * 120;
      }
      // Keep the rain box centred on the player.
      arr[i] = center.x + ((arr[i] - center.x + 60) % 120 + 120) % 120 - 60;
      arr[i + 2] = center.z + ((arr[i + 2] - center.z + 60) % 120 + 120) % 120 - 60;
    }
    p.needsUpdate = true;
  }

  // Nearest road centre coordinate (for snapping traffic to lanes).
  nearestRoad(v) {
    let best = WORLD.roads[0], bd = Infinity;
    for (const r of WORLD.roads) {
      const d = Math.abs(v - r);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
}
