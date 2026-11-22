// Palm Shores — shots.js
// One job: stage the 4 deterministic screenshot scenes behind ?shot=<name>&seed=N.
// Each scene sets up the real game state, places the camera, and reports ready
// through window.__shotReady once a few frames have rendered.
import { startMission } from './missions.js';
import { createCar } from './vehicles.js';
import { addWanted } from './police.js';

function placePlayerCar(G, x, z, heading, typeKey = 'coupe') {
  const car = createCar(G, typeKey, x, z, heading, { parked: false });
  car.driver = 'player';
  G.player.car = car;
  G.player.mesh.visible = false;
  G.player.pos.set(x, 0, z);
  car.speed = 18;
  return car;
}

function spawnChaseCruisers(G, x, z) {
  for (const [ox, oz, h] of [[-8, -14, 0.4], [9, -10, -0.3], [0, 16, Math.PI]]) {
    const c = createCar(G, 'cruiser', x + ox, z + oz, h, { police: true });
    c.driver = 'ai';
    c.speed = 16;
    G.police.push(c);
  }
}

/**
 * Stage a named scene and return the camera setup main.js should hold.
 * Names: cover (police chase at a neon intersection), foot (on foot in a neon
 * district), docks (mission moment at the docks), start (title screen).
 */
export function stageShot(G, name) {
  const rng = G.rng;
  G.mode = 'play';
  G.objective = 'Ikuti taksi kuning — jangan terlalu dekat';
  if (name === 'start') {
    G.mode = 'title';
    return { fixed: true, pos: [0, 26, -95], look: [0, 4, -140], drive: false };
  }
  if (name === 'docks') {
    startMission(G, 3); // shootout at the docks, thugs + marker already placed
    G.player.pos.set(40, 0, 150);
    G.player.mesh.position.set(40, 0, 150);
    G.player.heading = Math.PI;
    G.player.mesh.rotation.y = Math.PI;
    G.camYaw = Math.PI;
    addWanted(G, 2, 'Baku tembak di dermaga');
    return { fixed: true, pos: [40, 7, 138], look: [40, 2, 168], drive: false };
  }
  if (name === 'foot') {
    // On foot, mid-street: player on the z=-120 street, camera on the x=0
    // street looking down it — buildings, peds and traffic on both sides.
    startMission(G, 0);
    G.player.pos.set(0, 0, -120);
    G.player.mesh.position.set(0, 0, -120);
    G.player.heading = 0;
    G.player.mesh.rotation.y = 0;
    G.camYaw = 0;
    G.player.cash = 1250;
    return { fixed: true, pos: [0, 4.5, -138], look: [2, 1.5, -104], drive: false };
  }
  // cover: police chase at the neon intersection, wanted 3, minimap + objective live.
  // The car runs ALONG street z=-40 (heading PI/2), never into the blocks.
  startMission(G, 1);
  placePlayerCar(G, 0, -40, Math.PI / 2, 'coupe');
  spawnChaseCruisers(G, 0, -40);
  addWanted(G, 3, 'Kejaran polisi');
  G.player.cash = 2450;
  G.player.health = 82;
  return { follow: 'chase', drive: true };
}
