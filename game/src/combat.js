// The pistol and everything it throws: bullets with a little travel time, the muzzle flash at the
// barrel, sparks where a round lands, and the hit tests against people, cars and police cruisers.
// Enemy rounds travel through the same lists, flagged hostile, and hurt the player instead.
import { PLAYER } from './config.js';

const BULLET_SPEED = 2100;
const BULLET_LIFE = 0.42;

/**
 * The player's arsenal, lightest first. The pistol is carried from the
 * first minute; the SMG and the scattergun are earned on the story —
 * mission three pays out the WASP, mission five the MARLIN. One trigger
 * pull costs one round from the magazine however many pellets it throws.
 */
export const WEAPONS = [
  { id: 'pistol', name: 'Pistol', model: 'KESTREL 9', damage: 34, fireDelay: 0.26, spread: 0.03, pellets: 1, magazine: 12, reloadTime: 1.25, startReserve: 72 },
  { id: 'smg', name: 'SMG', model: 'WASP 6149', damage: 16, fireDelay: 0.085, spread: 0.1, pellets: 1, magazine: 30, reloadTime: 1.5, startReserve: 90 },
  { id: 'scatter', name: 'Scattergun', model: 'MARLIN 12', damage: 11, fireDelay: 0.8, spread: 0.26, pellets: 6, magazine: 6, reloadTime: 1.9, startReserve: 24 },
];

