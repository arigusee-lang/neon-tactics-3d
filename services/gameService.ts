
import { GameState, PlayerId, Unit, PlacePayload, UnitType, Card, Position, CardCategory, LogEntry, InteractionMode, AppStatus, Effect, Talent, TerrainData, TerrainTool, ShopItem, UnitStats, DebugClickTraceEntry, DebugClickResult, DebugPointerMeta, MapBounds, MapMetadata, MapPlayerSupport, MapPreviewData } from '../types';
import { BOARD_SIZE, INITIAL_FIELD_SIZE, CARD_CONFIG, INITIAL_CREDITS, TILE_SIZE, TILE_SPACING, BOARD_OFFSET, BUILDING_TYPES, COLORS, CHARACTERS, MAX_INVENTORY_CAPACITY, DEV_ONLY_UNITS } from '../constants';
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
    { id: 't7', name: 'Kinetic Shields', description: 'All mobile units are deployed with a 50 HP Energy Shield.', icon: '🛡️', color: '#e2e8f0' },
    { id: 't8', name: 'Marine Upgrade', description: 'Newly deployed Cyber Marines gain +15 Attack and +1 Range.', icon: '🔫', color: '#60a5fa' },
    { id: 't9', name: 'Marine Suite', description: 'Newly deployed Cyber Marines gain +50 HP and +1 Mobility.', icon: '🦿', color: '#3b82f6' },
    { id: 't10', name: 'Dreadnought Offense', description: 'Newly deployed Dreadnoughts gain +20 Attack and +1 Range.', icon: '💥', color: '#ef4444' },
    { id: 't11', name: 'Dreadnought Armor', description: 'Newly deployed Dreadnoughts gain +100 HP.', icon: '🛡️', color: '#71717a' },
    { id: 't12', name: 'Drone Range', description: 'Scout Drones and Ticks gain +2 Mobility.', icon: '🛸', color: '#f59e0b' }
];

import { io, Socket } from 'socket.io-client';

// Map Loading
// Note: We use eager loading to get the map content synchronously at startup.
const mapModules = import.meta.glob('../maps/*.json', { eager: true });
const loadedMaps: Record<string, any> = {};

Object.keys(mapModules).forEach(path => {
    const fileName = path.split('/').pop()?.replace('.json', '') || 'Unknown Map';
    loadedMaps[fileName] = (mapModules[path] as any).default || mapModules[path];
});

interface MapJsonShape {
    description?: string;
    players?: MapPlayerSupport;
    terrain?: Record<string, TerrainData>;
    units?: any[];
    collectibles?: any[];
    mapSize?: { x: number; y: number };
    size?: { x: number; y: number };
    mapOrigin?: { x: number; z: number };
    origin?: { x: number; z: number };
    deletedTiles?: string[];
}

const normalizeMapPlayers = (value: unknown): MapPlayerSupport => {
    if (value === 2 || value === 3 || value === 4 || value === 'dev') {
        return value;
    }
    return 2;
};

const normalizeMapDescription = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const BUILT_IN_MAPS: MapMetadata[] = [
    {
        id: 'MAP_1',
        description: 'Classic starter battlefield.',
        players: 2
    }
];

const AVAILABLE_MAPS: MapMetadata[] = [
    ...BUILT_IN_MAPS,
    ...Object.keys(loadedMaps)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map((mapId) => {
            const mapData = loadedMaps[mapId] as MapJsonShape;
            return {
                id: mapId,
                description: normalizeMapDescription(mapData.description),
                players: normalizeMapPlayers(mapData.players)
            };
        })
];

interface PendingStartConfig {
    mapType: string;
    isDevMode: boolean;
    customSize?: { x: number; y: number };
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
    shopStock: ShopItem[];
    pendingOrders: ShopItem[];
    deck: Card[];
    logMessage?: string;
}

