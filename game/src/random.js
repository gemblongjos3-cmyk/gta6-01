// A small seeded random number generator (mulberry32): the same seed gives the same city, the
// same traffic and the same screenshots. Everything procedural draws from one of these, so a
// scene staged with ?seed=7 looks identical every time it is photographed.

export function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A random number in [min, max). */
  random.range = function range(min, max) {
    return min + random() * (max - min);
  };

  /** A random integer in [min, max]. */
  random.int = function int(min, max) {
    return Math.floor(min + random() * (max - min + 1));
  };

  /** One element of `list`. */
  random.pick = function pick(list) {
    return list[Math.floor(random() * list.length)];
  };

  /** True `chance` of the time. */
  random.chance = function chance(probability) {
    return random() < probability;
  };

  /** A shuffled copy of `list` (Fisher-Yates, on the seeded stream). */
  random.shuffle = function shuffle(list) {
    const copy = list.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      const swap = copy[index];
      copy[index] = copy[other];
      copy[other] = swap;
    }
    return copy;
  };

  return random;
}

// Round 5 note: the deterministic seed also places the FLAMINGO FM rooftop billboards.
