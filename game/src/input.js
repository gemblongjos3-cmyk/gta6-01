// Keyboard and pointer input: held keys give movement, the mouse gives an aim point in the world,
// and one-shot presses (enter a car, pause, reload, mute, confirm) are queued by name so a press
// between two frames is never lost and never handled twice.

const MOVE_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

const ONE_SHOT = {
  KeyE: 'enter',
  KeyR: 'reload',
  KeyC: 'continueSave',
  KeyX: 'resetSave',
  KeyM: 'mute',
  KeyP: 'pause',
  Escape: 'pause',
  Enter: 'confirm',
  Space: 'confirm',
  KeyF: 'fireKey',
};

/** Every code the game listens to, so the browser does not scroll under the canvas. */
const SWALLOW = new Set([
  ...Object.values(MOVE_KEYS).flat(),
  'ShiftLeft',
  'ShiftRight',
  ...Object.keys(ONE_SHOT),
]);

export function createInput(target) {
  const held = new Set();
  const queue = [];
  const pointer = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false };

  function isHeld(code) {
    return held.has(code);
  }

  window.addEventListener('keydown', (event) => {
    if (SWALLOW.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    const action = ONE_SHOT[event.code];
    if (action) queue.push(action);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => held.clear());

  target.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    pointer.down = true;
    pointer.clicked = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** -1, 0 or 1 on each axis: what the movement keys ask for this frame. */
    axis() {
      return {
        x: (isHeld('KeyD') || isHeld('ArrowRight') ? 1 : 0) - (isHeld('KeyA') || isHeld('ArrowLeft') ? 1 : 0),
        y: (isHeld('KeyS') || isHeld('ArrowDown') ? 1 : 0) - (isHeld('KeyW') || isHeld('ArrowUp') ? 1 : 0),
      };
    },
    running() {
      return isHeld('ShiftLeft') || isHeld('ShiftRight');
    },
    /** Take the named one-shot presses since the last call. */
    take() {
      const taken = queue.slice();
      queue.length = 0;
      return taken;
    },
    pointer,
    /** The pointer position in screen pixels; main.js converts it to world coordinates. */
    takeClick() {
      const clicked = pointer.clicked;
      pointer.clicked = false;
      return clicked;
    },
    isDown: isHeld,
  };
}
