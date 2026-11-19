// Palm Shores — central tuning and story data for the 3D build.
// Every name in this file is original to Palm Shores: its city, crew, cars,
// weapons, stations and missions were written for this game alone.

export const CITY = {
  block: 44,            // city block size in metres
  road: 14,             // standard road width
  avenue: 20,           // Sunset Avenue width (the wide east-west strip)
  pitch: 58,            // block + road pitch
  grid: 3,              // blocks from centre to edge on each axis (7 x 7)
  waterX: 252,          // the bay starts east of here
  dayStart: 18 * 60 + 52, // the story opens at 18:52, DAY 1
};

export const DISTRICTS = [
  { name: 'DOWNTOWN', x: 0, z: 0 },
  { name: 'SUNSET AVENUE', x: -80, z: 0 },
  { name: 'CORAL STRAND', x: 190, z: -40 },
  { name: 'PIER NINE', x: 205, z: 150 },
  { name: 'BAYLINE', x: -150, z: 150 },
  { name: 'ISLA VERDE', x: -60, z: -160 },
  { name: 'PALM HEIGHTS', x: -170, z: -90 },
];

export const HERO_CAR = { model: 'VESPERA GT', color: 0xff77b7 };

export const WEAPONS = [
  { id: 'kestrel', name: 'KESTREL 9', kind: 'PISTOL', damage: 34, rate: 260, spread: 0.03, pellets: 1, magazine: 12, reserve: Infinity, unlockMission: 0 },
  { id: 'wasp', name: 'WASP 6149', kind: 'SMG', damage: 16, rate: 85, spread: 0.09, pellets: 1, magazine: 30, reserve: 240, unlockMission: 3 },
  { id: 'marlin', name: 'MARLIN 12', kind: 'SCATTERGUN', damage: 11, rate: 800, spread: 0.22, pellets: 6, magazine: 6, reserve: 48, unlockMission: 5 },
];

export const RADIO = [
  { freq: 'WAVE 88.1', name: 'NEON DRIVE', mood: 'synthwave', tracks: [
    ['Pink Horizon', 'Lumen Kids'], ['Chrome Palms', 'Vespera Club'], ['Salt in the Wiring', 'DJ Marisol'],
    ['Ultraviolet Mile', 'The Long Goodnights'], ['Glass Freeway', 'Ana Profundo'] ] },
  { freq: 'PALM 98.7', name: 'SALTLINE', mood: 'chill', tracks: [
    ['Low Tide Confessions', 'Marina Sol'], ['Bougainvillea', 'The Strand Quartet'], ['Ice in the Glass', 'Rene Azul'] ] },
  { freq: 'FLAMINGO FM', name: '104.5 THE FLAMINGO', mood: 'dance', tracks: [
    ['Neon Flamingo', 'Kiko Verde'], ['Baila en la Arena', 'Las Sirenas'], ['Pink Static', 'DJ Marisol'] ] },
  { freq: 'RADIO MIRAMAR', name: '101.3', mood: 'latin', tracks: [
    ['Muelle Nueve', 'Orquesta Brisa'], ['Corazon de Neon', 'Lucia Ferrer'], ['La Ultima Ola', 'Trio Palmas'] ] },
];

export const TRAFFIC_MODELS = [
  { model: 'SOLMARINA', kind: 'sedan' }, { model: 'BRISA COMPACT', kind: 'hatch' },
  { model: 'CAYO PICKUP', kind: 'pickup' }, { model: 'VELMARA COUPE', kind: 'coupe' },
  { model: 'ISLA VAN', kind: 'van' }, { model: 'TARPON TAXI', kind: 'taxi' },
];

export const TRAFFIC_COLORS = [0xf2e8d5, 0x7fd4c1, 0xff8c42, 0x5b8def, 0xd94f70, 0x8d6fd1, 0x3fbf8f, 0xe8c547, 0xb8c4ce, 0x243447];

export const UPGRADES = [
  { id: 'engine', name: 'STREET TUNE — ENGINE', cost: 900, blurb: 'Top speed and pull, courtesy of Bayline Garage.' },
  { id: 'nitro', name: 'NITRO KIT', cost: 1400, blurb: 'Hold SHIFT for a violet burst. Recharges as you drive.' },
  { id: 'armor', name: 'REINFORCED PANELS', cost: 1100, blurb: 'The Vespera shrugs off half the damage of every hit.' },
];

// Luna Marchetti runs dispatch for the crew from a rooftop over Bayline.
// She is the voice in the bottom-centre dialogue box for the whole story.
export const LUNA = 'LUNA — DISPATCH';

export const STORY_INTRO = [
  'You are MARA VOSS, the fastest wheel in Palm Shores.',
  'Eight jobs stand between you and owning the Bayline Garage.',
  'Luna runs dispatch. The Shores PD runs everything else.',
];
