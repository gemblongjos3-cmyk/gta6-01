// The story: six missions in a chain from the Anchor Diner to the marina and back. Each mission is
// a short list of steps — drive here, shoot these people, shake the police — and the runner hands
// the current step an objective line, a marker to put on the map and a timer. A mission can fail
// (the clock, the car, a bullet); failed and finished missions both report back to main.js, which
// owns the wallet, the wanted level and the save.
import { ROAD } from './config.js';
import { createCar, stepCarPhysics } from './vehicles.js';

const REACH = 74;

/** A mission actor on foot: a body, a pistol and a temper. */
function makeActor(x, y, { hostile = true, hp = 60, name = 'target' } = {}) {
  return { x, y, angle: Math.PI / 2, hp, maxHp: hp, dead: false, hostile, fireCooldown: 1.2, hurt: 0, name, walkPhase: 0 };
}

/** A car the mission drives itself: it runs from the player, or carries the boss in the back. */
function makeMissionCar(random, x, y, angle, { model = 'sport', kind = 'mission', color = '#8a6fc0' } = {}) {
  const car = createCar(random, { x, y, angle, kind, model, color });
  car.health = 130;
  car.fleeTimer = 0;
  car.target = null;
  car.honk = 0;
  return car;
}

export function createMissions(world, random) {
  let active = null;
  let index = 0;
  let completed = 0;
  let failed = false;
  let justCompleted = false;
  let finished = false;
  const steps = [];
  const log = [];

  const diner = world.place('diner');
  const docks = world.place('marina');
  const warehouse = world.place('warehouse');
  const garage = world.place('garage');
  const hotel = world.place('hotel');
  const policeStation = world.place('police');

  /** A point on the pavement outside a block, for a step that is not a named place. */
  function blockPoint(column, row) {
    const block = world.blockAt(column, row);
    return { x: block.left + block.width / 2, y: block.bottom + 30 };
  }

  const script = [
    {
      id: 'salt-static',
      title: 'Salt & Static',
      intro: [
        'Luna: "You made it. Same eyes, older trouble."',
        'Luna: "A package is waiting at the Marina Grill. Get it to the old piers before the tide turns — and before anyone else does."',
      ],
      reward: 180,
      steps: [
        {
          kind: 'goto',
          label: 'Pick up the package at the Marina Grill',
          point: docks.door,
          seconds: 95,
          onDone: (ctx) => {
            ctx.toast('Package secured. Pier Nine, fast.');
          },
        },
        {
          kind: 'goto',
          label: 'Deliver the package to Pier Nine warehouses',
          point: warehouse.door,
          seconds: 80,
        },
      ],
    },
    {
      id: 'borrowed-time',
      title: 'Borrowed Time',
      intro: [
        'Luna: "The new address is Bayline Garage. I need wheels nobody can trace."',
        'Luna: "There is a red coupe by the diner. It belongs to a man who owes me. Borrow it."',
      ],
      reward: 260,
      steps: [
        {
          kind: 'steal',
          label: 'Take the red coupe parked by the diner',
          point: diner.door,
          radius: 120,
          spawn: (ctx) => {
            const spot = world.nearestRoadPoint(diner.door.x + 40, diner.door.y + 10, ROAD.width / 2 - 16, 1);
            ctx.missionCar = makeMissionCar(random, spot.x, spot.y, spot.axis === 'x' ? 0 : Math.PI / 2, {
              model: 'sport',
              kind: 'parked',
              color: '#e2574c',
            });
            ctx.cars.push(ctx.missionCar);
            return ctx.missionCar;
          },
        },
        {
          kind: 'deliverCar',
          label: 'Drive the coupe into Bayline Garage',
          point: garage.door,
        },
      ],
    },
    {
      id: 'tail-lights',
      title: 'Tail Lights',
      intro: [
        'Luna: "A grey sedan has been circling the block for an hour. That is a tail."',
        'Luna: "Lose him the loud way — put his car out of commission."',
      ],
      reward: 320,
      steps: [
        {
          kind: 'ram',
          label: 'Ram the grey tail car until it stops',
          spawn: (ctx) => {
            const start = blockPoint(3, 2);
            const car = makeMissionCar(random, start.x, start.y, 0, { model: 'sedan', kind: 'mission', color: '#8d94a0' });
            car.health = 120;
            ctx.missionCar = car;
            ctx.cars.push(car);
            return car;
          },
        },
      ],
    },
    {
      id: 'pier-nine',
      title: 'Pier Nine',
      intro: [
        'Luna: "The package was short. Someone at the warehouses is skimming."',
        'Luna: "Three of them, all carrying. Go in on foot and make it clear we noticed."',
      ],
      reward: 420,
      steps: [
        {
          kind: 'guns',
          label: 'Clear the warehouse yard — 3 targets',
          spawn: (ctx) => {
            const spots = [
              { x: warehouse.door.x - 70, y: warehouse.door.y + 40 },
              { x: warehouse.door.x + 60, y: warehouse.door.y + 26 },
              { x: warehouse.door.x + 10, y: warehouse.door.y + 96 },
            ];
            const actors = spots.map((spot, at) => makeActor(spot.x, spot.y, { name: ['Toll Man', 'Night Clerk', 'Dock Boss'][at], hp: 60 }));
            ctx.actors.push(...actors);
            return actors;
          },
        },
      ],
    },
    {
      id: 'heat-line',
      title: 'Heat Line',
      intro: [
        'Luna: "They know the coupe. They know the garage. Right now they know you."',
        'Luna: "Drive until the radio goes quiet. Do not stop moving."',
      ],
      reward: 500,
      steps: [
        {
          kind: 'evade',
          label: 'Shake the police — get the wanted level to zero',
          heat: 3,
        },
      ],
    },
    {
      id: 'long-goodnight',
      title: 'The Long Goodnight',
      intro: [
        'Luna: "One last run. The boss wants the marina before sunrise and he does not fly economy."',
        'Luna: "Three stars on the roof the whole way. Keep him breathing and keep moving."',
      ],
      reward: 900,
      steps: [
        {
          kind: 'escort',
          label: 'Drive the boss to the marina — stay ahead of the police',
          point: docks.door,
          heat: 3,
          spawn: (ctx) => {
            const boss = makeActor(0, 0, { hostile: false, hp: 999, name: 'The Boss' });
            boss.x = hotel.door.x;
            boss.y = hotel.door.y;
            ctx.actors.push(boss);
            ctx.boss = boss;
            return boss;
          },
        },
      ],
    },
  ];

  function mission() {
    return script[index] ?? null;
  }

  /** The step currently being played, or null. */
  function step() {
    return steps[steps.length - 1] ?? null;
  }

  /** Start the next mission in the chain; returns its intro dialogue. */
  function startNext(ctx) {
    if (index >= script.length) return null;
    const next = script[index];
    active = next;
    steps.length = 0;
    failed = false;
    justCompleted = false;
    finished = false;
    log.push({ at: index, id: next.id, title: next.title });
    // A mission only plays once its first step is open: without this the objective card stays
    // blank and nothing the player does can advance the chain.
    if (next.steps.length > 0) beginStep(next.steps[0], ctx);
    return { mission: next, dialogue: next.intro };
  }

  /** Begin one step: spawn its actors, set its clock, warm up the heat it asks for. */
  function beginStep(entry, ctx) {
    const state = { entry, elapsed: 0, spawned: null, done: false };
    steps.push(state);
    if (entry.spawn) state.spawned = entry.spawn(ctx);
    if (entry.heat) ctx.police.setWanted(entry.heat);
  }

  function completeStep(ctx) {
    const state = steps.pop();
    if (!state) return;
    if (state.entry.onDone) state.entry.onDone(ctx);
    const next = active?.steps[steps.length];
    if (next) beginStep(next, ctx);
    else complete(ctx);
  }

  function fail(reason) {
    failed = true;
    active = null;
    steps.length = 0;
    return reason;
  }

  function complete(ctx) {
    if (!active) return;
    justCompleted = true;
    completed = Math.max(completed, index + 1);
    index += 1;
    if (index >= script.length) finished = true;
    active = null;
    steps.length = 0;
    if (ctx) {
      ctx.actors.length = 0;
      if (ctx.missionCar) {
        ctx.missionCar.kind = 'parked';
        ctx.missionCar.driver = null;
        ctx.missionCar = null;
      }
    }
  }

  /** The point the player should head for now: the marker on the minimap. */
  function target() {
    const state = step();
    if (!state) return null;
    const entry = state.entry;
    if (entry.kind === 'ram' || entry.kind === 'steal') return state.spawned ? { x: state.spawned.x, y: state.spawned.y } : entry.point;
    if (entry.kind === 'guns') {
      const alive = (state.spawned ?? []).filter((actor) => !actor.dead);
      return alive[0] ?? entry.point;
    }
    if (entry.kind === 'escort') return entry.point;
    return entry.point ?? null;
  }

  /** Advance an actor's shooting and the mission's own clock; called every fixed step. */
  function updateActors(ctx, dt) {
    for (const actor of ctx.actors ?? []) {
      actor.hurt = Math.max(0, actor.hurt - dt);
      if (actor.dead) continue;
      const dx = ctx.player.x - actor.x;
      const dy = ctx.player.y - actor.y;
      const distance = Math.hypot(dx, dy);
      actor.angle = Math.atan2(dy, dx);
      if (!actor.hostile) continue;
      if (distance > 520 && step()?.entry.kind !== 'guns') continue;
      // Walk toward the player until close, then hold and fire.
      if (distance > 190) {
        const move = 46 * dt;
        const body = { x: actor.x + (dx / distance) * move, y: actor.y + (dy / distance) * move };
        world.resolveCircle(body, 9);
        actor.x = body.x;
        actor.y = body.y;
        actor.walkPhase += dt * 6;
      }
      actor.fireCooldown -= dt;
      if (actor.fireCooldown <= 0 && distance < 520) {
        actor.fireCooldown = 0.9 + random() * 0.7;
        if (ctx.onActorShot) ctx.onActorShot(actor, actor.angle);
      }
    }
  }

  /**
   * One fixed step of the current mission. `ctx` carries the player, the police, the shared actor
   * and car lists, and callbacks for shots, money and toasts. Returns nothing; main.js reads
   * takeCompleted / failed afterwards.
   */
  function update(dt, ctx) {
    if (!active || steps.length === 0) return;
    const state = step();
    const entry = state.entry;
    state.elapsed += dt;
    updateActors(ctx, dt);

    if (entry.seconds && state.elapsed > entry.seconds) {
      fail('Time ran out.');
      return;
    }

    if (entry.kind === 'goto' || entry.kind === 'escort') {
      if (Math.hypot(ctx.player.x - entry.point.x, ctx.player.y - entry.point.y) < REACH + 40) {
        if (entry.kind === 'escort') {
          if (ctx.police.wanted > 0 && !entry.saidHot) {
            entry.saidHot = true;
            ctx.toast('Still hot. Keep driving — the marina is close.');
            return;
          }
        }
        completeStep(ctx);
      }
      return;
    }

    if (entry.kind === 'steal') {
      const car = state.spawned;
      if (!car) {
        completeStep(ctx);
        return;
      }
      const inIt = ctx.player.car === car;
      const gone = !(ctx.allCars ? ctx.allCars() : ctx.cars).includes(car);
      if (gone) {
        fail('The coupe is gone.');
        return;
      }
      if (inIt) completeStep(ctx);
      return;
    }

    if (entry.kind === 'deliverCar') {
      const car = state.spawned ?? ctx.missionCar;
      if (ctx.player.car !== car) {
        if (!entry.hinted) {
          entry.hinted = true;
          ctx.toast('You need the coupe. Get back in.');
        }
        return;
      }
      if (Math.hypot(car.x - entry.point.x, car.y - entry.point.y) < 130) {
        completeStep(ctx);
      }
      return;
    }

    if (entry.kind === 'ram') {
      const car = state.spawned;
      if (!car) {
        completeStep(ctx);
        return;
      }
      const playerCar = ctx.player.car;
      if (playerCar) {
        const gap = Math.hypot(playerCar.x - car.x, playerCar.y - car.y);
        if (gap < 62 && Math.abs(playerCar.speed) > 70) {
          car.health -= Math.abs(playerCar.speed) * 0.09;
          car.hitFlash = 0.3;
          if (car.health <= 0) {
            car.smoke = 1;
            completeStep(ctx);
            return;
          }
        }
      }
      // The tail keeps running away from a player on foot, and coasts when abandoned.
      if (playerCar) {
        const dx = car.x - playerCar.x;
        const dy = car.y - playerCar.y;
        const distance = Math.hypot(dx, dy) || 1;
        const fleeAngle = Math.atan2(dy, dx);
        let delta = fleeAngle - car.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, delta));
        stepCarPhysics(car, dt, { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, delta * 1.5)) }, world);
        if (distance > 900) {
          car.x = playerCar.x + Math.cos(fleeAngle) * 420;
          car.y = playerCar.y + Math.sin(fleeAngle) * 420;
        }
      } else {
        stepCarPhysics(car, dt, { throttle: 0, brake: 0.2, steer: 0 }, world);
      }
      return;
    }

    if (entry.kind === 'guns') {
      const alive = (state.spawned ?? []).filter((actor) => !actor.dead);
      if (alive.length === 0) completeStep(ctx);
      return;
    }

    if (entry.kind === 'evade') {
      if (ctx.police.wanted === 0) completeStep(ctx);
    }
  }

  /** The toast line under the objective, e.g. how many targets are left or the clock. */
  function status() {
    const state = step();
    if (!state) return '';
    const entry = state.entry;
    if (entry.kind === 'guns') {
      const alive = (state.spawned ?? []).filter((actor) => !actor.dead).length;
      return `${alive} still standing`;
    }
    if (entry.kind === 'ram') {
      const car = state.spawned;
      return car ? `${Math.max(0, Math.round((car.health / 120) * 100))}% left` : '';
    }
    if (entry.kind === 'evade') return 'Wanted level must reach zero';
    if (entry.kind === 'escort') return 'The Boss is in the car';
    return '';
  }

  function remainingTime() {
    const state = step();
    if (!state?.entry.seconds) return null;
    return Math.max(0, state.entry.seconds - state.elapsed);
  }

  function takeCompleted() {
    const value = justCompleted;
    justCompleted = false;
    return value;
  }

  function takeFailed() {
    const value = failed;
    failed = false;
    return value;
  }

  /** Give up on the current mission: back to before its first step, no reward. */
  function abandon(ctx) {
    if (!active) return false;
    active = null;
    steps.length = 0;
    if (ctx) {
      ctx.actors.length = 0;
      if (ctx.missionCar) {
        ctx.missionCar.kind = 'parked';
        ctx.missionCar = null;
      }
    }
    return true;
  }

  /** Begin the mission at `at` (1-based), for a continue or a restart. */
  function startAt(at, ctx) {
    index = Math.max(0, Math.min(script.length - 1, at - 1));
    return startNext(ctx);
  }

  function load(progress) {
    completed = progress.completed ?? 0;
    index = completed;
    active = null;
    steps.length = 0;
    finished = index >= script.length;
  }

  return {
    script,
    get active() {
      return active;
    },
    get index() {
      return index;
    },
    get completed() {
      return completed;
    },
    get finished() {
      return finished;
    },
    get dialogueLog() {
      return log;
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
