// The city itself, and nothing that moves: the road grid, the blocks between it, the buildings
// that stand on those blocks, the palms, lamps and neon signs along the pavements, the beach and
// the sea. It also answers the two questions every other system asks: is this point on a road,
// and what is here to bump into. Nothing in this file draws or steps.
import { BUSINESS_NAMES, COAST, PALETTE, PLACES, ROAD, WORLD } from './config.js';

/** Half the width of a road, and the width of the pavement outside it. */
export const HALF_ROAD = ROAD.width / 2;
export const PAVEMENT = 24;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** A small stable hash of a number, used to give each building its own windows. */
function hash(value) {
  let x = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function createWorld(random) {
  const roads = [];
  const blocks = [];
  const buildings = [];
  const props = [];
  const solids = [];
  const places = new Map();

  for (let index = 0; index < ROAD.avenueX.length; index += 1) {
    roads.push({ axis: 'x', at: ROAD.avenueX[index], index, name: ROAD.nameAvenue[index] });
  }
  for (let index = 0; index < ROAD.streetY.length; index += 1) {
    roads.push({ axis: 'y', at: ROAD.streetY[index], index, name: ROAD.nameStreet[index] });
  }

  // The blocks: everything between four roads, inset by the pavement on every side.
  for (let column = 0; column < ROAD.avenueX.length - 1; column += 1) {
    for (let row = 0; row < ROAD.streetY.length - 1; row += 1) {
      const left = ROAD.avenueX[column] + HALF_ROAD + PAVEMENT;
      const right = ROAD.avenueX[column + 1] - HALF_ROAD - PAVEMENT;
      const top = ROAD.streetY[row] + HALF_ROAD + PAVEMENT;
      const bottom = ROAD.streetY[row + 1] - HALF_ROAD - PAVEMENT;
      blocks.push({ column, row, left, right, top, bottom, width: right - left, height: bottom - top });
    }
  }

  function blockAt(column, row) {
    return blocks[column * (ROAD.streetY.length - 1) + row];
  }

  /** Fit one building into `area`, clipped to the block, with a small gap on one side. */
  function addBuilding(area, style, name, kind) {
    const inset = 4 + random() * 8;
    const x = area.x + inset;
    const y = area.y + inset;
    const w = Math.max(40, area.w - inset * 2);
    const h = Math.max(40, area.h - inset * 2);
    const paletteIndex = Math.floor(random() * PALETTE.wall.length);
    const building = {
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      color: PALETTE.wall[paletteIndex],
      trim: PALETTE.trim[paletteIndex],
      floors: 1 + Math.floor(random() * 4) + (style === 'tower' ? 3 : 0),
      style,
      name: name ?? null,
      kind: kind ?? 'shop',
      neon: random() < 0.55 ? PALETTE.neon[Math.floor(random() * PALETTE.neon.length)] : null,
      windows: hash(Math.floor(x * 7 + y * 13 + w * 3)) > 0.18,
      seed: Math.floor(x * 3 + y * 5 + w),
      rooftop: random() < 0.4 ? 'ac' : random() < 0.5 ? 'tank' : 'none',
    };
    buildings.push(building);
    solids.push({ x, y, w, h, kind: 'building', building });
    return building;
  }

  /** Split a block into two to four lots and put a building on each. */
  function fillBlock(block) {
    const columns = random() < 0.6 ? 2 : 1;
    const rows = block.height > 200 ? 2 : 1;
    const gap = 8 + random() * 8;
    const lotWidth = (block.width - gap * (columns - 1)) / columns;
    const lotHeight = (block.height - gap * (rows - 1)) / rows;
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const area = {
          x: block.left + c * (lotWidth + gap),
          y: block.top + r * (lotHeight + gap),
          w: lotWidth,
          h: lotHeight,
        };
        const style = random() < 0.16 ? 'tower' : random() < 0.3 ? 'warehouse' : 'shop';
        addBuilding(area, style);
      }
    }
  }

  /**
   * Some blocks are not built on at all: they are parking lots, an asphalt pad with painted
   * bays and a few locked cars standing in them. A city of nothing but slabs reads flat; a
   * lot breaks the rhythm and gives the streets somewhere their cars actually live.
   */
  const lots = [];
  function fillLot(block) {
    const pad = { x: block.left + 6, y: block.top + 6, w: block.width - 12, h: block.height - 12 };
    const cars = [];
    const bayW = 34;
    const rowsY = [pad.y + 34, pad.y + pad.h - 34];
    for (const rowY of rowsY) {
      for (let x = pad.x + 30; x < pad.x + pad.w - 24; x += bayW + 14) {
        if (random() < 0.42) continue; // an empty bay: somebody is out for the evening
        const angle = rowY === rowsY[0] ? Math.PI / 2 : -Math.PI / 2;
        const body = { x, y: rowY, w: 30, h: 58 };
        cars.push({
          x,
          y: rowY,
          angle,
          color: PALETTE.car[Math.floor(random() * PALETTE.car.length)],
          model: random() < 0.3 ? 'van' : 'sedan',
        });
        solids.push({ ...body, kind: 'lotcar' });
      }
    }
    lots.push({ pad, cars, seed: Math.floor(block.left + block.top) });
    block.kind = 'lot';
  }

  // One block in nine stays unbuilt: a parking lot. Never a block the story names — the
  // named places below need their buildings, and a lot under the warehouse would tangle.
  const placeBlocks = new Set(PLACES.map((place) => `${place.block[0]},${place.block[1]}`));
  for (const block of blocks) {
    if (!placeBlocks.has(`${block.column},${block.row}`) && random() < 0.11) fillLot(block);
    else fillBlock(block);
  }

  // The story's named places take over a building on their block: a landmark with a sign.
  for (const place of PLACES) {
    const block = blockAt(place.block[0], place.block[1]);
    if (!block) continue;
    const onBlock = buildings.filter((b) => b.x >= block.left - 1 && b.x + b.w <= block.right + 1 && b.y >= block.top - 1 && b.y + b.h <= block.bottom + 1);
    const building = onBlock[0] ?? addBuilding(block, 'shop');
    building.name = place.name;
    building.kind = place.kind;
    building.color = place.color;
    building.floors = place.kind === 'hotel' ? 5 : place.kind === 'police' ? 2 : 3;
    building.landmark = true;
    building.neon = place.color;
    places.set(place.key, {
      key: place.key,
      name: place.name,
      kind: place.kind,
      x: building.cx,
      y: building.cy,
      building,
      /** A spot on the pavement outside the door, where missions start and cars park. */
      door: { x: building.x + building.w / 2, y: building.y + building.h + PAVEMENT + 12 },
    });
  }

  // Give the shops on the street a name: the sign over the door.
  let nameIndex = 0;
  for (const building of buildings) {
    if (building.name) continue;
    if (random() < 0.42) {
      building.name = BUSINESS_NAMES[nameIndex % BUSINESS_NAMES.length];
      nameIndex += 1;
    }
  }

  // Crates stack up around the Pier 9 warehouse and the marina: the docks work for a living,
  // and a gunfight there should have something to hide behind — and to be photographed against.
  for (const key of ['warehouse', 'marina']) {
    const place = places.get(key);
    if (!place) continue;
    const base = place.building;
    for (let stack = 0; stack < 7; stack += 1) {
      const x = base.x + 14 + stack * 44 + random() * 10;
      const y = base.y + base.h + 16 + (stack % 2) * 30;
      props.push({ kind: 'crate', x, y, size: 15 + random() * 7, stack: random() < 0.5 ? 2 : 1 });
      solids.push({ x: x - 14, y: y - 14, w: 28, h: 28, kind: 'crate' });
    }
  }

  // Palms along every pavement edge and streetlights at the corners of every intersection.
  for (let column = 0; column < ROAD.avenueX.length; column += 1) {
    for (let row = 0; row < ROAD.streetY.length; row += 1) {
      const x = ROAD.avenueX[column];
      const y = ROAD.streetY[row];
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const px = x + dx * (HALF_ROAD + 12);
        const py = y + dy * (HALF_ROAD + 12);
        if (px < 8 || px > WORLD.width - 8 || py < 8) continue;
        props.push({ kind: 'lamp', x: px, y: py, side: dx * dy });
      }
    }
  }
  for (const block of blocks) {
    const step = 92;
    for (let x = block.left + 20; x < block.right - 10; x += step) {
      if (random() < 0.55) props.push({ kind: 'palm', x, y: block.top - PAVEMENT / 2, size: 0.8 + random() * 0.5 });
      if (random() < 0.55) props.push({ kind: 'palm', x, y: block.bottom + PAVEMENT / 2, size: 0.8 + random() * 0.5 });
    }
    if (random() < 0.5) props.push({ kind: 'hydrant', x: block.left + 30, y: block.bottom + 10 });
    if (random() < 0.45) props.push({ kind: 'bench', x: block.right - 40, y: block.bottom + 12 });
  }
  // Palms along the beach and the promenade; the sea itself is solid.
  for (let x = 60; x < WORLD.width; x += 130) {
    props.push({ kind: 'palm', x: x + random() * 40, y: COAST.beachTop + 30 + random() * 40, size: 0.9 + random() * 0.6 });
    if (random() < 0.6) props.push({ kind: 'palm', x: x + random() * 60, y: COAST.beachTop - 22, size: 0.9 + random() * 0.5 });
  }
  for (let x = 80; x < WORLD.width; x += 240) props.push({ kind: 'lamp', x, y: COAST.beachTop - 30, side: 1 });

  // Beach life on the sand near the boardwalk: umbrellas with towels laid
  // out under them, so the shore reads as a place people actually sit.
  const BEACH_SETS = ['#e2574c', '#4fa3c7', '#f0c479', '#7bbf6a', '#e08aaf'];
  for (let x = 220; x < WORLD.width - 140; x += 370) {
    const ux = x + random() * 60;
    const uy = COAST.beachTop + 92 + random() * 84;
    const color = BEACH_SETS[Math.floor(random() * BEACH_SETS.length)];
    props.push({ kind: 'umbrella', x: ux, y: uy, color });
    props.push({ kind: 'towel', x: ux + 24 + random() * 22, y: uy + 16 + random() * 14, color, angle: random() * Math.PI });
    props.push({ kind: 'towel', x: ux - 30 - random() * 18, y: uy + 10 + random() * 18, color: BEACH_SETS[Math.floor(random() * BEACH_SETS.length)], angle: random() * Math.PI });
  }

  // One small kiosk on the sand by the docks boardwalk, hand-painted sign
  // and all — the evening coconut stall the dock crews queue at.
  const warehousePlace = places.get('warehouse');
  if (warehousePlace) props.push({ kind: 'kiosk', x: warehousePlace.door.x + 176, y: COAST.beachTop + 46 });

  // Rooftop billboards for the city's loudest radio station: one over the
  // downtown junction the chase runs through, one over the Pier Nine
  // warehouse roof. A pink board the size of a bus, lit against the dusk —
  // the landmark every driver in the district navigates by.
  function rooftopBillboard(anchorX, anchorY) {
    let best = null;
    let bestDistance = Infinity;
    for (const building of buildings) {
      const distance = (building.cx - anchorX) ** 2 + (building.cy - anchorY) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = building;
      }
    }
    if (!best) return;
    props.push({
      kind: 'billboard',
      x: best.cx,
      y: best.cy,
      w: Math.min(210, best.w - 8),
      h: 58,
      text: 'FLAMINGO FM',
      sub: 'WAVE 88.1',
    });
  }
  rooftopBillboard((ROAD.avenueX[3] + ROAD.avenueX[4]) / 2, (ROAD.streetY[1] + ROAD.streetY[2]) / 2);
  if (warehousePlace) rooftopBillboard(warehousePlace.building.cx, warehousePlace.building.cy);

  solids.push({ x: 0, y: COAST.waterline, w: WORLD.width, h: WORLD.height - COAST.waterline, kind: 'sea' });

  const grid = {
    roads,
    blocks,
    buildings,
    lots,
    props,
    solids,
    places,
    width: WORLD.width,
    height: WORLD.height,
  };

  /** True when a circle at (x, y) with radius r touches a road, pavement or the promenade. */
  function isOnRoad(x, y, margin = 0) {
    for (const road of roads) {
      const along = road.axis === 'x' ? y : x;
      const across = road.axis === 'x' ? x : y;
      const limit = road.axis === 'x' ? WORLD.width : WORLD.height;
      if (along > -1 && along < limit && Math.abs(across - road.at) <= HALF_ROAD + margin) return true;
    }
    return false;
  }

  /** True when (x, y) stands on a pavement or the boardwalk: the pedestrians' ground. */
  function isOnPavement(x, y) {
    if (y > COAST.beachTop - 10) return true;
    for (const road of roads) {
      const across = road.axis === 'x' ? x : y;
      const distance = Math.abs(across - road.at);
      if (distance > HALF_ROAD && distance <= HALF_ROAD + PAVEMENT + 8) return true;
    }
    return false;
  }

  /** Snap a point onto the nearest road, `lane` pixels to one side of its centre. */
  function nearestRoadPoint(x, y, lane = 0, side = 1) {
    let best = null;
    for (const road of roads) {
      const across = road.axis === 'x' ? x : y;
      const distance = Math.abs(across - road.at);
      if (best === null || distance < best.distance) best = { road, distance, across };
    }
    if (best === null) return { x, y, axis: 'x', dir: 1 };
    const road = best.road;
    const offset = road.at + lane * side;
    if (road.axis === 'x') return { x: offset, y: Math.max(20, Math.min(WORLD.height - 20, y)), axis: 'x', dir: 1 };
    return { x: Math.max(20, Math.min(WORLD.width - 20, x)), y: offset, axis: 'y', dir: 1 };
  }

  /** A random spot on a road, facing either way along it. */
  function randomRoadSpawn(lane = ROAD.laneOffset) {
    const road = random.pick(roads);
    const side = random.chance(0.5) ? 1 : -1;
    if (road.axis === 'x') {
      return {
        x: ROAD.avenueX[Math.floor(random() * ROAD.avenueX.length)],
        y: road.at + lane * side,
        axis: 'x',
        dir: random.chance(0.5) ? 1 : -1,
        heading: road.at + lane * side,
      };
    }
    return {
      x: road.at + lane * side,
      y: ROAD.streetY[Math.floor(random() * ROAD.streetY.length)],
      axis: 'y',
      dir: random.chance(0.5) ? 1 : -1,
      heading: road.at + lane * side,
    };
  }

  /** The place by key, or throw: a mission naming a place that does not exist is a bug. */
  function place(key) {
    const found = places.get(key);
    if (!found) throw new Error(`unknown place ${key}`);
    return found;
  }

  /** The block nearest a point, for missions that want a city address. */
  function blockNear(x, y) {
    let best = blocks[0];
    let bestDistance = Infinity;
    for (const block of blocks) {
      const cx = (block.left + block.right) / 2;
      const cy = (block.top + block.bottom) / 2;
      const distance = (cx - x) ** 2 + (cy - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = block;
      }
    }
    return best;
  }

  /**
   * Push a circle of radius r at (x, y) out of every solid it overlaps, smallest axis first, and
   * say whether anything was touched. Buildings are square; the sea is one long wall.
   */
  function resolveCircle(body, radius) {
    let hit = false;
    for (const solid of solids) {
      const nx = Math.max(solid.x, Math.min(body.x, solid.x + solid.w));
      const ny = Math.max(solid.y, Math.min(body.y, solid.y + solid.h));
      const dx = body.x - nx;
      const dy = body.y - ny;
      const distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      hit = true;
      if (distance > 0.001) {
        const push = radius - distance;
        body.x += (dx / distance) * push;
        body.y += (dy / distance) * push;
      } else {
        // Dead centre inside a building: eject toward the nearest edge.
        const left = body.x - solid.x;
        const right = solid.x + solid.w - body.x;
        const top = body.y - solid.y;
        const bottom = solid.y + solid.h - body.y;
        const smallest = Math.min(left, right, top, bottom);
        if (smallest === left) body.x = solid.x - radius;
        else if (smallest === right) body.x = solid.x + solid.w + radius;
        else if (smallest === top) body.y = solid.y - radius;
        else body.y = solid.y + solid.h + radius;
      }
    }
    return hit;
  }

  /** A point on the pavement that is clear of buildings, for spawning people and cars. */
  function clearPavementPoint() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const block = random.pick(blocks);
      const x = block.left + random() * block.width;
      const y = random.chance(0.5) ? block.top - 12 : block.bottom + 12;
      const blocked = solids.some((solid) => solid.kind === 'building' && overlaps(solid, { x: x - 12, y: y - 12, w: 24, h: 24 }));
      if (!blocked) return { x, y };
    }
    return { x: WORLD.width / 2, y: WORLD.height / 2 };
  }

  return {
    ...grid,
    isOnRoad,
    isOnPavement,
    nearestRoadPoint,
    randomRoadSpawn,
    place,
    blockNear,
    resolveCircle,
    clearPavementPoint,
    blockAt,
    hash,
  };
}
