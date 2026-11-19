// Staged screenshot scenes. The four dossier screenshots are real renders of
// the game, frozen at composed moments: the Paper Moon chase for the cover,
// the Pier Nine gunfight with the wheel open, the run home to Bayline, and
// the start screen over the living avenue. Values on the HUD in these frames
// are the scene's own staged state, exactly as the reference cut staged them.

import * as THREE from 'three';
import { HERO_CAR } from './config.js';
import { updateSun } from './city.js';

function snapChase(game, car, dist = 7.4, height = 1.7) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  game.camera.position.set(car.mesh.position.x - fx * dist, height, car.mesh.position.z - fz * dist);
  game.camera.lookAt(car.mesh.position.x + fx * 7, 1.05, car.mesh.position.z + fz * 7);
  game.camera.fov = 64; game.camera.updateProjectionMatrix();
}

function settle(game, frames = 50) {
  for (let i = 0; i < frames; i++) game.step(1 / 30, true);
}

export function stageShot(game, name) {
  const { hud, pd, heli, combat, world } = game;
  if (name === 'cover') {
    // — the Paper Moon chase, westbound on the avenue in neon rain at night
    const car = game.heroCar;
    car.setPos(56, 2.5, -Math.PI / 2);
    car.speed = 45.7; car.vx = -45.7; car.vz = 0; car.condition = 98; car.nitro = 0.8;
    game.setInCar(true);
    updateSun(world, new THREE.Vector3(56, 0, 2.5));
    pd.heat = 400; pd.lockFloor = 4;
    pd.placeUnit(0, 48, -6.8, -Math.PI / 2, 'RAMMING');
    pd.placeUnit(1, 48.5, 9.2, -Math.PI / 2, 'RAMMING');
    pd.placeUnit(2, 74, -1.5, -Math.PI / 2, 'PURSUIT');
    pd.placeUnit(3, 39, 5.5, -Math.PI / 2, 'PURSUIT');
    pd.spawnRoadblockAt(24, 0, false);
    // city life inside the frame: traffic on the avenue, a car at the curb
    const tc = game.traffic?.cars ?? [];
    if (tc[0]) { tc[0].setPos(36, -5.4, -Math.PI / 2); tc[0].speed = 0; }
    if (tc[1]) { tc[1].setPos(40, 5.6, Math.PI / 2); tc[1].speed = 0; }
    if (tc[2]) { tc[2].setPos(82, 12.4, Math.PI / 2); tc[2].speed = 0; }
    for (let i = 0; i < 70; i++) heli.update(0.05, { x: 56, z: 2.5, stars: 4 }, i * 0.05);
    // pin the Osprey in the rainy sky ahead, its beam raking the avenue
    heli.mesh.position.set(47, 11.5, 5);
    heli.mesh.rotation.y = 2.1;
    snapChase(game, car);
    // tilt up a breath so the FLAMINGO FM board and the Osprey share the frame
    game.camera.position.y = 2.1;
    game.camera.lookAt(49, 3.2, 2.5);
    hud.setCash(38420); hud.setClock(23 * 60 + 47, 1); hud.setStars(4);
    hud.setProgress(438, 4); hud.setHealth(92);
    hud.setMission({ chapter: 7, title: 'PAPER MOON', label: "Lose the cops before Luna's scanner window closes", stage: 2, stages: 3, next: 'Bring the money home', timer: 126, sighted: true }, 'SUNSET AVENUE · DOWNTOWN');
    const units = pd.unitsForHud({ x: 56, z: 2.5 });
    units.splice(2, 0, heli.unitForHud({ x: 56, z: 2.5 }));
    hud.setPd(units, 4, true);
    combat.current = 1;
    hud.setWeapons(combat, 4);
    hud.setRadio(0, 0);
    hud.setVehicle(true, HERO_CAR.model, 151, 'D4', 98, 0.8);
    hud.say("Alarms are back! You've got the whole department coming — lose them!");
    hud.drawMinimap(world, { x: 56, z: 2.5 }, -Math.PI / 2,
      pd.unitsForHud({ x: 56, z: 2.5 }).map(u => ({ x: 56, z: 2.5 })), { x: -150, z: 138 }, []);
    drawBlips(game);
  }
  if (name === 'docks') {
    // — on foot at the end of Pier Nine, facing the crew down the rainy deck
    const p = game.player;
    p.setPos(322, 152, -Math.PI / 2);
    updateSun(world, new THREE.Vector3(322, 0, 152));
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
    game.camera.position.set(325.8, 1.7, 152.5);
    game.camera.lookAt(309, 1.1, 150);
    game.camera.fov = 57; game.camera.updateProjectionMatrix();
    hud.setCash(12850); hud.setClock(23 * 60 + 7, 1); hud.setStars(2);
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
    car.setPos(-96, 113.5, -Math.PI / 2);
    car.speed = 19.4; car.vx = -19.4; car.vz = 0;
    car.condition = 87; car.nitro = 0.45;
    game.setInCar(true);
    updateSun(world, new THREE.Vector3(-96, 0, 113.5));
    game.missions.setMarker(-150, 138, true);
    pd.heat = 400; pd.lockFloor = 0; pd.sighted = false;
    pd.placeUnit(0, -78, 106, -Math.PI / 2, 'PURSUIT');
    pd.placeUnit(1, -64, 120, -Math.PI / 2, 'INTERCEPT');
    for (let i = 0; i < 50; i++) heli.update(0.05, { x: -96, z: 113.5, stars: 4 }, i * 0.05);
    snapChase(game, car, 7.0, 1.8);
    hud.setCash(38420); hud.setClock(23 * 60 + 41, 1); hud.setStars(4);
    hud.setProgress(438, 4); hud.setHealth(92);
    hud.setMission({ chapter: 7, title: 'PAPER MOON', label: 'Bring the money home', stage: 3, stages: 3, next: 'Park it in the Bayline bay', timer: null, sighted: false }, 'BAYLINE');
    const units = pd.unitsForHud({ x: -96, z: 113.5 });
    units.push(heli.unitForHud({ x: -96, z: 113.5 }));
    hud.setPd(units, 4, false);
    combat.current = 1;
    hud.setWeapons(combat, 4);
    hud.setRadio(1, 0);
    hud.setVehicle(true, HERO_CAR.model, 64, 'D3', 87, 0.45);
    hud.say('Nearly home. The bay is open — bring my money in, Mara.');
    hud.drawMinimap(world, { x: -96, z: 113.5 }, -Math.PI / 2,
      [{ x: -78, z: 106 }, { x: -64, z: 120 }], { x: -150, z: 138 },
      world.starSpots.filter((s, i) => i % 3 === 0));
  }
  if (name === 'start') {
    game.setInCar(true);
    updateSun(world, new THREE.Vector3(20, 0, 0));
    game.heroCar.setPos(36, 3.4, -Math.PI / 2);
    game.heroCar.speed = 12;
    game.camera.position.set(63, 3.4, 9.5);
    game.camera.lookAt(0, 1.6, 0);
    game.camera.fov = 56; game.camera.updateProjectionMatrix();
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
  blips.push({ x: 48, z: -6.8 }, { x: 48.5, z: 9.2 }, { x: 74, z: -1.5 }, { x: 39, z: 5.5 }, { x: 24, z: 0 });
  hud.drawMinimap(world, { x: 56, z: 2.5 }, -Math.PI / 2, blips, { x: -150, z: 138 },
    world.starSpots.filter((s, i) => i % 2 === 0));
  void pd;
}
