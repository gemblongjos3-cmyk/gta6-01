// Palm Shores — missions.js
// One job: the 5-mission story chain — objectives, world markers, timers,
// cash rewards and Reno's radio briefings. main.js calls update() every frame.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { spawnThugs } from './pedestrians.js';
import { createCar } from './vehicles.js';

function makeMarker(G, x, z, color = 0xff2e88) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 4;
  group.add(beam, ring, diamond);
  group.position.set(x, 0, z);
  group.userData.diamond = diamond;
  G.scene.add(group);
  return group;
}

function removeMarker(G) {
  if (G.marker) { G.scene.remove(G.marker); G.marker = null; }
}

export function missionTitle(G) {
  const m = MISSIONS[G.missionIndex];
  return m ? m.title : 'Semua misi selesai';
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  if (!m) { G.mission = null; G.objective = 'Palm Shores milikmu sekarang. Bebas berkeliaran!'; return; }
  removeMarker(G);
  G.mission = { def: m, stage: 0, timer: m.timeLimit ?? 0, tailTime: 0, surviveTime: 0, kills: 0, thugs: [], targetCar: null };
  G.objective = m.title;
  G.showBrief(m.brief);
  G.audio.chime();
  if (m.kind === 'pickup-deliver') {
    G.marker = makeMarker(G, m.pickup[0], m.pickup[1], 0xffd166);
    G.objective = 'Ambil paket di Neon Row';
  } else if (m.kind === 'tail') {
    const car = createCar(G, 'taxi', m.target[0], m.target[1], 0, { traffic: true, targetSpeed: 11, routeAxis: 'x', routeCoord: m.target[1], direction: 1 });
    car.driver = 'ai';
    G.mission.targetCar = car;
    G.objective = 'Ikuti taksi kuning — jangan terlalu dekat';
  } else if (m.kind === 'escape') {
    G.addWanted(3, 'Misi: kabur dari kejaran');
    G.objective = 'Hilang dari kejaran polisi (60 dtk)';
  } else if (m.kind === 'shootout') {
    G.marker = makeMarker(G, m.site[0], m.site[1], 0xff2020);
    G.mission.thugs = spawnThugs(G, m.site[0], m.site[1], m.killsNeeded);
    G.objective = `Habisi geng dermaga (0/${m.killsNeeded})`;
  } else if (m.kind === 'getaway') {
    const car = createCar(G, 'muscle', m.carAt[0], m.carAt[1], Math.PI / 2, { parked: true, color: 0x7c3aed });
    G.mission.targetCar = car;
    G.marker = makeMarker(G, m.carAt[0], m.carAt[1], 0xa855f7);
    G.objective = 'Ambil Night Muscle di Vice Mile';
  }
}

function completeMission(G) {
  const m = G.mission.def;
  G.player.cash += m.reward;
  G.showMessage(`MISI SELESAI — +$${m.reward}`);
  G.showBrief(`Reno: "Bagus. $${m.reward} sudah masuk. Misi berikutnya menunggumu."`);
  G.audio.missionDone();
  removeMarker(G);
  G.missionIndex += 1;
  G.mission = null;
  G.saveGame();
  startMission(G, G.missionIndex);
}

function failMission(G, why) {
  G.showMessage(`MISI GAGAL — ${why}`);
  G.showBrief('Reno: "Gagal. Coba lagi dari awal misi ini."');
  removeMarker(G);
  if (G.mission?.thugs) for (const t of [...G.mission.thugs]) { const i = G.peds.indexOf(t); if (i >= 0) G.peds.splice(i, 1); G.scene.remove(t.mesh); }
  G.mission = null;
  startMission(G, G.missionIndex);
}

function near(x, z, px, pz, r) { return Math.hypot(x - px, z - pz) < r; }

export function updateMissions(G, dt) {
  const mission = G.mission;
  if (G.marker) {
    G.marker.rotation.y += dt * 1.2;
    G.marker.userData.diamond.position.y = 4 + Math.sin(G.time * 2.4) * 0.5;
    G.marker.userData.diamond.rotation.y += dt * 2;
  }
  if (!mission) return;
  const m = mission.def;
  const p = G.player.pos;
  mission.timer -= dt;
  if (mission.timer <= 0) { failMission(G, 'waktu habis'); return; }
  if (m.kind === 'pickup-deliver') {
    if (mission.stage === 0 && near(m.pickup[0], m.pickup[1], p.x, p.z, 5)) {
      mission.stage = 1;
      removeMarker(G);
      G.marker = makeMarker(G, m.deliver[0], m.deliver[1], 0x34d399);
      G.objective = 'Antar paket ke Old Docks';
      G.showMessage('Paket diambil. Antar ke dermaga!');
      G.audio.chime();
    } else if (mission.stage === 1 && near(m.deliver[0], m.deliver[1], p.x, p.z, 5)) {
      completeMission(G);
    }
  } else if (m.kind === 'tail') {
    const car = mission.targetCar;
    if (!car || !G.cars.includes(car)) { failMission(G, 'target hilang'); return; }
    const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
    if (d < 26) {
      mission.tailTime += dt;
      G.objective = `Mengikuti taksi… ${Math.ceil(mission.tailTime)}/${m.tailSeconds} dtk`;
      if (d < 6) { failMission(G, 'ketahuan — terlalu dekat'); return; }
      if (mission.tailTime >= m.tailSeconds) completeMission(G);
    } else {
      mission.tailTime = Math.max(0, mission.tailTime - dt * 0.5);
      G.objective = 'Ikuti taksi kuning — jangan sampai kehilangan';
    }
  } else if (m.kind === 'escape') {
    if (G.wanted === 0) {
      mission.surviveTime += dt;
      G.objective = `Bersembunyi… ${Math.ceil(mission.surviveTime)}/${m.surviveSeconds} dtk`;
      if (mission.surviveTime >= m.surviveSeconds) completeMission(G);
    } else {
      G.objective = `Lepaskan kejaran! Wanted ★${G.wanted}`;
    }
  } else if (m.kind === 'shootout') {
    const left = mission.thugs.filter((t) => G.peds.includes(t)).length;
    G.objective = `Habisi geng dermaga (${m.killsNeeded - left}/${m.killsNeeded})`;
    if (left === 0) completeMission(G);
  } else if (m.kind === 'getaway') {
    if (mission.stage === 0) {
      if (G.player.car === mission.targetCar) {
        mission.stage = 1;
        removeMarker(G);
        G.marker = makeMarker(G, m.extract[0], m.extract[1], 0x34d399);
        G.addWanted(2, 'Misi: pelarian terakhir');
        G.objective = 'Tembus ke Coral Bay — jangan tertangkap!';
        G.showMessage('Gas! Tembus ke Coral Bay!');
      }
    } else if (near(m.extract[0], m.extract[1], p.x, p.z, 6)) {
      completeMission(G);
    }
  }
}

export function onThugKilled(G, ped) {
  const mission = G.mission;
  if (mission && mission.def.kind === 'shootout' && mission.thugs.includes(ped)) {
    mission.kills += 1;
    G.showMessage(`Geng tersisa: ${mission.def.killsNeeded - mission.kills}`);
  }
}
