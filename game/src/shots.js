// Staged screenshot scenes. The four dossier screenshots are real renders of
// the game, frozen at composed moments: the Paper Moon chase for the cover,
// the Pier Nine gunfight with the wheel open, the run home to Bayline, and
// the start screen over the living avenue. Values on the HUD in these frames
// are the scene's own staged state, exactly as the reference cut staged them.

import * as THREE from 'three';
import { HERO_CAR } from './config.js';

function snapChase(game, car, dist = 10.5, height = 3.0) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  game.camera.position.set(car.mesh.position.x - fx * dist, height, car.mesh.position.z - fz * dist);
  game.camera.lookAt(car.mesh.position.x + fx * 7, 1.25, car.mesh.position.z + fz * 7);
  game.camera.fov = 68; game.camera.updateProjectionMatrix();
}

function settle(game, frames = 50) {
  for (let i = 0; i < frames; i++) game.step(1 / 30, true);
}

export function stageShot(game, name) {
  const { hud, pd, heli, combat, world } = game;
  if (name === 'cover') {
    // — the Paper Moon chase, westbound on Sunset Avenue into the sun
    const car = game.heroCar;
    car.setPos(96, 2.5, -Math.PI / 2);
    car.speed = 45.7; car.vx = -45.7; car.vz = 0; car.condition = 98; car.nitro = 0.8;
    game.setInCar(true);
    pd.heat = 400; pd.lockFloor = 4;
    pd.placeUnit(0, 100.5, -4.6, -Math.PI / 2, 'RAMMING');
    pd.placeUnit(1, 97.5, 9.2, -Math.PI / 2, 'RAMMING');
    pd.placeUnit(2, 118, -1.5, -Math.PI / 2, 'PURSUIT');
    pd.placeUnit(3, 84, 6.0, -Math.PI / 2, 'PURSUIT');
    pd.spawnRoadblockAt(38, 0, false);
    // city life inside the frame: traffic on the avenue, a car at the curb
    const tc = game.traffic?.cars ?? [];
    if (tc[0]) { tc[0].setPos(58, -5.4, -Math.PI / 2); tc[0].speed = 0; }
    if (tc[1]) { tc[1].setPos(64, 5.6, Math.PI / 2); tc[1].speed = 0; }
    if (tc[2]) { tc[2].setPos(126, 12.4, Math.PI / 2); tc[2].speed = 0; }
    for (let i = 0; i < 70; i++) heli.update(0.05, { x: 96, z: 2.5, stars: 4 }, i * 0.05);
    // pin the Osprey in the sky ahead, small against the sunset like the reference
    heli.mesh.position.set(66, 17, -7);
    heli.mesh.rotation.y = 2.1;
    snapChase(game, car);
    hud.setCash(38420); hud.setClock(18 * 60 + 52, 1); hud.setStars(4);
    hud.setProgress(438, 4); hud.setHealth(92);
    hud.setMission({ chapter: 7, title: 'PAPER MOON', label: "Lose the cops before Luna's scanner window closes", stage: 2, stages: 3, next: 'Bring the money home', timer: 126, sighted: true }, 'SUNSET AVENUE · DOWNTOWN');
    const units = pd.unitsForHud({ x: 96, z: 2.5 });
    units.splice(2, 0, heli.unitForHud({ x: 96, z: 2.5 }));
    hud.setPd(units, 4, true);
    combat.current = 1;
    hud.setWeapons(combat, 4);
    hud.setRadio(0, 0);
    hud.setVehicle(true, HERO_CAR.model, 151, 'D4', 98, 0.8);
    hud.say("Alarms are back! You've got the whole department coming — lose them!");
    hud.drawMinimap(world, { x: 96, z: 2.5 }, -Math.PI / 2,
      pd.unitsForHud({ x: 96, z: 2.5 }).map(u => ({ x: 96, z: 2.5 })), { x: -150, z: 138 }, []);
    drawBlips(game);
  }
  if (name === 'docks') {
    // — on foot at the end of Pier Nine, facing the crew down the deck into the sunset
    const p = game.player;
    p.setPos(322, 152, -Math.PI / 2);
    p.aiming = true;
    p.limbs.armR.rotation.x = -1.35; p.limbs.armL.rotation.x = -1.1;
    game.setInCar(false);
    combat.spawnHostile(310, 149, { color: 0xd94f70 });
    combat.spawnHostile(306, 156, { color: 0x8d6fd1 });
    combat.spawnHostile(313, 143, { color: 0xff8c42 });
    // one live round cracks toward the crew — its tracer hangs in the frozen frame
    combat.current = 1;
    combat.tryFire(performance.now(), new THREE.Vector3(321.4, 1.35, 151.4),
      new THREE.Vector3(-1, 0.01, -0.04).normalize(), world, 4);
    pd.heat = 200;
    pd.placeUnit(0, 300, 141, 0.9, 'PURSUIT');
    for (let i = 0; i < 40; i++) heli.update(0.05, { x: 322, z: 152, stars: 2 }, i * 0.05);
    game.camera.position.set(326.6, 2.0, 152);
    game.camera.lookAt(309, 1.2, 150);
    game.camera.fov = 55; game.camera.updateProjectionMatrix();
    hud.setCash(12850); hud.setClock(19 * 60 + 7, 1); hud.setStars(2);
    hud.setProgress(690, 3); hud.setHealth(76);
    hud.setMission({ chapter: 4, title: 'PIER NINE', label: 'Clear the Velmara crew off Pier Nine', stage: 1, stages: 2, next: 'Pick up the ledger at the end of the pier', timer: null, sighted: true }, 'PIER NINE');
    hud.setPd(pd.unitsForHud({ x: 322, z: 152 }), 2, true);
    combat.current = 1;
    hud.setWeapons(combat, 4);
    hud.wheel(true, combat, 4, 1);
    hud.setVehicle(false);
    hud.say('Three of them, armed and waiting. Take the book back, Mara.');
    hud.drawMinimap(world, { x: 322, z: 152 }, -Math.PI / 2, [{ x: 300, z: 141 }], { x: 322, z: 150 }, []);
  }
  if (name === 'delivery') {
    // — stage 3 of Paper Moon: the money run home to Bayline
    const car = game.heroCar;
    car.setPos(-112, 110, Math.PI * 0.72);
    car.speed = 19.4; car.vx = Math.sin(Math.PI * 0.72) * 19.4; car.vz = Math.cos(Math.PI * 0.72) * 19.4;
    car.condition = 87; car.nitro = 0.45;
    game.setInCar(true);
    game.missions.setMarker(-150, 138, true);
    pd.heat = 400; pd.lockFloor = 0; pd.sighted = false;
    pd.placeUnit(0, -84, 84, Math.PI * 0.8, 'PURSUIT');
    pd.placeUnit(1, -70, 102, Math.PI * 0.85, 'INTERCEPT');
    for (let i = 0; i < 50; i++) heli.update(0.05, { x: -112, z: 110, stars: 4 }, i * 0.05);
    snapChase(game, car, 8.2, 2.8);
    hud.setCash(38420); hud.setClock(19 * 60 + 41, 1); hud.setStars(4);
    hud.setProgress(438, 4); hud.setHealth(92);
    hud.setMission({ chapter: 7, title: 'PAPER MOON', label: 'Bring the money home', stage: 3, stages: 3, next: 'Park it in the Bayline bay', timer: null, sighted: false }, 'BAYLINE');
    const units = pd.unitsForHud({ x: -112, z: 110 });
    units.push(heli.unitForHud({ x: -112, z: 110 }));
    hud.setPd(units, 4, false);
    combat.current = 1;
    hud.setWeapons(combat, 4);
    hud.setRadio(1, 0);
    hud.setVehicle(true, HERO_CAR.model, 64, 'D3', 87, 0.45);
    hud.say('Nearly home. The bay is open — bring my money in, Mara.');
    hud.drawMinimap(world, { x: -112, z: 110 }, Math.PI * 0.78,
      [{ x: -84, z: 84 }, { x: -70, z: 102 }], { x: -150, z: 138 },
      world.starSpots.filter((s, i) => i % 3 === 0));
  }
  if (name === 'start') {
    game.setInCar(true);
    game.heroCar.setPos(30, 3.4, -Math.PI / 2);
    game.heroCar.speed = 12;
    game.camera.position.set(97, 7.5, 2);
    game.camera.lookAt(-70, 2, 0);
    game.camera.fov = 58; game.camera.updateProjectionMatrix();
    hud.showStart(game.save, game.storyLines);
    document.getElementById('hud').style.display = 'none';
  }
  settle(game, name === 'start' ? 6 : 4);
  game.render();
  window.__shotReady = true;
}

// minimap police blips need real cruiser positions, not the target's
function drawBlips(game) {
  const { hud, pd, world } = game;
  const blips = [];
  // staged cruiser positions are known constants of the cover scene
  blips.push({ x: 108, z: -3.4 }, { x: 112, z: 4.4 }, { x: 122, z: -0.5 }, { x: 84, z: 6.5 }, { x: 38, z: 0 });
  hud.drawMinimap(world, { x: 96, z: 2.5 }, -Math.PI / 2, blips, { x: -150, z: 138 },
    world.starSpots.filter((s, i) => i % 2 === 0));
  void pd;
}
