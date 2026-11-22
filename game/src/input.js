// Palm Shores — input.js
// One job: keyboard + mouse state, nothing else. The game reads this, never the DOM directly.
export const ACTION = {
  FORWARD: 'forward', BACK: 'back', LEFT: 'left', RIGHT: 'right',
  RUN: 'run', ENTER_CAR: 'enter', SHOOT: 'shoot', PAUSE: 'pause',
  RELOAD: 'reload', HORN: 'horn',
};

const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'enter', KeyR: 'reload', KeyH: 'horn',
  Escape: 'pause', KeyP: 'pause',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDX = 0, mouseDY = 0, mouseDown = false;
  let locked = false;

  function onKeyDown(e) {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (!held.has(action)) pressed.add(action);
    held.add(action);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { const a = KEYMAP[e.code]; if (a) held.delete(a); }
  function onMouseMove(e) {
    if (locked) { mouseDX += e.movementX; mouseDY += e.movementY; }
  }
  function onMouseDown(e) { if (e.button === 0) { mouseDown = true; pressed.add('shoot'); } }
  function onMouseUp(e) { if (e.button === 0) mouseDown = false; }
  function onLockChange() { locked = document.pointerLockElement === canvas; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('click', () => {
    if (!locked && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch { /* headless: no lock, drag still works */ }
    }
  });

  return {
    is(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    mouseDown() { return mouseDown; },
    consumeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    isLocked() { return locked; },
    endFrame() { pressed.clear(); },
  };
}
