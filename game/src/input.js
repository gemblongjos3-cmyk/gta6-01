// Keyboard and mouse state, sampled once per frame by the game loop.
// `pressed` holds codes that went down this frame only; `keys` holds all
// codes currently down. The weapon wheel reads the raw mouse position.

export const keys = new Set();
export const pressed = new Set();
export const mouse = { x: 0, y: 0, down: false, rightDown: false };

let listening = false;

export function initInput(windowObj) {
  if (listening) return; listening = true;
  windowObj.addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  windowObj.addEventListener('keyup', (e) => keys.delete(e.code));
  windowObj.addEventListener('blur', () => { keys.clear(); mouse.down = false; mouse.rightDown = false; });
  windowObj.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  windowObj.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; if (e.button === 2) mouse.rightDown = true; });
  windowObj.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.rightDown = false; });
  windowObj.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrameInput() { pressed.clear(); }
export function wasPressed(code) { return pressed.has(code); }
export function isDown(code) { return keys.has(code); }
