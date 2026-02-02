
import { UnitType, CardCategory, Character } from './types';

export const INITIAL_FIELD_SIZE = 10;
export const BOARD_SIZE = 40; // High limit for the "infinite" feel
export const TILE_SIZE = 1.0;
export const TILE_SPACING = 0.1;
export const BOARD_OFFSET = (BOARD_SIZE * (TILE_SIZE + TILE_SPACING)) / 2 - (TILE_SIZE + TILE_SPACING) / 2;
export const ELEVATION_HEIGHT = 0.5; // Visual height per elevation level (Matches approx 30 deg slope)
export const INITIAL_CREDITS = 500;
export const INCOME_PER_TURN = 0; // Disabled in favor of milestone injections

export const COLORS = {
  P1: '#00ccff', // Cyan for P1
  P1_HOVER: '#99ebff',
  P2: '#ff0066', // Neon Pink for P2
  P2_HOVER: '#ff99cc',
  BG: '#050505',
  GRID_LINE: '#003300', // Dark Green
  TILE_BODY: '#0a0a0a',
  TILE_EDGE: '#00ff00', // Matrix Green
  TILE_HOVER: '#ccffcc',
  HIGHLIGHT: '#ffffff',
  PIPE_BG: '#111827',
  PIPE_BORDER: '#374151',
  HEALTH_BAR_BG: '#222222',
  PATH_HIGHLIGHT: '#ffff00',
  FROZEN_OVERLAY: '#00ffff'
};

export const BUILDING_TYPES = [
  UnitType.TITAN,
  UnitType.SERVER,
  UnitType.RESIDENTIAL,
  UnitType.SPIKE,
  UnitType.WALL,
  UnitType.TOWER,
  UnitType.CHARGING_STATION,
  UnitType.PORTAL
];

export const CHARACTERS: Character[] = [
  {
    id: 'NYX',
    name: 'Nyx',
    gender: 'FEMALE',
    description: 'Rogue bio-hacker from the upper sectors. Master of nanotech and field sustain.',
    color: '#00ff00',
    perks: [
      { level: 0, description: 'Unlock access to MEDIC units in the logistics network.', unlocksUnits: [UnitType.MEDIC] },
      { level: 10, description: 'TBD: Enhanced Repair' },
      { level: 25, description: 'TBD: Bio-Grenades' },
      { level: 50, description: 'TBD: Mass Revive' },
      { level: 100, description: 'TBD: Immortality Field' }
    ]
  },
  {
    id: 'GRIFF',
    name: 'Griff',
    gender: 'MALE',
    description: 'Hardened war vet. Believes in firepower, armor, and more firepower.',
    color: '#00ff00',
    perks: [
      { level: 0, description: 'Unlock access to RAPTOR and MAMMOTH TANKS.', unlocksUnits: [UnitType.LIGHT_TANK, UnitType.HEAVY_TANK] },
      { level: 10, description: 'TBD: Reinforced Plating' },
      { level: 25, description: 'TBD: Artillery Support' },
      { level: 50, description: 'TBD: Factory Overclock' },
      { level: 100, description: 'TBD: Nuclear Option' }
    ]
  }
];

