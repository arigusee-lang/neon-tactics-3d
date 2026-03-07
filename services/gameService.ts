
import { GameState, PlayerId, Unit, PlacePayload, UnitType, Card, Position, CardCategory, LogEntry, InteractionMode, AppStatus, Effect, Talent, TerrainData, TerrainTool, ShopItem, UnitStats, DebugClickTraceEntry, DebugClickResult, DebugPointerMeta, MapBounds, MapMetadata, MapPlayerSupport, MapPreviewData, ALL_PLAYER_IDS, CONTESTED_PLAYER_IDS, MatchMode, EmptyMapConfig } from '../types';
import { BOARD_SIZE, INITIAL_FIELD_SIZE, CARD_CONFIG, INITIAL_CREDITS, INCOME_PER_TURN, TILE_SIZE, TILE_SPACING, BOARD_OFFSET, BUILDING_TYPES, COLORS, CHARACTERS, MAX_INVENTORY_CAPACITY, DEV_ONLY_UNITS, TURN_TIMER_SECONDS, NEGATIVE_UNIT_EFFECT_NAMES, getUnitClassificationLabel, FLUX_TOWER_ATTACK_UPGRADE_AMOUNT, FLUX_TOWER_ATTACK_UPGRADE_COST, FLUX_TOWER_ATTACK_UPGRADE_LEVEL_STEP, TALENT_SELECTION_LEVEL_STEP } from '../constants';
import { ENABLE_CHARACTER_SYSTEM } from '../featureFlags';
import { findPath } from '../utils/pathfinding';
import { clampTerrainBrushSize, getTerrainBrushFootprint, isBrushEnabledTerrainTool } from '../utils/terrainBrush';
import { canTraverseTerrainEdge, getStepDirection } from '../utils/terrainTraversal';
import { GoogleGenAI } from "@google/genai";

type Listener = (state: GameState) => void;

// --- TALENT POOL ---
export const TALENT_POOL: Talent[] = [
    { id: 't1', name: 'Global Nanites', description: 'Heal all friendly units on the battlefield by 100 HP immediately.', icon: '💊', color: '#10b981' },
    { id: 't2', name: 'Black Budget', description: 'Receive an immediate injection of 150 credits.', icon: '💳', color: '#facc15' },
    { id: 't3', name: 'Servo Overclock', description: 'All mobile units permanently gain +1 Mobility.', icon: '⏩', color: '#06b6d4' },
    { id: 't4', name: 'Advanced Optics', description: 'All non-melee units gain +1 Attack Range.', icon: '🔭', color: '#3b82f6' },
    { id: 't5', name: 'Biotic Regen', description: 'All non-building units gain passive 10 HP regeneration per round.', icon: '🧬', color: '#ec4899' },
    { id: 't6', name: 'Reactor Tuning', description: 'All units with Energy gain an additional 5 Energy regeneration per round.', icon: '🔋', color: '#8b5cf6' },
    { id: 't7', name: 'Kinetic Shields', description: 'All friendly non-building units gain a Kinetic Shield that absorbs 50 damage before collapsing.', icon: '🛡️', color: '#e2e8f0' },
    { id: 't8', name: 'Marine Upgrade', description: 'Cyber Marines gain +15 Attack and +1 Range.', icon: '🔫', color: '#60a5fa' },
    { id: 't9', name: 'Marine Suite', description: 'Cyber Marines gain +50 HP and +1 Mobility.', icon: '🦿', color: '#3b82f6' },
    { id: 't10', name: 'Dreadnought Offense', description: 'Dreadnoughts gain +20 Attack and +1 Range.', icon: '💥', color: '#ef4444' },
    { id: 't11', name: 'Dreadnought Armor', description: 'Dreadnoughts gain +100 HP.', icon: '🛡️', color: '#71717a' },
    { id: 't12', name: 'Drone Upgrade', description: 'Scout Drones and Ticks gain +2 Mobility and +20 HP.', icon: '🛸', color: '#f59e0b' },
    { id: 't13', name: 'Tanks Upgrade', description: 'Raptor Tanks and Mammoth Tanks gain +20 Attack and +100 HP.', icon: '🧱', color: '#f97316' },
    { id: 't14', name: 'Perk Expert', description: 'Gain $50 immediately. Starting with your next talent distribution, choose from 5 perks instead of 3.', icon: '🧠', color: '#22c55e' },
    { id: 't15', name: 'Ritual', description: 'Damage your current Arc Portal for 1500 HP and immediately gain 3 extra perk drafts.', icon: '🩸', color: '#ef4444' },
    { id: 't16', name: 'Marine Upgrade II', description: 'Requires Marine Upgrade. Cyber Marines gain another +15 Attack and +1 Range.', icon: '🎯', color: '#3b82f6', prerequisiteTalentIds: ['t8'] },
    { id: 't17', name: 'Marine Suite II', description: 'Requires Marine Suite. Cyber Marines gain another +50 HP and +1 Mobility.', icon: '🦾', color: '#2563eb', prerequisiteTalentIds: ['t9'] },
    { id: 't18', name: 'Dreadnought Offense II', description: 'Requires Dreadnought Offense. Dreadnoughts gain another +20 Attack and +1 Range.', icon: '🔥', color: '#dc2626', prerequisiteTalentIds: ['t10'] },
    { id: 't19', name: 'Dreadnought Armor II', description: 'Requires Dreadnought Armor. Dreadnoughts gain another +100 HP.', icon: '⛓️', color: '#52525b', prerequisiteTalentIds: ['t11'] },
    { id: 't20', name: 'Drone Upgrade II', description: 'Requires Drone Upgrade. Scout Drones and Ticks gain another +2 Mobility and +20 HP.', icon: '🚀', color: '#d97706', prerequisiteTalentIds: ['t12'] },
    { id: 't21', name: 'Tanks Upgrade II', description: 'Requires Tanks Upgrade. Raptor Tanks and Mammoth Tanks gain another +20 Attack and +100 HP.', icon: '🏗️', color: '#ea580c', prerequisiteTalentIds: ['t13'] },
    { id: 't22', name: 'Biotic Regen II', description: 'Requires Biotic Regen. Increase passive regeneration by another 10 HP per round.', icon: '💚', color: '#db2777', prerequisiteTalentIds: ['t5'] },
    { id: 't23', name: 'Reactor Tuning II', description: 'Requires Reactor Tuning. Increase bonus Energy regeneration by another 5 per round.', icon: '⚡', color: '#7c3aed', prerequisiteTalentIds: ['t6'] },
    { id: 't24', name: 'Reinforced Walls', description: 'Flux Towers, Power Hubs, and Energy Walls gain +100 HP.', icon: '🧱', color: '#84cc16' },
    { id: 't25', name: 'Nano Fibers', description: 'Increase Medic and Repair Bot nano-repair efficiency from 50 HP to 75 HP.', icon: '🪡', color: '#14b8a6' },
    { id: 't26', name: 'Nano Blades', description: 'Apex Blades gain +20 Attack and +20 HP.', icon: '✂️', color: '#f43f5e' },
    { id: 't27', name: 'Negotiator', description: 'Reroll stock costs $25 instead of $50, and you can sell back pending orders for 90% of their cost even while already in transit.', icon: '🤝', color: '#38bdf8' },
    { id: 't28', name: 'Rapid Deployment', description: 'Newly summoned mobile units no longer suffer Summoning Sickness.', icon: '⚔️', color: '#a78bfa' },
    { id: 't29', name: 'Portal Exchange', description: 'Convert 300 HP from your Arc Portal into $300.', icon: '💱', color: '#f59e0b' },
    { id: 't30', name: 'Economist', description: 'Gain $30 turn income instead of $20, and field pickup rewards are doubled.', icon: '📈', color: '#22c55e' },
    { id: 't31', name: 'Wormhole', description: 'Marine teleports leave temporary landing zones on source and destination tiles for 5 turns. Tactical Retreat and Mass Retreat also leave temporary landing zones on evacuated source tiles.', icon: '🌀', color: '#06b6d4' }
];

const TALENT_RULES: Record<string, Pick<Talent, 'maxPicks' | 'prerequisiteTalentIds'>> = {
    t1: { maxPicks: 99 },
    t2: { maxPicks: 99 },
    t16: { prerequisiteTalentIds: ['t8'] },
    t17: { prerequisiteTalentIds: ['t9'] },
    t18: { prerequisiteTalentIds: ['t10'] },
    t19: { prerequisiteTalentIds: ['t11'] },
    t20: { prerequisiteTalentIds: ['t12'] },
    t21: { prerequisiteTalentIds: ['t13'] },
    t22: { prerequisiteTalentIds: ['t5'] },
    t23: { prerequisiteTalentIds: ['t6'] },
    t29: { maxPicks: 99 }
};

const WORMHOLE_LANDING_ZONE_DURATION_TURNS = 5;

import { io, Socket } from 'socket.io-client';

// Map Loading
// Note: We use eager loading to get the map content synchronously at startup.
const mapModules = import.meta.glob('../maps/*.json', { eager: true });
const loadedMaps: Record<string, MapJsonShape> = {};
const importedMaps: Record<string, MapJsonShape> = {};
const importedMapIds = new Set<string>();
interface MapJsonShape {
    description?: string;
    players?: MapPlayerSupport;
    mode?: MatchMode;
    terrain?: Record<string, TerrainData>;
    units?: any[];
    collectibles?: any[];
    mapSize?: { x: number; y: number };
    size?: { x: number; y: number };
    mapOrigin?: { x: number; z: number };
    origin?: { x: number; z: number };
    deletedTiles?: string[];
}

Object.keys(mapModules).forEach(path => {
    const fileName = path.split('/').pop()?.replace('.json', '') || 'Unknown Map';
    loadedMaps[fileName] = (mapModules[path] as any).default || mapModules[path];
});

const normalizeMapPlayers = (value: unknown): MapPlayerSupport => {
    if (value === 2 || value === 3 || value === 4 || value === 'dev') {
        return value;
    }
    return 2;
};

const normalizeMatchMode = (value: unknown, players: MapPlayerSupport): MatchMode => {
    if (value === 'duel' || value === 'team_2v1' || value === 'team_2v2' || value === 'ffa') {
        return value;
    }

    if (players === 3) return 'team_2v1';
    if (players === 4) return 'team_2v2';
    return 'duel';
};

const normalizeMapDescription = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const cloneMapJson = (mapData: MapJsonShape): MapJsonShape => JSON.parse(JSON.stringify(mapData));

const getRegisteredMaps = (): Record<string, MapJsonShape> => ({
    ...loadedMaps,
    ...importedMaps
});

const getRegisteredMap = (mapId: string): MapJsonShape | undefined => importedMaps[mapId] || loadedMaps[mapId];

const buildMapMetadata = (mapId: string, mapData: MapJsonShape): MapMetadata => {
    const players = normalizeMapPlayers(mapData.players);
    return {
        id: mapId,
        description: normalizeMapDescription(mapData.description),
        players,
        mode: normalizeMatchMode(mapData.mode, players),
        isImported: importedMapIds.has(mapId),
        isMultiplayerHostable: players !== 'dev'
    };
};

const BUILT_IN_MAPS: MapMetadata[] = [
    {
        id: 'MAP_1',
        description: 'Classic starter battlefield.',
        players: 2,
        mode: 'duel',
        isMultiplayerHostable: false
    }
];

const getAvailableMaps = (): MapMetadata[] => [
    ...BUILT_IN_MAPS,
    ...Object.keys(getRegisteredMaps())
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map((mapId) => buildMapMetadata(mapId, getRegisteredMaps()[mapId]))
];

const sanitizeImportedMapIdBase = (value: string): string => {
    const base = value
        .replace(/\.json$/i, '')
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '');
    return base.length > 0 ? base : 'ImportedMap';
};

const isKnownMapId = (mapId: string): boolean => (
    BUILT_IN_MAPS.some((map) => map.id === mapId)
    || !!getRegisteredMap(mapId)
);

interface PendingStartConfig {
    mapType: string;
    isDevMode: boolean;
    customSize?: { x: number; y: number };
    emptyMapConfig?: EmptyMapConfig;
}

interface MapScenario {
    terrain: Record<string, TerrainData>;
    initialUnits: Unit[];
    initialCollectibles: any[];
    mapBounds: MapBounds;
    deletedTiles: string[];
}

interface RemoteUnitLocator {
    unitId?: string;
    playerId?: PlayerId;
    unitType?: UnitType;
    position?: Position;
}

interface ShopSyncPayload {
    playerId: PlayerId;
    credits: number;
    shopBudgetRemaining: number;
    shopStock: ShopItem[];
    pendingOrders: ShopItem[];
    deck: Card[];
    logMessage?: string;
}

const FIXED_ATTACK_IMPACT_DELAYS: Partial<Record<UnitType, number>> = {
    [UnitType.CONE]: 600
};

const PROJECTILE_ATTACK_SPEEDS: Partial<Record<UnitType, number>> = {
    [UnitType.SOLDIER]: 42,
    [UnitType.HEAVY]: 42,
    [UnitType.MEDIC]: 42,
    [UnitType.HACKER]: 42,
    [UnitType.SNIPER]: 42,
    [UnitType.BOX]: 42,
    [UnitType.REPAIR_BOT]: 42
};

const DEFAULT_PROJECTILE_ATTACK_SPEED = 32;
const SHOP_STOCK_BUDGET = 1000;
const INITIAL_DECK_BUDGET = 500;
const getFluxTowerUnlockedUpgradeCount = (level: number) =>
    Math.max(0, Math.floor(level / FLUX_TOWER_ATTACK_UPGRADE_LEVEL_STEP));

class GameService {
    private state: GameState;
    private listeners: Set<Listener> = new Set();
    private discovered: Set<string> = new Set();
    private socket: Socket | null = null;
    private turnTimerIntervalId: number | null = null;
    private authoritySocketId: string | null = null;
    private lastPreviewSignature: string | null = null;
    private lastPreviewPathKey: string = '';
    private lastPreviewBlocked = false;
    private unitCycleOrder: string[] = [];
    private unitCycleSetKey: string = '';
    private lastTabSelectionId: string | null = null;
    private pendingSyncTimeoutId: number | null = null;
    private pendingSyncDueAt = 0;
    private lastSyncSentAt = 0;
    private readonly syncMinIntervalMs = 250;
    private pendingMultiplayerMoveUnitId: string | null = null;
    private queuedAuthoritativeMoveTargets: Map<string, Position> = new Map();
    private pendingStartConfig: PendingStartConfig | null = null;
    private readonly authoritativeActions = new Set<string>([
        'SYNC_STATE',
        'ADMIN_SET_UNIT_STATS',
        'FLUX_TOWER_ATTACK_UPGRADE',
        'MOVE',
        'ATTACK',
        'SKIP_TURN',
        'TELEPORT',
        'PLACE_UNIT',
        'ION_CANNON_STRIKE',
        'FORWARD_BASE_PLACE',
        'MASS_RETREAT_EXECUTE',
        'FREEZE_TARGET',
        'HEAL_TARGET',
        'RESTORE_ENERGY_TARGET',
        'IMMORTALITY_SHIELD_TARGET',
        'DISPEL_TARGET',
        'MIND_CONTROL_TARGET',
        'MIND_CONTROL_BREAK',
        'LOGISTICS_DELAY_EXECUTE',
        'SUMMON_ACTIVATE',
        'SUMMON_PLACE',
        'WALL_CHAIN_PLACE',
        'CHARACTER_ACTION_TRIGGER',
        'SUICIDE_PROTOCOL',
        'DRONE_DETONATE',
        'SHOP_BUY',
        'SHOP_REFUND',
        'SHOP_REROLL',
        'TALENT_SELECTION_START',
        'TALENT_CHOOSE'
    ]);

    constructor() {
        this.state = this.getInitialState();
        this.connect();
        this.startTurnTimerLoop();
    }

    private startTurnTimerLoop() {
        if (this.turnTimerIntervalId !== null) return;
        this.turnTimerIntervalId = window.setInterval(() => {
            this.processTurnTimerTick();
            this.processBackgroundMovementTick();
        }, 250);
    }

    private isSyncAuthority(): boolean {
        return !!this.socket?.id && !!this.authoritySocketId && this.socket.id === this.authoritySocketId;
    }

    private updateInGameAdminState() {
        this.state.isInGameAdmin = !!this.state.hostAdminEnabled && this.isSyncAuthority();
    }

    private refreshAvailableMaps() {
        this.state.availableMaps = getAvailableMaps();
    }

    private ensureImportedMapShape(mapData: unknown): asserts mapData is MapJsonShape {
        if (!mapData || typeof mapData !== 'object' || Array.isArray(mapData)) {
            throw new Error('Imported file must contain a JSON object.');
        }

        const candidate = mapData as Record<string, unknown>;
        const hasTerrain = !!candidate.terrain && typeof candidate.terrain === 'object' && !Array.isArray(candidate.terrain);
        const hasSize = !!candidate.mapSize || !!candidate.size;

        if (!hasTerrain && !hasSize) {
            throw new Error('Imported map JSON must include terrain data or explicit mapSize.');
        }

        if (candidate.units !== undefined && !Array.isArray(candidate.units)) {
            throw new Error('Imported map JSON has an invalid units array.');
        }

        if (candidate.collectibles !== undefined && !Array.isArray(candidate.collectibles)) {
            throw new Error('Imported map JSON has an invalid collectibles array.');
        }

        const players = candidate.players;
        if (players !== undefined && players !== 2 && players !== 3 && players !== 4 && players !== 'dev') {
            throw new Error('Imported map JSON has an unsupported players value.');
        }

        const mode = candidate.mode;
        if (mode !== undefined && mode !== 'duel' && mode !== 'team_2v1' && mode !== 'team_2v2' && mode !== 'ffa') {
            throw new Error('Imported map JSON has an unsupported mode value.');
        }
    }

    private createImportedMapId(fileName: string) {
        const baseId = `Imported-${sanitizeImportedMapIdBase(fileName)}`;
        let candidate = baseId;
        let suffix = 2;

        while (isKnownMapId(candidate)) {
            candidate = `${baseId}-${suffix}`;
            suffix++;
        }

        return candidate;
    }

    private registerImportedMap(mapId: string, mapData: MapJsonShape, notify: boolean = true) {
        importedMaps[mapId] = cloneMapJson(mapData);
        importedMapIds.add(mapId);
        this.refreshAvailableMaps();
        if (notify) {
            this.notify();
        }
    }

    private syncLobbyMap(mapId?: string | null, mapData?: MapJsonShape | null) {
        if (!mapId || !mapData) return;
        this.ensureImportedMapShape(mapData);
        this.registerImportedMap(mapId, mapData, false);
    }

    public importMapJson(rawJson: string, fileName: string = 'ImportedMap.json'): MapMetadata {
        let parsed: unknown;
        try {
            parsed = JSON.parse(rawJson);
        } catch {
            throw new Error('Imported file is not valid JSON.');
        }

        this.ensureImportedMapShape(parsed);

        const importedMap = cloneMapJson(parsed);
        const mapId = this.createImportedMapId(fileName);
        const fallbackDescription = `Imported from ${fileName.replace(/\.json$/i, '')}.`;
        importedMap.description = normalizeMapDescription(importedMap.description) || fallbackDescription;

        this.registerImportedMap(mapId, importedMap);
        return buildMapMetadata(mapId, importedMap);
    }

    public getImportedMapData(mapId: string): MapJsonShape | null {
        const mapData = importedMaps[mapId];
        return mapData ? cloneMapJson(mapData) : null;
    }

    private canEditUnitStats() {
        return !this.state.isMultiplayer || this.state.isDevMode || this.state.isInGameAdmin;
    }

    private getFluxTowerAvailableUpgradeCount(unit: Unit) {
        if (unit.type !== UnitType.TOWER) return 0;

        const purchasedCount = unit.status.fluxTowerAttackUpgradesPurchased ?? 0;
        return Math.max(0, getFluxTowerUnlockedUpgradeCount(unit.level) - purchasedCount);
    }

    private resetTurnTimer(startedAt: number = Date.now()) {
        this.state.turnStartedAt = startedAt;
        this.state.turnOvertimeDamageApplied = 0;
    }

    private shouldProcessTurnTimer() {
        if (this.state.isDevMode || this.state.winner) return false;
        if (!this.isContestedPlayer(this.state.currentTurn)) return false;
        if (!this.state.activePlayerIds.includes(this.state.currentTurn)) return false;
        if (![AppStatus.PLAYING, AppStatus.SHOP, AppStatus.PAUSED].includes(this.state.appStatus)) return false;
        if (this.state.isMultiplayer && !this.isSyncAuthority()) return false;
        return true;
    }

    private applyTurnTimerDamage(playerId: PlayerId, damage: number) {
        if (damage <= 0) return;

        const portalIdx = this.state.units.findIndex((unit) =>
            unit.playerId === playerId
            && unit.type === UnitType.ARC_PORTAL
            && !unit.status.isDying
        );

        if (portalIdx === -1) return;

        const portal = this.state.units[portalIdx];
        const damageResult = this.applyDamageToUnit(portal, damage);
        const nextHp = damageResult.unit.stats.hp;

        this.state.units[portalIdx] = {
            ...damageResult.unit
        };

        if (damageResult.hpDamage > 0) {
            this.triggerDamagePulses([{ unitId: portal.id, amount: damageResult.hpDamage }]);
        }

        if (this.state.turnOvertimeDamageApplied === 0) {
            this.log(`> TURN TIMER EXPIRED: ${playerId} MAIN TAKING OVERTIME DAMAGE`, playerId);
        }

        if (damageResult.shieldAbsorbed > 0) {
            this.log(`> KINETIC SHIELD ABSORBS ${damageResult.shieldAbsorbed}${damageResult.shieldBroken ? ' AND COLLAPSES' : ''}`, playerId);
        }

        if (nextHp === 0) {
            this.state.units[portalIdx] = {
                ...this.state.units[portalIdx],
                status: {
                    ...this.state.units[portalIdx].status,
                    isDying: true
                }
            };

            window.setTimeout(() => {
                this.removeUnit(portal.id);
            }, 1500);
        }
    }

    private processTurnTimerTick() {
        if (!this.shouldProcessTurnTimer()) return;

        const overtimeMs = Date.now() - this.state.turnStartedAt - (TURN_TIMER_SECONDS * 1000);
        const overtimeDamageTarget = Math.max(0, Math.floor(overtimeMs / 1000));
        const pendingDamage = overtimeDamageTarget - this.state.turnOvertimeDamageApplied;

        if (pendingDamage <= 0) return;

        this.applyTurnTimerDamage(this.state.currentTurn, pendingDamage);
        this.state.turnOvertimeDamageApplied = overtimeDamageTarget;
        this.notify();
        this.replicateAuthoritativeState();
    }

    private getAttackImpactDelay(attacker: Unit, target: Unit): number {
        const fixedDelay = FIXED_ATTACK_IMPACT_DELAYS[attacker.type];
        if (typeof fixedDelay === 'number') {
            return fixedDelay;
        }

        const attackerCenterX = attacker.position.x + ((attacker.stats.size - 1) / 2);
        const attackerCenterZ = attacker.position.z + ((attacker.stats.size - 1) / 2);
        const targetCenterX = target.position.x + ((target.stats.size - 1) / 2);
        const targetCenterZ = target.position.z + ((target.stats.size - 1) / 2);
        const worldDistance = Math.hypot(
            targetCenterX - attackerCenterX,
            targetCenterZ - attackerCenterZ
        ) * (TILE_SIZE + TILE_SPACING);

        const projectileSpeed = PROJECTILE_ATTACK_SPEEDS[attacker.type] || DEFAULT_PROJECTILE_ATTACK_SPEED;

        const delayMs = (worldDistance / projectileSpeed) * 1000;
        return Math.max(55, Math.min(220, Math.round(delayMs)));
    }

    private createPerPlayerRecord<T>(factory: (playerId: PlayerId) => T): Record<PlayerId, T> {
        return ALL_PLAYER_IDS.reduce((acc, playerId) => {
            acc[playerId] = factory(playerId);
            return acc;
        }, {} as Record<PlayerId, T>);
    }

    private createEmptyPlayerCharacters(): Record<PlayerId, string | null> {
        return this.createPerPlayerRecord(() => null);
    }

    private isSupplyInjectionRound(round: number): boolean {
        return [10, 25, 50].includes(round);
    }

    private awardTurnStartIncome(playerId: PlayerId, round: number) {
        if (!this.isContestedPlayer(playerId) || !this.state.activePlayerIds.includes(playerId)) {
            return;
        }

        if (this.isSupplyInjectionRound(round)) {
            return;
        }

        const incomeAmount = this.getTurnIncomeAmount(playerId);
        this.state.credits[playerId] += incomeAmount;
        this.log(`> TURN INCOME: +${incomeAmount} CREDITS`, playerId);
    }

    private getBaseUnlockedUnitPool(): UnitType[] {
        return Object.keys(CARD_CONFIG).filter((key) => {
            const unitType = key as UnitType;
            if (DEV_ONLY_UNITS.includes(unitType)) {
                return false;
            }

            if (!ENABLE_CHARACTER_SYSTEM) {
                return true;
            }

            return (
                unitType !== UnitType.MEDIC &&
                unitType !== UnitType.LIGHT_TANK &&
                unitType !== UnitType.HEAVY_TANK
            );
        }) as UnitType[];
    }

    private getPlayerShortLabel(playerId: PlayerId): string {
        if (playerId === PlayerId.ONE) return 'P1';
        if (playerId === PlayerId.TWO) return 'P2';
        if (playerId === PlayerId.THREE) return 'P3';
        if (playerId === PlayerId.FOUR) return 'P4';
        return 'NEUTRAL';
    }

    private normalizeEmptyMapConfig(emptyMapConfig?: EmptyMapConfig): EmptyMapConfig {
        if (emptyMapConfig) return emptyMapConfig;
        return { players: 2, mode: 'duel' };
    }

    private getActivePlayersForMap(mapId: string, isDevMode: boolean = false, emptyMapConfig?: EmptyMapConfig): PlayerId[] {
        if (mapId === 'EMPTY') {
            const config = this.normalizeEmptyMapConfig(emptyMapConfig);
            if (config.players === 4) return [PlayerId.ONE, PlayerId.TWO, PlayerId.THREE, PlayerId.FOUR];
            if (config.players === 3) return [PlayerId.ONE, PlayerId.TWO, PlayerId.THREE];
            return [PlayerId.ONE, PlayerId.TWO];
        }

        const metadata = this.getMapMetadata(mapId);
        if (metadata.players === 4) return [PlayerId.ONE, PlayerId.TWO, PlayerId.THREE, PlayerId.FOUR];
        if (metadata.players === 3) return [PlayerId.ONE, PlayerId.TWO, PlayerId.THREE];
        return [PlayerId.ONE, PlayerId.TWO];
    }

    private getMatchModeForMap(mapId: string, emptyMapConfig?: EmptyMapConfig): MatchMode {
        if (mapId === 'EMPTY') {
            return this.normalizeEmptyMapConfig(emptyMapConfig).mode;
        }
        return this.getMapMetadata(mapId).mode;
    }

    private getSpawnToolPlayerId(terrainTool: TerrainTool): PlayerId | null {
        switch (terrainTool) {
            case 'SET_P1_SPAWN':
                return PlayerId.ONE;
            case 'SET_P2_SPAWN':
                return PlayerId.TWO;
            case 'SET_P3_SPAWN':
                return PlayerId.THREE;
            case 'SET_P4_SPAWN':
                return PlayerId.FOUR;
            default:
                return null;
        }
    }

    private isContestedPlayer(playerId: PlayerId): boolean {
        return CONTESTED_PLAYER_IDS.includes(playerId);
    }

    private arePlayersAllied(a: PlayerId, b: PlayerId): boolean {
        if (a === b) return true;
        if (!this.isContestedPlayer(a) || !this.isContestedPlayer(b)) return false;

        switch (this.state.matchMode) {
            case 'team_2v1':
            case 'team_2v2':
                return (a === PlayerId.ONE || a === PlayerId.TWO) && (b === PlayerId.ONE || b === PlayerId.TWO);
            default:
                return false;
        }
    }

    private arePlayersHostile(a: PlayerId, b: PlayerId): boolean {
        if (a === b) return false;
        if (a === PlayerId.NEUTRAL || b === PlayerId.NEUTRAL) return a !== b;
        return !this.arePlayersAllied(a, b);
    }

    private getHostilePlayers(playerId: PlayerId): PlayerId[] {
        return this.state.activePlayerIds.filter((candidate) => this.arePlayersHostile(playerId, candidate));
    }

    private getWinningPlayersForMode(survivors: PlayerId[]): PlayerId[] | null {
        if (survivors.length === 0) return null;

        switch (this.state.matchMode) {
            case 'team_2v1': {
                const alphaAlive = survivors.some((playerId) => playerId === PlayerId.ONE || playerId === PlayerId.TWO);
                const betaAlive = survivors.includes(PlayerId.THREE);
                if (alphaAlive && !betaAlive) return [PlayerId.ONE, PlayerId.TWO];
                if (!alphaAlive && betaAlive) return [PlayerId.THREE];
                return null;
            }
            case 'team_2v2': {
                const alphaAlive = survivors.some((playerId) => playerId === PlayerId.ONE || playerId === PlayerId.TWO);
                const betaAlive = survivors.some((playerId) => playerId === PlayerId.THREE || playerId === PlayerId.FOUR);
                if (alphaAlive && !betaAlive) return [PlayerId.ONE, PlayerId.TWO];
                if (!alphaAlive && betaAlive) return [PlayerId.THREE, PlayerId.FOUR];
                return null;
            }
            case 'ffa':
            case 'duel':
            default:
                return survivors.length === 1 ? [survivors[0]] : null;
        }
    }

    private getNextTurnInOrder(currentTurn: PlayerId, turnOrder: PlayerId[] = this.state.turnOrder): PlayerId {
        if (turnOrder.length === 0) return currentTurn;
        const currentIndex = turnOrder.indexOf(currentTurn);
        if (currentIndex === -1) return turnOrder[0];
        return turnOrder[(currentIndex + 1) % turnOrder.length];
    }

    private isLastTurnInOrder(playerId: PlayerId, turnOrder: PlayerId[] = this.state.turnOrder): boolean {
        return turnOrder.length > 0 && turnOrder[turnOrder.length - 1] === playerId;
    }

    private clearPendingSyncTimer() {
        if (this.pendingSyncTimeoutId !== null) {
            window.clearTimeout(this.pendingSyncTimeoutId);
            this.pendingSyncTimeoutId = null;
        }
        this.pendingSyncDueAt = 0;
    }

    private replicateAuthoritativeState(delayMs: number = 0) {
        if (!this.state.isMultiplayer || !this.isSyncAuthority()) return;

        const now = Date.now();
        const dueAt = Math.max(
            now + Math.max(0, delayMs),
            this.lastSyncSentAt + this.syncMinIntervalMs
        );

        if (this.pendingSyncTimeoutId !== null) {
            // Keep the earlier already-scheduled sync to coalesce bursts.
            if (dueAt >= this.pendingSyncDueAt) {
                return;
            }
            this.clearPendingSyncTimer();
        }

        this.pendingSyncDueAt = dueAt;
        const waitMs = Math.max(0, dueAt - now);

        this.pendingSyncTimeoutId = window.setTimeout(() => {
            this.pendingSyncTimeoutId = null;
            this.pendingSyncDueAt = 0;

            if (!this.state.isMultiplayer || !this.isSyncAuthority()) return;

            this.lastSyncSentAt = Date.now();
            this.dispatchAction('SYNC_STATE', this.buildSyncStatePayload());
        }, waitMs);
    }

    private resetMultiplayerSessionState(reason: string) {
        this.clearPendingSyncTimer();
        this.pendingMultiplayerMoveUnitId = null;
        this.queuedAuthoritativeMoveTargets.clear();
        this.authoritySocketId = null;
        this.state.roomId = null;
        this.state.lobbyMapId = null;
        this.state.lobbyPlayerCount = 0;
        this.state.lobbyMaxPlayers = 0;
        this.state.hostAdminEnabled = false;
        this.state.fogOfWarDisabled = false;
        this.state.isInGameAdmin = false;
        this.state.isMultiplayer = false;
        this.state.myPlayerId = null;
        this.state.appStatus = AppStatus.MENU;
        this.log(`> MULTIPLAYER SESSION RESET: ${reason}`);
    }

    private processQueuedAuthoritativeMove(unitId: string) {
        const target = this.queuedAuthoritativeMoveTargets.get(unitId);
        if (!target) return;

        const unit = this.state.units.find((u) => u.id === unitId);
        if (!unit || unit.movePath.length > 0) return;

        this.queuedAuthoritativeMoveTargets.delete(unitId);

        const remainingSteps = Math.max(0, this.getEffectiveMovement(unit) - unit.status.stepsTaken);
        if (remainingSteps <= 0) return;

        const occupied = this.getAllOccupiedCells(unitId);
        const path = findPath(
            unit.position,
            target,
            occupied,
            new Set(Object.keys(this.state.terrain)),
            this.state.terrain,
            unit.stats.size,
            this.state.mapBounds
        ).slice(0, remainingSteps);

        if (path.length === 0) return;

        this.state.selectedUnitId = unitId;
        this.state.previewPath = path;
        this.confirmMove(true);
    }

    private createMapBounds(originX: number, originZ: number, width: number, height: number): MapBounds {
        const safeWidth = Math.max(1, Math.min(BOARD_SIZE, Math.floor(width)));
        const safeHeight = Math.max(1, Math.min(BOARD_SIZE, Math.floor(height)));
        const maxOriginX = Math.max(0, BOARD_SIZE - safeWidth);
        const maxOriginZ = Math.max(0, BOARD_SIZE - safeHeight);

        return {
            originX: Math.max(0, Math.min(maxOriginX, Math.floor(originX))),
            originZ: Math.max(0, Math.min(maxOriginZ, Math.floor(originZ))),
            width: safeWidth,
            height: safeHeight
        };
    }

    private normalizeTileKey(key: string): string | null {
        const [rawX, rawZ] = key.split(',');
        const x = Number(rawX);
        const z = Number(rawZ);
        if (!Number.isInteger(x) || !Number.isInteger(z)) return null;
        return `${x},${z}`;
    }

    private isWithinMap(x: number, z: number, bounds: MapBounds = this.state.mapBounds): boolean {
        return (
            x >= bounds.originX &&
            x < bounds.originX + bounds.width &&
            z >= bounds.originZ &&
            z < bounds.originZ + bounds.height
        );
    }

    private getFallbackMapBounds(): MapBounds {
        const originX = Math.floor((BOARD_SIZE - INITIAL_FIELD_SIZE) / 2);
        const originZ = Math.floor((BOARD_SIZE - INITIAL_FIELD_SIZE) / 2);
        return this.createMapBounds(originX, originZ, INITIAL_FIELD_SIZE, INITIAL_FIELD_SIZE);
    }

    private inferMapBoundsFromTerrain(terrain: Record<string, TerrainData>): MapBounds {
        const keys = Object.keys(terrain);
        if (keys.length === 0) return this.getFallbackMapBounds();

        let minX = Number.POSITIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        keys.forEach((key) => {
            const normalized = this.normalizeTileKey(key);
            if (!normalized) return;
            const [x, z] = normalized.split(',').map(Number);
            if (x < minX) minX = x;
            if (z < minZ) minZ = z;
            if (x > maxX) maxX = x;
            if (z > maxZ) maxZ = z;
        });

        if (!Number.isFinite(minX) || !Number.isFinite(minZ) || !Number.isFinite(maxX) || !Number.isFinite(maxZ)) {
            return this.getFallbackMapBounds();
        }

        return this.createMapBounds(minX, minZ, (maxX - minX) + 1, (maxZ - minZ) + 1);
    }

