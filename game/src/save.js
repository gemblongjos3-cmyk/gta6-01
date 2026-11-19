// localStorage persistence: cash, XP, respect, finished missions, Sunset
// Stars, garage upgrades and the radio station you left playing. Versioned
// so an older save can never break a newer build.

const KEY = 'palm-shores-3d-v1';

export function defaultSave() {
  return {
    cash: 250, xp: 0, respect: 1,
    missionsDone: [], stars: [], upgrades: [],
    station: 0, started: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    return { ...defaultSave(), ...data };
  } catch { return defaultSave(); }
}

export function storeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode: play on unsaved */ }
}

// Respect levels: every 400 XP of work buys the street a little more trust,
// while the HUD bar fills toward the next 1,200 XP cachet milestone.
export function respectForXp(xp) { return Math.min(9, 1 + Math.floor(xp / 400)); }
export function xpIntoLevel(xp) { return xp % 1200; }
export const XP_PER_LEVEL = 1200;
