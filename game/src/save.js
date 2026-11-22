// Palm Shores — save.js
// One job: persist cash + mission progress in localStorage, and read it back.
const KEY = 'palm-shores-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return { cash: data.cash, missionIndex: data.missionIndex, bestCash: data.bestCash || 0 };
  } catch { return null; }
}

export function storeSave(state) {
  try {
    const bestCash = Math.max(state.player.cash, loadSave()?.bestCash || 0);
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: Math.floor(state.player.cash),
      missionIndex: state.missionIndex,
      bestCash,
    }));
  } catch { /* storage off: progress lasts this visit only */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
