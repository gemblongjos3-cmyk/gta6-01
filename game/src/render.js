// Drawing only: the city and everything on it, painted in one pass with a camera over it. The
// palette is a sunset — a lavender sky, coral afterglow, long shadows flung west, windows lit gold
// and neon signs along the awnings. Nothing here steps the game; it reads the state it is handed.
import { COAST, FONT, PALETTE, PLAYER, ROAD, WORLD } from './config.js';
import { HALF_ROAD } from './world.js';

const HALF = ROAD.width / 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 1280, height: 800, dpr: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.dpr = dpr;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * dpr);
    canvas.height = Math.round(view.height * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  /** Screen pixels -> world point, for the mouse aim. */
  function screenToWorld(screenX, screenY, camera) {
    return {
      x: (screenX - view.width / 2) / camera.zoom + camera.x,
      y: (screenY - view.height / 2) / camera.zoom + camera.y,
    };
  }

  const visible = { left: 0, right: 0, top: 0, bottom: 0 };

  function beginFrame(camera) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = PALETTE.skyDeep;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.save();
    ctx.translate(view.width / 2, view.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    const margin = 200;
    visible.left = camera.x - view.width / (2 * camera.zoom) - margin;
    visible.right = camera.x + view.width / (2 * camera.zoom) + margin;
    visible.top = camera.y - view.height / (2 * camera.zoom) - margin;
    visible.bottom = camera.y + view.height / (2 * camera.zoom) + margin;
  }

  function endFrame(camera) {
    ctx.restore();
    drawVignette(camera);
  }

  /** The sunset bleeding in at the edges of the screen, over the whole frame. */
  function drawVignette(camera) {
    const width = view.width;
    const height = view.height;
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.52, Math.min(width, height) * 0.34, width * 0.5, height * 0.52, Math.max(width, height) * 0.78);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.62, 'rgba(24, 12, 40, 0.18)');
    gradient.addColorStop(1, PALETTE.vignette);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const warm = ctx.createLinearGradient(0, 0, 0, height);
    warm.addColorStop(0, 'rgba(255, 150, 90, 0.10)');
    warm.addColorStop(0.4, 'rgba(255, 120, 110, 0.03)');
    warm.addColorStop(1, 'rgba(40, 18, 60, 0.12)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, width, height);
    // A little chromatic sunset haze when the wanted level burns hot.
    void camera;
  }

  function label(text, x, y, size, color, align = 'center', weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  // ---------- the ground: sea, sand, roads, pavements ----------

  function drawSea(time) {
    const sea = ctx.createLinearGradient(0, COAST.waterline, 0, WORLD.height);
    sea.addColorStop(0, PALETTE.sea);
    sea.addColorStop(0.35, '#22707e');
    sea.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = sea;
    ctx.fillRect(visible.left, COAST.waterline, visible.right - visible.left, WORLD.height - COAST.waterline + 200);

    // Long evening glints: the sun sits low in the west, so the shimmer runs shoreward.
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let row = 0; row < 16; row += 1) {
      const y = COAST.waterline + 18 + row * 40;
      const sway = Math.sin(time * 0.6 + row * 0.7) * 18;
      ctx.fillStyle = row % 3 === 0 ? PALETTE.seaGlint : '#8fd0cf';
      ctx.globalAlpha = 0.1 + (row % 4) * 0.05;
      for (let x = Math.max(visible.left, 0); x < Math.min(visible.right, WORLD.width); x += 190) {
        ctx.fillRect(x + (row % 2) * 70 + sway, y, 64 - row * 2, 3);
      }
    }
    ctx.restore();

    // Wave foam at the waterline.
    ctx.strokeStyle = 'rgba(255, 246, 226, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = Math.max(visible.left, 0); x <= Math.min(visible.right, WORLD.width); x += 26) {
      const y = COAST.waterline - 6 + Math.sin(x * 0.02 + time * 1.1) * 5;
      if (x === Math.max(visible.left, 0)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // The piers: planks on stilts reaching out into the water.
    for (const x of [620, 1780, 2980, 4020]) {
      if (x < visible.left - 200 || x > visible.right + 200) continue;
      ctx.fillStyle = '#8a6a4c';
      ctx.fillRect(x - 26, COAST.beachTop + 40, 52, 780);
      ctx.fillStyle = '#a07c58';
      for (let y = COAST.beachTop + 60; y < COAST.beachTop + 780; y += 26) ctx.fillRect(x - 26, y, 52, 18);
      ctx.strokeStyle = 'rgba(60, 36, 26, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 26, COAST.beachTop + 40);
      ctx.lineTo(x - 26, COAST.beachTop + 820);
      ctx.moveTo(x + 26, COAST.beachTop + 40);
      ctx.lineTo(x + 26, COAST.beachTop + 820);
      ctx.stroke();
    }
  }

  function drawBeach() {
    const sand = ctx.createLinearGradient(0, COAST.beachTop - 60, 0, COAST.waterline);
    sand.addColorStop(0, '#d9bf8e');
    sand.addColorStop(0.5, PALETTE.sand);
    sand.addColorStop(1, '#f0d9ab');
    ctx.fillStyle = sand;
    ctx.fillRect(visible.left, COAST.beachTop - 40, visible.right - visible.left, COAST.waterline - COAST.beachTop + 44);
    // The promenade above it, and a low sea wall.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(visible.left, COAST.beachTop - 52, visible.right - visible.left, 14);
    ctx.fillStyle = 'rgba(120, 96, 70, 0.35)';
    ctx.fillRect(visible.left, COAST.beachTop - 52, visible.right - visible.left, 3);
  }

  function drawRoads() {
    // Pavements first: a pale band down each road, wider than the asphalt.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const avenue of ROAD.avenueX) {
      if (avenue + HALF + 24 < visible.left || avenue - HALF - 24 > visible.right) continue;
      ctx.fillRect(avenue - HALF - 24, Math.max(visible.top, 0), ROAD.width + 48, Math.min(visible.bottom, WORLD.height) - Math.max(visible.top, 0));
    }
    for (const street of ROAD.streetY) {
      if (street + HALF + 24 < visible.top || street - HALF - 24 > visible.bottom) continue;
      ctx.fillRect(Math.max(visible.left, 0), street - HALF - 24, Math.min(visible.right, WORLD.width) - Math.max(visible.left, 0), ROAD.width + 48);
    }

    // The asphalt.
    ctx.fillStyle = PALETTE.asphalt;
    for (const avenue of ROAD.avenueX) {
      if (avenue + HALF < visible.left || avenue - HALF > visible.right) continue;
      ctx.fillRect(avenue - HALF, Math.max(visible.top, 0), ROAD.width, Math.min(visible.bottom, WORLD.height) - Math.max(visible.top, 0));
    }
    for (const street of ROAD.streetY) {
      if (street + HALF < visible.top || street - HALF > visible.bottom) continue;
      ctx.fillRect(Math.max(visible.left, 0), street - HALF, Math.min(visible.right, WORLD.width) - Math.max(visible.left, 0), ROAD.width);
    }

    // Worn patches, so the tarmac is not a flat colour.
    ctx.fillStyle = PALETTE.asphaltWorn;
    for (let index = 0; index < 26; index += 1) {
      const x = 200 + ((index * 977) % 4200);
      const y = 150 + ((index * 613) % 2200);
      if (x < visible.left || x > visible.right || y < visible.top || y > visible.bottom) continue;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, y, 90 + (index % 5) * 22, 26);
      ctx.globalAlpha = 1;
    }

    // Lane markings: double soft dashes down the middle, edge lines at the kerbs.
    ctx.strokeStyle = PALETTE.laneMark;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
    for (const avenue of ROAD.avenueX) {
      if (avenue < visible.left || avenue > visible.right) continue;
      ctx.setLineDash([26, 30]);
      ctx.beginPath();
      ctx.moveTo(avenue - 3, Math.max(visible.top, 0));
      ctx.lineTo(avenue - 3, Math.min(visible.bottom, WORLD.height));
      ctx.stroke();
      ctx.strokeStyle = PALETTE.laneMark;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(avenue - HALF + 6, Math.max(visible.top, 0));
      ctx.lineTo(avenue - HALF + 6, Math.min(visible.bottom, WORLD.height));
      ctx.moveTo(avenue + HALF - 6, Math.max(visible.top, 0));
      ctx.lineTo(avenue + HALF - 6, Math.min(visible.bottom, WORLD.height));
      ctx.stroke();
      ctx.globalAlpha = 0.55;
    }
    for (const street of ROAD.streetY) {
      if (street < visible.top || street > visible.bottom) continue;
      ctx.setLineDash([26, 30]);
      ctx.beginPath();
      ctx.moveTo(Math.max(visible.left, 0), street - 3);
      ctx.lineTo(Math.min(visible.right, WORLD.width), street - 3);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.laneMark;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.max(visible.left, 0), street - HALF + 6);
      ctx.lineTo(Math.min(visible.right, WORLD.width), street - HALF + 6);
      ctx.moveTo(Math.max(visible.left, 0), street + HALF - 6);
      ctx.lineTo(Math.min(visible.right, WORLD.width), street + HALF - 6);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Zebra crossings on the four sides of each junction.
    ctx.fillStyle = 'rgba(255, 246, 226, 0.32)';
    for (const avenue of ROAD.avenueX) {
      for (const street of ROAD.streetY) {
        if (avenue < visible.left - 100 || avenue > visible.right + 100 || street < visible.top - 100 || street > visible.bottom + 100) continue;
        for (let stripe = -2; stripe <= 2; stripe += 1) {
          ctx.fillRect(avenue + stripe * 20 - 7, street + HALF + 8, 12, 16);
          ctx.fillRect(avenue + stripe * 20 - 7, street - HALF - 24, 12, 16);
          ctx.fillRect(avenue + HALF + 8, street + stripe * 20 - 7, 16, 12);
          ctx.fillRect(avenue - HALF - 24, street + stripe * 20 - 7, 16, 12);
        }
      }
    }
  }

  // ---------- buildings ----------

  function drawBuilding(building, time) {
    if (building.x > visible.right || building.x + building.w < visible.left) return;
    if (building.y > visible.bottom || building.y + building.h < visible.top) return;
    const { x, y, w, h } = building;

    // The long shadow the low sun throws west across the pavement.
    ctx.fillStyle = 'rgba(38, 22, 50, 0.42)';
    ctx.fillRect(x - 14 - building.floors * 3, y + 10, w, h);

    // Wall, then a lighter sunlit face along the east and south edges.
    ctx.fillStyle = building.color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255, 214, 160, 0.22)';
    ctx.fillRect(x + w - 7, y, 7, h);
    ctx.fillRect(x, y + h - 6, w, 6);
    ctx.strokeStyle = building.trim;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    // Roof: a darker inset with the odd tank or AC unit.
    ctx.fillStyle = building.trim;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
    ctx.globalAlpha = 1;
    if (building.rooftop === 'ac' && w > 70 && h > 70) {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(x + w * 0.55, y + h * 0.2, 18, 14);
      ctx.fillStyle = '#7d7d7d';
      ctx.fillRect(x + w * 0.55 + 3, y + h * 0.2 + 3, 12, 8);
    } else if (building.rooftop === 'tank') {
      ctx.fillStyle = '#8a7a68';
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.3, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5f5346';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Windows: a grid of lit and dark panes on the two street-facing sides.
    if (building.windows) {
      const rows = Math.max(2, Math.min(5, Math.floor(h / 34)));
      const cols = Math.max(2, Math.min(6, Math.floor(w / 34)));
      const cellW = (w - 24) / cols;
      const cellH = (h - 24) / rows;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const lit = ((row * 7 + col * 13 + building.seed) % 10) > 4;
          if (!lit && ((row + col + building.seed) % 3) !== 0) continue;
          ctx.fillStyle = lit ? PALETTE.glassLit : PALETTE.glass;
          ctx.globalAlpha = lit ? 0.82 + Math.sin(time * 0.6 + row + col) * 0.06 : 0.55;
          ctx.fillRect(x + 12 + col * cellW + cellW * 0.2, y + 12 + row * cellH + cellH * 0.2, cellW * 0.55, cellH * 0.5);
          ctx.globalAlpha = 1;
        }
      }
    }

    // A landmark gets an awning and a big sign; a shop with a name gets a modest one.
    if (building.landmark) {
      ctx.fillStyle = building.neon;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x - 4, y + h - 26, w + 8, 12);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.shadowColor = building.neon;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fff4e4';
      label(building.name, x + w / 2, y + h - 48, Math.min(17, Math.max(11, w / 9)), '#fff4e4', 'center', 800);
      ctx.restore();
      // A rooftop sign post.
      ctx.fillStyle = building.trim;
      ctx.fillRect(x + w / 2 - 2, y - 22, 4, 22);
    } else if (building.name) {
      ctx.fillStyle = building.neon ?? 'rgba(255, 220, 170, 0.9)';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x + 8, y + h - 18, w - 16, 4);
      ctx.globalAlpha = 1;
      if (w > 110 && h > 90) {
        ctx.save();
        ctx.shadowColor = building.neon ?? PALETTE.gold;
        ctx.shadowBlur = 8;
        label(building.name, x + w / 2, y + h - 8, Math.min(11, w / 12), 'rgba(255, 244, 228, 0.88)', 'center', 700);
        ctx.restore();
      }
    }
  }

  function drawWorldProps(props, time) {
    for (const prop of props) {
      if (prop.x < visible.left || prop.x > visible.right || prop.y < visible.top || prop.y > visible.bottom) continue;
      if (prop.kind === 'lamp') {
        // Warm pool of light on the asphalt and a small post.
        const glow = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 54);
        glow.addColorStop(0, 'rgba(255, 206, 138, 0.30)');
        glow.addColorStop(1, 'rgba(255, 206, 138, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5b4a3c';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.streetlightGlow;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      } else if (prop.kind === 'palm') {
        const size = prop.size ?? 1;
        ctx.fillStyle = 'rgba(40, 22, 44, 0.34)';
        ctx.beginPath();
        ctx.ellipse(prop.x - 8, prop.y + 6, 16 * size, 7 * size, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6d5236';
        ctx.lineWidth = 3 * size;
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.quadraticCurveTo(prop.x - 3 * size, prop.y - 12 * size, prop.x - 1 * size, prop.y - 20 * size);
        ctx.stroke();
        for (let frond = 0; frond < 6; frond += 1) {
          const angle = (frond / 6) * Math.PI * 2 + Math.sin(time * 0.7 + prop.x) * 0.06;
          ctx.strokeStyle = frond % 2 === 0 ? PALETTE.grass : PALETTE.grassDark;
          ctx.lineWidth = 3.4 * size;
          ctx.beginPath();
          ctx.moveTo(prop.x - size, prop.y - 20 * size);
          ctx.quadraticCurveTo(
            prop.x - size + Math.cos(angle) * 12 * size,
            prop.y - 22 * size + Math.sin(angle) * 7 * size,
            prop.x - size + Math.cos(angle) * 19 * size,
            prop.y - 16 * size + Math.sin(angle) * 12 * size,
          );
          ctx.stroke();
        }
      } else if (prop.kind === 'hydrant') {
        ctx.fillStyle = '#d05a48';
        ctx.fillRect(prop.x - 3, prop.y - 8, 6, 9);
        ctx.fillStyle = '#a54436';
        ctx.fillRect(prop.x - 5, prop.y - 6, 10, 3);
      } else if (prop.kind === 'bench') {
        ctx.fillStyle = '#7d6244';
        ctx.fillRect(prop.x - 11, prop.y - 4, 22, 5);
        ctx.fillRect(prop.x - 11, prop.y + 2, 22, 4);
      }
    }
  }

  // ---------- the things that move ----------

  function drawCar(car, time) {
    if (car.x < visible.left || car.x > visible.right || car.y < visible.top || car.y > visible.bottom) return;
    ctx.save();
    ctx.translate(car.x, car.y);

    // Ground shadow under the body, thrown a little west.
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(-5, 5, car.length * 0.52, car.width * 0.6, car.angle, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(car.angle);
    const l = car.length;
    const w = car.width;

    // Wheels poke out at the corners and turn with the steering.
    ctx.fillStyle = '#191620';
    const wheelY = w / 2 - 2;
    for (const [wx, turn] of [
      [l * 0.28, car.wheelTurn],
      [-l * 0.3, 0],
    ]) {
      for (const wy of [-wheelY, wheelY]) {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(turn * 0.5);
        ctx.fillRect(-7, -3.4, 14, 6.8);
        ctx.restore();
      }
    }

    // Body, roof and a windshield band.
    ctx.fillStyle = car.hitFlash > 0 ? '#fff3d6' : car.color;
    ctx.beginPath();
    ctx.roundRect(-l / 2, -w / 2, l, w, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(-l / 2 + 3, -w / 2 + 3, l - 6, w * 0.34, 5);
    ctx.fill();

    ctx.fillStyle = car.roof;
    ctx.beginPath();
    ctx.roundRect(-l * 0.22, -w / 2 + 4, l * 0.44, w - 8, 4);
    ctx.fill();
    ctx.fillStyle = car.glass;
    ctx.beginPath();
    ctx.roundRect(l * 0.2, -w / 2 + 5, l * 0.1, w - 10, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-l * 0.36, -w / 2 + 5, l * 0.08, w - 10, 2);
    ctx.fill();

    // Headlights: the city is at dusk, so they are on, with a cone ahead.
    const cone = ctx.createLinearGradient(l / 2, 0, l / 2 + 90, 0);
    cone.addColorStop(0, 'rgba(255, 235, 180, 0.22)');
    cone.addColorStop(1, 'rgba(255, 235, 180, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(l / 2 - 2, -w * 0.34);
    ctx.lineTo(l / 2 + 92, -w * 1.1);
    ctx.lineTo(l / 2 + 92, w * 1.1);
    ctx.lineTo(l / 2 - 2, w * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffeec2';
    ctx.fillRect(l / 2 - 4, -w / 2 + 4, 3, 5);
    ctx.fillRect(l / 2 - 4, w / 2 - 9, 3, 5);
    ctx.fillStyle = '#ff6a5a';
    ctx.fillRect(-l / 2 + 1, -w / 2 + 5, 3, 4);
    ctx.fillRect(-l / 2 + 1, w / 2 - 9, 3, 4);

    // A police cruiser wears a light bar that flashes blue and red.
    if (car.kind === 'police') {
      const phase = Math.floor(time * 6 + (car.sirenPhase ?? 0)) % 2 === 0;
      ctx.fillStyle = phase ? '#66b6ff' : '#ff4d5e';
      ctx.fillRect(-l * 0.06, -w / 2 - 1, l * 0.12, w + 2);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = phase ? '#66b6ff' : '#ff4d5e';
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#22304a';
      ctx.fillRect(-l * 0.2, -w / 2 + 3, l * 0.4, 3);
    }

    // Smoke when the car is wrecked.
    if (car.smoke > 0.1) {
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(time * 3 + car.x) * 0.05;
      ctx.fillStyle = '#4a4450';
      for (let puff = 0; puff < 3; puff += 1) {
        const drift = (time * 22 + puff * 18) % 40;
        ctx.beginPath();
        ctx.arc(l * 0.3 + Math.sin(time + puff) * 6, -drift * 0.4, 6 + drift * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPerson(person, time) {
    if (person.x < visible.left || person.x > visible.right || person.y < visible.top || person.y > visible.bottom) return;
    ctx.save();
    ctx.translate(person.x, person.y);
    ctx.fillStyle = 'rgba(40, 22, 44, 0.32)';
    ctx.beginPath();
    ctx.ellipse(-3, 4, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (person.dead) {
      ctx.rotate(person.angle);
      ctx.fillStyle = person.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = person.skin;
      ctx.beginPath();
      ctx.arc(8, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 24, 30, 0.45)';
      ctx.beginPath();
      ctx.ellipse(2, 2, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(person.angle);
    // Arms up when running from a fright.
    const fleeing = person.state === 'flee';
    const swing = Math.sin(person.walkPhase) * 3;
    ctx.strokeStyle = person.skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (fleeing) {
      ctx.moveTo(0, -4);
      ctx.lineTo(-4, -10);
      ctx.moveTo(0, 4);
      ctx.lineTo(-4, 10);
    } else {
      ctx.moveTo(0, -4);
      ctx.lineTo(swing, -7);
      ctx.moveTo(0, 4);
      ctx.lineTo(-swing, 7);
    }
    ctx.stroke();
    ctx.fillStyle = person.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(5.5, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    if (person.hat) {
      ctx.fillStyle = '#3c3340';
      ctx.beginPath();
      ctx.arc(5.5, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawActor(actor) {
    if (actor.x < visible.left || actor.x > visible.right || actor.y < visible.top || actor.y > visible.bottom) return;
    ctx.save();
    ctx.translate(actor.x, actor.y);
    if (actor.dead) {
      ctx.rotate(actor.angle);
      ctx.fillStyle = '#4a3a4c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(40, 22, 44, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-3, 4, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(actor.angle);
    ctx.fillStyle = actor.hurt > 0 ? '#ffd0c0' : '#3b3448';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d0a37a';
    ctx.beginPath();
    ctx.arc(6, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    // The pistol, pointed where the actor aims.
    ctx.fillStyle = '#22202a';
    ctx.fillRect(8, -1.6, 9, 3.2);
    ctx.restore();
    if (actor.hp < actor.maxHp) {
      ctx.fillStyle = 'rgba(10, 6, 16, 0.75)';
      ctx.fillRect(actor.x - 15, actor.y - 20, 30, 4);
      ctx.fillStyle = '#ff6a5a';
      ctx.fillRect(actor.x - 15, actor.y - 20, 30 * Math.max(0, actor.hp / actor.maxHp), 4);
    }
  }

  function drawPlayer(player, time) {
    const { x, y } = player;
    ctx.save();
    ctx.translate(x, y);
    if (player.car) {
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(40, 22, 44, 0.36)';
    ctx.beginPath();
    ctx.ellipse(-3, 5, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // An aim line out to the cursor: a faint laser the player always reads.
    ctx.rotate(player.aim);
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.24)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(150, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#22202a';
    ctx.fillRect(9, -1.8, 10, 3.6);

    // Body, jacket and head.
    ctx.fillStyle = '#f2f0e8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 6.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9544a';
    ctx.beginPath();
    ctx.ellipse(-1, 0, 7, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0b48c';
    ctx.beginPath();
    ctx.arc(6, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2330';
    ctx.beginPath();
    ctx.arc(7, 0, 3.4, 0.4, Math.PI * 2 - 0.4);
    ctx.fill();
    ctx.restore();

    // A soft halo round the player, so they never get lost in the crowd.
    const halo = ctx.createRadialGradient(x, y, 6, x, y, 34);
    halo.addColorStop(0, 'rgba(255, 220, 170, 0.16)');
    halo.addColorStop(1, 'rgba(255, 220, 170, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fill();

    if (player.hurtFlash > 0) {
      ctx.strokeStyle = `rgba(255, 80, 60, ${player.hurtFlash * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER.radius + 4 + (0.5 - player.hurtFlash) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    void time;
  }

  // ---------- effects ----------

  function drawEffects(combat, skids, time) {
    ctx.fillStyle = 'rgba(24, 18, 28, 0.28)';
    for (const skid of skids) {
      if (skid.x < visible.left || skid.x > visible.right) continue;
      ctx.save();
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.globalAlpha = Math.min(0.5, skid.life * 0.18);
      ctx.fillRect(-9, -13, 18, 5);
      ctx.fillRect(-9, 8, 18, 5);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    for (const bullet of combat.bullets) {
      const tailX = bullet.x - (bullet.vx / 2100) * 22;
      const tailY = bullet.y - (bullet.vy / 2100) * 22;
      const gradient = ctx.createLinearGradient(tailX, tailY, bullet.x, bullet.y);
      gradient.addColorStop(0, 'rgba(255, 220, 150, 0)');
      gradient.addColorStop(1, bullet.hostile ? '#ff8f7a' : '#fff0c0');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }

    for (const flash of combat.flashes) {
      ctx.save();
      ctx.translate(flash.x, flash.y);
      ctx.rotate(flash.angle);
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 26);
      glow.addColorStop(0, 'rgba(255, 245, 200, 0.95)');
      glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const spark of combat.sparks) {
      ctx.globalAlpha = Math.max(0, spark.life * 3);
      ctx.fillStyle = spark.color;
      ctx.fillRect(spark.x - 1, spark.y - 1, 2.4, 2.4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d8b060';
    for (const casing of combat.casings) {
      ctx.save();
      ctx.translate(casing.x, casing.y);
      ctx.rotate(casing.spin);
      ctx.globalAlpha = Math.min(1, casing.life);
      ctx.fillRect(-1.6, -0.8, 3.2, 1.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    void time;
  }

  /** The yellow mission marker: a ring on the ground and a bobbing diamond over it. */
  function drawMarker(marker, time, color = PALETTE.gold, labelText = null) {
    if (!marker) return;
    if (marker.x < visible.left || marker.x > visible.right || marker.y < visible.top || marker.y > visible.bottom) return;
    const pulse = 1 + Math.sin(time * 3.2) * 0.08;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const bob = Math.sin(time * 2.2) * 5;
    ctx.translate(marker.x, marker.y - 34 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#2a1c12';
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText ?? '!', 0, 1);
    ctx.restore();
  }

  /** A checkpoint arrow: a chevron at the screen edge pointing the player toward the goal. */
  function drawObjectiveArrow(camera, marker, player, color = PALETTE.gold) {
    if (!marker) return;
    const dx = marker.x - player.x;
    const dy = marker.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 240) return;
    const angle = Math.atan2(dy, dx);
    const radius = Math.min(view.width, view.height) * 0.36;
    const cx = view.width / 2 + Math.cos(angle) * radius;
    const cy = view.height / 2 + Math.sin(angle) * radius * 0.78;
    // Save BEFORE switching to screen space: restoring afterwards must hand the world
    // transform back to the drawables that follow, or every car and person after the
    // arrow is painted thousands of pixels off-canvas.
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -11);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    void camera;
  }

  // ---------- composite scenes ----------

  function drawCity(world, props, time) {
    drawSea(time);
    drawBeach();
    drawRoads();
    for (const building of world.buildings) drawBuilding(building, time);
    drawWorldProps(props, time);
  }

  return {
    view,
    resize,
    beginFrame,
    endFrame,
    screenToWorld,
    drawCity,
    drawCar,
    drawPerson,
    drawActor,
    drawPlayer,
    drawEffects,
    drawMarker,
    drawObjectiveArrow,
    visible,
    ctx,
  };
}