class GameService {
    private state: GameState;
    private listeners: Set<Listener> = new Set();
    private discovered: Set<string> = new Set();
    private socket: Socket | null = null;
    private authoritySocketId: string | null = null;
    private lastPreviewSignature: string | null = null;
    private lastPreviewPathKey: string = '';
    private lastPreviewBlocked = false;
    private unitCycleOrder: string[] = [];
    private unitCycleSetKey: string = '';
    private lastTabSelectionId: string | null = null;
    private pendingStartConfig: PendingStartConfig | null = null;
    private readonly authoritativeActions = new Set<string>([
        'SYNC_STATE',
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
        'MIND_CONTROL_TARGET',
        'MIND_CONTROL_BREAK',
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
    }

    private isSyncAuthority(): boolean {
        return !!this.socket?.id && !!this.authoritySocketId && this.socket.id === this.authoritySocketId;
    }

    private createEmptyPlayerCharacters(): Record<PlayerId, string | null> {
        return {
            [PlayerId.ONE]: null,
            [PlayerId.TWO]: null,
            [PlayerId.NEUTRAL]: null
        };
    }

    private replicateAuthoritativeState(delayMs: number = 0) {
        if (!this.state.isMultiplayer || !this.isSyncAuthority()) return;

        window.setTimeout(() => {
            if (!this.state.isMultiplayer || !this.isSyncAuthority()) return;
            this.dispatchAction('SYNC_STATE', this.buildSyncStatePayload());
        }, delayMs);
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

        this.socket.on('lobby_created', (payload: string | { roomId: string; mapId?: string; authoritySocketId?: string }) => {
            const roomId = typeof payload === 'string' ? payload : payload.roomId;
            const mapId = typeof payload === 'string' ? null : (payload.mapId || null);
            const authoritySocketId = typeof payload === 'string' ? null : (payload.authoritySocketId || null);
            console.log('Lobby Created:', roomId, mapId ? `map=${mapId}` : '');
            this.state.roomId = roomId;
            this.state.isMultiplayer = true;
            this.state.myPlayerId = PlayerId.ONE;
            this.authoritySocketId = authoritySocketId || this.socket?.id || null;
            this.log(`> LOBBY ESTABLISHED: ${roomId}${mapId ? ` [${mapId}]` : ''}`, PlayerId.ONE);
            this.notify();
        });

        this.socket.on('game_start', (data: { roomId: string; players: string[]; mapId?: string; authoritySocketId?: string }) => {
            console.log('Game Start:', data);
            this.state.roomId = data.roomId;
            this.state.isMultiplayer = true;
            this.authoritySocketId = data.authoritySocketId || data.players[0] || null;

            // Resolve role from server socket order: players[0] is host (P1), players[1] is joiner (P2).
            const mySocketId = this.socket?.id;
            const myIndex = mySocketId ? data.players.indexOf(mySocketId) : -1;
            if (myIndex === 0) {
                this.state.myPlayerId = PlayerId.ONE;
            } else if (myIndex === 1) {
                this.state.myPlayerId = PlayerId.TWO;
            } else if (!this.state.myPlayerId) {
                // Fallback for unexpected payloads/reconnect race.
                this.state.myPlayerId = PlayerId.TWO;
            }

            this.beginMatchSetup(data.mapId || 'MAP_1', false);
            this.log(`> MULTIPLAYER LINK ESTABLISHED. YOU ARE ${this.state.myPlayerId === PlayerId.ONE ? 'PLAYER 1' : 'PLAYER 2'}`, this.state.myPlayerId!);
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
            this.log(`> COMMAND REJECTED [${payload.action}]: ${payload.reason}`);
            this.notify();
        });

        this.socket.on('error_message', (msg: string) => {
            alert(msg);
        });
    }

    public createLobby(mapId: string = 'MAP_1') {
        if (this.socket) {
            this.socket.emit('create_lobby', { mapId });
        }
    }

    public joinLobby(roomId: string) {
        if (this.socket) {
            // Clear stale role if this client previously hosted another lobby.
            this.state.myPlayerId = null;
            this.authoritySocketId = null;
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
            decks: {
                [PlayerId.ONE]: this.state.decks[PlayerId.ONE].map((card) => this.cloneCardForSync(card)),
                [PlayerId.TWO]: this.state.decks[PlayerId.TWO].map((card) => this.cloneCardForSync(card)),
                [PlayerId.NEUTRAL]: this.state.decks[PlayerId.NEUTRAL].map((card) => this.cloneCardForSync(card))
            },
            units: this.state.units.map((unit) => ({ ...unit })),
            collectibles: this.state.collectibles.map((collectible) => ({ ...collectible })),
            credits: { ...this.state.credits },
            mapBounds: this.state.mapBounds,
            deletedTiles: [...this.state.deletedTiles],
            currentTurn: this.state.currentTurn,
            roundNumber: this.state.roundNumber,
            shopStock: {
                [PlayerId.ONE]: this.state.shopStock[PlayerId.ONE].map((item) => ({ ...item })),
                [PlayerId.TWO]: this.state.shopStock[PlayerId.TWO].map((item) => ({ ...item })),
                [PlayerId.NEUTRAL]: this.state.shopStock[PlayerId.NEUTRAL].map((item) => ({ ...item }))
            },
            pendingOrders: {
                [PlayerId.ONE]: this.state.pendingOrders[PlayerId.ONE].map((item) => ({ ...item })),
                [PlayerId.TWO]: this.state.pendingOrders[PlayerId.TWO].map((item) => ({ ...item })),
                [PlayerId.NEUTRAL]: this.state.pendingOrders[PlayerId.NEUTRAL].map((item) => ({ ...item }))
            },
            nextDeliveryRound: this.state.nextDeliveryRound,
            shopAvailable: this.state.shopAvailable,
            recentlyDeliveredCardIds: {
                [PlayerId.ONE]: [...this.state.recentlyDeliveredCardIds[PlayerId.ONE]],
                [PlayerId.TWO]: [...this.state.recentlyDeliveredCardIds[PlayerId.TWO]],
                [PlayerId.NEUTRAL]: [...this.state.recentlyDeliveredCardIds[PlayerId.NEUTRAL]]
            },
            playerTalents: {
                [PlayerId.ONE]: this.state.playerTalents[PlayerId.ONE].map((talent) => ({ ...talent })),
                [PlayerId.TWO]: this.state.playerTalents[PlayerId.TWO].map((talent) => ({ ...talent })),
                [PlayerId.NEUTRAL]: this.state.playerTalents[PlayerId.NEUTRAL].map((talent) => ({ ...talent }))
            },
            characterActions: {
                [PlayerId.ONE]: this.state.characterActions[PlayerId.ONE].map((action) => ({ ...action })),
                [PlayerId.TWO]: this.state.characterActions[PlayerId.TWO].map((action) => ({ ...action })),
                [PlayerId.NEUTRAL]: this.state.characterActions[PlayerId.NEUTRAL].map((action) => ({ ...action }))
            },
            playerCharacters: { ...this.state.playerCharacters },
            unlockedUnits: {
                [PlayerId.ONE]: [...this.state.unlockedUnits[PlayerId.ONE]],
                [PlayerId.TWO]: [...this.state.unlockedUnits[PlayerId.TWO]],
                [PlayerId.NEUTRAL]: [...this.state.unlockedUnits[PlayerId.NEUTRAL]]
            },
            playerEffects: {
                [PlayerId.ONE]: this.state.playerEffects[PlayerId.ONE].map((effect) => ({ ...effect })),
                [PlayerId.TWO]: this.state.playerEffects[PlayerId.TWO].map((effect) => ({ ...effect })),
                [PlayerId.NEUTRAL]: this.state.playerEffects[PlayerId.NEUTRAL].map((effect) => ({ ...effect }))
            },
            interactionState: { ...this.state.interactionState },
            tilePulse: this.state.tilePulse ? { ...this.state.tilePulse } : null,
            winner: this.state.winner
        };
    }

    private handleRemoteAction(action: string, data: any) {
        // Apply the action locally without checking for "my turn" restriction
        // because we trust the server/opponent sends valid moves for their turn

        switch (action) {
            case 'MOVE':
                // We need to simulate the move. 
                // data: { unitId, path } -> But confirmMove uses previewPath
                // Simplest way: set previewPath, selectUnit, then confirmMove
                this.state.selectedUnitId = data.unitId;
                this.state.previewPath = data.path;
                // Bypass checks
                if (this.state.units.find(u => u.id === data.unitId)) {
                    this.confirmMove(true);
                }
                break;
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
            case 'MIND_CONTROL_TARGET':
                this.handleMindControlTarget(data.targetUnitId, true, data.sourceUnitId);
                break;
            case 'MIND_CONTROL_BREAK':
                this.breakMindControl(data.hackerId);
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
                const chosenTalent = this.state.talentChoices.find(t => t.id === data.talentId)
                    || TALENT_POOL.find(t => t.id === data.talentId);
                if (chosenTalent) {
                    this.chooseTalent(chosenTalent, true);
                }
                break;
            }
            case 'SYNC_STATE':
                // Overwrite critical state parts
                this.state.terrain = data.terrain;
                this.state.decks = data.decks;
                this.state.credits = data.credits;
                this.state.collectibles = data.collectibles || [];
                if (data.mapBounds) {
                    this.state.mapBounds = data.mapBounds;
                }
                this.state.deletedTiles = data.deletedTiles || [];
                if (data.currentTurn) {
                    this.state.currentTurn = data.currentTurn;
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
                if (typeof data.winner !== 'undefined') {
                    this.state.winner = data.winner;
                }

                const syncedInteractionState = data.interactionState
                    ? { ...data.interactionState }
                    : { mode: 'NORMAL' };
                const shouldApplyInteractionState = !this.state.isMultiplayer
                    || !this.state.myPlayerId
                    || this.state.currentTurn === this.state.myPlayerId;

                // Merge units? Or overwrite? 
                // Initial sync should overwrite.
                this.state.units = data.units.map((u: any) => ({ ...u })); // Deepish copy
                this.state.selectedCardId = shouldApplyInteractionState && syncedInteractionState.mode === 'NORMAL'
                    ? this.state.decks[this.state.currentTurn][0]?.id || null
                    : null;
                this.state.selectedUnitId = null;
                this.state.previewPath = [];
                this.state.interactionState = shouldApplyInteractionState
                    ? syncedInteractionState
                    : { mode: 'NORMAL' };
                this.notify();
                break;
        }

        if (action !== 'SYNC_STATE') {
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

        // Default Unlock Pool (excludes Medic, Light Tank, Heavy Tank)
        const baseUnlocks = Object.keys(CARD_CONFIG).filter(k =>
            k !== UnitType.MEDIC &&
            k !== UnitType.LIGHT_TANK &&
            k !== UnitType.HEAVY_TANK &&
            !DEV_ONLY_UNITS.includes(k as UnitType)
        ) as UnitType[];

        return {
            appStatus: AppStatus.MENU,
            mapId: 'EMPTY',
            lightMode: 'DARK',
            currentTurn: PlayerId.ONE,
            winner: null,
            roundNumber: 1,
            units: [],
            collectibles: [],
            revealedTiles: Array.from(this.discovered),
            terrain: {},
            mapBounds,
            deletedTiles: [],
            decks: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },
            selectedCardId: null,
            selectedUnitId: null,
            previewPath: [],
            systemMessage: "WAITING FOR START COMMAND",
            actionLog: [initialLog],
            interactionState: { mode: 'NORMAL' },
            tilePulse: null,
            playerEffects: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },
            playerTalents: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },
            characterActions: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },
            talentChoices: [],

