// The Sunset Stars: a dozen gold palms scattered over Palm Shores, a side hunt that runs beside
// the story. Roll over one — on foot or behind a wheel — and it is banked for good: cash in the
// wallet, a line in the save, one fewer glint on the evening streets. The hunt gives a driver a
// reason to cross districts the missions never visit, and gives the source outline one more
// system with a name of its own.
import { STARS, WORLD } from './config.js';

/**
 * Scatter the stars over the city. Each one stands on open ground the world vouches for —
 * a pavement point clear of buildings, spread district by district so the hunt crosses the
 * whole map instead of clustering where the story already goes.
 */
export function createCollectibles(world, random) {
  const stars = [];

  // One star per district cell of a rough 4x3 grid over the city, jittered inside its cell,
  // so the twelve hunts read as a tour: downtown, the docks, the shore, the far avenues.
  const cellW = WORLD.width / 4;
  const cellH = 2400 / 3; // the city above the beach
  let id = 0;
  for (let gx = 0; gx < 4 && id < STARS.count; gx += 1) {
    for (let gy = 0; gy < 3 && id < STARS.count; gy += 1) {
      const point = huntPoint(gx, gy);
      stars.push({ id, x: point.x, y: point.y, taken: false, spin: random() * Math.PI * 2 });
      id += 1;
    }
  }

  /** A clear spot inside one district cell: pavement first, a roadside as the fallback. */
  function huntPoint(gx, gy) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const point = world.clearPavementPoint();
      const inCellX = point.x >= gx * cellW && point.x < (gx + 1) * cellW;
      const inCellY = point.y >= gy * cellH && point.y < (gy + 1) * cellH;
      if (inCellX && inCellY) return point;
    }
    // No pavement in the cell cooperated: stand the star at the cell's heart, on the road grid.
    const road = world.nearestRoadPoint(gx * cellW + cellW / 2, gy * cellH + cellH / 2, 52, 1);
    return { x: road.x, y: road.y };
  }

  /** The ids banked so far, for the save file. */
  function takenIds() {
    return stars.filter((star) => star.taken).map((star) => star.id);
  }

  /** Restore a save: the stars it names stay banked, the rest still glint. */
  function load(ids) {
    const banked = new Set(Array.isArray(ids) ? ids : []);
    for (const star of stars) star.taken = banked.has(star.id);
  }

  /** How many of the twelve are still out there. */
  function remaining() {
    return stars.filter((star) => !star.taken).length;
  }

  /**
   * One step of the hunt: if the player (whose x/y follow their car) rolls within reach of a
   * standing star, bank it and say which one through `onCollect(star, bankedCount)`.
   */
  function update(playerState, onCollect) {
    for (const star of stars) {
      if (star.taken) continue;
      const distance = Math.hypot(star.x - playerState.x, star.y - playerState.y);
      if (distance <= STARS.radius) {
        star.taken = true;
        onCollect(star, takenIds().length);
      }
    }
  }

  /** Move one standing star to a precise spot — the screenshot rig frames one on purpose. */
  function placeStar(index, x, y) {
    const star = stars[index];
    if (!star || star.taken) return;
    star.x = x;
    star.y = y;
  }

  return { stars, takenIds, load, remaining, update, placeStar };
}

// Round 5 note: Sunset Stars also pay +25 XP toward the RESPECT ladder (see main.js).
