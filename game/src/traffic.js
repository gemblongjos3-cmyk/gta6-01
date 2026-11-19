// Palm Shores — traffic.js
// AI cars that drive the road grid (right-hand lanes, random turns at
// intersections, slowing for the car ahead) plus parked cars the player
// can steal. Stealable cars are registered in `stealables`.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeCar } from './vehicles.js';

const CIVILIAN = ['hatch', 'sedan', 'coupe', 'pickup', 'van'];
const COLORS = [0xffb020, 0x2e86ff, 0xff2e88, 0x8a5a2b, 0xe8e8e8, 0x34d399, 0xc084fc, 0x94a3b8];

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];       // moving AI cars {group, axis, dir, lane, speed, targetSpeed}
    this.parked = [];     // parked groups (stealable)
    this.stealables = []; // all stealable groups incl. moving ones when slow
    this._spawnParked();
    this._spawnMoving(10);
  }

  _laneOffset(axis, dir) {
    // Right-hand traffic: offset +3 to the right of travel direction.
    return dir > 0 ? 3 : -3;
  }

  _spawnParked() {
    for (let i = 0; i < 12; i++) {
      const type = this.rng.pick(CIVILIAN);
      const g = makeCar(type, this.rng.pick(COLORS));
      const alongRoad = this.rng.chance(0.5);
      const road = this.rng.pick(WORLD.roads);
      const along = this.rng.range(-100, 100);
      // Park parallel to the road, just off the asphalt edge.
      const side = this.rng.chance(0.5) ? 1 : -1;
      if (alongRoad) {
        g.position.set(road + side * 8.6, 0, along);
        g.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        g.position.set(along, 0, road + side * 8.6);
        g.rotation.y = side > 0 ? 0 : Math.PI;
      }
      // Never park inside a building.
      if (this.city.insideBuilding(g.position.x, g.position.z, 2)) continue;
      this.scene.add(g);
      this.parked.push(g);
      this.stealables.push(g);
    }
  }

  _spawnMoving(n) {
    for (let i = 0; i < n; i++) {
      const type = this.rng.pick(CIVILIAN);
      const g = makeCar(type, this.rng.pick(COLORS));
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const road = this.rng.pick(WORLD.roads);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const along = this.rng.range(-110, 110);
      const lane = this._laneOffset(axis, dir);
      if (axis === 'x') {
        g.position.set(along, 0, road + lane);
        g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        g.position.set(road + lane, 0, along);
        g.rotation.y = dir > 0 ? 0 : Math.PI;
      }
      this.scene.add(g);
      const car = {
        group: g, axis, dir, road, lane,
        speed: this.rng.range(7, 11),
        targetSpeed: this.rng.range(8, 12),
        nextTurnAt: this.rng.range(20, 60),
      };
      this.cars.push(car);
      this.stealables.push(g);
    }
  }

  // Car ahead on the same lane, within `dist`? Used to avoid pile-ups.
  _aheadOf(car, dist) {
    for (const other of this.cars) {
      if (other === car || other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
      const a = car.axis === 'x' ? car.group.position.x : car.group.position.z;
      const b = other.axis === 'x' ? other.group.position.x : other.group.position.z;
      const gap = (b - a) * car.dir;
      if (gap > 0 && gap < dist) return true;
    }
    return false;
  }

  update(dt, playerPos) {
    for (const car of this.cars) {
      const g = car.group;
      const along = car.axis === 'x' ? g.position.x : g.position.z;
      // Turn at a random intersection: pick a new road to switch onto.
      car.nextTurnAt -= Math.abs(car.speed) * dt;
      if (car.nextTurnAt <= 0) {
        car.nextTurnAt = this.rng.range(25, 70);
        const atRoad = this.city.nearestRoad(along);
        if (Math.abs(along - atRoad) < 8 && this.rng.chance(0.6)) {
          // Switch axis: turn onto the crossing road.
          const newAxis = car.axis === 'x' ? 'z' : 'x';
          const newDir = this.rng.chance(0.5) ? 1 : -1;
          car.axis = newAxis; car.dir = newDir; car.road = atRoad;
          car.lane = this._laneOffset(newAxis, newDir);
          g.rotation.y = newAxis === 'x'
            ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2)
            : (newDir > 0 ? 0 : Math.PI);
          if (newAxis === 'x') g.position.z = atRoad + car.lane;
          else g.position.x = atRoad + car.lane;
        }
      }
      // Slow for traffic ahead or near the player.
      let target = car.targetSpeed;
      if (this._aheadOf(car, 10)) target = 0;
      const dp = new THREE.Vector3().subVectors(g.position, playerPos);
      if (dp.length() < 7 && car.speed > 4) target = Math.min(target, 4);
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 8 * dt);
      const step = car.speed * car.dir * dt;
      if (car.axis === 'x') {
        g.position.x += step;
        if (g.position.x > 118) g.position.x = -118;
        if (g.position.x < -118) g.position.x = 118;
      } else {
        g.position.z += step;
        if (g.position.z > 112) g.position.z = -118;
        if (g.position.z < -118) g.position.z = 112;
      }
      // Wheel spin.
      const spin = (car.speed * dt) / 0.34;
      for (const w of g.userData.car.wheels) w.rotation.x += spin;
    }
  }

  // Nearest stealable car within `radius` of a point (moving ones only
  // count when they are slow enough to grab).
  nearestStealable(pos, radius = 5) {
    let best = null, bd = radius;
    for (const g of this.stealables) {
      if (!g.parent) continue; // already taken / removed
      const d = Math.hypot(g.position.x - pos.x, g.position.z - pos.z);
      const moving = this.cars.find((c) => c.group === g);
      if (moving && Math.abs(moving.speed) > 3) continue;
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  removeFromTraffic(group) {
    const i = this.cars.findIndex((c) => c.group === group);
    if (i >= 0) this.cars.splice(i, 1);
    const p = this.parked.indexOf(group);
    if (p >= 0) this.parked.splice(p, 1);
    const s = this.stealables.indexOf(group);
    if (s >= 0) this.stealables.splice(s, 1);
  }
}
