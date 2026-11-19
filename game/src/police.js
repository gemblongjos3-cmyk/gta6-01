// The Shores PD: a five-star wanted system with cruiser pursuit and ramming
// AI, physical roadblocks at four stars, an evade model based on breaking
// line of sight, and a busted meter for when they finally corner you.

import * as THREE from 'three';
import { clamp, dist2d } from './random.js';
import { makeCarEntity, spinWheels } from './vehicles.js';

const CALLSIGNS = ['IBIS-43', 'TARPON-19', 'HERON-17', 'KESTREL-31', 'MARLIN-24', 'SANDPIPER-22', 'BONEFISH-08', 'EGRET-51'];
const COUNT_BY_STAR = [0, 2, 3, 4, 6, 8];

export function createPolice(scene, world, rng) {
  const cruisers = [];
  for (let i = 0; i < 8; i++) {
    const ent = makeCarEntity(scene, { kind: 'cruiser', police: true, model: 'SHORES PD CRUISER' });
    ent.driver = 'police'; ent.callsign = CALLSIGNS[i]; ent.active = false;
    ent.mesh.visible = false; ent.stuckT = 0; ent.reverseT = 0;
    cruisers.push(ent);
  }
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.7 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x181020, emissive: 0xff8c1a, emissiveIntensity: 1.8 });
  let roadblock = null, roadblockCooldown = 0;

  const pd = {
    heat: 0,            // 0..500; every 100 is a star
    lockFloor: 0,       // missions can pin a minimum wanted level
    sighted: true, evadeT: 0, bustedMeter: 0,
    onBusted: null,
    get stars() { return Math.max(this.lockFloor, Math.min(5, Math.floor(this.heat / 100))); },
    raise(amount) { this.heat = clamp(this.heat + amount, 0, 500); },
    clear() { this.heat = 0; this.lockFloor = 0; this.evadeT = 0; this.bustedMeter = 0; },

    entities() { return cruisers; },
    cruiserPositions() { return cruisers.filter(c => c.active).map(c => c.mesh.position); },

    unitsForHud(target) {
      const units = [];
      for (const c of cruisers) {
        if (!c.active || c.role === 'ROADBLOCK') continue; // roadblock crews are listed below
        const d = dist2d(c.mesh.position.x, c.mesh.position.z, target.x, target.z);
        units.push({ name: c.callsign, status: c.role || 'PURSUIT', dist: Math.round(d) });
      }
      if (roadblock) for (const c of roadblock.units) {
        const d = dist2d(c.mesh.position.x, c.mesh.position.z, target.x, target.z);
        units.push({ name: c.callsign, status: 'ROADBLOCK', dist: Math.round(d) });
      }
      return units.sort((a, b) => a.dist - b.dist);
    },

    placeUnit(idx, x, z, heading, role) {
      const c = cruisers[idx]; if (!c) return;
      c.active = true; c.mesh.visible = true; c.role = role; c.speed = 0;
      c.setPos(x, z, heading);
    },

    spawnRoadblockAt(x, z, roadIsVertical) {
      if (roadblock) this.clearRoadblock();
      this.buildBlock(x, z, roadIsVertical);
    },

    buildBlock(snapX, snapZ, roadIsVertical) {
      const snap = { x: snapX, z: snapZ };
      const units = [];
      const used = cruisers.filter(c => !c.active).slice(0, 2);
      used.forEach((c, i) => {
        c.active = true; c.role = 'ROADBLOCK'; c.mesh.visible = true; c.speed = 0;
        const off = (i === 0 ? -2.6 : 2.6);
        if (roadIsVertical) c.setPos(snap.x + off, snap.z + (i ? 3 : -3), Math.PI / 2 + (i ? -0.4 : 0.4));
        else c.setPos(snap.x + (i ? 3 : -3), snap.z + off, (i ? -0.4 : 0.4));
        units.push(c);
      });
      const barriers = [], colliders = [];
      for (let i = -1; i <= 1; i++) {
        const b = new THREE.Group();
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 0.35), barrierMat); slab.position.y = 0.55; slab.castShadow = true; b.add(slab);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 0.37), stripeMat); stripe.position.y = 0.72; b.add(stripe);
        if (roadIsVertical) b.position.set(snap.x + i * 3.4, 0, snap.z);
        else b.position.set(snap.x, 0, snap.z + i * 3.4);
        b.rotation.y = roadIsVertical ? Math.PI / 2 : 0;
        scene.add(b); barriers.push(b);
        const col = { minX: b.position.x - 1.1, maxX: b.position.x + 1.1, minZ: b.position.z - 1.1, maxZ: b.position.z + 1.1, temp: true };
        world.colliders.push(col); colliders.push(col);
      }
      roadblock = { units, barriers, colliders, x: snap.x, z: snap.z, ttl: 26 };
      roadblockCooldown = 30;
    },

    placeRoadblock(target, heading) {
      if (roadblock || roadblockCooldown > 0 || this.stars < 4) return;
      const ahead = 58;
      const px = target.x + Math.sin(heading) * ahead, pz = target.z + Math.cos(heading) * ahead;
      const snap = world.nearestRoadPoint(px, pz);
      const roadIsVertical = Math.abs(snap.x - px) < Math.abs(snap.z - pz);
      this.buildBlock(snap.x, snap.z, roadIsVertical);
    },

    clearRoadblock() {
      if (!roadblock) return;
      for (const c of roadblock.units) { c.active = false; c.mesh.visible = false; c.role = null; }
      for (const b of roadblock.barriers) scene.remove(b);
      world.colliders = world.colliders.filter(c => !roadblock.colliders.includes(c));
      roadblock = null;
    },

    update(dt, target, t) {
      roadblockCooldown = Math.max(0, roadblockCooldown - dt);
      const stars = this.stars;
      // --- evade model: unseen seconds bleed heat away
      let seen = false;
      for (const c of cruisers) if (c.active && dist2d(c.mesh.position.x, c.mesh.position.z, target.x, target.z) < 68) seen = true;
      if (target.heliNear) seen = true;
      this.sighted = seen || stars === 0;
      if (!seen && stars > this.lockFloor) { this.evadeT += dt; if (this.evadeT > 5) { this.heat = Math.max(this.lockFloor * 100, this.heat - 34 * dt); } }
      else this.evadeT = 0;
      // --- spawn / despawn to the star count
      const want = COUNT_BY_STAR[stars];
      let activeCount = cruisers.filter(c => c.active && c.role !== 'ROADBLOCK').length;
      for (const c of cruisers) {
        if (!c.active && activeCount < want) {
          const ang = rng() * Math.PI * 2, dist = rng() < 0.5 ? 78 : 105;
          const sx = target.x + Math.sin(ang) * dist, sz = target.z + Math.cos(ang) * dist;
          const snap = world.nearestRoadPoint(sx, sz);
          c.setPos(snap.x, snap.z, Math.atan2(target.x - snap.x, target.z - snap.z));
          c.active = true; c.mesh.visible = true; c.speed = 10; activeCount++;
        } else if (c.active && c.role !== 'ROADBLOCK') {
          const d = dist2d(c.mesh.position.x, c.mesh.position.z, target.x, target.z);
          if (d > 260 || (activeCount > want && d > 120)) { c.active = false; c.mesh.visible = false; activeCount--; }
        }
      }
      // --- pursuit driving
      const sorted = cruisers.filter(c => c.active && c.role !== 'ROADBLOCK')
        .sort((a, b) => dist2d(a.mesh.position.x, a.mesh.position.z, target.x, target.z) - dist2d(b.mesh.position.x, b.mesh.position.z, target.x, target.z));
      sorted.forEach((c, idx) => {
        const p = c.mesh.position;
        const lead = clamp(dist2d(p.x, p.z, target.x, target.z) / 30, 0, 1.1);
        const tx = target.x + (target.vx ?? 0) * lead, tz = target.z + (target.vz ?? 0) * lead;
        const wantHeading = Math.atan2(tx - p.x, tz - p.z);
        let dh = wantHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        const d = dist2d(p.x, p.z, target.x, target.z);
        c.role = d < 15 ? 'RAMMING' : (idx > 3 ? 'INTERCEPT' : 'PURSUIT');
        const maxSpeed = c.role === 'RAMMING' ? 47 : 43;
        if (c.reverseT > 0) { c.reverseT -= dt; c.speed = -7; }
        else {
          c.heading += clamp(dh, -1.85 * dt, 1.85 * dt);
          const goal = Math.abs(dh) > 1.15 ? 7 : maxSpeed;
          c.speed += clamp(goal - c.speed, -22 * dt, 9.5 * dt);
        }
        let nx = p.x + Math.sin(c.heading) * c.speed * dt;
        let nz = p.z + Math.cos(c.heading) * c.speed * dt;
        const fixed = world.collide(nx + Math.sin(c.heading) * 1.4, nz + Math.cos(c.heading) * 1.4, 1.1);
        nx += fixed.x - (nx + Math.sin(c.heading) * 1.4); nz += fixed.z - (nz + Math.cos(c.heading) * 1.4);
        if (Math.abs(fixed.x - (p.x + Math.sin(c.heading) * 1.4)) > 0.01 && Math.abs(c.speed) > 4) { c.stuckT += dt; } else c.stuckT = Math.max(0, c.stuckT - dt);
        if (c.stuckT > 0.7) { c.reverseT = 0.8; c.stuckT = 0; }
        // gentle separation so cruisers do not stack into one blob
        for (const o of cruisers) {
          if (o === c || !o.active) continue;
          const dx = nx - o.mesh.position.x, dz = nz - o.mesh.position.z, dd = Math.hypot(dx, dz);
          if (dd > 0.01 && dd < 4.2) { nx += (dx / dd) * (4.2 - dd) * 0.4; nz += (dz / dd) * (4.2 - dd) * 0.4; }
        }
        c.mesh.position.set(nx, 0, nz);
        c.mesh.rotation.y = c.heading;
        spinWheels(c, dt);
        // lightbar strobe
        if (c.mesh.userData.lightbar) {
          const ph = Math.floor(t * 7 + c.callsign.charCodeAt(0)) % 2;
          c.mesh.userData.lightbar.red.emissiveIntensity = ph ? 4.5 : 0.4;
          c.mesh.userData.lightbar.blue.emissiveIntensity = ph ? 0.4 : 4.5;
        }
        // contact with the target: a crunch and a heat bump is the caller's job
        if (d < 3.4 && Math.abs(c.speed) > 8) c.contacted = true; else if (d > 5) c.contacted = false;
      });
      // --- roadblock lifecycle
      if (roadblock) {
        roadblock.ttl -= dt;
        const d = dist2d(roadblock.x, roadblock.z, target.x, target.z);
        if (roadblock.ttl <= 0 || d > 130) this.clearRoadblock();
      } else if (stars >= 4 && target.inCar && Math.abs(target.speed ?? 0) > 12) {
        this.placeRoadblock(target, target.heading ?? 0);
      }
      // --- busted meter
      const cornered = (target.onFoot && sorted.some(c => dist2d(c.mesh.position.x, c.mesh.position.z, target.x, target.z) < 4.5))
        || (!target.onFoot && Math.abs(target.speed ?? 0) < 1.2 && sorted.filter(c => dist2d(c.mesh.position.x, c.mesh.position.z, target.x, target.z) < 7).length >= 2);
      if (cornered && stars > 0) { this.bustedMeter += dt; if (this.bustedMeter > 2.4 && this.onBusted) { this.onBusted(); this.bustedMeter = 0; } }
      else this.bustedMeter = Math.max(0, this.bustedMeter - dt * 1.6);
      return { stars, seen };
    },
  };
  return pd;
}
