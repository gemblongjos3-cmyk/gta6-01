// Palm Shores — police.js
// One job: the wanted system — stars rise with witnessed crime, decay when
// quiet, and cruisers spawn, pursue and ram. A bust ends the run.
import { WANTED } from './config.js';
import { createCar, removeCar } from './vehicles.js';

export function addWanted(G, stars, reason) {
  const before = G.wanted;
  G.wanted = Math.min(WANTED.maxStars, G.wanted + stars);
  G.wantedTimer = 0;
  if (G.wanted > before) {
    G.showMessage(`WANTED ★${G.wanted} — ${reason}`);
    G.audio.setSiren(true);
  }
}

export function updateWanted(G, dt) {
  if (G.wanted <= 0) { G.audio.setSiren(false); return; }
  const policeNear = G.nearbyPoliceCount(55) > 0;
  const seen = policeNear || G.alarm > 0;
  if (!seen) {
    G.wantedTimer += dt;
    if (G.wantedTimer >= WANTED.decaySeconds) {
      G.wanted -= 1;
      G.wantedTimer = 0;
      G.showMessage(G.wanted > 0 ? `Wanted turun ke ★${G.wanted}` : 'Bersih. Polisi kehilangan jejakmu.');
      if (G.wanted === 0) G.audio.setSiren(false);
    }
  } else {
    G.wantedTimer = 0;
  }
  // Keep cruisers on the street: one per star, up to three at once.
  const wantCruisers = Math.min(3, G.wanted);
  const have = G.police.length;
  if (have < wantCruisers) spawnCruiser(G);
  if (have > wantCruisers && G.wanted === 0) {
    for (const c of [...G.police]) despawnCruiser(G, c);
  }
}

function spawnCruiser(G) {
  const p = G.player.pos;
  const angle = G.rng.range(0, Math.PI * 2);
  const x = Math.max(-180, Math.min(180, p.x + Math.sin(angle) * 55));
  const z = Math.max(-180, Math.min(180, p.z + Math.cos(angle) * 55));
  const car = createCar(G, 'cruiser', x, z, Math.atan2(p.x - x, p.z - z),
    { police: true, targetSpeed: 30 });
  car.driver = 'ai';
  G.police.push(car);
  G.showMessage('Unit polisi mendekat!');
}

function despawnCruiser(G, car) {
  const i = G.police.indexOf(car);
  if (i >= 0) G.police.splice(i, 1);
  removeCar(G, car);
}

export function updatePolice(G, dt) {
  const p = G.player.pos;
  const target = G.player.car ?? null;
  const pack = [...G.police]; // snapshot: a cruiser may despawn mid-loop
  for (let ci = 0; ci < pack.length; ci += 1) {
    const cruiser = pack[ci];
    // Each cruiser aims at a slightly different point around the player so the
    // pack fans out instead of stacking on one spot and shoving each other.
    const side = (ci - (G.police.length - 1) / 2) * 7;
    const tx = (target ? target.pos.x : p.x) + side;
    const tz = (target ? target.pos.z : p.z) + Math.abs(side) * 0.4;
    const dx = tx - cruiser.pos.x, dz = tz - cruiser.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - cruiser.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    cruiser.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    // Faster than the player when far, easing off up close so the ram lands.
    // Staged scenes cap the approach so cruisers trail instead of piling on.
    const wantSpeed = G.shot
      ? (dist > 26 ? 26 : dist > 12 ? 18 : 10)
      : (dist > 26 ? 40 : dist > 10 ? 32 : 24);
    cruiser.speed += (wantSpeed - cruiser.speed) * Math.min(1, dt * 1.6);
    cruiser.pos.x += Math.sin(cruiser.heading) * cruiser.speed * dt;
    cruiser.pos.z += Math.cos(cruiser.heading) * cruiser.speed * dt;
    cruiser.mesh.rotation.y = cruiser.heading;
    const spin = cruiser.speed * dt * 2.4;
    for (const w of cruiser.mesh.userData.wheels) w.rotation.x += spin;
    // Light bar strobes.
    const bar = cruiser.mesh.userData.lightBar;
    if (bar) {
      const phase = Math.floor(G.time * 6) % 2 === 0;
      bar.children[0].material.color.setHex(phase ? 0xff2020 : 0x550000);
      bar.children[1].material.color.setHex(phase ? 0x000055 : 0x2040ff);
    }
    // Ram: contact with the player's car damages it; contact on foot can bust.
    // (Staged screenshot scenes skip the damage so the chase survives capture.)
    if (G.shot) {
      // no-op: cruisers still close in visually
    } else if (target) {
      if (dist < 3.6) {
        cruiser.speed *= 0.4;
        target.speed *= 0.6;
        G.crashCar(target, true);
        G.damagePlayer(4, 'tabrakan polisi');
      }
    } else if (dist < WANTED.bustRange && Math.abs(G.player.speed) < 2.5) {
      G.bustedTimer += dt;
      if (G.bustedTimer > 2.5) { G.gameOver('Tertangkap polisi — BUSTED'); return; }
    } else {
      G.bustedTimer = Math.max(0, G.bustedTimer - dt);
    }
    if (dist > 260) despawnCruiser(G, cruiser);
  }
}
