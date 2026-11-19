// Palm Shores — textures.js
// Every texture is painted on a canvas at load time: lit-window facades,
// neon signs, wet asphalt, sidewalks. No image files, no network.

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A tower facade: dark concrete with a grid of windows, most lit warm or
// cool, a few dark. `hue` shifts the lit-window palette per district.
export function facadeTexture(rng, hue = 210, floors = 10, cols = 6) {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#11121c';
  g.fillRect(0, 0, 256, 512);
  const cw = 256 / cols, ch = 512 / floors;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw + 5, y = f * ch + 6, w = cw - 10, h = ch - 12;
      const r = rng.next();
      if (r < 0.22) { g.fillStyle = '#0a0a12'; } // dark window
      else if (r < 0.6) { g.fillStyle = `hsl(${42 + rng.range(-8, 8)} 90% ${rng.range(52, 68)}%)`; } // warm lit
      else if (r < 0.85) { g.fillStyle = `hsl(${hue} 80% ${rng.range(55, 70)}%)`; } // cool lit
      else { g.fillStyle = `hsl(${hue + 120} 90% 60%)`; } // neon-tinted lit
      g.fillRect(x, y, w, h);
    }
  }
  // Roofline glow strip.
  g.fillStyle = `hsl(${hue} 95% 60%)`;
  g.fillRect(0, 0, 256, 4);
  return toTexture(c);
}

// A glowing neon sign on a transparent canvas, drawn as a texture plane.
export function neonSignTexture(text, color = '#ff2e88', sub = '') {
  const [c, g] = canvas(512, 192);
  g.clearRect(0, 0, 512, 192);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color;
  g.font = 'bold 64px "Arial Black", Arial, sans-serif';
  g.fillText(text.toUpperCase(), 256, sub ? 76 : 96);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.font = 'bold 58px "Arial Black", Arial, sans-serif';
  g.fillText(text.toUpperCase(), 256, sub ? 76 : 96);
  if (sub) {
    g.shadowColor = color; g.shadowBlur = 14;
    g.fillStyle = color;
    g.font = 'bold 30px Arial, sans-serif';
    g.fillText(sub.toUpperCase(), 256, 148);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Wet asphalt: near-black with faint lane dashes and a subtle sheen.
export function roadTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#17171f';
  g.fillRect(0, 0, 128, 256);
  // Speckle for wet asphalt.
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 1, 1);
  }
  // Centre dashes.
  g.fillStyle = '#c9a227';
  for (let y = 0; y < 256; y += 64) g.fillRect(62, y + 8, 4, 34);
  // Edge lines.
  g.fillStyle = 'rgba(200,200,220,0.35)';
  g.fillRect(4, 0, 2, 256); g.fillRect(122, 0, 2, 256);
  return toTexture(c, 1, 4);
}

export function sidewalkTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#23232e';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  return toTexture(c, 2, 2);
}

// Dark water with a faint violet shimmer.
export function waterTexture() {
  const [c, g] = canvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#0a1030');
  grad.addColorStop(0.5, '#141a4a');
  grad.addColorStop(1, '#0a1030');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(150,180,255,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 22 + 4, 1.5);
  }
  return toTexture(c, 6, 2);
}