export function createCombat(world) {
  const bullets = [];
  const flashes = [];
  const sparks = [];
  const casings = [];
  const hitmarks = [];
  let shake = 0;

  // The weapon shelf: per-weapon magazine and reserve counts, which one is
  // in hand, and which have been earned. The live counts the player spends
  // sit on the player state; main.js swaps them through here on a switch.
  const weaponState = WEAPONS.map((def, i) => ({ def, mag: def.magazine, reserve: def.startReserve, unlocked: i === 0 }));
  let currentWeapon = 0;

  /** The weapon in hand: its definition plus its stored counts. */
  function weapon() {
    return weaponState[currentWeapon];
  }

  /** Put another earned weapon in hand. False when it is still locked. */
  function selectWeapon(index) {
    if (!weaponState[index] || !weaponState[index].unlocked) return false;
    currentWeapon = index;
    return true;
  }

  /** Earn a weapon (a story payout): it joins the wheel for good. */
  function unlockWeapon(index) {
    if (weaponState[index]) weaponState[index].unlocked = true;
  }

  /** Every weapon's shelf state, for the wheel and the slot strip. */
  function weaponStates() {
    return weaponState.map((entry, i) => ({ ...entry, active: i === currentWeapon }));
  }

  /** Force a weapon's exact state — the screenshot rig stages a loadout. */
  function stageWeapon(index, mag, reserve) {
    const entry = weaponState[index];
    if (!entry) return;
    entry.unlocked = true;
    entry.mag = mag;
    entry.reserve = reserve;
    currentWeapon = index;
  }

  /** A fresh evening: pistol only, every magazine full. */
  function resetWeapons() {
    weaponState.forEach((entry, i) => {
      entry.mag = entry.def.magazine;
      entry.reserve = entry.def.startReserve;
      entry.unlocked = i === 0;
    });
    currentWeapon = 0;
  }

  function addBullet(x, y, angle, hostile, damage) {
    bullets.push({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      life: BULLET_LIFE,
      hostile,
      damage,
    });
  }

  /** Fire one round from (x, y) toward `angle`; the caller pays ammo and tells the police. */
  function shoot(x, y, angle, { hostile = false, damage = 34, spread = 0.03 } = {}) {
    const aim = angle + (Math.random() - 0.5) * spread;
    addBullet(x, y, aim, hostile, damage);
    flashes.push({ x: x + Math.cos(aim) * 18, y: y + Math.sin(aim) * 18, angle: aim, life: 0.07, hostile });
    casings.push({ x, y, vx: -Math.cos(aim) * 40 + (Math.random() - 0.5) * 30, vy: -Math.sin(aim) * 40, life: 1.4, spin: Math.random() * 6 });
    shake = Math.max(shake, 2.4);
    return aim;
  }

  /** A burst of sparks where a round struck something. */
  function spark(x, y, angle, color = '#ffd28a') {
    for (let index = 0; index < 4; index += 1) {
      sparks.push({
        x,
        y,
        vx: Math.cos(angle + Math.PI + (Math.random() - 0.5) * 1.6) * (60 + Math.random() * 140),
        vy: Math.sin(angle + Math.PI + (Math.random() - 0.5) * 1.6) * (60 + Math.random() * 140),
        life: 0.25 + Math.random() * 0.2,
        color,
      });
    }
  }

  /**
   * Move every round one step and resolve hits. `targets` holds the pedestrians, the police cars,
   * the traffic and mission actors, each with x, y and a radius; a hit calls onHit(kind, entity).
   */
  function update(dt, ctx) {
    shake *= 0.88;
    for (let index = bullets.length - 1; index >= 0; index -= 1) {
      const bullet = bullets[index];
      bullet.life -= dt;
      const steps = 2;
      let dead = bullet.life <= 0;
      for (let step = 0; step < steps && !dead; step += 1) {
        bullet.x += (bullet.vx * dt) / steps;
        bullet.y += (bullet.vy * dt) / steps;
        if (bullet.x < 0 || bullet.x > world.width || bullet.y < 0 || bullet.y > world.height) {
          dead = true;
          break;
        }
        // Walls stop rounds.
        const wall = world.solids.find(
          (solid) => solid.kind === 'building' && bullet.x > solid.x && bullet.x < solid.x + solid.w && bullet.y > solid.y && bullet.y < solid.y + solid.h,
        );
        if (wall) {
          spark(bullet.x, bullet.y, Math.atan2(bullet.vy, bullet.vx), '#e8d9c0');
          if (ctx.onWallHit) ctx.onWallHit(wall, bullet);
          dead = true;
          break;
        }
        if (bullet.hostile) {
          if (ctx.player && Math.hypot(ctx.player.x - bullet.x, ctx.player.y - bullet.y) < PLAYER.radius + 4) {
            ctx.onPlayerHit(bullet.damage);
            hitmarks.push({ x: bullet.x, y: bullet.y, life: 0.14 });
            spark(bullet.x, bullet.y, Math.atan2(bullet.vy, bullet.vx), '#ff7a6a');
            dead = true;
            break;
          }
        } else {
          const hit = findVictim(bullet, ctx);
          if (hit) {
            ctx.onHit(hit.kind, hit.entity, bullet);
            if (hit.kind === 'actor') hitmarks.push({ x: bullet.x, y: bullet.y, life: 0.14 });
            spark(bullet.x, bullet.y, Math.atan2(bullet.vy, bullet.vx), hit.kind === 'car' ? '#ffb46a' : '#d8564a');
            dead = true;
            break;
          }
        }
      }
      if (dead) bullets.splice(index, 1);
    }
    for (let index = flashes.length - 1; index >= 0; index -= 1) {
      flashes[index].life -= dt;
      if (flashes[index].life <= 0) flashes.splice(index, 1);
    }
    for (let index = hitmarks.length - 1; index >= 0; index -= 1) {
      hitmarks[index].life -= dt;
      if (hitmarks[index].life <= 0) hitmarks.splice(index, 1);
    }
    for (let index = sparks.length - 1; index >= 0; index -= 1) {
      const s = sparks[index];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.93;
      s.vy *= 0.93;
      if (s.life <= 0) sparks.splice(index, 1);
    }
    for (let index = casings.length - 1; index >= 0; index -= 1) {
      const c = casings[index];
      c.life -= dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.9;
      c.vy *= 0.9;
      c.spin += dt * 20;
      if (c.life <= 0) casings.splice(index, 1);
    }
  }

  /** The first thing a player round touches inside its step, or null. */
  function findVictim(bullet, ctx) {
    for (const person of ctx.pedestrians ?? []) {
      if (person.dead) continue;
      if (Math.hypot(person.x - bullet.x, person.y - bullet.y) < 12) return { kind: 'person', entity: person };
    }
    for (const actor of ctx.actors ?? []) {
      if (actor.dead) continue;
      if (Math.hypot(actor.x - bullet.x, actor.y - bullet.y) < 16) return { kind: 'actor', entity: actor };
    }
    for (const car of ctx.cars ?? []) {
      if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 22) return { kind: 'car', entity: car };
    }
    return null;
  }

  function clear() {
    bullets.length = 0;
    flashes.length = 0;
    sparks.length = 0;
    casings.length = 0;
    hitmarks.length = 0;
    shake = 0;
  }

  return {
    bullets,
    flashes,
    sparks,
    casings,
    hitmarks,
    update,
    shoot,
    spark,
    clear,
    weapon,
    selectWeapon,
    unlockWeapon,
    weaponStates,
    stageWeapon,
    resetWeapons,
    get currentWeaponIndex() {
      return currentWeapon;
    },
    get shake() {
      return shake;
    },
  };
}
