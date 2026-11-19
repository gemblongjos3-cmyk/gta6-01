// Palm Shores — missions.js
// The story chain: five missions from Rook, the fixer on the radio.
// Pickup, hot-wheels theft, a police escape, a docks shootout, and a
// neon finale. Each mission owns its objective, marker, timer and reward.

import * as THREE from 'three';
import { MISSION_REWARDS, DISPATCHER } from './config.js';
import { Guard } from './combat.js';

const V3 = (x, z) => new THREE.Vector3(x, 0, z);

const DEFS = [
  {
    id: 'pickup',
    title: 'First Pickup',
    briefing: 'New in town? Good. A package is waiting at the Vesper bar on Vesper Row. Pick it up, bring it to the docks warehouse. No questions, no cops.',
    reward: MISSION_REWARDS[0],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    briefing: 'A client wants a Shores GT, pink, no questions. One is parked near you — marked on the map. Steal it and bring it to the Marina garage. You have two and a half minutes.',
    reward: MISSION_REWARDS[1],
  },
  {
    id: 'tailshake',
    title: 'Tail Shake',
    briefing: 'You tripped a silent alarm. Cops are coming. Lose them and get to the hideout in Palm Court. Do not let them box you in.',
    reward: MISSION_REWARDS[2],
  },
  {
    id: 'docks',
    title: 'Docks Shootout',
    briefing: 'The crate at Pier 3 is ours, but the dock crew is armed and they know it. Clear them out, then grab the crate. Watch your health.',
    reward: MISSION_REWARDS[3],
  },
  {
    id: 'finale',
    title: 'Neon Run',
    briefing: 'Last job. Run the package through three checkpoints to the helipad at the docks. The whole city will be watching — so will the air unit. Make it count.',
    reward: MISSION_REWARDS[4],
  },
];

