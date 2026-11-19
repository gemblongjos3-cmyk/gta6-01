// Palm Shores — save.js
// localStorage save: cash, mission progress, coins collected. Small,
// versioned, and tolerant of a missing or corrupt entry.

import { SAVE_KEY, ECONOMY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : ECONOMY.startCash,
      missionIndex: Number.isFinite(data.missionIndex) ? Math.max(0, Math.min(5, data.missionIndex | 0)) : 0,
      coins: Number.isFinite(data.coins) ? data.coins : 0,
      savedAt: data.savedAt || 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      coins: state.coinsCollected,
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
