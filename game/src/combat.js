// Combat: the three-weapon wheel (KESTREL 9, WASP 6149, MARLIN 12), hitscan
// shooting with tracers and muzzle flash, and the rival-crew hostiles who
// guard two of the story jobs. Weapons unlock as the story advances.

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp, dist2d } from './random.js';
import { glowTexture } from './textures.js';

export function createCombat(scene) {
  const state = WEAPONS.map(w => ({ mag: w.magazine, reserve: w.reserve === Infinity ? Infinity : w.reserve }));
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
  const flashTex = glowTexture('rgba(255,220,150,1)', 'rgba(255,140,40,0)');
  const hostiles = [];

  const combat = {
    current: 0, wheelOpen: false, lastShot: -999, reloadingUntil: 0,
    onShoot: null, onHostileDown: null, onPlayerHit: null,
    unlocked(idx, missionsDone) { return missionsDone >= WEAPONS[idx].unlockMission; },
    weapon() { return WEAPONS[this.current]; },
    ammo() { return state[this.current]; },
    cycle(missionsDone) {
      for (let n = 1; n <= 3; n++) { const i = (this.current + n) % 3; if (this.unlocked(i, missionsDone)) { this.current = i; return; } }
    },
    select(idx, missionsDone) { if (this.unlocked(idx, missionsDone)) this.current = idx; },
    reload(now) {
      const w = this.weapon(), s = this.ammo();
      if (s.mag >= w.magazine || s.reserve <= 0) return;
      const take = Math.min(w.magazine - s.mag, s.reserve);
      s.mag += take; if (s.reserve !== Infinity) s.reserve -= take;
      this.reloadingUntil = now + 700;
    },
    tryFire(now, origin, dir, world, missionsDone) {
      const w = this.weapon(), s = this.ammo();
      if (now - this.lastShot < w.rate || now < this.reloadingUntil || this.wheelOpen) return false;
      if (s.mag <= 0) { this.reload(now); return false; }
      this.lastShot = now; s.mag--;
      this.onShoot?.(w);
      for (let p = 0; p < w.pellets; p++) {
        const d = dir.clone();
        d.x += (Math.random() - 0.5) * w.spread * 2; d.y += (Math.random() - 0.5) * w.spread; d.z += (Math.random() - 0.5) * w.spread * 2;
        d.normalize();
        this.trace(origin, d, w, world);
      }
      return true;
    },
    trace(origin, dir, w, world) {
      // step the ray: buildings stop it, hostiles take it
      let hitPoint = null, hitHostile = null;
      for (let t = 1; t < 70; t += 1) {
        const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
        if (py < 0) { hitPoint = new THREE.Vector3(px, 0, pz); break; }
        let blocked = false;
        for (const c of world.colliders) if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ && py < 14) { blocked = true; break; }
        if (blocked) { hitPoint = new THREE.Vector3(px, py, pz); break; }
        for (const h of hostiles) {
          if (h.dead) continue;
          const hp = h.mesh.position;
          if (Math.abs(px - hp.x) < 0.55 && Math.abs(pz - hp.z) < 0.55 && py > 0.2 && py < 1.9) { hitHostile = h; hitPoint = new THREE.Vector3(px, py, pz); break; }
        }
        if (hitHostile) break;
      }
      const end = hitPoint ?? origin.clone().add(dir.clone().multiplyScalar(70));
      const len = origin.distanceTo(end);
      const geo = new THREE.BoxGeometry(0.03, 0.03, len);
      const m = new THREE.Mesh(geo, tracerMat);
      m.position.copy(origin).lerp(end, 0.5);
      m.lookAt(end); m.userData.ttl = 0.07;
      scene.add(m); tracers.push(m);
      if (hitHostile) {
        hitHostile.hp -= w.damage;
        hitHostile.flash = 0.12;
        if (hitHostile.hp <= 0 && !hitHostile.dead) {
          hitHostile.dead = true; hitHostile.deathT = 0;
          this.onHostileDown?.(hitHostile);
        }
      }
    },
    spawnHostile(x, z, opts = {}) {
      const g = new THREE.Group();
      const jacket = new THREE.MeshStandardMaterial({ color: opts.color ?? 0xd94f70, roughness: 0.8 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.24), jacket); torso.position.y = 1.12; torso.castShadow = true; g.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), new THREE.MeshStandardMaterial({ color: 0xc98a5e })); head.position.y = 1.62; g.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x1d1a26 })); legs.position.y = 0.42; g.add(legs);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111116 })); gun.position.set(0.3, 1.25, 0.3); g.add(gun);
      g.position.set(x, 0, z); scene.add(g);
      const h = { mesh: g, hp: opts.hp ?? 100, dead: false, flash: 0, burstT: Math.random() * 2, home: { x, z }, name: opts.name ?? 'RIVAL' };
      hostiles.push(h);
      return h;
    },
    clearHostiles() { for (const h of hostiles) scene.remove(h.mesh); hostiles.length = 0; },
    hostilesAlive() { return hostiles.filter(h => !h.dead); },
    update(dt, playerPos, playerAlive) {
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].userData.ttl -= dt;
        if (tracers[i].userData.ttl <= 0) { scene.remove(tracers[i]); tracers[i].geometry.dispose(); tracers.splice(i, 1); }
      }
      for (const h of hostiles) {
        const p = h.mesh.position;
        if (h.flash > 0) { h.flash -= dt; h.mesh.children[0].material.emissive = new THREE.Color(0x881111); }
        else h.mesh.children[0].material.emissive = new THREE.Color(0x000000);
        if (h.dead) {
          h.deathT = (h.deathT ?? 0) + dt;
          h.mesh.rotation.x = Math.min(Math.PI / 2, h.deathT * 4);
          h.mesh.position.y = Math.max(0.1, 0.35 - h.deathT * 0.2);
          continue;
        }
        if (!playerAlive) continue;
        const d = dist2d(p.x, p.z, playerPos.x, playerPos.z);
        h.mesh.rotation.y = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
        if (d > 15) { // close the distance
          p.x += Math.sin(h.mesh.rotation.y) * dt * 2.6; p.z += Math.cos(h.mesh.rotation.y) * dt * 2.6;
        } else if (d < 7) { // keep some nerve
          p.x -= Math.sin(h.mesh.rotation.y) * dt * 1.4; p.z -= Math.cos(h.mesh.rotation.y) * dt * 1.4;
        }
        h.burstT -= dt;
        if (d < 30 && h.burstT <= 0) {
          h.burstT = 1.1 + Math.random() * 1.4;
          const hitChance = clamp(0.62 - d * 0.013, 0.12, 0.6);
          if (Math.random() < hitChance) this.onPlayerHit?.(7 + Math.random() * 6);
          // their tracer, from gun height toward the player
          const from = new THREE.Vector3(p.x, 1.3, p.z);
          const to = new THREE.Vector3(playerPos.x, 1.1, playerPos.z);
          const len = from.distanceTo(to);
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len), tracerMat);
          m.position.copy(from).lerp(to, 0.5); m.lookAt(to); m.userData.ttl = 0.06;
          scene.add(m); tracers.push(m);
        }
      }
    },
  };
  return combat;
}
