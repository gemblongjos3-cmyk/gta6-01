// Procedural canvas textures: Palm Shores ships no image files at all.
// Sunsets, facades, billboards, palm fronds and asphalt are all painted here
// at boot from the shared seed, so the whole city is code.

import * as THREE from 'three';
import { rngRange, rngPick } from './random.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The sunset sky: violet zenith melting through magenta into a tangerine band.
export function skyTexture() {
  const c = canvas(64, 512), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#1d1440'); grad.addColorStop(0.34, '#4b2064');
  grad.addColorStop(0.55, '#93356e'); grad.addColorStop(0.72, '#e0527a');
  grad.addColorStop(0.86, '#ff8a4a'); grad.addColorStop(0.96, '#ffc46b');
  grad.addColorStop(1.0, '#ffe3a1');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 512);
  return tex(c);
}

// Soft radial glow used for the sun, headlights, sirens and the heli beam pool.
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(128, 128), g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return tex(c);
}

const FACADE_PALETTES = [
  ['#f7d9b0', '#e8906f'], ['#fdeeda', '#7fd4c1'], ['#f6c6d8', '#e0527a'], ['#d9ecf7', '#5b8def'],
  ['#f2e3f7', '#8d6fd1'], ['#fff3c9', '#e8a547'], ['#d8f3dc', '#3fbf8f'], ['#f9dcc4', '#d94f70'],
];

// An art-deco facade: banded windows (some lit gold for the evening), a neon
// trim line under the parapet and a striped awning over the ground floor.
// A facade AND its emissive twin, drawn in one pass so the lit windows match:
// the colour map carries the deco detailing, the emissive map is black except
// for the windows that are on — at dusk the building genuinely glows.
export function facadePair(rng, floors, cols) {
  const [wall, trim] = FACADE_PALETTES[Math.floor(rng() * FACADE_PALETTES.length)];
  const c = canvas(256, 512), g = c.getContext('2d');
  const e = canvas(256, 512), ge = e.getContext('2d');
  const shade = g.createLinearGradient(0, 0, 256, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.16)'); shade.addColorStop(0.5, 'rgba(255,255,255,0.05)'); shade.addColorStop(1, 'rgba(0,0,0,0.16)');
  g.fillStyle = wall; g.fillRect(0, 0, 256, 512);
  g.fillStyle = shade; g.fillRect(0, 0, 256, 512);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 512);
  // parapet + cornice
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, 256, 14);
  g.fillStyle = trim; g.fillRect(0, 14, 256, 5);
  g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(0, 19, 256, 2);
  const ww = 256 / cols, wh = 512 / (floors + 1);
  for (let f = 0; f < floors; f++) {
    // deco band between floors
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, 26 + f * wh, 256, 3);
    g.fillStyle = trim; g.globalAlpha = 0.5; g.fillRect(0, 29 + f * wh, 256, 2); g.globalAlpha = 1;
    for (let col = 0; col < cols; col++) {
      const x = col * ww + ww * 0.24, y = 30 + f * wh + wh * 0.16, w = ww * 0.52, h = wh * 0.6;
      // window frame + sill
      g.fillStyle = 'rgba(20,12,30,0.85)'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x - 3, y + h + 3, w + 6, 2);
      const lit = rng() < 0.55;
      const warm = rng() < 0.72;
      const colr = lit ? (warm ? '#ffd98a' : '#a8e6ff') : '#2c2440';
      g.fillStyle = colr; g.fillRect(x, y, w, h);
      if (lit) {
        ge.fillStyle = warm ? '#ffb85c' : '#7fd4ff'; ge.fillRect(x, y, w, h);
        if (rng() < 0.4) { ge.fillStyle = 'rgba(0,0,0,0.45)'; ge.fillRect(x, y + h * 0.45, w, h * 0.55); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + h * 0.45, w, h * 0.55); } // half-drawn blind
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, w, 3);
      }
      if (rng() < 0.18) { g.fillStyle = '#4a4258'; g.fillRect(x + w * 0.2, y + h + 6, w * 0.6, 5); } // AC unit under some windows
    }
  }
  const gy = 512 - wh;
  g.fillStyle = '#1d1429'; g.fillRect(0, gy, 256, wh);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f7f3ea' : trim; g.fillRect(i * 32, gy - 12, 32, 12); }
  // storefront glass across the ground floor, lit from inside
  for (let i = 0; i < 4; i++) {
    const sx = 10 + i * 62;
    g.fillStyle = '#ffd98a'; g.fillRect(sx, gy + 16, 50, wh - 26);
    ge.fillStyle = i % 2 ? '#ff9e4f' : '#ffd98a'; ge.fillRect(sx, gy + 16, 50, wh - 26);
    g.fillStyle = 'rgba(29,20,41,0.9)'; g.fillRect(sx + 22, gy + 16, 5, wh - 26);
  }
  return { map: tex(c), emissive: tex(e) };
}

