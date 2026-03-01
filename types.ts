
import { ThreeElements } from '@react-three/fiber';
import React from 'react';

export enum PlayerId {
  ONE = 'P1',
  TWO = 'P2',
  NEUTRAL = 'NEUTRAL'
}

export enum CardCategory {
  UNIT = 'UNIT',
  ACTION = 'ACTION'
}

export enum AppStatus {
  MENU = 'MENU',       // Initial load, empty board
  CHARACTER_SELECTION = 'CHARACTER_SELECTION', // Choosing avatar/perks
  MAP_SELECTION = 'MAP_SELECTION', // New menu for choosing map
  PLAYING = 'PLAYING', // Active game
  PAUSED = 'PAUSED',   // In-game menu
  GAME_OVER = 'GAME_OVER',
  TALENT_SELECTION = 'TALENT_SELECTION', // New state for choosing level-up rewards
  SHOP = 'SHOP',        // Purchasing units
  CARD_CATALOGUE = 'CARD_CATALOGUE' // Viewing all cards
}

export enum UnitType {
  // Units
  SOLDIER = 'SOLDIER',
  HEAVY = 'HEAVY',   // Big Bulky Soldier
  MEDIC = 'MEDIC',   // Support Unit
  HACKER = 'HACKER', // New Hacker Unit
  BOX = 'BOX',       // Scout
  CONE = 'CONE',     // Assassin
  SUICIDE_DRONE = 'SUICIDE_DRONE', // Kamikaze Unit
  LIGHT_TANK = 'LIGHT_TANK', // 1x1 Tank
  HEAVY_TANK = 'HEAVY_TANK', // 2x2 Tank
  SNIPER = 'SNIPER', // Long-range precision unit
  REPAIR_BOT = 'REPAIR_BOT', // Mobile repair unit

  // Buildings / Immobile
  TITAN = 'TITAN',

  SPIKE = 'SPIKE',             // Neural Spike
  WALL = 'WALL',               // Energy Wall
  TOWER = 'TOWER',             // 3 Story Tower
  CHARGING_STATION = 'CHARGING_STATION', // Energy Restorer
  PORTAL = 'PORTAL',           // Indestructible Warp Gate (2x2)
  ARC_PORTAL = 'ARC_PORTAL',    // New 3x3 Portal

  // Actions
  SYSTEM_FREEZE = 'SYSTEM_FREEZE',
  ION_CANNON = 'ION_CANNON',
  FORWARD_BASE = 'FORWARD_BASE',
  TACTICAL_RETREAT = 'TACTICAL_RETREAT',
  LANDING_SABOTAGE = 'LANDING_SABOTAGE'
}

export interface Position {
  x: number;
  z: number;
}

export interface MapBounds {
  originX: number;
  originZ: number;
  width: number;
  height: number;
}

export type MapPlayerSupport = 2 | 3 | 4 | 'dev';

export interface MapMetadata {
  id: string;
  description?: string;
  players: MapPlayerSupport;
}

export interface MapPreviewData extends MapMetadata {
  terrain: Record<string, TerrainData>;
  units: Unit[];
  collectibles: Collectible[];
  mapBounds: MapBounds;
}

export interface TilePulse {
  key: string;
  kind: 'SABOTAGE';
}

export interface UnitStats {
  hp: number;
  maxHp: number;
  energy: number;     // Current Energy (Mana)
  maxEnergy: number;  // Max Energy
  attack: number;
  range: number;
  movement: number;
  size: number; // 1 for 1x1, 2 for 2x2
  blocksLos: boolean; // Does this unit block Line of Sight?
  maxAttacks: number; // Number of attacks per turn (default 1)
}

export interface Effect {
  id: string;
  name: string;
  description: string;
  icon: string; // Identifier for icon rendering
  duration: number; // Current rounds remaining
  maxDuration: number; // Starting duration
  sourceId?: string;
}

export interface Talent {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or visual placeholder
  color: string;
}

export interface CharacterPerk {
  level: number; // 0, 10, 25, 50, 100
  description: string;
  unlocksUnits?: UnitType[]; // Units added to shop
}

export interface Character {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  description: string;
  perks: CharacterPerk[];
  color: string;
  actions?: CharacterAction[];
}

export interface CharacterAction {
  id: string;
  name: string;
  description: string;
  icon: string | any;
  cooldown: number;
  currentCooldown: number;
  minLevel: number;
  minRound?: number; // Alternative to level if strictly bound to rounds
}

export interface UnitStatus {
  isDying?: boolean;
  isTeleporting?: boolean;
  isExploding?: boolean;
  healPulseAmount?: number | null;
  energyPulseAmount?: number | null;
  attackTargetId?: string | null;     // Transient: For current animation frame
  autoAttackTargetId?: string | null; // Persistent: For "Nemesis" logic
  neutralHasAttacked?: boolean;

  // Mind Control Logic
  mindControlTargetId?: string | null; // ID of the unit being controlled (on Hacker)
  originalPlayerId?: PlayerId | null;  // Original owner (on Target)

  // Turn Management
  stepsTaken: number;
  attacksUsed: number;
}

export interface Unit {
  id: string;
  playerId: PlayerId;
  position: Position;
  type: UnitType;
  color: string;
  level: number;
  rotation: number;
  stats: UnitStats;
  status: UnitStatus;
  effects: Effect[];
  movePath: Position[];
}

export interface Card {
  id: string;
  category: CardCategory;
  type: UnitType;
  name: string;
  baseStats?: Partial<UnitStats>; // Optional for Actions
  description?: string;
  cost: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  playerId?: PlayerId;
}