    private resolveMapBoundsFromData(mapData: MapJsonShape, terrain: Record<string, TerrainData>): MapBounds {
        const size = mapData.mapSize || mapData.size;
        const origin = mapData.mapOrigin || mapData.origin;

        if (size?.x && size?.y) {
            const fallback = this.inferMapBoundsFromTerrain(terrain);
            return this.createMapBounds(
                origin?.x ?? fallback.originX,
                origin?.z ?? fallback.originZ,
                size.x,
                size.y
            );
        }

        return this.inferMapBoundsFromTerrain(terrain);
    }

    private collectDeletedTilesForBounds(
        mapData: MapJsonShape,
        bounds: MapBounds,
        terrain: Record<string, TerrainData>
    ): string[] {
        const explicitDeleted = new Set<string>();
        (mapData.deletedTiles || []).forEach((rawKey) => {
            const key = this.normalizeTileKey(rawKey);
            if (!key) return;
            const [x, z] = key.split(',').map(Number);
            if (!this.isWithinMap(x, z, bounds)) return;
            explicitDeleted.add(key);
        });

        const inferredDeleted: string[] = [];
        for (let x = bounds.originX; x < bounds.originX + bounds.width; x++) {
            for (let z = bounds.originZ; z < bounds.originZ + bounds.height; z++) {
                const key = `${x},${z}`;
                if (!terrain[key]) inferredDeleted.push(key);
            }
        }
        inferredDeleted.forEach((key) => explicitDeleted.add(key));
        return Array.from(explicitDeleted);
    }

