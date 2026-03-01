
import { UnitType, CardCategory, Character, UnitStats } from './types';

export const INITIAL_FIELD_SIZE = 10;
export const BOARD_SIZE = 40; // High limit for the "infinite" feel
export const TILE_SIZE = 1.0;
export const TILE_SPACING = 0.1;
export const BOARD_OFFSET = (BOARD_SIZE * (TILE_SIZE + TILE_SPACING)) / 2 - (TILE_SIZE + TILE_SPACING) / 2;
export const ELEVATION_HEIGHT = 0.5; // Visual height per elevation level (Matches approx 30 deg slope)
export const INITIAL_CREDITS = 500;
export const MAX_INVENTORY_CAPACITY = 30;
export const INCOME_PER_TURN = 0; // Disabled in favor of milestone injections

export const COLORS = {
  P1: '#00ccff', // Cyan for P1
  P1_HOVER: '#99ebff',
  P2: '#ff0066', // Neon Pink for P2
  P2_HOVER: '#ff99cc',
  NEUTRAL: '#808080', // Grey for Neutral Player
  BG: '#050505',
  GRID_LINE: '#003300', // Dark Green
  TILE_BODY: '#000000',
  TILE_TOP: '#111111',
  OBSTACLE: '#666666',
  HIGHLIGHT_MOVE: 'rgba(0, 255, 255, 0.3)',
  HIGHLIGHT_ATTACK: 'rgba(255, 0, 0, 0.3)',
  PATH: 'rgba(255, 255, 0, 0.5)',
  // Added missing colors to fix rendering
  TILE_EDGE: '#00ff00', // Neon green for visibility (opacity handled in Tile.tsx)
  HIGHLIGHT: '#00ccff', // Hover highlight
  TILE_HOVER: 'rgba(0, 204, 255, 0.1)',
  PATH_HIGHLIGHT: '#ffff00'
};

export const BUILDING_TYPES = [
  UnitType.TITAN,
  UnitType.SPIKE,
  UnitType.WALL,
  UnitType.TOWER,
  UnitType.CHARGING_STATION,
  UnitType.PORTAL,
  UnitType.ARC_PORTAL
];

// Visible in catalogue/dev mode, but excluded from normal shop + initial deck generation.
export const DEV_ONLY_UNITS: UnitType[] = [
  UnitType.PORTAL,
  UnitType.ARC_PORTAL,
  UnitType.WALL
];

export const CHARACTERS: Character[] = [
  {
    id: 'NYX',
    name: 'Nyx',
    gender: 'FEMALE',
    description: 'Battle-hardened veteran of the sector wars. Heavily augmented and more machine than human.',
    color: '#00ff00',
    perks: [
      { level: 0, description: 'Unlock access to MEDIC units in the logistics network.', unlocksUnits: [UnitType.MEDIC] },
      { level: 10, description: 'Enhanced Repair: Medics can repair buildings and heal +Level amount.' },
      { level: 25, description: 'Restore Energy: Medics can restore 50 Energy to a target unit.' },
      { level: 50, description: 'Immortality Shield: Temporary invulnerability (Cooldown: 25 turns).' },
      { level: 100, description: 'TBD: Immortality Field' }
    ],
    actions: [
      {
        id: 'NYX_SHIELD',
        name: 'Immortality Shield',
        description: 'All non-building units become invulnerable for 2 turns.',
        icon: '🛡️',
        cooldown: 25,
        currentCooldown: 0,
        minLevel: 50
      }
    ]
  },
  {
    id: 'GRIFF',
    name: 'Griff',
    gender: 'MALE',
    description: 'Heavy weapons specialist. Ex-mercenary with a penchant for high-explosive ordnance.',
    color: '#ff3300',
    perks: [
      { level: 0, description: 'Unlock access to RAPTOR and MAMMOTH TANKS.', unlocksUnits: [UnitType.LIGHT_TANK, UnitType.HEAVY_TANK] },
      { level: 10, description: 'Reinforced Plating: Tanks deal +Level damage.' },
      { level: 25, description: 'TBD: Artillery Support' },
      { level: 50, description: 'TBD: Factory Overclock' },
      { level: 100, description: 'TBD: Nuclear Option' }
    ]
  },
  {
    id: 'CYPHER',
    name: 'Cypher',
    gender: 'UNKNOWN',
    description: 'Enigmatic AI construct. Specializes in electronic warfare and drone control.',
    color: '#00ffff',
    perks: [
      { level: 0, description: 'Unlock access to HACKER units.', unlocksUnits: [UnitType.HACKER] },
      { level: 10, description: 'TBD: Signal Boost' },
      { level: 25, description: 'TBD: Botnet' },
      { level: 50, description: 'TBD: System Override' },
      { level: 100, description: 'TBD: Singularity' }
    ]
  },
  {
    id: 'KYLO',
    name: 'Kylo',
    gender: 'MALE',
    description: 'Ruthless commander. Specializes in aggressive melee tactics.',
    color: '#DC143C',
    perks: [
      { level: 0, description: 'TBD' },
      { level: 10, description: 'Overclock: Apex Blade units gain +Level Attack.' },
      { level: 25, description: 'TBD' },
      { level: 50, description: 'TBD' },
      { level: 100, description: 'TBD' }
    ]
  }
];