export type TerrainTool = 'RAMP' | 'ELEVATE' | 'LOWER' | 'DESTROY' | 'DELETE' | 'SET_P1_SPAWN' | 'SET_P2_SPAWN' | 'PLACE_COLLECTIBLE' | 'PLACE_HEALTH' | 'PLACE_ENERGY';

export type InteractionMode = 'NORMAL' | 'WALL_PLACEMENT' | 'ABILITY_SUMMON' | 'ABILITY_TELEPORT' | 'ABILITY_FREEZE' | 'ABILITY_HEAL' | 'ABILITY_RESTORE_ENERGY' | 'ABILITY_MIND_CONTROL' | 'ION_CANNON_TARGETING' | 'FORWARD_BASE_TARGETING' | 'TERRAIN_EDIT';

export interface InteractionState {
  mode: InteractionMode;
  sourceUnitId?: string; // For summon/abilities
  unitType?: UnitType; // For summon/wall
  remaining?: number;
  lastPos?: Position; // For wall adjacency
  playerId?: PlayerId;
  terrainTool?: TerrainTool; // For map editor
  terrainBrushSize?: number; // NxN brush size for map editor area tools
}

export type DebugClickResult = 'INFO' | 'ACTION' | 'REJECT';

export interface DebugPointerMeta {
  source: 'TILE' | 'UNIT' | 'SYSTEM';
  eventType?: string;
  button?: number;
  pointerType?: string;
  clientX?: number;
  clientY?: number;
}

export interface DebugClickTraceEntry {
  id: string;
  timestamp: string;
  stage: string;
  result: DebugClickResult;
  reason: string;
  mode: InteractionMode;
  tile?: Position;
  unitId?: string;
  selectedUnitId: string | null;
  selectedCardId: string | null;
  previewPathLength: number;
  previewPathEnd: Position | null;
  pointer?: DebugPointerMeta;
}

export interface TerrainData {
  type: 'NORMAL' | 'RAMP' | 'PLATFORM';
  elevation: number; // 0 is ground, 1 is one step up, etc.
  rotation: number; // 0, 1, 2, 3 (Multiples of 90 degrees)
  landingZone?: PlayerId; // If set, only this player can deploy here
}

export interface ShopItem {
  id: string;
  type: UnitType;
  cost: number;
  purchaseRound?: number;
  deliveryTurns: number; // 0 for instant, 1-3 otherwise
  isInstant?: boolean;
}

export interface Collectible {
  id: string;
  type: 'MONEY_PRIZE' | 'HEALTH_PACK' | 'ENERGY_CELL';
  value: number;
  position: Position;
}

export interface GameState {
  appStatus: AppStatus;
  mapId: string; // Identifies the current map
  lightMode: 'DARK' | 'LIGHT';
  units: Unit[];
  collectibles: Collectible[];
  revealedTiles: string[];
  terrain: Record<string, TerrainData>; // Key "x,z"
  mapBounds: MapBounds;
  deletedTiles: string[];
  currentTurn: PlayerId;
  winner: PlayerId | null;
  roundNumber: number;
  decks: { [key in PlayerId]: Card[] };
  selectedCardId: string | null;
  selectedUnitId: string | null;
  previewPath: Position[];
  // Message log for actions
  systemMessage: string | null;
  actionLog: LogEntry[];
  interactionState: InteractionState;
  tilePulse: TilePulse | null;

  // Player Level Effects
  playerEffects: { [key in PlayerId]: Effect[] };

  // Character & Talent System
  playerCharacters: { [key in PlayerId]: string | null }; // Character ID
  unlockedUnits: { [key in PlayerId]: UnitType[] }; // Pool of units available in shop
  playerTalents: { [key in PlayerId]: Talent[] };
  characterActions: { [key in PlayerId]: CharacterAction[] };
  talentChoices: Talent[]; // The two choices currently presented

  // Economy & Shop
  credits: { [key in PlayerId]: number };
  shopStock: { [key in PlayerId]: ShopItem[] }; // Items available to buy per player
  pendingOrders: { [key in PlayerId]: ShopItem[] }; // Items bought but waiting for delivery
  nextDeliveryRound: number; // 10, 25, 50, 100
  shopAvailable: boolean;
  deliveryHappened: boolean; // Flag for visual feedback
  recentlyDeliveredCardIds: { [key in PlayerId]: string[] };

  // Multiplayer
  isMultiplayer: boolean;
  roomId: string | null;
  myPlayerId: PlayerId | null; // The player ID that THIS client controls

  // Developer Mode Flag
  isDevMode: boolean;

  // Developer Diagnostics
  debugClickTrace: DebugClickTraceEntry[];
  debugLastDecision: string | null;
  debugLastHoverTile: Position | null;

  availableMaps: MapMetadata[];
}

export type GameEvent = 'PLACE_UNIT' | 'GAME_RESET' | 'SELECT_CARD' | 'SELECT_UNIT';

export interface PlacePayload {
  playerId: PlayerId;
  position: Position;
  cardId: string;
  cardType?: UnitType;
  unitId?: string;
}

// Augmentation to support R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      scene: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      lineSegments: any;
      edgesGeometry: any;
      lineBasicMaterial: any;
      meshBasicMaterial: any;
      boxGeometry: any;
      cylinderGeometry: any;
      sphereGeometry: any;
      coneGeometry: any;
      torusGeometry: any;
      icosahedronGeometry: any;
      ringGeometry: any;
      dodecahedronGeometry: any;
      gridHelper: any;
      ambientLight: any;
      pointLight: any;
      spotLight: any;
      fog: any;
      color: any;
      perspectiveCamera: any;
      octahedronGeometry: any;
      bufferGeometry: any;
      lineDashedMaterial: any;
      circleGeometry: any;
      primitive: any;
    }
  }
}