export const CARD_CONFIG: Partial<Record<UnitType, {
  category: CardCategory,
  name: string,
  description: string,
  cost: number,
  baseStats?: { hp: number, maxEnergy: number, attack: number, range: number, movement: number, size: number, blocksLos: boolean, maxAttacks?: number }
}>> = {
  [UnitType.SOLDIER]: {
    category: CardCategory.UNIT,
    name: 'Cyber Marine',
    description: 'Versatile infantry. Ability: Teleport.',
    cost: 50,
    baseStats: { hp: 100, maxEnergy: 100, attack: 25, range: 3, movement: 4, size: 1, blocksLos: false }
  },
  [UnitType.HEAVY]: {
    category: CardCategory.UNIT,
    name: 'Dreadnought',
    description: 'Heavily armored shock trooper. Ability: Suicide Protocol.',
    cost: 150,
    baseStats: { hp: 200, maxEnergy: 0, attack: 40, range: 2, movement: 3, size: 1, blocksLos: false }
  },
  [UnitType.MEDIC]: {
    category: CardCategory.UNIT,
    name: 'Field Medic',
    description: 'Support Unit. Ability: Nano-Repair.',
    cost: 75,
    baseStats: { hp: 80, maxEnergy: 100, attack: 10, range: 2, movement: 4, size: 1, blocksLos: false }
  },
  [UnitType.LIGHT_TANK]: {
    category: CardCategory.UNIT,
    name: 'Raptor Tank',
    description: 'Fast assault vehicle.',
    cost: 200,
    baseStats: { hp: 180, maxEnergy: 0, attack: 45, range: 3, movement: 2, size: 1, blocksLos: true }
  },
  [UnitType.HEAVY_TANK]: {
    category: CardCategory.UNIT,
    name: 'Mammoth Tank',
    description: 'Heavy siege armor. Dual cannons.',
    cost: 350,
    baseStats: { hp: 450, maxEnergy: 0, attack: 80, range: 4, movement: 5, size: 2, blocksLos: true }
  },
  [UnitType.SNIPER]: {
    category: CardCategory.UNIT,
    name: 'Ghost Operative',
    description: 'Long-range precision. Passive: Ignores cover.',
    cost: 125,
    baseStats: { hp: 60, maxEnergy: 0, attack: 55, range: 6, movement: 3, size: 1, blocksLos: false }
  },
  [UnitType.BOX]: {
    category: CardCategory.UNIT,
    name: 'Scout Drone',
    description: 'Fast recon.',
    cost: 25,
    baseStats: { hp: 80, maxEnergy: 0, attack: 15, range: 1, movement: 6, size: 1, blocksLos: false }
  },
  [UnitType.SUICIDE_DRONE]: {
    category: CardCategory.UNIT,
    name: 'Tick',
    description: 'Explosive payload. Ability: Detonate.',
    cost: 40,
    baseStats: { hp: 40, maxEnergy: 0, attack: 0, range: 0, movement: 6, size: 1, blocksLos: false }
  },
  [UnitType.CONE]: {
    category: CardCategory.UNIT,
    name: 'Apex Blade',
    description: 'Melee assassin. Passive: Double Strike (Attacks twice). Ability: Summon Drones.',
    cost: 100,
    baseStats: { hp: 80, maxEnergy: 50, attack: 50, range: 1, movement: 5, size: 1, blocksLos: false, maxAttacks: 2 }
  },
  [UnitType.TITAN]: {
    category: CardCategory.UNIT,
    name: 'Titan Turret',
    description: 'Stationary defense. Passive: Splash Damage.',
    cost: 400,
    baseStats: { hp: 500, maxEnergy: 0, attack: 70, range: 4, movement: 0, size: 2, blocksLos: true }
  },
  [UnitType.SERVER]: {
    category: CardCategory.UNIT,
    name: 'Data Monolith',
    description: 'Data structure.',
    cost: 100,
    baseStats: { hp: 300, maxEnergy: 0, attack: 10, range: 2, movement: 0, size: 1, blocksLos: true }
  },
  [UnitType.RESIDENTIAL]: {
    category: CardCategory.UNIT,
    name: 'Sector Block',
    description: 'Habitation unit with floor detail.',
    cost: 150,
    baseStats: { hp: 600, maxEnergy: 0, attack: 0, range: 0, movement: 0, size: 2, blocksLos: true }
  },
  [UnitType.SPIKE]: {
    category: CardCategory.UNIT,
    name: 'Neural Spike',
    description: 'Crystalline data anchor.',
    cost: 250,
    baseStats: { hp: 450, maxEnergy: 0, attack: 40, range: 5, movement: 0, size: 2, blocksLos: true }
  },
  [UnitType.WALL]: {
    category: CardCategory.UNIT,
    name: 'Energy Wall',
    description: 'Chainable defensive barrier.',
    cost: 50,
    baseStats: { hp: 200, maxEnergy: 0, attack: 0, range: 0, movement: 0, size: 1, blocksLos: true }
  },
  [UnitType.TOWER]: {
    category: CardCategory.UNIT,
    name: 'Flux Tower',
    description: '3-story laser defense. High range.',
    cost: 300,
    baseStats: { hp: 350, maxEnergy: 0, attack: 55, range: 5, movement: 0, size: 1, blocksLos: true }
  },
  [UnitType.CHARGING_STATION]: {
    category: CardCategory.UNIT,
    name: 'Power Hub',
    description: 'Passively restores 25 Energy to adjacent units at end of turn.',
    cost: 200,
    baseStats: { hp: 300, maxEnergy: 0, attack: 0, range: 0, movement: 0, size: 1, blocksLos: true }
  },
  [UnitType.PORTAL]: {
    category: CardCategory.UNIT,
    name: 'Warp Gate',
    description: 'Indestructible teleportation beacon. 4-Tile Structure.',
    cost: 600,
    baseStats: { hp: 10000, maxEnergy: 0, attack: 0, range: 0, movement: 0, size: 2, blocksLos: true }
  },
  [UnitType.SYSTEM_FREEZE]: {
    category: CardCategory.ACTION,
    name: 'System Freeze',
    description: 'Immobilize all enemy units for 1 turn.',
    cost: 150
  },
  [UnitType.ION_CANNON]: {
    category: CardCategory.ACTION,
    name: 'Ion Cannon',
    description: 'Orbital Strike: Deals 50 damage to all units in a 3x3 area.',
    cost: 300
  }
};
