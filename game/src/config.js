// Palm Shores — config.js
// Single source of truth for world layout, tuning and naming.
// The city is a 5x5 block grid on a rain-slick coast; the docks and the
// water sit along the south edge. Nothing here is copied from any
// commercial game: district names, characters and tuning are my own.

export const GAME_TITLE = 'Palm Shores';
export const SAVE_KEY = 'palm-shores-save-v1';

export const WORLD = {
  // Road centre lines (x and z), 5 roads each way, 46 units apart.
  roads: [-92, -46, 0, 46, 92],
  roadWidth: 12,
  blockSize: 34,
  // South edge: docks begin here, water beyond.
  docksZ: 118,
  waterZ: 150,
  bounds: 130,
};

export const DISTRICTS = [
  { name: 'Vesper Row',      cx: -69, cz: -69, color: '#ff2e88' }, // neon bar strip
  { name: 'Marina District', cx:  69, cz: -69, color: '#22d3ee' }, // towers, hotels
  { name: 'Coral Heights',   cx: -69, cz:  69, color: '#f59e0b' }, // apartments
  { name: 'The Docks',       cx:  69, cz:  69, color: '#a3e635' }, // containers, cranes
  { name: 'Palm Court',      cx:   0, cz:   0, color: '#c084fc' }, // downtown core
];

export const NIGHT = {
  sky: 0x0b0620,        // deep violet night
  fog: 0x140a2e,
  fogNear: 60,
  fogFar: 260,
  ambient: 0x33406e,
  moon: 0xbfd0ff,
  ground: 0x0d0d14,
};

export const PLAYER_TUNING = {
  walkSpeed: 6,
  runSpeed: 11,
  health: 100,
  armor: 50,
  pistolAmmo: 48,
  pistolDamage: 34,
  pistolRange: 90,
  pistolRate: 0.22, // seconds between shots
};

export const VEHICLE_TYPES = {
  hatch:  { label: 'Palm Hatch',   top: 26, accel: 14, turn: 2.4, brake: 22, color: 0xffb020, mass: 1.0 },
  sedan:  { label: 'Vesper Sedan', top: 30, accel: 16, turn: 2.2, brake: 24, color: 0x2e86ff, mass: 1.1 },
  coupe:  { label: 'Shores GT',    top: 38, accel: 22, turn: 2.7, brake: 28, color: 0xff2e88, mass: 0.95 },
  pickup: { label: 'Dune Pickup',  top: 28, accel: 15, turn: 2.0, brake: 22, color: 0x8a5a2b, mass: 1.4 },
  van:    { label: 'Cargo Van',    top: 24, accel: 11, turn: 1.7, brake: 20, color: 0xe8e8e8, mass: 1.6 },
  cruiser:{ label: 'Shores PD',    top: 34, accel: 20, turn: 2.5, brake: 26, color: 0x111827, mass: 1.2 },
};

export const WANTED = {
  decayPerSec: 0.55,      // heat lost while unseen
  decayDelay: 6,          // seconds after last crime before decay starts
  heatPerStar: 25,
  maxStars: 5,
  crimeHeat: { theft: 18, collision: 6, shot: 10, pedestrian: 22, policeHit: 30 },
  // cruisers on the street per star level (index = stars)
  cruisersPerStar: [0, 1, 2, 2, 3, 4],
  heliAtStars: 4,
};

export const ECONOMY = {
  startCash: 120,
  pickupCash: [25, 40, 60, 100],
  collectibleCount: 20,
  collectibleBonus: 150,
};

export const MISSION_REWARDS = [250, 400, 500, 800, 1500];

// Dispatcher character: "Rook", a fixer who talks to the player on the radio.
export const DISPATCHER = 'ROOK';