export const CARD_CONFIG: Record<string, { category: CardCategory, name: string, description: string, cost: number, baseStats?: Partial<UnitStats> }> = {
  [UnitType.SOLDIER]: {
    category: CardCategory.UNIT,
    name: 'Cyber Marine',
    description: 'Standard infantry. Ranged attack. Ability: Teleport.',
    cost: 50,
    baseStats: { hp: 100, maxEnergy: 50, attack: 25, range: 3, movement: 4, size: 1, blocksLos: false }
  },
  [UnitType.HEAVY]: {
    category: CardCategory.UNIT,
    name: 'Dreadnought',
    description: 'Heavy infantry. Area damage. High HP. Ability: Suicide Detonation.',
    cost: 150,
    baseStats: { hp: 300, maxEnergy: 0, attack: 40, range: 2, movement: 2, size: 1, blocksLos: true }
  },
  [UnitType.MEDIC]: {
    category: CardCategory.UNIT,
    name: 'Field Medic',
    description: 'Support unit. Heals adjacent allies. Ability: Heal Beam.',
    cost: 75,
    baseStats: { hp: 80, maxEnergy: 50, attack: 0, range: 3, movement: 4, size: 1, blocksLos: false }
  },
  [UnitType.HACKER]: {
    category: CardCategory.UNIT,
    name: 'Netrunner',
    description: 'Tech specialist. Can Hack敌 units. Ability: Mind Control.',
    cost: 120,
    baseStats: { hp: 60, maxEnergy: 100, attack: 10, range: 3, movement: 5, size: 1, blocksLos: false }
  },
  [UnitType.BOX]: {
    category: CardCategory.UNIT,
    name: 'Scout Drone',
    description: 'Fast scout. Low combat capability.',
    cost: 30,
    baseStats: { hp: 40, maxEnergy: 0, attack: 5, range: 1, movement: 8, size: 1, blocksLos: false }
  },
  [UnitType.SUICIDE_DRONE]: {
    category: CardCategory.UNIT,
    name: 'Tick',
    description: 'Explosive drone. Detonates on contact. Fast.',
    cost: 40,
    baseStats: { hp: 20, maxEnergy: 0, attack: 100, range: 1, movement: 7, size: 1, blocksLos: false }
  },
  [UnitType.LIGHT_TANK]: {
    category: CardCategory.UNIT,
    name: 'Raptor Tank',
    description: 'Light vehicle. Fast attack. Good against infantry.',
    cost: 200,
    baseStats: { hp: 300, maxEnergy: 0, attack: 35, range: 4, movement: 6, size: 1, blocksLos: true }
  },
  [UnitType.HEAVY_TANK]: {
    category: CardCategory.UNIT,
    name: 'Mammoth Tank',
    description: 'Heavy vehicle. Massive armor and firepower. Slow. 2x2.',
    cost: 450,
    baseStats: { hp: 800, maxEnergy: 0, attack: 80, range: 5, movement: 3, size: 2, blocksLos: true }
  },
  [UnitType.SNIPER]: {
    category: CardCategory.UNIT,
    name: 'Ghost Sniper',
    description: 'Elite sniper. Extreme range. Low HP. Ambush tactics.',
    cost: 120,
    baseStats: { hp: 60, maxEnergy: 25, attack: 150, range: 8, movement: 3, size: 1, blocksLos: false }
  },

  // Missing entry for CONE? Adding it based on previous glimpses
  [UnitType.CONE]: {
    category: CardCategory.UNIT,
    name: 'Apex Blade',
    description: 'Melee assassin. Passive: Double Strike (Attacks twice). Ability: Summon Drones.',
    cost: 100,
    baseStats: { hp: 80, maxEnergy: 50, attack: 50, range: 1, movement: 5, size: 1, blocksLos: false, maxAttacks: 2 }
  },
  [UnitType.REPAIR_BOT]: {
    category: CardCategory.UNIT,
    name: 'Repair Bot',
    description: 'Mobile repair unit. Can repair buildings and units.',
    cost: 100,
    baseStats: { hp: 120, maxEnergy: 50, attack: 10, range: 1, movement: 4, size: 1, blocksLos: false }
  },

  [UnitType.TITAN]: {
    category: CardCategory.UNIT,
    name: 'Titan Turret',
    description: 'Stationary defense. Passive: Splash Damage.',
    cost: 400,
    baseStats: { hp: 500, maxEnergy: 0, attack: 70, range: 4, movement: 0, size: 2, blocksLos: true }
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
  [UnitType.ARC_PORTAL]: {
    category: CardCategory.UNIT,
    name: 'Arc Portal',
    description: 'Main structure. On destruction, all of its owner\'s landing zones collapse.',
    cost: 900,
    baseStats: { hp: 3000, maxEnergy: 0, attack: 0, range: 0, movement: 0, size: 3, blocksLos: true }
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
  },
  [UnitType.FORWARD_BASE]: {
    category: CardCategory.ACTION,
    name: 'Forward Base',
    description: 'Deploy a 2x2 zone of your color in any revealed area (except enemy spawn).',
    cost: 75
  },
  [UnitType.TACTICAL_RETREAT]: {
    category: CardCategory.ACTION,
    name: 'Tactical Retreat',
    description: 'Teleport a friendly unit to the nearest empty deployment zone.',
    cost: 75
  },
  [UnitType.MASS_RETREAT]: {
    category: CardCategory.ACTION,
    name: 'Mass Retreat',
    description: 'Select a 2x2 to 4x4 area and teleport all friendly units inside it to available deployment zones.',
    cost: 150
  },
  [UnitType.LANDING_SABOTAGE]: {
    category: CardCategory.ACTION,
    name: 'Landing Sabotage',
    description: 'Disable a single enemy landing zone tile so units can no longer deploy there.',
    cost: 100
  },
  [UnitType.LOGISTICS_DELAY]: {
    category: CardCategory.ACTION,
    name: 'Logistics Delay',
    description: 'Add 3 turns to every item currently in transit from the shop.',
    cost: 100
  }
};
