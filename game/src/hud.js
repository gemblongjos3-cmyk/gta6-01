// Palm Shores — hud.js
// One job: everything on screen that is not the 3D view — health/armor bars,
// cash, ammo, wanted stars, objective, speedometer, dispatcher banner, and
// the live canvas minimap (streets, player, police, mission marker).
export function createHud(G) {
  const root = document.getElementById('hud');
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');

  function drawMinimap() {
    const W = minimap.width, H = minimap.height;
    const scale = W / 420;
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    mctx.fillStyle = 'rgba(8,10,24,0.85)';
    mctx.fillRect(0, 0, W, H);
    // Streets.
    mctx.strokeStyle = '#3a4157'; mctx.lineWidth = 2;
    for (const s of G.city.streets) {
      mctx.beginPath(); mctx.moveTo(toX(s), 0); mctx.lineTo(toX(s), H); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, toY(s)); mctx.lineTo(W, toY(s)); mctx.stroke();
    }
    // Sea.
    mctx.fillStyle = '#0a2a4a';
    mctx.fillRect(0, toY(176), W, H - toY(176));
    // Mission marker.
    if (G.marker) {
      mctx.fillStyle = '#ff2e88';
      mctx.beginPath(); mctx.arc(toX(G.marker.position.x), toY(G.marker.position.z), 5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#ff2e88'; mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.arc(toX(G.marker.position.x), toY(G.marker.position.z), 9, 0, Math.PI * 2); mctx.stroke();
    }
    // Pickups (tiny green dots).
    mctx.fillStyle = '#22c55e';
    for (const item of G.pickups) mctx.fillRect(toX(item.mesh.position.x) - 1, toY(item.mesh.position.z) - 1, 2, 2);
    // Police (blue/red) then player (white arrow).
    for (const cruiser of G.police) {
      mctx.fillStyle = '#3b82f6';
      mctx.beginPath(); mctx.arc(toX(cruiser.pos.x), toY(cruiser.pos.z), 3.5, 0, Math.PI * 2); mctx.fill();
    }
    if (G.heli?.active) {
      mctx.fillStyle = '#f97316';
      mctx.beginPath(); mctx.arc(toX(G.heli.mesh.position.x), toY(G.heli.mesh.position.z), 4, 0, Math.PI * 2); mctx.fill();
    }
    const p = G.player.pos;
    mctx.save();
    mctx.translate(toX(p.x), toY(p.z));
    mctx.rotate(G.player.car ? -G.player.car.heading : -G.player.heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(-4.5, 5); mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  let briefTimer = null;
  return {
    update() {
      const p = G.player;
      el('health-fill').style.width = `${Math.max(0, p.health)}%`;
      el('armor-fill').style.width = `${Math.max(0, p.armor)}%`;
      el('cash').textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
      el('ammo').textContent = p.car ? '—' : `🔫 ${p.ammo}`;
      el('stars').textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
      el('stars').style.color = G.wanted > 0 ? '#ffcf3d' : '#64748b';
      el('objective').textContent = `🎯 ${G.objective || ''}` + (G.mission ? ` ⏱ ${Math.max(0, Math.ceil(G.mission.timer))} dtk` : '');
      el('district').textContent = G.city.districtAt(p.pos.x, p.pos.z).name;
      const speed = p.car ? Math.abs(p.car.speed) * 3.6 : Math.abs(p.speed) * 3.6;
      el('speed').textContent = p.car ? `${Math.round(speed)} km/h` : '';
      el('car-name').textContent = p.car ? p.car.type.name : '';
      root.style.display = G.mode === 'play' ? 'block' : 'none';
      drawMinimap();
    },
    showMessage(text) {
      const m = el('message');
      m.textContent = text;
      m.classList.add('show');
      clearTimeout(m._t);
      m._t = setTimeout(() => m.classList.remove('show'), 3200);
    },
    showBrief(text) {
      const b = el('brief');
      b.textContent = `📻 ${text}`;
      b.classList.add('show');
      clearTimeout(briefTimer);
      briefTimer = setTimeout(() => b.classList.remove('show'), 7000);
    },
  };
}