export function facadeTexture(rng, floors, cols) { return facadePair(rng, floors, cols).map; }

// Ground-floor storefront band wrapped around a building's base.
export function storefrontTexture(rng) {
  const c = canvas(512, 64), g = c.getContext('2d');
  const e = canvas(512, 64), ge = e.getContext('2d');
  g.fillStyle = '#191124'; g.fillRect(0, 0, 512, 64);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 64);
  const cols = ['#ffb85c', '#7fd4ff', '#ff8fb0', '#ffe3a1'];
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * 84, colr = cols[Math.floor(rng() * cols.length)];
    g.fillStyle = colr; g.fillRect(x, 14, 68, 50);
    ge.fillStyle = colr; ge.fillRect(x, 14, 68, 50);
    g.fillStyle = 'rgba(20,12,28,0.85)'; g.fillRect(x + 31, 14, 5, 50); g.fillRect(x, 36, 68, 4);
    g.fillStyle = i % 2 ? '#f7f3ea' : '#e0527a'; g.fillRect(x - 2, 4, 72, 8); // awning stripe
  }
  return { map: tex(c), emissive: tex(e) };
}

export function roofTexture(rng) {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = rngPick(rng, ['#8a5a44', '#6e4a5e', '#59465e', '#7a4a3a']); g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 40; i++) g.fillRect(rng() * 128, rng() * 128, rngRange(rng, 4, 18), 2);
  return tex(c);
}

// Asphalt with a worn centre line; drawn per road segment and repeated.
export function roadTexture() {
  const c = canvas(128, 256), g = c.getContext('2d');
  g.fillStyle = '#201c2b'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 26; i++) { // damp patches and repairs
    g.fillStyle = `rgba(${10 + Math.random() * 16},${8 + Math.random() * 12},${20 + Math.random() * 18},0.35)`;
    g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 256, 8 + Math.random() * 22, 12 + Math.random() * 30, 0, 0, 7); g.fill();
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 128, Math.random() * 256, 1.5, 1.5); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.16})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.fillStyle = '#f7f3ea'; g.fillRect(2, 0, 4, 256); g.fillRect(122, 0, 4, 256);
  g.fillStyle = '#ffd23e'; g.fillRect(61, 8, 6, 62); g.fillRect(61, 150, 6, 62);
  // sunset sheen baked into the middle of the lane
  const sheen = g.createLinearGradient(0, 0, 128, 0);
  sheen.addColorStop(0, 'rgba(255,110,140,0)'); sheen.addColorStop(0.5, 'rgba(255,120,110,0.20)'); sheen.addColorStop(1, 'rgba(255,110,140,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, 128, 256);
  return tex(c);
}

export function crosswalkTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#201c2b'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(247,243,234,0.85)';
  for (let i = 0; i < 5; i++) g.fillRect(10 + i * 23, 12, 13, 104);
  return tex(c);
}

export function sidewalkTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#9a8fa3'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(40,30,55,0.5)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126); g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.stroke();
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(60,40,70,${Math.random() * 0.12})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  return tex(c);
}

export function sandTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#eecfa1'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(160,110,60,${Math.random() * 0.2})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6); }
  return tex(c);
}

export function waterTexture() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#7a2d5e'); grad.addColorStop(0.5, '#46255e'); grad.addColorStop(1, '#2c1e4e');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,${140 + Math.random() * 80},90,${0.05 + Math.random() * 0.16})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 42, 1.6);
  }
  return tex(c);
}