export class Missions {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.index = 0;          // current mission, 0..4; 5 = story done
    this.stage = 0;
    this.timer = 0;
    this.target = null;      // Vector3 or null
    this.targetRadius = 6;
    this.objective = '';
    this.active = false;
    this.guards = [];
    this.markedCar = null;
    this.checkpoint = 0;
    this.storyDone = false;
    // Events wired by main.js.
    this.events = {
      briefing: () => {}, objective: () => {}, reward: () => {},
      fail: () => {}, storyDone: () => {}, toast: () => {},
    };
    this.marker = this._makeMarker();
    this.marker.visible = false;
    scene.add(this.marker);
  }

  _makeMarker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd166, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    beam.position.y = 15;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.18, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    g.add(beam, ring);
    g.userData.ring = ring;
    return g;
  }

  _setTarget(x, z, radius, objective) {
    this.target = V3(x, z);
    this.targetRadius = radius;
    this.objective = objective;
    this.marker.position.set(x, 0, z);
    this.marker.visible = true;
    this.events.objective(objective);
  }

  _clearTarget() {
    this.target = null;
    this.marker.visible = false;
  }

  get current() { return DEFS[this.index] || null; }
  get done() { return this.index >= DEFS.length; }

  start(index = 0) {
    this.index = index;
    this.stage = 0;
    this.checkpoint = 0;
    this.active = true;
    this.storyDone = false;
    const def = this.current;
    if (!def) { this.active = false; return; }
    this.events.briefing(`${DISPATCHER}: ${def.briefing}`);
    this._enterStage(0);
  }

  _enterStage(stage, ctx) {
    this.stage = stage;
    const id = this.current?.id;
    if (id === 'pickup') {
      if (stage === 0) this._setTarget(-62, -62, 6, 'Pick up the package at the Vesper bar');
      else this._setTarget(58, 124, 7, 'Deliver the package to the docks warehouse');
    } else if (id === 'hotwheels') {
      this.timer = 150;
      const car = ctx.spawnMarkedCar('coupe', ctx.pos.x + 14, ctx.pos.z + 8);
      this.markedCar = car;
      this._setTarget(car.position.x, car.position.z, 6, 'Steal the pink Shores GT');
    } else if (id === 'tailshake') {
      ctx.police.addHeat(75, 'alarm', ctx.now);
      this.timer = 120;
      this._setTarget(-23, 23, 7, 'Reach the Palm Court hideout — lose the cops');
    } else if (id === 'docks') {
      this._setTarget(20, 126, 8, 'Reach Pier 3 at the docks');
    } else if (id === 'finale') {
      ctx.police.addHeat(100, 'finale', ctx.now);
      this.timer = 200;
      this.checkpoint = 0;
      this._setTarget(0, 0, 7, 'Checkpoint 1/3: Palm Court');
    }
  }

  _complete(ctx) {
    const def = this.current;
    ctx.addCash(def.reward);
    this.events.reward(`Mission complete: ${def.title} — +$${def.reward}`);
    this._clearTarget();
    this.index += 1;
    if (this.done) {
      this.active = false;
      this.storyDone = true;
      this.events.storyDone();
      this.events.objective('Story complete — free roam. Collect the palm coins!');
    } else {
      const next = this.current;
      this.events.briefing(`${DISPATCHER}: ${next.briefing}`);
      this._enterStage(0, ctx);
    }
  }

  _fail(ctx, reason) {
    this.events.fail(reason);
    // Retry the same mission from its first stage.
    this._clearTarget();
    this._clearGuards();
    this._enterStage(0, ctx);
  }

  _clearGuards() {
    for (const g of this.guards) g.remove();
    this.guards = [];
  }

  _atTarget(ctx) {
    if (!this.target) return false;
    return Math.hypot(ctx.pos.x - this.target.x, ctx.pos.z - this.target.z) < this.targetRadius;
  }

  update(dt, ctx) {
    if (!this.active || this.done) return;
    // Marker pulse.
    if (this.marker.visible) {
      this.marker.userData.ring.rotation.z += dt * 1.5;
      const s = 1 + Math.sin(ctx.now * 3) * 0.12;
      this.marker.userData.ring.scale.set(s, s, 1);
    }
    // Timers.
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._fail(ctx, 'Out of time — Rook is not happy. Try again.');
        return;
      }
    }
    const id = this.current.id;

    if (id === 'pickup') {
      if (this.stage === 0 && this._atTarget(ctx)) {
        this.events.toast('Package secured. Now get it to the docks.');
        this._enterStage(1, ctx);
      } else if (this.stage === 1 && this._atTarget(ctx)) {
        this._complete(ctx);
      }
    } else if (id === 'hotwheels') {
      if (this.stage === 0) {
        if (this.markedCar && ctx.driving && ctx.car === this.markedCar) {
          this.stage = 1;
          this._setTarget(69, -60, 7, 'Deliver the Shores GT to the Marina garage');
          this.events.toast('That is the one. Drive it to the garage — fast.');
        } else if (this.markedCar) {
          // Keep the marker glued to the car.
          this.marker.position.set(this.markedCar.position.x, 0, this.markedCar.position.z);
          this.target.set(this.markedCar.position.x, 0, this.markedCar.position.z);
        }
      } else if (this.stage === 1 && this._atTarget(ctx) && ctx.driving) {
        this._complete(ctx);
      }
    } else if (id === 'tailshake') {
      if (this._atTarget(ctx)) {
        ctx.police.clear();
        this.events.toast('You vanished. The heat is off.');
        this._complete(ctx);
      }
    } else if (id === 'docks') {
      if (this.stage === 0 && this._atTarget(ctx)) {
        this.stage = 1;
        this._setTarget(60, 132, 6, 'Clear the dock guards, then grab the crate');
        for (let i = 0; i < 5; i++) {
          const gx = 40 + (i % 3) * 9 - 8;
          const gz = 128 + Math.floor(i / 3) * 6;
          this.guards.push(new Guard(this.scene, gx, gz, this.rng));
        }
        this.events.toast('Guards on the pier — take them down!');
      } else if (this.stage === 1) {
        const alive = this.guards.filter((g) => !g.dead).length;
        if (alive === 0 && this.guards.length > 0) {
          this.stage = 2;
          this._setTarget(60, 132, 5, 'Grab the crate on Pier 3');
        }
      } else if (this.stage === 2 && this._atTarget(ctx)) {
        this._complete(ctx);
      }
    } else if (id === 'finale') {
      const points = [V3(0, 0), V3(-69, 69), V3(69, -69), V3(20, 132)];
      if (this._atTarget(ctx)) {
        this.checkpoint += 1;
        if (this.checkpoint >= points.length) {
          ctx.police.clear();
          this._complete(ctx);
        } else {
          const p = points[this.checkpoint];
          this._setTarget(p.x, p.z, 7, `Checkpoint ${this.checkpoint + 1}/3: ${this.checkpoint === 1 ? 'Coral Heights' : this.checkpoint === 2 ? 'Marina District' : 'Docks helipad'}`);
          this.events.toast(`Checkpoint ${this.checkpoint} cleared!`);
        }
      }
    }
  }

  // Guards shoot and take hits; called from the main loop.
  updateGuards(dt, ctx, combat) {
    for (const g of this.guards) {
      g.update(dt, ctx.pos, combat, (dmg) => {
        if (ctx.player.takeDamage(dmg)) ctx.onPlayerDown?.();
      });
    }
  }

  guardTargets() {
    return this.guards.map((g) => ({
      group: g.group, radius: g.radius, dead: g.dead,
      onHit: (dmg) => g.onHit(dmg),
    }));
  }
}
