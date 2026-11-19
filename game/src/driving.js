// Palm Shores — driving.js
// Car handling: arcade physics with per-type top speed, acceleration and
// turn rate, speed-scaled steering, braking and a little drift; entering
// and exiting cars; and the chase camera that swings behind the car.

import * as THREE from 'three';

export class Driving {
  constructor(scene, city, traffic) {
    this.scene = scene;
    this.city = city;
    this.traffic = traffic;
    this.car = null;        // current car group, or null when on foot
    this.camYaw = 0;        // chase camera yaw (smoothed)
    this.speedKmh = 0;
  }

  get driving() { return this.car !== null; }

  enter(carGroup) {
    this.traffic.removeFromTraffic(carGroup);
    this.car = carGroup;
    const c = carGroup.userData.car;
    c.speed = 0;
    c.steer = 0;
    this.camYaw = carGroup.rotation.y;
    return c.spec.label;
  }

  exit(player) {
    if (!this.car) return;
    const g = this.car;
    const side = new THREE.Vector3(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y));
    player.pos.set(g.position.x + side.x * 2.4, 0, g.position.z + side.z * 2.4);
    player.group.position.copy(player.pos);
    player.group.visible = true;
    // Leave the car parked where it stopped; it stays stealable.
    this.traffic.stealables.push(g);
    this.traffic.parked.push(g);
    this.car = null;
    this.speedKmh = 0;
  }

  update(dt, input, camera, player, onCollision) {
    if (!this.car) return;
    const g = this.car;
    const c = g.userData.car;
    const spec = c.spec;

    const axes = input.moveAxes();
    const throttle = axes.y; // W forward, S brake/reverse
    const steerInput = -axes.x; // A left, D right (relative to facing)

    // Steering: full lock at low speed, less at high speed, with smoothing.
    // Space is the handbrake: it kills speed fast and sharpens the turn
    // so the car can swing around a corner.
    const handbrake = input.down('Space') && Math.abs(c.speed) > 2;
    const speedFactor = THREE.MathUtils.clamp(Math.abs(c.speed) / spec.top, 0, 1);
    const targetSteer = steerInput * spec.turn * (1 - speedFactor * 0.55) * (handbrake ? 1.6 : 1);
    c.steer += (targetSteer - c.steer) * Math.min(1, dt * 8);

    if (throttle > 0) c.speed += spec.accel * dt;
    else if (throttle < 0) {
      if (c.speed > 0.5) c.speed -= spec.brake * dt; // braking
      else c.speed -= spec.accel * 0.6 * dt;        // reversing
    } else {
      c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 6 * dt); // drag
    }
    if (handbrake) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 26 * dt);
    c.speed = THREE.MathUtils.clamp(c.speed, -spec.top * 0.45, spec.top);

    // Turn only while moving; reverse flips the steering.
    const dirSign = c.speed >= 0 ? 1 : -1;
    g.rotation.y += c.steer * dirSign * Math.min(1, Math.abs(c.speed) / 6) * dt * 0.9;

    const forward = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
    const nx = g.position.x + forward.x * c.speed * dt;
    const nz = g.position.z + forward.z * c.speed * dt;

    // Building collision: slide along the wall, lose speed, thud.
    const fixed = this.city.collide(nx, nz, 1.6);
    const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
    if (hitWall) {
      if (Math.abs(c.speed) > 8) onCollision?.(Math.abs(c.speed));
      c.speed *= 0.35;
    }
    g.position.x = THREE.MathUtils.clamp(fixed.x, -124, 124);
    g.position.z = THREE.MathUtils.clamp(fixed.z, -124, 138);

    // Bump traffic cars: simple circle push + speed loss.
    for (const other of this.traffic.cars) {
      const og = other.group;
      const d = Math.hypot(og.position.x - g.position.x, og.position.z - g.position.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const px = (og.position.x - g.position.x) / d;
        const pz = (og.position.z - g.position.z) / d;
        og.position.x += px * push;
        og.position.z += pz * push;
        if (Math.abs(c.speed) > 6) {
          onCollision?.(Math.abs(c.speed) * 0.7);
          c.speed *= 0.7;
        }
      }
    }

    // Wheel spin + front-wheel steer visual.
    const spin = (c.speed * dt) / 0.34;
    c.wheels.forEach((w, i) => {
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = c.steer * 0.28;
    });

    this.speedKmh = Math.abs(c.speed) * 3.6;

    // Chase camera: swing behind the car, height by speed.
    let dy = g.rotation.y - this.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.camYaw += dy * Math.min(1, dt * 3.2);
    const back = 8.5 + speedFactor * 2.5;
    const tx = g.position.x - Math.sin(this.camYaw) * back;
    const tz = g.position.z - Math.cos(this.camYaw) * back;
    const ty = 3.4 + speedFactor * 0.8;
    camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 6));
    camera.lookAt(g.position.x, g.position.y + 1.4, g.position.z);

    // Keep the on-foot player hidden inside the car.
    player.group.position.copy(g.position);
    player.group.position.y = -2;
  }
}
