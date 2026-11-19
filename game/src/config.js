// Every tuning number and colour in one place, plus the names of the city's streets and the
// businesses along them. Nothing here reads the screen or the clock: the rest of the game imports
// these values so a single edit retunes the whole city.

/** The world is one long summer evening: a 4.6 x 3.2 km seaside grid, sea along the south edge. */
export const WORLD = {
  width: 4600,
  height: 3200,
  streetlightGlow: '#ffcf8a',
};

/** The road grid. Nine avenues run north-south, six streets east-west; the sea starts at COAST. */
export const ROAD = {
  width: 132,
  lane: 30,
  sidewalk: 24,
  avenueX: [140, 680, 1220, 1760, 2300, 2840, 3380, 3920, 4460],
  streetY: [160, 600, 1040, 1480, 1920, 2360],
  nameAvenue: [
    'Coral Avenue',
    'Marlin Avenue',
    'Sunset Avenue',
    'Palmetto Avenue',
    'Bayline Avenue',
    'Isla Avenue',
    'Tide Avenue',
    'Harbor Avenue',
    'Dune Avenue',
  ],
  nameStreet: ['First Street', 'Mango Street', 'Pelican Street', 'Lantern Street', 'Anchor Street', 'Shoreline Street'],
};

/** The coast strip: sand, the waterline and the piers that reach out over it. */
export const COAST = { beachTop: 2400, waterline: 2720, pierY: 2900 };

/** One fixed simulation step: 60 updates a second whatever the display's refresh rate. */
export const STEP = 1 / 60;

/** How far the camera can pull back and how quickly it eases toward its target. */
export const CAMERA = { walkZoom: 1, driveZoom: 0.84, lead: 0.18, ease: 0.22 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  runSpeed: 320,
  sprintDrain: 0,
  health: 100,
  respawnHealth: 60,
  maxAmmo: 72,
  magazine: 12,
  reloadTime: 1.25,
  fireDelay: 0.16,
};

export const CAR = {
  length: 62,
  width: 31,
  maxSpeed: 430,
  reverseSpeed: 150,
  accel: 330,
  brake: 620,
  drag: 0.9,
  steer: 2.5,
  grip: 7,
  health: 100,
  radius: 22,
};

export const TRAFFIC = {
  cars: 40,
  speed: 160,
  speedJitter: 45,
  laneOffset: 30,
  lookAhead: 96,
  stopTime: 1.6,
};

export const PEDESTRIAN = {
  count: 64,
  walkSpeed: 62,
  runSpeed: 190,
  panicTime: 5,
};

/** The Sunset Stars: twelve gold palms hidden over the city, each worth cash to whoever rolls over it. */
export const STARS = {
  count: 12,
  reward: 150,
  radius: 34,
  color: '#ffd94d',
};

export const POLICE = {
  maxCars: 5,
  carSpeed: 300,
  chaseRadius: 1500,
  bustRadius: 46,
  bustTime: 2.6,
  heatDecayDelay: 9,
  heatDecayRate: 0.09,
  /** The air unit joins the hunt at this heat and shadows the player from above. */
  heliMinWanted: 3,
  /** Roadblocks are thrown across the road ahead at this heat. */
  roadblockMinWanted: 4,
  roadblockCooldown: 16,
  roadblockRange: 980,
};

/** Colours of the sunset city: warm pastels for the walls, teal and coral neon for the signs. */
export const PALETTE = {
  skyTop: '#37306b',
  skyMid: '#cf4f74',
  skyWarm: '#ff9e5e',
  skyDeep: '#7b3f78',
  vignette: 'rgba(28, 16, 44, 0.55)',
  sea: '#2f7f8c',
  seaDeep: '#17505f',
  seaGlint: '#ffd9a0',
  sand: '#e8c891',
  sandShade: '#cfae7a',
  asphalt: '#33313c',
  asphaltLight: '#3d3a47',
  asphaltWorn: '#2b2933',
  laneMark: '#e8d27a',
  curb: '#d8c4ad',
  sidewalk: '#bfae9a',
  sidewalkLine: '#a89a88',
  grass: '#5c8a52',
  grassDark: '#446c3e',
  shadow: 'rgba(30, 18, 36, 0.34)',
  glass: '#2b3d52',
  glassLit: '#ffd993',
  text: '#fff4e4',
  muted: '#c9b9a8',
  gold: '#ffc94d',
  danger: '#ff5b5b',
  policeBlue: '#5fb2ff',
  health: '#7ce07c',
  money: '#9fe08a',
  wall: ['#f2b8a2', '#e8c07a', '#cfe3d4', '#9fc6d8', '#d9a7c7', '#f0d0a8', '#b8c9dd'],
  trim: ['#b56a5a', '#b98f45', '#6d9a83', '#4f7f99', '#9c6a8c', '#b08c5a', '#6b7f96'],
  car: ['#e2574c', '#f0a24a', '#4fa3c7', '#7bbf6a', '#c9c9d1', '#8a6fc0', '#e8d27a', '#3a4250'],
  neon: ['#ff6fa5', '#5fe0d0', '#ffd166', '#8f8bff', '#ff8c5a'],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Street names and business names, flavour for the map and the mission dialogue. */
export const BUSINESS_NAMES = [
  'Mango Mart',
  'Sunset Liquor',
  'Coral Cuts',
  'Wave Wash',
  'Palmetto Pawn',
  'Rio Records',
  'Sandbar Bar',
  'Coconut Cafe',
  'Neon Nails',
  'Bay Books',
  'Junction Gym',
  'Palm Arcade',
  'Tiki Tax',
  'Reef Pharmacy',
  'Lagoon Laundry',
  'Gull & Anchor',
  'Dune Deli',
  'Marina Grill',
  'Shell Shack',
  'Isla Imports',
  'Breeze Motors',
  'Sundial Hotel',
];

/** The named places the story uses: each maps to a block index (avenue, street) in the grid. */
export const PLACES = [
  { key: 'diner', name: 'Anchor Diner', kind: 'diner', block: [3, 0], color: '#f0c479' },
  { key: 'hotel', name: 'Palm Royale', kind: 'hotel', block: [1, 0], color: '#f2b8a2' },
  { key: 'police', name: 'Palm Shores PD', kind: 'police', block: [5, 1], color: '#9fc6d8' },
  { key: 'bank', name: 'Harbor Trust Bank', kind: 'bank', block: [4, 1], color: '#d9d2c0' },
  { key: 'garage', name: 'Bayline Garage', kind: 'garage', block: [2, 2], color: '#c8c2b4' },
  { key: 'hospital', name: 'Mercy Shores Hospital', kind: 'hospital', block: [6, 2], color: '#e8e2d4' },
  { key: 'gunshop', name: 'Shores Supply', kind: 'gunshop', block: [6, 0], color: '#b8c9dd' },
  { key: 'gas', name: 'Isla Fuel', kind: 'gas', block: [0, 3], color: '#f0d0a8' },
  { key: 'marina', name: 'Marina Grill', kind: 'marina', block: [3, 4], color: '#cfe3d4' },
  { key: 'warehouse', name: 'Pier 9 Warehouses', kind: 'dock', block: [5, 4], color: '#b0a89a' },
];

/** How much a crime costs in stars and cash: the wanted level rises, the wallet pays the fine. */
export const CRIME = {
  stealCar: 1,
  hitPedestrian: 1,
  gunshot: 1,
  missionHeat: 1,
  fine: 50,
};

/** The save lives only in this browser, under this key. */
export const SAVE_KEY = 'palm-shores.save.v1';
