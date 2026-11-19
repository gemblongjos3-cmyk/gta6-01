// The story of Palm Shores: eight jobs for Mara Voss, dispatched by Luna.
// A small stage engine drives them — go somewhere, pick something up, lose
// the police, deliver the car, clear the docks, tail a courier, and finally
// the Paper Moon run and the Star Run race that end the story.

import * as THREE from 'three';
import { dist2d, clamp } from './random.js';

export const MISSIONS = [
  { title: 'Salt & Static', reward: { cash: 300, xp: 150 }, intro: 'Warm-up, Mara. Your Vespera is parked on the Strand. Take a package to the Hotel Solana — gently, it is glass.',
    stages: [
      { type: 'goto', x: 176, z: -6, label: 'Get to your Vespera GT on Coral Strand', needCar: false },
      { type: 'timedeliver', x: -70, z: 33, seconds: 150, label: 'Deliver the package to the Hotel Solana' },
    ] },
  { title: 'Borrowed Time', reward: { cash: 450, xp: 150 }, intro: 'A debtor in Palm Heights owes us a coupe. Take it — he will call the PD, so bring it home quick.',
    stages: [
      { type: 'goto', x: -174, z: -110, label: 'Take the coupe in Palm Heights', needCar: false, heat: 120 },
      { type: 'timedeliver', x: -150, z: 138, seconds: 170, label: 'Bring the coupe home to Bayline Garage' },
    ] },
  { title: 'Tail Lights', reward: { cash: 550, xp: 150 }, intro: 'A courier for the Velmara crew runs the avenue at dusk. Tail him — close enough to learn, far enough to live.',
    stages: [
      { type: 'chase', label: 'Tail the Velmara courier — stay on him', seconds: 5 },
      { type: 'goto', x: -58, z: -168, label: 'Follow him in to Isla Verde and mark the drop', needCar: true },
    ] },
  { title: 'Pier Nine', reward: { cash: 700, xp: 150 }, intro: 'The Velmara crew holds our ledger at Pier Nine. Three of them, armed. Take it back and bring me the book.',
    stages: [
      { type: 'clear', x: 285, z: 150, count: 3, label: 'Clear the Velmara crew off Pier Nine' },
      { type: 'goto', x: 322, z: 150, label: 'Pick up the ledger at the end of the pier', needCar: false },
    ] },
  { title: 'Heat Line', reward: { cash: 850, xp: 150 }, intro: 'A Tarpon Taxi downtown is carrying more than passengers. Lift it, lose the heat, park it at Bayline.',
    stages: [
      { type: 'goto', x: 58, z: 64, label: 'Lift the Tarpon Taxi downtown', needCar: false, heat: 210 },
      { type: 'evade', seconds: 20, label: 'Lose the Shores PD' },
      { type: 'deliver', x: -150, z: 138, label: 'Park it at Bayline Garage' },
    ] },
  { title: 'The Long Goodnight', reward: { cash: 1000, xp: 150 }, intro: 'The crew is throwing a goodbye party at a Strand villa. Crash it. Their driver will run — do not let him reach the bridge.',
    stages: [
      { type: 'clear', x: 205, z: -116, count: 4, label: 'Crash the villa party on Coral Strand' },
      { type: 'chase', label: 'Stop the fleeing driver', seconds: 4 },
    ] },
  { title: 'Paper Moon', reward: { cash: 1600, xp: 200 }, intro: 'Tonight we take the Pier Nine payroll. The scanners sweep in waves — when the alarms sing, you run, and you do not stop until Bayline.',
    stages: [
      { type: 'goto', x: 268, z: 138, label: 'Take the payroll at the Pier Nine warehouse', needCar: false, heat: 400 },
      { type: 'evade', seconds: 75, lock: 4, label: "Lose the cops before Luna's scanner window closes" },
      { type: 'deliver', x: -150, z: 138, label: 'Bring the money home' },
    ] },
  { title: 'Star Run', reward: { cash: 2200, xp: 250 }, intro: 'Last job, Mara. Six checkpoints, one rival, the whole city watching. Win the Star Run and the garage is ours.',
    stages: [
      { type: 'race', label: 'Win the Star Run — 6 checkpoints against the rival', checkpoints: [[58, 0], [116, -58], [58, -116], [-58, -58], [-116, 0], [-150, 138]] },
    ] },
];

