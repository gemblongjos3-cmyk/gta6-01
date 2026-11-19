// Everything the player sees of the world itself, painted on one canvas.
//
// The renderer is a painter, not a referee: it never moves anything, it only
// reads positions other systems settled and turns them into a sunset. One
// frame is a sandwich — beginFrame parks the camera over the world, the
// draw* calls lay the city down back-to-front, endFrame lifts the camera
// off and paints the evening vignette in plain screen space.
//
// Layer order inside the world pass, bottom to top:
//   sea and sand, grass, roads, buildings, street props,
//   (host then draws) markers, cars, people, the player, effects.
import { COAST, FONT, PALETTE, ROAD, WORLD } from './config.js';
import { HALF_ROAD } from './world.js';

/** Multiply a #rrggbb colour toward black (f<1) or white (f>1). */
function tint(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch(n >> 16);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `rgb(${r},${g},${b})`;
}

/** A steady pseudo-random in [0,1) from an integer seed — window lights. */
function jitter(seed) {
  let x = (seed | 0) ^ 0x6d2b79f5;
  x = Math.imul(x ^ (x >>> 15), 1 | x);
  x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 800, dpr: 1 };
  let cam = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1 };
  // Siren spill is rationed to the four cruisers nearest the camera centre.
  // The set is settled at the end of one frame and spent on the next —
  // cruisers barely move between frames, and a staged shot is painted
  // twice, so the photograph still gets the exact four.
  let sirenSeen = [];
  let sirenNearest = null;
  let sirenDrawn = 0;

  /** Fit the canvas to its window; the shot rig asks for exactly 1280x800. */
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 800;
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
  }
  resize();
  window.addEventListener('resize', resize);

  /** The world point currently sitting under a screen pixel. */
  function screenToWorld(screenX, screenY, camera) {
    const c = camera ?? cam;
    return {
      x: (screenX - view.w / 2) / c.zoom + c.x,
      y: (screenY - view.h / 2) / c.zoom + c.y,
    };
  }

  /** Is a world point anywhere near the framed view? Cheap culling test. */
  function visible(x, y, pad = 90) {
    const halfW = view.w / 2 / cam.zoom + pad;
    const halfH = view.h / 2 / cam.zoom + pad;
    return Math.abs(x - cam.x) < halfW && Math.abs(y - cam.y) < halfH;
  }

  /** Open a frame: dusk sky behind everything, then the camera goes on. */
  function beginFrame(camera) {
    cam = camera;
    sirenSeen = [];
    sirenDrawn = 0;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, view.h);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyWarm);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.translate(view.w / 2, view.h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
  }

  /** Close a frame: lift the camera, darken the corners, warm the edges. */
  function endFrame() {
    // Settle which cruisers earn the siren spill on the next frame.
    sirenNearest = new Set(
      sirenSeen
        .map((car) => ({ car, dist: Math.hypot(car.x - cam.x, car.y - cam.y) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 4)
        .map((entry) => entry.car),
    );
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const glow = ctx.createRadialGradient(
      view.w / 2, view.h * 0.42, Math.min(view.w, view.h) * 0.36,
      view.w / 2, view.h * 0.5, Math.max(view.w, view.h) * 0.78,
    );
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(1, PALETTE.vignette);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.w, view.h);
    paintGrade();
  }

  /**
   * The light cinematic grade, painted last in plain screen space: a warm
   * sunset wash over the top of the frame, a cool tint settling into the
   * lower third, and a vignette that only reaches the corners. Every alpha
   * stays low on purpose — the pastel city must not turn muddy under it.
   */
  function paintGrade() {
    const warm = ctx.createLinearGradient(0, 0, 0, view.h * 0.55);
    warm.addColorStop(0, 'rgba(255,138,54,0.10)');
    warm.addColorStop(1, 'rgba(255,138,54,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, view.w, view.h * 0.55);
    const cool = ctx.createLinearGradient(0, view.h * (2 / 3), 0, view.h);
    cool.addColorStop(0, 'rgba(16,52,72,0)');
    cool.addColorStop(1, 'rgba(16,52,72,0.08)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, view.h * (2 / 3), view.w, view.h / 3);
    const corner = Math.hypot(view.w / 2, view.h / 2);
    const shade = ctx.createRadialGradient(view.w / 2, view.h / 2, 0, view.w / 2, view.h / 2, corner);
    shade.addColorStop(0.58, 'rgba(12,8,24,0)');
    shade.addColorStop(1, 'rgba(12,8,24,0.26)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  // ------------------------------------------------------------ the ground
  /** Sea first: deep water, a lighter swell band and sun glitter. */
  function paintSea(time) {
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(0, COAST.waterline, WORLD.width, WORLD.height - COAST.waterline);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, COAST.waterline + 26, WORLD.width, WORLD.height - COAST.waterline - 26);
    ctx.strokeStyle = 'rgba(255,217,160,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 46) {
      const y = COAST.waterline + 60 + Math.sin(x * 0.011 + time * 0.7) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,160,0.35)';
    for (let x = 30; x < WORLD.width; x += 150) {
      const wob = Math.sin(x * 0.05 + time * 1.3) * 6;
      ctx.fillRect(x + wob, COAST.waterline + 120 + (x % 260), 44, 3);
    }
    // The foam line where the sea meets the sand: jagged, and a pure
    // function of x and the (frozen, in screenshots) time, so the same
    // moment always breaks the same way.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 16) {
      const y = COAST.waterline - 2 + Math.sin(x * 0.045 + time * 0.9) * 3 + Math.sin(x * 0.013 + 1.7) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 22) {
      const y = COAST.waterline + 13 + Math.sin(x * 0.03 - time * 0.6) * 2.4 + Math.sin(x * 0.017) * 1.6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Two piers reach into the water from the promenade.
    ctx.fillStyle = '#8a6a4e';
    for (const px of [ROAD.avenueX[3] - 26, ROAD.avenueX[5] - 26]) {
      ctx.fillRect(px, COAST.waterline - 6, 52, COAST.pierY - COAST.waterline + 130);
      ctx.fillStyle = '#75573f';
      for (let y = COAST.waterline + 18; y < COAST.pierY + 110; y += 30) ctx.fillRect(px, y, 52, 4);
      ctx.fillStyle = '#8a6a4e';
    }
  }

  /** Sand between the promenade and the water, shaded where it gets wet. */
  function paintBeach() {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, COAST.beachTop, WORLD.width, COAST.waterline - COAST.beachTop);
    ctx.fillStyle = PALETTE.sandShade;
    ctx.fillRect(0, COAST.waterline - 26, WORLD.width, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, COAST.waterline - 3, WORLD.width, 3);
    // The promenade itself: a pale walking strip above the sand.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(0, COAST.beachTop - 34, WORLD.width, 34);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, COAST.beachTop - 34, 2, 34);
  }

  /** Roads: pavement slab, asphalt, worn patches, dashes and crosswalks. */
  function paintRoads() {
    const slab = HALF_ROAD + 24;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const road of world0.roads) {
      if (road.axis === 'x') ctx.fillRect(road.at - slab, 0, slab * 2, WORLD.height);
      else ctx.fillRect(0, road.at - slab, WORLD.width, slab * 2);
    }
    ctx.fillStyle = PALETTE.asphalt;
    for (const road of world0.roads) {
      if (road.axis === 'x') ctx.fillRect(road.at - HALF_ROAD, 0, ROAD.width, WORLD.height);
      else ctx.fillRect(0, road.at - HALF_ROAD, WORLD.width, ROAD.width);
    }
    // Worn patches: deterministic scuffs so the asphalt is never flat.
    ctx.fillStyle = PALETTE.asphaltWorn;
    for (const road of world0.roads) {
      const along = road.axis === 'x' ? WORLD.height : WORLD.width;
      for (let s = 60; s < along; s += 210) {
        if (jitter(road.index * 977 + s) < 0.45) continue;
        const off = (jitter(s * 31 + road.index) - 0.5) * (ROAD.width - 52);
        if (road.axis === 'x') ctx.fillRect(road.at + off - 20, s, 40, 66);
        else ctx.fillRect(s, road.at + off - 20, 66, 40);
      }
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.laneMark;
    for (const road of world0.roads) {
      const along = road.axis === 'x' ? WORLD.height : WORLD.width;
      for (let s = 14; s < along; s += 56) {
        if (road.axis === 'x') ctx.fillRect(road.at - 2, s, 4, 26);
        else ctx.fillRect(s, road.at - 2, 26, 4);
      }
    }
    // Crosswalks where avenues meet streets.
    ctx.fillStyle = 'rgba(240,238,230,0.55)';
    for (const ax of ROAD.avenueX) {
      for (const sy of ROAD.streetY) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(ax + i * 22 - 7, sy - HALF_ROAD + 6, 14, 16);
          ctx.fillRect(ax + i * 22 - 7, sy + HALF_ROAD - 22, 14, 16);
          ctx.fillRect(ax - HALF_ROAD + 6, sy + i * 22 - 7, 16, 14);
          ctx.fillRect(ax + HALF_ROAD - 22, sy + i * 22 - 7, 16, 14);
        }
      }
    }
    // Street name plates at a few intersections, small and warm.
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,244,228,0.66)';
    for (let i = 0; i < ROAD.avenueX.length; i += 2) {
      ctx.fillText(ROAD.nameAvenue[i], ROAD.avenueX[i], ROAD.streetY[1] - HALF_ROAD - 10);
    }
    for (let i = 0; i < ROAD.streetY.length; i += 2) {
      ctx.fillText(ROAD.nameStreet[i], ROAD.avenueX[1] - HALF_ROAD - 44, ROAD.streetY[i] + 4);
    }
  }

  // ----------------------------------------------------------- the buildings
  /** One building: long shadow, pastel wall, roof lip, lit windows, a name. */
  function paintBuilding(b, time) {
    if (!visible(b.cx, b.cy, Math.max(b.w, b.h))) return;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(b.x + 14, b.y + 16, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = tint(b.color, 0.88);
    ctx.fillRect(b.x, b.y, b.w, 7);
    ctx.strokeStyle = b.trim;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // The roof inside the parapet: a darker panel of its own, so a block from above reads as
    // rooftops with edges and furniture, not as flat slabs of colour.
    ctx.fillStyle = tint(b.color, 0.8);
    ctx.fillRect(b.x + 13, b.y + 13, b.w - 26, b.h - 26);
    ctx.fillStyle = tint(b.color, 1.04);
    ctx.fillRect(b.x + 19, b.y + 19, b.w - 38, b.h - 38);
    if (b.rooftop === 'ac') {
      ctx.fillStyle = 'rgba(70,70,84,0.55)';
      ctx.fillRect(b.x + b.w * 0.18, b.y + b.h * 0.2, 26, 18);
      ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.55, 20, 14);
    } else if (b.rooftop === 'tank') {
      ctx.fillStyle = 'rgba(90,70,60,0.6)';
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.7, b.y + b.h * 0.3, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.windows) paintWindows(b, time);
    paintDoor(b);
    if (b.name) paintAwning(b);
    if (b.name) paintSign(b, time);
  }

  /** The street door: a dark leaf with a lit transom, centred on the pavement side. */
  function paintDoor(b) {
    const w = 16;
    const h = 7;
    const x = b.cx - w / 2;
    const y = b.y + b.h - h - 1;
    ctx.fillStyle = 'rgba(24,20,32,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,217,147,0.75)';
    ctx.fillRect(x + 2, y + 1.4, w - 4, 2);
  }

  /** A striped canopy over the shopfront, in the sign's neon and cream. */
  function paintAwning(b) {
    const w = Math.min(b.w - 30, 118);
    const x = b.cx - w / 2;
    const y = b.y + b.h - 44;
    const stripe = 11;
    const neon = b.neon ?? b.trim;
    for (let sx = 0; sx < w; sx += stripe) {
      ctx.fillStyle = Math.floor(sx / stripe) % 2 === 0 ? neon : 'rgba(246,238,224,0.92)';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + sx, y, Math.min(stripe, w - sx), 9);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(20,14,28,0.35)';
    ctx.fillRect(x, y + 9, w, 3);
  }

  /** Windows in one of two dialects: a lit grid, or long horizontal bands on the modern blocks. */
  function paintWindows(b, time) {
    if (jitter(b.seed * 3 + 11) < 0.38) return paintWindowBands(b, time);
    const cols = Math.max(2, Math.floor(b.w / 30));
    const rows = Math.max(2, Math.floor(b.h / 30));
    const cw = b.w / cols;
    const ch = b.h / rows;
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        const seed = b.seed + cx * 131 + cy * 57;
        const lit = jitter(seed);
        const x = b.x + cx * cw + cw * 0.26;
        const y = b.y + cy * ch + ch * 0.26;
        const w = cw * 0.44;
        const h = ch * 0.44;
        if (lit > 0.42) {
          const warm = 0.82 + 0.18 * Math.sin(time * 0.6 + seed);
          ctx.fillStyle = `rgba(255,217,147,${0.55 + 0.4 * warm * (lit - 0.4)})`;
        } else {
          ctx.fillStyle = PALETTE.glass;
        }
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  /** Horizontal window bands: floor-to-ceiling glass strips, lit in long warm runs. */
  function paintWindowBands(b, time) {
    const rows = Math.max(2, Math.floor(b.h / 34));
    const ch = b.h / rows;
    for (let cy = 0; cy < rows; cy += 1) {
      const seed = b.seed + cy * 71;
      const lit = jitter(seed);
      const y = b.y + cy * ch + ch * 0.3;
      const h = ch * 0.4;
      if (lit > 0.3) {
        const warm = 0.82 + 0.18 * Math.sin(time * 0.5 + seed);
        ctx.fillStyle = `rgba(255,217,147,${0.35 + 0.45 * warm * lit})`;
      } else {
        ctx.fillStyle = PALETTE.glass;
      }
      ctx.fillRect(b.x + 16, y, b.w - 32, h);
      // Mullions break the strip into panes.
      ctx.fillStyle = tint(b.color, 0.8);
      for (let x = b.x + 16 + 26; x < b.x + b.w - 32; x += 26) ctx.fillRect(x, y, 3, h);
    }
  }

  /** The shop sign: a neon pill over the door with the business name. */
  function paintSign(b, time) {
    const labelText = b.name;
    ctx.font = `700 ${b.landmark ? 17 : 13}px ${FONT}`;
    const width = Math.min(b.w - 12, ctx.measureText(labelText).width + 22);
    const x = b.cx - width / 2;
    const y = b.y + b.h - 26;
    const neon = b.neon ?? PALETTE.gold;
    ctx.fillStyle = 'rgba(20,14,28,0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, 20, 9);
    ctx.fill();
    ctx.strokeStyle = neon;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 2.1 + b.seed);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(labelText, b.cx, y + 15);
  }

  // --------------------------------------------------------------- the props
  /** Palms, lamps, hydrants and benches — the street's small furniture. */
  function paintProp(prop, time) {
    if (!visible(prop.x, prop.y, 60)) return;
    if (prop.kind === 'palm') return paintPalm(prop, time);
    if (prop.kind === 'lamp') return paintLamp(prop, time);
    if (prop.kind === 'crate') return paintCrate(prop);
    if (prop.kind === 'umbrella') return paintUmbrella(prop);
    if (prop.kind === 'towel') return paintTowel(prop);
    if (prop.kind === 'kiosk') return paintKiosk(prop);
    if (prop.kind === 'billboard') return paintBillboard(prop);
    if (prop.kind === 'hydrant') {
      ctx.fillStyle = '#c94f43';
      ctx.fillRect(prop.x - 4, prop.y - 7, 8, 12);
      ctx.fillRect(prop.x - 6, prop.y - 3, 12, 4);
      return undefined;
    }
    // bench
    ctx.fillStyle = '#7a5c40';
    ctx.fillRect(prop.x - 14, prop.y - 4, 28, 5);
    ctx.fillRect(prop.x - 14, prop.y + 3, 28, 3);
    return undefined;
  }

  /**
   * A rooftop billboard: a pink board the size of a bus on two posts,
   * lettered for the station half the city is listening to. Painted flat
   * over the roof it stands on, the way the game's signs all lie.
   */
  function paintBillboard(prop) {
    const w = prop.w ?? 190;
    const h = prop.h ?? 58;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.roundRect(prop.x - w / 2 + 7, prop.y - h / 2 + 9, w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#4a3b30';
    ctx.fillRect(prop.x - w / 4 - 4, prop.y + h / 2 - 3, 8, 12);
    ctx.fillRect(prop.x + w / 4 - 4, prop.y + h / 2 - 3, 8, 12);
    const grad = ctx.createLinearGradient(prop.x, prop.y - h / 2, prop.x, prop.y + h / 2);
    grad.addColorStop(0, '#ff7ab8');
    grad.addColorStop(1, '#e2547c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(prop.x - w / 2, prop.y - h / 2, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,228,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#2b1030';
    ctx.font = `900 29px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(prop.text ?? '', prop.x, prop.y + 1);
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(prop.sub ?? '', prop.x, prop.y + 20);
    return undefined;
  }

  /** A palm: curved trunk and a fan of fronds that breathe in the sea air. */
  function paintPalm(prop, time) {
    const size = prop.size ?? 1;
    ctx.strokeStyle = '#7d5c3d';
    ctx.lineWidth = 5 * size;
    ctx.beginPath();
    ctx.moveTo(prop.x, prop.y);
    ctx.quadraticCurveTo(prop.x + 6 * size, prop.y - 16 * size, prop.x + 11 * size, prop.y - 30 * size);
    ctx.stroke();
    const topX = prop.x + 11 * size;
    const topY = prop.y - 30 * size;
    const sway = Math.sin(time * 0.9 + prop.x * 0.05) * 0.06;
    ctx.strokeStyle = '#3f7d3a';
    ctx.lineWidth = 3.4 * size;
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI * 0.92 + i * 0.34 + sway;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(a) * 17 * size,
        topY + Math.sin(a) * 13 * size - 4,
        topX + Math.cos(a) * 27 * size,
        topY + Math.sin(a) * 20 * size + 7 * size,
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#5c8a3c';
    ctx.beginPath();
    ctx.arc(topX, topY, 4 * size, 0, Math.PI * 2);
    ctx.fill();
    return undefined;
  }

  /** A dockside crate: planked faces, a darker frame, a second box on top when stacked. */
  function paintCrate(prop) {
    const s = prop.size ?? 15;
    const drawBox = (cx, cy, half) => {
      ctx.fillStyle = '#9a744e';
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      ctx.strokeStyle = '#6f5136';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(cx - half + 2, cy - half + 2, half * 2 - 4, half * 2 - 4);
      ctx.beginPath();
      ctx.moveTo(cx - half + 2, cy - half + 2);
      ctx.lineTo(cx + half - 2, cy + half - 2);
      ctx.moveTo(cx + half - 2, cy - half + 2);
      ctx.lineTo(cx - half + 2, cy + half - 2);
      ctx.stroke();
    };
    groundShadow(prop.x, prop.y + 4, s + 6, s * 0.6);
    drawBox(prop.x, prop.y, s);
    if (prop.stack === 2) drawBox(prop.x + 3, prop.y - 4, s * 0.66);
    return undefined;
  }

  /** A beach umbrella: a tilted pole and a bright half-dome of shade. */
  function paintUmbrella(prop) {
    groundShadow(prop.x + 3, prop.y + 3, 17, 7);
    ctx.strokeStyle = '#8a6a4e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(prop.x, prop.y + 8);
    ctx.lineTo(prop.x + 2, prop.y - 8);
    ctx.stroke();
    ctx.fillStyle = prop.color ?? '#e2574c';
    ctx.beginPath();
    ctx.arc(prop.x + 2, prop.y - 7, 15, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(prop.x + 2, prop.y - 7, 15, Math.PI * 1.45, Math.PI * 1.95);
    ctx.lineTo(prop.x + 2, prop.y - 7);
    ctx.closePath();
    ctx.fill();
    return undefined;
  }

  /** A beach towel laid flat on the sand, with one bright stripe. */
  function paintTowel(prop) {
    ctx.save();
    ctx.translate(prop.x, prop.y);
    ctx.rotate(prop.angle ?? 0);
    ctx.fillStyle = prop.color ?? '#4fa3c7';
    ctx.fillRect(-14, -7, 28, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-14, -2, 28, 3);
    ctx.restore();
    return undefined;
  }

  /** The docks coconut kiosk: a wooden hut, a counter, and its painted sign. */
  function paintKiosk(prop) {
    groundShadow(prop.x, prop.y + 16, 30, 9);
    ctx.fillStyle = '#9a744e';
    ctx.fillRect(prop.x - 23, prop.y - 8, 46, 24);
    ctx.fillStyle = '#6f5136';
    ctx.fillRect(prop.x - 23, prop.y + 2, 46, 3);
    ctx.fillStyle = '#3f7d5a';
    ctx.beginPath();
    ctx.moveTo(prop.x - 27, prop.y - 8);
    ctx.lineTo(prop.x, prop.y - 19);
    ctx.lineTo(prop.x + 27, prop.y - 8);
    ctx.closePath();
    ctx.fill();
    // The hand-painted board over the counter.
    ctx.fillStyle = '#2e2a38';
    ctx.fillRect(prop.x - 35, prop.y - 31, 70, 12);
    ctx.fillStyle = '#ffe7b0';
    ctx.font = `700 8.5px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('Es Kelapa Sore', prop.x, prop.y - 22);
    return undefined;
  }

  /** A street lamp: slim pole and a pool of warm light on the pavement. */
  function paintLamp(prop, time) {
    const flicker = 0.9 + 0.1 * Math.sin(time * 7 + prop.x);
    const glow = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 44);
    glow.addColorStop(0, `rgba(255,207,138,${0.5 * flicker})`);
    glow.addColorStop(1, 'rgba(255,207,138,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(prop.x - 44, prop.y - 44, 88, 88);
    ctx.fillStyle = '#3c3a46';
    ctx.fillRect(prop.x - 2, prop.y - 12, 4, 14);
    ctx.fillStyle = WORLD.streetlightGlow;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y - 13, 4.4, 0, Math.PI * 2);
    ctx.fill();
    return undefined;
  }

  // The world object of the frame being painted; drawCity sets it so the
  // road and beach painters can share it without threading it everywhere.
  let world0 = null;

  /** The whole static city in one call: ground, roads, buildings, props. */
  function drawCity(world, props, time) {
    world0 = world;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = PALETTE.grassDark;
    for (const block of world.blocks) {
      if (!visible((block.left + block.right) / 2, (block.top + block.bottom) / 2, Math.max(block.width, block.height))) continue;
      if (jitter(block.column * 71 + block.row * 131) > 0.4) ctx.fillRect(block.left - 18, block.top - 18, block.width + 36, block.height + 36);
    }
    paintBeach();
    paintSea(time);
    paintRoads();
    for (const lot of world.lots ?? []) paintLot(lot);
    const sorted = world.buildings.slice().sort((a, b) => a.y - b.y);
    for (const building of sorted) paintBuilding(building, time);
    for (const prop of props) paintProp(prop, time);
  }

  /**
   * A parking lot: worn asphalt, a faded centre line, painted bays along both edges and the
   * locked cars standing in them, drawn with the same hand as every other car in the city.
   */
  function paintLot(lot) {
    const { pad } = lot;
    if (!visible(pad.x + pad.w / 2, pad.y + pad.h / 2, Math.max(pad.w, pad.h))) return;
    ctx.fillStyle = PALETTE.asphaltLight;
    ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
    ctx.fillStyle = PALETTE.asphaltWorn;
    for (let x = pad.x + 24; x < pad.x + pad.w - 20; x += 92) {
      if (jitter(lot.seed + x) < 0.5) ctx.fillRect(x, pad.y + pad.h * 0.42, 46, pad.h * 0.16);
    }
    ctx.strokeStyle = 'rgba(232,210,122,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.moveTo(pad.x + 10, pad.y + pad.h / 2);
    ctx.lineTo(pad.x + pad.w - 10, pad.y + pad.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Bay ticks along both standing rows.
    ctx.strokeStyle = 'rgba(240,238,230,0.55)';
    for (const rowY of [pad.y + 34, pad.y + pad.h - 34]) {
      for (let x = pad.x + 12; x < pad.x + pad.w - 12; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, rowY - 30);
        ctx.lineTo(x, rowY + 30);
        ctx.stroke();
      }
    }
    for (const body of lot.cars) {
      drawCar({ length: 62, width: 31, speed: 0, smoke: 0, hitFlash: 0, wheelTurn: 0, kind: 'parked', ...body }, 0);
    }
  }

  // ------------------------------------------------------------------ cars
  /** A soft ellipse shadow that grounds anything standing on the street. */
  function groundShadow(x, y, rx, ry) {
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * One car, nose along +x before rotation: body, roof, glass, wheels,
   * lights, police livery when it wears one, smoke when it is hurting.
   */
  function drawCar(car, time) {
    if (!visible(car.x, car.y, 120)) return;
    if (car.kind === 'police') {
      sirenSeen.push(car);
      paintSirenGlow(car, time);
    }
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = car.length;
    const W = car.width;
    groundShadow(3, 5, L * 0.56, W * 0.62);
    // Wheels first, peeking out from under the body.
    ctx.fillStyle = '#17161c';
    const wy = W / 2 - 1;
    const wx = L * 0.31;
    for (const [sx, sy] of [[-wx, -wy], [wx, -wy], [-wx, wy], [wx, wy]]) {
      ctx.save();
      ctx.translate(sx, sy);
      if (Math.abs(sx - wx) < 0.01) ctx.rotate((car.wheelTurn ?? 0) * 0.42);
      ctx.fillRect(-7, -3.4, 14, 6.8);
      ctx.restore();
    }
    // Body with a lighter bonnet line and a darker tail.
    ctx.fillStyle = car.hitFlash > 0 ? '#f2f0ea' : car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 8);
    ctx.fill();
    ctx.fillStyle = tint(car.color, 1.12);
    ctx.beginPath();
    ctx.roundRect(L * 0.18, -W / 2 + 3, L * 0.3, W - 6, 6);
    ctx.fill();
    ctx.fillStyle = tint(car.color, 0.82);
    ctx.fillRect(-L / 2 + 2, -W / 2 + 3, L * 0.16, W - 6);
    // Cabin: roof panel and glass front and back.
    ctx.fillStyle = car.roof ?? tint(car.color, 0.85);
    ctx.beginPath();
    ctx.roundRect(-L * 0.16, -W / 2 + 4.5, L * 0.4, W - 9, 6);
    ctx.fill();
    ctx.fillStyle = car.glass ?? PALETTE.glass;
    ctx.fillRect(L * 0.2, -W / 2 + 5.5, L * 0.07, W - 11);
    ctx.fillRect(-L * 0.22, -W / 2 + 5.5, L * 0.06, W - 11);
    if (car.kind === 'police') paintLivery(car, L, W, time);
    // Lights: warm heads, red tails; brighter while moving.
    const beam = Math.abs(car.speed ?? 0) > 12 ? 0.95 : 0.6;
    ctx.fillStyle = `rgba(255,236,170,${beam})`;
    ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3.4, 6);
    ctx.fillRect(L / 2 - 3, W / 2 - 10, 3.4, 6);
    ctx.fillStyle = 'rgba(255,70,60,0.9)';
    ctx.fillRect(-L / 2, -W / 2 + 4, 3, 6);
    ctx.fillRect(-L / 2, W / 2 - 10, 3, 6);
    ctx.restore();
    if (car.smoke > 0.05) paintSmoke(car, time);
  }

  // Unit-circle siren gradients, built once and reused under a transform:
  // red and blue, each pooling at alpha 0.18 and dissolving to nothing.
  let sirenGradRed = null;
  let sirenGradBlue = null;

  /** The cached unit gradient for one siren colour. */
  function sirenGradient(red) {
    if (red && sirenGradRed) return sirenGradRed;
    if (!red && sirenGradBlue) return sirenGradBlue;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, red ? 'rgba(255,80,70,0.18)' : 'rgba(90,170,255,0.18)');
    grad.addColorStop(1, red ? 'rgba(255,80,70,0)' : 'rgba(90,170,255,0)');
    if (red) sirenGradRed = grad;
    else sirenGradBlue = grad;
    return grad;
  }

  /**
   * The light a cruiser spills on wet asphalt: an ellipse pooled under the
   * car, red one beat and blue the next by the siren phase, plus a thinner
   * streak thrown further along the heading at a lower alpha. Only the
   * four cruisers nearest the camera centre earn the spill.
   */
  function paintSirenGlow(car, time) {
    void time;
    if (sirenNearest) {
      if (!sirenNearest.has(car)) return;
    } else if (sirenDrawn >= 4) {
      return;
    }
    sirenDrawn += 1;
    const red = Math.floor(car.sirenPhase ?? 0) % 2 === 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = sirenGradient(red);
    // The pool itself: an ellipse roughly 100x52 world px in radius.
    ctx.save();
    ctx.scale(100, 52);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // The streak: stretched ~2.2x along the heading, thinner and fainter.
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.scale(220, 23);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /** Police paint: white doors, a blue band and a light bar that strobes. */
  function paintLivery(car, L, W, time) {
    ctx.fillStyle = 'rgba(240,246,252,0.92)';
    ctx.fillRect(-L * 0.13, -W / 2 + 3, L * 0.3, W - 6);
    ctx.fillStyle = PALETTE.policeBlue;
    ctx.fillRect(-L * 0.13, -4.5, L * 0.3, 9);
    const phase = Math.sin(time * 11 + (car.sirenPhase ?? 0)) > 0;
    ctx.fillStyle = phase ? '#ff5b5b' : '#5fb2ff';
    ctx.fillRect(-6, -W / 2 + 6, 12, 6);
    ctx.fillStyle = phase ? '#5fb2ff' : '#ff5b5b';
    ctx.fillRect(-6, W / 2 - 12, 12, 6);
    ctx.fillStyle = 'rgba(30,50,80,0.9)';
    ctx.font = `800 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }

  /** Grey puffs from a hurt engine, drifting up and thinning out. */
  function paintSmoke(car, time) {
    const n = 3 + Math.floor(car.smoke * 4);
    for (let i = 0; i < n; i += 1) {
      const rise = ((time * 26 + i * 17) % 44);
      const x = car.x + Math.cos(car.angle) * car.length * 0.4 + Math.sin(i * 7.3) * 6;
      const y = car.y + Math.sin(car.angle) * car.length * 0.4 - rise * 0.5;
      ctx.fillStyle = `rgba(70,66,78,${0.34 * car.smoke * (1 - rise / 48)})`;
      ctx.beginPath();
      ctx.arc(x, y, 5 + rise * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------- people
  /** Legs for a walker: two short strokes swinging with the walk phase. */
  function paintLegs(x, y, phase, trouser) {
    ctx.strokeStyle = trouser;
    ctx.lineWidth = 4.4;
    const swing = Math.sin(phase) * 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + swing, y + 8);
    ctx.moveTo(x, y);
    ctx.lineTo(x - swing, y + 8);
    ctx.stroke();
  }

  /** A fallen figure: body across the ground, fading in with `down`. */
  function paintFallen(x, y, angle, shirt, down) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.globalAlpha = 0.35 + 0.65 * down;
    groundShadow(0, 3, 18, 9);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect(-6, -15, 12, 24, 5);
    ctx.fill();
    ctx.fillStyle = '#c08a63';
    ctx.beginPath();
    ctx.arc(0, -19, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** One pedestrian: stroll, pause or panic, told by posture and pace. */
  function drawPerson(person, time) {
    if (!visible(person.x, person.y, 50)) return;
    if (person.dead) return paintFallen(person.x, person.y, person.angle, person.shirt, person.down ?? 1);
    const bob = Math.sin(person.walkPhase * 2) * 1.4;
    groundShadow(person.x, person.y + 9, 11, 5);
    paintLegs(person.x, person.y + 2, person.walkPhase, '#3d3a4a');
    ctx.fillStyle = person.shirt;
    ctx.beginPath();
    ctx.roundRect(person.x - 7, person.y - 8 + bob * 0.4, 14, 15, 5);
    ctx.fill();
    if (person.state === 'flee') {
      // Arms up: two short strokes angled away from the body.
      ctx.strokeStyle = person.shirt;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(person.x - 6, person.y - 4);
      ctx.lineTo(person.x - 12, person.y - 13);
      ctx.moveTo(person.x + 6, person.y - 4);
      ctx.lineTo(person.x + 12, person.y - 13);
      ctx.stroke();
    }
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(person.x, person.y - 13 + bob * 0.4, 6.4, 0, Math.PI * 2);
    ctx.fill();
    if (person.hat) {
      ctx.fillStyle = '#e8d27a';
      ctx.beginPath();
      ctx.arc(person.x, person.y - 15 + bob * 0.4, 6.8, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    return undefined;
  }

  /** A mission actor: a person with a purpose — and usually a pistol. */
  function drawActor(actor) {
    if (!visible(actor.x, actor.y, 50)) return undefined;
    if (actor.dead) return paintFallen(actor.x, actor.y, actor.angle, actor.shirt, actor.down ?? 1);
    if (actor.riding) return undefined; // inside the car: the car is the picture
    groundShadow(actor.x, actor.y + 9, 11, 5);
    paintLegs(actor.x, actor.y + 2, actor.walkPhase ?? 0, '#26232e');
    ctx.fillStyle = actor.shirt;
    ctx.beginPath();
    ctx.roundRect(actor.x - 7.5, actor.y - 8, 15, 15, 5);
    ctx.fill();
    // The gun arm points where the actor aims.
    const aim = actor.aim ?? actor.angle;
    ctx.strokeStyle = actor.skin;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(actor.x, actor.y - 2);
    ctx.lineTo(actor.x + Math.cos(aim) * 13, actor.y - 2 + Math.sin(aim) * 13);
    ctx.stroke();
    ctx.fillStyle = '#1c1a22';
    ctx.fillRect(actor.x + Math.cos(aim) * 13 - 2, actor.y - 2 + Math.sin(aim) * 13 - 2, 5, 3.4);
    ctx.fillStyle = actor.skin;
    ctx.beginPath();
    ctx.arc(actor.x, actor.y - 13, 6.4, 0, Math.PI * 2);
    ctx.fill();
    if (actor.isBoss) {
      ctx.fillStyle = '#f0ead8';
      ctx.fillRect(actor.x - 5, actor.y - 19, 10, 3.4);
    }
    paintActorHealth(actor);
    return undefined;
  }

  /**
   * The target readout over a hostile actor: a small amber chevron pointing
   * down at him over a thin health bar. Staged gunmen carry hp/maxHp, live
   * ones health against their spawn health; either way the bar shows once
   * he is hurt, and always while he is flagged hostile.
   */
  function paintActorHealth(actor) {
    const hp = actor.hp ?? actor.health;
    const maxHp = actor.maxHp ?? actor.maxHealth ?? (actor.isBoss ? 999 : 60);
    if (hp == null || !(maxHp > 0)) return;
    if (!(hp < maxHp || actor.hostile)) return;
    const frac = Math.max(0, Math.min(1, hp / maxHp));
    // The chevron: a small downward amber point above the bar.
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath();
    ctx.moveTo(actor.x - 5, actor.y - 36);
    ctx.lineTo(actor.x + 5, actor.y - 36);
    ctx.lineTo(actor.x, actor.y - 30);
    ctx.closePath();
    ctx.fill();
    // The bar: 34 px wide, dark backing, amber fill by remaining health.
    ctx.fillStyle = 'rgba(10,8,16,0.65)';
    ctx.fillRect(actor.x - 17, actor.y - 28, 34, 4);
    ctx.fillStyle = '#ffc94d';
    ctx.fillRect(actor.x - 17, actor.y - 28, 34 * frac, 4);
  }

  /** The player: coral jacket on foot, a clear aim arm, a hurt ring. */
  function drawPlayer(player, time) {
    if (player.car) return; // the car draws; the player is inside it
    groundShadow(player.x, player.y + 9, 12, 5.4);
    if (player.hurtFlash > 0.05) {
      ctx.strokeStyle = `rgba(255,80,70,${player.hurtFlash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20 + Math.sin(time * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    paintLegs(player.x, player.y + 2, player.walkPhase, '#2c3444');
    ctx.fillStyle = '#e4694f';
    ctx.beginPath();
    ctx.roundRect(player.x - 8, player.y - 9, 16, 16, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.fillRect(player.x - 8, player.y + 2, 16, 3);
    const aim = player.aim;
    ctx.strokeStyle = '#c08a63';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 2);
    ctx.lineTo(player.x + Math.cos(aim) * 14, player.y - 2 + Math.sin(aim) * 14);
    ctx.stroke();
    ctx.fillStyle = '#191722';
    ctx.fillRect(player.x + Math.cos(aim) * 14 - 2, player.y - 2 + Math.sin(aim) * 14 - 2, 6, 3.6);
    ctx.fillStyle = '#8a5a3c';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 14, 6.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 16.4, 6.8, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // --------------------------------------------------------------- effects
  /** Skid marks, bullets, muzzle flashes, sparks and spent casings. */
  function drawEffects(combat, skids, time) {
    ctx.strokeStyle = 'rgba(18,16,22,0.5)';
    ctx.lineWidth = 5;
    for (const skid of skids ?? []) {
      ctx.globalAlpha = Math.max(0, Math.min(0.55, skid.life * 0.2));
      ctx.beginPath();
      ctx.moveTo(skid.x, skid.y);
      ctx.lineTo(skid.x - Math.cos(skid.angle) * 22, skid.y - Math.sin(skid.angle) * 22);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Casings: tiny brass ticks that catch the light.
    ctx.fillStyle = '#d8a84e';
    for (const c of combat.casings) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.spin ?? 0);
      ctx.fillRect(-2.4, -1, 4.8, 2);
      ctx.restore();
    }
    // Bullets as glowing tracers: a warm streak trailing ~0.055 s of travel
    // behind the round, lit with a bright core dot at its head.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 2;
    for (const b of combat.bullets) {
      const tailX = b.x - b.vx * 0.055;
      const tailY = b.y - b.vy * 0.055;
      const streak = ctx.createLinearGradient(tailX, tailY, b.x, b.y);
      streak.addColorStop(0, 'rgba(255,140,60,0)');
      streak.addColorStop(1, 'rgba(255,214,120,0.9)');
      ctx.strokeStyle = streak;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Hitmarks: a small white X where a round landed, fading with its life.
    ctx.lineWidth = 2;
    for (const mark of combat.hitmarks ?? []) {
      const alpha = Math.max(0, Math.min(1, mark.life / 0.14));
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(mark.x - 4.5, mark.y - 4.5);
      ctx.lineTo(mark.x + 4.5, mark.y + 4.5);
      ctx.moveTo(mark.x + 4.5, mark.y - 4.5);
      ctx.lineTo(mark.x - 4.5, mark.y + 4.5);
      ctx.stroke();
    }
    // Muzzle flashes: a cone of light under a four-point star, for a blink.
    for (const f of combat.flashes) {
      const r = 13 * Math.max(0.2, f.life / 0.07);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      // The cone: a warm fan thrown ~34 px along the shot direction.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * Math.max(0, Math.min(1, f.life / 0.07));
      ctx.fillStyle = '#ffb45a';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(34, -7);
      ctx.lineTo(34, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = f.hostile ? 'rgba(255,120,90,0.95)' : 'rgba(255,214,120,0.95)';
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(r * 0.28, r * 0.28);
      ctx.lineTo(0, r * 0.5);
      ctx.lineTo(-r * 0.2, r * 0.2);
      ctx.lineTo(-r * 0.55, 0);
      ctx.lineTo(-r * 0.2, -r * 0.2);
      ctx.lineTo(0, -r * 0.5);
      ctx.lineTo(r * 0.28, -r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Sparks where rounds struck.
    for (const s of combat.sparks) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 3.4));
      ctx.fillRect(s.x - 1.8, s.y - 1.8, 3.6, 3.6);
    }
    ctx.globalAlpha = 1;
    void time;
  }

  // ------------------------------------------------- roadblocks and air
  /**
   * One roadblock barricade: an orange board with white diagonal stripes
   * on two feet, and a small amber beacon that blinks with the sirens.
   */
  function drawBarricades(list, time) {
    for (const barricade of list ?? []) {
      if (!visible(barricade.x, barricade.y, 90)) continue;
      ctx.save();
      ctx.translate(barricade.x, barricade.y);
      ctx.rotate(barricade.angle);
      groundShadow(2, 7, 32, 8);
      ctx.fillStyle = '#3a3542';
      ctx.fillRect(-24, 3, 5, 11);
      ctx.fillRect(19, 3, 5, 11);
      ctx.fillStyle = '#e86a2a';
      ctx.beginPath();
      ctx.roundRect(-31, -8, 62, 13, 3);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-31, -8, 62, 13, 3);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,244,228,0.92)';
      for (let stripe = -3; stripe < 4; stripe += 1) {
        ctx.save();
        ctx.translate(stripe * 16, 0);
        ctx.rotate(0.6);
        ctx.fillRect(-3.4, -12, 6.8, 22);
        ctx.restore();
      }
      ctx.restore();
      if (Math.sin(time * 7 + barricade.x) > 0) {
        ctx.fillStyle = '#ffb02e';
        ctx.beginPath();
        ctx.arc(0, -13, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * The air unit: a pool of spotlight on the street where its lamp holds,
   * a soft beam up to the fuselage, and the helicopter itself — dark body,
   * blue band, spinning rotor drawn screen-flat so it reads at any angle.
   */
  function drawAirUnit(u, time) {
    if (!u || !u.active) return;
    if (!visible(u.x, u.y, 760)) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pool = ctx.createRadialGradient(u.spotX, u.spotY, 6, u.spotX, u.spotY, 98);
    pool.addColorStop(0, 'rgba(255,240,190,0.32)');
    pool.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(u.spotX - 100, u.spotY - 100, 200, 200);
    ctx.strokeStyle = 'rgba(255,240,190,0.10)';
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(u.spotX, u.spotY);
    ctx.stroke();
    ctx.restore();
    groundShadow(u.x + 48, u.y + 62, 46, 15);
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(u.angle);
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.roundRect(-66, -5, 46, 10, 5);
    ctx.fill();
    ctx.fillRect(-68, -13, 8, 26);
    ctx.strokeStyle = '#12141a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, -14);
    ctx.lineTo(24, -14);
    ctx.moveTo(-18, 14);
    ctx.lineTo(24, 14);
    ctx.stroke();
    ctx.fillStyle = '#2b3038';
    ctx.beginPath();
    ctx.roundRect(-27, -15, 58, 30, 13);
    ctx.fill();
    ctx.fillStyle = 'rgba(95,178,255,0.85)';
    ctx.fillRect(-27, -3, 58, 6);
    ctx.fillStyle = PALETTE.glass;
    ctx.beginPath();
    ctx.roundRect(13, -10, 14, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#f2f6fc';
    ctx.font = `800 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('PD', -4, 3.5);
    ctx.restore();
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(u.rotor);
    ctx.strokeStyle = 'rgba(230,236,244,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-54, 0);
    ctx.lineTo(54, 0);
    ctx.stroke();
    ctx.rotate(Math.PI / 2);
    ctx.strokeStyle = 'rgba(230,236,244,0.22)';
    ctx.beginPath();
    ctx.moveTo(-54, 0);
    ctx.lineTo(54, 0);
    ctx.stroke();
    ctx.restore();
    if (Math.sin(time * 6) > 0) {
      ctx.fillStyle = '#ff5b5b';
      ctx.beginPath();
      ctx.arc(u.x - 4, u.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ------------------------------------------------------- sunset stars
  /**
   * The Sunset Stars still standing: a gold palm-star turning slowly over a soft ring of
   * light, impossible to mistake for street furniture and worth rolling over.
   */
  function drawStars(stars, time) {
    for (const star of stars ?? []) {
      if (star.taken || !visible(star.x, star.y, 70)) continue;
      const spin = time * 1.6 + (star.spin ?? 0);
      const pulse = 1 + Math.sin(time * 3.4 + (star.spin ?? 0)) * 0.12;
      const glow = ctx.createRadialGradient(star.x, star.y, 2, star.x, star.y, 40 * pulse);
      glow.addColorStop(0, 'rgba(255,217,77,0.4)');
      glow.addColorStop(1, 'rgba(255,217,77,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(star.x - 44, star.y - 44, 88, 88);
      ctx.save();
      ctx.translate(star.x, star.y + Math.sin(time * 2.2 + (star.spin ?? 0)) * 3);
      ctx.rotate(Math.sin(spin) * 0.28);
      ctx.fillStyle = '#ffd94d';
      ctx.strokeStyle = '#a8741a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const outer = 15 * pulse;
      const inner = 6.4 * pulse;
      for (let point = 0; point < 10; point += 1) {
        const radius = point % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + point * (Math.PI / 5);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // --------------------------------------------------------------- markers
  /** The mission marker: a pulsing gold beacon with a bobbing label chip. */
  function drawMarker(marker, time, color = PALETTE.gold, labelText = null) {
    if (!marker) return;
    const pulse = 1 + Math.sin(time * 4.2) * 0.14;
    const bob = Math.sin(time * 2.6) * 5;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
    grad.addColorStop(0, 'rgba(255,240,200,0.95)');
    grad.addColorStop(1, 'rgba(255,201,77,0.12)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(-9, -2);
    ctx.lineTo(9, -2);
    ctx.closePath();
    ctx.fill();
    ctx.font = `900 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#241a30';
    ctx.fillText(labelText ?? '!', 0, -8 + bob * 0.3);
    ctx.restore();
  }

  /**
   * An arrow at the view's edge pointing toward an off-screen marker, or a
   * gentle chevron above a near one. Drawn in world space but computed
   * against the camera, and careful to restore the transform it borrowed.
   */
  function drawObjectiveArrow(camera, marker, player, color = PALETTE.gold) {
    if (!marker || !player) return;
    const dx = marker.x - player.x;
    const dy = marker.y - player.y;
    const distance = Math.hypot(dx, dy);
    ctx.save();
    if (distance < 240) {
      const bob = Math.sin(performance.now() * 0.005) * 4;
      ctx.translate(marker.x, marker.y - 52 + bob);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(-9, -4);
      ctx.lineTo(9, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    const angle = Math.atan2(dy, dx);
    const reachX = view.w / 2 / camera.zoom - 56;
    const reachY = view.h / 2 / camera.zoom - 56;
    const px = camera.x + Math.max(-reachX, Math.min(reachX, dx));
    const py = camera.y + Math.max(-reachY, Math.min(reachY, dy));
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,244,228,0.9)';
    ctx.fillText(`${Math.round(distance / 10)} m`, px, py + 30);
  }

  return {
    ctx,
    view,
    resize,
    beginFrame,
    endFrame,
    screenToWorld,
    visible,
    drawCity,
    drawCar,
    drawPerson,
    drawActor,
    drawPlayer,
    drawEffects,
    drawBarricades,
    drawAirUnit,
    drawStars,
    drawMarker,
    drawObjectiveArrow,
  };
}