// One palm frond, alpha-cut; six of them make a crown.
export function palmLeafTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  // one full frond: a curved rib carrying dense tapered leaflets both sides
  const rib = (t) => [4 + 120 * t, 124 - 106 * t * t - Math.sin(t * Math.PI) * 22];
  for (let t = 0.06; t < 0.99; t += 0.035) {
    const [x, y] = rib(t), len = 15 + t * 15, shade = 0.75 + t * 0.45;
    for (const s of [1, -0.82]) {
      const ex = x + 13 * s + t * 6 * s, ey = y + len;
      g.fillStyle = `rgba(${52 * shade | 0},${168 * shade | 0},${94 * shade | 0},0.95)`;
      g.beginPath();
      g.moveTo(x - 1.6, y); g.lineTo(x + 1.6, y);
      g.lineTo(ex, ey); g.closePath(); g.fill();
    }
  }
  g.strokeStyle = '#2a7a46'; g.lineWidth = 4.4; g.beginPath();
  g.moveTo(4, 124); g.quadraticCurveTo(50, 50, 124, 18); g.stroke();
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// A vertical light streak for wet-road reflections: soft-edged, bright at the
// source end and dissolving with distance. Tint it per light source.
export function streakTexture() {
  const c = canvas(64, 256), g = c.getContext('2d');
  const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const u = (x - 32) / 32, v = y / 256;
    const a = Math.max(0, (1 - u * u)) ** 1.6 * (1 - v) ** 1.7;
    const i = (y * 64 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Big neon billboards and shop signs, painted to order.
export function billboardTexture(main, sub, bg, fg, accent) {
  const c = canvas(512, 256), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = accent; g.lineWidth = 10; g.strokeRect(10, 10, 492, 236);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 74px system-ui, sans-serif';
  g.shadowColor = fg; g.shadowBlur = 26;
  g.fillText(main, 256, sub ? 104 : 128);
  if (sub) { g.font = '700 34px system-ui, sans-serif'; g.shadowBlur = 12; g.fillStyle = accent; g.fillText(sub, 256, 182); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function signTexture(text, bg, fg) {
  const c = canvas(256, 64), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg; g.font = '800 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 8; g.fillText(text, 128, 34);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Equirect sunset for scene.environment: every glossy surface in the city —
// wet asphalt, coupe paint, glass — reflects this sky, so the whole frame
// picks up the pink/orange neon sheen of the golden hour.
export function sunsetEnvTexture() {
  const c = canvas(512, 256), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#241448'); grad.addColorStop(0.38, '#5c2064');
  grad.addColorStop(0.55, '#c94b74'); grad.addColorStop(0.64, '#ff8a4a');
  grad.addColorStop(0.70, '#ffc46b'); grad.addColorStop(0.76, '#7a3a56');
  grad.addColorStop(1.0, '#1c1026');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  // the sun: a hard bright blob low on the horizon
  const sun = g.createRadialGradient(128, 168, 2, 128, 168, 90);
  sun.addColorStop(0, 'rgba(255,246,200,1)'); sun.addColorStop(0.25, 'rgba(255,190,90,0.85)');
  sun.addColorStop(1, 'rgba(255,140,80,0)');
  g.fillStyle = sun; g.fillRect(0, 60, 512, 216);
  // neon smears in the lower half — city lights waiting to be reflected
  const smears = ['#ff4fa3', '#22d3ee', '#ffd23e', '#e0527a', '#7dff6a', '#ff8c42'];
  for (let i = 0; i < 42; i++) {
    g.fillStyle = smears[i % smears.length] + '55';
    const w = 6 + Math.random() * 26;
    g.fillRect(Math.random() * 512, 176 + Math.random() * 62, w, 2.5 + Math.random() * 4);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// A vertical neon sign, letters stacked down a dark blade — hotel, marina,
// club names along Sunset Avenue, all original Palm Shores businesses.
export function neonSignTexture(text, fg) {
  const c = canvas(128, 512), g = c.getContext('2d');
  g.fillStyle = '#120a1e'; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = fg; g.lineWidth = 4; g.globalAlpha = 0.8; g.strokeRect(8, 8, 112, 496); g.globalAlpha = 1;
  g.fillStyle = fg; g.font = '800 62px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 16;
  const letters = text.split('');
  const step = Math.min(72, 470 / letters.length);
  letters.forEach((ch, i) => g.fillText(ch, 64, 46 + i * step));
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Weathered pier deck: plank runs with tar seams, stains and a painted safety line.
export function pierTexture() {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#7d5f42'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const tone = 0.9 + Math.random() * 0.25;
    g.fillStyle = `rgb(${125 * tone | 0},${95 * tone | 0},${66 * tone | 0})`; g.fillRect(0, y, 256, 30);
    g.fillStyle = 'rgba(30,20,14,0.85)'; g.fillRect(0, y + 30, 256, 2);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(Math.random() * 200, y, 3, 30);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(40,26,16,${Math.random() * 0.16})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 1.5); }
  g.fillStyle = 'rgba(255,196,64,0.55)'; g.fillRect(0, 120, 256, 5);
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 200, 256, 3);
  return tex(c);
}

// Luna's portrait for the dialogue box: a stylised dispatcher with a headset.
export function lunaPortraitTexture() {
  const c = canvas(96, 96), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#ff8a4a'); grad.addColorStop(1, '#93356e');
  g.fillStyle = grad; g.fillRect(0, 0, 96, 96);
  g.fillStyle = '#2c1a2e'; g.beginPath(); g.arc(48, 40, 17, 0, 7); g.fill();
  g.fillStyle = '#f2b183'; g.beginPath(); g.arc(48, 42, 13, 0, 7); g.fill();
  g.fillStyle = '#181020'; g.beginPath(); g.arc(48, 33, 13.5, Math.PI, 0); g.fill();
  g.fillRect(30, 30, 5, 16); g.fillRect(61, 30, 5, 16);
  g.fillStyle = '#14101f'; g.fillRect(28, 62, 40, 34);
  g.fillStyle = '#ff4fa3'; g.fillRect(44, 66, 8, 30);
  g.strokeStyle = '#0e0a16'; g.lineWidth = 3; g.beginPath(); g.arc(48, 44, 19, 0.4, 2.2); g.stroke();
  g.fillStyle = '#0e0a16'; g.fillRect(63, 58, 5, 5);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