export function createMissions(scene, ctx) {
  // the gold beacon: a shaft of light you drive into
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc92e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.visible = false; scene.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.2, 28),
    new THREE.MeshBasicMaterial({ color: 0xffc92e, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; ring.visible = false; scene.add(ring);

  const director = {
    index: ctx.save.missionsDone.length, // next mission to run
    active: null, stageIdx: 0, stageT: 0, unseenT: 0, tailT: 0,
    rival: null, rivalCp: 0, playerCp: 0,
    get current() { return this.active ? MISSIONS[this.active] : null; },
    get stage() { return this.current ? this.current.stages[this.stageIdx] : null; },
    available() { return !this.active && this.index < MISSIONS.length; },

    start(idx) {
      this.active = idx; this.stageIdx = 0; this.stageT = 0; this.unseenT = 0; this.tailT = 0;
      const m = this.current;
      ctx.say(m.intro, 'NEW JOB — CH ' + (idx + 1));
      this.beginStage();
      ctx.onMissionStart?.(m, idx);
    },
    beginStage() {
      const s = this.stage; this.stageT = 0; this.unseenT = 0;
      if (!s) return;
      if (s.heat) ctx.pd.raise(s.heat);
      if (s.lock) ctx.pd.lockFloor = s.lock;
      if (s.type === 'clear') ctx.spawnHostiles(s);
      if (s.type === 'chase') ctx.spawnChaseCar(s);
      if (s.type === 'race') { this.rivalCp = 0; this.playerCp = 0; ctx.spawnRival(s); }
      ctx.onStageStart?.(s, this.stageIdx, this.current.stages.length);
    },
    setMarker(x, z, show = true) {
      beam.visible = show; ring.visible = show;
      beam.position.set(x, 15, z); ring.position.set(x, 0.07, z);
    },
    completeStage() {
      const m = this.current;
      this.stageIdx++;
      ctx.pd.lockFloor = 0;
      if (this.stageIdx >= m.stages.length) this.completeMission();
      else { ctx.say(stageLine(this.stage), ''); this.beginStage(); }
    },
    completeMission() {
      const m = this.current, idx = this.active;
      this.active = null; this.index = idx + 1;
      ctx.giveReward(m.reward.cash, m.reward.xp, m.title);
      if (idx + 1 === 3) ctx.say('The WASP 6149 is yours now, Mara. Bayline keeps it oiled.', 'WEAPON UNLOCKED');
      else if (idx + 1 === 5) ctx.say('MARLIN 12 unlocked. Try not to redecorate the whole pier.', 'WEAPON UNLOCKED');
      else if (idx + 1 === 8) ctx.say('The garage is ours. Eight jobs, one legend. Palm Shores is yours now, Mara.', 'STORY COMPLETE');
      else ctx.say('Job done. The street noticed — respect travels fast here.', 'JOB COMPLETE');
      ctx.onMissionComplete?.(m, idx);
    },
    fail(reason) {
      if (!this.active && this.active !== 0) return;
      const idx = this.active;
      this.active = null; ctx.pd.lockFloor = 0;
      ctx.clearHostiles(); ctx.clearChase();
      ctx.say(reason + ' The job resets at the Bayline beacon.', 'JOB FAILED');
      ctx.onMissionFail?.(idx);
    },
    update(dt) {
      const s = this.stage;
      if (!s) { this.setMarker(-150, 138, this.available()); return; }
      const p = ctx.focusPos();
      this.stageT += dt;
      const arrive = (x, z, r = 4.2) => dist2d(p.x, p.z, x, z) < r;
      switch (s.type) {
        case 'goto': case 'pickup':
          this.setMarker(s.x, s.z);
          if (arrive(s.x, s.z) && (!s.needCar || ctx.inCar())) this.completeStage();
          break;
        case 'deliver':
          this.setMarker(s.x, s.z);
          if (arrive(s.x, s.z, 5) && ctx.inCar()) this.completeStage();
          break;
        case 'timedeliver':
          this.setMarker(s.x, s.z);
          if (arrive(s.x, s.z, 5) && ctx.inCar()) this.completeStage();
          else if (this.stageT > s.seconds) { ctx.say('Too slow — the buyer walked. Run it again.', ''); this.stageT = 0; }
          break;
        case 'evade': {
          this.setMarker(0, 0, false);
          if (this.stageT >= 12 && !ctx.pd.sighted) this.unseenT += dt; else this.unseenT = 0;
          if (this.unseenT >= 4 || (this.stageT > s.seconds && ctx.pd.stars <= ctx.pd.lockFloor && !ctx.pd.sighted)) this.completeStage();
          else if (this.stageT > s.seconds + 45) { ctx.say('The window closed. Shake them and the job continues.', ''); this.stageT = 30; }
          break;
        }
        case 'clear': {
          this.setMarker(s.x, s.z);
          if (ctx.hostilesAlive() === 0 && this.stageT > 1) this.completeStage();
          break;
        }
        case 'chase': {
          const car = ctx.chaseCar();
          if (!car) { this.completeStage(); break; }
          this.setMarker(car.mesh.position.x, car.mesh.position.z);
          const d = dist2d(p.x, p.z, car.mesh.position.x, car.mesh.position.z);
          if (d < 10) this.tailT += dt; else if (d > 95) { this.fail('You lost him in the traffic.'); break; }
          else this.tailT = Math.max(0, this.tailT - dt * 0.5);
          if (this.tailT >= s.seconds) { ctx.clearChase(); this.completeStage(); }
          break;
        }
        case 'race': {
          const cps = s.checkpoints;
          const mine = cps[this.playerCp], rivals = cps[this.rivalCp];
          if (mine) this.setMarker(mine[0], mine[1]);
          if (mine && arrive(mine[0], mine[1], 6.5)) { this.playerCp++; ctx.onCheckpoint?.(this.playerCp, cps.length); }
          const rival = ctx.rivalCar();
          if (rival && rivals && dist2d(rival.mesh.position.x, rival.mesh.position.z, rivals[0], rivals[1]) < 7) this.rivalCp++;
          if (this.rivalCp >= cps.length && this.playerCp < cps.length) { this.fail('The rival took the Star Run.'); ctx.clearChase(); }
          else if (this.playerCp >= cps.length) { ctx.clearChase(); this.completeStage(); }
          break;
        }
      }
      // objective text for the HUD dossier panel
      ctx.setObjective?.({
        chapter: this.active + 1, title: this.current.title.toUpperCase(),
        label: s.label, stage: this.stageIdx + 1, stages: this.current.stages.length,
        next: this.current.stages[this.stageIdx + 1]?.label ?? 'Bring it home',
        timer: s.type === 'timedeliver' ? Math.max(0, s.seconds - this.stageT) : (s.type === 'evade' ? Math.max(0, s.seconds - this.stageT) : null),
        sighted: ctx.pd.sighted,
      });
    },
  };
  return director;
}

function stageLine(s) {
  switch (s.type) {
    case 'evade': return 'Scanner window is open. Break their line of sight, Mara.';
    case 'deliver': return 'Cargo is aboard. Bring it home — Bayline Garage.';
    case 'race': return 'Six lights. Beat him to every one.';
    case 'clear': return 'Weapons free. Keep it clean, keep it quick.';
    case 'chase': return 'There he goes. Stay on his tail lights.';
    default: return 'On your way. The marker is gold, the clock is not your friend.';
  }
}

export function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
