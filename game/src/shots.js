// Palm Shores — shots.js
// Screenshot scene staging: ?shot=<name>&seed=<n> puts the game into a
// fixed, deterministic pose for each judging screenshot. The main loop
// keeps rendering (rain, neon, light bars animate) while the camera
// stays on the staged angle.

import * as THREE from 'three';
import { Guard } from './combat.js';

export function shotFromUrl() {
  return new URLSearchParams(location.search).get('shot') || '';
}

// Stage one scene. Returns a fixed camera pose {pos, look} or null to
// use the normal follow camera. Mutates the live game (player, police,
// mission) so the frame shows the real systems, not a mockup.
export function stageShot(game, name) {
  const { player, driving, police, missions, traffic, city, hud } = game;
  if (name === 'cover') {
    // Police chase at the neon Palm Court intersection: player in the
    // pink Shores GT, two cruisers on his tail, 3 wanted stars.
    const car = traffic.stealables.find((g) => g.userData.car.type === 'coupe')
      || traffic.stealables[0];
    // On road x=0, facing south (+z); cruisers behind to the north.
    car.position.set(0, 0, -30);
    car.rotation.y = 0;
    driving.enter(car);
    player.group.visible = false;
    // Staging only: the capture runs ~20 s of virtual time and the rams
    // would otherwise end the run with a game-over screen over the shot.
    player.health = 1000;
    player.armor = 500;
    police.addHeat(75, 'chase', game.now);
    // Force two cruisers right behind the player.
    police._spawnCruiser(new THREE.Vector3(0, 0, -30));
    police._spawnCruiser(new THREE.Vector3(0, 0, -30));
    const cruiserXs = [-4, 4];
    police.cruisers.forEach((c, i) => {
      c.group.position.set(cruiserXs[i % cruiserXs.length], 0, -44);
      c.group.rotation.y = 0;
      c.speed = 18;
    });
    missions.start(0);
    hud.setObjective('Escape the Shores PD — lose the cruisers');
    return {
      pos: new THREE.Vector3(12, 5, -48),
      look: new THREE.Vector3(0, 1.5, -28),
    };
  }
  if (name === 'foot') {
    // On foot on road x=-46 in the neon Vesper Row strip, pedestrians and
    // traffic around. Camera sits at the intersection, looking south down
    // the road so the signs and the street read.
    player.reset(-46, -58);
    player.yaw = Math.PI * 0.15;
    player.group.rotation.y = player.yaw;
    missions.start(0);
    hud.setObjective('Pick up the package at the Vesper bar');
    return {
      pos: new THREE.Vector3(-46, 6, -38),
      look: new THREE.Vector3(-46, 1.6, -60),
    };
  }
  if (name === 'docks') {
    // Mission moment at the docks: Pier 3, guards on the pier, marker up.
    // Player stands on the open dock apron between piers, facing the guards;
    // the camera sits low and close so the guards and the player both read.
    player.reset(34, 126);
    player.yaw = 1.1;
    player.group.rotation.y = player.yaw;
    // Staging only: guard fire over ~20 s of virtual time must not end
    // the run with a game-over screen over the shot.
    player.health = 1000;
    player.armor = 500;
    missions.start(3);
    // Jump straight to the shootout stage so guards + crate marker show.
    missions.stage = 1;
    missions._setTarget(60, 132, 6, 'Clear the dock guards, then grab the crate');
    for (let i = 0; i < 5; i++) {
      const gx = 40 + (i % 3) * 9 - 8;
      const gz = 128 + Math.floor(i / 3) * 6;
      missions.guards.push(new Guard(game.scene, gx, gz, game.rng));
    }
    hud.setObjective('Clear the dock guards, then grab the crate');
    return {
      pos: new THREE.Vector3(30, 10, 116),
      look: new THREE.Vector3(44, 1.5, 131),
    };
  }
  if (name === 'start') {
    // The start screen: nothing to stage; main.js keeps the menu open.
    return null;
  }
  return null;
}