    private seedInitialDiscovery(terrain: Record<string, TerrainData>, bounds: MapBounds, isDevMode: boolean) {
        this.discovered.clear();

        if (isDevMode) {
            Object.keys(terrain).forEach((key) => this.discovered.add(key));
            return;
        }

        const revealPlayer = this.state.isMultiplayer
            ? (this.state.myPlayerId || PlayerId.ONE)
            : PlayerId.ONE;

        const zoneTiles: Position[] = [];
        Object.keys(terrain).forEach((key) => {
            if (terrain[key]?.landingZone !== revealPlayer) return;
            const [x, z] = key.split(',').map(Number);
            zoneTiles.push({ x, z });
        });

        const revealRadiusAround = (origin: Position) => {
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const x = origin.x + dx;
                    const z = origin.z + dz;
                    if (!this.isWithinMap(x, z, bounds)) continue;
                    const key = `${x},${z}`;
                    if (!terrain[key]) continue;
                    this.discovered.add(key);
                }
            }
        };

        if (zoneTiles.length > 0) {
            zoneTiles.forEach(revealRadiusAround);
            return;
        }

        const fallbackCenter: Position = {
            x: bounds.originX + Math.floor(bounds.width / 2),
            z: bounds.originZ + Math.floor(bounds.height / 2)
        };
        revealRadiusAround(fallbackCenter);
    }

    private connect() {
        // production: this.socket = io(); 
        // dev: this.socket = io('http://localhost:3001');
        const url = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/';
        this.socket = io(url);

        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket?.id);
        });

        this.socket.on('lobby_state', (payload: { roomId: string; mapId?: string; mapData?: MapJsonShape | null; players: string[]; playerIds?: PlayerId[]; maxPlayers: number; started: boolean; authoritySocketId?: string; hostAdminEnabled?: boolean; fogOfWarDisabled?: boolean }) => {
            this.syncLobbyMap(payload.mapId, payload.mapData);
            this.state.roomId = payload.roomId;
            this.state.lobbyMapId = payload.mapId || null;
            this.state.lobbyPlayerCount = Array.isArray(payload.players) ? payload.players.length : 0;
            this.state.lobbyMaxPlayers = payload.maxPlayers || 0;
            this.state.hostAdminEnabled = !!payload.hostAdminEnabled;
            this.state.fogOfWarDisabled = !!payload.fogOfWarDisabled;
            this.state.isMultiplayer = true;
            this.authoritySocketId = payload.authoritySocketId || this.authoritySocketId;
            this.updateInGameAdminState();

            const mySocketId = this.socket?.id;
            const myIndex = mySocketId ? payload.players.indexOf(mySocketId) : -1;
            const resolvedPlayerId = myIndex >= 0
                ? (payload.playerIds?.[myIndex] || CONTESTED_PLAYER_IDS[myIndex] || null)
                : null;

            if (resolvedPlayerId) {
                this.state.myPlayerId = resolvedPlayerId;
            }

            if (Array.isArray(payload.playerIds) && payload.playerIds.length > 0) {
                this.state.activePlayerIds = [...payload.playerIds];
                this.state.turnOrder = [...payload.playerIds];
            }

            this.notify();
        });

        this.socket.on('lobby_created', (payload: string | { roomId: string; mapId?: string; mapData?: MapJsonShape | null; authoritySocketId?: string; hostAdminEnabled?: boolean; fogOfWarDisabled?: boolean }) => {
            const roomId = typeof payload === 'string' ? payload : payload.roomId;
            const mapId = typeof payload === 'string' ? null : (payload.mapId || null);
            const mapData = typeof payload === 'string' ? null : (payload.mapData || null);
            const authoritySocketId = typeof payload === 'string' ? null : (payload.authoritySocketId || null);
            const hostAdminEnabled = typeof payload === 'string' ? false : !!payload.hostAdminEnabled;
            const fogOfWarDisabled = typeof payload === 'string' ? false : !!payload.fogOfWarDisabled;
            this.syncLobbyMap(mapId, mapData);
            console.log('Lobby Created:', roomId, mapId ? `map=${mapId}` : '');
            this.state.roomId = roomId;
            this.state.isMultiplayer = true;
            this.state.lobbyMapId = mapId;
            this.state.hostAdminEnabled = hostAdminEnabled;
            this.state.fogOfWarDisabled = fogOfWarDisabled;
            this.state.myPlayerId = PlayerId.ONE;
            this.authoritySocketId = authoritySocketId || this.socket?.id || null;
            this.updateInGameAdminState();
            this.log(`> LOBBY ESTABLISHED: ${roomId}${mapId ? ` [${mapId}]` : ''}`, PlayerId.ONE);
            this.notify();
        });

        this.socket.on('game_start', (data: { roomId: string; players: string[]; mapId?: string; mapData?: MapJsonShape | null; authoritySocketId?: string; hostAdminEnabled?: boolean; fogOfWarDisabled?: boolean; turnOrder?: PlayerId[] }) => {
            console.log('Game Start:', data);
            this.syncLobbyMap(data.mapId, data.mapData);
            this.state.roomId = data.roomId;
            this.state.isMultiplayer = true;
            this.state.lobbyMapId = data.mapId || null;
            this.state.lobbyPlayerCount = data.players.length;
            this.state.lobbyMaxPlayers = data.turnOrder?.length || data.players.length;
            this.state.hostAdminEnabled = !!data.hostAdminEnabled;
            this.state.fogOfWarDisabled = !!data.fogOfWarDisabled;
            this.authoritySocketId = data.authoritySocketId || data.players[0] || null;
            this.updateInGameAdminState();

            // Resolve role from server socket order: fixed slot assignment follows join order.
            const mySocketId = this.socket?.id;
            const myIndex = mySocketId ? data.players.indexOf(mySocketId) : -1;
            const resolvedPlayerId = myIndex >= 0 ? CONTESTED_PLAYER_IDS[myIndex] : null;
            if (resolvedPlayerId) {
                this.state.myPlayerId = resolvedPlayerId;
            } else if (!this.state.myPlayerId) {
                // Fallback for unexpected payloads/reconnect race.
                this.state.myPlayerId = data.turnOrder?.[0] || PlayerId.ONE;
            }
            this.state.activePlayerIds = data.turnOrder ? [...data.turnOrder] : CONTESTED_PLAYER_IDS.slice(0, data.players.length);
            this.state.turnOrder = data.turnOrder ? [...data.turnOrder] : [...this.state.activePlayerIds];

            this.beginMatchSetup(data.mapId || 'MAP_1', false);
            this.log(`> MULTIPLAYER LINK ESTABLISHED. YOU ARE ${this.state.myPlayerId}`, this.state.myPlayerId!);
            this.notify();
        });

        this.socket.on('character_selection_update', (payload: { playerCharacters: Record<PlayerId, string | null> }) => {
            this.state.playerCharacters = {
                ...this.createEmptyPlayerCharacters(),
                ...(payload?.playerCharacters || {})
            };
            this.notify();
        });

        this.socket.on('character_selection_complete', (payload: { playerCharacters: Record<PlayerId, string | null> }) => {
            this.state.playerCharacters = {
                ...this.createEmptyPlayerCharacters(),
                ...(payload?.playerCharacters || {})
            };

            if (this.state.appStatus === AppStatus.CHARACTER_SELECTION) {
                this.finalizeCharacterSelection();
            } else {
                this.notify();
            }
        });

        this.socket.on('game_action', (payload: { action: string, data: any }) => {
            console.log('Received Action:', payload);
            this.handleRemoteAction(payload.action, payload.data);
        });

        this.socket.on('authoritative_command', (payload: { action: string, data: any, meta?: any }) => {
            console.log('Authoritative Command:', payload);
            if (
                payload.action === 'SYNC_STATE' &&
                payload.meta?.actorPlayerId &&
                this.state.myPlayerId &&
                payload.meta.actorPlayerId === this.state.myPlayerId
            ) {
                return;
            }

            if (payload.action !== 'SYNC_STATE' && !this.isSyncAuthority()) {
                return;
            }

            this.handleRemoteAction(payload.action, payload.data);
        });

        this.socket.on('command_rejected', (payload: { action: string, reason: string }) => {
            if (payload.action === 'MOVE') {
                this.pendingMultiplayerMoveUnitId = null;
            }
            if (payload.reason === 'ROOM_NOT_FOUND' || payload.reason === 'NOT_IN_ROOM') {
                this.resetMultiplayerSessionState(payload.reason);
            }
            this.log(`> COMMAND REJECTED [${payload.action}]: ${payload.reason}`);
            this.notify();
        });

        this.socket.on('error_message', (msg: string) => {
            alert(msg);
        });
    }

    public createLobby(mapId: string = 'MAP_1', hostAdminEnabled: boolean = false, fogOfWarDisabled: boolean = false) {
        if (this.socket) {
            this.socket.emit('create_lobby', {
                mapId,
                hostAdminEnabled,
                fogOfWarDisabled,
                mapData: this.getImportedMapData(mapId)
            });
        }
    }

    public joinLobby(roomId: string) {
        if (this.socket) {
            // Clear stale role if this client previously hosted another lobby.
            this.state.myPlayerId = null;
            this.authoritySocketId = null;
            this.state.roomId = null;
            this.state.lobbyMapId = null;
            this.state.lobbyPlayerCount = 0;
            this.state.lobbyMaxPlayers = 0;
            this.state.hostAdminEnabled = false;
            this.state.fogOfWarDisabled = false;
            this.state.isInGameAdmin = false;
            this.socket.emit('join_lobby', roomId);
        }
    }

    private leaveLobby() {
        if (!this.socket || !this.state.isMultiplayer || !this.state.roomId) return;
        this.socket.emit('leave_lobby', this.state.roomId);
    }

    private shouldUseAuthoritativeChannel(action: string): boolean {
        return this.state.isMultiplayer && this.authoritativeActions.has(action);
    }

    private dispatchAction(action: string, data: any) {
        if (this.state.isMultiplayer && this.socket) {
            if (this.shouldUseAuthoritativeChannel(action)) {
                this.socket.emit('authoritative_command_request', {
                    roomId: this.state.roomId,
                    action,
                    data
                });
            } else {
                this.socket.emit('game_action', {
                    roomId: this.state.roomId,
                    action,
                    data
                });
            }
        }
    }

    private buildSyncStatePayload() {
        return {
            terrain: this.state.terrain,
            decks: this.createPerPlayerRecord((playerId) =>
                this.state.decks[playerId].map((card) => this.cloneCardForSync(card))
            ),
            units: this.state.units.map((unit) => ({ ...unit })),
            collectibles: this.state.collectibles.map((collectible) => ({ ...collectible })),
            credits: { ...this.state.credits },
            shopBudgetRemaining: { ...this.state.shopBudgetRemaining },
            mapBounds: this.state.mapBounds,
            deletedTiles: [...this.state.deletedTiles],
            currentTurn: this.state.currentTurn,
            turnStartedAt: this.state.turnStartedAt,
            turnOvertimeDamageApplied: this.state.turnOvertimeDamageApplied,
            turnCount: this.state.turnCount,
            activePlayerIds: [...this.state.activePlayerIds],
            turnOrder: [...this.state.turnOrder],
            matchMode: this.state.matchMode,
            roundNumber: this.state.roundNumber,
            shopStock: this.createPerPlayerRecord((playerId) =>
                this.state.shopStock[playerId].map((item) => ({ ...item }))
            ),
            pendingOrders: this.createPerPlayerRecord((playerId) =>
                this.state.pendingOrders[playerId].map((item) => ({ ...item }))
            ),
            nextDeliveryRound: this.state.nextDeliveryRound,
            shopAvailable: this.state.shopAvailable,
            recentlyDeliveredCardIds: this.createPerPlayerRecord((playerId) =>
                [...this.state.recentlyDeliveredCardIds[playerId]]
            ),
            playerTalents: this.createPerPlayerRecord((playerId) =>
                this.state.playerTalents[playerId].map((talent) => ({ ...talent }))
            ),
            playerTalentDraftCounts: { ...this.state.playerTalentDraftCounts },
            characterActions: this.createPerPlayerRecord((playerId) =>
                this.state.characterActions[playerId].map((action) => ({ ...action }))
            ),
            appStatus: this.state.appStatus,
            talentChoices: this.state.talentChoices.map((talent) => ({ ...talent })),
            pendingTalentQueue: [...this.state.pendingTalentQueue],
            pendingTalentResumePlayerId: this.state.pendingTalentResumePlayerId,
            playerCharacters: { ...this.state.playerCharacters },
            unlockedUnits: this.createPerPlayerRecord((playerId) =>
                [...this.state.unlockedUnits[playerId]]
            ),
            playerEffects: this.createPerPlayerRecord((playerId) =>
                this.state.playerEffects[playerId].map((effect) => ({ ...effect }))
            ),
            interactionState: { ...this.state.interactionState },
            tilePulse: this.state.tilePulse ? { ...this.state.tilePulse } : null,
            fogOfWarDisabled: this.state.fogOfWarDisabled,
            winner: this.state.winner
        };
    }

    private handleRemoteAction(action: string, data: any) {
        // Apply the action locally without checking for "my turn" restriction
        // because we trust the server/opponent sends valid moves for their turn

        switch (action) {
            case 'ADMIN_SET_UNIT_STATS':
                this.applyUnitStatsEdit(data.unitId, data, true);
                break;
            case 'FLUX_TOWER_ATTACK_UPGRADE':
                this.purchaseFluxTowerAttackUpgrade(data.unitId, true);
                break;
            case 'MOVE': {
                const unitId = typeof data?.unitId === 'string' ? data.unitId : null;
                if (!unitId) break;

                const unit = this.state.units.find((u) => u.id === unitId);
                if (!unit) {
                    console.warn('[AUTH][MOVE][UNIT_NOT_FOUND]', {
                        unitId,
                        appStatus: this.state.appStatus,
                        unitsCount: this.state.units.length
                    });
                    break;
                }

                const normalizedPath: Position[] = Array.isArray(data?.path)
                    ? data.path
                        .map((step: any) => ({ x: Number(step?.x), z: Number(step?.z) }))
                        .filter((step: Position) => Number.isFinite(step.x) && Number.isFinite(step.z))
                        .map((step: Position) => ({ x: Math.trunc(step.x), z: Math.trunc(step.z) }))
                    : [];

                const explicitTarget = (
                    typeof data?.targetX === 'number' &&
                    Number.isFinite(data.targetX) &&
                    typeof data?.targetZ === 'number' &&
                    Number.isFinite(data.targetZ)
                )
                    ? { x: Math.trunc(data.targetX), z: Math.trunc(data.targetZ) }
                    : null;

                const fallbackTarget = explicitTarget || (normalizedPath.length > 0 ? normalizedPath[normalizedPath.length - 1] : null);

                if (unit.movePath.length > 0) {
                    if (fallbackTarget) {
                        this.queuedAuthoritativeMoveTargets.set(unitId, fallbackTarget);
                    }
                    break;
                }

                const attemptMove = (path: Position[]) => {
                    if (path.length === 0) return false;

                    const beforeSteps = this.state.units.find((u) => u.id === unitId)?.status.stepsTaken ?? 0;
                    this.state.selectedUnitId = unitId;
                    this.state.previewPath = path;
                    this.confirmMove(true);

                    const afterUnit = this.state.units.find((u) => u.id === unitId);
                    const accepted = !!afterUnit && (
                        afterUnit.movePath.length > 0 ||
                        afterUnit.status.stepsTaken > beforeSteps
                    );

                    if (!accepted) {
                        this.state.previewPath = [];
                    }

                    return accepted;
                };

                let moved = attemptMove(normalizedPath);

                // If client path was computed from stale local state, recompute from authoritative state to the intended target.
                if (!moved && fallbackTarget && unit.movePath.length === 0) {
                    const occupied = this.getAllOccupiedCells(unitId);
                    const remainingSteps = Math.max(0, this.getEffectiveMovement(unit) - unit.status.stepsTaken);
                    const authoritativePath = findPath(
                        unit.position,
                        fallbackTarget,
                        occupied,
                        new Set(Object.keys(this.state.terrain)),
                        this.state.terrain,
                        unit.stats.size,
                        this.state.mapBounds
                    ).slice(0, remainingSteps);

                    moved = attemptMove(authoritativePath);
                }

                if (!moved) {
                    const latestUnit = this.state.units.find((u) => u.id === unitId);
                    console.warn('[AUTH][MOVE][LOCAL_REJECT]', {
                        unitId,
                        appStatus: this.state.appStatus,
                        unitPosition: latestUnit ? { ...latestUnit.position } : null,
                        stepsTaken: latestUnit?.status?.stepsTaken ?? null,
                        movement: latestUnit ? this.getEffectiveMovement(latestUnit) : null,
                        normalizedPathLength: normalizedPath.length,
                        fallbackTarget
                    });
                    this.state.previewPath = [];
                } else {
                    this.queuedAuthoritativeMoveTargets.delete(unitId);
                }
                break;
            }
            case 'ATTACK':
                this.attackUnit(data.attackerId, data.targetId, true);
                break;
            case 'TELEPORT':
                this.applyTeleport(data.sourceUnitId, data.x, data.z, true);
                break;
            case 'ION_CANNON_STRIKE':
                this.handleIonCannonStrike(data.x, data.z, true, data.playerId);
                break;
            case 'FORWARD_BASE_PLACE':
                this.handleForwardBasePlacement(data.x, data.z, true, data.playerId);
                break;
            case 'MASS_RETREAT_EXECUTE':
                this.handleMassRetreat(data.x, data.z, true, data.playerId, data.size);
                break;
            case 'FREEZE_TARGET':
                this.handleFreezeTarget(data.targetUnitId, true, data.sourceUnitId);
                break;
            case 'HEAL_TARGET':
                this.handleHealTarget(data.targetUnitId, true, data.sourceUnitId);
                break;
            case 'RESTORE_ENERGY_TARGET':
                this.handleRestoreEnergyTarget(data.targetUnitId, true, data.sourceUnitId);
                break;
            case 'IMMORTALITY_SHIELD_TARGET':
                this.handleImmortalityShieldTarget(data.targetUnitId, true, data.playerId);
                break;
            case 'DISPEL_TARGET':
                this.handleDispelTarget(data.targetUnitId, true, data.sourceUnitId);
                break;
            case 'MIND_CONTROL_TARGET':
                this.handleMindControlTarget(data.targetUnitId, true, data.sourceUnitId);
                break;
            case 'MIND_CONTROL_BREAK':
                this.breakMindControl(data.hackerId);
                break;
            case 'LOGISTICS_DELAY_EXECUTE':
                this.applyLogisticsDelay(data.playerId, true);
                break;
            case 'SUMMON_ACTIVATE':
                this.activateSummonAbility(data.unitId, true);
                break;
            case 'SUMMON_PLACE':
                this.handleSummonPlacement(data.x, data.z, true, data.unitId);
                break;
            case 'WALL_CHAIN_PLACE':
                this.handleWallChainPlacement(data.x, data.z, true, data.unitId);
                break;
            case 'CHARACTER_ACTION_TRIGGER':
                this.triggerCharacterAction(data.actionId, true);
                break;
            case 'SUICIDE_PROTOCOL':
                this.triggerSuicide(data.unitId, true, data);
                break;
            case 'DRONE_DETONATE':
                this.triggerDroneExplosion(data.unitId, true, data);
                break;
            case 'SKIP_TURN':
                this.skipTurn(true);
                break;
            case 'PLACE_UNIT':
                this.emitPlaceUnit(data, true);
                break;
            case 'SHOP_BUY':
            case 'SHOP_REFUND':
            case 'SHOP_REROLL':
                this.applyShopSyncPayload(data);
                break;
            case 'TALENT_SELECTION_START':
                this.triggerTalentSelection(data.playerId, true, data.choices);
                break;
            case 'TALENT_CHOOSE': {
                const chosenTalent = this.state.talentChoices.find(t => t.id === data.talentId);
                if (chosenTalent) {
                    this.chooseTalent(chosenTalent, true, data.playerId);
                }
                break;
            }
            case 'SYNC_STATE':
                // Overwrite critical state parts
                const previousAppStatus = this.state.appStatus;
                const syncedCurrentTurn = data.currentTurn || this.state.currentTurn;
                const syncedAppStatus = data.appStatus || this.state.appStatus;
                const syncedShopAvailable = typeof data.shopAvailable === 'boolean'
                    ? data.shopAvailable
                    : this.state.shopAvailable;
                this.state.terrain = data.terrain;
                this.state.decks = data.decks;
                this.state.credits = data.credits;
                if (data.shopBudgetRemaining) {
                    this.state.shopBudgetRemaining = data.shopBudgetRemaining;
                }
                this.state.collectibles = data.collectibles || [];
                if (data.mapBounds) {
                    this.state.mapBounds = data.mapBounds;
                }
                this.state.deletedTiles = data.deletedTiles || [];
                if (data.currentTurn) {
                    this.state.currentTurn = data.currentTurn;
                }
                if (typeof data.turnStartedAt === 'number') {
                    this.state.turnStartedAt = data.turnStartedAt;
                }
                if (typeof data.turnOvertimeDamageApplied === 'number') {
                    this.state.turnOvertimeDamageApplied = data.turnOvertimeDamageApplied;
                }
                if (typeof data.turnCount === 'number') {
                    this.state.turnCount = data.turnCount;
                }
                if (Array.isArray(data.activePlayerIds)) {
                    this.state.activePlayerIds = [...data.activePlayerIds];
                }
                if (Array.isArray(data.turnOrder)) {
                    this.state.turnOrder = [...data.turnOrder];
                }
                if (data.matchMode) {
                    this.state.matchMode = data.matchMode;
                }
                if (typeof data.roundNumber === 'number') {
                    this.state.roundNumber = data.roundNumber;
                }
                if (data.shopStock) {
                    this.state.shopStock = data.shopStock;
                }
                if (data.pendingOrders) {
                    this.state.pendingOrders = data.pendingOrders;
                }
                if (typeof data.nextDeliveryRound === 'number') {
                    this.state.nextDeliveryRound = data.nextDeliveryRound;
                }
                if (typeof data.shopAvailable === 'boolean') {
                    this.state.shopAvailable = data.shopAvailable;
                }
                if (data.recentlyDeliveredCardIds) {
                    this.state.recentlyDeliveredCardIds = data.recentlyDeliveredCardIds;
                }
                if (data.playerTalents) {
                    this.state.playerTalents = data.playerTalents;
                }
                if (data.playerTalentDraftCounts) {
                    this.state.playerTalentDraftCounts = data.playerTalentDraftCounts;
                }
                if (Array.isArray(data.talentChoices)) {
                    this.state.talentChoices = data.talentChoices;
                }
                if (Array.isArray(data.pendingTalentQueue)) {
                    this.state.pendingTalentQueue = [...data.pendingTalentQueue];
                }
                this.state.pendingTalentResumePlayerId = data.pendingTalentResumePlayerId || null;
                if (data.characterActions) {
                    this.state.characterActions = data.characterActions;
                }
                if (data.playerCharacters) {
                    this.state.playerCharacters = data.playerCharacters;
                }
                if (data.unlockedUnits) {
                    this.state.unlockedUnits = data.unlockedUnits;
                }
                if (data.playerEffects) {
                    this.state.playerEffects = data.playerEffects;
                }
                this.state.tilePulse = data.tilePulse ? { ...data.tilePulse } : null;
                if (typeof data.fogOfWarDisabled === 'boolean') {
                    this.state.fogOfWarDisabled = data.fogOfWarDisabled;
                }
                if (typeof data.winner !== 'undefined') {
                    this.state.winner = data.winner;
                }

                const shouldKeepLocalShopOpen = this.state.isMultiplayer
                    && !!this.state.myPlayerId
                    && previousAppStatus === AppStatus.SHOP
                    && (syncedAppStatus === AppStatus.SHOP || syncedAppStatus === AppStatus.PLAYING)
                    && syncedCurrentTurn === this.state.myPlayerId
                    && (syncedShopAvailable || this.state.isDevMode)
                    && !data.winner;
                const shouldIgnoreRemoteShopOpen = this.state.isMultiplayer
                    && !!this.state.myPlayerId
                    && syncedAppStatus === AppStatus.SHOP
                    && previousAppStatus !== AppStatus.SHOP;
                this.state.appStatus = shouldKeepLocalShopOpen
                    ? AppStatus.SHOP
                    : shouldIgnoreRemoteShopOpen
                        ? AppStatus.PLAYING
                        : syncedAppStatus;

                const syncedInteractionState = data.interactionState
                    ? { ...data.interactionState }
                    : { mode: 'NORMAL' };
                const shouldApplyInteractionState = !this.state.isMultiplayer
                    || !this.state.myPlayerId
                    || this.state.currentTurn === this.state.myPlayerId;
                const previouslySelectedUnitId = this.state.selectedUnitId;

                // Merge units? Or overwrite? 
                // Initial sync should overwrite.
                this.state.units = data.units.map((u: any) => ({ ...u })); // Deepish copy
                if (this.pendingMultiplayerMoveUnitId) {
                    const pendingUnit = this.state.units.find((unit) => unit.id === this.pendingMultiplayerMoveUnitId);
                    if (!pendingUnit || pendingUnit.movePath.length === 0) {
                        this.pendingMultiplayerMoveUnitId = null;
                    }
                }
                const preservedSelectedUnit = previouslySelectedUnitId
                    ? this.state.units.find((unit) => unit.id === previouslySelectedUnitId)
                    : null;
                const canPreserveSelection =
                    !!preservedSelectedUnit &&
                    shouldApplyInteractionState &&
                    syncedInteractionState.mode === 'NORMAL' &&
                    (
                        !this.state.isMultiplayer
                        || !this.state.myPlayerId
                        || preservedSelectedUnit.playerId === this.state.myPlayerId
                    );

                this.state.selectedUnitId = canPreserveSelection ? preservedSelectedUnit.id : null;
                this.state.selectedCardId = canPreserveSelection
                    ? null
                    : (shouldApplyInteractionState && syncedInteractionState.mode === 'NORMAL'
                        ? this.state.decks[this.state.currentTurn][0]?.id || null
                        : null);
                this.state.previewPath = [];
                this.state.interactionState = shouldApplyInteractionState
                    ? syncedInteractionState
                    : { mode: 'NORMAL' };
                this.notify();
                break;
        }

        if (action !== 'SYNC_STATE' && action !== 'ADMIN_SET_UNIT_STATS') {
            this.replicateAuthoritativeState();
        }
    }

    private getInitialState(): GameState {
        this.discovered.clear();
        const mapBounds = this.getFallbackMapBounds();

        // Default discovered area for main menu background
        for (let x = mapBounds.originX; x < mapBounds.originX + mapBounds.width; x++) {
            for (let z = mapBounds.originZ; z < mapBounds.originZ + mapBounds.height; z++) {
                this.discovered.add(`${x},${z}`);
            }
        }

        const initialLog: LogEntry = {
            id: 'init',
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            message: "SYSTEM BOOT SEQUENCE INITIATED...",
        };

        const baseUnlocks = this.getBaseUnlockedUnitPool();
        const activePlayerIds = [PlayerId.ONE, PlayerId.TWO];

        return {
            appStatus: AppStatus.MENU,
            mapId: 'EMPTY',
            lightMode: 'DARK',
            showUnitNameLabels: false,
            showUnitLevelLabels: false,
            currentTurn: PlayerId.ONE,
            activePlayerIds,
            turnOrder: [...activePlayerIds],
            matchMode: 'duel',
            winner: null,
            roundNumber: 1,
            turnCount: 1,
            turnStartedAt: Date.now(),
            turnOvertimeDamageApplied: 0,
            units: [],
            collectibles: [],
            revealedTiles: Array.from(this.discovered),
            terrain: {},
            mapBounds,
            deletedTiles: [],
            decks: this.createPerPlayerRecord(() => []),
            selectedCardId: null,
            selectedUnitId: null,
            previewPath: [],
            systemMessage: "WAITING FOR START COMMAND",
            actionLog: [initialLog],
            interactionState: { mode: 'NORMAL' },
            tilePulse: null,
            playerEffects: this.createPerPlayerRecord(() => []),
            playerTalents: this.createPerPlayerRecord(() => []),
            playerTalentDraftCounts: this.createPerPlayerRecord(() => 3),
            characterActions: this.createPerPlayerRecord(() => []),
            talentChoices: [],
            pendingTalentQueue: [],
            pendingTalentResumePlayerId: null,

            // Character System
            playerCharacters: this.createEmptyPlayerCharacters(),
            unlockedUnits: this.createPerPlayerRecord((playerId) =>
                playerId === PlayerId.NEUTRAL ? [] : [...baseUnlocks]
            ),

            // Shop Init
            credits: this.createPerPlayerRecord((playerId) => playerId === PlayerId.NEUTRAL ? 0 : INITIAL_CREDITS),
            shopBudgetRemaining: this.createPerPlayerRecord((playerId) => playerId === PlayerId.NEUTRAL ? 0 : SHOP_STOCK_BUDGET),
            shopStock: this.createPerPlayerRecord(() => []),
            pendingOrders: this.createPerPlayerRecord(() => []),
            nextDeliveryRound: 10,
            shopAvailable: true,
            deliveryHappened: false,
            recentlyDeliveredCardIds: this.createPerPlayerRecord(() => []),
            isDevMode: false,
            debugClickTrace: [],
            debugLastDecision: null,
            debugLastHoverTile: null,

            // Multiplayer
            roomId: null,
            isMultiplayer: false,
            lobbyMapId: null,
            lobbyPlayerCount: 0,
            lobbyMaxPlayers: 0,
            hostAdminEnabled: false,
            fogOfWarDisabled: false,
            isInGameAdmin: false,
            myPlayerId: null,
            availableMaps: getAvailableMaps()
        };
    }

    public exportMap() {
        if (!this.state.isDevMode) {
            this.log("> ACCESS DENIED. DEV MODE REQUIRED.");
            return;
        }

        const deletedSet = new Set<string>(this.state.deletedTiles);
        const { mapBounds } = this.state;
        for (let x = mapBounds.originX; x < mapBounds.originX + mapBounds.width; x++) {
            for (let z = mapBounds.originZ; z < mapBounds.originZ + mapBounds.height; z++) {
                const key = `${x},${z}`;
                if (!this.state.terrain[key]) {
                    deletedSet.add(key);
                }
            }
        }

        const mapData = {
            players: this.state.activePlayerIds.length as MapPlayerSupport,
            mode: this.state.matchMode,
            mapSize: { x: this.state.mapBounds.width, y: this.state.mapBounds.height },
            mapOrigin: { x: this.state.mapBounds.originX, z: this.state.mapBounds.originZ },
            deletedTiles: Array.from(deletedSet),
            terrain: Object.fromEntries(
                Object.entries(this.state.terrain).map(([key, tile]) => [
                    key,
                    {
                        type: tile.type,
                        elevation: tile.elevation,
                        rotation: tile.rotation,
                        landingZone: typeof tile.temporaryLandingZoneExpiresAtTurn === 'number'
                            ? tile.temporaryLandingZoneOriginalOwner
                            : tile.landingZone
                    }
                ])
            ),
            units: this.state.units.map(u => ({
                id: u.id,
                playerId: u.playerId,
                position: u.position,
                type: u.type,
                rotation: u.rotation,
                level: u.level,
                status: u.status.dropsPerkCacheOnDeath
                    ? { dropsPerkCacheOnDeath: true }
                    : undefined
            })),
            collectibles: this.state.collectibles
        };

        const jsonString = JSON.stringify(mapData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `map_export_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.log("> MAP DATA EXPORTED. CHECK DOWNLOADS FOLDER.");
    }

    // --- PUBLIC HELPERS ---

    public async generateCharacterAvatar(charName: string, description: string, size: '1K' | '2K' | '4K'): Promise<string | null> {
        if ((window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await (window as any).aistudio.openSelectKey();
            }
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: [
                    {
                        text: `A high quality, cinematic portrait of a sci-fi character named ${charName}. ${description}. Cyberpunk style, neon lighting, detailed face, futuristic armor or clothing. Close up shot.`,
                    },
                ],
                config: {
                    imageConfig: {
                        aspectRatio: "1:1",
                        imageSize: size
                    }
                },
            });

            if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
        } catch (e: any) {
            console.error("Avatar generation failed", e);
            if (e.toString().includes("Requested entity was not found") && (window as any).aistudio) {
                await (window as any).aistudio.openSelectKey();
            }
        }
        return null;
    }

    public getCard(cardId: string): Card | undefined {
        const deck = this.state.decks[this.state.currentTurn];
        return deck.find(c => c.id === cardId);
    }

    private checkPlayerRestricted(playerId: PlayerId): boolean {
        if (this.state.appStatus !== AppStatus.PLAYING) return true;
        if (this.state.winner) return true;

        // Multiplayer Check
        if (this.state.isMultiplayer) {
            if (this.state.myPlayerId !== playerId) return true; // Can't move opponent's units
        }

        if (this.state.currentTurn !== playerId && !this.state.isDevMode) return true;
        return false;
    }

    private hasPlayerEffect(playerId: PlayerId, effectName: string): boolean {
        return this.state.playerEffects[playerId].some((effect) => effect.name === effectName);
    }

    private isPlayerSilenced(playerId: PlayerId): boolean {
        return this.hasPlayerEffect(playerId, 'SILENCE');
    }

    private checkCardPlayRestricted(playerId: PlayerId): boolean {
        if (this.isPlayerSilenced(playerId)) {
            this.log(`> SILENCE ACTIVE: CARD SYSTEMS OFFLINE`, playerId);
            return true;
        }

        return false;
    }

    private getTurnStartSelectedCardId(playerId: PlayerId): string | null {
        if (this.isPlayerSilenced(playerId)) return null;
        return this.state.decks[playerId]?.[0]?.id || null;
    }

    private checkUnitFrozen(unit: Unit): boolean {
        return unit.effects.some(e => e.name === 'CRYO STASIS' || e.name === 'SYSTEM FREEZE');
    }

    private getNegativeEffects(unit: Unit): Effect[] {
        return unit.effects.filter((effect) => NEGATIVE_UNIT_EFFECT_NAMES.includes(effect.name as typeof NEGATIVE_UNIT_EFFECT_NAMES[number]));
    }

    private hasNegativeEffects(unit: Unit): boolean {
        return this.getNegativeEffects(unit).length > 0;
    }

    private hasMobilitySabotage(unit: Unit): boolean {
        return unit.effects.some((effect) => effect.name === 'MOBILITY SABOTAGE');
    }

    private hasMobilityBoost(unit: Unit): boolean {
        return unit.effects.some((effect) => effect.name === 'MOBILITY BOOST');
    }

    private hasBleed(unit: Unit): boolean {
        return unit.effects.some((effect) => effect.name === 'BLEED');
    }

    private isDroneUnit(unit: Unit): boolean {
        return unit.type === UnitType.BOX || unit.type === UnitType.SUICIDE_DRONE;
    }

    private getKineticShieldEffect(unit: Unit): Effect | undefined {
        return unit.effects.find((effect) => effect.name === 'KINETIC SHIELD');
    }

    public getEffectiveMovement(unit: Unit): number {
        const mobilityBonus = this.hasMobilityBoost(unit) ? 3 : 0;
        const mobilityPenalty = this.hasMobilitySabotage(unit) ? 2 : 0;
        const movement = Math.max(0, unit.stats.movement + mobilityBonus - mobilityPenalty);
        if (unit.effects.some((effect) => effect.name === 'SUMMONING SICKNESS')) {
            return Math.floor(movement / 2);
        }
        return movement;
    }

    public getEffectiveAttack(unit: Unit): number {
        if (unit.effects.some((effect) => effect.name === 'SUMMONING SICKNESS')) {
            return Math.floor(unit.stats.attack / 2);
        }
        return unit.stats.attack;
    }

    private getAttackDamage(attacker: Unit, target: Unit): number {
        const baseDamage = this.getEffectiveAttack(attacker);
        const distance = this.getUnitFootprintDistance(attacker, target);

        if (attacker.type === UnitType.SNIPER && distance >= 7 && distance <= 8) {
            return baseDamage * 2;
        }

        return baseDamage;
    }

    private createMobilitySabotageEffect(unitId: string, existingEffectId?: string): Effect {
        return {
            id: existingEffectId ?? `ue-${unitId}-${Date.now()}-${Math.random()}`,
            name: 'MOBILITY SABOTAGE',
            description: '-2 Mobility for 3 turns.',
            icon: 'mobility_sabotage',
            duration: 3,
            maxDuration: 3
        };
    }

    private createMobilityBoostEffect(unitId: string, existingEffectId?: string): Effect {
        return {
            id: existingEffectId ?? `ue-${unitId}-${Date.now()}-${Math.random()}`,
            name: 'MOBILITY BOOST',
            description: '+3 Mobility until end of turn.',
            icon: 'mobility_boost',
            duration: 1,
            maxDuration: 1
        };
    }

    private createBleedEffect(unitId: string, existingEffectId?: string): Effect {
        return {
            id: existingEffectId ?? `ue-${unitId}-${Date.now()}-${Math.random()}`,
            name: 'BLEED',
            description: 'Suffers 3 damage after each tile moved for 3 turns.',
            icon: 'bleed',
            duration: 3,
            maxDuration: 3
        };
    }

    private createSummoningSicknessEffect(unitId: string, existingEffectId?: string): Effect {
        return {
            id: existingEffectId ?? `ue-${unitId}-${Date.now()}-${Math.random()}`,
            name: 'SUMMONING SICKNESS',
            description: 'Mobility is halved this turn after deployment.',
            icon: 'summoning_sickness',
            duration: 1,
            maxDuration: 1
        };
    }

    private createSilenceEffect(existingEffectId?: string): Effect {
        return {
            id: existingEffectId ?? `pe-silence-${Date.now()}-${Math.random()}`,
            name: 'SILENCE',
            description: 'Cannot summon units or use action cards this turn.',
            icon: 'silence',
            duration: 1,
            maxDuration: 1
        };
    }

    private applyMobilitySabotageEffect(unitId: string) {
        const unitIndex = this.state.units.findIndex((unit) => unit.id === unitId);
        if (unitIndex === -1) return;

        const unit = this.state.units[unitIndex];
        const existingEffect = unit.effects.find((effect) => effect.name === 'MOBILITY SABOTAGE');
        const refreshedEffect = this.createMobilitySabotageEffect(unitId, existingEffect?.id);
        const updatedUnit: Unit = {
            ...unit,
            effects: existingEffect
                ? unit.effects.map((effect) => effect.name === 'MOBILITY SABOTAGE' ? refreshedEffect : effect)
                : [...unit.effects, refreshedEffect]
        };

        const newUnits = [...this.state.units];
        newUnits[unitIndex] = updatedUnit;
        this.state.units = newUnits;

        this.log(`> EFFECT APPLIED TO UNIT: ${refreshedEffect.name}`);
    }

    private applyMobilityBoostEffect(unitId: string) {
        const unitIndex = this.state.units.findIndex((unit) => unit.id === unitId);
        if (unitIndex === -1) return;

        const unit = this.state.units[unitIndex];
        const existingEffect = unit.effects.find((effect) => effect.name === 'MOBILITY BOOST');
        const refreshedEffect = this.createMobilityBoostEffect(unitId, existingEffect?.id);
        const updatedUnit: Unit = {
            ...unit,
            effects: existingEffect
                ? unit.effects.map((effect) => effect.name === 'MOBILITY BOOST' ? refreshedEffect : effect)
                : [...unit.effects, refreshedEffect]
        };

        const newUnits = [...this.state.units];
        newUnits[unitIndex] = updatedUnit;
        this.state.units = newUnits;

        this.log(`> EFFECT APPLIED TO UNIT: ${refreshedEffect.name}`);
    }

    private applyBleedEffect(unitId: string) {
        const unitIndex = this.state.units.findIndex((unit) => unit.id === unitId);
        if (unitIndex === -1) return;

        const unit = this.state.units[unitIndex];
        const existingEffect = unit.effects.find((effect) => effect.name === 'BLEED');
        const refreshedEffect = this.createBleedEffect(unitId, existingEffect?.id);
        const updatedUnit: Unit = {
            ...unit,
            effects: existingEffect
                ? unit.effects.map((effect) => effect.name === 'BLEED' ? refreshedEffect : effect)
                : [...unit.effects, refreshedEffect]
        };

        const newUnits = [...this.state.units];
        newUnits[unitIndex] = updatedUnit;
        this.state.units = newUnits;

        this.log(`> EFFECT APPLIED TO UNIT: ${refreshedEffect.name}`);
    }

    private applySilenceEffect(playerId: PlayerId) {
        const existingEffect = this.state.playerEffects[playerId].find((effect) => effect.name === 'SILENCE');
        const refreshedEffect = this.createSilenceEffect(existingEffect?.id);

        this.state.playerEffects[playerId] = existingEffect
            ? this.state.playerEffects[playerId].map((effect) => effect.name === 'SILENCE' ? refreshedEffect : effect)
            : [...this.state.playerEffects[playerId], refreshedEffect];

        this.log(`> EFFECT APPLIED TO [${this.getPlayerShortLabel(playerId)}]: ${refreshedEffect.name}`);
    }

    private createImmortalityShieldEffect(unitId: string): Effect {
        return {
            id: `eff-${unitId}-${Date.now()}`,
            name: 'IMMORTALITY_SHIELD',
            description: 'Invulnerable to damage',
            icon: '🛡️',
            duration: 2,
            maxDuration: 2
        };
    }

    private createKineticShieldEffect(unitId: string, existingEffectId?: string, strength: number = 50): Effect {
        return {
            id: existingEffectId ?? `eff-${unitId}-kinetic-${Date.now()}`,
            name: 'KINETIC SHIELD',
            description: 'Absorbs 50 damage before collapsing.',
            icon: 'kinetic_shield',
            duration: 1,
            maxDuration: 1,
            strength,
            maxStrength: 50
        };
    }

    private applyImmortalityShield(unit: Unit): Unit {
        return {
            ...unit,
            effects: [
                ...unit.effects.filter((effect) => effect.name !== 'IMMORTALITY_SHIELD'),
                this.createImmortalityShieldEffect(unit.id)
            ]
        };
    }

    private applyKineticShield(unit: Unit, strength: number = 50): Unit {
        if (BUILDING_TYPES.includes(unit.type)) {
            return {
                ...unit,
                effects: unit.effects.filter((effect) => effect.name !== 'KINETIC SHIELD')
            };
        }

        const existingEffect = this.getKineticShieldEffect(unit);
        const refreshedEffect = this.createKineticShieldEffect(unit.id, existingEffect?.id, strength);

        return {
            ...unit,
            effects: existingEffect
                ? unit.effects.map((effect) => effect.name === 'KINETIC SHIELD' ? refreshedEffect : effect)
                : [...unit.effects, refreshedEffect]
        };
    }

    private applyDamageToUnit(unit: Unit, incomingDamage: number): {
        unit: Unit;
        hpDamage: number;
        shieldAbsorbed: number;
        shieldRemaining: number;
        shieldBroken: boolean;
        wasInvulnerable: boolean;
    } {
        if (incomingDamage <= 0) {
            return {
                unit,
                hpDamage: 0,
                shieldAbsorbed: 0,
                shieldRemaining: 0,
                shieldBroken: false,
                wasInvulnerable: false
            };
        }

        if (this.isInvulnerable(unit)) {
            return {
                unit,
                hpDamage: 0,
                shieldAbsorbed: 0,
                shieldRemaining: 0,
                shieldBroken: false,
                wasInvulnerable: true
            };
        }

        let nextUnit = unit;
        let remainingDamage = incomingDamage;
        let shieldAbsorbed = 0;
        let shieldRemaining = 0;
        let shieldBroken = false;

        const kineticShield = this.getKineticShieldEffect(nextUnit);
        if (kineticShield) {
            const currentShield = Math.max(0, kineticShield.strength ?? kineticShield.maxStrength ?? 50);
            shieldAbsorbed = Math.min(currentShield, remainingDamage);
            remainingDamage -= shieldAbsorbed;
            shieldRemaining = Math.max(0, currentShield - shieldAbsorbed);
            shieldBroken = shieldAbsorbed > 0 && shieldRemaining === 0;

            nextUnit = {
                ...nextUnit,
                effects: shieldRemaining > 0
                    ? nextUnit.effects.map((effect) => effect.name === 'KINETIC SHIELD'
                        ? this.createKineticShieldEffect(nextUnit.id, effect.id, shieldRemaining)
                        : effect)
                    : nextUnit.effects.filter((effect) => effect.name !== 'KINETIC SHIELD')
            };
        }

        const hpDamage = Math.min(nextUnit.stats.hp, remainingDamage);
        if (hpDamage > 0) {
            nextUnit = {
                ...nextUnit,
                stats: {
                    ...nextUnit.stats,
                    hp: Math.max(0, nextUnit.stats.hp - remainingDamage)
                }
            };
        }

        return {
            unit: nextUnit,
            hpDamage,
            shieldAbsorbed,
            shieldRemaining,
            shieldBroken,
            wasInvulnerable: false
        };
    }

    private applyRitualPortalDamage(playerId: PlayerId, damage: number): boolean {
        const portalIdx = this.state.units.findIndex((unit) =>
            unit.playerId === playerId &&
            unit.type === UnitType.ARC_PORTAL &&
            !unit.status.isDying
        );

        if (portalIdx === -1) {
            this.log(`> RITUAL FAILED: ARC PORTAL NOT FOUND`, playerId);
            return false;
        }

        const portal = this.state.units[portalIdx];
        const nextHp = Math.max(0, portal.stats.hp - damage);

        this.state.units[portalIdx] = {
            ...portal,
            stats: {
                ...portal.stats,
                hp: nextHp
            },
            status: {
                ...portal.status,
                isDying: nextHp === 0 ? true : portal.status.isDying
            }
        };

        this.triggerDamagePulses([{ unitId: portal.id, amount: damage }]);

        if (nextHp === 0) {
            window.setTimeout(() => {
                this.removeUnit(portal.id);
            }, 1500);
        }

        return true;
    }

    private getTalentPickCount(playerId: PlayerId, talentId: string): number {
        return this.state.playerTalents[playerId].filter((talent) => talent.id === talentId).length;
    }

    private playerHasTalent(playerId: PlayerId, talentId: string): boolean {
        return this.getTalentPickCount(playerId, talentId) > 0;
    }

    private playerHasWormholeTalent(playerId: PlayerId): boolean {
        return this.playerHasTalent(playerId, 't31');
    }

    private setPermanentLandingZone(key: string, owner?: PlayerId) {
        const tile = this.state.terrain[key];
        if (!tile) return;

        this.state.terrain[key] = {
            ...tile,
            landingZone: owner,
            temporaryLandingZoneExpiresAtTurn: undefined,
            temporaryLandingZoneOriginalOwner: undefined
        };
    }

    private clearLandingZoneOwnership(key: string, ownerToRemove?: PlayerId) {
        const tile = this.state.terrain[key];
        if (!tile) return;

        const activeOwner = tile.landingZone;
        const hasTemporaryZone = typeof tile.temporaryLandingZoneExpiresAtTurn === 'number';

        if (!hasTemporaryZone) {
            if (!ownerToRemove || activeOwner === ownerToRemove) {
                this.state.terrain[key] = {
                    ...tile,
                    landingZone: undefined,
                    temporaryLandingZoneExpiresAtTurn: undefined,
                    temporaryLandingZoneOriginalOwner: undefined
                };
            }
            return;
        }

        if (ownerToRemove && activeOwner !== ownerToRemove) {
            if (tile.temporaryLandingZoneOriginalOwner === ownerToRemove) {
                this.state.terrain[key] = {
                    ...tile,
                    temporaryLandingZoneOriginalOwner: undefined
                };
            }
            return;
        }

        const restoredOwner = tile.temporaryLandingZoneOriginalOwner === ownerToRemove
            ? undefined
            : tile.temporaryLandingZoneOriginalOwner;

        this.state.terrain[key] = {
            ...tile,
            landingZone: restoredOwner,
            temporaryLandingZoneExpiresAtTurn: undefined,
            temporaryLandingZoneOriginalOwner: undefined
        };
    }

    private createTemporaryLandingZone(playerId: PlayerId, position: Position, size: number) {
        const expiresAtTurn = this.state.turnCount + WORMHOLE_LANDING_ZONE_DURATION_TURNS;

        for (let dx = 0; dx < size; dx++) {
            for (let dz = 0; dz < size; dz++) {
                const key = `${position.x + dx},${position.z + dz}`;
                const tile = this.state.terrain[key];
                if (!tile) continue;

                const originalOwner = typeof tile.temporaryLandingZoneExpiresAtTurn === 'number'
                    ? tile.temporaryLandingZoneOriginalOwner
                    : tile.landingZone;

                this.state.terrain[key] = {
                    ...tile,
                    landingZone: playerId,
                    temporaryLandingZoneExpiresAtTurn: expiresAtTurn,
                    temporaryLandingZoneOriginalOwner: originalOwner
                };
            }
        }
    }

    private cleanupExpiredTemporaryLandingZones() {
        Object.keys(this.state.terrain).forEach((key) => {
            const tile = this.state.terrain[key];
            if (!tile || typeof tile.temporaryLandingZoneExpiresAtTurn !== 'number') {
                return;
            }

            if (this.state.turnCount < tile.temporaryLandingZoneExpiresAtTurn) {
                return;
            }

            this.state.terrain[key] = {
                ...tile,
                landingZone: tile.temporaryLandingZoneOriginalOwner,
                temporaryLandingZoneExpiresAtTurn: undefined,
                temporaryLandingZoneOriginalOwner: undefined
            };
        });
    }

    public getNanoRepairAmount(playerId: PlayerId): number {
        return this.playerHasTalent(playerId, 't25') ? 75 : 50;
    }

    public getShopRerollCost(playerId: PlayerId): number {
        return this.playerHasTalent(playerId, 't27') ? 25 : 50;
    }

    public canRefundShopItem(playerId: PlayerId, item: ShopItem, currentRound: number): boolean {
        if (this.playerHasTalent(playerId, 't27')) {
            return true;
        }
        return item.purchaseRound === currentRound;
    }

    public getShopRefundAmount(playerId: PlayerId, item: ShopItem): number {
        if (this.playerHasTalent(playerId, 't27')) {
            return Math.floor(item.cost * 0.9);
        }
        return item.cost;
    }

    private getTurnIncomeAmount(playerId: PlayerId): number {
        return this.playerHasTalent(playerId, 't30') ? 30 : INCOME_PER_TURN;
    }

    private getCollectiblePickupMultiplier(playerId: PlayerId): number {
        return this.playerHasTalent(playerId, 't30') ? 2 : 1;
    }

    private hasArcPortalWithMinimumHp(playerId: PlayerId, minimumHp: number): boolean {
        return this.state.units.some((unit) =>
            unit.playerId === playerId &&
            unit.type === UnitType.ARC_PORTAL &&
            !unit.status.isDying &&
            unit.stats.hp >= minimumHp
        );
    }

    private canOfferTalentToPlayer(playerId: PlayerId, talent: Talent): boolean {
        const talentRules = TALENT_RULES[talent.id] || {};
        const pickCount = this.getTalentPickCount(playerId, talent.id);
        const maxPicks = talent.maxPicks ?? talentRules.maxPicks ?? 1;
        if (pickCount >= maxPicks) {
            return false;
        }

        const prerequisiteTalentIds = talent.prerequisiteTalentIds ?? talentRules.prerequisiteTalentIds;
        if (prerequisiteTalentIds && !prerequisiteTalentIds.every((talentId) => this.playerHasTalent(playerId, talentId))) {
            return false;
        }

        if (talent.id === 't15') {
            return this.hasArcPortalWithMinimumHp(playerId, 1501);
        }

        if (talent.id === 't29') {
            return this.hasArcPortalWithMinimumHp(playerId, 301);
        }

        return true;
    }

    private getRandomColor(playerId: PlayerId): string {
        if (playerId === PlayerId.ONE) return COLORS.P1;
        if (playerId === PlayerId.TWO) return COLORS.P2;
        if (playerId === PlayerId.THREE) return COLORS.P3;
        if (playerId === PlayerId.FOUR) return COLORS.P4;
        return COLORS.NEUTRAL;
    }

    // --- WIN CONDITION CHECK ---
    private checkWinCondition() {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.state.isDevMode) return;

        const survivors = this.state.activePlayerIds.filter((playerId) =>
            this.state.units.some((unit) => unit.playerId === playerId)
        );
        const winningPlayers = this.getWinningPlayersForMode(survivors);

        if (winningPlayers) {
            this.state.winner = winningPlayers;
            this.state.appStatus = AppStatus.GAME_OVER;

            this.state.activePlayerIds
                .filter((playerId) => !survivors.includes(playerId))
                .forEach((playerId) => {
                    this.log(`> MISSION FAILURE: ${playerId} ELIMINATED.`);
                });

            this.log(`> VICTORY: ${winningPlayers.join('+')}`);
            this.notify();
        }
    }

    // --- CORE GAME ACTIONS ---

    public toggleLightMode() {
        this.state.lightMode = this.state.lightMode === 'DARK' ? 'LIGHT' : 'DARK';
        this.log(`> VISUAL PROTOCOL: ${this.state.lightMode} MODE ENABLED`);
        this.notify();
    }

    public toggleUnitLevelLabels() {
        this.state.showUnitLevelLabels = !this.state.showUnitLevelLabels;
        this.log(`> VISUAL PROTOCOL: UNIT LEVEL LABELS ${this.state.showUnitLevelLabels ? 'VISIBLE' : 'HIDDEN'}`);
        this.notify();
    }

    public toggleUnitNameLabels() {
        this.state.showUnitNameLabels = !this.state.showUnitNameLabels;
        this.log(`> VISUAL PROTOCOL: UNIT NAME LABELS ${this.state.showUnitNameLabels ? 'VISIBLE' : 'HIDDEN'}`);
        this.notify();
    }

    public enterCharacterSelection(config?: PendingStartConfig) {
        if (config) {
            this.pendingStartConfig = { ...config };
        }

        if (!ENABLE_CHARACTER_SYSTEM) {
            this.finalizeCharacterSelection();
            return;
        }

        this.state.appStatus = AppStatus.CHARACTER_SELECTION;
        this.log("> CHARACTER SELECTION MATRIX INITIALIZED.");
        this.notify();
    }

    public beginMatchSetup(mapType: string, isDevMode: boolean, customSize?: { x: number; y: number }, emptyMapConfig?: EmptyMapConfig) {
        this.pendingStartConfig = { mapType, isDevMode, customSize, emptyMapConfig };
        const activePlayerIds = this.getActivePlayersForMap(mapType, isDevMode, emptyMapConfig);
        const turnOrder = [...activePlayerIds];
        const matchMode = this.getMatchModeForMap(mapType, emptyMapConfig);
        const baseUnlocks = this.getBaseUnlockedUnitPool();
        this.state.playerCharacters = this.createEmptyPlayerCharacters();
        this.state.characterActions = this.createPerPlayerRecord(() => []);
        this.state.unlockedUnits = this.createPerPlayerRecord((playerId) =>
            playerId === PlayerId.NEUTRAL || !activePlayerIds.includes(playerId)
                ? []
                : [...baseUnlocks]
        );
        this.state.activePlayerIds = activePlayerIds;
        this.state.turnOrder = turnOrder;
        this.state.matchMode = matchMode;
        this.enterCharacterSelection();
    }

    public finalizeCharacterSelection() {
        const config = this.pendingStartConfig;
        this.pendingStartConfig = null;

        if (!config) {
            this.enterMapSelection();
            return;
        }

        this.startGame(config.mapType, config.isDevMode, config.customSize, config.emptyMapConfig);
    }

    public selectCharacter(playerId: PlayerId, charId: string) {
        if (this.state.isMultiplayer) {
            if (!this.socket || !this.state.roomId || this.state.myPlayerId !== playerId) return;

            const newChars = { ...this.state.playerCharacters, [playerId]: charId };
            this.state.playerCharacters = newChars;
            this.log(`> CHARACTER LOCKED FOR ${playerId}: ${charId}`);
            this.notify();
            this.socket.emit('character_select', { roomId: this.state.roomId, charId });
            return;
        }

        const newChars = { ...this.state.playerCharacters };
        newChars[playerId] = charId;
        this.state.playerCharacters = newChars;
        this.log(`> CHARACTER LOCKED FOR ${playerId}: ${charId}`);
        this.notify();
    }

    public enterMapSelection() {
        this.state.appStatus = AppStatus.MAP_SELECTION;
        this.notify();
    }

    public enterCardCatalogue() {
        this.state.appStatus = AppStatus.CARD_CATALOGUE;
        this.notify();
    }

    public enterRulebook() {
        this.state.appStatus = AppStatus.RULEBOOK;
        this.notify();
    }

    public exitCardCatalogue() {
        this.state.appStatus = AppStatus.MENU;
        this.notify();
    }

    public exitRulebook() {
        this.state.appStatus = AppStatus.MENU;
        this.notify();
    }

    // --- SHOP LOGIC ---

    public openShop() {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;
        if (!this.state.shopAvailable && !this.state.isDevMode) {
            this.log("> SHOP OFFLINE. UPLINK TERMINATED.");
            return;
        }
        this.state.appStatus = AppStatus.SHOP;
        this.notify();
    }

    public closeShop() {
        this.state.appStatus = AppStatus.PLAYING;
        this.notify();
    }

    private cloneCardForSync(card: Card): Card {
        return {
            ...card,
            baseStats: card.baseStats ? { ...card.baseStats } : card.baseStats
        };
    }

    private buildShopSyncPayload(
        playerId: PlayerId,
        credits: number,
        shopBudgetRemaining: number,
        shopStock: ShopItem[],
        pendingOrders: ShopItem[],
        deck: Card[],
        logMessage?: string
    ): ShopSyncPayload {
        return {
            playerId,
            credits,
            shopBudgetRemaining,
            shopStock: shopStock.map((shopItem) => ({ ...shopItem })),
            pendingOrders: pendingOrders.map((order) => ({ ...order })),
            deck: deck.map((card) => this.cloneCardForSync(card)),
            logMessage
        };
    }

    private applyShopSyncPayload(payload: ShopSyncPayload) {
        if (!payload || !payload.playerId) return;
        const { playerId } = payload;

        this.state = {
            ...this.state,
            credits: { ...this.state.credits, [playerId]: payload.credits },
            shopBudgetRemaining: { ...this.state.shopBudgetRemaining, [playerId]: payload.shopBudgetRemaining },
            shopStock: { ...this.state.shopStock, [playerId]: payload.shopStock.map((shopItem) => ({ ...shopItem })) },
            pendingOrders: { ...this.state.pendingOrders, [playerId]: payload.pendingOrders.map((order) => ({ ...order })) },
            decks: { ...this.state.decks, [playerId]: payload.deck.map((card) => this.cloneCardForSync(card)) }
        };

        if (payload.logMessage) {
            this.log(payload.logMessage, playerId);
        }
        this.notify();
    }

    public buyShopItem(item: ShopItem) {
        const playerId = this.state.currentTurn;
        const isDevShop = this.state.isDevMode;
        if (this.state.appStatus !== AppStatus.SHOP || this.state.winner) return;
        if (this.state.isMultiplayer && this.state.myPlayerId !== playerId) return;

        const stockEntryIndex = this.state.shopStock[playerId].findIndex((shopItem) => shopItem.id === item.id);
        if (stockEntryIndex === -1) {
            this.log("> STOCK ENTRY NOT FOUND", playerId);
            return;
        }

        const reservedSlots = this.state.decks[playerId].length + this.state.pendingOrders[playerId].length;
        if (!isDevShop && reservedSlots >= MAX_INVENTORY_CAPACITY) {
            this.log(`> INVENTORY FULL (${MAX_INVENTORY_CAPACITY}/${MAX_INVENTORY_CAPACITY})`, playerId);
            return;
        }

        if (!isDevShop && this.state.credits[playerId] < item.cost) {
            this.log("> INSUFFICIENT FUNDS");
            return;
        }

        const nextCredits = isDevShop
            ? this.state.credits[playerId]
            : this.state.credits[playerId] - item.cost;
        const nextShopBudgetRemaining = Math.max(0, this.state.shopBudgetRemaining[playerId] - item.cost);
        const nextShopStock = this.state.shopStock[playerId].filter(s => s.id !== item.id);
        let nextPendingOrders = [...this.state.pendingOrders[playerId]];
        let nextDeck = [...this.state.decks[playerId]];
        let logMessage = '';

        if (item.deliveryTurns === 0) {
            // Instant delivery
            const config = CARD_CONFIG[item.type]!;
            const newCard: Card = {
                id: `${playerId}-card-${Date.now()}-${Math.random()}`,
                category: config.category!,
                type: item.type,
                name: config.name!,
                description: config.description,
                baseStats: config.baseStats as any,
                cost: config.cost!
            };
            nextDeck = [...nextDeck, newCard];
            logMessage = `> PRIORITY SHIPPING: INSTANT DELIVERY CONFIRMED`;
        } else {
            // Add to pending
            const boughtItem: ShopItem = { ...item, purchaseRound: this.state.roundNumber };
            nextPendingOrders = [...nextPendingOrders, boughtItem];
            logMessage = `> ORDER CONFIRMED: ARRIVAL IN ${item.deliveryTurns} ROUNDS`;
        }

        const payload = this.buildShopSyncPayload(
            playerId,
            nextCredits,
            nextShopBudgetRemaining,
            nextShopStock,
            nextPendingOrders,
            nextDeck,
            logMessage
        );

        if (this.state.isMultiplayer) {
            this.dispatchAction('SHOP_BUY', payload);
            return;
        }

        this.applyShopSyncPayload(payload);
    }

    public refundShopItem(item: ShopItem) {
        const playerId = this.state.currentTurn;
        const isDevShop = this.state.isDevMode;
        if (this.state.appStatus !== AppStatus.SHOP || this.state.winner) return;
        if (this.state.isMultiplayer && this.state.myPlayerId !== playerId) return;
        const currentOrders = this.state.pendingOrders[playerId];
        const orderIdx = currentOrders.findIndex(i => i.id === item.id);

        if (orderIdx > -1) {
            const refundedOrder = currentOrders[orderIdx];
            if (!this.canRefundShopItem(playerId, refundedOrder, this.state.roundNumber)) {
                this.log(`> ORDER LOCKED: TRANSIT CANCELLATION UNAVAILABLE`, playerId);
                return;
            }
            const nextPendingOrders = [...currentOrders];
            nextPendingOrders.splice(orderIdx, 1);
            const refundAmount = this.getShopRefundAmount(playerId, refundedOrder);

            const nextCredits = isDevShop
                ? this.state.credits[playerId]
                : this.state.credits[playerId] + refundAmount;
            const nextShopBudgetRemaining = Math.min(SHOP_STOCK_BUDGET, this.state.shopBudgetRemaining[playerId] + refundedOrder.cost);
            const { purchaseRound, ...stockItem } = refundedOrder;
            const nextShopStock = [...this.state.shopStock[playerId], stockItem as ShopItem];
            const nextDeck = [...this.state.decks[playerId]];

            const payload = this.buildShopSyncPayload(
                playerId,
                nextCredits,
                nextShopBudgetRemaining,
                nextShopStock,
                nextPendingOrders,
                nextDeck,
                isDevShop
                    ? `> ORDER CANCELLED`
                    : `> ORDER CANCELLED: +$${refundAmount}`
            );

            if (this.state.isMultiplayer) {
                this.dispatchAction('SHOP_REFUND', payload);
                return;
            }

            this.applyShopSyncPayload(payload);
        }
    }

    public rerollShop() {
        const playerId = this.state.currentTurn;
        const isDevShop = this.state.isDevMode;
        if (this.state.appStatus !== AppStatus.SHOP || this.state.winner) return;
        if (this.state.isMultiplayer && this.state.myPlayerId !== playerId) return;
        const rerollCost = this.getShopRerollCost(playerId);

        if (!isDevShop && this.state.credits[playerId] < rerollCost) {
            this.log("> INSUFFICIENT FUNDS FOR REROLL");
            return;
        }

        const remainingBudget = this.state.shopBudgetRemaining[playerId];
        if (remainingBudget <= 0) {
            this.log("> SHOP BUDGET EXHAUSTED. REROLL ABORTED.");
            return;
        }

        const nextCredits = isDevShop
            ? this.state.credits[playerId]
            : this.state.credits[playerId] - rerollCost;
        const nextShopStock = this._generateRandomStock(playerId, remainingBudget);
        const nextPendingOrders = [...this.state.pendingOrders[playerId]];
        const nextDeck = [...this.state.decks[playerId]];

        const payload = this.buildShopSyncPayload(
            playerId,
            nextCredits,
            remainingBudget,
            nextShopStock,
            nextPendingOrders,
            nextDeck,
            isDevShop
                ? `> LOGISTICS REROUTED`
                : `> LOGISTICS REROUTED: -${rerollCost} CREDITS`
        );

        if (this.state.isMultiplayer) {
            this.dispatchAction('SHOP_REROLL', payload);
            return;
        }

        this.applyShopSyncPayload(payload);
    }

    private generateShopStock(_deliveryRound: number) {
        this.state.shopBudgetRemaining = this.createPerPlayerRecord((playerId) =>
            playerId === PlayerId.NEUTRAL || !this.state.activePlayerIds.includes(playerId) ? 0 : SHOP_STOCK_BUDGET
        );
        this.state.shopStock = this.createPerPlayerRecord((playerId) => {
            if (playerId === PlayerId.NEUTRAL || !this.state.activePlayerIds.includes(playerId)) {
                return [];
            }
            return this._generateRandomStock(playerId, this.state.shopBudgetRemaining[playerId]);
        });
    }

    private _generateRandomStock(playerId: PlayerId, budgetCeiling: number): ShopItem[] {
        const stock: ShopItem[] = [];

        const allowedTypes = this.state.unlockedUnits[playerId].filter(type =>
            this.state.isDevMode || !DEV_ONLY_UNITS.includes(type)
        );

        if (allowedTypes.length === 0 || budgetCeiling <= 0) return [];

        let totalCost = 0;
        let attempts = 0;
        while (totalCost < budgetCeiling && attempts < 500) {
            attempts++;
            const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];

            const cost = CARD_CONFIG[type]?.cost || 100;

            // Delivery Logic
            const rand = Math.random();
            let deliveryTurns = 3; // Default
            let isInstant = false;

            if (rand < 0.01) {
                deliveryTurns = 0;
                isInstant = true;
            } else {
                // 1, 2, or 3 (Equal probability)
                deliveryTurns = Math.floor(Math.random() * 3) + 1;
            }

            stock.push({
                id: `shop-item-${Date.now()}-${Math.random()}-${stock.length}`,
                type,
                cost,
                deliveryTurns,
                isInstant
            });
            totalCost += cost;
        }
        return stock;
    }

    private processDeliveries(round: number) {
        this.state.activePlayerIds.forEach((playerId) => {
            this.state.recentlyDeliveredCardIds[playerId] = [];
        });

        // 1. Process Pending Orders (Decrement & Deliver)
        this.state.activePlayerIds.forEach(pid => {
            const orders = this.state.pendingOrders[pid];
            if (orders.length === 0) return;

            const remainingOrders: ShopItem[] = [];
            const deliveredItems: ShopItem[] = [];

            orders.forEach(item => {
                // Modifying item in place is risky if we share refs, but here we are iterating current state
                // We should clone to be safe, but straightforward decrement is okay since we re-assign array
                item.deliveryTurns--;

                if (item.deliveryTurns <= 0) {
                    deliveredItems.push(item);
                } else {
                    remainingOrders.push(item);
                }
            });

            if (deliveredItems.length > 0) {
                const freeSlots = Math.max(0, MAX_INVENTORY_CAPACITY - this.state.decks[pid].length);
                const deliverNow = deliveredItems.slice(0, freeSlots);
                const overflow = deliveredItems.slice(freeSlots).map(item => ({ ...item, deliveryTurns: 1 }));
                remainingOrders.push(...overflow);

                const newCards = deliverNow.map(item => {
                    const config = CARD_CONFIG[item.type]!;
                    return {
                        id: `${pid}-card-${Date.now()}-${Math.random()}`,
                        category: config.category!,
                        type: item.type,
                        name: config.name!,
                        description: config.description,
                        baseStats: config.baseStats as any,
                        cost: config.cost!
                    } as Card;
                });
                if (newCards.length > 0) {
                    this.state.decks[pid] = [...this.state.decks[pid], ...newCards];
                    this.state.recentlyDeliveredCardIds[pid] = newCards.map(card => card.id);
                    this.log(`> LOGISTICS DROP RECEIVED: ${newCards.length} UNITS`, pid);
                    this.state.deliveryHappened = true;
                }

                if (overflow.length > 0) {
                    this.log(`> DELIVERY QUEUED: INVENTORY CAP ${MAX_INVENTORY_CAPACITY}`, pid);
                }
            }

            this.state.pendingOrders[pid] = remainingOrders;
        });

        // 2. Handle Restocking / Big Drops (Legacy Rounds)
        const deliveryRounds = [10, 25, 50, 100];
        if (deliveryRounds.includes(round)) {
            if (round < 100) {
                const nextIndex = deliveryRounds.indexOf(round) + 1;
                const nextRound = deliveryRounds[nextIndex];
                this.state.nextDeliveryRound = nextRound;

                // Supply Injection
                this.state.activePlayerIds.forEach((playerId) => {
                    this.state.credits[playerId] += 500;
                });

                this.generateShopStock(nextRound);
                this.log(`> SHOP RESTOCKED & +500 CREDITS. NEXT DROP: ROUND ${nextRound}`);
            } else {
                this.state.shopAvailable = false;
                this.log(`> SUPPLY LINES SEVERED. SHOP OFFLINE.`);
            }
        }
    }

    private applyCharacterPerks(playerId: PlayerId) {
        if (!ENABLE_CHARACTER_SYSTEM) return;

        const charId = this.state.playerCharacters[playerId];
        const character = CHARACTERS.find(c => c.id === charId);

        if (!character) return;

        this.log(`> ACTIVATING ${character.name.toUpperCase()} PROTOCOLS...`, playerId);

        const instantPerk = character.perks.find(p => p.level === 0);
        if (instantPerk) {
            if (instantPerk.unlocksUnits) {
                const currentUnlocks = this.state.unlockedUnits[playerId];
                const newUnlocks = Array.from(new Set([...currentUnlocks, ...instantPerk.unlocksUnits]));
                this.state.unlockedUnits[playerId] = newUnlocks;
                this.log(`> UNIT UNLOCK: ${instantPerk.unlocksUnits.join(', ')}`, playerId);
            }
        }

        // Initialize Character Actions
        if (character.actions) {
            // Ensure container exists
            if (!this.state.characterActions) {
                this.state.characterActions = this.createPerPlayerRecord(() => []);
            }

            this.state.characterActions[playerId] = character.actions.map(a => ({
                ...a,
                currentCooldown: 0
            }));
            this.log(`> ACTIONS INITIALIZED: ${character.actions.map(a => a.name).join(', ')}`, playerId);
        }
    }

    // --- GAME INITIALIZATION ---

    private getMapMetadata(mapId: string, emptyMapConfig?: EmptyMapConfig): MapMetadata {
        if (mapId === 'EMPTY') {
            const config = this.normalizeEmptyMapConfig(emptyMapConfig);
            return {
                id: 'EMPTY',
                description: 'Blank sandbox generated from the selected dimensions.',
                players: config.players,
                mode: config.mode
            };
        }

        return getAvailableMaps().find((map) => map.id === mapId) || {
            id: mapId,
            players: 2,
            mode: 'duel'
        };
    }

    private getEmptyMapLayout(emptyMapConfig?: EmptyMapConfig): Array<{ playerId: PlayerId; side: 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT' }> {
        const { players } = this.normalizeEmptyMapConfig(emptyMapConfig);
        if (players === 4) {
            return [
                { playerId: PlayerId.ONE, side: 'TOP' },
                { playerId: PlayerId.TWO, side: 'RIGHT' },
                { playerId: PlayerId.THREE, side: 'BOTTOM' },
                { playerId: PlayerId.FOUR, side: 'LEFT' }
            ];
        }

        if (players === 3) {
            return [
                { playerId: PlayerId.ONE, side: 'TOP' },
                { playerId: PlayerId.TWO, side: 'RIGHT' },
                { playerId: PlayerId.THREE, side: 'BOTTOM' }
            ];
        }

        return [
            { playerId: PlayerId.ONE, side: 'TOP' },
            { playerId: PlayerId.TWO, side: 'BOTTOM' }
        ];
    }

    private getEmptyMapLandingZoneOwner(x: number, z: number, bounds: MapBounds, emptyMapConfig?: EmptyMapConfig): PlayerId | undefined {
        const stripDepth = Math.max(3, CARD_CONFIG[UnitType.ARC_PORTAL]?.baseStats?.size || 3);
        const leftEdge = bounds.originX;
        const rightEdge = bounds.originX + bounds.width - 1;
        const topEdge = bounds.originZ;
        const bottomEdge = bounds.originZ + bounds.height - 1;
        const withinTop = z <= topEdge + stripDepth - 1;
        const withinBottom = z >= bottomEdge - stripDepth + 1;
        const withinLeft = x <= leftEdge + stripDepth - 1;
        const withinRight = x >= rightEdge - stripDepth + 1;

        for (const slot of this.getEmptyMapLayout(emptyMapConfig)) {
            if (slot.side === 'TOP' && withinTop) return slot.playerId;
            if (slot.side === 'RIGHT' && withinRight && !withinTop && !withinBottom) return slot.playerId;
            if (slot.side === 'BOTTOM' && withinBottom) return slot.playerId;
            if (slot.side === 'LEFT' && withinLeft && !withinTop && !withinBottom) return slot.playerId;
        }

        return undefined;
    }

    private getMainPlacementForLandingStrip(bounds: MapBounds, playerId: PlayerId, emptyMapConfig?: EmptyMapConfig): Position | null {
        const mainSize = CARD_CONFIG[UnitType.ARC_PORTAL]?.baseStats?.size || 3;
        if (bounds.width < mainSize || bounds.height < mainSize) {
            return null;
        }

        const slot = this.getEmptyMapLayout(emptyMapConfig).find((entry) => entry.playerId === playerId);
        if (!slot) return null;

        const centeredX = bounds.originX + Math.floor((bounds.width - mainSize) / 2);
        const centeredZ = bounds.originZ + Math.floor((bounds.height - mainSize) / 2);

        switch (slot.side) {
            case 'TOP':
                return { x: centeredX, z: bounds.originZ };
            case 'RIGHT':
                return { x: bounds.originX + bounds.width - mainSize, z: centeredZ };
            case 'BOTTOM':
                return { x: centeredX, z: bounds.originZ + bounds.height - mainSize };
            case 'LEFT':
                return { x: bounds.originX, z: centeredZ };
            default:
                return null;
        }
    }

    private getMainRotationForLandingStrip(playerId: PlayerId, emptyMapConfig?: EmptyMapConfig): number {
        const slot = this.getEmptyMapLayout(emptyMapConfig).find((entry) => entry.playerId === playerId);
        if (!slot) {
            return this.getInitialRotation(playerId);
        }

        switch (slot.side) {
            case 'TOP':
                return 0;
            case 'RIGHT':
                return -Math.PI / 2;
            case 'BOTTOM':
                return Math.PI;
            case 'LEFT':
                return Math.PI / 2;
            default:
                return this.getInitialRotation(playerId);
        }
    }

    private createAutoMainUnitsForEmptyMap(bounds: MapBounds, emptyMapConfig?: EmptyMapConfig): Unit[] {
        const units: Unit[] = [];

        this.getActivePlayersForMap('EMPTY', true, emptyMapConfig).forEach((playerId) => {
            const position = this.getMainPlacementForLandingStrip(bounds, playerId, emptyMapConfig);
            if (!position) return;
            const mainUnit = this.createUnit(UnitType.ARC_PORTAL, position, playerId);
            mainUnit.rotation = this.getMainRotationForLandingStrip(playerId, emptyMapConfig);
            units.push(mainUnit);
        });

        return units;
    }

    private buildMapScenario(mapType: string = 'EMPTY', customSize?: { x: number, y: number }, isDevModeForSetup: boolean = false, emptyMapConfig?: EmptyMapConfig): MapScenario {
        const terrain: Record<string, TerrainData> = {};
        let initialUnits: Unit[] = [];
        let initialCollectibles: any[] = [];
        let mapBounds: MapBounds = this.getFallbackMapBounds();
        let deletedTiles: string[] = [];

        const setLandingZone = (x: number, z: number, startZ: number, sizeZ: number) => {
            if (z === startZ || z === startZ + 1) return PlayerId.ONE;
            if (z === startZ + sizeZ - 1 || z === startZ + sizeZ - 2) return PlayerId.TWO;
            return undefined;
        };

        if (mapType === 'EMPTY') {
            const normalizedEmptyMapConfig = this.normalizeEmptyMapConfig(emptyMapConfig);
            const minimumWidth = normalizedEmptyMapConfig.players > 2 ? 6 : 4;
            const minimumHeight = normalizedEmptyMapConfig.players > 2 ? 7 : (isDevModeForSetup ? 6 : 4);
            const sizeX = Math.max(minimumWidth, Math.min(BOARD_SIZE, customSize?.x || 10));
            const sizeZ = Math.max(minimumHeight, Math.min(BOARD_SIZE, customSize?.y || 10));
            const startX = Math.floor((BOARD_SIZE - sizeX) / 2);
            const startZ = Math.floor((BOARD_SIZE - sizeZ) / 2);
            mapBounds = this.createMapBounds(startX, startZ, sizeX, sizeZ);

            for (let x = mapBounds.originX; x < mapBounds.originX + mapBounds.width; x++) {
                for (let z = mapBounds.originZ; z < mapBounds.originZ + mapBounds.height; z++) {
                    terrain[`${x},${z}`] = {
                        type: 'NORMAL',
                        elevation: 0,
                        rotation: 0,
                        landingZone: this.getEmptyMapLandingZoneOwner(x, z, mapBounds, emptyMapConfig)
                    };
                }
            }

            if (isDevModeForSetup) {
                initialUnits = this.createAutoMainUnitsForEmptyMap(mapBounds, emptyMapConfig);
            }
        } else if (mapType === 'MAP_1') {
            const sizeX = Math.max(4, Math.min(BOARD_SIZE, customSize?.x || 12));
            const sizeZ = Math.max(4, Math.min(BOARD_SIZE, customSize?.y || 12));
            const startX = Math.floor((BOARD_SIZE - sizeX) / 2);
            const startZ = Math.floor((BOARD_SIZE - sizeZ) / 2);
            mapBounds = this.createMapBounds(startX, startZ, sizeX, sizeZ);

            for (let x = mapBounds.originX; x < mapBounds.originX + mapBounds.width; x++) {
                for (let z = mapBounds.originZ; z < mapBounds.originZ + mapBounds.height; z++) {
                    terrain[`${x},${z}`] = {
                        type: 'NORMAL',
                        elevation: 0,
                        rotation: 0,
                        landingZone: setLandingZone(x, z, mapBounds.originZ, mapBounds.height)
                    };

                    if (z === mapBounds.originZ + 8) {
                        if (x === mapBounds.originX + 2) {
                            terrain[`${x},${z}`].type = 'NORMAL';
                        } else if (x === mapBounds.originX + 3) {
                            terrain[`${x},${z}`] = { ...terrain[`${x},${z}`], type: 'RAMP', elevation: 0, rotation: 1 };
                        } else if (x === mapBounds.originX + 4) {
                            terrain[`${x},${z}`] = { ...terrain[`${x},${z}`], type: 'RAMP', elevation: 1, rotation: 1 };
                        } else if (x >= mapBounds.originX + 5 && x <= mapBounds.originX + 7) {
                            terrain[`${x},${z}`] = { ...terrain[`${x},${z}`], type: 'PLATFORM', elevation: 2 };
                        }
                    }
                }
            }

            const wallOneX = mapBounds.originX + 8;
            const wallOneZ = mapBounds.originZ + 2;
            const wallTwoX = mapBounds.originX + 9;
            const wallTwoZ = mapBounds.originZ + 2;
            const towerX = mapBounds.originX + 6;
            const towerZ = mapBounds.originZ + 8;

            if (this.isWithinMap(wallOneX, wallOneZ, mapBounds))
                initialUnits.push(this.createUnit(UnitType.WALL, { x: wallOneX, z: wallOneZ }, PlayerId.NEUTRAL));

            if (this.isWithinMap(wallTwoX, wallTwoZ, mapBounds))
                initialUnits.push(this.createUnit(UnitType.WALL, { x: wallTwoX, z: wallTwoZ }, PlayerId.NEUTRAL));

            if (this.isWithinMap(towerX, towerZ, mapBounds))
                initialUnits.push(this.createUnit(UnitType.TOWER, { x: towerX, z: towerZ }, PlayerId.NEUTRAL));
        } else if (getRegisteredMap(mapType)) {
            const mapData = getRegisteredMap(mapType) as MapJsonShape;

            if (mapData.terrain) {
                Object.keys(mapData.terrain).forEach(key => {
                    const normalized = this.normalizeTileKey(key);
                    if (!normalized) return;
                    const t = mapData.terrain[key];
                    terrain[normalized] = { ...t };
                });
            }

            mapBounds = this.resolveMapBoundsFromData(mapData, terrain);
            deletedTiles = this.collectDeletedTilesForBounds(mapData, mapBounds, terrain);

            const deletedSet = new Set(deletedTiles);
            Object.keys(terrain).forEach((key) => {
                const [x, z] = key.split(',').map(Number);
                if (!this.isWithinMap(x, z, mapBounds) || deletedSet.has(key)) {
                    delete terrain[key];
                }
            });

            if (mapData.units) {
                initialUnits = mapData.units.map((u: any) => ({
                    ...u,
                    stats: this.createUnit(u.type, u.position, u.playerId).stats,
                    status: {
                        stepsTaken: 0,
                        attacksUsed: 0,
                        fluxTowerAttackUpgradesPurchased: 0,
                        dropsPerkCacheOnDeath: !!u.status?.dropsPerkCacheOnDeath
                    },
                    effects: [],
                    movePath: []
                }));
            }

            if (mapData.collectibles) {
                initialCollectibles = mapData.collectibles;
            }
        }

        if (deletedTiles.length === 0) {
            deletedTiles = this.collectDeletedTilesForBounds({}, mapBounds, terrain);
        }

        return {
            terrain,
            initialUnits,
            initialCollectibles,
            mapBounds,
            deletedTiles
        };
    }

    public getMapPreviewData(mapId: string, customSize?: { x: number; y: number }, emptyMapConfig?: EmptyMapConfig): MapPreviewData | null {
        if (mapId !== 'EMPTY' && mapId !== 'MAP_1' && !getRegisteredMap(mapId)) {
            return null;
        }

        const scenario = this.buildMapScenario(mapId, customSize, false, emptyMapConfig);
        const metadata = this.getMapMetadata(mapId, emptyMapConfig);

        return {
            ...metadata,
            terrain: scenario.terrain,
            units: scenario.initialUnits,
            collectibles: scenario.initialCollectibles,
            mapBounds: scenario.mapBounds
        };
    }

    public startGame(mapType: string = 'EMPTY', isDevMode: boolean = false, customSize?: { x: number, y: number }, emptyMapConfig?: EmptyMapConfig) {
        this.clearPendingSyncTimer();
        this.pendingStartConfig = null;
        this.pendingMultiplayerMoveUnitId = null;
        this.queuedAuthoritativeMoveTargets.clear();
        const deckNeutral = isDevMode ? this.generateDevDeck(PlayerId.NEUTRAL) : [];
        const activePlayerIds = this.getActivePlayersForMap(mapType, isDevMode, emptyMapConfig);
        const turnOrder = [...activePlayerIds];
        const matchMode = this.getMatchModeForMap(mapType, emptyMapConfig);
        const generatedDecks = this.createPerPlayerRecord((playerId) => {
            if (playerId === PlayerId.NEUTRAL) return deckNeutral;
            if (!activePlayerIds.includes(playerId)) return [];
            return isDevMode ? this.generateDevDeck(playerId) : this.generateDeck(playerId);
        });
        const fullUnlockPool = Object.keys(CARD_CONFIG) as UnitType[];
        const unlockedUnits = isDevMode
            ? this.createPerPlayerRecord((playerId) =>
                playerId === PlayerId.NEUTRAL || !activePlayerIds.includes(playerId)
                    ? []
                    : [...fullUnlockPool]
            )
            : this.state.unlockedUnits;

        this.discovered.clear();
        if (getRegisteredMap(mapType)) {
            this.log(`> LOADING MAP: ${mapType}...`);
        }
        const { terrain, initialUnits, initialCollectibles, mapBounds, deletedTiles } = this.buildMapScenario(mapType, customSize, isDevMode, emptyMapConfig);
        if (getRegisteredMap(mapType)) {
            this.log(`> TERRAIN LOADED: ${Object.keys(terrain).length} TILES`);
        }
        this.seedInitialDiscovery(terrain, mapBounds, isDevMode);

        activePlayerIds.forEach((playerId) => {
            this.applyCharacterPerks(playerId);
        });

        this.state = {
            ...this.state,
            appStatus: AppStatus.PLAYING,
            mapId: mapType,
            units: initialUnits,
            collectibles: initialCollectibles,
            revealedTiles: Array.from(this.discovered),
            terrain: terrain,
            mapBounds,
            deletedTiles,
            roundNumber: 1,
            decks: generatedDecks,
            selectedCardId: generatedDecks[PlayerId.ONE][0]?.id || null,
            selectedUnitId: null,
            previewPath: [],
            interactionState: { mode: 'NORMAL' },
            systemMessage: isDevMode ? "DEV MODE ACTIVE: INFINITE RESOURCES" : "MATCH STARTED. PLAYER 1 ACTIVE.",
            currentTurn: PlayerId.ONE,
            turnCount: 1,
            turnStartedAt: Date.now(),
            turnOvertimeDamageApplied: 0,
            activePlayerIds,
            turnOrder,
            matchMode,
            unlockedUnits,
            playerTalentDraftCounts: this.createPerPlayerRecord(() => 3),

            credits: this.createPerPlayerRecord((playerId) =>
                playerId === PlayerId.NEUTRAL || !activePlayerIds.includes(playerId) ? 0 : INITIAL_CREDITS
            ),
            shopBudgetRemaining: this.createPerPlayerRecord((playerId) =>
                playerId === PlayerId.NEUTRAL || !activePlayerIds.includes(playerId) ? 0 : SHOP_STOCK_BUDGET
            ),
            pendingOrders: this.createPerPlayerRecord(() => []),
            shopStock: this.createPerPlayerRecord(() => []),
            nextDeliveryRound: 10,
            shopAvailable: true,
            deliveryHappened: false,
            recentlyDeliveredCardIds: this.createPerPlayerRecord(() => []),

            isDevMode: isDevMode,
            debugClickTrace: [],
            debugLastDecision: null,
            debugLastHoverTile: null
        };
        this.updateFogOfWar();

        this.generateShopStock(10);
        this.awardTurnStartIncome(this.state.currentTurn, this.state.roundNumber);

        if (this.state.isMultiplayer && this.isSyncAuthority()) {
            // The authority peer publishes the initial replicated game snapshot.
            this.replicateAuthoritativeState(500);
        }

        initialUnits.forEach(u => {
            if (u.type === UnitType.WALL) this.updateWallRotations(u.id);
        });

        this.log(`COMBAT SIMULATION INITIALIZED: ${mapType}.`);
        if (isDevMode) this.log("!!! DEVELOPER OVERRIDE ACTIVE !!!");
        this.notify();
    }

    public togglePause() {
        if (this.state.appStatus === AppStatus.MENU || this.state.appStatus === AppStatus.GAME_OVER || this.state.appStatus === AppStatus.MAP_SELECTION) return;

        if (this.state.appStatus === AppStatus.PLAYING) {
            this.state.appStatus = AppStatus.PAUSED;
            this.log("SIMULATION PAUSED.");
        } else {
            this.state.appStatus = AppStatus.PLAYING;
            this.log("SIMULATION RESUMED.");
        }
        this.notify();
    }

    public restartGame() {
        this.leaveLobby();
        const lightMode = this.state.lightMode;
        const showUnitNameLabels = this.state.showUnitNameLabels;
        const showUnitLevelLabels = this.state.showUnitLevelLabels;
        const newState = this.getInitialState();
        this.pendingStartConfig = null;
        this.authoritySocketId = null;
        this.state = { ...newState, lightMode, showUnitNameLabels, showUnitLevelLabels };
        this.log("REBOOTING SIMULATION...");
        this.notify();
    }

    public restartCurrentMap() {
        if (this.state.isMultiplayer || this.state.isDevMode) {
            this.log("> RESTART CURRENT MAP IS SOLO-ONLY.");
            this.notify();
            return;
        }

        const customSize = this.state.mapId === 'EMPTY'
            ? { x: this.state.mapBounds.width, y: this.state.mapBounds.height }
            : undefined;

        const emptyMapConfig = this.state.mapId === 'EMPTY'
            ? { players: this.state.activePlayerIds.length as 2 | 3 | 4, mode: this.state.matchMode }
            : undefined;

        this.startGame(this.state.mapId, this.state.isDevMode, customSize, emptyMapConfig);
    }

    private log(message: string, playerId?: PlayerId) {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const entry: LogEntry = {
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp,
            message,
            playerId
        };
        const newLog = [...this.state.actionLog, entry];
        if (newLog.length > 50) newLog.shift();
        this.state.actionLog = newLog;
        this.state.systemMessage = message;
    }

    private pushDebugTrace(
        stage: string,
        result: DebugClickResult,
        reason: string,
        options?: {
            tile?: Position;
            unitId?: string;
            pointer?: DebugPointerMeta;
            notify?: boolean;
        }
    ) {
        if (!this.state.isDevMode) return;

        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const previewPathEnd = this.state.previewPath.length > 0
            ? this.state.previewPath[this.state.previewPath.length - 1]
            : null;

        const entry: DebugClickTraceEntry = {
            id: `dbg-${Date.now()}-${Math.random()}`,
            timestamp,
            stage,
            result,
            reason,
            mode: this.state.interactionState.mode,
            tile: options?.tile ? { ...options.tile } : undefined,
            unitId: options?.unitId,
            selectedUnitId: this.state.selectedUnitId,
            selectedCardId: this.state.selectedCardId,
            previewPathLength: this.state.previewPath.length,
            previewPathEnd: previewPathEnd ? { ...previewPathEnd } : null,
            pointer: options?.pointer
        };

        const updated = [...this.state.debugClickTrace, entry];
        this.state.debugClickTrace = updated.slice(-50);
        this.state.debugLastDecision = `${stage}: ${reason}`;

        // Mirror diagnostics to console for quick grep during reproduction sessions.
        console.debug('[ClickTrace]', entry);

        if (options?.notify) {
            this.notify();
        }
    }

    private updateFogOfWar() {
        this.discovered.clear();

        if (this.state.isDevMode || this.state.fogOfWarDisabled) {
            Object.keys(this.state.terrain).forEach((key) => this.discovered.add(key));
            this.state.revealedTiles = Array.from(this.discovered);
            return;
        }

        const revealPlayer = this.state.isMultiplayer
            ? (this.state.myPlayerId || this.state.currentTurn)
            : this.state.currentTurn;

        Object.keys(this.state.terrain).forEach((key) => {
            if (this.state.terrain[key]?.landingZone !== revealPlayer) return;

            const [originX, originZ] = key.split(',').map(Number);
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const x = originX + dx;
                    const z = originZ + dz;
                    if (!this.isWithinMap(x, z)) continue;

                    const targetKey = `${x},${z}`;
                    if (!this.state.terrain[targetKey]) continue;
                    this.discovered.add(targetKey);
                }
            }
        });

        this.state.units.forEach(unit => {
            if (!this.arePlayersAllied(revealPlayer, unit.playerId)) {
                return;
            }

            const { x, z } = unit.position;
            const size = unit.stats.size;
            const radius = 2;

            for (let dx = -radius; dx < radius + size; dx++) {
                for (let dz = -radius; dz < radius + size; dz++) {
                    const targetX = x + dx;
                    const targetZ = z + dz;
                    if (!this.isWithinMap(targetX, targetZ)) continue;
                    const key = `${targetX},${targetZ}`;
                    if (!this.state.terrain[key]) continue;
                    this.discovered.add(key);
                }
            }
        });
        this.state.revealedTiles = Array.from(this.discovered);
    }

    private generateDeck(playerId: PlayerId): Card[] {
        const cards: Card[] = [];

        const allowed = this.state.unlockedUnits[playerId].filter(type => !DEV_ONLY_UNITS.includes(type));
        if (allowed.length === 0) {
            return cards;
        }

        let totalCost = 0;
        let attempts = 0;
        while (totalCost < INITIAL_DECK_BUDGET && attempts < 500) {
            attempts++;
            const type = allowed[Math.floor(Math.random() * allowed.length)];
            const config = CARD_CONFIG[type]!;
            const stats = config.baseStats as any;
            cards.push({
                id: `${playerId}-card-${Date.now()}-rnd-${cards.length}`,
                category: config.category!,
                type,
                name: config.name!,
                description: config.description,
                baseStats: stats,
                cost: config.cost!
            });
            totalCost += config.cost || 0;
        }

        return cards;
    }

    private generateDevDeck(playerId: PlayerId): Card[] {
        return Object.keys(CARD_CONFIG).map((key, i) => {
            const type = key as UnitType;
            const config = CARD_CONFIG[type]!;
            const stats = config.baseStats as any;
            return {
                id: `${playerId}-dev-card-${type}`,
                category: config.category!,
                type: type,
                name: config.name!,
                description: config.description,
                baseStats: stats,
                cost: config.cost!
            };
        });
    }

    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach((listener) => listener({ ...this.state }));
    }

    private addPlayerEffect(playerId: PlayerId, effect: Omit<Effect, 'id'>) {
        const newEffect: Effect = { ...effect, id: `pe-${Date.now()}-${Math.random()}` };
        this.state.playerEffects[playerId].push(newEffect);
        this.log(`> EFFECT APPLIED TO [${this.getPlayerShortLabel(playerId)}]: ${effect.name}`);
    }

    private addUnitEffect(unitId: string, effect: Omit<Effect, 'id'>) {
        const unitIndex = this.state.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return;

        const newEffect: Effect = { ...effect, id: `ue-${Date.now()}-${Math.random()}` };
        const updatedUnit = { ...this.state.units[unitIndex] };
        updatedUnit.effects = [...updatedUnit.effects, newEffect];

        const newUnits = [...this.state.units];
        newUnits[unitIndex] = updatedUnit;
        this.state.units = newUnits;

        this.log(`> EFFECT APPLIED TO UNIT: ${effect.name}`);
    }

    private processEffects(playerId: PlayerId) {
        if (playerId === PlayerId.NEUTRAL) return;

        const activePlayerEffects = this.state.playerEffects[playerId].filter(e => {
            e.duration -= 1;
            if (e.duration <= 0) {
                this.log(`> EFFECT EXPIRED: ${e.name} [${this.getPlayerShortLabel(playerId)}]`);
                return false;
            }
            return true;
        });
        this.state.playerEffects[playerId] = activePlayerEffects;

        const units = this.state.units.map(u => {
            if (u.playerId === playerId) {
                const activeEffects = u.effects.filter(e => {
                    if (e.name === 'KINETIC SHIELD') {
                        return true;
                    }
                    e.duration -= 1;
                    if (e.duration <= 0) {
                        this.log(`> EFFECT EXPIRED: ${e.name} on ${u.type}`);
                        return false;
                    }
                    return true;
                });
                return { ...u, effects: activeEffects };
            }
            return u;
        });
        this.state.units = units;

        if (!this.state.characterActions) {
            this.state.characterActions = this.createPerPlayerRecord(() => []);
        }

        if (!ENABLE_CHARACTER_SYSTEM) {
            if (this.state.characterActions[playerId]?.length) {
                this.state.characterActions[playerId] = [];
            }
            return;
        }

        if (!this.state.characterActions[playerId] || this.state.characterActions[playerId].length === 0) {
            const charId = this.state.playerCharacters[playerId];
            const character = CHARACTERS.find(c => c.id === charId);
            if (character && character.actions) {
                this.state.characterActions[playerId] = character.actions.map(a => ({
                    ...a,
                    currentCooldown: 0
                }));
            } else if (!this.state.characterActions[playerId]) {
                this.state.characterActions[playerId] = [];
            }
        }

        const actions = this.state.characterActions[playerId];
        if (actions && actions.length > 0) {
            const updatedActions = actions.map(a => ({
                ...a,
                currentCooldown: Math.max(0, a.currentCooldown - 1)
            }));
            this.state.characterActions[playerId] = updatedActions;
        }
    }

    private triggerSupportPulse(targetUnitId: string, amount: number, pulseType: 'HEAL' | 'ENERGY') {
        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        this.state.units[targetIdx] = {
            ...this.state.units[targetIdx],
            status: {
                ...this.state.units[targetIdx].status,
                healPulseAmount: pulseType === 'HEAL' ? amount : null,
                energyPulseAmount: pulseType === 'ENERGY' ? amount : null
            }
        };

        this.notify();
        this.replicateAuthoritativeState();

        setTimeout(() => {
            const cleanupIdx = this.state.units.findIndex(u => u.id === targetUnitId);
            if (cleanupIdx === -1) return;

            this.state.units[cleanupIdx] = {
                ...this.state.units[cleanupIdx],
                status: {
                    ...this.state.units[cleanupIdx].status,
                    healPulseAmount: null,
                    energyPulseAmount: null
                }
            };
            this.notify();
            this.replicateAuthoritativeState();
        }, 1200);
    }

    private triggerDamagePulses(pulses: Array<{ unitId: string; amount: number }>) {
        if (pulses.length === 0) return;

        const appliedUnitIds = new Set<string>();

        this.state.units = this.state.units.map((unit) => {
            const pulse = pulses.find((entry) => entry.unitId === unit.id && entry.amount > 0);
            if (!pulse) return unit;

            appliedUnitIds.add(unit.id);
            return {
                ...unit,
                status: {
                    ...unit.status,
                    damagePulseAmount: pulse.amount
                }
            };
        });

        if (appliedUnitIds.size === 0) return;

        window.setTimeout(() => {
            this.state.units = this.state.units.map((unit) => {
                if (!appliedUnitIds.has(unit.id)) return unit;
                return {
                    ...unit,
                    status: {
                        ...unit.status,
                        damagePulseAmount: null
                    }
                };
            });
            this.notify();
            if (this.state.isMultiplayer && this.isSyncAuthority()) {
                this.replicateAuthoritativeState();
            }
        }, 1200);
    }

    private triggerMissPulse(targetUnitId: string, text: string = 'MISS') {
        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        this.state.units[targetIdx] = {
            ...this.state.units[targetIdx],
            status: {
                ...this.state.units[targetIdx].status,
                missPulseText: text
            }
        };

        window.setTimeout(() => {
            const cleanupIdx = this.state.units.findIndex(u => u.id === targetUnitId);
            if (cleanupIdx === -1) return;

            this.state.units[cleanupIdx] = {
                ...this.state.units[cleanupIdx],
                status: {
                    ...this.state.units[cleanupIdx].status,
                    missPulseText: null
                }
            };
            this.notify();
            if (this.state.isMultiplayer && this.isSyncAuthority()) {
                this.replicateAuthoritativeState();
            }
        }, 1200);
    }

    private shouldAttackMiss(attacker: Unit, target: Unit): boolean {
        return target.level >= attacker.level + 10 && Math.random() < 0.25;
    }

    private canMindControlTarget(hacker: Unit, target: Unit): boolean {
        return target.level < hacker.level + 10;
    }

    private triggerTilePulse(key: string, kind: 'SABOTAGE' | 'ION_CANNON') {
        this.state.tilePulse = { key, kind };
        this.notify();
        this.replicateAuthoritativeState();

        setTimeout(() => {
            if (this.state.tilePulse?.key !== key || this.state.tilePulse?.kind !== kind) return;
            this.state.tilePulse = null;
            this.notify();
            this.replicateAuthoritativeState();
        }, kind === 'ION_CANNON' ? 1100 : 900);
    }

    private processStructures(playerId: PlayerId) {
        const structures = this.state.units.filter(u =>
            u.playerId === playerId &&
            u.type === UnitType.CHARGING_STATION
        );

        const energyRestores = new Map<string, number>();

        structures.forEach(station => {
            const sx = station.position.x;
            const sz = station.position.z;
            const size = station.stats.size;

            const friendlies = this.state.units.filter(u =>
                u.playerId === playerId &&
                u.id !== station.id &&
                u.stats.maxEnergy > 0 &&
                u.stats.energy < u.stats.maxEnergy
            );

            friendlies.forEach(friendly => {
                const fx = friendly.position.x;
                const fz = friendly.position.z;
                const fSize = friendly.stats.size;

                const overlaps = (
                    fx < sx + size + 1 && fx + fSize > sx - 1 &&
                    fz < sz + size + 1 && fz + fSize > sz - 1
                );

                if (!overlaps) return;

                energyRestores.set(friendly.id, (energyRestores.get(friendly.id) || 0) + 25);
            });
        });

        energyRestores.forEach((restoreAmount, unitId) => {
            const targetIdx = this.state.units.findIndex(u => u.id === unitId);
            if (targetIdx === -1) return;

            const target = this.state.units[targetIdx];
            const appliedRestore = Math.min(restoreAmount, target.stats.maxEnergy - target.stats.energy);
            if (appliedRestore <= 0) return;

            this.state.units[targetIdx].stats.energy = Math.min(target.stats.maxEnergy, target.stats.energy + restoreAmount);
            this.log(`> INDUCTIVE CHARGE: +${appliedRestore} ENERGY to ${target.type}`, playerId);
            this.triggerSupportPulse(unitId, appliedRestore, 'ENERGY');
        });
    }

    // --- PASSIVE TALENTS LOGIC ---
    private processPassiveTalents(playerId: PlayerId) {
        const talents = this.state.playerTalents[playerId];
        const bioticRegenTier = talents.filter(t => t.id === 't5' || t.id === 't22').length;
        const reactorTuningTier = talents.filter(t => t.id === 't6' || t.id === 't23').length;
        const hasBioticRegen = bioticRegenTier > 0;
        const baseEnergyRegen = 5;
        const bonusEnergyRegen = reactorTuningTier * 5;
        const bioticRegenAmount = bioticRegenTier * 10;

        if (!hasBioticRegen && baseEnergyRegen === 0 && bonusEnergyRegen === 0) return;

        this.state.units = this.state.units.map(u => {
            if (u.playerId !== playerId) return u;

            let newStats = { ...u.stats };
            let updated = false;

            // t5: Biotic Regen (Heal 10 HP/turn for non-buildings)
            if (hasBioticRegen && !BUILDING_TYPES.includes(u.type)) {
                if (newStats.hp < newStats.maxHp) {
                    newStats.hp = Math.min(newStats.maxHp, newStats.hp + bioticRegenAmount);
                    updated = true;
                }
            }

            const totalEnergyRegen = baseEnergyRegen + bonusEnergyRegen;
            if (totalEnergyRegen > 0 && newStats.maxEnergy > 0) {
                if (newStats.energy < newStats.maxEnergy) {
                    newStats.energy = Math.min(newStats.maxEnergy, newStats.energy + totalEnergyRegen);
                    updated = true;
                }
            }

            if (updated) {
                return { ...u, stats: newStats };
            }
            return u;
        });

        if (hasBioticRegen) this.log(`> BIOTIC REGEN APPLIED (+${bioticRegenAmount})`, playerId);
        if (baseEnergyRegen > 0 || bonusEnergyRegen > 0) {
            const regenLabel = bonusEnergyRegen > 0 ? `${baseEnergyRegen}+${bonusEnergyRegen}` : `${baseEnergyRegen}`;
            this.log(`> ENERGY REGEN APPLIED (+${regenLabel})`, playerId);
        }
    }

    public selectCard(cardId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;

        if (this.checkPlayerRestricted(this.state.currentTurn)) return;
        if (this.checkCardPlayRestricted(this.state.currentTurn)) return;

        const currentDeck = this.state.decks[this.state.currentTurn];
        const card = currentDeck.find(c => c.id === cardId);
        if (card) {
            const clearDeliveryHighlights = {
                ...this.state.recentlyDeliveredCardIds,
                [this.state.currentTurn]: []
            };

            this.state = {
                ...this.state,
                selectedCardId: cardId,
                selectedUnitId: null,
                previewPath: [],
                interactionState: { mode: 'NORMAL' },
                deliveryHappened: false,
                recentlyDeliveredCardIds: clearDeliveryHighlights
            };
            this.log(card.category === CardCategory.ACTION
                ? `> ACTION PREP: ${card.name.toUpperCase()}`
                : `> UNIT PREP: ${card.name.toUpperCase()}`, this.state.currentTurn);
            this.notify();
        }
    }

    public selectUnit(unitId: string | null) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;

        if (unitId) {
            const unit = this.state.units.find(u => u.id === unitId);
            if (unit) {
                const clearDeliveryHighlights = {
                    ...this.state.recentlyDeliveredCardIds,
                    [this.state.currentTurn]: []
                };

                this.state = {
                    ...this.state,
                    selectedUnitId: unitId,
                    selectedCardId: null,
                    previewPath: [],
                    interactionState: { mode: 'NORMAL' },
                    deliveryHappened: false,
                    recentlyDeliveredCardIds: clearDeliveryHighlights
                };

                if (unit.playerId === this.state.currentTurn) {
                    if (this.checkUnitFrozen(unit)) {
                        this.log(`> UNIT SELECTED (FROZEN)`, unit.playerId);
                    } else if (this.getEffectiveMovement(unit) > 0 && unit.status.stepsTaken >= this.getEffectiveMovement(unit)) {
                        this.log(`> UNIT SELECTED (NO MOVEMENT LEFT)`, unit.playerId);
                    } else if (this.getEffectiveMovement(unit) === 0) {
                        this.log(`> STRUCTURE ACCESSED`, unit.playerId);
                    } else {
                        const remaining = this.getEffectiveMovement(unit) - unit.status.stepsTaken;
                        this.log(`> UNIT READY (MOVES: ${remaining})`, unit.playerId);
                    }
                } else if (unit.playerId === PlayerId.NEUTRAL) {
                    this.log(`> NEUTRAL ENTITY SCANNED`);
                } else {
                    this.log(`> ENEMY SCAN COMPLETE`, this.state.currentTurn);
                }
                this.notify();
                return;
            }
        }
        this.state = { ...this.state, selectedUnitId: unitId, selectedCardId: null, previewPath: [], interactionState: { mode: 'NORMAL' } };
        this.notify();
    }

    public selectNearestControlledUnit(reverse: boolean = false) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (!this.state.selectedUnitId) return;

        const referenceUnit = this.state.units.find(u => u.id === this.state.selectedUnitId);
        if (!referenceUnit) return;

        const controlledPlayerId = this.state.isMultiplayer
            ? (this.state.myPlayerId || this.state.currentTurn)
            : this.state.currentTurn;

        const referenceCenterX = referenceUnit.position.x + ((referenceUnit.stats.size - 1) / 2);
        const referenceCenterZ = referenceUnit.position.z + ((referenceUnit.stats.size - 1) / 2);

        const controlledUnits = this.state.units
            .filter(u => u.playerId === controlledPlayerId)
            .filter(u => !u.status.isDying);

        if (controlledUnits.length <= 1) return;

        const controlledSetKey = controlledUnits
            .map(u => u.id)
            .sort((a, b) => a.localeCompare(b))
            .join('|');

        const shouldRebuildCycle =
            this.unitCycleOrder.length === 0 ||
            this.unitCycleSetKey !== controlledSetKey ||
            this.lastTabSelectionId !== referenceUnit.id ||
            !this.unitCycleOrder.includes(referenceUnit.id);

        if (shouldRebuildCycle) {
            const remaining = controlledUnits.filter(u => u.id !== referenceUnit.id);
            const orderedIds = [referenceUnit.id];
            let cursor = referenceUnit;

            while (remaining.length > 0) {
                remaining.sort((a, b) => {
                    const aCenterX = a.position.x + ((a.stats.size - 1) / 2);
                    const aCenterZ = a.position.z + ((a.stats.size - 1) / 2);
                    const bCenterX = b.position.x + ((b.stats.size - 1) / 2);
                    const bCenterZ = b.position.z + ((b.stats.size - 1) / 2);
                    const cursorCenterX = cursor.position.x + ((cursor.stats.size - 1) / 2);
                    const cursorCenterZ = cursor.position.z + ((cursor.stats.size - 1) / 2);

                    const distanceA = Math.abs(cursorCenterX - aCenterX) + Math.abs(cursorCenterZ - aCenterZ);
                    const distanceB = Math.abs(cursorCenterX - bCenterX) + Math.abs(cursorCenterZ - bCenterZ);

                    if (distanceA !== distanceB) return distanceA - distanceB;
                    if (a.position.z !== b.position.z) return a.position.z - b.position.z;
                    if (a.position.x !== b.position.x) return a.position.x - b.position.x;
                    return a.id.localeCompare(b.id);
                });

                const nextUnit = remaining.shift()!;
                orderedIds.push(nextUnit.id);
                cursor = nextUnit;
            }

            this.unitCycleOrder = orderedIds;
            this.unitCycleSetKey = controlledSetKey;
        }

        const currentIndex = this.unitCycleOrder.indexOf(referenceUnit.id);
        if (currentIndex === -1) return;

        const direction = reverse ? -1 : 1;
        const nextIndex = (currentIndex + direction + this.unitCycleOrder.length) % this.unitCycleOrder.length;
        const nextId = this.unitCycleOrder[nextIndex];
        this.lastTabSelectionId = nextId;
        this.selectUnit(nextId);
    }

    public selectTerrainTool(tool: TerrainTool) {
        if (!this.state.isDevMode) return;

        this.state.selectedCardId = null;
        this.state.selectedUnitId = null;
        this.state.previewPath = [];

        this.state.interactionState = {
            mode: 'TERRAIN_EDIT',
            terrainTool: tool,
            terrainBrushSize: clampTerrainBrushSize(this.state.interactionState.terrainBrushSize ?? 1)
        };

        this.log(`> MAP EDITOR: ${tool} TOOL ACTIVE`);
        this.notify();
    }

    public adjustTerrainBrushSize(delta: number) {
        const { mode, terrainTool } = this.state.interactionState;
        const isTerrainBrushMode = mode === 'TERRAIN_EDIT' && isBrushEnabledTerrainTool(terrainTool);
        const isMassRetreatMode = mode === 'MASS_RETREAT_TARGETING';
        if (!isTerrainBrushMode && !isMassRetreatMode) return;
        if (!isMassRetreatMode && !this.state.isDevMode) return;

        const currentSize = isMassRetreatMode
            ? Math.max(2, Math.min(4, this.state.interactionState.terrainBrushSize ?? 2))
            : clampTerrainBrushSize(this.state.interactionState.terrainBrushSize ?? 1);
        const nextSize = isMassRetreatMode
            ? Math.max(2, Math.min(4, currentSize + delta))
            : clampTerrainBrushSize(currentSize + delta);
        if (nextSize === currentSize) return;

        this.state.interactionState = {
            ...this.state.interactionState,
            terrainBrushSize: nextSize
        };

        if (isMassRetreatMode) {
            this.log(`> MASS RETREAT ZONE ${nextSize}x${nextSize}`);
        } else {
            this.log(`> MAP EDITOR: IMPACT ZONE ${nextSize}x${nextSize}`);
        }
        this.notify();
    }

    private handleTerrainEdit(x: number, z: number) {
        const { terrainTool } = this.state.interactionState;
        if (!terrainTool) return;

        const brushSize = isBrushEnabledTerrainTool(terrainTool)
            ? clampTerrainBrushSize(this.state.interactionState.terrainBrushSize ?? 1)
            : 1;

        const brushFootprint = getTerrainBrushFootprint(x, z, brushSize);
        const occupied = this.getAllOccupiedCells();
        const deletedSet = new Set(this.state.deletedTiles);

        const targetKeys: string[] = [];
        for (const pos of brushFootprint) {
            if (!this.isWithinMap(pos.x, pos.z)) continue;

            const key = `${pos.x},${pos.z}`;
            if (!this.discovered.has(key)) continue;
            if (occupied.has(key)) continue;

            targetKeys.push(key);
        }

        if (targetKeys.length === 0) {
            this.log(`> ERROR: NO VALID TILES IN IMPACT ZONE`);
            return;
        }

        const ensureTerrainTile = (key: string) => {
            if (!this.state.terrain[key]) {
                this.state.terrain[key] = { type: 'NORMAL', elevation: 0, rotation: 0 };
            }
            deletedSet.delete(key);
            return this.state.terrain[key];
        };

        if (terrainTool === 'ELEVATE') {
            targetKeys.forEach(key => {
                const tile = ensureTerrainTile(key);
                tile.elevation = Math.min(tile.elevation + 1, 10);
            });

            if (brushSize === 1 && targetKeys.length === 1) {
                this.log(`> TILE ELEVATED TO ${this.state.terrain[targetKeys[0]].elevation}`);
            } else {
                this.log(`> ELEVATED ${targetKeys.length} TILES`);
            }
        } else if (terrainTool === 'LOWER') {
            targetKeys.forEach(key => {
                const tile = ensureTerrainTile(key);
                tile.elevation = Math.max(tile.elevation - 1, -5);
            });

            if (brushSize === 1 && targetKeys.length === 1) {
                this.log(`> TILE LOWERED TO ${this.state.terrain[targetKeys[0]].elevation}`);
            } else {
                this.log(`> LOWERED ${targetKeys.length} TILES`);
            }
        } else if (terrainTool === 'RAMP') {
            let rotated = 0;
            let converted = 0;

            targetKeys.forEach(key => {
                const tile = ensureTerrainTile(key);
                if (tile.type === 'RAMP') {
                    tile.rotation = (tile.rotation + 1) % 4;
                    rotated++;
                } else {
                    tile.type = 'RAMP';
                    tile.rotation = 0;
                    converted++;
                }
            });

            if (brushSize === 1 && targetKeys.length === 1) {
                const tile = this.state.terrain[targetKeys[0]];
                if (tile.type === 'RAMP' && converted === 0) {
                    this.log(`> RAMP ROTATED TO ${tile.rotation * 90}DEG`);
                } else {
                    this.log(`> TILE CONVERTED TO RAMP`);
                }
            } else {
                this.log(`> TILT APPLIED (${converted} CONVERTED, ${rotated} ROTATED)`);
            }
        } else if (terrainTool === 'DESTROY') {
            targetKeys.forEach(key => {
                const tile = ensureTerrainTile(key);
                tile.type = 'NORMAL';
                tile.elevation = 0;
                tile.rotation = 0;
                tile.landingZone = undefined;
                tile.temporaryLandingZoneExpiresAtTurn = undefined;
                tile.temporaryLandingZoneOriginalOwner = undefined;
            });

            if (brushSize === 1 && targetKeys.length === 1) {
                this.log(`> TILE FLATTENED`);
            } else {
                this.log(`> FLATTENED ${targetKeys.length} TILES`);
            }
        } else if (terrainTool === 'DELETE') {
            const deleted = new Set(targetKeys);
            targetKeys.forEach(key => {
                delete this.state.terrain[key];
                this.discovered.delete(key);
                deletedSet.add(key);
            });

            this.state.revealedTiles = this.state.revealedTiles.filter(k => !deleted.has(k));

            if (brushSize === 1 && targetKeys.length === 1) {
                this.log(`> TILE DELETED`);
            } else {
                this.log(`> DELETED ${targetKeys.length} TILES`);
            }
        } else if (this.getSpawnToolPlayerId(terrainTool)) {
            const playerId = this.getSpawnToolPlayerId(terrainTool)!;
            const clearZone = targetKeys.every(key => this.state.terrain[key]?.landingZone === playerId);
            targetKeys.forEach(key => {
                const tile = ensureTerrainTile(key);
                tile.landingZone = clearZone ? undefined : playerId;
                tile.temporaryLandingZoneExpiresAtTurn = undefined;
                tile.temporaryLandingZoneOriginalOwner = undefined;
            });

            if (clearZone) {
                this.log(`> CLEARED ${playerId} LANDING ZONE (${targetKeys.length} TILES)`);
            } else {
                this.log(`> MARKED ${playerId} LANDING ZONE (${targetKeys.length} TILES)`);
            }
        } else if (terrainTool === 'PLACE_COLLECTIBLE') {
            const key = targetKeys[0];
            if (!key) return;

            const [targetX, targetZ] = key.split(',').map(Number);
            const existingIdx = this.state.collectibles.findIndex(c => c.position.x === targetX && c.position.z === targetZ);
            if (existingIdx > -1) {
                this.state.collectibles.splice(existingIdx, 1);
                this.log(`> COLLECTIBLE REMOVED`);
            } else {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'MONEY_PRIZE',
                    value: 50,
                    position: { x: targetX, z: targetZ }
                });
                this.log(`> COLLECTIBLE PLANTED ($50)`);
            }
        } else if (terrainTool === 'PLACE_HEALTH') {
            const key = targetKeys[0];
            if (!key) return;

            const [targetX, targetZ] = key.split(',').map(Number);
            const existingIdx = this.state.collectibles.findIndex(c => c.position.x === targetX && c.position.z === targetZ);
            if (existingIdx > -1) {
                this.state.collectibles.splice(existingIdx, 1);
                this.log(`> COLLECTIBLE REMOVED`);
            } else {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'HEALTH_PACK',
                    value: 75,
                    position: { x: targetX, z: targetZ }
                });
                this.log(`> HEALTH PACK PLANTED (+75 HP)`);
            }
        } else if (terrainTool === 'PLACE_ENERGY') {
            const key = targetKeys[0];
            if (!key) return;

            const [targetX, targetZ] = key.split(',').map(Number);
            const existingIdx = this.state.collectibles.findIndex(c => c.position.x === targetX && c.position.z === targetZ);
            if (existingIdx > -1) {
                this.state.collectibles.splice(existingIdx, 1);
                this.log(`> COLLECTIBLE REMOVED`);
            } else {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'ENERGY_CELL',
                    value: 50,
                    position: { x: targetX, z: targetZ }
                });
                this.log(`> ENERGY CELL PLANTED (+50 EN)`);
            }
        } else if (terrainTool === 'PLACE_PERK') {
            const key = targetKeys[0];
            if (!key) return;

            const [targetX, targetZ] = key.split(',').map(Number);
            const existingIdx = this.state.collectibles.findIndex(c => c.position.x === targetX && c.position.z === targetZ);
            if (existingIdx > -1) {
                this.state.collectibles.splice(existingIdx, 1);
                this.log(`> COLLECTIBLE REMOVED`);
            } else {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'PERK_CACHE',
                    value: 1,
                    position: { x: targetX, z: targetZ }
                });
                this.log(`> PERK CACHE PLANTED (+1 TALENT PICK)`);
            }
        }

        this.state.terrain = { ...this.state.terrain };
        this.state.deletedTiles = Array.from(deletedSet);
        this.notify();
    }

    public activateSummonAbility(unitId: string, isRemote: boolean = false) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (!isRemote && this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.CONE) return;

        if (unit.stats.energy < 50) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/50)`, unit.playerId);
            return;
        }

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('SUMMON_ACTIVATE', { unitId });
            return;
        }

        this.state.interactionState = {
            mode: 'ABILITY_SUMMON',
            sourceUnitId: unit.id,
            unitType: UnitType.BOX,
            remaining: 2,
            playerId: unit.playerId
        };
        this.log(`> SUMMON PROTOCOL INITIATED: SELECT TARGETS`, unit.playerId);
        this.notify();
    }

    public activateTeleportAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.SOLDIER) return;

        if (unit.stats.energy < 25) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/25)`, unit.playerId);
            return;
        }

        this.state.interactionState = {
            mode: 'ABILITY_TELEPORT',
            sourceUnitId: unit.id,
            playerId: unit.playerId
        };
        this.log(`> TELEPORT PROTOCOL: SELECT DESTINATION`, unit.playerId);
        this.notify();
    }

    public activateFreezeAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.SOLDIER) return;

        if (unit.stats.energy < 50) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/50)`, unit.playerId);
            return;
        }

        this.state.interactionState = {
            mode: 'ABILITY_FREEZE',
            sourceUnitId: unit.id,
            playerId: unit.playerId
        };
        this.log(`> CRYO SHOT CHARGED: SELECT TARGET UNIT`, unit.playerId);
        this.notify();
    }

    public activateHealAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || (unit.type !== UnitType.MEDIC && unit.type !== UnitType.REPAIR_BOT)) return;

        if (unit.stats.energy < 25) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/25)`, unit.playerId);
            return;
        }

        this.state.interactionState = {
            mode: 'ABILITY_HEAL',
            sourceUnitId: unit.id,
            playerId: unit.playerId
        };
        this.log(
            unit.type === UnitType.REPAIR_BOT
                ? `> STRUCTURAL REPAIR READY: SELECT FRIENDLY BUILDING OR MACHINE`
                : `> NANO-REPAIR READY: SELECT FRIENDLY CREATURE`,
            unit.playerId
        );
        this.notify();
    }

    public activateRestoreEnergyAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.MEDIC) return;

        if (unit.stats.energy < 25) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/25)`, unit.playerId);
            return;
        }

        this.state.interactionState = {
            mode: 'ABILITY_RESTORE_ENERGY',
            sourceUnitId: unit.id,
            playerId: unit.playerId
        };
        this.log(`> ENERGY SYPHON READY: SELECT TARGET`, unit.playerId);
        this.notify();
    }

    public activateDispelAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.HACKER) return;

        if (unit.status.mindControlTargetId) {
            this.log(`> CHANNEL LOCK ACTIVE: BREAK LINK FIRST`, unit.playerId);
            return;
        }

        if (unit.stats.energy < 25) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/25)`, unit.playerId);
            return;
        }

        this.state.interactionState = {
            mode: 'ABILITY_DISPEL',
            sourceUnitId: unit.id,
            playerId: unit.playerId
        };
        this.log(`> SYSTEM PURGE READY: SELECT FRIENDLY CREATURE OR MACHINE`, unit.playerId);
        this.notify();
    }

    public activateMindControlAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.HACKER) return;

        if (unit.stats.energy < 50) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/50)`, unit.playerId);
            return;
        }

        if (unit.status.mindControlTargetId) {
            if (this.state.isMultiplayer) {
                this.dispatchAction('MIND_CONTROL_BREAK', { hackerId: unit.id });
                return;
            }
            this.breakMindControl(unit.id);
            return;
        }

        this.state.interactionState = {
            mode: 'ABILITY_MIND_CONTROL',
            sourceUnitId: unit.id,
            playerId: unit.playerId
        };
        this.log(`> UPLINK ESTABLISHED: SELECT TARGET SYSTEM`, unit.playerId);
        this.notify();
    }

    public setUnitStats(unitId: string, stats: {
        hp?: number;
        maxHp?: number;
        energy?: number;
        maxEnergy?: number;
        attack?: number;
        range?: number;
        movement?: number;
        level?: number;
    }) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (!this.canEditUnitStats()) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit) return;

        const nextMaxHp = typeof stats.maxHp === 'number'
            ? Math.max(1, Math.round(stats.maxHp))
            : undefined;
        const resolvedMaxHp = nextMaxHp ?? unit.stats.maxHp;
        const nextHp = typeof stats.hp === 'number'
            ? Math.max(0, Math.min(resolvedMaxHp, Math.round(stats.hp)))
            : undefined;
        const nextMaxEnergy = typeof stats.maxEnergy === 'number'
            ? Math.max(0, Math.round(stats.maxEnergy))
            : undefined;
        const resolvedMaxEnergy = nextMaxEnergy ?? unit.stats.maxEnergy;
        const nextEnergy = typeof stats.energy === 'number'
            ? Math.max(0, Math.min(resolvedMaxEnergy, Math.round(stats.energy)))
            : undefined;
        const nextAttack = typeof stats.attack === 'number'
            ? Math.max(0, Math.round(stats.attack))
            : undefined;
        const nextRange = typeof stats.range === 'number'
            ? Math.max(0, Math.round(stats.range))
            : undefined;
        const nextMovement = typeof stats.movement === 'number'
            ? Math.max(0, Math.round(stats.movement))
            : undefined;
        const nextLevel = typeof stats.level === 'number'
            ? Math.max(1, Math.round(stats.level))
            : undefined;

        if (
            typeof nextHp === 'undefined' &&
            typeof nextMaxHp === 'undefined' &&
            typeof nextEnergy === 'undefined' &&
            typeof nextMaxEnergy === 'undefined' &&
            typeof nextAttack === 'undefined' &&
            typeof nextRange === 'undefined' &&
            typeof nextMovement === 'undefined' &&
            typeof nextLevel === 'undefined'
        ) {
            return;
        }

        if (this.state.isMultiplayer) {
            this.dispatchAction('ADMIN_SET_UNIT_STATS', {
                unitId,
                ...(typeof nextHp === 'number' ? { hp: nextHp } : {}),
                ...(typeof nextMaxHp === 'number' ? { maxHp: nextMaxHp } : {}),
                ...(typeof nextEnergy === 'number' ? { energy: nextEnergy } : {}),
                ...(typeof nextMaxEnergy === 'number' ? { maxEnergy: nextMaxEnergy } : {}),
                ...(typeof nextAttack === 'number' ? { attack: nextAttack } : {}),
                ...(typeof nextRange === 'number' ? { range: nextRange } : {}),
                ...(typeof nextMovement === 'number' ? { movement: nextMovement } : {}),
                ...(typeof nextLevel === 'number' ? { level: nextLevel } : {})
            });
            return;
        }

        this.applyUnitStatsEdit(unitId, {
            hp: nextHp,
            maxHp: nextMaxHp,
            energy: nextEnergy,
            maxEnergy: nextMaxEnergy,
            attack: nextAttack,
            range: nextRange,
            movement: nextMovement,
            level: nextLevel
        });
    }

    public purchaseFluxTowerAttackUpgrade(unitId: string, isRemote: boolean = false) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (!isRemote && this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unitIndex = this.state.units.findIndex((unit) => unit.id === unitId);
        if (unitIndex === -1) return;

        const unit = this.state.units[unitIndex];
        if (unit.type !== UnitType.TOWER) return;
        if (unit.playerId !== this.state.currentTurn) return;

        const availableUpgrades = this.getFluxTowerAvailableUpgradeCount(unit);
        if (availableUpgrades <= 0) {
            const nextUnlockLevel = (getFluxTowerUnlockedUpgradeCount(unit.level) + 1) * FLUX_TOWER_ATTACK_UPGRADE_LEVEL_STEP;
            this.log(`> FLUX OVERCHARGE LOCKED: NEXT UPGRADE AT LEVEL ${nextUnlockLevel}`, unit.playerId);
            this.notify();
            return;
        }

        if (this.state.credits[unit.playerId] < FLUX_TOWER_ATTACK_UPGRADE_COST) {
            this.log(`> INSUFFICIENT CREDITS ($${this.state.credits[unit.playerId]}/$${FLUX_TOWER_ATTACK_UPGRADE_COST})`, unit.playerId);
            this.notify();
            return;
        }

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('FLUX_TOWER_ATTACK_UPGRADE', { unitId });
            return;
        }

        const purchasedCount = unit.status.fluxTowerAttackUpgradesPurchased ?? 0;
        const nextAttack = unit.stats.attack + FLUX_TOWER_ATTACK_UPGRADE_AMOUNT;
        const remainingUpgrades = availableUpgrades - 1;

        this.state.credits = {
            ...this.state.credits,
            [unit.playerId]: this.state.credits[unit.playerId] - FLUX_TOWER_ATTACK_UPGRADE_COST
        };
        this.state.units[unitIndex] = {
            ...unit,
            stats: {
                ...unit.stats,
                attack: nextAttack
            },
            status: {
                ...unit.status,
                fluxTowerAttackUpgradesPurchased: purchasedCount + 1
            }
        };

        this.log(
            `> FLUX TOWER OVERCHARGED: ATK +${FLUX_TOWER_ATTACK_UPGRADE_AMOUNT} (${nextAttack})${remainingUpgrades > 0 ? ` | ${remainingUpgrades} STACKED UPGRADE${remainingUpgrades === 1 ? '' : 'S'} READY` : ''}`,
            unit.playerId
        );
        this.notify();

        if (isRemote) {
            this.replicateAuthoritativeState();
        }
    }

    private applyUnitStatsEdit(unitId: string, stats: {
        hp?: number;
        maxHp?: number;
        energy?: number;
        maxEnergy?: number;
        attack?: number;
        range?: number;
        movement?: number;
        level?: number;
    }, isRemote: boolean = false) {
        const unitIndex = this.state.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return;

        const unit = this.state.units[unitIndex];
        const nextMaxHp = typeof stats.maxHp === 'number'
            ? Math.max(1, Math.round(stats.maxHp))
            : unit.stats.maxHp;
        const nextMaxEnergy = typeof stats.maxEnergy === 'number'
            ? Math.max(0, Math.round(stats.maxEnergy))
            : unit.stats.maxEnergy;
        const nextHp = typeof stats.hp === 'number'
            ? Math.max(0, Math.min(nextMaxHp, Math.round(stats.hp)))
            : Math.max(0, Math.min(nextMaxHp, unit.stats.hp));
        const nextEnergy = typeof stats.energy === 'number'
            ? Math.max(0, Math.min(nextMaxEnergy, Math.round(stats.energy)))
            : Math.max(0, Math.min(nextMaxEnergy, unit.stats.energy));
        const nextAttack = typeof stats.attack === 'number'
            ? Math.max(0, Math.round(stats.attack))
            : unit.stats.attack;
        const nextRange = typeof stats.range === 'number'
            ? Math.max(0, Math.round(stats.range))
            : unit.stats.range;
        const nextMovement = typeof stats.movement === 'number'
            ? Math.max(0, Math.round(stats.movement))
            : unit.stats.movement;
        const nextLevel = typeof stats.level === 'number'
            ? Math.max(1, Math.round(stats.level))
            : unit.level;

        if (
            nextHp === unit.stats.hp &&
            nextMaxHp === unit.stats.maxHp &&
            nextEnergy === unit.stats.energy &&
            nextMaxEnergy === unit.stats.maxEnergy &&
            nextAttack === unit.stats.attack &&
            nextRange === unit.stats.range &&
            nextMovement === unit.stats.movement &&
            nextLevel === unit.level
        ) return;

        this.state.units[unitIndex] = {
            ...unit,
            level: nextLevel,
            stats: {
                ...unit.stats,
                hp: nextHp,
                maxHp: nextMaxHp,
                energy: nextEnergy,
                maxEnergy: nextMaxEnergy,
                attack: nextAttack,
                range: nextRange,
                movement: nextMovement
            },
            status: {
                ...unit.status,
                stepsTaken: Math.min(unit.status.stepsTaken, nextMovement)
            }
        };

        const vitalsSummary = [
            `LVL ${nextLevel}`,
            `HP ${nextHp}/${nextMaxHp}`,
            `EN ${nextEnergy}/${nextMaxEnergy}`,
            `ATK ${nextAttack}`,
            `RNG ${nextRange}`,
            `MOV ${nextMovement}`
        ].filter(Boolean).join(' | ');
        this.log(`> [ADMIN] ${unit.type} UPDATED: ${vitalsSummary}`, unit.playerId);

        if (nextHp === 0) {
            if (this.state.selectedUnitId === unitId) {
                this.state.selectedUnitId = null;
            }
            this.removeUnit(unitId);
            return;
        }

        this.notify();

        if (isRemote) {
            this.replicateAuthoritativeState();
        }
    }

    public destroyUnit(unitId: string) {
        if (!this.state.isDevMode) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (unit) {
            this.log(`> [DEV] UNIT REMOVED: ${unit.type}`, unit.playerId);
            this.removeUnit(unitId);
            this.state.selectedUnitId = null;
            this.notify();
        }
    }

    public setNeutralUnitPerkDrop(unitId: string, enabled: boolean) {
        if (!this.state.isDevMode) return;

        const unitIndex = this.state.units.findIndex((unit) => unit.id === unitId);
        if (unitIndex === -1) return;

        const unit = this.state.units[unitIndex];
        if (unit.playerId !== PlayerId.NEUTRAL) return;

        this.state.units[unitIndex] = {
            ...unit,
            status: {
                ...unit.status,
                dropsPerkCacheOnDeath: enabled
            }
        };

        this.log(
            `> [DEV] NEUTRAL PERK DROP ${enabled ? 'ENABLED' : 'DISABLED'}: ${unit.type}`,
            PlayerId.NEUTRAL
        );
        this.notify();
    }

    public rotateUnit(unitId: string) {
        if (!this.state.isDevMode) return;

        const unitIndex = this.state.units.findIndex(u => u.id === unitId);
        if (unitIndex !== -1) {
            const unit = this.state.units[unitIndex];
            const currentRotation = unit.rotation || 0;
            this.state.units[unitIndex].rotation = currentRotation + (Math.PI / 2);
            this.log(`> [DEV] UNIT ROTATED: ${unit.type}`, unit.playerId);
            this.notify();
        }
    }



    // --- UNIT PLACEMENT LOGIC ---

    public emitPlaceUnit(payload: PlacePayload, isRemote: boolean = false) {
        const { playerId, position, cardId } = payload;

        if (!isRemote && this.checkPlayerRestricted(playerId)) return;
        if (this.checkCardPlayRestricted(playerId)) return;

        // In multiplayer, local client only sends command and waits for authoritative broadcast.
        if (!isRemote && this.state.isMultiplayer) {
            const deck = this.state.decks[playerId];
            let localCardIndex = deck.findIndex(c => c.id === cardId);
            if (localCardIndex === -1 && payload.cardType) {
                localCardIndex = deck.findIndex(c => c.type === payload.cardType);
            }
            if (localCardIndex === -1) return;

            const localCard = deck[localCardIndex];
            const unitId = payload.unitId || (localCard.category === CardCategory.UNIT
                ? `${playerId}-unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                : undefined);

            this.dispatchAction('PLACE_UNIT', {
                ...payload,
                cardType: localCard.type,
                unitId
            });
            return;
        }

        // Find card in deck
        const deck = this.state.decks[playerId];
        let cardIndex = deck.findIndex(c => c.id === cardId);
        if (cardIndex === -1 && isRemote && payload.cardType) {
            cardIndex = deck.findIndex(c => c.type === payload.cardType);
        }
        if (cardIndex === -1) return;

        const card = deck[cardIndex];

        // Validity Check
        const isAction = card.category === CardCategory.ACTION;

        if (isAction) {
            if (!isRemote) {
                this.dispatchAction('PLACE_UNIT', {
                    ...payload,
                    cardType: card.type
                });
            }

            if (card.type === UnitType.ION_CANNON) {
                this.state.interactionState = {
                    mode: 'ION_CANNON_TARGETING',
                    playerId: playerId,
                };
                this.log(`> ION CANNON CHARGING... SELECT TARGET`, playerId);
                this.notify();
                this.notify();
                return;
            }
            if (card.type === UnitType.FORWARD_BASE) {
                this.state.interactionState = {
                    mode: 'FORWARD_BASE_TARGETING',
                    playerId: playerId,
                };
                this.log(`> DEPLOYMENT SCAN: SELECT TARGET ZONE`, playerId);
                this.notify();
                return;
            }
            if (card.type === UnitType.MASS_RETREAT) {
                this.state.interactionState = {
                    mode: 'MASS_RETREAT_TARGETING',
                    playerId,
                    terrainBrushSize: 2
                };
                this.log(`> MASS RETREAT READY: SELECT TARGET ZONE`, playerId);
                this.notify();
                return;
            }
            if (card.type === UnitType.IMMORTALITY_SHIELD) {
                this.state.interactionState = {
                    mode: 'ABILITY_IMMORTALITY_SHIELD',
                    playerId
                };
                this.log(`> IMMORTALITY SHIELD READY: SELECT FRIENDLY CREATURE OR MACHINE`, playerId);
                this.notify();
                return;
            }
            if (card.type === UnitType.SYSTEM_FREEZE) {
                const enemyUnits = this.state.units.filter((unit) =>
                    this.isContestedPlayer(unit.playerId)
                    && this.arePlayersHostile(playerId, unit.playerId)
                    && !BUILDING_TYPES.includes(unit.type)
                );

                enemyUnits.forEach(u => {
                    this.addUnitEffect(u.id, { name: 'SYSTEM FREEZE', description: 'Global hack initiated.', icon: '❄️', duration: 1, maxDuration: 1 });
                });

                this.log(`> GLOBAL SYSTEM FREEZE INITIATED`, playerId);
                if (!this.state.isDevMode) {
                    // Consume Card
                    const newDeck = [...deck];
                    newDeck.splice(cardIndex, 1);
                    this.state.decks[playerId] = newDeck;
                }
                this.state.selectedCardId = null;

                this.checkWinCondition(); // Check after card consumption
                this.notify();
                return;
            }

            if (card.type === UnitType.MOBILITY_SABOTAGE) {
                this.applyMobilitySabotage(playerId);
                return;
            }

            if (card.type === UnitType.MOBILITY_SURGE) {
                this.applyMobilitySurge(playerId);
                return;
            }

            if (card.type === UnitType.BLEED) {
                this.applyBleed(playerId);
                return;
            }

            if (card.type === UnitType.SILENCE) {
                this.applySilence(playerId);
                return;
            }

            if (card.type === UnitType.LOGISTICS_DELAY) {
                this.applyLogisticsDelay(playerId);
                return;
            }

            if (card.type === UnitType.TACTICAL_RETREAT) {
                const targetUnit = this.state.units.find(u =>
                    position.x >= u.position.x && position.x < u.position.x + u.stats.size &&
                    position.z >= u.position.z && position.z < u.position.z + u.stats.size
                );

                if (!targetUnit) {
                    this.state.systemMessage = "TACTICAL RETREAT: NO UNIT SELECTED";
                    this.log(`> TACTICAL RETREAT: INVALID TARGET`, playerId);
                    this.notify();
                    return;
                }

                if (targetUnit.playerId !== playerId) {
                    this.state.systemMessage = "TACTICAL RETREAT: CANNOT TARGET ENEMY";
                    this.log(`> TACTICAL RETREAT: INVALID TARGET (ENEMY)`, playerId);
                    this.notify();
                    return;
                }

                const retreatPos = this.findNearestRetreatPosition(targetUnit, playerId);

                if (!retreatPos) {
                    this.state.systemMessage = "TACTICAL RETREAT FAILED: NO DEPLOYMENT ZONE AVAILABLE";
                    this.log(`> TACTICAL RETREAT FAILED: NO VALID ZONES`, playerId);
                    this.notify();
                    return;
                }

                if (!this.state.isDevMode) {
                    const newDeck = [...deck];
                    newDeck.splice(cardIndex, 1);
                    this.state.decks[playerId] = newDeck;
                    this.state.selectedCardId = null;
                }

                this.executeTeleportRelocation(targetUnit.id, retreatPos, {
                    playerId,
                    logMessage: `> TACTICAL RETREAT: ${targetUnit.type} RELOCATED TO ${retreatPos.x},${retreatPos.z}`,
                    wormholeLandingZoneMode: this.playerHasWormholeTalent(playerId) ? 'SOURCE_ONLY' : 'NONE'
                });

                this.checkWinCondition();
                return;
            }

            if (card.type === UnitType.LANDING_SABOTAGE) {
                const tileKey = `${position.x},${position.z}`;
                const targetTile = this.state.terrain[tileKey];
                if (!targetTile) {
                    this.state.systemMessage = "LANDING SABOTAGE: INVALID TILE";
                    this.log(`> LANDING SABOTAGE FAILED: NO TILE`, playerId);
                    this.notify();
                    return;
                }

                if (!targetTile.landingZone || !this.arePlayersHostile(playerId, targetTile.landingZone)) {
                    this.state.systemMessage = "LANDING SABOTAGE: TARGET ENEMY LANDING ZONE";
                    this.log(`> LANDING SABOTAGE FAILED: INVALID TARGET`, playerId);
                    this.notify();
                    return;
                }

                this.clearLandingZoneOwnership(tileKey, targetTile.landingZone);

                if (!this.state.isDevMode) {
                    const newDeck = [...deck];
                    newDeck.splice(cardIndex, 1);
                    this.state.decks[playerId] = newDeck;
                }
                this.state.selectedCardId = null;

                this.log(`> LANDING SABOTAGE: ENEMY ZONE DISABLED AT ${position.x},${position.z}`, playerId);
                this.triggerTilePulse(tileKey, 'SABOTAGE');
                return;
            }
            return;
        }

        // UNIT PLACEMENT
        const size = card.baseStats?.size || 1;
        const requiresZone = true;

        if (!this.isValidPlacement(position.x, position.z, size, playerId, requiresZone, isRemote)) {
            this.log(`> INVALID DEPLOYMENT ZONE`, playerId);
            return;
        }

        if (card.type === UnitType.WALL) {
            // Wall Placement Mode
            this.state.interactionState = {
                mode: 'WALL_PLACEMENT',
                playerId: playerId,
                remaining: 4, // Chain length after the initial wall, for 5 total
                unitType: UnitType.WALL,
                lastPos: position
            };
            const spawnedUnitId = payload.unitId || `${playerId}-unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            this.spawnUnit(UnitType.WALL, position, playerId, spawnedUnitId);

            if (!isRemote) {
                this.dispatchAction('PLACE_UNIT', {
                    ...payload,
                    cardType: card.type,
                    unitId: spawnedUnitId
                });
            }

            if (!this.state.isDevMode) {
                // Consume Card
                const newDeck = [...deck];
                newDeck.splice(cardIndex, 1);
                this.state.decks[playerId] = newDeck;
            }
            this.state.selectedCardId = null;

            this.log(`> WALL CONSTRUCTION STARTED`, playerId);
            this.checkWinCondition();
            this.notify();
            return;
        }

        // Normal Unit Spawn
        const spawnedUnitId = payload.unitId || `${playerId}-unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.spawnUnit(card.type, position, playerId, spawnedUnitId);

        if (!isRemote) {
            this.dispatchAction('PLACE_UNIT', {
                ...payload,
                cardType: card.type,
                unitId: spawnedUnitId
            });
        }

        if (!this.state.isDevMode) {
            // Consume Card
            const newDeck = [...deck];
            newDeck.splice(cardIndex, 1);
            this.state.decks[playerId] = newDeck;

            this.state.selectedCardId = null; // Deselect
        }
        this.log(`> UNIT DEPLOYED: ${card.name}`, playerId);
        this.checkWinCondition(); // Check after spawn (and consumption)
        this.notify();
    }

    // -------------------------

    public handleTileClick(x: number, z: number, pointer?: DebugPointerMeta) {
        const tile = { x, z };
        this.pushDebugTrace('handleTileClick.entry', 'INFO', `tile click ${x},${z}`, { tile, pointer });

        if (this.state.appStatus !== AppStatus.PLAYING) {
            this.pushDebugTrace('handleTileClick.reject', 'REJECT', `appStatus=${this.state.appStatus}`, { tile, pointer, notify: true });
            return;
        }

        if (this.state.interactionState.mode === 'TERRAIN_EDIT') {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', 'terrain edit', { tile, pointer });
            this.handleTerrainEdit(x, z);
            return;
        }

        if (this.checkPlayerRestricted(this.state.currentTurn)) {
            this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'player is restricted this turn', { tile, pointer, notify: true });
            return;
        }

        const { interactionState, currentTurn } = this.state;

        if (interactionState.mode === 'WALL_PLACEMENT') {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', 'wall placement', { tile, pointer });
            this.handleWallChainPlacement(x, z);
            return;
        }

        if (interactionState.mode === 'ABILITY_SUMMON') {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', 'summon placement', { tile, pointer });
            this.handleSummonPlacement(x, z);
            return;
        }

        if (interactionState.mode === 'ABILITY_TELEPORT') {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', 'teleport placement', { tile, pointer });
            this.handleTeleportPlacement(x, z);
            return;
        }

        if (interactionState.mode === 'ION_CANNON_TARGETING') {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', 'ion cannon strike', { tile, pointer });
            this.handleIonCannonStrike(x, z);
            return;
        }

        if (interactionState.mode === 'FORWARD_BASE_TARGETING') {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', 'forward base placement', { tile, pointer });
            this.handleForwardBasePlacement(x, z);
            return;
        }

        if (interactionState.mode === 'MASS_RETREAT_TARGETING') {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', 'mass retreat execute', { tile, pointer });
            this.handleMassRetreat(x, z);
            return;
        }

        const clickedUnit = this.state.units.find(u =>
            x >= u.position.x && x < u.position.x + u.stats.size &&
            z >= u.position.z && z < u.position.z + u.stats.size
        );

        if (interactionState.mode === 'ABILITY_FREEZE') {
            if (clickedUnit) {
                this.pushDebugTrace('handleTileClick.action', 'ACTION', `freeze target ${clickedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
                this.handleFreezeTarget(clickedUnit.id);
            } else {
                this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'freeze target missing', { tile, pointer, notify: true });
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_HEAL') {
            if (clickedUnit) {
                this.pushDebugTrace('handleTileClick.action', 'ACTION', `heal target ${clickedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
                this.handleHealTarget(clickedUnit.id);
            } else {
                this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'heal target missing', { tile, pointer, notify: true });
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_RESTORE_ENERGY') {
            if (clickedUnit) {
                this.pushDebugTrace('handleTileClick.action', 'ACTION', `restore energy target ${clickedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
                this.handleRestoreEnergyTarget(clickedUnit.id);
            } else {
                this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'restore-energy target missing', { tile, pointer, notify: true });
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_IMMORTALITY_SHIELD') {
            if (clickedUnit) {
                this.pushDebugTrace('handleTileClick.action', 'ACTION', `immortality shield target ${clickedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
                this.handleImmortalityShieldTarget(clickedUnit.id);
            } else {
                this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'immortality-shield target missing', { tile, pointer, notify: true });
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_DISPEL') {
            if (clickedUnit) {
                this.pushDebugTrace('handleTileClick.action', 'ACTION', `dispel target ${clickedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
                this.handleDispelTarget(clickedUnit.id);
            } else {
                this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'dispel target missing', { tile, pointer, notify: true });
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_MIND_CONTROL') {
            if (clickedUnit) {
                this.pushDebugTrace('handleTileClick.action', 'ACTION', `mind-control target ${clickedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
                this.handleMindControlTarget(clickedUnit.id);
            } else {
                this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'mind-control target missing', { tile, pointer, notify: true });
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (this.state.selectedCardId) {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', `place unit with card ${this.state.selectedCardId}`, { tile, pointer });
            this.emitPlaceUnit({
                playerId: currentTurn,
                position: { x, z },
                cardId: this.state.selectedCardId
            });
            return;
        }

        if (this.state.selectedUnitId) {
            const selectedUnit = this.state.units.find(u => u.id === this.state.selectedUnitId);
            if (selectedUnit && clickedUnit && this.arePlayersHostile(selectedUnit.playerId, clickedUnit.playerId)) {
                this.pushDebugTrace('handleTileClick.action', 'ACTION', `attack ${clickedUnit.id} by ${selectedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
                this.attackUnit(selectedUnit.id, clickedUnit.id);
                return;
            }

            if (this.state.previewPath.length > 0) {
                const endNode = this.state.previewPath[this.state.previewPath.length - 1];
                if (endNode.x === x && endNode.z === z) {
                    this.pushDebugTrace('handleTileClick.action', 'ACTION', `confirm move to ${x},${z}`, { tile, pointer });
                    this.confirmMove();
                    return;
                }

                this.pushDebugTrace(
                    'handleTileClick.info',
                    'INFO',
                    `preview end ${endNode.x},${endNode.z} != click ${x},${z}`,
                    { tile, pointer }
                );
            } else {
                this.pushDebugTrace('handleTileClick.info', 'INFO', 'selected unit has no preview path', { tile, pointer });
            }
        }

        if (clickedUnit) {
            this.pushDebugTrace('handleTileClick.action', 'ACTION', `forward to unit click ${clickedUnit.id}`, { tile, unitId: clickedUnit.id, pointer });
            this.handleUnitClick(clickedUnit.id, pointer);
            return;
        }

        this.pushDebugTrace('handleTileClick.reject', 'REJECT', 'no action for empty tile', { tile, pointer, notify: true });
    }

    private consumeActionCard(playerId: PlayerId, actionType: UnitType, preferredCardId?: string | null) {
        if (this.state.isDevMode) return;

        const deck = this.state.decks[playerId];
        let idx = preferredCardId ? deck.findIndex(c => c.id === preferredCardId) : -1;
        if (idx === -1) {
            idx = deck.findIndex(c => c.category === CardCategory.ACTION && c.type === actionType);
        }
        if (idx > -1) {
            const newDeck = [...deck];
            newDeck.splice(idx, 1);
            this.state.decks[playerId] = newDeck;
        }
        this.state.selectedCardId = null;
    }

    private handleIonCannonStrike(x: number, z: number, isRemote: boolean = false, forcedPlayerId?: PlayerId) {
        const playerId = forcedPlayerId || this.state.interactionState.playerId;
        if (!playerId) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('ION_CANNON_STRIKE', { x, z, playerId });
            return;
        }

        this.consumeActionCard(playerId, UnitType.ION_CANNON, this.state.selectedCardId);
        this.log(`> ORBITAL STRIKE INBOUND AT ${x},${z}`, playerId);
        this.triggerTilePulse(`${x},${z}`, 'ION_CANNON');
        this.finalizeInteraction();

        window.setTimeout(() => {
            this.applyAreaDamage({ x, z }, 1.5, 50, 'ORBITAL_STRIKE');
            this.checkWinCondition();
            this.notify();
            this.replicateAuthoritativeState();
        }, 420);
    }

    private handleForwardBasePlacement(x: number, z: number, isRemote: boolean = false, forcedPlayerId?: PlayerId) {
        const playerId = forcedPlayerId || this.state.interactionState.playerId;
        if (!playerId) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('FORWARD_BASE_PLACE', { x, z, playerId });
            return;
        }

        // Check if 2x2 area is valid
        const size = 2;
        const validTiles: string[] = [];

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const key = `${x + i},${z + j}`;

                // Check bounds
                if (!this.isWithinMap(x + i, z + j)) {
                    this.log(`> DEPLOYMENT FAILED: OUT OF BOUNDS`, playerId);
                    return;
                }

                // Check revealed
                if (!isRemote && !this.state.revealedTiles.includes(key) && !this.state.isDevMode) {
                    this.log(`> DEPLOYMENT FAILED: SECTOR UNKNOWN`, playerId);
                    return;
                }

                // Check enemy landing zone
                const tile = this.state.terrain[key];
                if (!tile) {
                    this.log(`> DEPLOYMENT FAILED: INVALID TERRAIN`, playerId);
                    return;
                }

                if (tile.landingZone && this.arePlayersHostile(playerId, tile.landingZone)) {
                    this.log(`> DEPLOYMENT FAILED: ENEMY TERRITORY`, playerId);
                    return;
                }

                validTiles.push(key);
            }
        }

        // Apply
        validTiles.forEach(key => {
            this.setPermanentLandingZone(key, playerId);
        });

        this.consumeActionCard(playerId, UnitType.FORWARD_BASE, this.state.selectedCardId);

        this.log(`> FORWARD BASE ESTABLISHED`, playerId);
        this.finalizeInteraction();
        this.notify();
    }

    private getUnitsInArea(x: number, z: number, size: number, playerId: PlayerId): Unit[] {
        const footprint = new Set(
            getTerrainBrushFootprint(x, z, size).map((pos) => `${pos.x},${pos.z}`)
        );

        return this.state.units.filter((unit) => {
            if (unit.playerId !== playerId || unit.status.isDying) return false;

            for (let dx = 0; dx < unit.stats.size; dx++) {
                for (let dz = 0; dz < unit.stats.size; dz++) {
                    if (footprint.has(`${unit.position.x + dx},${unit.position.z + dz}`)) {
                        return true;
                    }
                }
            }

            return false;
        });
    }

    private handleMassRetreat(x: number, z: number, isRemote: boolean = false, forcedPlayerId?: PlayerId, forcedSize?: number) {
        const playerId = forcedPlayerId || this.state.interactionState.playerId;
        if (!playerId) return;

        const zoneSize = Math.max(2, Math.min(4, forcedSize || this.state.interactionState.terrainBrushSize || 2));

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('MASS_RETREAT_EXECUTE', { x, z, playerId, size: zoneSize });
            return;
        }

        const affectedUnits = this.getUnitsInArea(x, z, zoneSize, playerId);
        if (affectedUnits.length === 0) {
            this.log(`> MASS RETREAT FAILED: NO FRIENDLY UNITS IN ZONE`, playerId);
            this.notify();
            return;
        }

        const reservedCells = new Set<string>();
        let successCount = 0;
        let delayMs = 0;

        affectedUnits.forEach((unit) => {
            const retreatPos = this.findNearestRetreatPosition(unit, playerId, reservedCells);
            if (!retreatPos) {
                return;
            }

            for (let dx = 0; dx < unit.stats.size; dx++) {
                for (let dz = 0; dz < unit.stats.size; dz++) {
                    reservedCells.add(`${retreatPos.x + dx},${retreatPos.z + dz}`);
                }
            }

            const message = `> MASS RETREAT: ${unit.type} RELOCATED TO ${retreatPos.x},${retreatPos.z}`;
            window.setTimeout(() => {
                this.executeTeleportRelocation(unit.id, retreatPos, {
                    playerId,
                    logMessage: message,
                    wormholeLandingZoneMode: this.playerHasWormholeTalent(playerId) ? 'SOURCE_ONLY' : 'NONE'
                });
            }, delayMs);
            delayMs += 260;
            successCount++;
        });

        if (successCount === 0) {
            this.log(`> MASS RETREAT FAILED: NO VALID DEPLOYMENT ZONES`, playerId);
            this.notify();
            return;
        }

        this.consumeActionCard(playerId, UnitType.MASS_RETREAT, this.state.selectedCardId);
        this.log(`> MASS RETREAT INITIATED (${successCount}/${affectedUnits.length})`, playerId);
        this.finalizeInteraction();
    }

    private applyLogisticsDelay(playerId: PlayerId, isRemote: boolean = false) {
        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('LOGISTICS_DELAY_EXECUTE', { playerId });
            return;
        }

        let delayedCount = 0;

        this.getHostilePlayers(playerId).forEach((targetPlayerId) => {
            this.state.pendingOrders[targetPlayerId] = this.state.pendingOrders[targetPlayerId].map((order) => {
                delayedCount++;
                return {
                    ...order,
                    deliveryTurns: order.deliveryTurns + 3
                };
            });
        });

        this.consumeActionCard(playerId, UnitType.LOGISTICS_DELAY, this.state.selectedCardId);
        this.log(`> LOGISTICS DELAY: ${delayedCount} IN-TRANSIT ORDERS PUSHED BACK BY 3 TURNS`, playerId);
        this.checkWinCondition();
        this.notify();
        this.replicateAuthoritativeState();
    }

    private applyMobilitySabotage(playerId: PlayerId) {
        const hostileUnits = this.state.units.filter((unit) =>
            this.arePlayersHostile(playerId, unit.playerId) &&
            unit.stats.movement > 0 &&
            !unit.status.isDying
        );

        hostileUnits.forEach((unit) => {
            this.applyMobilitySabotageEffect(unit.id);
        });

        this.consumeActionCard(playerId, UnitType.MOBILITY_SABOTAGE, this.state.selectedCardId);
        this.log(`> MOBILITY SABOTAGE DEPLOYED: ${hostileUnits.length} HOSTILE UNITS HAMPERED`, playerId);
        this.notify();
    }

    private applyMobilitySurge(playerId: PlayerId) {
        const friendlyUnits = this.state.units.filter((unit) =>
            unit.playerId === playerId &&
            unit.stats.movement > 0 &&
            !unit.status.isDying
        );

        friendlyUnits.forEach((unit) => {
            this.applyMobilityBoostEffect(unit.id);
        });

        this.consumeActionCard(playerId, UnitType.MOBILITY_SURGE, this.state.selectedCardId);
        this.log(`> MOBILITY SURGE DEPLOYED: ${friendlyUnits.length} FRIENDLY UNITS OVERCLOCKED`, playerId);
        this.notify();
    }

    private applyBleed(playerId: PlayerId) {
        const hostileUnits = this.state.units.filter((unit) =>
            this.arePlayersHostile(playerId, unit.playerId) &&
            unit.stats.movement > 0 &&
            !unit.status.isDying
        );

        hostileUnits.forEach((unit) => {
            this.applyBleedEffect(unit.id);
        });

        this.consumeActionCard(playerId, UnitType.BLEED, this.state.selectedCardId);
        this.log(`> BLEED DEPLOYED: ${hostileUnits.length} HOSTILE MOBILE UNITS AFFECTED`, playerId);
        this.notify();
    }

    private applySilence(playerId: PlayerId) {
        const hostilePlayers = this.getHostilePlayers(playerId);

        hostilePlayers.forEach((targetPlayerId) => {
            this.applySilenceEffect(targetPlayerId);
        });

        this.consumeActionCard(playerId, UnitType.SILENCE, this.state.selectedCardId);
        this.log(`> SILENCE DEPLOYED: ${hostilePlayers.length} HOSTILE COMMAND NETS JAMMED`, playerId);
        this.notify();
    }

    public handleFreezeTarget(targetUnitId: string, isRemote: boolean = false, sourceUnitIdOverride?: string) {
        const sourceUnitId = sourceUnitIdOverride || this.state.interactionState.sourceUnitId;
        if (!sourceUnitId) return;

        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const source = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('FREEZE_TARGET', { sourceUnitId, targetUnitId });
            return;
        }

        if (!this.arePlayersHostile(source.playerId, target.playerId)) {
            this.log(`> TARGET INVALID: HOSTILE ONLY`, source.playerId);
            return;
        }

        if (BUILDING_TYPES.includes(target.type)) {
            this.log(`> TARGET INVALID: STRUCTURES IMMUNE`, source.playerId);
            return;
        }

        // Apply Freeze
        this.addUnitEffect(targetUnitId, {
            name: 'CRYO STASIS',
            description: 'Unit is frozen and cannot move or act.',
            icon: '❄️',
            duration: 2,
            maxDuration: 2
        });

        this.state.units[sourceIdx].stats.energy -= 50;
        this.log(`> CRYO SHOT HIT TARGET`, source.playerId);
        this.finalizeInteraction();
    }

    public handleHealTarget(targetUnitId: string, isRemote: boolean = false, sourceUnitIdOverride?: string) {
        const sourceUnitId = sourceUnitIdOverride || this.state.interactionState.sourceUnitId;
        if (!sourceUnitId) return;

        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const source = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];
        const supportRange = 2;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('HEAL_TARGET', { sourceUnitId, targetUnitId });
            return;
        }

        if (!this.arePlayersAllied(source.playerId, target.playerId)) {
            this.log(`> TARGET INVALID: FRIENDLY ONLY`, source.playerId);
            return;
        }

        const distance = this.getUnitFootprintDistance(source, target);
        if (distance > supportRange) {
            this.log(`> TARGET OUT OF RANGE (${distance}/${supportRange})`, source.playerId);
            return;
        }

        const isRepairBot = source.type === UnitType.REPAIR_BOT;
        const targetClassification = getUnitClassificationLabel(target.type);
        const canRepairTarget = isRepairBot
            ? targetClassification === 'BUILDING' || targetClassification === 'MACHINE'
            : targetClassification === 'CREATURE';

        if (!canRepairTarget) {
            this.log(
                isRepairBot
                    ? `> TARGET INVALID: BUILDINGS OR MACHINES ONLY`
                    : `> TARGET INVALID: CREATURES ONLY`,
                source.playerId
            );
            return;
        }

        const healAmount = this.getNanoRepairAmount(source.playerId);

        this.animateSupportAction(targetUnitId, healAmount, 'HEAL', () => {
            const latestSourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
            const latestTargetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
            if (latestSourceIdx === -1 || latestTargetIdx === -1) return;

            const latestSource = this.state.units[latestSourceIdx];
            const latestTarget = this.state.units[latestTargetIdx];
            const newHp = Math.min(latestTarget.stats.maxHp, latestTarget.stats.hp + healAmount);

            this.state.units[latestTargetIdx].stats.hp = newHp;
            this.state.units[latestSourceIdx].stats.energy -= 25;

            this.log(`> REPAIRS COMPLETE: +${healAmount} HP`, latestSource.playerId);
            this.finalizeInteraction();
        });
    }

    public handleRestoreEnergyTarget(targetUnitId: string, isRemote: boolean = false, sourceUnitIdOverride?: string) {
        const sourceUnitId = sourceUnitIdOverride || this.state.interactionState.sourceUnitId;
        if (!sourceUnitId) return;

        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const source = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];
        const supportRange = 2;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('RESTORE_ENERGY_TARGET', { sourceUnitId, targetUnitId });
            return;
        }

        if (!this.arePlayersAllied(source.playerId, target.playerId)) {
            this.log(`> TARGET INVALID: FRIENDLY ONLY`, source.playerId);
            return;
        }

        const distance = this.getUnitFootprintDistance(source, target);
        if (distance > supportRange) {
            this.log(`> TARGET OUT OF RANGE (${distance}/${supportRange})`, source.playerId);
            return;
        }

        if (target.stats.maxEnergy <= 0) {
            this.log(`> TARGET INCOMPATIBLE: NO ENERGY CORE`, source.playerId);
            return;
        }

        if (target.stats.energy >= target.stats.maxEnergy) {
            this.log(`> TARGET ENERGY FULL`, source.playerId);
            return;
        }

        const restoreAmount = 50;

        this.animateSupportAction(targetUnitId, restoreAmount, 'ENERGY', () => {
            const latestSourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
            const latestTargetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
            if (latestSourceIdx === -1 || latestTargetIdx === -1) return;

            const latestSource = this.state.units[latestSourceIdx];
            const latestTarget = this.state.units[latestTargetIdx];
            const newEnergy = Math.min(latestTarget.stats.maxEnergy, latestTarget.stats.energy + restoreAmount);

            this.state.units[latestTargetIdx].stats.energy = newEnergy;
            this.state.units[latestSourceIdx].stats.energy -= 25;

            this.log(`> ENERGY TRANSFER COMPLETE: +${restoreAmount} EN`, latestSource.playerId);
            this.finalizeInteraction();
        });
    }

    public handleImmortalityShieldTarget(targetUnitId: string, isRemote: boolean = false, forcedPlayerId?: PlayerId) {
        const playerId = forcedPlayerId || this.state.interactionState.playerId;
        if (!playerId) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const target = this.state.units[targetIdx];

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('IMMORTALITY_SHIELD_TARGET', { playerId, targetUnitId });
            return;
        }

        if (!this.arePlayersAllied(playerId, target.playerId)) {
            this.log(`> TARGET INVALID: FRIENDLY ONLY`, playerId);
            return;
        }

        const targetClassification = getUnitClassificationLabel(target.type);
        if (targetClassification !== 'CREATURE' && targetClassification !== 'MACHINE') {
            this.log(`> TARGET INVALID: CREATURES OR MACHINES ONLY`, playerId);
            return;
        }

        this.consumeActionCard(playerId, UnitType.IMMORTALITY_SHIELD, this.state.selectedCardId);
        this.state.units[targetIdx] = this.applyImmortalityShield(target);

        this.log(`> IMMORTALITY SHIELD APPLIED`, playerId);
        this.finalizeInteraction();
    }

    public handleDispelTarget(targetUnitId: string, isRemote: boolean = false, sourceUnitIdOverride?: string) {
        const sourceUnitId = sourceUnitIdOverride || this.state.interactionState.sourceUnitId;
        if (!sourceUnitId) return;

        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const source = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];
        const supportRange = 5;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('DISPEL_TARGET', { sourceUnitId, targetUnitId });
            return;
        }

        if (!this.arePlayersAllied(source.playerId, target.playerId)) {
            this.log(`> TARGET INVALID: FRIENDLY ONLY`, source.playerId);
            return;
        }

        const distance = this.getUnitFootprintDistance(source, target);
        if (distance > supportRange) {
            this.log(`> TARGET OUT OF RANGE (${distance}/${supportRange})`, source.playerId);
            return;
        }

        const targetClassification = getUnitClassificationLabel(target.type);
        if (targetClassification !== 'CREATURE' && targetClassification !== 'MACHINE') {
            this.log(`> TARGET INVALID: CREATURES OR MACHINES ONLY`, source.playerId);
            return;
        }

        if (!this.hasNegativeEffects(target)) {
            this.log(`> TARGET CLEAN: NO NEGATIVE EFFECTS`, source.playerId);
            return;
        }

        const removableEffects = this.getNegativeEffects(target);

        this.state.units[targetIdx].effects = target.effects.filter(
            (effect) => !NEGATIVE_UNIT_EFFECT_NAMES.includes(effect.name as typeof NEGATIVE_UNIT_EFFECT_NAMES[number])
        );
        this.state.units[sourceIdx].stats.energy -= 25;

        this.log(`> SYSTEM PURGE COMPLETE: ${removableEffects.length} EFFECTS REMOVED`, source.playerId);
        this.finalizeInteraction();
    }

    public handleMindControlTarget(targetUnitId: string, isRemote: boolean = false, sourceUnitIdOverride?: string) {
        const sourceUnitId = sourceUnitIdOverride || this.state.interactionState.sourceUnitId;
        if (!sourceUnitId) return;

        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const hacker = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];

        if (!this.canMindControlTarget(hacker, target)) {
            this.log(`> TARGET LEVEL TOO HIGH FOR UPLINK`, hacker.playerId);
            return;
        }

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('MIND_CONTROL_TARGET', { sourceUnitId, targetUnitId });
            return;
        }

        if (!this.arePlayersHostile(hacker.playerId, target.playerId)) {
            this.log(`> CANNOT TARGET FRIENDLY UNITS`, hacker.playerId);
            return;
        }

        if (target.type === UnitType.TITAN || target.type === UnitType.PORTAL || target.type === UnitType.SPIKE) {
            this.log(`> TARGET FIREWALL TOO STRONG`, hacker.playerId);
            return;
        }

        // Apply Mind Control
        this.state.units[sourceIdx].stats.energy -= 50;
        this.state.units[sourceIdx].status.mindControlTargetId = targetUnitId;

        this.state.units[targetIdx].status.originalPlayerId = target.playerId;
        this.state.units[targetIdx].playerId = hacker.playerId;
        // Reset target potential actions to avoid weird state (like attacking self immediately if queue)
        this.state.units[targetIdx].status.attackTargetId = null;
        this.state.units[targetIdx].status.autoAttackTargetId = null;

        this.log(`> SYSTEM BREACH SUCCESSFUL: CONTROL ASSUMED`, hacker.playerId);
        this.finalizeInteraction();
        this.updateFogOfWar();
        this.notify();
        this.replicateAuthoritativeState();
    }

    public breakMindControl(hackerId: string) {
        const hackerIdx = this.state.units.findIndex(u => u.id === hackerId);
        if (hackerIdx === -1) return;

        const targetId = this.state.units[hackerIdx].status.mindControlTargetId;
        if (!targetId) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetId);

        // Clear Hacker Status
        this.state.units[hackerIdx].status.mindControlTargetId = null;

        if (targetIdx !== -1) {
            const target = this.state.units[targetIdx];
            if (target.status.originalPlayerId) {
                this.state.units[targetIdx].playerId = target.status.originalPlayerId;
                this.state.units[targetIdx].status.originalPlayerId = null;
                // Reset target potential actions
                this.state.units[targetIdx].status.attackTargetId = null;
                this.state.units[targetIdx].status.autoAttackTargetId = null;
                this.log(`> CONNECTION LOST: CONTROL REVERTED`, this.state.units[hackerIdx].playerId);
            }
        } else {
            this.log(`> CONNECTION LOST: TARGET OFFLINE`, this.state.units[hackerIdx].playerId);
        }
        this.updateFogOfWar();
        this.notify();
    }

    public handleWallChainPlacement(x: number, z: number, isRemote: boolean = false, unitIdOverride?: string) {
        const { playerId, lastPos, remaining } = this.state.interactionState;
        if (!playerId || !lastPos || remaining === undefined) return;
        const spawnedUnitId = unitIdOverride || `${playerId}-unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('WALL_CHAIN_PLACE', { x, z, unitId: spawnedUnitId });
            return;
        }

        if (this.isValidPlacement(x, z, 1, playerId, false, isRemote)) {
            // Check adjacency
            if (Math.abs(x - lastPos.x) + Math.abs(z - lastPos.z) === 1) {
                this.spawnUnit(UnitType.WALL, { x, z }, playerId, spawnedUnitId);

                const newRemaining = remaining - 1;
                if (newRemaining > 0) {
                    this.state.interactionState = {
                        ...this.state.interactionState,
                        lastPos: { x, z },
                        remaining: newRemaining
                    };
                } else {
                    this.finalizeInteraction();
                }
                this.checkWinCondition();
                this.notify();
            }
        }
    }

    public handleSummonPlacement(x: number, z: number, isRemote: boolean = false, unitIdOverride?: string) {
        const { playerId, sourceUnitId, remaining, unitType } = this.state.interactionState;
        if (!playerId || !sourceUnitId || !remaining || !unitType) return;
        const spawnedUnitId = unitIdOverride || `${playerId}-unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('SUMMON_PLACE', { x, z, unitId: spawnedUnitId });
            return;
        }

        const source = this.state.units.find(u => u.id === sourceUnitId);
        if (!source) return;

        if (this.isValidPlacement(x, z, 1, playerId, false, isRemote)) {
            // Range check (1 tile radius)
            const dx = Math.abs(x - source.position.x);
            const dz = Math.abs(z - source.position.z);
            if (dx <= 1 && dz <= 1 && !(dx === 0 && dz === 0)) {
                this.spawnUnit(unitType, { x, z }, playerId, spawnedUnitId);

                const newRemaining = remaining - 1;
                if (newRemaining > 0) {
                    this.state.interactionState = { ...this.state.interactionState, remaining: newRemaining };
                } else {
                    const unitIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
                    if (unitIdx > -1) {
                        this.state.units[unitIdx].stats.energy -= 25;
                    }
                    this.finalizeInteraction();
                }
                this.checkWinCondition();
                this.notify();
            }
        }
    }

    private applyTeleport(sourceUnitId: string, x: number, z: number, isRemote: boolean = false) {
        const unitIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (unitIdx === -1) return;

        const unit = this.state.units[unitIdx];
        const isValid = this.isValidPlacement(x, z, unit.stats.size, unit.playerId, false, isRemote);
        if (!isValid) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('TELEPORT', { sourceUnitId, x, z });
            this.finalizeInteraction();
            return;
        }
        this.executeTeleportRelocation(sourceUnitId, { x, z }, {
            playerId: unit.playerId,
            logMessage: `> UNIT TELEPORTED TO ${x},${z}`,
            energyCost: 25,
            wormholeLandingZoneMode: this.playerHasWormholeTalent(unit.playerId) ? 'SOURCE_AND_DESTINATION' : 'NONE'
        });

        if (!isRemote) {
            this.finalizeInteraction();
        }
    }

    public handleTeleportPlacement(x: number, z: number) {
        const { sourceUnitId } = this.state.interactionState;
        if (!sourceUnitId) return;
        this.applyTeleport(sourceUnitId, x, z, false);
    }

    public cancelInteraction() {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.state.interactionState.mode !== 'NORMAL') {
            if (this.state.interactionState.mode === 'WALL_PLACEMENT') { this.finalizeInteraction(); } else { this.log(`> SEQUENCE ABORTED`); this.state.interactionState = { mode: 'NORMAL' }; this.notify(); }
        } else {
            if (this.state.selectedCardId) { this.state.selectedCardId = null; this.log(`> ACTION CANCELLED`); this.notify(); } else if (this.state.selectedUnitId) { this.selectUnit(null); }
        }
    }

    public finalizeInteraction() {
        this.state.interactionState = { mode: 'NORMAL' };
        this.state.selectedCardId = null;
        this.state.selectedUnitId = null;
        this.notify();
    }

    private findNearestRetreatPosition(unit: Unit, playerId: PlayerId, extraOccupied: Set<string> = new Set()): Position | null {
        const size = unit.stats.size;
        const sourceCenterX = unit.position.x + ((size - 1) / 2);
        const sourceCenterZ = unit.position.z + ((size - 1) / 2);
        const candidates: Array<{ position: Position; footprintDistance: number; centerDistance: number; }> = [];
        const occupied = this.getAllOccupiedCells(unit.id);
        extraOccupied.forEach((key) => occupied.add(key));

        Object.keys(this.state.terrain).forEach(key => {
            const [x, z] = key.split(',').map(Number);

            if (!this.canUnitOccupyPosition(unit, { x, z }, occupied)) {
                return;
            }

            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    const tile = this.state.terrain[`${x + i},${z + j}`];
                    if (!tile || tile.landingZone !== playerId) {
                        return;
                    }
                }
            }

                const footprintDistance = Math.max(
                    Math.max(unit.position.x - (x + size - 1), x - (unit.position.x + size - 1), 0),
                    Math.max(unit.position.z - (z + size - 1), z - (unit.position.z + size - 1), 0)
                );
                const targetCenterX = x + ((size - 1) / 2);
                const targetCenterZ = z + ((size - 1) / 2);
                const centerDistance = Math.abs(sourceCenterX - targetCenterX) + Math.abs(sourceCenterZ - targetCenterZ);

                candidates.push({
                    position: { x, z },
                    footprintDistance,
                    centerDistance
                });
        });

        if (candidates.length === 0) {
            return null;
        }

        candidates.sort((a, b) => {
            if (a.footprintDistance !== b.footprintDistance) {
                return a.footprintDistance - b.footprintDistance;
            }
            if (a.centerDistance !== b.centerDistance) {
                return a.centerDistance - b.centerDistance;
            }
            if (a.position.z !== b.position.z) {
                return a.position.z - b.position.z;
            }
            return a.position.x - b.position.x;
        });

        return candidates[0].position;
    }

    private isValidPlacement(
        x: number,
        z: number,
        size: number,
        playerId: PlayerId,
        requiresZone: boolean,
        ignoreVisibility: boolean = false
    ): boolean {
        const occupied = this.getAllOccupiedCells();

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const key = `${x + i},${z + j}`;
                if (occupied.has(key)) return false;

                if (!this.isWithinMap(x + i, z + j)) return false;

                const tile = this.state.terrain[key];
                if (!tile) return false;

                // Check terrain landing zone
                if (requiresZone && !this.state.isDevMode) {
                    if (tile.landingZone !== playerId) {
                        return false;
                    }
                }

                if (!ignoreVisibility && !this.state.revealedTiles.includes(key) && !this.state.isDevMode) return false;
            }
        }
        return true;
    }

    public createUnit(type: UnitType, position: Position, playerId: PlayerId, idOverride?: string): Unit {
        const config = CARD_CONFIG[type];
        const playerTalents = this.state.playerTalents[playerId];
        const hasTalent = (talentId: string) => playerTalents.some(t => t.id === talentId);
        const marineUpgradeTier = Number(hasTalent('t8')) + Number(hasTalent('t16'));
        const marineSuiteTier = Number(hasTalent('t9')) + Number(hasTalent('t17'));
        const dreadnoughtOffenseTier = Number(hasTalent('t10')) + Number(hasTalent('t18'));
        const dreadnoughtArmorTier = Number(hasTalent('t11')) + Number(hasTalent('t19'));
        const droneUpgradeTier = Number(hasTalent('t12')) + Number(hasTalent('t20'));
        const tanksUpgradeTier = Number(hasTalent('t13')) + Number(hasTalent('t21'));
        const reinforcedWallsActive = hasTalent('t24');
        const nanoBladesActive = hasTalent('t26');
        const stats = config?.baseStats ? { ...config.baseStats } : {
            hp: 100, maxHp: 100, energy: 0, maxEnergy: 0,
            attack: 10, range: 1, movement: 3, size: 1, blocksLos: false, maxAttacks: 1
        };

        if (hasTalent('t3')) stats.movement = (stats.movement || 0) + 1;
        if (hasTalent('t4') && (stats.range || 0) > 1) stats.range = (stats.range || 1) + 1;

        // t8: Marine Upgrade - Only for Soldier type
        if (marineUpgradeTier > 0 && type === UnitType.SOLDIER) {
            stats.attack = (stats.attack || 0) + (15 * marineUpgradeTier);
            stats.range = (stats.range || 0) + marineUpgradeTier;
        }

        // t9: Marine Suite (HP + Mobility) - Only for Soldier type
        if (marineSuiteTier > 0 && type === UnitType.SOLDIER) {
            stats.hp = (stats.hp || 100) + (50 * marineSuiteTier);
            stats.movement = (stats.movement || 0) + marineSuiteTier;
        }

        // t10: Dreadnought Offense - Only for Heavy type
        if (dreadnoughtOffenseTier > 0 && type === UnitType.HEAVY) {
            stats.attack = (stats.attack || 0) + (20 * dreadnoughtOffenseTier);
            stats.range = (stats.range || 0) + dreadnoughtOffenseTier;
        }

        // t11: Dreadnought Armor - Only for Heavy type
        if (dreadnoughtArmorTier > 0 && type === UnitType.HEAVY) {
            stats.hp = (stats.hp || 200) + (100 * dreadnoughtArmorTier);
        }

        // t12: Drone Upgrade - Only for Box and Suicide Drone
        if (droneUpgradeTier > 0 && (type === UnitType.BOX || type === UnitType.SUICIDE_DRONE)) {
            stats.movement = (stats.movement || 0) + (2 * droneUpgradeTier);
            stats.hp = (stats.hp || 100) + (20 * droneUpgradeTier);
        }

        // t13: Tanks Upgrade - Only for Light and Heavy Tank
        if (tanksUpgradeTier > 0 && (type === UnitType.LIGHT_TANK || type === UnitType.HEAVY_TANK)) {
            stats.attack = (stats.attack || 0) + (20 * tanksUpgradeTier);
            stats.hp = (stats.hp || 100) + (100 * tanksUpgradeTier);
        }

        // t24: Reinforced Walls
        if (reinforcedWallsActive && (type === UnitType.WALL || type === UnitType.TOWER || type === UnitType.CHARGING_STATION)) {
            stats.hp = (stats.hp || 100) + 100;
        }

        // t26: Nano Blades
        if (nanoBladesActive && type === UnitType.CONE) {
            stats.attack = (stats.attack || 0) + 20;
            stats.hp = (stats.hp || 100) + 20;
        }

        const finalStats: UnitStats = {
            hp: stats.hp || 100,
            maxHp: stats.hp || 100,
            energy: stats.maxEnergy ? Math.floor(stats.maxEnergy / 2) : 0,
            maxEnergy: stats.maxEnergy || 0,
            attack: stats.attack || 0,
            range: stats.range || 0,
            movement: stats.movement || 0,
            size: stats.size || 1,
            blocksLos: stats.blocksLos || false,
            maxAttacks: stats.maxAttacks || 1
        };
        const unitId = idOverride || `unit-${Date.now()}-${Math.random()}`;
        const effects = hasTalent('t7') && !BUILDING_TYPES.includes(type)
            ? [this.createKineticShieldEffect(unitId)]
            : [];

        return {
            id: unitId,
            playerId,
            position: { ...position },
            type,
            color: this.getRandomColor(playerId),
            level: 1,
            rotation: this.getInitialRotation(playerId),
            stats: finalStats,
            status: { stepsTaken: 0, attacksUsed: 0, fluxTowerAttackUpgradesPurchased: 0 },
            effects,
            movePath: []
        };
    }

    private getInitialRotation(playerId: PlayerId): number {
        if (playerId === PlayerId.ONE) return 0;
        if (playerId === PlayerId.TWO) return Math.PI;
        if (playerId === PlayerId.THREE) return Math.PI / 2;
        if (playerId === PlayerId.FOUR) return -Math.PI / 2;
        return 0;
    }

    public spawnUnit(type: UnitType, position: Position, playerId: PlayerId, idOverride?: string) {
        const baseUnit = this.createUnit(type, position, playerId, idOverride);
        const shouldApplySummoningSickness = baseUnit.stats.movement > 0
            && !this.playerHasTalent(playerId, 't28');
        const unit = shouldApplySummoningSickness
            ? {
                ...baseUnit,
                effects: [...baseUnit.effects, this.createSummoningSicknessEffect(baseUnit.id)]
            }
            : baseUnit;
        this.state.units = [...this.state.units, unit];
        this.updateFogOfWar();

        if (type === UnitType.WALL) {
            this.updateWallRotations(unit.id);
            this.getAdjacentWalls(unit).forEach(w => this.updateWallRotations(w.id));
        }
    }

    public updateWallRotations(unitId: string) {
        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.type !== UnitType.WALL) return;

        const adj = this.getAdjacentWalls(unit);
        const hasNorth = adj.some(u => u.position.z === unit.position.z - 1);
        const hasSouth = adj.some(u => u.position.z === unit.position.z + 1);
        const hasEast = adj.some(u => u.position.x === unit.position.x + 1);
        const hasWest = adj.some(u => u.position.x === unit.position.x - 1);

        if ((hasNorth && hasSouth) || ((hasNorth || hasSouth) && !hasEast && !hasWest)) {
            unit.rotation = Math.PI / 2;
        } else if ((hasEast && hasWest) || ((hasEast || hasWest) && !hasNorth && !hasSouth)) {
            unit.rotation = 0;
        } else if ((hasNorth && hasEast) || (hasSouth && hasWest)) {
            unit.rotation = -Math.PI / 4;
        } else if ((hasNorth && hasWest) || (hasSouth && hasEast)) {
            unit.rotation = Math.PI / 4;
        } else {
            unit.rotation = 0;
        }
    }

    private getAdjacentWalls(unit: Unit): Unit[] {
        return this.state.units.filter(u =>
            u.type === UnitType.WALL &&
            Math.abs(u.position.x - unit.position.x) + Math.abs(u.position.z - unit.position.z) === 1
        );
    }

    public handleUnitClick(unitId: string, pointer?: DebugPointerMeta) {
        if (this.state.appStatus !== AppStatus.PLAYING) {
            this.pushDebugTrace('handleUnitClick.reject', 'REJECT', `appStatus=${this.state.appStatus}`, { unitId, pointer, notify: true });
            return;
        }
        const clickedUnit = this.state.units.find(u => u.id === unitId);
        const selectedUnit = this.state.units.find(u => u.id === this.state.selectedUnitId);

        if (!clickedUnit) {
            this.pushDebugTrace('handleUnitClick.reject', 'REJECT', `unit ${unitId} not found`, { unitId, pointer, notify: true });
            return;
        }

        if (selectedUnit && clickedUnit && selectedUnit.playerId === this.state.currentTurn && this.arePlayersHostile(selectedUnit.playerId, clickedUnit.playerId)) {
            this.pushDebugTrace('handleUnitClick.action', 'ACTION', `attack ${clickedUnit.id} by ${selectedUnit.id}`, { unitId, pointer });
            this.attackUnit(selectedUnit.id, clickedUnit.id);
        } else {
            this.pushDebugTrace('handleUnitClick.action', 'ACTION', `select unit ${clickedUnit.id}`, { unitId, pointer });
            this.selectUnit(unitId);
        }
    }

    public hoverUnit(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.state.previewPath.length > 0) {
            this.clearPreview();
        }
    }

    public setDebugHoverTile(tile: Position | null) {
        if (!this.state.isDevMode) return;
        this.state.debugLastHoverTile = tile ? { ...tile } : null;
    }

    public clearPreview() {
        if (this.state.previewPath.length > 0) {
            this.state = { ...this.state, previewPath: [] };
            this.notify();
        }
    }

    private pathToKey(path: Position[]): string {
        if (path.length === 0) return '';
        return path.map(p => `${p.x},${p.z}`).join('|');
    }

    private arePathsEqual(a: Position[], b: Position[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i].x !== b[i].x || a[i].z !== b[i].z) return false;
        }
        return true;
    }

    private resolveRemoteUnitId(locator: RemoteUnitLocator): string | null {
        if (locator.unitId && this.state.units.some(u => u.id === locator.unitId)) {
            return locator.unitId;
        }

        let candidates = this.state.units;

        if (locator.playerId) {
            candidates = candidates.filter(u => u.playerId === locator.playerId);
        }

        if (locator.unitType) {
            candidates = candidates.filter(u => u.type === locator.unitType);
        }

        if (locator.position) {
            const exactMatch = candidates.find(u =>
                u.position.x === locator.position!.x && u.position.z === locator.position!.z
            );
            if (exactMatch) return exactMatch.id;

            const sortedByDistance = [...candidates].sort((a, b) => {
                const aDistance = Math.abs(a.position.x - locator.position!.x) + Math.abs(a.position.z - locator.position!.z);
                const bDistance = Math.abs(b.position.x - locator.position!.x) + Math.abs(b.position.z - locator.position!.z);
                return aDistance - bDistance;
            });
            return sortedByDistance[0]?.id || null;
        }

        return candidates[0]?.id || null;
    }

    public triggerSuicide(unitId: string, isRemote: boolean = false, locator?: RemoteUnitLocator) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (!isRemote && this.checkPlayerRestricted(this.state.currentTurn)) return;

        let resolvedUnitId = unitId;
        let unitIndex = this.state.units.findIndex(u => u.id === resolvedUnitId);
        if (unitIndex === -1 && isRemote) {
            const fallbackUnitId = this.resolveRemoteUnitId({ ...(locator || {}), unitId });
            if (fallbackUnitId) {
                resolvedUnitId = fallbackUnitId;
                unitIndex = this.state.units.findIndex(u => u.id === resolvedUnitId);
            }
        }

        if (unitIndex === -1) return;
        const unit = this.state.units[unitIndex];
        if (!isRemote && (unit.playerId !== this.state.currentTurn || unit.type !== UnitType.HEAVY)) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('SUICIDE_PROTOCOL', {
                unitId: resolvedUnitId,
                playerId: unit.playerId,
                unitType: unit.type,
                position: { ...unit.position }
            });
            return;
        }

        if (unit.type !== UnitType.HEAVY) return;
        const updatedUnits = [...this.state.units];
        updatedUnits[unitIndex] = { ...unit, status: { ...unit.status, isDying: true } };
        this.log(`> SUICIDE PROTOCOL INITIATED`, unit.playerId);
        this.state = { ...this.state, units: updatedUnits, selectedUnitId: null };
        this.applyAreaDamage(unit.position, 1.5, 50, unit.id);
        this.notify();
        setTimeout(() => { this.removeUnit(resolvedUnitId); this.notify(); }, 2000);
    }

    public triggerDroneExplosion(unitId: string, isRemote: boolean = false, locator?: RemoteUnitLocator) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (!isRemote && this.checkPlayerRestricted(this.state.currentTurn)) return;

        let resolvedUnitId = unitId;
        let unitIndex = this.state.units.findIndex(u => u.id === resolvedUnitId);
        if (unitIndex === -1 && isRemote) {
            const fallbackUnitId = this.resolveRemoteUnitId({ ...(locator || {}), unitId });
            if (fallbackUnitId) {
                resolvedUnitId = fallbackUnitId;
                unitIndex = this.state.units.findIndex(u => u.id === resolvedUnitId);
            }
        }

        if (unitIndex === -1) return;
        const unit = this.state.units[unitIndex];
        if (!isRemote && (unit.playerId !== this.state.currentTurn || unit.type !== UnitType.SUICIDE_DRONE)) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('DRONE_DETONATE', {
                unitId: resolvedUnitId,
                playerId: unit.playerId,
                unitType: unit.type,
                position: { ...unit.position }
            });
            return;
        }

        if (unit.type !== UnitType.SUICIDE_DRONE) return;
        const updatedUnits = [...this.state.units];
        updatedUnits[unitIndex] = { ...unit, status: { ...unit.status, isExploding: true } };
        this.log(`> DETONATING DRONE`, unit.playerId);
        this.state = { ...this.state, units: updatedUnits, selectedUnitId: null };
        this.applyAreaDamage(unit.position, 1.5, 80, unit.id);
        this.notify();
        setTimeout(() => { this.removeUnit(resolvedUnitId); this.notify(); }, 1000);
    }

    private hasLineOfSight(attacker: Unit, target: Unit): boolean {
        const startX = attacker.position.x + attacker.stats.size / 2;
        const startZ = attacker.position.z + attacker.stats.size / 2;
        const endX = target.position.x + target.stats.size / 2;
        const endZ = target.position.z + target.stats.size / 2;
        const blockingTiles = new Set<string>();
        this.state.units.forEach(u => {
            if (u.stats.blocksLos && u.id !== attacker.id && u.id !== target.id) {
                const s = u.stats.size;
                for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) { blockingTiles.add(`${u.position.x + i},${u.position.z + j}`); }
            }
        });
        const dx = endX - startX;
        const dz = endZ - startZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const steps = Math.ceil(dist * 3);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cx = startX + dx * t;
            const cz = startZ + dz * t;
            const tx = Math.floor(cx);
            const tz = Math.floor(cz);
            const key = `${tx},${tz}`;
            if (blockingTiles.has(key)) {
                const inAttacker = (tx >= attacker.position.x && tx < attacker.position.x + attacker.stats.size && tz >= attacker.position.z && tz < attacker.position.z + attacker.stats.size);
                const inTarget = (tx >= target.position.x && tx < target.position.x + target.stats.size && tz >= target.position.z && tz < target.position.z + target.stats.size);
                if (!inAttacker && !inTarget) { return false; }
            }
        }
        return true;
    }

    private getUnitFootprintDistance(source: Unit, target: Unit): number {
        const dx = Math.max(
            source.position.x - (target.position.x + target.stats.size - 1),
            target.position.x - (source.position.x + source.stats.size - 1),
            0
        );
        const dz = Math.max(
            source.position.z - (target.position.z + target.stats.size - 1),
            target.position.z - (source.position.z + source.stats.size - 1),
            0
        );
        return Math.max(dx, dz);
    }

    private isInvulnerable(unit: Unit): boolean {
        return unit.effects.some(e => e.name === 'IMMORTALITY_SHIELD');
    }

    private getClosestNeutralAttackTarget(attacker: Unit): Unit | null {
        const candidates = this.state.units
            .filter(target =>
                target.id !== attacker.id &&
                target.playerId !== PlayerId.NEUTRAL &&
                !target.status.isDying &&
                !this.isInvulnerable(target)
            )
            .filter(target => this.checkAttackValidity(attacker, target).isValid)
            .sort((a, b) => {
                const distanceDelta = this.getUnitFootprintDistance(attacker, a) - this.getUnitFootprintDistance(attacker, b);
                if (distanceDelta !== 0) return distanceDelta;
                return a.stats.hp - b.stats.hp;
            });

        return candidates[0] || null;
    }

    private getClosestNeutralFreezeTarget(attacker: Unit): Unit | null {
        const candidates = this.state.units
            .filter(target =>
                target.id !== attacker.id &&
                target.playerId !== PlayerId.NEUTRAL &&
                !BUILDING_TYPES.includes(target.type) &&
                !target.status.isDying &&
                !this.isInvulnerable(target) &&
                !this.checkUnitFrozen(target)
            )
            .filter(target => this.checkAttackValidity(attacker, target).isValid)
            .sort((a, b) => {
                const distanceDelta = this.getUnitFootprintDistance(attacker, a) - this.getUnitFootprintDistance(attacker, b);
                if (distanceDelta !== 0) return distanceDelta;
                return a.stats.hp - b.stats.hp;
            });

        return candidates[0] || null;
    }

    private executeNeutralCreepTurn(onComplete: () => void) {
        const neutralUnitIds = this.state.units
            .filter(u => u.playerId === PlayerId.NEUTRAL && !u.status.isDying)
            .map(u => u.id);

        if (neutralUnitIds.length === 0) {
            onComplete();
            return;
        }

        this.state.units = this.state.units.map(u =>
            u.playerId === PlayerId.NEUTRAL
                ? {
                    ...u,
                    status: {
                        ...u.status,
                        stepsTaken: 0,
                        attacksUsed: 0,
                        attackTargetId: null,
                        autoAttackTargetId: null
                    }
                }
                : u
        );
        this.notify();

        const processNext = (index: number) => {
            if (index >= neutralUnitIds.length) {
                onComplete();
                return;
            }

            const unit = this.state.units.find(u => u.id === neutralUnitIds[index]);
            if (!unit || unit.playerId !== PlayerId.NEUTRAL || unit.status.isDying || this.checkUnitFrozen(unit)) {
                processNext(index + 1);
                return;
            }

            if (
                unit.type === UnitType.SOLDIER &&
                unit.status.neutralHasAttacked &&
                unit.stats.energy >= 50
            ) {
                const freezeTarget = this.getClosestNeutralFreezeTarget(unit);
                if (freezeTarget) {
                    this.log(`> NEUTRAL CREEP: ${unit.type} EXECUTES CRYO SHOT`, PlayerId.NEUTRAL);
                    this.handleFreezeTarget(freezeTarget.id, true, unit.id);
                    window.setTimeout(() => processNext(index + 1), 250);
                    return;
                }
            }

            const attackTarget = this.getClosestNeutralAttackTarget(unit);
            if (!attackTarget) {
                processNext(index + 1);
                return;
            }

            this.log(`> NEUTRAL CREEP: ${unit.type} ENGAGES ${attackTarget.type}`, PlayerId.NEUTRAL);
            this.attackUnit(unit.id, attackTarget.id, true);
            this.state.units = this.state.units.map(current =>
                current.id === unit.id
                    ? {
                        ...current,
                        status: {
                            ...current.status,
                            neutralHasAttacked: true
                        }
                    }
                    : current
            );
            window.setTimeout(() => processNext(index + 1), 900);
        };

        processNext(0);
    }

    // --- ATTACK LOGIC ---

    public attackUnit(attackerId: string, targetId: string, isRemote: boolean = false) {
        if (!isRemote && this.state.appStatus !== AppStatus.PLAYING) return;
        if (!isRemote && this.checkPlayerRestricted(this.state.currentTurn)) return;

        const attackerIdx = this.state.units.findIndex(u => u.id === attackerId);
        const targetIdx = this.state.units.findIndex(u => u.id === targetId);

        if (attackerIdx === -1 || targetIdx === -1) return;

        const attacker = this.state.units[attackerIdx];
        const target = this.state.units[targetIdx];

        if (this.checkUnitFrozen(attacker)) {
            this.log(`> UNIT FROZEN - CANNOT ATTACK`, attacker.playerId);
            return;
        }

        if (attacker.status.mindControlTargetId) {
            this.log(`> CANNOT ATTACK WHILE CHANNELING`, attacker.playerId);
            return;
        }

        if (attacker.status.attacksUsed >= attacker.stats.maxAttacks) {
            this.log(`> WEAPON SYSTEMS COOLDOWN ACTIVE`, attacker.playerId);
            return;
        }

        const valid = this.checkAttackValidity(attacker, target);
        // Trust remote validity? Or check it anyway to key sync? 
        // Checking it is safer for sync issues.
        if (!valid.isValid && !isRemote) {
            this.log(`> ATTACK FAILED: ${valid.reason}`, attacker.playerId);
            return;
        }

        // In multiplayer, wait for authoritative command broadcast before applying.
        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('ATTACK', { attackerId, targetId });
            return;
        }

        const activeUnits = [...this.state.units];
        const isEnemyPlayer = this.arePlayersHostile(attacker.playerId, target.playerId);

        const dx = target.position.x - attacker.position.x;
        const dz = target.position.z - attacker.position.z;
        const rotation = Math.atan2(dx, dz);

        activeUnits[attackerIdx] = {
            ...attacker,
            rotation: rotation,
            status: {
                ...attacker.status,
                attackTargetId: targetId,
                autoAttackTargetId: isEnemyPlayer ? targetId : null
            }
        };
	        this.state.units = activeUnits;
	        this.notify();

            const impactDelay = this.getAttackImpactDelay(attacker, target);
	        setTimeout(() => {
	            this.resolveAttack(attackerId, targetId);
	        }, impactDelay);
	    }

    private checkAttackValidity(attacker: Unit, target: Unit): { isValid: boolean, reason?: string } {
        const distance = this.getUnitFootprintDistance(attacker, target);

        if (!this.arePlayersHostile(attacker.playerId, target.playerId)) {
            return { isValid: false, reason: 'INVALID TARGET RELATION' };
        }
        if (attacker.type === UnitType.SNIPER && distance === 1) {
            return { isValid: false, reason: 'TARGET TOO CLOSE (MIN RANGE 2)' };
        }
        if (distance > attacker.stats.range) { return { isValid: false, reason: `OUT OF RANGE (${distance}/${attacker.stats.range})` }; }
        if (!this.hasLineOfSight(attacker, target)) { return { isValid: false, reason: `LINE OF SIGHT BLOCKED` }; }
        return { isValid: true };
    }

	    private resolveAttack(attackerId: string, targetId: string) {
	        const attackerIdx = this.state.units.findIndex(u => u.id === attackerId);
	        const targetIdx = this.state.units.findIndex(u => u.id === targetId);
            let directDamagePulse: { unitId: string; amount: number } | null = null;
            let directMissPulseTargetId: string | null = null;
            let attackMissed = false;

        if (attackerIdx === -1) return;

        let updatedUnits = [...this.state.units];
        const currentStatus = updatedUnits[attackerIdx].status;
        updatedUnits[attackerIdx] = {
            ...updatedUnits[attackerIdx],
            status: {
                ...currentStatus,
                attackTargetId: null,
                attacksUsed: currentStatus.attacksUsed + 1
            }
        };

        if (targetIdx !== -1) {
            const target = updatedUnits[targetIdx];
            const attacker = updatedUnits[attackerIdx];
            const remainingAttacks = attacker.stats.maxAttacks - updatedUnits[attackerIdx].status.attacksUsed;

            if (this.shouldAttackMiss(attacker, target)) {
                attackMissed = true;
                directMissPulseTargetId = target.id;
                this.log(`> ${attacker.type} FIRES ON ${target.type}: MISS${remainingAttacks > 0 ? ` (+${remainingAttacks} READY)` : ''}`, attacker.playerId);
            } else {
                const damage = this.getAttackDamage(attacker, target);
                const damageResult = this.applyDamageToUnit(target, damage);

                if (damageResult.wasInvulnerable) {
                    this.log(`> ATTACK DEFLECTED: IMMORTALITY SHIELD`, attacker.playerId);
                } else {
                    updatedUnits[targetIdx] = damageResult.unit;
                    if (damageResult.hpDamage > 0) {
                        directDamagePulse = { unitId: target.id, amount: damageResult.hpDamage };
                    }
                    const absorptionSuffix = damageResult.shieldAbsorbed > 0
                        ? ` (${damageResult.shieldAbsorbed} ABSORBED${damageResult.shieldBroken ? ', SHIELD DOWN' : ''})`
                        : '';

                    if (damageResult.hpDamage > 0) {
                        this.log(`> ${attacker.type} FIRES ON ${target.type}: -${damageResult.hpDamage} HP${absorptionSuffix}${remainingAttacks > 0 ? ` (+${remainingAttacks} READY)` : ''}`, attacker.playerId);
                    } else if (damageResult.shieldAbsorbed > 0) {
                        this.log(`> ${attacker.type} FIRES ON ${target.type}: KINETIC SHIELD ABSORBS ${damageResult.shieldAbsorbed}${damageResult.shieldBroken ? ' AND COLLAPSES' : ''}${remainingAttacks > 0 ? ` (+${remainingAttacks} READY)` : ''}`, attacker.playerId);
                    } else {
                        this.log(`> ${attacker.type} FIRES ON ${target.type}: NO DAMAGE${remainingAttacks > 0 ? ` (+${remainingAttacks} READY)` : ''}`, attacker.playerId);
                    }

                    // BREAK MIND CONTROL IF HACKER IS DAMAGED
                    if (damageResult.hpDamage > 0 && target.status.mindControlTargetId) {
                        const victimId = target.status.mindControlTargetId;
                        const victimIdx = updatedUnits.findIndex(u => u.id === victimId);
                        if (victimIdx !== -1 && updatedUnits[victimIdx].status.originalPlayerId) {
                            updatedUnits[victimIdx] = {
                                ...updatedUnits[victimIdx],
                                playerId: updatedUnits[victimIdx].status.originalPlayerId!,
                                status: { ...updatedUnits[victimIdx].status, originalPlayerId: null }
                            };
                            this.log(`> HACKER DISRUPTED: CONNECTION SEVERED`);
                        }
                        updatedUnits[targetIdx] = {
                            ...updatedUnits[targetIdx],
                            status: { ...updatedUnits[targetIdx].status, mindControlTargetId: null }
                        };
                    }

                    if (updatedUnits[targetIdx].stats.hp === 0) {
                        this.log(`> TARGET ELIMINATED: ${target.type}`, attacker.playerId);
                        updatedUnits[targetIdx].status.isDying = true;
                        updatedUnits[attackerIdx].status.autoAttackTargetId = null;
                        setTimeout(() => { this.removeUnit(targetId); }, 1500);
                    }
                }
            }

            if (!attackMissed && attacker.type === UnitType.TITAN) {
                this.log(`> SPLASH DAMAGE DETECTED`, attacker.playerId);
                // Commit single-target attack changes before resolving splash, then
                // continue with the post-splash unit snapshot.
                this.state.units = updatedUnits;
                this.applyAreaDamage(target.position, 1.5, 25, attacker.id, target.id);
                updatedUnits = [...this.state.units];
            }

        } else {
            updatedUnits[attackerIdx].status.autoAttackTargetId = null;
        }

	        this.state.units = updatedUnits;
            if (directDamagePulse) {
                this.triggerDamagePulses([directDamagePulse]);
            }
            if (directMissPulseTargetId) {
                this.triggerMissPulse(directMissPulseTargetId);
            }
	        this.notify();
	        this.replicateAuthoritativeState();
	    }

	    private applyAreaDamage(center: Position, radius: number, damage: number, sourceUnitId: string, excludeUnitId?: string) {
            const damagePulses: Array<{ unitId: string; amount: number }> = [];
	        const hitUnits = this.state.units.map(u => {
	            if (u.id === sourceUnitId) return u;
	            if (excludeUnitId && u.id === excludeUnitId) return u;

            const dx = u.position.x - center.x;
            const dz = u.position.z - center.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

	            if (dist <= radius) {
                    const damageResult = this.applyDamageToUnit(u, damage);
                    if (damageResult.wasInvulnerable) {
                        this.log(`> BLAST DEFLECTED: IMMORTALITY SHIELD`, u.playerId);
                        return u;
                    }

                    const absorptionSuffix = damageResult.shieldAbsorbed > 0
                        ? ` (${damageResult.shieldAbsorbed} ABSORBED${damageResult.shieldBroken ? ', SHIELD DOWN' : ''})`
                        : '';

                    if (damageResult.hpDamage > 0) {
                        this.log(`> BLAST HIT ${u.type}: -${damageResult.hpDamage} HP${absorptionSuffix}`);
                        damagePulses.push({ unitId: u.id, amount: damageResult.hpDamage });
                    } else if (damageResult.shieldAbsorbed > 0) {
                        this.log(`> BLAST HIT ${u.type}: KINETIC SHIELD ABSORBS ${damageResult.shieldAbsorbed}${damageResult.shieldBroken ? ' AND COLLAPSES' : ''}`);
                    }

	                return damageResult.unit;
	            }
	            return u;
	        });

	        this.state.units = hitUnits;
            if (damagePulses.length > 0) {
                this.triggerDamagePulses(damagePulses);
            }
	        const deadUnitIds = hitUnits
            .filter(u => u.stats.hp === 0 && !u.status.isDying)
            .map(u => u.id);

        deadUnitIds.forEach((unitId) => this.removeUnit(unitId));
        if (deadUnitIds.length === 0) {
            this.checkWinCondition();
        }
    }

    private getEnvironmentalObstacles(): Set<string> {
        const obstacles = new Set<string>();
        if (this.state.mapId === 'MAP_1') {
            const worldCX = 0;
            const worldCZ = 15;
            const radius = 3.8;
            const radiusSq = radius * radius;
            const tileStride = TILE_SIZE + TILE_SPACING;
            const gridCX = (worldCX + BOARD_OFFSET) / tileStride;
            const gridCZ = (worldCZ + BOARD_OFFSET) / tileStride;
            const gridRad = radius / tileStride;
            const minX = Math.floor(gridCX - gridRad);
            const maxX = Math.ceil(gridCX + gridRad);
            const minZ = Math.floor(gridCZ - gridRad);
            const maxZ = Math.ceil(gridCZ + gridRad);
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (!this.isWithinMap(x, z)) continue;
                    const wx = (x * tileStride) - BOARD_OFFSET;
                    const wz = (z * tileStride) - BOARD_OFFSET;
                    const distSq = Math.pow(wx - worldCX, 2) + Math.pow(wz - worldCZ, 2);
                    if (distSq < radiusSq) { obstacles.add(`${x},${z}`); }
                }
            }
        }
        return obstacles;
    }

    public getAllOccupiedCells(excludeUnitId?: string): Set<string> {
        const occupied = new Set<string>();
        this.state.units.forEach(u => {
            if (u.id === excludeUnitId) return;
            const size = u.stats.size;
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) { occupied.add(`${u.position.x + i},${u.position.z + j}`); }
            }
        });
        const hazards = this.getEnvironmentalObstacles();
        hazards.forEach(key => occupied.add(key));
        return occupied;
    }

    private canUnitOccupyPosition(unit: Unit, position: Position, occupied: Set<string>): boolean {
        for (let i = 0; i < unit.stats.size; i++) {
            for (let j = 0; j < unit.stats.size; j++) {
                const x = position.x + i;
                const z = position.z + j;
                const key = `${x},${z}`;

                if (!this.isWithinMap(x, z)) {
                    return false;
                }

                if (!this.state.terrain[key] || occupied.has(key)) {
                    return false;
                }
            }
        }

        return true;
    }

    private isValidMovePath(unit: Unit, path: Position[]): boolean {
        if (path.length === 0) {
            return false;
        }

        const remainingSteps = this.getEffectiveMovement(unit) - unit.status.stepsTaken;
        if (remainingSteps <= 0 || path.length > remainingSteps) {
            return false;
        }

        const occupied = this.getAllOccupiedCells(unit.id);
        let current = unit.position;

        for (const step of path) {
            if (!getStepDirection(current, step)) {
                return false;
            }

            if (!this.canUnitOccupyPosition(unit, step, occupied)) {
                return false;
            }

            if (unit.stats.size === 1 && !canTraverseTerrainEdge(current, step, this.state.terrain)) {
                return false;
            }

            current = step;
        }

        return true;
    }

    private canCompleteMoveStep(unit: Unit, nextPos: Position): boolean {
        const occupied = this.getAllOccupiedCells(unit.id);
        if (!getStepDirection(unit.position, nextPos)) {
            return false;
        }

        if (!this.canUnitOccupyPosition(unit, nextPos, occupied)) {
            return false;
        }

        if (unit.stats.size === 1 && !canTraverseTerrainEdge(unit.position, nextPos, this.state.terrain)) {
            return false;
        }

        return true;
    }

    private animateSupportAction(
        targetUnitId: string,
        amount: number,
        pulseType: 'HEAL' | 'ENERGY',
        onResolve: () => void
    ) {
        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) {
            onResolve();
            return;
        }

        this.triggerSupportPulse(targetUnitId, amount, pulseType);

        setTimeout(() => {
            onResolve();
        }, 350);
    }

    private executeTeleportRelocation(
        unitId: string,
        destination: Position,
        options: {
            playerId: PlayerId;
            logMessage: string;
            energyCost?: number;
            wormholeLandingZoneMode?: 'NONE' | 'SOURCE_ONLY' | 'SOURCE_AND_DESTINATION';
        }
    ) {
        const startUnitIdx = this.state.units.findIndex(u => u.id === unitId);
        if (startUnitIdx === -1) return;
        const sourceUnit = this.state.units[startUnitIdx];
        const sourcePosition = { ...sourceUnit.position };
        const sourceSize = sourceUnit.stats.size;
        const startUnits = [...this.state.units];
        startUnits[startUnitIdx] = {
            ...sourceUnit,
            movePath: [],
            status: {
                ...sourceUnit.status,
                isTeleporting: true
            }
        };
        this.state.units = startUnits;
        this.notify();
        this.replicateAuthoritativeState();

        setTimeout(() => {
            const moveIdx = this.state.units.findIndex(u => u.id === unitId);
            if (moveIdx === -1) return;

            const movingUnit = this.state.units[moveIdx];
            const movedUnits = [...this.state.units];
            movedUnits[moveIdx] = {
                ...movingUnit,
                position: { ...destination },
                movePath: [],
                stats: {
                    ...movingUnit.stats,
                    energy: Math.max(0, movingUnit.stats.energy - (options.energyCost || 0))
                },
                status: {
                    ...movingUnit.status,
                    isTeleporting: true
                }
            };
            this.state.units = movedUnits;

            if (options.wormholeLandingZoneMode === 'SOURCE_ONLY' || options.wormholeLandingZoneMode === 'SOURCE_AND_DESTINATION') {
                this.createTemporaryLandingZone(options.playerId, sourcePosition, sourceSize);
            }
            if (options.wormholeLandingZoneMode === 'SOURCE_AND_DESTINATION') {
                this.createTemporaryLandingZone(options.playerId, destination, movingUnit.stats.size);
            }

            this.log(options.logMessage, options.playerId);
            this.notify();
            this.replicateAuthoritativeState();
        }, 180);

        setTimeout(() => {
            const endIdx = this.state.units.findIndex(u => u.id === unitId);
            if (endIdx === -1) return;

            const endUnits = [...this.state.units];
            endUnits[endIdx] = {
                ...endUnits[endIdx],
                status: {
                    ...endUnits[endIdx].status,
                    isTeleporting: false
                }
            };
            this.state.units = endUnits;
            this.notify();
            this.replicateAuthoritativeState();
        }, 420);
    }

    private removeUnit(unitId: string) {
        // Check if removing a Hacker with active link
        const unitToRemove = this.state.units.find(u => u.id === unitId);
        if (unitToRemove && unitToRemove.status.mindControlTargetId) {
            this.breakMindControl(unitId);
        }

        if (unitToRemove?.type === UnitType.ARC_PORTAL) {
            const owner = unitToRemove.playerId;
            Object.keys(this.state.terrain).forEach((key) => {
                const tile = this.state.terrain[key];
                if (!tile) return;

                if (tile.landingZone === owner || tile.temporaryLandingZoneOriginalOwner === owner) {
                    this.clearLandingZoneOwnership(key, owner);
                }
            });

            if (this.isContestedPlayer(owner)) {
                this.log(`> MAIN DESTROYED: ${owner} LANDING GRID OFFLINE`);
            }
        }

        // Check if removing a Mind Controlled Victim
        // If the victim dies, the Hacker's link should be cleared.
        this.state.units = this.state.units.map(u => {
            if (u.status.mindControlTargetId === unitId) {
                return { ...u, status: { ...u.status, mindControlTargetId: null } };
            }
            if (u.status.autoAttackTargetId === unitId) { return { ...u, status: { ...u.status, autoAttackTargetId: null } }; }
            return u;
        });

        if (unitToRemove?.status.dropsPerkCacheOnDeath && unitToRemove.playerId === PlayerId.NEUTRAL) {
            const hasCollectibleOnTile = this.state.collectibles.some(
                (collectible) =>
                    collectible.position.x === unitToRemove.position.x &&
                    collectible.position.z === unitToRemove.position.z
            );

            if (!hasCollectibleOnTile) {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'PERK_CACHE',
                    value: 1,
                    position: { ...unitToRemove.position }
                });
                this.log(`> NEUTRAL DROP: PERK CACHE DEPLOYED`, PlayerId.NEUTRAL);
            } else {
                this.log(`> NEUTRAL DROP BLOCKED: TILE ALREADY HAS FIELD ITEM`, PlayerId.NEUTRAL);
            }
        }

        this.state.units = this.state.units.filter(u => u.id !== unitId);
        if (this.state.selectedUnitId === unitId) {
            this.state.selectedUnitId = null;
        }
        this.updateFogOfWar();
        this.checkWinCondition(); // Check for loss when unit dies
        this.notify();
        this.replicateAuthoritativeState();
    }

    private processBackgroundMovementTick() {
        if (typeof document === 'undefined' || !document.hidden) return;
        if (!this.state.isMultiplayer || !this.isSyncAuthority()) return;
        if (this.state.appStatus !== AppStatus.PLAYING) return;

        const movingUnitIds = this.state.units
            .filter((unit) => unit.movePath.length > 0)
            .map((unit) => unit.id);

        if (movingUnitIds.length === 0) return;

        movingUnitIds.forEach((unitId) => this.completeStep(unitId));
    }

    private applyBleedStepDamage(unitId: string): boolean {
        const unitIndex = this.state.units.findIndex((unit) => unit.id === unitId);
        if (unitIndex === -1) return false;

        const unit = this.state.units[unitIndex];
        if (!this.hasBleed(unit) || unit.status.isDying) {
            return false;
        }

        if (this.isInvulnerable(unit)) {
            this.log(`> BLEED DEFLECTED: IMMORTALITY SHIELD`, unit.playerId);
            return false;
        }

        const damage = 3;
        const damageResult = this.applyDamageToUnit(unit, damage);
        const nextHp = damageResult.unit.stats.hp;
        const updatedUnit: Unit = {
            ...damageResult.unit,
            movePath: nextHp === 0 ? [] : unit.movePath,
            status: {
                ...damageResult.unit.status,
                isDying: nextHp === 0 ? true : unit.status.isDying
            }
        };

        const newUnits = [...this.state.units];
        newUnits[unitIndex] = updatedUnit;
        this.state.units = newUnits;
        if (damageResult.hpDamage > 0) {
            this.triggerDamagePulses([{ unitId, amount: damageResult.hpDamage }]);
            this.log(`> BLEED TRIGGERS ON ${unit.type}: -${damageResult.hpDamage} HP${damageResult.shieldAbsorbed > 0 ? ` (${damageResult.shieldAbsorbed} ABSORBED${damageResult.shieldBroken ? ', SHIELD DOWN' : ''})` : ''}`, unit.playerId);
        } else if (damageResult.shieldAbsorbed > 0) {
            this.log(`> BLEED TRIGGERS ON ${unit.type}: KINETIC SHIELD ABSORBS ${damageResult.shieldAbsorbed}${damageResult.shieldBroken ? ' AND COLLAPSES' : ''}`, unit.playerId);
        }

        if (nextHp === 0) {
            this.log(`> TARGET ELIMINATED: ${unit.type}`, unit.playerId);
            setTimeout(() => { this.removeUnit(unitId); }, 1500);
            return true;
        }

        return false;
    }

    public previewMove(targetX: number, targetZ: number) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;
        if (this.state.isDevMode) {
            this.state.debugLastHoverTile = { x: targetX, z: targetZ };
        }
        const { selectedUnitId, units, revealedTiles, currentTurn } = this.state;
        if (!selectedUnitId) {
            this.lastPreviewSignature = null;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = false;
            return;
        }
        const unit = units.find(u => u.id === selectedUnitId);
        if (!unit || unit.playerId !== currentTurn || this.getEffectiveMovement(unit) === 0) {
            this.lastPreviewSignature = null;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = false;
            return;
        }
        if (
            this.state.isMultiplayer &&
            !this.isSyncAuthority() &&
            this.pendingMultiplayerMoveUnitId === selectedUnitId &&
            unit.movePath.length === 0
        ) {
            this.pendingMultiplayerMoveUnitId = null;
        }
        if (
            this.state.isMultiplayer &&
            !this.isSyncAuthority() &&
            this.pendingMultiplayerMoveUnitId === selectedUnitId
        ) {
            this.lastPreviewSignature = null;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = false;
            return;
        }
        if (unit.movePath.length > 0) {
            this.lastPreviewSignature = null;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = false;
            return;
        }
        if (unit.status.stepsTaken >= this.getEffectiveMovement(unit)) {
            this.lastPreviewSignature = null;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = false;
            return;
        }
        if (this.checkUnitFrozen(unit)) {
            this.lastPreviewSignature = null;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = false;
            return;
        }

        const signature = `${unit.id}|${unit.position.x},${unit.position.z}|${unit.status.stepsTaken}|${targetX},${targetZ}`;
        const currentPathKey = this.pathToKey(this.state.previewPath);
        if (this.lastPreviewSignature === signature) {
            if (this.lastPreviewBlocked && this.state.previewPath.length === 0) {
                return;
            }
            if (this.lastPreviewPathKey === currentPathKey) {
                return;
            }
        }

        // Check if the entire target footprint is occupied
        const occupied = this.getAllOccupiedCells(unit.id);
        let isTargetBlocked = false;
        const size = unit.stats.size;

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const cx = targetX + i;
                const cz = targetZ + j;
                // Check board bounds
                if (!this.isWithinMap(cx, cz)) {
                    isTargetBlocked = true;
                    break;
                }
                // Check obstacles
                if (occupied.has(`${cx},${cz}`)) {
                    isTargetBlocked = true;
                    break;
                }
            }
            if (isTargetBlocked) break;
        }

        if (isTargetBlocked) {
            this.lastPreviewSignature = signature;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = true;
            return;
        }

        const remainingSteps = this.getEffectiveMovement(unit) - unit.status.stepsTaken;
        const traversableTiles = this.state.fogOfWarDisabled
            ? new Set(Object.keys(this.state.terrain))
            : new Set(revealedTiles);
        const path = findPath(
            unit.position,
            { x: targetX, z: targetZ },
            occupied,
            traversableTiles,
            this.state.terrain,
            size,
            this.state.mapBounds
        );
        const nextPreviewPath = path.slice(0, remainingSteps);
        const nextPathKey = this.pathToKey(nextPreviewPath);

        this.lastPreviewSignature = signature;
        this.lastPreviewPathKey = nextPathKey;
        this.lastPreviewBlocked = false;

        if (this.arePathsEqual(nextPreviewPath, this.state.previewPath)) {
            return;
        }

        this.state = { ...this.state, previewPath: nextPreviewPath };
        this.notify();
    }

    public confirmMove(isRemote: boolean = false) {
        if (!isRemote && this.state.appStatus !== AppStatus.PLAYING) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', `appStatus=${this.state.appStatus}`, { notify: true });
            return;
        }
        if (!isRemote && this.checkPlayerRestricted(this.state.currentTurn)) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', 'player is restricted this turn', { notify: true });
            return;
        }

        const { selectedUnitId, units, previewPath, currentTurn } = this.state;
        if (!selectedUnitId || previewPath.length === 0) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', `selectedUnitId=${selectedUnitId} previewPathLength=${previewPath.length}`, { notify: true });
            return;
        }

        const unitIndex = units.findIndex(u => u.id === selectedUnitId);
        if (unitIndex === -1) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', `selected unit ${selectedUnitId} not found`, { unitId: selectedUnitId, notify: true });
            return;
        }
        if (units[unitIndex].playerId !== currentTurn && !isRemote) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', `unit ${selectedUnitId} does not belong to current turn`, { unitId: selectedUnitId, notify: true });
            return;
        }

        const unit = units[unitIndex];
        if (
            this.state.isMultiplayer &&
            !this.isSyncAuthority() &&
            this.pendingMultiplayerMoveUnitId === selectedUnitId &&
            unit.movePath.length === 0
        ) {
            this.pendingMultiplayerMoveUnitId = null;
        }
        if (unit.movePath.length > 0) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', 'unit is still moving', { unitId: selectedUnitId, notify: true });
            return;
        }
        const effectiveMovement = this.getEffectiveMovement(unit);
        if (unit.status.stepsTaken >= effectiveMovement) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', `movement exhausted ${unit.status.stepsTaken}/${effectiveMovement}`, { unitId: selectedUnitId, notify: true });
            return;
        }

        if (!this.isValidMovePath(unit, previewPath)) {
            this.state.previewPath = [];
            this.pushDebugTrace('confirmMove.reject', 'REJECT', 'move path failed terrain or occupancy validation', { unitId: selectedUnitId, notify: true });
            return;
        }

        // In multiplayer, send command and wait for authoritative broadcast before mutating state.
        if (!isRemote && this.state.isMultiplayer) {
            if (!this.isSyncAuthority() && this.pendingMultiplayerMoveUnitId === selectedUnitId) {
                this.pushDebugTrace('confirmMove.reject', 'REJECT', 'move already pending sync', { unitId: selectedUnitId, notify: true });
                return;
            }

            this.dispatchAction('MOVE', {
                unitId: selectedUnitId,
                path: previewPath,
                targetX: previewPath[previewPath.length - 1].x,
                targetZ: previewPath[previewPath.length - 1].z
            });
            if (!this.isSyncAuthority()) {
                this.pendingMultiplayerMoveUnitId = selectedUnitId;
            }
            this.state.previewPath = [];
            this.notify();
            return;
        }

        const stepsToAdd = previewPath.length;
        const layout = [...units];
        // Break mind control if moving
        if (unit.status.mindControlTargetId) {
            // We need to break it. 
            // We can call breakMindControl effectively here on the copy?
            // Since breakMindControl accesses this.state.units, we should probably call it afterwards?
            // Or handle it inline for atomic updates.

            const victimId = unit.status.mindControlTargetId;
            const victimIdx = layout.findIndex(u => u.id === victimId);
            if (victimIdx !== -1 && layout[victimIdx].status.originalPlayerId) {
                layout[victimIdx] = {
                    ...layout[victimIdx],
                    playerId: layout[victimIdx].status.originalPlayerId!,
                    status: { ...layout[victimIdx].status, originalPlayerId: null }
                };
                this.log(`> HACKER MOVED: CONNECTION LOST`);
            }
            // Clear hacker status in the next update object (layout[unitIndex])
            // But layout[unitIndex] is 'unit' which we modify below.
            unit.status.mindControlTargetId = null;
        }

        const newUnits = [...layout];
        newUnits[unitIndex] = { ...unit, movePath: [...previewPath], status: { ...unit.status, stepsTaken: unit.status.stepsTaken + stepsToAdd } };

        this.pushDebugTrace('confirmMove.action', 'ACTION', `move confirmed with ${stepsToAdd} steps`, {
            unitId: selectedUnitId,
            tile: previewPath[previewPath.length - 1]
        });
        this.state = { ...this.state, units: newUnits, previewPath: [] };
        this.log(`> UNIT MOVED (${stepsToAdd} STEPS). REMAINING: ${effectiveMovement - (unit.status.stepsTaken + stepsToAdd)}`, currentTurn);
        this.notify();
    }

    public completeStep(unitId: string) {
        const unitIndex = this.state.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return;
        const unit = this.state.units[unitIndex];
        if (unit.movePath.length === 0) return;
        const nextPos = unit.movePath[0];
        if (!this.canCompleteMoveStep(unit, nextPos)) {
            const newUnits = [...this.state.units];
            newUnits[unitIndex] = { ...unit, movePath: [] };
            this.state.units = newUnits;
            this.log(`> MOVEMENT ABORTED: INVALID TERRAIN TRANSITION`, unit.playerId);
            this.notify();
            this.replicateAuthoritativeState();
            return;
        }
        const remainingPath = unit.movePath.slice(1);
        const dx = nextPos.x - unit.position.x;
        const dz = nextPos.z - unit.position.z;
        const rotation = Math.atan2(dx, dz);
        const newUnits = [...this.state.units];
        newUnits[unitIndex] = { ...unit, position: nextPos, movePath: remainingPath, rotation: rotation };
        this.state.units = newUnits;

        let shouldTriggerBonusTalentPick = false; 

        // Check for Collectibles
        const colIdx = this.state.collectibles.findIndex(c => c.position.x === nextPos.x && c.position.z === nextPos.z);
        if (colIdx > -1) {
            const collectible = this.state.collectibles[colIdx];
            const pickupMultiplier = this.getCollectiblePickupMultiplier(unit.playerId);

            if (collectible.type === 'MONEY_PRIZE') {
                const creditGain = collectible.value * pickupMultiplier;
                this.state.credits[unit.playerId] += creditGain;
                this.log(`> COLLECTIBLE ACQUIRED: $${creditGain}`, unit.playerId);
                this.state.collectibles.splice(colIdx, 1);
            }
            else if (collectible.type === 'HEALTH_PACK') {
                if (unit.stats.hp < unit.stats.maxHp) {
                    const healAmount = collectible.value * pickupMultiplier;
                    const newHp = Math.min(unit.stats.maxHp, unit.stats.hp + healAmount);
                    const appliedHeal = newHp - unit.stats.hp;
                    newUnits[unitIndex] = { ...newUnits[unitIndex], stats: { ...unit.stats, hp: newHp } };
                    this.log(`> MEDIKIT USED: +${appliedHeal} HP`, unit.playerId);
                    this.state.collectibles.splice(colIdx, 1);
                    this.state.units = newUnits; // Update ref
                }
            }
            else if (collectible.type === 'ENERGY_CELL') {
                if (unit.stats.maxEnergy > 0 && unit.stats.energy < unit.stats.maxEnergy) {
                    const energyGain = collectible.value * pickupMultiplier;
                    const newEnergy = Math.min(unit.stats.maxEnergy, unit.stats.energy + energyGain);
                    const appliedEnergy = newEnergy - unit.stats.energy;
                    newUnits[unitIndex] = { ...newUnits[unitIndex], stats: { ...unit.stats, energy: newEnergy } };
                    this.log(`> ENERGY CELL CONSUMED: +${appliedEnergy} ENERGY`, unit.playerId);
                    this.state.collectibles.splice(colIdx, 1);
                    this.state.units = newUnits;
                }
            }
            else if (collectible.type === 'PERK_CACHE') {
                shouldTriggerBonusTalentPick = true;
                this.log(`> PERK CACHE ACQUIRED: BONUS TALENT DRAFT ONLINE`, unit.playerId);
                this.state.collectibles.splice(colIdx, 1);
            }
        }

        const unitBledOut = this.applyBleedStepDamage(unit.id);
        this.updateFogOfWar();

        if (shouldTriggerBonusTalentPick) {
            this.state.pendingTalentResumePlayerId = unit.playerId;
            this.triggerTalentSelection(unit.playerId);
            return;
        }

        if (unitBledOut) {
            this.notify();
            this.replicateAuthoritativeState();
            return;
        }

        if (remainingPath.length === 0 && this.state.isMultiplayer && this.isSyncAuthority()) {
            this.processQueuedAuthoritativeMove(unit.id);
        }

        this.notify();
        this.replicateAuthoritativeState();
    }

    public triggerCharacterAction(actionId: string, isRemote: boolean = false) {
        if (!ENABLE_CHARACTER_SYSTEM) {
            return;
        }

        if (this.state.appStatus !== AppStatus.PLAYING) {
            console.log("TriggerAction Skipped: Not Playing");
            return;
        }
        const playerId = this.state.currentTurn;
        if (!isRemote && this.checkPlayerRestricted(playerId)) {
            console.log("TriggerAction Skipped: Player Restricted");
            return;
        }

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('CHARACTER_ACTION_TRIGGER', { actionId });
            return;
        }

        const actions = this.state.characterActions[playerId];
        if (!actions) {
            console.log("TriggerAction Failed: No actions found");
            return;
        }

        const actionIdx = actions.findIndex(a => a.id === actionId);
        console.log(`Triggering Action: ${actionId} for ${playerId}. Found Index: ${actionIdx}`);

        if (actionIdx === -1) return;

        const action = actions[actionIdx];

        if (this.state.roundNumber < action.minLevel) {
            this.log(`> ACTION LOCKED: REQUIRED LEVEL ${action.minLevel}`, playerId);
            return;
        }

        if (action.currentCooldown > 0) {
            this.log(`> ACTION ON COOLDOWN (${action.currentCooldown} TURNS)`, playerId);
            return;
        }

        let actionTriggered = false;

        // Execute Action: NYX_SHIELD
        if (action.id === 'NYX_SHIELD') {
            console.log("Executing NYX_SHIELD Logic...");
            const hasUnits = this.state.units.some(u => u.playerId === playerId && !BUILDING_TYPES.includes(u.type));

            if (!hasUnits) {
                this.log(`> NO VALID TARGETS FOR SHIELD`, playerId);
                return;
            }

            this.state.units = this.state.units.map(u => {
                if (u.playerId === playerId && !BUILDING_TYPES.includes(u.type)) {
                    console.log(`Applying Shield to Unit: ${u.type} (${u.id})`);
                    return this.applyImmortalityShield(u);
                }
                return u;
            });

            this.log(`> IMMORTALITY SHIELD ACTIVATED: UNITS PROTECTED`, playerId);
            actionTriggered = true;
        }

        if (actionTriggered) {
            // Set Cooldown
            const newActions = [...actions];
            newActions[actionIdx] = { ...action, currentCooldown: action.cooldown };
            this.state.characterActions[playerId] = newActions;

            this.notify();
        }
    }

    public skipTurn(isRemote: boolean = false) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn) && !isRemote) return;

        // Local input keeps SPACE-to-cancel behavior for active targeting/build modes.
        if (!isRemote && this.state.interactionState.mode !== 'NORMAL') {
            this.cancelInteraction();
            return;
        }

        // Turn handoff should not depend on local selection UI state.
        this.state.interactionState = { mode: 'NORMAL' };
        this.state.previewPath = [];
        this.state.selectedCardId = null;
        this.state.selectedUnitId = null;

        // In multiplayer, server owns turn advancement.
        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('SKIP_TURN', {});
            this.notify();
            return;
        }

        this.log(`> TURN ENDED BY ${isRemote ? 'OPPONENT' : 'USER'}`, this.state.currentTurn);
        this.endTurn(this.state.units);
    }

    public chooseTalent(talent: Talent, isRemote: boolean = false, playerIdOverride?: PlayerId) {
        if (this.state.appStatus !== AppStatus.TALENT_SELECTION) return;
        const player = playerIdOverride || this.state.currentTurn;
        if (!isRemote && this.state.isMultiplayer && this.state.myPlayerId !== player) return;

        if (player !== this.state.currentTurn) {
            this.log(`> TALENT PICK REJECTED: STALE PLAYER CONTEXT`, player);
            return;
        }

        const offeredTalent = this.state.talentChoices.find((choice) => choice.id === talent.id);
        if (!offeredTalent) {
            this.log(`> TALENT PICK REJECTED: OFFER EXPIRED`, player);
            return;
        }

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('TALENT_CHOOSE', { playerId: player, talentId: talent.id });
            return;
        }

        this.state.playerTalents[player] = [...this.state.playerTalents[player], offeredTalent];
        this.log(`> TALENT ACQUIRED: ${offeredTalent.name.toUpperCase()}`, player);

        // --- IMMEDIATE EFFECTS ---

        // t1: Global Nanites
        if (offeredTalent.id === 't1') {
            let healCount = 0;
            const newUnits = this.state.units.map(u => {
                if (u.playerId === player && u.stats.hp < u.stats.maxHp) {
                    const newHp = Math.min(u.stats.maxHp, u.stats.hp + 100);
                    healCount++;
                    return { ...u, stats: { ...u.stats, hp: newHp } };
                }
                return u;
            });
            this.state.units = newUnits;
            this.log(`> GLOBAL NANITES: REPAIRED ${healCount} UNITS`, player);
        }

        // t2: Black Budget
        if (offeredTalent.id === 't2') {
            const amount = 150;
            this.state.credits = {
                ...this.state.credits,
                [player]: this.state.credits[player] + amount
            };
            this.log(`> BLACK BUDGET: +$${amount} CREDITS`, player);
        }

        // t3: Servo Overclock (Immediate update for existing units)
        if (offeredTalent.id === 't3') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.stats.movement > 0) {
                    return { ...u, stats: { ...u.stats, movement: u.stats.movement + 1 } };
                }
                return u;
            });
            this.log(`> SERVO OVERCLOCK: UPGRADED MOBILITY`, player);
        }

        // t4: Advanced Optics (Immediate update for existing units)
        if (offeredTalent.id === 't4') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.stats.range > 1) {
                    return { ...u, stats: { ...u.stats, range: u.stats.range + 1 } };
                }
                return u;
            });
            this.log(`> ADVANCED OPTICS: UPGRADED RANGE`, player);
        }

        // t7: Kinetic Shields (Immediate application to existing units)
        if (offeredTalent.id === 't7') {
            this.state.units = this.state.units.map(u => (
                u.playerId === player && !BUILDING_TYPES.includes(u.type)
                    ? this.applyKineticShield(u)
                    : u
            ));
            this.log(`> KINETIC SHIELDS: ALL FRIENDLY NON-BUILDING UNITS PROTECTED`, player);
        }

        // t8: Marine Upgrade (Immediate update for existing units)
        if (offeredTalent.id === 't8' || offeredTalent.id === 't16') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.type === UnitType.SOLDIER) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            attack: u.stats.attack + 15,
                            range: u.stats.range + 1
                        }
                    };
                }
                return u;
            });
            this.log(`> ${offeredTalent.name.toUpperCase()}: CYBER MARINES BOOSTED`, player);
        }

        // t9: Marine Suite (Immediate update for existing units)
        if (offeredTalent.id === 't9' || offeredTalent.id === 't17') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.type === UnitType.SOLDIER) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            hp: u.stats.hp + 50,
                            maxHp: u.stats.maxHp + 50,
                            movement: u.stats.movement + 1
                        }
                    };
                }
                return u;
            });
            this.log(`> ${offeredTalent.name.toUpperCase()}: CYBER MARINES HARDENED`, player);
        }

        // t10: Dreadnought Offense (Immediate update for existing units)
        if (offeredTalent.id === 't10' || offeredTalent.id === 't18') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.type === UnitType.HEAVY) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            attack: u.stats.attack + 20,
                            range: u.stats.range + 1
                        }
                    };
                }
                return u;
            });
            this.log(`> ${offeredTalent.name.toUpperCase()}: WEAPONS HOT`, player);
        }

        // t11: Dreadnought Armor (Immediate update for existing units)
        if (offeredTalent.id === 't11' || offeredTalent.id === 't19') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.type === UnitType.HEAVY) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            hp: u.stats.hp + 100,
                            maxHp: u.stats.maxHp + 100
                        }
                    };
                }
                return u;
            });
            this.log(`> ${offeredTalent.name.toUpperCase()}: PLATING REINFORCED`, player);
        }

        // t12: Drone Upgrade (Immediate update for existing units)
        if (offeredTalent.id === 't12' || offeredTalent.id === 't20') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && this.isDroneUnit(u)) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            hp: u.stats.hp + 20,
                            maxHp: u.stats.maxHp + 20,
                            movement: u.stats.movement + 2
                        }
                    };
                }
                return u;
            });
            this.log(`> ${offeredTalent.name.toUpperCase()}: DRONES OPTIMIZED`, player);
        }

        // t13: Tanks Upgrade (Immediate update for existing units)
        if (offeredTalent.id === 't13' || offeredTalent.id === 't21') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && (u.type === UnitType.LIGHT_TANK || u.type === UnitType.HEAVY_TANK)) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            attack: u.stats.attack + 20,
                            hp: u.stats.hp + 100,
                            maxHp: u.stats.maxHp + 100
                        }
                    };
                }
                return u;
            });
            this.log(`> ${offeredTalent.name.toUpperCase()}: ARMOR COLUMN ENHANCED`, player);
        }

        // t24: Reinforced Walls (Immediate update for existing units)
        if (offeredTalent.id === 't24') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && (u.type === UnitType.WALL || u.type === UnitType.TOWER || u.type === UnitType.CHARGING_STATION)) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            hp: u.stats.hp + 100,
                            maxHp: u.stats.maxHp + 100
                        }
                    };
                }
                return u;
            });
            this.log(`> REINFORCED WALLS: DEFENSIVE GRID FORTIFIED`, player);
        }

        // t26: Nano Blades (Immediate update for existing units)
        if (offeredTalent.id === 't26') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.type === UnitType.CONE) {
                    return {
                        ...u,
                        stats: {
                            ...u.stats,
                            attack: u.stats.attack + 20,
                            hp: u.stats.hp + 20,
                            maxHp: u.stats.maxHp + 20
                        }
                    };
                }
                return u;
            });
            this.log(`> NANO BLADES: APEX BLADES SHARPENED`, player);
        }

        // t27: Negotiator
        if (offeredTalent.id === 't27') {
            this.log(`> NEGOTIATOR: REROLLS DISCOUNTED AND TRANSIT SELLS ENABLED`, player);
        }

        // t28: Rapid Deployment
        if (offeredTalent.id === 't28') {
            this.log(`> RAPID DEPLOYMENT: NEW SUMMONS IGNORE SUMMONING SICKNESS`, player);
        }

        // t29: Portal Exchange
        if (offeredTalent.id === 't29') {
            if (this.applyRitualPortalDamage(player, 300)) {
                this.state.credits = {
                    ...this.state.credits,
                    [player]: this.state.credits[player] + 300
                };
                this.log(`> PORTAL EXCHANGE: ARC PORTAL -300 HP, +$300`, player);
            }
        }

        // t30: Economist
        if (offeredTalent.id === 't30') {
            this.log(`> ECONOMIST: TURN INCOME INCREASED AND FIELD PICKUPS DOUBLED`, player);
        }

        // t31: Wormhole
        if (offeredTalent.id === 't31') {
            this.log(`> WORMHOLE: TELEPORTS NOW OPEN TEMPORARY LANDING ZONES`, player);
        }

        // t14: Perk Expert
        if (offeredTalent.id === 't14') {
            this.state.credits = {
                ...this.state.credits,
                [player]: this.state.credits[player] + 50
            };
            this.state.playerTalentDraftCounts = {
                ...this.state.playerTalentDraftCounts,
                [player]: Math.max(this.state.playerTalentDraftCounts[player] || 3, 5)
            };
            this.log(`> PERK EXPERT: +$50 AND FUTURE DRAFTS EXPANDED TO 5`, player);
        }

        // t15: Ritual
        if (offeredTalent.id === 't15') {
            if (this.applyRitualPortalDamage(player, 1500)) {
                this.state.pendingTalentQueue = [player, player, player, ...this.state.pendingTalentQueue];
                this.log(`> RITUAL EXECUTED: ARC PORTAL SACRIFICED FOR 3 BONUS DRAFTS`, player);
            }
        }

        this.state.talentChoices = [];

        if (this.state.pendingTalentQueue.length > 0) {
            const [nextPlayer, ...remainingQueue] = this.state.pendingTalentQueue;
            this.state.pendingTalentQueue = remainingQueue;
            this.triggerTalentSelection(nextPlayer, isRemote);
            return;
        }

        const resumePlayer = this.state.pendingTalentResumePlayerId || player;
        this.state.pendingTalentResumePlayerId = null;
        this.state.appStatus = AppStatus.PLAYING;
        this.state.currentTurn = resumePlayer;
        this.resetTurnTimer();
        this.state.selectedCardId = this.getTurnStartSelectedCardId(resumePlayer);
        this.state.selectedUnitId = null;
        this.state.previewPath = [];
        this.state.interactionState = { mode: 'NORMAL' };
        this.updateFogOfWar();
        this.log(`> TURN ENDED. PLAYER ${resumePlayer} ACTIVE.`);
        if (this.isPlayerSilenced(resumePlayer)) {
            this.log(`> SILENCE ACTIVE: ${resumePlayer} CANNOT DEPLOY OR CAST THIS TURN`, resumePlayer);
        }

        if (this.state.isMultiplayer && this.isSyncAuthority()) {
            this.replicateAuthoritativeState();
        }
        this.notify();
    }

    private generateTalentChoices(playerId: PlayerId): Talent[] {
        const pool = TALENT_POOL.filter((talent) => this.canOfferTalentToPlayer(playerId, talent));
        const shuffled = pool.sort(() => 0.5 - Math.random());
        const draftCount = Math.max(1, this.state.playerTalentDraftCounts[playerId] || 3);
        return shuffled.slice(0, draftCount);
    }

    private openTalentSelection(playerId: PlayerId, choices: Talent[]) {
        this.state.currentTurn = playerId;
        this.state.selectedCardId = this.getTurnStartSelectedCardId(playerId);
        this.state.selectedUnitId = null;
        this.state.previewPath = [];
        this.state.interactionState = { mode: 'NORMAL' };
        this.state.talentChoices = choices;
        this.state.appStatus = AppStatus.TALENT_SELECTION;
        this.log(`> LEVEL UP! SELECT TALENT PROTOCOL INITIATED.`, playerId);
    }

    private triggerTalentSelection(playerId: PlayerId, isRemote: boolean = false, forcedChoices?: Talent[]) {
        const choices = forcedChoices || this.generateTalentChoices(playerId);
        this.openTalentSelection(playerId, choices);

        if (this.state.isMultiplayer && this.isSyncAuthority()) {
            this.replicateAuthoritativeState();
        }
        this.notify();
    }

    // --- RECURSIVE AUTO ATTACK ---
    private executeAutoAttackCycle(playerId: PlayerId) {
        const units = [...this.state.units];
        const attackers = units.filter(u => u.playerId === playerId && u.status.autoAttackTargetId && u.status.attacksUsed < u.stats.maxAttacks);

        let anyAttackTriggered = false;

        // Find eligible attackers for this cycle
        attackers.forEach(attacker => {
            if (this.checkUnitFrozen(attacker)) return;

            const targetId = attacker.status.autoAttackTargetId;
            const target = units.find(t => t.id === targetId);

            if (!target || (target.stats.hp <= 0 && !target.status.isDying)) {
                // Target gone
                const uIdx = this.state.units.findIndex(u => u.id === attacker.id);
                if (uIdx !== -1) this.state.units[uIdx].status.autoAttackTargetId = null;
                return;
            }

            const check = this.checkAttackValidity(attacker, target);
            if (check.isValid) {
                anyAttackTriggered = true;

                // Trigger Visuals
                const uIdx = this.state.units.findIndex(u => u.id === attacker.id);
                if (uIdx !== -1) {
                    this.state.units[uIdx].status.attackTargetId = targetId;
                }

                const remaining = attacker.stats.maxAttacks - attacker.status.attacksUsed - 1;
                this.log(`> AUTO-ATTACK ENGAGED: ${attacker.type} -> ${target.type} ${remaining > 0 ? '(MULTI-STRIKE)' : ''}`, playerId);

                // Schedule Resolution
                const impactDelay = this.getAttackImpactDelay(attacker, target);
                setTimeout(() => {
                    this.resolveAttack(attacker.id, targetId!);
                }, impactDelay);
            } else {
                // Invalid (out of range/LOS), clear target
                this.log(`> AUTO-ATTACK DISENGAGED: ${check.reason}`, playerId);
                const uIdx = this.state.units.findIndex(u => u.id === attacker.id);
                if (uIdx !== -1) this.state.units[uIdx].status.autoAttackTargetId = null;
            }
        });

        if (anyAttackTriggered) {
            this.notify();
            // Schedule next cycle to check for double strikes or chain events
            setTimeout(() => {
                this.executeAutoAttackCycle(playerId);
            }, 1000);
        } else {
            // No more attacks possible, finalize turn
            this.finalizeTurnLogic();
        }
    }

    private finalizeTurnLogic() {
        const finalize = () => {
            this.processEffects(this.state.currentTurn);
            this.processStructures(this.state.currentTurn);
            this.processPassiveTalents(this.state.currentTurn);

            const completeRoundTransition = () => {
                const turnOrder = this.state.turnOrder.length > 0 ? this.state.turnOrder : [...this.state.activePlayerIds];
                const nextTurn = this.getNextTurnInOrder(this.state.currentTurn, turnOrder);
                const didAdvanceRound = this.isLastTurnInOrder(this.state.currentTurn, turnOrder);
                let nextRound = this.state.roundNumber;
                const nextTurnCount = this.state.turnCount + 1;

                if (didAdvanceRound) {
                    nextRound++;
                    this.log(`> SIMULATION LEVEL ${nextRound}`);
                    this.state.units = this.state.units.map(u => ({ ...u, level: (u.level || 1) + 1 }));
                    this.processDeliveries(nextRound);
                }

                const refreshedUnits = this.state.units.map(u => {
                    if (u.playerId === nextTurn) {
                        return { ...u, status: { ...u.status, stepsTaken: 0, attacksUsed: 0, hasAttacked: false } };
                    }
                    return u;
                });

                this.state = {
                    ...this.state,
                    units: refreshedUnits,
                    currentTurn: nextTurn,
                    turnStartedAt: Date.now(),
                    turnOvertimeDamageApplied: 0,
                    roundNumber: nextRound,
                    turnCount: nextTurnCount,
                    selectedCardId: this.getTurnStartSelectedCardId(nextTurn),
                    selectedUnitId: null,
                    interactionState: { mode: 'NORMAL' }
                };
                this.cleanupExpiredTemporaryLandingZones();
                this.awardTurnStartIncome(nextTurn, nextRound);
                this.updateFogOfWar();

                if (this.checkPlayerRestricted(nextTurn)) {
                    this.log(`> WARNING: PLAYER ${nextTurn} SYSTEMS COMPROMISED`);
                }
                if (this.isPlayerSilenced(nextTurn)) {
                    this.log(`> SILENCE ACTIVE: ${nextTurn} CANNOT DEPLOY OR CAST THIS TURN`, nextTurn);
                }

                if (didAdvanceRound && nextRound > 0 && nextRound % TALENT_SELECTION_LEVEL_STEP === 0) {
                    const talentQueue = turnOrder.filter((playerId) => this.state.activePlayerIds.includes(playerId));
                    const [firstPlayer, ...remainingPlayers] = talentQueue;

                    this.state.pendingTalentQueue = remainingPlayers;
                    this.state.pendingTalentResumePlayerId = nextTurn;

                    if (firstPlayer) {
                        this.triggerTalentSelection(firstPlayer);
                        return;
                    }
                } else {
                    this.log(`> TURN ENDED. PLAYER ${nextTurn} ACTIVE.`);
                }

                if (this.state.isMultiplayer && this.isSyncAuthority()) {
                    this.replicateAuthoritativeState();
                }

                this.notify();
            };

            if (this.isLastTurnInOrder(this.state.currentTurn)) {
                this.executeNeutralCreepTurn(() => {
                    completeRoundTransition();
                });
                return;
            }

            completeRoundTransition();
        };

        finalize();
    }

    public debugSetTurn(playerId: PlayerId) {
        if (!this.state.isDevMode) return;

        // Reset units for the new player so they can act
        const refreshedUnits = this.state.units.map(u => {
            if (u.playerId === playerId) {
                return { ...u, status: { ...u.status, stepsTaken: 0, attacksUsed: 0, hasAttacked: false } };
            }
            return u;
        });

        this.state = {
            ...this.state,
            units: refreshedUnits,
            currentTurn: playerId,
            turnStartedAt: Date.now(),
            turnOvertimeDamageApplied: 0,
            selectedCardId: this.getTurnStartSelectedCardId(playerId),
            selectedUnitId: null,
            interactionState: { mode: 'NORMAL' }
        };
        this.updateFogOfWar();

        this.log(`> [DEV] TURN OVERRIDE: ${playerId} ACTIVE`);
        if (this.isPlayerSilenced(playerId)) {
            this.log(`> SILENCE ACTIVE: ${playerId} CANNOT DEPLOY OR CAST THIS TURN`, playerId);
        }
        this.notify();
    }

    private endTurn(updatedUnits: Unit[]) {
        this.state.units = updatedUnits;
        this.executeAutoAttackCycle(this.state.currentTurn);
    }
}

export const gameService = new GameService();




