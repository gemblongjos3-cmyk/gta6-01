// Palm Shores — pedestrians.js
// One job: people on the sidewalks — they stroll, dodge the player, and flee
// when a shot is fired or a car comes at them. Hitting one is a crime.
import * as THREE from 'three';
import { TRAFFIC } from './config.js';

const SHIRT_COLORS = [0xe11d48, 0x2563eb, 0x16a34a, 0xd97706, 0x7c3aed, 0xec4899, 0x0891b2, 0xf8fafc];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRT_COLORS[Math.floor(rng.next() * SHIRT_COLORS.length)], roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac][Math.floor(rng.next() * 4)], roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.62;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  g.add(body, head, legL, legR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function spawnPedestrians(G) {
  for (let i = 0; i < TRAFFIC.pedestrians; i++) {
    const mesh = makePedMesh(G.rng);
    const street = G.city.streets[Math.floor(G.rng.next() * G.city.streets.length)];
    const along = G.rng.range(-165, 165);
    const horizontal = G.rng.chance(0.5);
    const x = horizontal ? along : street + (G.rng.chance(0.5) ? 7.8 : -7.8);
    const z = horizontal ? street + (G.rng.chance(0.5) ? 7.8 : -7.8) : along;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.peds.push({
      mesh, pos: mesh.position, heading: G.rng.range(0, Math.PI * 2),
      speed: G.rng.range(1.2, 2.2), walkPhase: G.rng.range(0, 6),
      fleeing: 0, health: 100, armed: false, shootTimer: 0,
      axis: horizontal ? 'x' : 'z', street, dir: G.rng.chance(0.5) ? 1 : -1,
    });
  }
}

/** Spawn armed thugs for the docks shootout mission. */
export function spawnThugs(G, x, z, count) {
  const thugs = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePedMesh(G.rng);
    mesh.position.set(x + G.rng.range(-14, 14), 0, z + G.rng.range(-8, 8));
    // Dark jacket marks a thug.
    mesh.children[0].material = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    G.scene.add(mesh);
    const ped = {
      mesh, pos: mesh.position, heading: 0, speed: 2.6, walkPhase: 0,
      fleeing: 0, health: 100, armed: true, shootTimer: G.rng.range(0.5, 2),
      axis: 'x', street: 0, dir: 1, thug: true,
    };
    G.peds.push(ped); thugs.push(ped);
  }
  return thugs;
}

export function updatePedestrians(G, dt) {
  const playerPos = G.player.pos;
  for (const ped of G.peds) {
    const dx = ped.pos.x - playerPos.x, dz = ped.pos.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    // Flee: shots, a speeding car, or the player sprinting at them.
    if (G.alarm > 0 && dist < 26) ped.fleeing = Math.max(ped.fleeing, 2.5);
    const playerCar = G.player.car;
    if (playerCar && Math.abs(playerCar.speed) > 8) {
      const cdx = ped.pos.x - playerCar.pos.x, cdz = ped.pos.z - playerCar.pos.z;
      if (Math.hypot(cdx, cdz) < 12) ped.fleeing = Math.max(ped.fleeing, 2);
    }
    let moveX = 0, moveZ = 0, speed = ped.speed;
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      speed = 5.2;
      const inv = 1 / Math.max(0.5, dist);
      moveX = dx * inv; moveZ = dz * inv;
      if (ped.armed && dist < 40) {
        // Thugs stand their ground and shoot back instead of running.
        moveX = 0; moveZ = 0; speed = 0;
        ped.heading = Math.atan2(playerPos.x - ped.pos.x, playerPos.z - ped.pos.z);
        ped.shootTimer -= dt;
        if (ped.shootTimer <= 0 && G.mode === 'play' && !G.player.car) {
          ped.shootTimer = G.rng.range(1.1, 2.2);
          G.audio.enemyShot();
          if (G.rng.chance(0.45)) G.damagePlayer(6 + G.rng.range(0, 6), 'thug');
        }
      }
    } else if (ped.thug) {
      // Idle thugs patrol the dock.
      ped.walkPhase += dt * 2;
      moveX = Math.sin(ped.walkPhase * 0.4) * 0.3; moveZ = Math.cos(ped.walkPhase * 0.3) * 0.3;
    } else {
      // Stroll along the sidewalk, turning at the block ends.
      if (ped.axis === 'x') {
        moveX = ped.dir; moveZ = 0;
        if (Math.abs(ped.pos.x) > 172) ped.dir *= -1;
      } else {
        moveX = 0; moveZ = ped.dir;
        if (Math.abs(ped.pos.z) > 172) ped.dir *= -1;
      }
    }
    ped.pos.x += moveX * speed * dt;
    ped.pos.z += moveZ * speed * dt;
    if (moveX !== 0 || moveZ !== 0) ped.heading = Math.atan2(moveX, moveZ);
    ped.mesh.rotation.y = ped.heading;
    ped.walkPhase += dt * speed * 3.2;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
  }
}

export function removePed(G, ped) {
  G.scene.remove(ped.mesh);
  const i = G.peds.indexOf(ped);
  if (i >= 0) G.peds.splice(i, 1);
}
