// The story of Palm Shores, told as data plus a small step machine.
//
// Six missions hang off one chain. Each mission is a list of steps; a step is
// a plain record saying what kind of errand it is, where it happens and how
// long the player gets. This module owns the chain's bookkeeping — which
// mission is live, which step inside it, what was spawned for it, whether it
// ended in a payday or a failure — while the driving, shooting and drawing
// stay with the systems that already do those jobs.
//
// The host (main.js) feeds one fixed step per tick through update(dt, ctx).
// ctx is a shared bag the host keeps for the whole evening:
//   player    the live player state object (x, y, car, health, money)
//   police    the wanted system (wanted, setWanted)
//   cars      every car array the mission may push a spawned car into
//   allCars() every car currently standing in the world
//   actors    the shared list of mission people (gunmen, the boss)
//   toast     a one-line message to the player
//   onActorShot(actor, angle)  a mission gunman just fired
//   missionCar  slot the host and this module share for the step's key car
import { ROAD } from './config.js';
import { createCar, stepCarPhysics } from './vehicles.js';

/** How close, in world pixels, counts as "arrived" for a step's target. */
const ARRIVE_RADIUS = 84;
/** Gunmen open fire inside this distance and hold their nerve outside it. */
const GUNMAN_RANGE = 540;
/** How much punishment the tail car in mission three can take. */
const TAIL_CAR_HEALTH = 130;

/** Paint for the people this module puts on the street. */
const ACTOR_SHIRTS = ['#4a4a52', '#5c3a3a', '#3a4a5c', '#54423a'];
const ACTOR_SKIN = ['#8a5a3c', '#c08a63', '#6b4230', '#e0b48c'];

/** One armed extra for a shootout step, standing where the host can draw him. */
function buildGunman(random, x, y, facing) {
  return {
    x,
    y,
    angle: facing,
    aim: facing,
    dead: false,
    down: 0,
    health: 60,
    fireTimer: 0.8 + random() * 1.4,
    strafe: random.chance(0.5) ? 1 : -1,
    shirt: ACTOR_SHIRTS[Math.floor(random() * ACTOR_SHIRTS.length)],
    skin: ACTOR_SKIN[Math.floor(random() * ACTOR_SKIN.length)],
    walkPhase: random() * 6,
    missionActor: true,
  };
}

/** A car that belongs to a step: keyed, coloured and tougher than traffic. */
function buildStepCar(random, x, y, angle, paint, model) {
  const car = createCar(random, { x, y, angle, kind: 'mission', color: paint, model });
  car.health = TAIL_CAR_HEALTH;
  return car;
}