            // Character System
            playerCharacters: {
                [PlayerId.ONE]: null,
                [PlayerId.TWO]: null,
                [PlayerId.NEUTRAL]: null
            },
            unlockedUnits: {
                [PlayerId.ONE]: [...baseUnlocks],
                [PlayerId.TWO]: [...baseUnlocks],
                [PlayerId.NEUTRAL]: []
            },

            // Shop Init
            credits: {
                [PlayerId.ONE]: INITIAL_CREDITS,
                [PlayerId.TWO]: INITIAL_CREDITS,
                [PlayerId.NEUTRAL]: 0
            },
            shopStock: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },
            pendingOrders: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },
            nextDeliveryRound: 10,
            shopAvailable: true,
            deliveryHappened: false,
            recentlyDeliveredCardIds: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },
            isDevMode: false,
            debugClickTrace: [],
            debugLastDecision: null,
            debugLastHoverTile: null,

            // Multiplayer
            roomId: null,
            isMultiplayer: false,
            myPlayerId: null,
            availableMaps: AVAILABLE_MAPS
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
            players: 2 as MapPlayerSupport,
            mapSize: { x: this.state.mapBounds.width, y: this.state.mapBounds.height },
            mapOrigin: { x: this.state.mapBounds.originX, z: this.state.mapBounds.originZ },
            deletedTiles: Array.from(deletedSet),
            terrain: this.state.terrain,
            units: this.state.units.map(u => ({
                id: u.id,
                playerId: u.playerId,
                position: u.position,
                type: u.type,
                rotation: u.rotation,
                level: u.level
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

    private checkUnitFrozen(unit: Unit): boolean {
        return unit.effects.some(e => e.name === 'CRYO STASIS' || e.name === 'SYSTEM FREEZE');
    }

    private getRandomColor(playerId: PlayerId): string {
        return playerId === PlayerId.ONE ? COLORS.P1 : playerId === PlayerId.TWO ? COLORS.P2 : COLORS.NEUTRAL;
    }

    // --- WIN CONDITION CHECK ---
    private checkWinCondition() {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.state.isDevMode) return;

        const p1HasUnits = this.state.units.some(u => u.playerId === PlayerId.ONE);
        const p2HasUnits = this.state.units.some(u => u.playerId === PlayerId.TWO);

        if (!p1HasUnits) {
            this.state.winner = PlayerId.TWO;
            this.state.appStatus = AppStatus.GAME_OVER;
            this.log(`> MISSION FAILURE: PLAYER 1 ELIMINATED.`);
            this.log(`> VICTORY: PLAYER 2`);
            this.notify();
        } else if (!p2HasUnits) {
            this.state.winner = PlayerId.ONE;
            this.state.appStatus = AppStatus.GAME_OVER;
            this.log(`> MISSION FAILURE: PLAYER 2 ELIMINATED.`);
            this.log(`> VICTORY: PLAYER 1`);
            this.notify();
        }
    }

    // --- CORE GAME ACTIONS ---

    public toggleLightMode() {
        this.state.lightMode = this.state.lightMode === 'DARK' ? 'LIGHT' : 'DARK';
        this.log(`> VISUAL PROTOCOL: ${this.state.lightMode} MODE ENABLED`);
        this.notify();
    }

    public enterCharacterSelection(config?: PendingStartConfig) {
        if (config) {
            this.pendingStartConfig = { ...config };
        }
        this.state.appStatus = AppStatus.CHARACTER_SELECTION;
        this.log("> CHARACTER SELECTION MATRIX INITIALIZED.");
        this.notify();
    }

    public beginMatchSetup(mapType: string, isDevMode: boolean, customSize?: { x: number; y: number }) {
        this.pendingStartConfig = { mapType, isDevMode, customSize };
        this.state.playerCharacters = this.createEmptyPlayerCharacters();
        this.enterCharacterSelection();
    }

    public finalizeCharacterSelection() {
        const config = this.pendingStartConfig;
        this.pendingStartConfig = null;

        if (!config) {
            this.enterMapSelection();
            return;
        }

        this.startGame(config.mapType, config.isDevMode, config.customSize);
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

    public exitCardCatalogue() {
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
        shopStock: ShopItem[],
        pendingOrders: ShopItem[],
        deck: Card[],
        logMessage?: string
    ): ShopSyncPayload {
        return {
            playerId,
            credits,
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
        if (this.state.appStatus !== AppStatus.SHOP || this.state.winner) return;
        if (this.state.isMultiplayer && this.state.myPlayerId !== playerId) return;

        const stockEntryIndex = this.state.shopStock[playerId].findIndex((shopItem) => shopItem.id === item.id);
        if (stockEntryIndex === -1) {
            this.log("> STOCK ENTRY NOT FOUND", playerId);
            return;
        }

        const reservedSlots = this.state.decks[playerId].length + this.state.pendingOrders[playerId].length;
        if (reservedSlots >= MAX_INVENTORY_CAPACITY) {
            this.log(`> INVENTORY FULL (${MAX_INVENTORY_CAPACITY}/${MAX_INVENTORY_CAPACITY})`, playerId);
            return;
        }

        if (this.state.credits[playerId] < item.cost) {
            this.log("> INSUFFICIENT FUNDS");
            return;
        }

        const nextCredits = this.state.credits[playerId] - item.cost;
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
        if (this.state.appStatus !== AppStatus.SHOP || this.state.winner) return;
        if (this.state.isMultiplayer && this.state.myPlayerId !== playerId) return;
        const currentOrders = this.state.pendingOrders[playerId];
        const orderIdx = currentOrders.findIndex(i => i.id === item.id);

        if (orderIdx > -1) {
            const refundedOrder = currentOrders[orderIdx];
            const nextPendingOrders = [...currentOrders];
            nextPendingOrders.splice(orderIdx, 1);

            const nextCredits = this.state.credits[playerId] + refundedOrder.cost;
            const { purchaseRound, ...stockItem } = refundedOrder;
            const nextShopStock = [...this.state.shopStock[playerId], stockItem as ShopItem];
            const nextDeck = [...this.state.decks[playerId]];

            const payload = this.buildShopSyncPayload(
                playerId,
                nextCredits,
                nextShopStock,
                nextPendingOrders,
                nextDeck,
                `> ORDER CANCELLED: +$${refundedOrder.cost}`
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
        if (this.state.appStatus !== AppStatus.SHOP || this.state.winner) return;
        if (this.state.isMultiplayer && this.state.myPlayerId !== playerId) return;
        const REROLL_COST = 50;

        if (this.state.credits[playerId] < REROLL_COST) {
            this.log("> INSUFFICIENT FUNDS FOR REROLL");
            return;
        }

        const currentStockCount = this.state.shopStock[playerId].length;
        if (currentStockCount === 0) {
            this.log("> STOCK EMPTY. REROLL ABORTED.");
            return;
        }

        const nextCredits = this.state.credits[playerId] - REROLL_COST;
        const nextShopStock = this._generateRandomStock(currentStockCount, playerId);
        const nextPendingOrders = [...this.state.pendingOrders[playerId]];
        const nextDeck = [...this.state.decks[playerId]];

        const payload = this.buildShopSyncPayload(
            playerId,
            nextCredits,
            nextShopStock,
            nextPendingOrders,
            nextDeck,
            `> LOGISTICS REROUTED: -${REROLL_COST} CREDITS`
        );

        if (this.state.isMultiplayer) {
            this.dispatchAction('SHOP_REROLL', payload);
            return;
        }

        this.applyShopSyncPayload(payload);
    }

    private generateShopStock(deliveryRound: number) {
        const totalUnits = deliveryRound;
        const stockP1 = this._generateRandomStock(totalUnits, PlayerId.ONE);
        const stockP2 = this._generateRandomStock(totalUnits, PlayerId.TWO);

        this.state.shopStock = {
            [PlayerId.ONE]: stockP1,
            [PlayerId.TWO]: stockP2,
            [PlayerId.NEUTRAL]: []
        };
    }

    private _generateRandomStock(count: number, playerId: PlayerId): ShopItem[] {
        const maxPerType = Math.max(1, Math.floor(count / 5));
        const stock: ShopItem[] = [];

        const allowedTypes = this.state.unlockedUnits[playerId].filter(type =>
            this.state.isDevMode || !DEV_ONLY_UNITS.includes(type)
        );
        const typeCounts: Record<string, number> = {};

        if (allowedTypes.length === 0) return [];

        let attempts = 0;
        while (stock.length < count && attempts < 500) {
            attempts++;
            const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
            const currentCount = typeCounts[type] || 0;

            if (currentCount < maxPerType) {
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
                typeCounts[type] = currentCount + 1;
            }
        }
        return stock;
    }

    private processDeliveries(round: number) {
        this.state.recentlyDeliveredCardIds[PlayerId.ONE] = [];
        this.state.recentlyDeliveredCardIds[PlayerId.TWO] = [];

        // 1. Process Pending Orders (Decrement & Deliver)
        [PlayerId.ONE, PlayerId.TWO].forEach(pid => {
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
                this.state.credits[PlayerId.ONE] += 500;
                this.state.credits[PlayerId.TWO] += 500;

                this.generateShopStock(nextRound);
                this.log(`> SHOP RESTOCKED & +500 CREDITS. NEXT DROP: ROUND ${nextRound}`);
            } else {
                this.state.shopAvailable = false;
                this.log(`> SUPPLY LINES SEVERED. SHOP OFFLINE.`);
            }
        }
    }

    private applyCharacterPerks(playerId: PlayerId) {
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
                this.state.characterActions = { [PlayerId.ONE]: [], [PlayerId.TWO]: [], [PlayerId.NEUTRAL]: [] };
            }

            this.state.characterActions[playerId] = character.actions.map(a => ({
                ...a,
                currentCooldown: 0
            }));
            this.log(`> ACTIONS INITIALIZED: ${character.actions.map(a => a.name).join(', ')}`, playerId);
        }
    }

    // --- GAME INITIALIZATION ---

    private getMapMetadata(mapId: string): MapMetadata {
        if (mapId === 'EMPTY') {
            return {
                id: 'EMPTY',
                description: 'Blank sandbox generated from the selected dimensions.',
                players: 'dev'
            };
        }

        return AVAILABLE_MAPS.find((map) => map.id === mapId) || {
            id: mapId,
            players: 2
        };
    }

    private getMainPlacementForLandingStrip(bounds: MapBounds, playerId: PlayerId): Position | null {
        const mainSize = CARD_CONFIG[UnitType.ARC_PORTAL]?.baseStats?.size || 3;
        if (bounds.width < mainSize || bounds.height < mainSize * 2) {
            return null;
        }

        const centeredX = bounds.originX + Math.floor((bounds.width - mainSize) / 2);
        const topZ = playerId === PlayerId.ONE
            ? bounds.originZ
            : bounds.originZ + bounds.height - mainSize;

        return { x: centeredX, z: topZ };
    }

    private createAutoMainUnitsForEmptyMap(bounds: MapBounds): Unit[] {
        const units: Unit[] = [];

        [PlayerId.ONE, PlayerId.TWO].forEach((playerId) => {
            const position = this.getMainPlacementForLandingStrip(bounds, playerId);
            if (!position) return;
            units.push(this.createUnit(UnitType.ARC_PORTAL, position, playerId));
        });

        return units;
    }

    private buildMapScenario(mapType: string = 'EMPTY', customSize?: { x: number, y: number }, isDevModeForSetup: boolean = false): MapScenario {
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
            const sizeX = Math.max(4, Math.min(BOARD_SIZE, customSize?.x || 10));
            const sizeZ = Math.max(isDevModeForSetup ? 6 : 4, Math.min(BOARD_SIZE, customSize?.y || 10));
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
                }
            }

            if (isDevModeForSetup) {
                initialUnits = this.createAutoMainUnitsForEmptyMap(mapBounds);
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
        } else if (loadedMaps[mapType]) {
            const mapData = loadedMaps[mapType] as MapJsonShape;

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
                    status: { stepsTaken: 0, attacksUsed: 0 },
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

    public getMapPreviewData(mapId: string, customSize?: { x: number; y: number }): MapPreviewData | null {
        if (mapId !== 'EMPTY' && mapId !== 'MAP_1' && !loadedMaps[mapId]) {
            return null;
        }

        const scenario = this.buildMapScenario(mapId, customSize);
        const metadata = this.getMapMetadata(mapId);

        return {
            ...metadata,
            terrain: scenario.terrain,
            units: scenario.initialUnits,
            collectibles: scenario.initialCollectibles,
            mapBounds: scenario.mapBounds
        };
    }

    public startGame(mapType: string = 'EMPTY', isDevMode: boolean = false, customSize?: { x: number, y: number }) {
        this.pendingStartConfig = null;
        const deckP1 = isDevMode ? this.generateDevDeck(PlayerId.ONE) : this.generateDeck(PlayerId.ONE);
        const deckP2 = isDevMode ? this.generateDevDeck(PlayerId.TWO) : this.generateDeck(PlayerId.TWO);
        const deckNeutral = isDevMode ? this.generateDevDeck(PlayerId.NEUTRAL) : [];
        const fullUnlockPool = Object.keys(CARD_CONFIG) as UnitType[];
        const unlockedUnits = isDevMode
            ? {
                [PlayerId.ONE]: [...fullUnlockPool],
                [PlayerId.TWO]: [...fullUnlockPool],
                [PlayerId.NEUTRAL]: []
            }
            : this.state.unlockedUnits;

        this.discovered.clear();
        if (loadedMaps[mapType]) {
            this.log(`> LOADING MAP: ${mapType}...`);
        }
        const { terrain, initialUnits, initialCollectibles, mapBounds, deletedTiles } = this.buildMapScenario(mapType, customSize, isDevMode);
        if (loadedMaps[mapType]) {
            this.log(`> TERRAIN LOADED: ${Object.keys(terrain).length} TILES`);
        }
        this.seedInitialDiscovery(terrain, mapBounds, isDevMode);

        this.applyCharacterPerks(PlayerId.ONE);
        this.applyCharacterPerks(PlayerId.TWO);

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
            decks: {
                [PlayerId.ONE]: deckP1,
                [PlayerId.TWO]: deckP2,
                [PlayerId.NEUTRAL]: deckNeutral
            },
            selectedCardId: deckP1[0]?.id || null,
            selectedUnitId: null,
            previewPath: [],
            interactionState: { mode: 'NORMAL' },
            systemMessage: isDevMode ? "DEV MODE ACTIVE: INFINITE RESOURCES" : "MATCH STARTED. PLAYER 1 ACTIVE.",
            currentTurn: PlayerId.ONE,
            unlockedUnits,

            credits: { [PlayerId.ONE]: INITIAL_CREDITS, [PlayerId.TWO]: INITIAL_CREDITS, [PlayerId.NEUTRAL]: 0 },
            pendingOrders: { [PlayerId.ONE]: [], [PlayerId.TWO]: [], [PlayerId.NEUTRAL]: [] },
            shopStock: { [PlayerId.ONE]: [], [PlayerId.TWO]: [], [PlayerId.NEUTRAL]: [] },
            nextDeliveryRound: 10,
            shopAvailable: true,
            deliveryHappened: false,
            recentlyDeliveredCardIds: {
                [PlayerId.ONE]: [],
                [PlayerId.TWO]: [],
                [PlayerId.NEUTRAL]: []
            },

            isDevMode: isDevMode,
            debugClickTrace: [],
            debugLastDecision: null,
            debugLastHoverTile: null
        };

        this.generateShopStock(10);

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
        const newState = this.getInitialState();
        this.pendingStartConfig = null;
        this.authoritySocketId = null;
        this.state = { ...newState, lightMode };
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

        this.startGame(this.state.mapId, this.state.isDevMode, customSize);
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
        this.state.units.forEach(unit => {
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

        const fixedLoadout = [
            UnitType.SOLDIER,
            UnitType.SOLDIER,
            UnitType.BOX,
            UnitType.HEAVY,
            UnitType.SUICIDE_DRONE,
            UnitType.TOWER
        ];

        fixedLoadout.forEach((type, i) => {
            const config = CARD_CONFIG[type]!;
            const stats = config.baseStats as any;
            cards.push({
                id: `${playerId}-card-${Date.now()}-fixed-${i}`,
                category: config.category!,
                type: type,
                name: config.name!,
                description: config.description,
                baseStats: stats,
                cost: config.cost!
            });
        });

        const allowed = this.state.unlockedUnits[playerId].filter(type => !DEV_ONLY_UNITS.includes(type));
        if (allowed.length === 0) {
            return cards;
        }

        for (let i = 0; i < 2; i++) {
            const type = allowed[Math.floor(Math.random() * allowed.length)];
            const config = CARD_CONFIG[type]!;
            const stats = config.baseStats as any;
            cards.push({
                id: `${playerId}-card-${Date.now()}-rnd-${i}`,
                category: config.category!,
                type,
                name: config.name!,
                description: config.description,
                baseStats: stats,
                cost: config.cost!
            });
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
        this.log(`> EFFECT APPLIED TO [${playerId === PlayerId.ONE ? 'P1' : 'P2'}]: ${effect.name}`);
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
                this.log(`> EFFECT EXPIRED: ${e.name} [${playerId === PlayerId.ONE ? 'P1' : 'P2'}]`);
                return false;
            }
            return true;
        });
        this.state.playerEffects[playerId] = activePlayerEffects;

        const units = this.state.units.map(u => {
            if (u.playerId === playerId) {
                const activeEffects = u.effects.filter(e => {
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

        // Process Character Action Cooldowns
        // Process Character Action Cooldowns

        // Lazy Init actions if missing (e.g. hot reload or legacy save)
        if (!this.state.characterActions) {
            this.state.characterActions = { [PlayerId.ONE]: [], [PlayerId.TWO]: [], [PlayerId.NEUTRAL]: [] };
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

    private triggerTilePulse(key: string, kind: 'SABOTAGE') {
        this.state.tilePulse = { key, kind };
        this.notify();
        this.replicateAuthoritativeState();

        setTimeout(() => {
            if (this.state.tilePulse?.key !== key || this.state.tilePulse?.kind !== kind) return;
            this.state.tilePulse = null;
            this.notify();
            this.replicateAuthoritativeState();
        }, 900);
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
        const hasBioticRegen = talents.some(t => t.id === 't5');
        const hasReactorTuning = talents.some(t => t.id === 't6');
        const baseEnergyRegen = 5;
        const bonusEnergyRegen = hasReactorTuning ? 5 : 0;

        if (!hasBioticRegen && baseEnergyRegen === 0 && bonusEnergyRegen === 0) return;

        this.state.units = this.state.units.map(u => {
            if (u.playerId !== playerId) return u;

            let newStats = { ...u.stats };
            let updated = false;

            // t5: Biotic Regen (Heal 10 HP/turn for non-buildings)
            if (hasBioticRegen && !BUILDING_TYPES.includes(u.type)) {
                if (newStats.hp < newStats.maxHp) {
                    newStats.hp = Math.min(newStats.maxHp, newStats.hp + 10);
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

        if (hasBioticRegen) this.log(`> BIOTIC REGEN APPLIED`, playerId);
        if (baseEnergyRegen > 0 || bonusEnergyRegen > 0) {
            const regenLabel = bonusEnergyRegen > 0 ? `${baseEnergyRegen}+${bonusEnergyRegen}` : `${baseEnergyRegen}`;
            this.log(`> ENERGY REGEN APPLIED (+${regenLabel})`, playerId);
        }
    }

    public selectCard(cardId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;

        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

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
                    } else if (unit.stats.movement > 0 && unit.status.stepsTaken >= unit.stats.movement) {
                        this.log(`> UNIT SELECTED (NO MOVEMENT LEFT)`, unit.playerId);
                    } else if (unit.stats.movement === 0) {
                        this.log(`> STRUCTURE ACCESSED`, unit.playerId);
                    } else {
                        const remaining = unit.stats.movement - unit.status.stepsTaken;
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

    public selectNearestControlledUnit() {
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

        const nextId = this.unitCycleOrder[(currentIndex + 1) % this.unitCycleOrder.length];
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
        } else if (terrainTool === 'SET_P1_SPAWN') {
            const clearZone = targetKeys.every(key => this.state.terrain[key]?.landingZone === PlayerId.ONE);
            targetKeys.forEach(key => {
                const tile = ensureTerrainTile(key);
                tile.landingZone = clearZone ? undefined : PlayerId.ONE;
            });

            if (clearZone) {
                this.log(`> CLEARED P1 LANDING ZONE (${targetKeys.length} TILES)`);
            } else {
                this.log(`> MARKED P1 LANDING ZONE (${targetKeys.length} TILES)`);
            }
        } else if (terrainTool === 'SET_P2_SPAWN') {
            const clearZone = targetKeys.every(key => this.state.terrain[key]?.landingZone === PlayerId.TWO);
            targetKeys.forEach(key => {
                const tile = ensureTerrainTile(key);
                tile.landingZone = clearZone ? undefined : PlayerId.TWO;
            });

            if (clearZone) {
                this.log(`> CLEARED P2 LANDING ZONE (${targetKeys.length} TILES)`);
            } else {
                this.log(`> MARKED P2 LANDING ZONE (${targetKeys.length} TILES)`);
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
        this.log(`> NANO-REPAIR READY: SELECT FRIENDLY UNIT`, unit.playerId);
        this.notify();
    }

    public activateRestoreEnergyAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.MEDIC) return;

        // Level 25 check handled in UI, but good to double check or assume UI handles it?
        // Let's check here too for safety
        const playerChar = this.state.playerCharacters[unit.playerId];
        if (playerChar !== 'NYX' || this.state.roundNumber < 25) {
            this.log(`> ACCESS DENIED: PROTOCOL LOCKED`, unit.playerId);
            return;
        }

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
            if (card.type === UnitType.SYSTEM_FREEZE) {
                // Apply immediately global effect
                const enemyId = playerId === PlayerId.ONE ? PlayerId.TWO : PlayerId.ONE;
                const enemyUnits = this.state.units.filter(u => u.playerId === enemyId || u.playerId === PlayerId.NEUTRAL);

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
                    logMessage: `> TACTICAL RETREAT: ${targetUnit.type} RELOCATED TO ${retreatPos.x},${retreatPos.z}`
                });

                this.checkWinCondition();
                return;
            }

            if (card.type === UnitType.LANDING_SABOTAGE) {
                const tileKey = `${position.x},${position.z}`;
                const targetTile = this.state.terrain[tileKey];
                const enemyId = playerId === PlayerId.ONE ? PlayerId.TWO : PlayerId.ONE;

                if (!targetTile) {
                    this.state.systemMessage = "LANDING SABOTAGE: INVALID TILE";
                    this.log(`> LANDING SABOTAGE FAILED: NO TILE`, playerId);
                    this.notify();
                    return;
                }

                if (targetTile.landingZone !== enemyId) {
                    this.state.systemMessage = "LANDING SABOTAGE: TARGET ENEMY LANDING ZONE";
                    this.log(`> LANDING SABOTAGE FAILED: INVALID TARGET`, playerId);
                    this.notify();
                    return;
                }

                this.state.terrain[tileKey] = {
                    ...targetTile,
                    landingZone: undefined
                };

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
                remaining: 3, // Chain length
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
            if (selectedUnit && clickedUnit && selectedUnit.playerId !== clickedUnit.playerId) {
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
        this.applyAreaDamage({ x, z }, 1.5, 50, 'ORBITAL_STRIKE');
        this.checkWinCondition(); // Check after damage application
        this.finalizeInteraction();
    }

    private handleForwardBasePlacement(x: number, z: number, isRemote: boolean = false, forcedPlayerId?: PlayerId) {
        const playerId = forcedPlayerId || this.state.interactionState.playerId;
        if (!playerId) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('FORWARD_BASE_PLACE', { x, z, playerId });
            return;
        }

        const enemyId = playerId === PlayerId.ONE ? PlayerId.TWO : PlayerId.ONE;

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

                if (tile.landingZone === enemyId) {
                    this.log(`> DEPLOYMENT FAILED: ENEMY TERRITORY`, playerId);
                    return;
                }

                validTiles.push(key);
            }
        }

        // Apply
        validTiles.forEach(key => {
            this.state.terrain[key].landingZone = playerId;
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
                    logMessage: message
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

    public handleFreezeTarget(targetUnitId: string, isRemote: boolean = false, sourceUnitIdOverride?: string) {
        const sourceUnitId = sourceUnitIdOverride || this.state.interactionState.sourceUnitId;
        if (!sourceUnitId) return;

        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('FREEZE_TARGET', { sourceUnitId, targetUnitId });
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
        this.log(`> CRYO SHOT HIT TARGET`, this.state.units[sourceIdx].playerId);
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

        if (source.playerId !== target.playerId) {
            this.log(`> TARGET INVALID: FRIENDLY ONLY`, source.playerId);
            return;
        }

        const distance = this.getUnitFootprintDistance(source, target);
        if (distance > supportRange) {
            this.log(`> TARGET OUT OF RANGE (${distance}/${supportRange})`, source.playerId);
            return;
        }

        // BUILDING CHECK
        const isBuilding = BUILDING_TYPES.includes(target.type);
        const playerChar = this.state.playerCharacters[source.playerId];
        const isNyx = playerChar === 'NYX';
        const isRepairBot = source.type === UnitType.REPAIR_BOT;
        const round = this.state.roundNumber;
        const canRepairBuildings = (isNyx && round >= 10) || isRepairBot;

        if (isBuilding && !canRepairBuildings) {
            this.log(`> TARGET INVALID: CANNOT REPAIR STRUCTURES`, source.playerId);
            return;
        }

        // HEAL AMOUNT
        let healAmount = 50;
        if (canRepairBuildings) {
            healAmount += source.level;
        }

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

        if (source.playerId !== target.playerId) {
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

    public handleMindControlTarget(targetUnitId: string, isRemote: boolean = false, sourceUnitIdOverride?: string) {
        const sourceUnitId = sourceUnitIdOverride || this.state.interactionState.sourceUnitId;
        if (!sourceUnitId) return;

        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const hacker = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('MIND_CONTROL_TARGET', { sourceUnitId, targetUnitId });
            return;
        }

        if (hacker.playerId === target.playerId) {
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
            energyCost: 25
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
        const stats = config?.baseStats ? { ...config.baseStats } : {
            hp: 100, maxHp: 100, energy: 0, maxEnergy: 0,
            attack: 10, range: 1, movement: 3, size: 1, blocksLos: false, maxAttacks: 1
        };

        if (this.state.playerTalents[playerId].some(t => t.id === 't3')) stats.movement = (stats.movement || 0) + 1;
        if (this.state.playerTalents[playerId].some(t => t.id === 't4') && (stats.range || 0) > 1) stats.range = (stats.range || 1) + 1;
        if (this.state.playerTalents[playerId].some(t => t.id === 't7')) stats.hp = (stats.hp || 100) + 50;

        // t8: Marine Upgrade - Only for Soldier type
        if (this.state.playerTalents[playerId].some(t => t.id === 't8') && type === UnitType.SOLDIER) {
            stats.attack = (stats.attack || 0) + 15;
            stats.range = (stats.range || 0) + 1;
        }

        // t9: Marine Suite (HP + Mobility) - Only for Soldier type
        if (this.state.playerTalents[playerId].some(t => t.id === 't9') && type === UnitType.SOLDIER) {
            stats.hp = (stats.hp || 100) + 50;
            stats.movement = (stats.movement || 0) + 1;
        }

        // t10: Dreadnought Offense - Only for Heavy type
        if (this.state.playerTalents[playerId].some(t => t.id === 't10') && type === UnitType.HEAVY) {
            stats.attack = (stats.attack || 0) + 20;
            stats.range = (stats.range || 0) + 1;
        }

        // t11: Dreadnought Armor - Only for Heavy type
        if (this.state.playerTalents[playerId].some(t => t.id === 't11') && type === UnitType.HEAVY) {
            stats.hp = (stats.hp || 200) + 100;
        }

        // t12: Drone Range - Only for Box and Suicide Drone
        if (this.state.playerTalents[playerId].some(t => t.id === 't12') && (type === UnitType.BOX || type === UnitType.SUICIDE_DRONE)) {
            stats.movement = (stats.movement || 0) + 2;
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

        return {
            id: idOverride || `unit-${Date.now()}-${Math.random()}`,
            playerId,
            position: { ...position },
            type,
            color: this.getRandomColor(playerId),
            level: 1,
            rotation: this.getInitialRotation(playerId),
            stats: finalStats,
            status: { stepsTaken: 0, attacksUsed: 0 },
            effects: [],
            movePath: []
        };
    }

    private getInitialRotation(playerId: PlayerId): number {
        return playerId === PlayerId.ONE ? 0 : Math.PI;
    }

    public spawnUnit(type: UnitType, position: Position, playerId: PlayerId, idOverride?: string) {
        const unit = this.createUnit(type, position, playerId, idOverride);
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

        if ((hasNorth || hasSouth) && !hasEast && !hasWest) unit.rotation = Math.PI / 2;
        else if ((hasEast || hasWest) && !hasNorth && !hasSouth) unit.rotation = 0;
        else if (hasNorth && hasEast) unit.rotation = Math.PI / 4;
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

        if (selectedUnit && clickedUnit && selectedUnit.playerId === this.state.currentTurn && selectedUnit.playerId !== clickedUnit.playerId) {
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
        if (this.state.appStatus !== AppStatus.PLAYING) return;
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
        const isEnemyPlayer = target.playerId === PlayerId.ONE || target.playerId === PlayerId.TWO;

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

        setTimeout(() => {
            this.resolveAttack(attackerId, targetId);
        }, 600);
    }

    private checkAttackValidity(attacker: Unit, target: Unit): { isValid: boolean, reason?: string } {
        const distance = this.getUnitFootprintDistance(attacker, target);

        if (distance > attacker.stats.range) { return { isValid: false, reason: `OUT OF RANGE (${distance}/${attacker.stats.range})` }; }
        if (!this.hasLineOfSight(attacker, target)) { return { isValid: false, reason: `LINE OF SIGHT BLOCKED` }; }
        return { isValid: true };
    }

    private resolveAttack(attackerId: string, targetId: string) {
        const attackerIdx = this.state.units.findIndex(u => u.id === attackerId);
        const targetIdx = this.state.units.findIndex(u => u.id === targetId);

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

            // CHECK INVULNERABILITY
            const isInvulnerable = target.effects.some(e => e.name === 'IMMORTALITY_SHIELD');

            if (isInvulnerable) {
                this.log(`> ATTACK DEFLECTED: IMMORTALITY SHIELD`, attacker.playerId);
            } else {
                let damage = attacker.stats.attack;

                // Griff Perk: Tanks deal +Level damage (Level 10+)
                if ((attacker.type === UnitType.LIGHT_TANK || attacker.type === UnitType.HEAVY_TANK) &&
                    this.state.playerCharacters[attacker.playerId] === 'GRIFF' &&
                    this.state.roundNumber >= 10) {
                    damage += attacker.level;
                }

                // Kylo Perk: Apex Blade units gain +Level Attack (Level 10+)
                if (attacker.type === UnitType.CONE &&
                    this.state.playerCharacters[attacker.playerId] === 'KYLO' &&
                    this.state.roundNumber >= 10) {
                    damage += this.state.roundNumber;
                }
                const newHp = Math.max(0, target.stats.hp - damage);

                updatedUnits[targetIdx] = {
                    ...target,
                    stats: { ...target.stats, hp: newHp }
                };

                const remainingAttacks = attacker.stats.maxAttacks - updatedUnits[attackerIdx].status.attacksUsed;
                this.log(`> ${attacker.type} FIRES ON ${target.type}: -${damage} HP${remainingAttacks > 0 ? ` (+${remainingAttacks} READY)` : ''}`, attacker.playerId);

                // BREAK MIND CONTROL IF HACKER IS HIT
                if (target.status.mindControlTargetId) {
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

                if (newHp === 0) {
                    this.log(`> TARGET ELIMINATED: ${target.type}`, attacker.playerId);
                    updatedUnits[targetIdx].status.isDying = true;
                    updatedUnits[attackerIdx].status.autoAttackTargetId = null;
                    setTimeout(() => { this.removeUnit(targetId); }, 1500);
                }
            }

            if (attacker.type === UnitType.TITAN) {
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
        this.notify();
        this.replicateAuthoritativeState();
    }

    private applyAreaDamage(center: Position, radius: number, damage: number, sourceUnitId: string, excludeUnitId?: string) {
        const hitUnits = this.state.units.map(u => {
            if (u.id === sourceUnitId) return u;
            if (excludeUnitId && u.id === excludeUnitId) return u;

            const isInvulnerable = u.effects.some(e => e.name === 'IMMORTALITY_SHIELD');
            if (isInvulnerable) return u;

            const dx = u.position.x - center.x;
            const dz = u.position.z - center.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist <= radius) {
                const newHp = Math.max(0, u.stats.hp - damage);
                this.log(`> BLAST HIT ${u.type}: -${damage} HP`);
                return { ...u, stats: { ...u.stats, hp: newHp } };
            }
            return u;
        });

        this.state.units = hitUnits;
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

        const remainingSteps = unit.stats.movement - unit.status.stepsTaken;
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
        }
    ) {
        const startUnitIdx = this.state.units.findIndex(u => u.id === unitId);
        if (startUnitIdx === -1) return;

        this.state.units[startUnitIdx] = {
            ...this.state.units[startUnitIdx],
            movePath: [],
            status: {
                ...this.state.units[startUnitIdx].status,
                isTeleporting: true
            }
        };
        this.notify();
        this.replicateAuthoritativeState();

        setTimeout(() => {
            const moveIdx = this.state.units.findIndex(u => u.id === unitId);
            if (moveIdx === -1) return;

            const movingUnit = this.state.units[moveIdx];
            this.state.units[moveIdx] = {
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

            this.log(options.logMessage, options.playerId);
            this.notify();
            this.replicateAuthoritativeState();
        }, 180);

        setTimeout(() => {
            const endIdx = this.state.units.findIndex(u => u.id === unitId);
            if (endIdx === -1) return;

            this.state.units[endIdx] = {
                ...this.state.units[endIdx],
                status: {
                    ...this.state.units[endIdx].status,
                    isTeleporting: false
                }
            };
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
                if (tile?.landingZone === owner) {
                    this.state.terrain[key] = {
                        ...tile,
                        landingZone: undefined
                    };
                }
            });

            if (owner === PlayerId.ONE || owner === PlayerId.TWO) {
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

        this.state.units = this.state.units.filter(u => u.id !== unitId);
        this.updateFogOfWar();
        this.checkWinCondition(); // Check for loss when unit dies
        this.notify();
        this.replicateAuthoritativeState();
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
        if (!unit || unit.playerId !== currentTurn || unit.stats.movement === 0) {
            this.lastPreviewSignature = null;
            this.lastPreviewPathKey = '';
            this.lastPreviewBlocked = false;
            return;
        }
        if (unit.status.stepsTaken >= unit.stats.movement) {
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

        const remainingSteps = unit.stats.movement - unit.status.stepsTaken;
        const path = findPath(
            unit.position,
            { x: targetX, z: targetZ },
            occupied,
            new Set(revealedTiles),
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
        if (this.state.appStatus !== AppStatus.PLAYING) {
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
        if (unit.status.stepsTaken >= unit.stats.movement) {
            this.pushDebugTrace('confirmMove.reject', 'REJECT', `movement exhausted ${unit.status.stepsTaken}/${unit.stats.movement}`, { unitId: selectedUnitId, notify: true });
            return;
        }

        if (!this.isValidMovePath(unit, previewPath)) {
            this.state.previewPath = [];
            this.pushDebugTrace('confirmMove.reject', 'REJECT', 'move path failed terrain or occupancy validation', { unitId: selectedUnitId, notify: true });
            return;
        }

        // In multiplayer, send command and wait for authoritative broadcast before mutating state.
        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('MOVE', {
                unitId: selectedUnitId,
                path: previewPath
            });
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
        this.log(`> UNIT MOVED (${stepsToAdd} STEPS). REMAINING: ${unit.stats.movement - (unit.status.stepsTaken + stepsToAdd)}`, currentTurn);
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

        // Check for Collectibles
        const colIdx = this.state.collectibles.findIndex(c => c.position.x === nextPos.x && c.position.z === nextPos.z);
        if (colIdx > -1) {
            const collectible = this.state.collectibles[colIdx];

            if (collectible.type === 'MONEY_PRIZE') {
                this.state.credits[unit.playerId] += collectible.value;
                this.log(`> COLLECTIBLE ACQUIRED: $${collectible.value}`, unit.playerId);
                this.state.collectibles.splice(colIdx, 1);
            }
            else if (collectible.type === 'HEALTH_PACK') {
                if (unit.stats.hp < unit.stats.maxHp) {
                    const newHp = Math.min(unit.stats.maxHp, unit.stats.hp + collectible.value);
                    newUnits[unitIndex] = { ...newUnits[unitIndex], stats: { ...unit.stats, hp: newHp } };
                    this.log(`> MEDIKIT USED: +${collectible.value} HP`, unit.playerId);
                    this.state.collectibles.splice(colIdx, 1);
                    this.state.units = newUnits; // Update ref
                }
            }
            else if (collectible.type === 'ENERGY_CELL') {
                if (unit.stats.maxEnergy > 0 && unit.stats.energy < unit.stats.maxEnergy) {
                    const newEnergy = Math.min(unit.stats.maxEnergy, unit.stats.energy + collectible.value);
                    newUnits[unitIndex] = { ...newUnits[unitIndex], stats: { ...unit.stats, energy: newEnergy } };
                    this.log(`> ENERGY CELL CONSUMED: +${collectible.value} ENERGY`, unit.playerId);
                    this.state.collectibles.splice(colIdx, 1);
                    this.state.units = newUnits;
                }
            }
        }

        this.updateFogOfWar();
        this.notify();
        this.replicateAuthoritativeState();
    }

    public triggerCharacterAction(actionId: string, isRemote: boolean = false) {
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
                    // Remove existing if any to refresh duration
                    const otherEffects = u.effects.filter(e => e.name !== 'IMMORTALITY_SHIELD');
                    console.log(`Applying Shield to Unit: ${u.type} (${u.id})`);
                    return {
                        ...u,
                        effects: [
                            ...otherEffects,
                            {
                                id: `eff-${u.id}-${Date.now()}`,
                                name: 'IMMORTALITY_SHIELD',
                                description: 'Invulnerable to damage',
                                icon: '🛡️',
                                duration: 2,
                                maxDuration: 2
                            }
                        ]
                    };
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

    public chooseTalent(talent: Talent, isRemote: boolean = false) {
        if (this.state.appStatus !== AppStatus.TALENT_SELECTION) return;
        const player = this.state.currentTurn;
        if (!isRemote && this.state.isMultiplayer && this.state.myPlayerId !== player) return;

        if (!isRemote && this.state.isMultiplayer) {
            this.dispatchAction('TALENT_CHOOSE', { playerId: player, talentId: talent.id });
            return;
        }

        this.state.playerTalents[player] = [...this.state.playerTalents[player], talent];
        this.log(`> TALENT ACQUIRED: ${talent.name.toUpperCase()}`, player);

        // --- IMMEDIATE EFFECTS ---

        // t1: Global Nanites
        if (talent.id === 't1') {
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
        if (talent.id === 't2') {
            const amount = 150;
            this.state.credits = {
                ...this.state.credits,
                [player]: this.state.credits[player] + amount
            };
            this.log(`> BLACK BUDGET: +$${amount} CREDITS`, player);
        }

        // t3: Servo Overclock (Immediate update for existing units)
        if (talent.id === 't3') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.stats.movement > 0) {
                    return { ...u, stats: { ...u.stats, movement: u.stats.movement + 1 } };
                }
                return u;
            });
            this.log(`> SERVO OVERCLOCK: UPGRADED MOBILITY`, player);
        }

        // t4: Advanced Optics (Immediate update for existing units)
        if (talent.id === 't4') {
            this.state.units = this.state.units.map(u => {
                if (u.playerId === player && u.stats.range > 1) {
                    return { ...u, stats: { ...u.stats, range: u.stats.range + 1 } };
                }
                return u;
            });
            this.log(`> ADVANCED OPTICS: UPGRADED RANGE`, player);
        }

        this.state.talentChoices = [];
        this.state.appStatus = AppStatus.PLAYING;
        this.notify();
    }

    private generateTalentChoices(): Talent[] {
        const pool = [...TALENT_POOL];
        const shuffled = pool.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
    }

    private triggerTalentSelection(playerId: PlayerId, isRemote: boolean = false, forcedChoices?: Talent[]) {
        if (!isRemote && this.state.isMultiplayer) {
            if (this.state.myPlayerId !== playerId) return;
            const choices = this.generateTalentChoices();
            this.dispatchAction('TALENT_SELECTION_START', { playerId, choices });
            return;
        }

        const choices = forcedChoices || this.generateTalentChoices();
        this.state.currentTurn = playerId;
        this.state.selectedCardId = this.state.decks[playerId]?.[0]?.id || null;
        this.state.selectedUnitId = null;
        this.state.previewPath = [];
        this.state.interactionState = { mode: 'NORMAL' };
        this.state.talentChoices = choices;
        this.state.appStatus = AppStatus.TALENT_SELECTION;
        this.log(`> LEVEL UP! SELECT TALENT PROTOCOL INITIATED.`, playerId);
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
                setTimeout(() => {
                    this.resolveAttack(attacker.id, targetId!);
                }, 600);
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
                const nextTurn = this.state.currentTurn === PlayerId.ONE ? PlayerId.TWO : PlayerId.ONE;
                let nextRound = this.state.roundNumber;

                if (this.state.currentTurn === PlayerId.TWO) {
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
                    roundNumber: nextRound,
                    selectedCardId: this.state.decks[nextTurn][0]?.id || null,
                    selectedUnitId: null,
                    interactionState: { mode: 'NORMAL' }
                };

                if (this.checkPlayerRestricted(nextTurn)) {
                    this.log(`> WARNING: PLAYER ${nextTurn === PlayerId.ONE ? 'P1' : 'P2'} SYSTEMS COMPROMISED`);
                }

                if (nextRound > 0 && nextRound % 10 === 0) {
                    this.triggerTalentSelection(nextTurn);
                } else {
                    this.log(`> TURN ENDED. PLAYER ${nextTurn} ACTIVE.`);
                }

                if (this.state.isMultiplayer && this.isSyncAuthority()) {
                    this.replicateAuthoritativeState();
                }

                this.notify();
            };

            if (this.state.currentTurn === PlayerId.TWO) {
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
            selectedCardId: this.state.decks[playerId]?.[0]?.id || null,
            selectedUnitId: null,
            interactionState: { mode: 'NORMAL' }
        };

        this.log(`> [DEV] TURN OVERRIDE: ${playerId} ACTIVE`);
        this.notify();
    }

    private endTurn(updatedUnits: Unit[]) {
        this.state.units = updatedUnits;
        this.executeAutoAttackCycle(this.state.currentTurn);
    }
}

export const gameService = new GameService();


