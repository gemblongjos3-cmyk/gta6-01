// The Shores PD air unit: one helicopter that joins the hunt at three
// stars and shadows the player from above, its spotlight pinned to the
// street below. It never lands and never shoots — its weapon is the
// light: while the spot holds the player, every cruiser in the city
// knows exactly where to drive. It also takes a seat on the response
// panel as AIR-1 OSPREY, so the panel's count stays honest.
import { POLICE } from './config.js';

export function createAirUnit() {
  const unit = {
    active: false,
    x: 0,
    y: 0,
    angle: 0,
    rotor: 0,
    spotX: 0,
    spotY: 0,
    orbit: 0,
  };

  /**
   * One fixed step. The helicopter activates over the player at
   * POLICE.heliMinWanted stars, hovers at a slow orbit offset from the
   * player's position, and leaves the way it came when the heat dies.
   */
  function update(dt, { player, wanted }) {
    unit.rotor += dt * 42;
    if (wanted >= POLICE.heliMinWanted) {
      if (!unit.active) {
        unit.active = true;
        unit.x = player.x + 700;
        unit.y = player.y - 500;
        unit.spotX = player.x;
        unit.spotY = player.y;
      }
      unit.orbit += dt * 0.35;
      const hoverX = player.x + Math.cos(unit.orbit) * 130;
      const hoverY = player.y + Math.sin(unit.orbit) * 130 - 60;
      unit.x += (hoverX - unit.x) * Math.min(1, dt * 1.6);
      unit.y += (hoverY - unit.y) * Math.min(1, dt * 1.6);
      unit.angle = Math.atan2(player.y - unit.y, player.x - unit.x);
      // The spotlight tracks the player with a slight lag, like a real
      // operator swinging the lamp to keep the car in the circle.
      unit.spotX += (player.x - unit.spotX) * Math.min(1, dt * 5);
      unit.spotY += (player.y - unit.spotY) * Math.min(1, dt * 5);
      return;
    }
    if (unit.active) {
      // Heat gone: climb away to the north-east and stand down once far.
      unit.x += 620 * dt;
      unit.y -= 460 * dt;
      unit.spotX = unit.x;
      unit.spotY = unit.y;
      if (Math.hypot(unit.x - player.x, unit.y - player.y) > 1600) unit.active = false;
    }
  }

  /** The panel row for this unit, in computePdResponse's extra format. */
  function panelUnit(focus) {
    const dist = Math.hypot(unit.x - focus.x, unit.y - focus.y);
    return { name: 'AIR-1 OSPREY', status: 'AIR SUPPORT', distM: Math.round(dist / 10), dist };
  }

  /** Park the helicopter at an exact spot — the screenshot rig stages it. */
  function stage(x, y, target) {
    unit.active = true;
    unit.x = x;
    unit.y = y;
    unit.angle = Math.atan2(target.y - y, target.x - x);
    unit.spotX = target.x;
    unit.spotY = target.y;
    unit.rotor = 2.4;
  }

  function reset() {
    unit.active = false;
  }

  return {
    unit,
    get active() {
      return unit.active;
    },
    update,
    panelUnit,
    stage,
    reset,
  };
}