export function createMissions(world, random) {
  // ------------------------------------------------------------------ story
  // The chain, in order. `intro` lines are flavour the host shows as toasts
  // when a mission opens; `steps` are played strictly in sequence.
  const script = [
    {
      id: 'salt-static',
      title: 'Salt & Static',
      reward: 180,
      intro: [
        'Luna: A package is waiting at the Marina Grill. No questions, no names.',
        'Luna: Take it to the warehouses at Pier Nine. The clock is already rude.',
      ],
      steps: [
        { kind: 'goto', place: 'marina', label: 'Pick up the package at the Marina Grill', seconds: 95 },
        { kind: 'goto', place: 'warehouse', label: 'Deliver the package to Pier Nine warehouses', seconds: 80 },
      ],
    },
    {
      id: 'borrowed-time',
      title: 'Borrowed Time',
      reward: 260,
      intro: [
        'Luna: See the red coupe by the diner? Its owner owes us a favour.',
        'Luna: Borrow it. Bayline Garage will know what to do with it.',
      ],
      steps: [
        { kind: 'steal', label: 'Take the red coupe parked by the diner' },
        { kind: 'garage', place: 'garage', label: 'Drive the coupe into Bayline Garage' },
      ],
    },
    {
      id: 'tail-lights',
      title: 'Tail Lights',
      reward: 320,
      intro: [
        'Luna: A grey sedan has been following my people all week.',
        'Luna: Follow it back. Then make it stop — permanently-ish.',
      ],
      steps: [
        { kind: 'ram', label: 'Ram the grey tail car until it stops' },
      ],
    },
    {
      id: 'pier-nine',
      title: 'Pier Nine',
      reward: 420,
      intro: [
        'Luna: The warehouse yard changed hands last night. Armed hands.',
        'Luna: Three of them. Walk in quiet, walk out paid.',
      ],
      steps: [
        { kind: 'guns', place: 'warehouse', label: 'Clear the warehouse yard — 3 targets' },
      ],
    },
    {
      id: 'heat-line',
      title: 'Heat Line',
      reward: 500,
      intro: [
        'Luna: That yard job made noise. The whole precinct is awake.',
        'Luna: Lose them. All of them. Then we talk about the last job.',
      ],
      steps: [
        { kind: 'evade', label: 'Shake the police — get the wanted level to zero', heat: 3 },
      ],
    },
    {
      id: 'long-goodnight',
      title: 'The Long Goodnight',
      reward: 900,
      intro: [
        'Luna: The boss is at the diner and the city is watching.',
        'Luna: Drive him to the marina. Whatever follows you, outrun it.',
      ],
      steps: [
        { kind: 'escort', place: 'marina', label: 'Drive the boss to the marina — stay ahead of the police', heat: 3 },
      ],
    },
  ];

  // ------------------------------------------------------------------ state
  let cursor = 0; // index of the mission the chain is currently on
  let banked = 0; // missions fully completed, for the save file
  let live = null; // the mission object being played, or null between missions
  let stepState = null; // { entry, position, clock, spawned, warned, saidHot }
  let chainDone = false;
  let payday = false; // a completion the host has not collected yet
  let blown = false; // a failure the host has not collected yet
  const log = []; // one entry per mission started, for the debrief

  /** The mission record the chain points at, or null when the story is over. */
  function mission() {
    return script[cursor] ?? null;
  }

  /** The live step's working state, or null when nothing is being played. */
  function step() {
    return stepState;
  }

  /** Where a step happens in the world: a named place's doorstep, usually. */
  function stepPoint(entry) {
    if (entry.place) {
      const spot = world.place(entry.place);
      return { x: spot.door.x, y: spot.door.y };
    }
    if (entry.point) return entry.point;
    return null;
  }

  // -------------------------------------------------------------- spawning
  /** Scatter three gunmen around the warehouse yard, facing the entrance. */
  function spawnGunmen(ctx, entry) {
    const yard = world.place(entry.place ?? 'warehouse');
    const offsets = [
      [-120, 60],
      [90, 130],
      [30, -110],
    ];
    const crew = offsets.map(([dx, dy], i) => buildGunman(random, yard.door.x + dx, yard.door.y + dy, Math.PI * 0.75 + i * 0.4));
    ctx.actors.push(...crew);
    return crew;
  }

  /** The red coupe for mission two, parked in plain sight of the diner. */
  function spawnCoupe(ctx) {
    const diner = world.place('diner');
    const spot = world.nearestRoadPoint(diner.door.x + 60, diner.door.y + 30, ROAD.width / 2 - 14, 1);
    const car = buildStepCar(random, spot.x, spot.y, spot.axis === 'x' ? Math.PI / 2 : 0, '#e2574c', 'sport');
    ctx.cars.push(car);
    ctx.missionCar = car;
    return car;
  }

  /** Four corners of the block around a point: the tail car's nervous loop. */
  function circuitAround(cx, cy) {
    const block = world.blockNear(cx, cy);
    const pad = 120;
    return [
      { x: block.left - pad, y: block.top - pad },
      { x: block.right + pad, y: block.top - pad },
      { x: block.right + pad, y: block.bottom + pad },
      { x: block.left - pad, y: block.bottom + pad },
    ];
  }

  /** The grey tail car for mission three, already rolling when it spawns. */
  function spawnTailCar(ctx) {
    const garage = world.place('garage');
    const spot = world.nearestRoadPoint(garage.door.x + 320, garage.door.y + 160, ROAD.laneOffset, 1);
    const car = buildStepCar(random, spot.x, spot.y, spot.axis === 'x' ? 0 : Math.PI / 2, '#8b8f98', 'sedan');
    car.axis = spot.axis;
    car.dir = 1;
    car.laneCenter = spot.axis === 'x' ? spot.y : spot.x;
    car.cruise = 235;
    car.waypoints = circuitAround(garage.door.x, garage.door.y);
    car.wpIndex = 0;
    ctx.cars.push(car);
    ctx.missionCar = car;
    return car;
  }

  /** The boss: patient, well dressed, and entirely unwilling to walk. */
  function spawnBoss(ctx) {
    const diner = world.place('diner');
    const boss = {
      x: diner.door.x + 26,
      y: diner.door.y + 18,
      angle: -Math.PI / 2,
      aim: -Math.PI / 2,
      dead: false,
      down: 0,
      health: 999,
      riding: false,
      shirt: '#2e2a38',
      skin: '#c08a63',
      walkPhase: 0,
      missionActor: true,
      isBoss: true,
    };
    ctx.actors.push(boss);
    ctx.boss = boss;
    return boss;
  }

  // ------------------------------------------------------------ step flow
  /** Retire whatever the live step spawned, so the street stays honest. */
  function clearStepSpawns(ctx) {
    if (!ctx) return;
    if (ctx.actors) ctx.actors.length = 0;
    if (ctx.missionCar) {
      ctx.missionCar.kind = 'parked';
      ctx.missionCar.driver = null;
      ctx.missionCar = null;
    }
    ctx.boss = null;
  }

  /** Open the step at `position` inside the live mission. */
  function openStep(ctx, position) {
    const entry = live.steps[position];
    stepState = {
      entry,
      position,
      clock: entry.seconds ?? null,
      spawned: null,
      warned: false,
      saidHot: false,
    };
    if (entry.heat) ctx.police.setWanted(entry.heat);
    if (entry.kind === 'steal') stepState.spawned = spawnCoupe(ctx);
    else if (entry.kind === 'ram') stepState.spawned = spawnTailCar(ctx);
    else if (entry.kind === 'guns') stepState.spawned = spawnGunmen(ctx, entry);
    else if (entry.kind === 'escort') stepState.spawned = spawnBoss(ctx);
    return stepState;
  }

  /** The mission is done: bank it, flag the payday, clear the stage. */
  function finishMission(ctx) {
    banked = Math.max(banked, cursor + 1);
    cursor += 1;
    chainDone = cursor >= script.length;
    live = null;
    stepState = null;
    payday = true;
    clearStepSpawns(ctx);
  }

  /** Advance one step inside the mission, or close the mission out. */
  function advanceStep(ctx) {
    const nextPosition = stepState.position + 1;
    if (nextPosition >= live.steps.length) {
      finishMission(ctx);
      return;
    }
    clearStepSpawns(ctx);
    openStep(ctx, nextPosition);
    ctx.toast(live.steps[nextPosition].label);
  }

  /** Start the mission the chain points at. False when the story is over. */
  function startNext(ctx) {
    if (live || chainDone) return false;
    const next = mission();
    if (!next) {
      chainDone = true;
      return false;
    }
    live = next;
    log.push({ at: cursor, id: next.id, title: next.title });
    openStep(ctx, 0);
    return true;
  }

  /** Jump the chain to mission number `at` (one-based) and start it there. */
  function startAt(at, ctx) {
    cursor = Math.max(0, Math.min(script.length - 1, at - 1));
    chainDone = false;
    live = null;
    stepState = null;
    return startNext(ctx);
  }

  /** Restore chain progress from a save: how many missions are banked. */
  function load(progress) {
    banked = Math.max(0, Math.min(script.length, progress?.completed ?? 0));
    cursor = banked;
    live = null;
    stepState = null;
    chainDone = cursor >= script.length;
    payday = false;
    blown = false;
  }

  /** Give the live mission up: chain rewinds to its first step, unpaid. */
  function abandon(ctx) {
    if (!live) return false;
    clearStepSpawns(ctx);
    live = null;
    stepState = null;
    return true;
  }

  /** Mark the live mission complete from outside (host events). */
  function complete(ctx) {
    if (!live) return;
    finishMission(ctx ?? {});
  }

  /** Mark the live mission failed; the host collects it via takeFailed. */
  function fail(ctx) {
    if (!live) return;
    clearStepSpawns(ctx);
    live = null;
    stepState = null;
    blown = true;
  }

  // --------------------------------------------------------------- actors
  /**
   * Move the people and cars a step spawned: gunmen track and shoot, the
   * tail car runs its loop, the boss waits, boards, rides and gets out.
   */
  function updateSpawns(dt, ctx) {
    if (!stepState) return;
    const entry = stepState.entry;
    const player = ctx.player;

    if (entry.kind === 'guns') {
      for (const man of stepState.spawned ?? []) {
        if (man.dead) {
          man.down = Math.min(1, man.down + dt * 3);
          continue;
        }
        const dx = player.x - man.x;
        const dy = player.y - man.y;
        const distance = Math.hypot(dx, dy);
        man.aim = Math.atan2(dy, dx);
        man.angle = man.aim;
        if (distance > 190) {
          man.x += Math.cos(man.aim) * 42 * dt;
          man.y += Math.sin(man.aim) * 42 * dt;
          man.walkPhase += dt * 5;
        } else {
          man.x += Math.cos(man.aim + Math.PI / 2) * man.strafe * 16 * dt;
          man.y += Math.sin(man.aim + Math.PI / 2) * man.strafe * 16 * dt;
          if (random.chance(dt * 0.4)) man.strafe *= -1;
        }
        man.fireTimer -= dt;
        if (distance < GUNMAN_RANGE && man.fireTimer <= 0) {
          man.fireTimer = 1.05 + random() * 0.9;
          if (ctx.onActorShot) ctx.onActorShot(man, man.aim);
        }
      }
      return;
    }

    if (entry.kind === 'ram') {
      const car = stepState.spawned;
      if (!car) return;
      const points = car.waypoints ?? [];
      if (points.length === 0) return;
      const goal = points[car.wpIndex % points.length];
      const dx = goal.x - car.x;
      const dy = goal.y - car.y;
      if (Math.hypot(dx, dy) < 90) car.wpIndex = (car.wpIndex + 1) % points.length;
      const desired = Math.atan2(dy, dx);
      let delta = desired - car.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const hurt = car.health < TAIL_CAR_HEALTH * 0.55;
      const throttle = car.health > 30 ? (hurt ? 1 : 0.75) : 0;
      stepCarPhysics(car, dt, { throttle, brake: car.health <= 30 ? 0.7 : 0, steer: Math.max(-1, Math.min(1, delta * 1.6)) }, world);
      return;
    }

    if (entry.kind === 'escort') {
      const boss = stepState.spawned;
      if (!boss || boss.dead) return;
      if (boss.riding) {
        if (player.car) {
          boss.x = player.car.x;
          boss.y = player.car.y;
          boss.angle = player.car.angle;
        } else {
          boss.riding = false;
          boss.x = player.x + 30;
          boss.y = player.y + 10;
          ctx.toast('The boss waits by the car. He is not walking.');
        }
        return;
      }
      const near = Math.hypot(player.x - boss.x, player.y - boss.y) < 110;
      if (near && player.car) {
        boss.riding = true;
        ctx.toast('Boss aboard. Marina, and make it smooth.');
      } else if (near && !player.car && !stepState.warned) {
        stepState.warned = true;
        ctx.toast('The boss needs a car. Bring one to the diner.');
      }
    }
  }

  // ----------------------------------------------------------------- tick
  /**
   * One fixed step of the chain. Completion and failure are latched into
   * flags the host collects with takeCompleted / takeFailed, so the host
   * decides when the banner, the jingle and the save happen.
   */
  function update(dt, ctx) {
    if (!live || !stepState) return;
    const entry = stepState.entry;
    const player = ctx.player;

    updateSpawns(dt, ctx);

    if (stepState.clock !== null) {
      stepState.clock -= dt;
      if (stepState.clock <= 0) {
        fail(ctx);
        return;
      }
    }

    const point = stepPoint(entry);
    const distance = point ? Math.hypot(player.x - point.x, player.y - point.y) : Infinity;

    if (entry.kind === 'goto') {
      if (distance < ARRIVE_RADIUS) advanceStep(ctx);
      return;
    }
    if (entry.kind === 'steal') {
      const car = stepState.spawned ?? ctx.missionCar;
      if (car && player.car === car) advanceStep(ctx);
      else if (car && !(ctx.allCars ? ctx.allCars() : ctx.cars).includes(car)) fail(ctx);
      return;
    }
    if (entry.kind === 'garage') {
      const car = stepState.spawned ?? ctx.missionCar;
      if (player.car !== car) {
        if (!stepState.warned) {
          stepState.warned = true;
          ctx.toast('You need the coupe. Get back in.');
        }
        return;
      }
      stepState.warned = false;
      if (distance < ARRIVE_RADIUS + 30) advanceStep(ctx);
      return;
    }
    if (entry.kind === 'ram') {
      const car = stepState.spawned;
      if (!car) return;
      const wrecked = car.health <= 30;
      const stopped = wrecked || (car.health < TAIL_CAR_HEALTH * 0.6 && Math.abs(car.speed) < 6);
      if (stopped) advanceStep(ctx);
      return;
    }
    if (entry.kind === 'guns') {
      const crew = stepState.spawned ?? [];
      if (crew.length > 0 && crew.every((man) => man.dead)) advanceStep(ctx);
      return;
    }
    if (entry.kind === 'evade') {
      if (ctx.police.wanted === 0) advanceStep(ctx);
      return;
    }
    if (entry.kind === 'escort') {
      const boss = stepState.spawned;
      if (boss && boss.dead) {
        fail(ctx);
        return;
      }
      if (boss && boss.riding && player.car && distance < ARRIVE_RADIUS + 40) {
        advanceStep(ctx);
        return;
      }
      if (boss && boss.riding && ctx.police.wanted > 0 && !stepState.saidHot) {
        stepState.saidHot = true;
        ctx.toast('Still hot. Keep driving — the marina is close.');
      }
    }
  }

  // -------------------------------------------------------------- queries
  /** The point the map marker and the objective arrow should aim at. */
  function target() {
    if (!live || !stepState) return null;
    const entry = stepState.entry;
    if (entry.kind === 'steal' || entry.kind === 'ram') {
      const car = stepState.spawned ?? null;
      return car ? { x: car.x, y: car.y, label: entry.label } : null;
    }
    if (entry.kind === 'guns') {
      const alive = (stepState.spawned ?? []).find((man) => !man.dead);
      if (alive) return { x: alive.x, y: alive.y, label: entry.label };
    }
    if (entry.kind === 'escort' && stepState.spawned && !stepState.spawned.riding) {
      return { x: stepState.spawned.x, y: stepState.spawned.y, label: 'Pick up the boss at the diner' };
    }
    const point = stepPoint(entry);
    return point ? { x: point.x, y: point.y, label: entry.label } : null;
  }

  /** A short live readout for the objective line, per step kind. */
  function status() {
    if (!live || !stepState) return '';
    const entry = stepState.entry;
    if (entry.kind === 'guns') {
      const alive = (stepState.spawned ?? []).filter((man) => !man.dead).length;
      return `${alive} still standing`;
    }
    if (entry.kind === 'ram') {
      const car = stepState.spawned;
      return car ? `${Math.max(0, Math.round((car.health / TAIL_CAR_HEALTH) * 100))}% left` : '';
    }
    if (entry.kind === 'evade') return 'Lose every star';
    if (entry.kind === 'escort') return stepState.spawned?.riding ? 'Boss aboard' : 'Collect the boss';
    return '';
  }

  /** Seconds left on the live step's clock, or null when it has none. */
  function remainingTime() {
    if (!stepState || stepState.clock === null) return null;
    return Math.max(0, stepState.clock);
  }

  /** Collect a latched completion exactly once. */
  function takeCompleted() {
    const value = payday;
    payday = false;
    return value;
  }

  /** Collect a latched failure exactly once. */
  function takeFailed() {
    const value = blown;
    blown = false;
    return value;
  }

  return {
    script,
    get active() {
      return live;
    },
    get index() {
      return cursor;
    },
    get completed() {
      return banked;
    },
    get finished() {
      return chainDone;
    },
    get dialogueLog() {
      return log.slice();
    },
    mission,
    step,
    startNext,
    update,
    status,
    remainingTime,
    target,
    takeCompleted,
    takeFailed,
    abandon,
    startAt,
    load,
    complete,
    fail,
  };
}
