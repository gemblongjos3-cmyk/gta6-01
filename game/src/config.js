// Palm Shores — config.js
// One job: every tunable number, name and mission definition for the game.
// Nothing here touches the renderer; main.js reads these values to build the world.
export const WORLD = {
  size: 400,            // city spans -200..200 on x and z
  streetSpacing: 40,    // road grid pitch
  roadWidth: 10,
  dockZ: 176,           // water starts past this z
  seaLevel: 0.05,
};

export const DISTRICTS = [
  { name: 'Neon Row',    x: 0,   z: -140, color: '#ff2e88' },
  { name: 'Downtown',    x: 0,   z: 0,    color: '#22d3ee' },
  { name: 'Palm Heights',x: 140, z: -40,  color: '#facc15' },
  { name: 'Vice Mile',   x: -140,z: 40,   color: '#a855f7' },
  { name: 'Old Docks',   x: 0,   z: 170,  color: '#34d399' },
  { name: 'Coral Bay',   x: -140,z: -120, color: '#fb923c' },
];

/** Vehicle types: handling differs per type, so stealing the right car matters. */
export const VEHICLE_TYPES = {
  sedan:   { name: 'Comet Sedan',  topSpeed: 34, accel: 16, grip: 2.6, color: 0x3b82f6 },
  coupe:   { name: 'Vortex Coupe', topSpeed: 44, accel: 22, grip: 3.1, color: 0xff2e63 },
  taxi:    { name: 'Shore Taxi',   topSpeed: 30, accel: 14, grip: 2.4, color: 0xfacc15 },
  van:     { name: 'Cargo Van',    topSpeed: 26, accel: 11, grip: 2.0, color: 0x94a3b8 },
  muscle:  { name: 'Night Muscle', topSpeed: 40, accel: 20, grip: 2.7, color: 0x7c3aed },
  cruiser: { name: 'PD Cruiser',   topSpeed: 38, accel: 19, grip: 3.0, color: 0x111827 },
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  health: 100,
  armor: 50,
  pistolAmmo: 60,
  pistolDamage: 34,
  pistolRange: 90,
  pistolRate: 0.22,
};

export const WANTED = {
  decaySeconds: 14,     // quiet seconds before one star fades
  maxStars: 5,
  heliAt: 4,             // helicopter joins at 4 stars
  bustRange: 3.2,        // a cruiser this close, player slow, risks a bust
};

export const MISSIONS = [
  {
    id: 'm1', title: 'Misi 1 — Paket Neon',
    brief: 'Reno: "Ambil paket di Neon Row, antar ke Old Docks. Jangan bikin ribut."',
    kind: 'pickup-deliver', reward: 500, timeLimit: 240,
    pickup: [24, -132], deliver: [60, 150],
  },
  {
    id: 'm2', title: 'Misi 2 — Ekor Si Kuning',
    brief: 'Reno: "Taksi kuning itu bawa buku catatan bos. Ikuti 30 detik, jangan sampai ketahuan."',
    kind: 'tail', reward: 800, timeLimit: 150, tailSeconds: 30,
    target: [-60, -20],
  },
  {
    id: 'm3', title: 'Misi 3 — Kabur dari Panas',
    brief: 'Reno: "Polisi sudah di ekormu. Bertahan 60 detik dan hilangkan mereka."',
    kind: 'escape', reward: 1000, timeLimit: 90, surviveSeconds: 60,
  },
  {
    id: 'm4', title: 'Misi 4 — Baku Tembak di Dermaga',
    brief: 'Reno: "Geng Pelabuhan nunggu di dermaga. Habisi 6 orang mereka, paketnya milik kita."',
    kind: 'shootout', reward: 1500, timeLimit: 300, killsNeeded: 6,
    site: [40, 168],
  },
  {
    id: 'm5', title: 'Misi 5 — Pelarian Terakhir',
    brief: 'Reno: "Ini dia. Ambil Night Muscle di Vice Mile, tembus ke Coral Bay sebelum fajar."',
    kind: 'getaway', reward: 3000, timeLimit: 150,
    carAt: [-132, 60], extract: [-150, -130],
  },
];

export const COLLECTIBLES = { cashCount: 24, starCount: 8, cashMin: 50, cashMax: 200, starValue: 250 };
export const TRAFFIC = { cars: 14, parked: 10, pedestrians: 18 };
export const STEP = 1 / 60;
