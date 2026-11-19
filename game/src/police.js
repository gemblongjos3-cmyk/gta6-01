// Palm Shores — police.js
// Wanted level: heat rises with witnessed crimes and decays when the
// player is out of sight; cruisers spawn, pursue, and ram; hitting a
// cruiser or a cop raises the heat further.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { makeCar, updateLightBar } from './vehicles.js';

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.stars = 0;
    this.lastCrimeAt = -100;
    this.cruisers = []; // {group, speed, stuck}
    this.onCrime = null; // callback(stars) for HUD flashes
  }

  addHeat(amount, kind, now) {
    this.heat = Math.min(WANTED.heatPerStar * WANTED.maxStars, this.heat + amount);
    this.lastCrimeAt = now;
    const stars = this.starCount();
    if (stars !== this.stars) {
      this.stars = stars;
      this.onCrime?.(stars, kind);
    }
  }

  starCount() {
    return Math.min(WANTED.maxStars, Math.floor(this.heat / WANTED.heatPerStar));
  }

  decay(dt, now, playerVisible) {
    if (this.heat <= 0) return;
    if (now - this.lastCrimeAt > WANTED.decayDelay && !playerVisible) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSec * dt);
      const stars = this.starCount();
      if (stars !== this.stars) { this.stars = stars; this.onCrime?.(stars, 'decay'); }
    }
  }

  // Is any cruiser close enough to see the player?
  playerSeenByPolice(playerPos) {
    return this.cruisers.some((c) =>
      Math.hypot(c.group.position.x - playerPos.x, c.group.position.z - playerPos.z) < 26);
  }

  _spawnCruiser(playerPos) {
    const g = makeCar('cruiser');
    // Spawn on a road 30-45 units away from the player.
    const road = this.rng.pick([-92, -46, 0, 46, 92]);
    const angle = this.rng.range(0, Math.PI * 2);
    const x = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * 38, -115, 115);
    const z = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * 38, -115, 115);
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(playerPos.x - x, playerPos.z - z);
    this.scene.add(g);
    this.cruisers.push({ group: g, speed: 0, stuck: 0, ramAt: -10 });
  }

  _despawnCruiser(c) {
    this.scene.remove(c.group);
    const i = this.cruisers.indexOf(c);
    if (i >= 0) this.cruisers.splice(i, 1);
  }

  update(dt, now, playerPos, playerDriving, onRam) {
    const want = WANTED.cruisersPerStar[this.starCount()];
    while (this.cruisers.length < want) this._spawnCruiser(playerPos);
    while (this.cruisers.length > want) this._despawnCruiser(this.cruisers[0]);

    for (const c of this.cruisers) {
      const g = c.group;
      const spec = g.userData.car.spec;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, g.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
      let dy = targetYaw - g.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      // Pursuit steering: sharper when close, gentler at speed.
      const steer = THREE.MathUtils.clamp(dy * 1.6, -1, 1) * spec.turn * 0.55;
      g.rotation.y += steer * dt * Math.min(1, Math.abs(c.speed) / 5 + 0.3);
      const targetSpeed = dist > 8 ? spec.top * 0.95 : spec.top * 0.55;
      c.speed += Math.sign(targetSpeed - c.speed) * Math.min(Math.abs(targetSpeed - c.speed), 18 * dt);
      const forward = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
      const nx = g.position.x + forward.x * c.speed * dt;
      const nz = g.position.z + forward.z * c.speed * dt;
      const fixed = this.city.collide(nx, nz, 1.6);
      if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
        c.speed *= 0.4; // scrape the wall, keep chasing
        c.stuck += dt;
        if (c.stuck > 2.5) { // truly stuck: respawn near the player
          c.stuck = 0;
          const angle = this.rng.range(0, Math.PI * 2);
          g.position.set(
            THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * 34, -115, 115), 0,
            THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * 34, -115, 115));
          g.rotation.y = Math.atan2(playerPos.x - g.position.x, playerPos.z - g.position.z);
        }
      } else c.stuck = 0;
      g.position.x = THREE.MathUtils.clamp(fixed.x, -124, 124);
      g.position.z = THREE.MathUtils.clamp(fixed.z, -124, 138);
      const spin = (c.speed * dt) / 0.34;
      for (const w of g.userData.car.wheels) w.rotation.x += spin;
      updateLightBar(g, now);

      // Ram: contact with the player damages them / their car. A cruiser
      // needs 1.2 s to back off and line up the next hit, so one touch
      // is one hit instead of a frame-by-frame shredder.
      if (dist < 3.6 && now - c.ramAt > 1.2) {
        c.ramAt = now;
        onRam?.(c.speed, playerDriving);
        c.speed *= -0.25; // bounce back off the ram
        g.position.addScaledVector(forward, -1.2);
      }
    }
  }

  // Police give up entirely (mission escape / cheat-free reset).
  clear() {
    this.heat = 0;
    this.stars = 0;
    while (this.cruisers.length) this._despawnCruiser(this.cruisers[0]);
  }
}
