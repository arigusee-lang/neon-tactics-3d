
import { GameState, PlayerId, Unit, PlacePayload, UnitType, Card, Position, CardCategory, LogEntry, InteractionMode, AppStatus, Effect, Talent, TerrainData, TerrainTool, ShopItem, UnitStats } from '../types';
import { BOARD_SIZE, INITIAL_FIELD_SIZE, CARD_CONFIG, INITIAL_CREDITS, TILE_SIZE, TILE_SPACING, BOARD_OFFSET, BUILDING_TYPES, COLORS, CHARACTERS } from '../constants';
import { findPath } from '../utils/pathfinding';
import { GoogleGenAI } from "@google/genai";

type Listener = (state: GameState) => void;

// --- TALENT POOL ---
export const TALENT_POOL: Talent[] = [
    { id: 't1', name: 'Global Nanites', description: 'Heal all friendly units on the battlefield by 100 HP immediately.', icon: '💊', color: '#10b981' },
    { id: 't2', name: 'Black Budget', description: 'Receive an immediate injection of 150 credits.', icon: '💳', color: '#facc15' },
    { id: 't3', name: 'Servo Overclock', description: 'All mobile units permanently gain +1 Mobility.', icon: '⏩', color: '#06b6d4' },
    { id: 't4', name: 'Advanced Optics', description: 'All non-melee units gain +1 Attack Range.', icon: '🔭', color: '#3b82f6' },
    { id: 't5', name: 'Biotic Regen', description: 'All non-building units gain passive 10 HP regeneration per round.', icon: '🧬', color: '#ec4899' },
    { id: 't6', name: 'Reactor Tuning', description: 'All units with Energy gain passive 5 Energy regeneration per round.', icon: '🔋', color: '#8b5cf6' },
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

class GameService {
    private state: GameState;
    private listeners: Set<Listener> = new Set();
    private discovered: Set<string> = new Set();
    private socket: Socket | null = null;

    constructor() {
        this.state = this.getInitialState();
        this.connect();
    }

    private connect() {
        // production: this.socket = io(); 
        // dev: this.socket = io('http://localhost:3001');
        const url = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/';
        this.socket = io(url);

        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket?.id);
        });

        this.socket.on('lobby_created', (roomId: string) => {
            console.log('Lobby Created:', roomId);
            this.state.roomId = roomId;
            this.state.isMultiplayer = true;
            this.state.myPlayerId = PlayerId.ONE;
            this.log(`> LOBBY ESTABLISHED: ${roomId}`, PlayerId.ONE);
            this.notify();
        });

        this.socket.on('game_start', (data: { roomId: string, players: string[] }) => {
            console.log('Game Start:', data);
            this.state.roomId = data.roomId;
            this.state.isMultiplayer = true;

            // If I am NOT Player 1 (the creator), I am Player 2
            if (this.state.myPlayerId !== PlayerId.ONE) {
                this.state.myPlayerId = PlayerId.TWO;
            }

            this.startGame('MAP_1', false); // Force MAP_1 for now for multiplayer
            this.log(`> MULTIPLAYER LINK ESTABLISHED. YOU ARE ${this.state.myPlayerId === PlayerId.ONE ? 'PLAYER 1' : 'PLAYER 2'}`, this.state.myPlayerId!);
            this.notify();
        });

        this.socket.on('game_action', (payload: { action: string, data: any }) => {
            console.log('Received Action:', payload);
            this.handleRemoteAction(payload.action, payload.data);
        });

        this.socket.on('error_message', (msg: string) => {
            alert(msg);
        });
    }

    public createLobby() {
        if (this.socket) {
            this.socket.emit('create_lobby');
        }
    }

    public joinLobby(roomId: string) {
        if (this.socket) {
            this.socket.emit('join_lobby', roomId);
        }
    }

    private dispatchAction(action: string, data: any) {
        if (this.state.isMultiplayer && this.socket) {
            this.socket.emit('game_action', {
                roomId: this.state.roomId,
                action,
                data
            });
        }
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
            case 'SKIP_TURN':
                this.skipTurn(true);
                break;
            case 'PLACE_UNIT':
                this.emitPlaceUnit(data, true);
                break;
            case 'SYNC_STATE':
                // Overwrite critical state parts
                this.state.terrain = data.terrain;
                this.state.decks = data.decks;
                this.state.credits = data.credits;
                this.state.collectibles = data.collectibles || [];
                // Merge units? Or overwrite? 
                // Initial sync should overwrite.
                this.state.units = data.units.map((u: any) => ({ ...u })); // Deepish copy
                this.notify();
                break;
        }
    }

    private getInitialState(): GameState {
        this.discovered.clear();

        // Default discovered area for main menu background
        const startX = Math.floor((BOARD_SIZE - INITIAL_FIELD_SIZE) / 2);
        const startZ = Math.floor((BOARD_SIZE - INITIAL_FIELD_SIZE) / 2);
        for (let x = startX; x < startX + INITIAL_FIELD_SIZE; x++) {
            for (let z = startZ; z < startZ + INITIAL_FIELD_SIZE; z++) {
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
            k !== UnitType.HEAVY_TANK
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
            isDevMode: false,

            // Multiplayer
            roomId: null,
            isMultiplayer: false,
            myPlayerId: null,
            availableMaps: Object.keys(loadedMaps)
        };
    }

    public exportMap() {
        if (!this.state.isDevMode) {
            this.log("> ACCESS DENIED. DEV MODE REQUIRED.");
            return;
        }

        const mapData = {
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

        const p1HasUnits = this.state.units.some(u => u.playerId === PlayerId.ONE);
        const p1HasCards = this.state.decks[PlayerId.ONE].length > 0;

        const p2HasUnits = this.state.units.some(u => u.playerId === PlayerId.TWO);
        const p2HasCards = this.state.decks[PlayerId.TWO].length > 0;

        if (!p1HasUnits && !p1HasCards) {
            this.state.winner = PlayerId.TWO;
            this.state.appStatus = AppStatus.GAME_OVER;
            this.log(`> MISSION FAILURE: PLAYER 1 ELIMINATED.`);
            this.log(`> VICTORY: PLAYER 2`);
            this.notify();
        } else if (!p2HasUnits && !p2HasCards) {
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

    public enterCharacterSelection() {
        this.state.appStatus = AppStatus.CHARACTER_SELECTION;
        this.log("> CHARACTER SELECTION MATRIX INITIALIZED.");
        this.notify();
    }

    public selectCharacter(playerId: PlayerId, charId: string) {
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

    public buyShopItem(item: ShopItem) {
        const playerId = this.state.currentTurn;
        if (this.state.credits[playerId] < item.cost) {
            this.log("> INSUFFICIENT FUNDS");
            return;
        }

        const newCredits = { ...this.state.credits };
        newCredits[playerId] -= item.cost;

        const newShopStock = { ...this.state.shopStock };
        newShopStock[playerId] = newShopStock[playerId].filter(s => s.id !== item.id);

        const newPendingOrders = { ...this.state.pendingOrders };

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
            this.state.decks[playerId] = [...this.state.decks[playerId], newCard];
            this.log(`> PRIORITY SHIPPING: INSTANT DELIVERY CONFIRMED`, playerId);
        } else {
            // Add to pending
            const boughtItem: ShopItem = { ...item, purchaseRound: this.state.roundNumber };
            newPendingOrders[playerId] = [...newPendingOrders[playerId], boughtItem];
            this.log(`> ORDER CONFIRMED: ARRIVAL IN ${item.deliveryTurns} ROUNDS`, playerId);
        }

        this.state = {
            ...this.state,
            credits: newCredits,
            shopStock: newShopStock,
            pendingOrders: newPendingOrders
        };

        this.notify();
    }

    public refundShopItem(item: ShopItem) {
        const playerId = this.state.currentTurn;
        const currentOrders = this.state.pendingOrders[playerId];
        const orderIdx = currentOrders.findIndex(i => i.id === item.id);

        if (orderIdx > -1) {
            const newPendingOrders = { ...this.state.pendingOrders };
            const newPlayerOrders = [...currentOrders];
            newPlayerOrders.splice(orderIdx, 1);
            newPendingOrders[playerId] = newPlayerOrders;

            const newCredits = { ...this.state.credits };
            newCredits[playerId] += item.cost;

            const newShopStock = { ...this.state.shopStock };
            const { purchaseRound, ...stockItem } = item;
            newShopStock[playerId] = [...newShopStock[playerId], stockItem as ShopItem];

            this.state = {
                ...this.state,
                credits: newCredits,
                pendingOrders: newPendingOrders,
                shopStock: newShopStock
            };

            this.log(`> ORDER CANCELLED: +$${item.cost}`);
            this.notify();
        }
    }

    public rerollShop() {
        const playerId = this.state.currentTurn;
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

        const newCredits = { ...this.state.credits };
        newCredits[playerId] -= REROLL_COST;

        const newStock = this._generateRandomStock(currentStockCount, playerId);

        const newShopStock = { ...this.state.shopStock };
        newShopStock[playerId] = newStock;

        this.state = {
            ...this.state,
            credits: newCredits,
            shopStock: newShopStock
        };

        this.log(`> LOGISTICS REROUTED: -${REROLL_COST} CREDITS`);
        this.notify();
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

        const allowedTypes = this.state.unlockedUnits[playerId];
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
                const newCards = deliveredItems.map(item => {
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
                this.state.decks[pid] = [...this.state.decks[pid], ...newCards];
                this.log(`> LOGISTICS DROP RECEIVED: ${newCards.length} UNITS`, pid);
                this.state.deliveryHappened = true;
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

    public startGame(mapType: string = 'EMPTY', isDevMode: boolean = false, customSize?: { x: number, y: number }) {
        const deckP1 = isDevMode ? this.generateDevDeck(PlayerId.ONE) : this.generateDeck(PlayerId.ONE);
        const deckP2 = isDevMode ? this.generateDevDeck(PlayerId.TWO) : this.generateDeck(PlayerId.TWO);
        const deckNeutral = isDevMode ? this.generateDevDeck(PlayerId.NEUTRAL) : [];

        this.discovered.clear();

        const terrain: Record<string, TerrainData> = {};
        let initialUnits: Unit[] = [];
        let initialCollectibles: any[] = [];

        const setLandingZone = (x: number, z: number, startZ: number, sizeZ: number) => {
            if (z === startZ || z === startZ + 1) return PlayerId.ONE;
            if (z === startZ + sizeZ - 1 || z === startZ + sizeZ - 2) return PlayerId.TWO;
            return undefined;
        };

        if (mapType === 'EMPTY') {
            const sizeX = customSize?.x || 10;
            const sizeZ = customSize?.y || 10;
            const startX = Math.floor((BOARD_SIZE - sizeX) / 2);
            const startZ = Math.floor((BOARD_SIZE - sizeZ) / 2);

            for (let x = startX; x < startX + sizeX; x++) {
                for (let z = startZ; z < startZ + sizeZ; z++) {
                    this.discovered.add(`${x},${z}`);
                    terrain[`${x},${z}`] = {
                        type: 'NORMAL',
                        elevation: 0,
                        rotation: 0,
                        landingZone: setLandingZone(x, z, startZ, sizeZ)
                    };
                }
            }
        } else if (mapType === 'MAP_1') {
            const sizeX = customSize?.x || 12;
            const sizeZ = customSize?.y || 12;
            const startX = Math.floor((BOARD_SIZE - sizeX) / 2);
            const startZ = Math.floor((BOARD_SIZE - sizeZ) / 2);

            for (let x = startX; x < startX + sizeX; x++) {
                for (let z = startZ; z < startZ + sizeZ; z++) {
                    this.discovered.add(`${x},${z}`);

                    terrain[`${x},${z}`] = {
                        type: 'NORMAL',
                        elevation: 0,
                        rotation: 0,
                        landingZone: setLandingZone(x, z, startZ, sizeZ)
                    };

                    if (z === startZ + 8) {
                        if (x === startX + 2) {
                            terrain[`${x},${z}`].type = 'NORMAL';
                        } else if (x === startX + 3) {
                            terrain[`${x},${z}`] = { ...terrain[`${x},${z}`], type: 'RAMP', elevation: 0, rotation: 1 };
                        } else if (x === startX + 4) {
                            terrain[`${x},${z}`] = { ...terrain[`${x},${z}`], type: 'RAMP', elevation: 1, rotation: 1 };
                        } else if (x >= startX + 5 && x <= startX + 7) {
                            terrain[`${x},${z}`] = { ...terrain[`${x},${z}`], type: 'PLATFORM', elevation: 2 };
                        }
                    }
                }
            }

            // Only add initial units if they fit within data
            const hillCenterX = startX + 5;
            const hillCenterZ = startZ + 5;



            if (startX + 8 < startX + sizeX && startZ + 2 < startZ + sizeZ)
                initialUnits.push(this.createUnit(UnitType.WALL, { x: startX + 8, z: startZ + 2 }, PlayerId.NEUTRAL));

            if (startX + 9 < startX + sizeX && startZ + 2 < startZ + sizeZ)
                initialUnits.push(this.createUnit(UnitType.WALL, { x: startX + 9, z: startZ + 2 }, PlayerId.NEUTRAL));

            if (startX + 6 < startX + sizeX && startZ + 8 < startZ + sizeZ)
                initialUnits.push(this.createUnit(UnitType.TOWER, { x: startX + 6, z: startZ + 8 }, PlayerId.NEUTRAL));
        } else if (loadedMaps[mapType]) {
            // Load from JSON
            const mapData = loadedMaps[mapType];
            this.log(`> LOADING MAP: ${mapType}...`);

            // Terrain
            if (mapData.terrain) {
                Object.keys(mapData.terrain).forEach(key => {
                    const t = mapData.terrain[key];
                    this.discovered.add(key);
                    terrain[key] = { ...t };
                });
            }
            this.log(`> TERRAIN LOADED: ${Object.keys(terrain).length} TILES`);

            // Units
            if (mapData.units) {
                initialUnits = mapData.units.map((u: any) => ({
                    ...u,
                    // Re-instantiate stats and status to ensure runtime properties exist
                    stats: this.createUnit(u.type, u.position, u.playerId).stats, // Get fresh stats based on type
                    status: { stepsTaken: 0, attacksUsed: 0 },
                    effects: [],
                    movePath: []
                }));
            }

            // Collectibles
            if (mapData.collectibles) {
                initialCollectibles = mapData.collectibles;
            }
        }

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

            credits: { [PlayerId.ONE]: INITIAL_CREDITS, [PlayerId.TWO]: INITIAL_CREDITS, [PlayerId.NEUTRAL]: 0 },
            pendingOrders: { [PlayerId.ONE]: [], [PlayerId.TWO]: [], [PlayerId.NEUTRAL]: [] },
            shopStock: { [PlayerId.ONE]: [], [PlayerId.TWO]: [], [PlayerId.NEUTRAL]: [] },
            nextDeliveryRound: 10,
            shopAvailable: true,
            deliveryHappened: false,

            isDevMode: isDevMode
        };

        this.generateShopStock(10);

        if (this.state.isMultiplayer && this.state.myPlayerId === PlayerId.ONE) {
            // I am the host, I authorize the state.
            setTimeout(() => {
                this.dispatchAction('SYNC_STATE', {
                    terrain: this.state.terrain,
                    decks: this.state.decks,
                    units: this.state.units,
                    collectibles: this.state.collectibles,
                    credits: this.state.credits
                });
            }, 500);
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
        this.log("REBOOTING SIMULATION...");
        const lightMode = this.state.lightMode;
        const newState = this.getInitialState();
        this.state = { ...newState, lightMode };

        this.enterCharacterSelection();
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

    private updateFogOfWar() {
        this.state.units.forEach(unit => {
            const { x, z } = unit.position;
            const size = unit.stats.size;
            const radius = 2;

            for (let dx = -radius; dx < radius + size; dx++) {
                for (let dz = -radius; dz < radius + size; dz++) {
                    const targetX = x + dx;
                    const targetZ = z + dz;
                    if (targetX >= 0 && targetX < BOARD_SIZE && targetZ >= 0 && targetZ < BOARD_SIZE) {
                        const key = `${targetX},${targetZ}`;
                        if (!this.discovered.has(key)) {
                            this.discovered.add(key);
                            if (!this.state.terrain[key]) {
                                this.state.terrain[key] = { type: 'NORMAL', elevation: 0, rotation: 0 };
                            }
                        }
                    }
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
            UnitType.WALL,
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

        const allowed = this.state.unlockedUnits[playerId];

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

    private processStructures(playerId: PlayerId) {
        const structures = this.state.units.filter(u =>
            u.playerId === playerId &&
            u.type === UnitType.CHARGING_STATION
        );

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

                if (overlaps) {
                    const restore = 25;
                    friendly.stats.energy = Math.min(friendly.stats.maxEnergy, friendly.stats.energy + restore);
                    this.log(`> INDUCTIVE CHARGE: +${restore} ENERGY to ${friendly.type}`, playerId);
                }
            });
        });
    }

    // --- PASSIVE TALENTS LOGIC ---
    private processPassiveTalents(playerId: PlayerId) {
        const talents = this.state.playerTalents[playerId];
        const hasBioticRegen = talents.some(t => t.id === 't5');
        const hasReactorTuning = talents.some(t => t.id === 't6');

        if (!hasBioticRegen && !hasReactorTuning) return;

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

            // t6: Reactor Tuning (Restore 5 Energy/turn)
            if (hasReactorTuning && newStats.maxEnergy > 0) {
                if (newStats.energy < newStats.maxEnergy) {
                    newStats.energy = Math.min(newStats.maxEnergy, newStats.energy + 5);
                    updated = true;
                }
            }

            if (updated) {
                return { ...u, stats: newStats };
            }
            return u;
        });

        if (hasBioticRegen) this.log(`> BIOTIC REGEN APPLIED`, playerId);
        if (hasReactorTuning) this.log(`> REACTOR TUNING APPLIED`, playerId);
    }

    public selectCard(cardId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;

        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const currentDeck = this.state.decks[this.state.currentTurn];
        const card = currentDeck.find(c => c.id === cardId);
        if (card) {
            this.state = {
                ...this.state,
                selectedCardId: cardId,
                selectedUnitId: null,
                previewPath: [],
                interactionState: { mode: 'NORMAL' },
                deliveryHappened: false
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
                this.state = {
                    ...this.state,
                    selectedUnitId: unitId,
                    selectedCardId: null,
                    previewPath: [],
                    interactionState: { mode: 'NORMAL' },
                    deliveryHappened: false
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

    public selectTerrainTool(tool: TerrainTool) {
        if (!this.state.isDevMode) return;

        this.state.selectedCardId = null;
        this.state.selectedUnitId = null;
        this.state.previewPath = [];

        this.state.interactionState = {
            mode: 'TERRAIN_EDIT',
            terrainTool: tool
        };

        this.log(`> MAP EDITOR: ${tool} TOOL ACTIVE`);
        this.notify();
    }

    private handleTerrainEdit(x: number, z: number) {
        const { terrainTool } = this.state.interactionState;
        if (!terrainTool) return;

        const key = `${x},${z}`;
        const occupied = this.getAllOccupiedCells();

        if (occupied.has(key)) {
            this.log(`> ERROR: CANNOT EDIT OCCUPIED TILE`);
            return;
        }

        if (!this.state.terrain[key]) {
            this.state.terrain[key] = { type: 'NORMAL', elevation: 0, rotation: 0 };
        }

        const tile = this.state.terrain[key];

        if (terrainTool === 'ELEVATE') {
            tile.elevation = Math.min(tile.elevation + 1, 10);
            this.log(`> TILE ELEVATED TO ${tile.elevation}`);
        } else if (terrainTool === 'LOWER') {
            tile.elevation = Math.max(tile.elevation - 1, -5);
            this.log(`> TILE LOWERED TO ${tile.elevation}`);
        } else if (terrainTool === 'RAMP') {
            if (tile.type === 'RAMP') {
                tile.rotation = (tile.rotation + 1) % 4;
                this.log(`> RAMP ROTATED TO ${tile.rotation * 90}°`);
            } else {
                tile.type = 'RAMP';
                tile.rotation = 0;
                this.log(`> TILE CONVERTED TO RAMP`);
            }
        } else if (terrainTool === 'DESTROY') {
            tile.type = 'NORMAL';
            tile.elevation = 0;
            tile.rotation = 0;
            tile.landingZone = undefined;
            this.log(`> TILE FLATTENED`);
        } else if (terrainTool === 'DELETE') {
            delete this.state.terrain[key];
            this.state.revealedTiles = this.state.revealedTiles.filter(k => k !== key);
            this.discovered.delete(key);
            this.log(`> TILE DELETED`);
        } else if (terrainTool === 'SET_P1_SPAWN') {
            if (tile.landingZone === PlayerId.ONE) {
                tile.landingZone = undefined;
                this.log(`> CLEARED P1 LANDING ZONE`);
            } else {
                tile.landingZone = PlayerId.ONE;
                this.log(`> MARKED AS P1 LANDING ZONE`);
            }
        } else if (terrainTool === 'SET_P2_SPAWN') {
            if (tile.landingZone === PlayerId.TWO) {
                tile.landingZone = undefined;
                this.log(`> CLEARED P2 LANDING ZONE`);
            } else {
                tile.landingZone = PlayerId.TWO;
                this.log(`> MARKED AS P2 LANDING ZONE`);
            }
        } else if (terrainTool === 'PLACE_COLLECTIBLE') {
            const existingIdx = this.state.collectibles.findIndex(c => c.position.x === x && c.position.z === z);
            if (existingIdx > -1) {
                this.state.collectibles.splice(existingIdx, 1);
                this.log(`> COLLECTIBLE REMOVED`);
            } else {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'MONEY_PRIZE',
                    value: 50,
                    position: { x, z }
                });
                this.log(`> COLLECTIBLE PLANTED ($50)`);
            }
        } else if (terrainTool === 'PLACE_HEALTH') {
            const existingIdx = this.state.collectibles.findIndex(c => c.position.x === x && c.position.z === z);
            if (existingIdx > -1) {
                this.state.collectibles.splice(existingIdx, 1);
                this.log(`> COLLECTIBLE REMOVED`);
            } else {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'HEALTH_PACK',
                    value: 75,
                    position: { x, z }
                });
                this.log(`> HEALTH PACK PLANTED (+75 HP)`);
            }
        } else if (terrainTool === 'PLACE_ENERGY') {
            const existingIdx = this.state.collectibles.findIndex(c => c.position.x === x && c.position.z === z);
            if (existingIdx > -1) {
                this.state.collectibles.splice(existingIdx, 1);
                this.log(`> COLLECTIBLE REMOVED`);
            } else {
                this.state.collectibles.push({
                    id: `col-${Date.now()}-${Math.random()}`,
                    type: 'ENERGY_CELL',
                    value: 50,
                    position: { x, z }
                });
                this.log(`> ENERGY CELL PLANTED (+50 EN)`);
            }
        }

        this.state.terrain = { ...this.state.terrain };
        this.notify();
    }

    public activateSummonAbility(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || unit.playerId !== this.state.currentTurn || unit.type !== UnitType.CONE) return;

        if (unit.stats.energy < 50) {
            this.log(`> INSUFFICIENT ENERGY (${unit.stats.energy}/50)`, unit.playerId);
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

        // Dispatch if local
        if (!isRemote) {
            this.dispatchAction('PLACE_UNIT', payload);
        }

        // Find card in deck
        const deck = this.state.decks[playerId];
        const cardIndex = deck.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const card = deck[cardIndex];

        // Validity Check
        const isAction = card.category === CardCategory.ACTION;

        if (isAction) {
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

                // Teleport
                targetUnit.position = retreatPos;
                targetUnit.movePath = [];
                targetUnit.status.isTeleporting = true;
                this.log(`> TACTICAL RETREAT: ${targetUnit.type} RELOCATED TO ${retreatPos.x},${retreatPos.z}`, playerId);

                if (!this.state.isDevMode) {
                    const newDeck = [...deck];
                    newDeck.splice(cardIndex, 1);
                    this.state.decks[playerId] = newDeck;
                    this.state.selectedCardId = null;
                }

                setTimeout(() => {
                    const uIdx = this.state.units.findIndex(u => u.id === targetUnit.id);
                    if (uIdx > -1) {
                        this.state.units[uIdx].status.isTeleporting = false;
                        this.notify();
                    }
                }, 500);

                this.checkWinCondition();
                this.notify();
                return;
            }
            return;
        }

        // UNIT PLACEMENT
        const size = card.baseStats?.size || 1;
        const requiresZone = true;

        if (!this.isValidPlacement(position.x, position.z, size, playerId, requiresZone)) {
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
            this.spawnUnit(UnitType.WALL, position, playerId);

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
        this.spawnUnit(card.type, position, playerId);

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

    public handleTileClick(x: number, z: number) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;

        if (this.state.interactionState.mode === 'TERRAIN_EDIT') {
            this.handleTerrainEdit(x, z);
            return;
        }

        if (this.checkPlayerRestricted(this.state.currentTurn)) return;

        const { interactionState, currentTurn } = this.state;

        if (interactionState.mode === 'WALL_PLACEMENT') {
            this.handleWallChainPlacement(x, z);
            return;
        }

        if (interactionState.mode === 'ABILITY_SUMMON') {
            this.handleSummonPlacement(x, z);
            return;
        }

        if (interactionState.mode === 'ABILITY_TELEPORT') {
            this.handleTeleportPlacement(x, z);
            return;
        }

        if (interactionState.mode === 'ION_CANNON_TARGETING') {
            this.handleIonCannonStrike(x, z);
            return;
        }

        if (interactionState.mode === 'FORWARD_BASE_TARGETING') {
            this.handleForwardBasePlacement(x, z);
            return;
        }

        const clickedUnit = this.state.units.find(u =>
            x >= u.position.x && x < u.position.x + u.stats.size &&
            z >= u.position.z && z < u.position.z + u.stats.size
        );

        if (interactionState.mode === 'ABILITY_FREEZE') {
            if (clickedUnit) {
                this.handleFreezeTarget(clickedUnit.id);
            } else {
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_HEAL') {
            if (clickedUnit) {
                this.handleHealTarget(clickedUnit.id);
            } else {
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_RESTORE_ENERGY') {
            if (clickedUnit) {
                this.handleRestoreEnergyTarget(clickedUnit.id);
            } else {
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (interactionState.mode === 'ABILITY_MIND_CONTROL') {
            if (clickedUnit) {
                this.handleMindControlTarget(clickedUnit.id);
            } else {
                this.log(`> INVALID TARGET`, currentTurn);
            }
            return;
        }

        if (this.state.selectedCardId) {
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
                this.attackUnit(selectedUnit.id, clickedUnit.id);
                return;
            }

            if (this.state.previewPath.length > 0) {
                const endNode = this.state.previewPath[this.state.previewPath.length - 1];
                if (endNode.x === x && endNode.z === z) {
                    this.confirmMove();
                    return;
                }
            }
        }

        if (clickedUnit) {
            this.handleUnitClick(clickedUnit.id);
        }
    }

    private handleIonCannonStrike(x: number, z: number) {
        const { playerId } = this.state.interactionState;
        if (!this.state.isDevMode) {
            const deck = this.state.decks[playerId!];
            const cardId = this.state.selectedCardId;
            // Consume card
            const idx = deck.findIndex(c => c.id === cardId);
            if (idx > -1) {
                const newDeck = [...deck];
                newDeck.splice(idx, 1);
                this.state.decks[playerId!] = newDeck;
            }
            this.state.selectedCardId = null;
        }
        this.log(`> ORBITAL STRIKE INBOUND AT ${x},${z}`, playerId);
        this.applyAreaDamage({ x, z }, 1.5, 50, 'ORBITAL_STRIKE');
        this.checkWinCondition(); // Check after damage application
        this.finalizeInteraction();
    }

    private handleForwardBasePlacement(x: number, z: number) {
        const { playerId } = this.state.interactionState;
        const enemyId = playerId === PlayerId.ONE ? PlayerId.TWO : PlayerId.ONE;

        // Check if 2x2 area is valid
        const size = 2;
        const validTiles: string[] = [];

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const key = `${x + i},${z + j}`;

                // Check bounds
                if (x + i >= BOARD_SIZE || z + j >= BOARD_SIZE || x + i < 0 || z + j < 0) {
                    this.log(`> DEPLOYMENT FAILED: OUT OF BOUNDS`, playerId);
                    return;
                }

                // Check revealed
                if (!this.state.revealedTiles.includes(key) && !this.state.isDevMode) {
                    this.log(`> DEPLOYMENT FAILED: SECTOR UNKNOWN`, playerId);
                    return;
                }

                // Check enemy landing zone
                const tile = this.state.terrain[key];
                if (tile && tile.landingZone === enemyId) {
                    this.log(`> DEPLOYMENT FAILED: ENEMY TERRITORY`, playerId);
                    return;
                }

                validTiles.push(key);
            }
        }

        // Apply
        validTiles.forEach(key => {
            if (!this.state.terrain[key]) {
                // Should exist if discovered, but safety
                this.state.terrain[key] = { type: 'NORMAL', elevation: 0, rotation: 0 };
            }
            this.state.terrain[key].landingZone = playerId;
        });

        if (!this.state.isDevMode) {
            const deck = this.state.decks[playerId!];
            const cardId = this.state.selectedCardId;
            // Consume card
            const idx = deck.findIndex(c => c.id === cardId);
            if (idx > -1) {
                const newDeck = [...deck];
                newDeck.splice(idx, 1);
                this.state.decks[playerId!] = newDeck;
            }
            this.state.selectedCardId = null;
        }

        this.log(`> FORWARD BASE ESTABLISHED`, playerId);
        this.finalizeInteraction();
        this.notify();
    }

    public handleFreezeTarget(targetUnitId: string) {
        const { sourceUnitId } = this.state.interactionState;
        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

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

    public handleHealTarget(targetUnitId: string) {
        const { sourceUnitId } = this.state.interactionState;
        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const source = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];

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

        const newHp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);

        this.state.units[targetIdx].stats.hp = newHp;
        this.state.units[sourceIdx].stats.energy -= 25;

        this.log(`> REPAIRS COMPLETE: +${healAmount} HP`, source.playerId);
        this.finalizeInteraction();
    }

    public handleRestoreEnergyTarget(targetUnitId: string) {
        const { sourceUnitId } = this.state.interactionState;
        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const source = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];

        if (target.stats.maxEnergy <= 0) {
            this.log(`> TARGET INCOMPATIBLE: NO ENERGY CORE`, source.playerId);
            return;
        }

        if (target.stats.energy >= target.stats.maxEnergy) {
            this.log(`> TARGET ENERGY FULL`, source.playerId);
            return;
        }

        const restoreAmount = 50;
        const newEnergy = Math.min(target.stats.maxEnergy, target.stats.energy + restoreAmount);

        this.state.units[targetIdx].stats.energy = newEnergy;
        this.state.units[sourceIdx].stats.energy -= 25;

        this.log(`> ENERGY TRANSFER COMPLETE: +${restoreAmount} EN`, source.playerId);
        this.finalizeInteraction();
    }

    public handleMindControlTarget(targetUnitId: string) {
        const { sourceUnitId } = this.state.interactionState;
        const sourceIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (sourceIdx === -1) return;

        const targetIdx = this.state.units.findIndex(u => u.id === targetUnitId);
        if (targetIdx === -1) return;

        const hacker = this.state.units[sourceIdx];
        const target = this.state.units[targetIdx];

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

    public handleWallChainPlacement(x: number, z: number) {
        const { playerId, lastPos, remaining } = this.state.interactionState;
        if (!playerId || !lastPos || remaining === undefined) return;

        if (this.isValidPlacement(x, z, 1, playerId, false)) {
            // Check adjacency
            if (Math.abs(x - lastPos.x) + Math.abs(z - lastPos.z) === 1) {
                this.spawnUnit(UnitType.WALL, { x, z }, playerId);

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

    public handleSummonPlacement(x: number, z: number) {
        const { playerId, sourceUnitId, remaining, unitType } = this.state.interactionState;
        if (!playerId || !sourceUnitId || !remaining || !unitType) return;

        const source = this.state.units.find(u => u.id === sourceUnitId);
        if (!source) return;

        if (this.isValidPlacement(x, z, 1, playerId, false)) {
            // Range check (1 tile radius)
            const dx = Math.abs(x - source.position.x);
            const dz = Math.abs(z - source.position.z);
            if (dx <= 1 && dz <= 1 && !(dx === 0 && dz === 0)) {
                this.spawnUnit(unitType, { x, z }, playerId);

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

    public handleTeleportPlacement(x: number, z: number) {
        const { playerId, sourceUnitId } = this.state.interactionState;
        if (!sourceUnitId) return;

        const unitIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
        if (unitIdx === -1) return;

        const unit = this.state.units[unitIdx];

        if (this.isValidPlacement(x, z, unit.stats.size, playerId!, false)) {
            // Teleport
            this.state.units[unitIdx].position = { x, z };
            this.state.units[unitIdx].stats.energy -= 25;
            this.state.units[unitIdx].status.isTeleporting = true;

            this.log(`> UNIT TELEPORTED TO ${x},${z}`, playerId);

            setTimeout(() => {
                const uIdx = this.state.units.findIndex(u => u.id === sourceUnitId);
                if (uIdx > -1) {
                    this.state.units[uIdx].status.isTeleporting = false;
                    this.notify();
                }
            }, 500);

            this.finalizeInteraction();
        }
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

    private findNearestRetreatPosition(unit: Unit, playerId: PlayerId): Position | null {
        let bestPos: Position | null = null;
        let minDist = Infinity;
        const size = unit.stats.size;

        // Iterate all known terrain tiles
        Object.keys(this.state.terrain).forEach(key => {
            const [x, z] = key.split(',').map(Number);

            // Check if this spot is a valid deployment zone AND not occupied
            // explicitly check isOccupied inside check (handled by isValidPlacement usually)
            // isValidPlacement(..., true) checks landingZone === playerId

            if (this.isValidPlacement(x, z, size, playerId, true)) {
                const dist = Math.abs(x - unit.position.x) + Math.abs(z - unit.position.z);
                if (dist < minDist) {
                    minDist = dist;
                    bestPos = { x, z };
                }
            }
        });

        return bestPos;
    }

    private isValidPlacement(x: number, z: number, size: number, playerId: PlayerId, requiresZone: boolean): boolean {
        const occupied = this.getAllOccupiedCells();

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const key = `${x + i},${z + j}`;
                if (occupied.has(key)) return false;

                if (x + i >= BOARD_SIZE || z + j >= BOARD_SIZE || x + i < 0 || z + j < 0) return false;

                // Check terrain landing zone
                if (requiresZone && !this.state.isDevMode) {
                    const tile = this.state.terrain[key];
                    if (!tile || tile.landingZone !== playerId) {
                        return false;
                    }
                }

                if (!this.state.revealedTiles.includes(key) && !this.state.isDevMode) return false;
            }
        }
        return true;
    }

    public createUnit(type: UnitType, position: Position, playerId: PlayerId): Unit {
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
            id: `unit-${Date.now()}-${Math.random()}`,
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

    public spawnUnit(type: UnitType, position: Position, playerId: PlayerId) {
        const unit = this.createUnit(type, position, playerId);
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

    public handleUnitClick(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        const clickedUnit = this.state.units.find(u => u.id === unitId);
        const selectedUnit = this.state.units.find(u => u.id === this.state.selectedUnitId);

        if (selectedUnit && clickedUnit && selectedUnit.playerId === this.state.currentTurn && selectedUnit.playerId !== clickedUnit.playerId) {
            this.attackUnit(selectedUnit.id, clickedUnit.id);
        } else {
            this.selectUnit(unitId);
        }
    }

    public hoverUnit(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.state.previewPath.length > 0) {
            this.clearPreview();
        }
    }

    public clearPreview() {
        if (this.state.previewPath.length > 0) {
            this.state = { ...this.state, previewPath: [] };
            this.notify();
        }
    }

    public triggerSuicide(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;
        const unitIndex = this.state.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return;
        const unit = this.state.units[unitIndex];
        if (unit.playerId !== this.state.currentTurn || unit.type !== UnitType.HEAVY) return;
        const updatedUnits = [...this.state.units];
        updatedUnits[unitIndex] = { ...unit, status: { ...unit.status, isDying: true } };
        this.log(`> SUICIDE PROTOCOL INITIATED`, unit.playerId);
        this.state = { ...this.state, units: updatedUnits, selectedUnitId: null };
        this.applyAreaDamage(unit.position, 1.5, 50, unit.id);
        this.notify();
        setTimeout(() => { this.removeUnit(unitId); this.notify(); }, 2000);
    }

    public triggerDroneExplosion(unitId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;
        const unitIndex = this.state.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return;
        const unit = this.state.units[unitIndex];
        if (unit.playerId !== this.state.currentTurn || unit.type !== UnitType.SUICIDE_DRONE) return;
        const updatedUnits = [...this.state.units];
        updatedUnits[unitIndex] = { ...unit, status: { ...unit.status, isExploding: true } };
        this.log(`> DETONATING DRONE`, unit.playerId);
        this.state = { ...this.state, units: updatedUnits, selectedUnitId: null };
        this.applyAreaDamage(unit.position, 1.5, 80, unit.id);
        this.notify();
        setTimeout(() => { this.removeUnit(unitId); this.notify(); }, 1000);
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

        // Dispatch if local
        if (!isRemote) {
            this.dispatchAction('ATTACK', {
                attackerId,
                targetId
            });
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
        const dx = Math.max(attacker.position.x - (target.position.x + target.stats.size - 1), target.position.x - (attacker.position.x + attacker.stats.size - 1), 0);
        const dz = Math.max(attacker.position.z - (target.position.z + target.stats.size - 1), target.position.z - (attacker.position.z + attacker.stats.size - 1), 0);
        const distance = Math.max(dx, dz);

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
                this.applyAreaDamage(target.position, 1.5, 25, attacker.id, target.id);
            }

        } else {
            updatedUnits[attackerIdx].status.autoAttackTargetId = null;
        }

        this.state.units = updatedUnits;
        this.notify();
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

        // Trigger deaths for units that died from splash
        hitUnits.forEach(u => {
            // If hp is 0 and wasn't before (we can't check before easy here, but check current state units)
            // Simple check: if hp is 0 and not marked dying.
            if (u.stats.hp === 0 && !u.status.isDying) {
                this.removeUnit(u.id);
            }
        });

        this.state.units = hitUnits;
        this.checkWinCondition();
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
                    if (x < 0 || x >= BOARD_SIZE || z < 0 || z >= BOARD_SIZE) continue;
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

    private removeUnit(unitId: string) {
        // Check if removing a Hacker with active link
        const unitToRemove = this.state.units.find(u => u.id === unitId);
        if (unitToRemove && unitToRemove.status.mindControlTargetId) {
            this.breakMindControl(unitId);
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
    }

    public previewMove(targetX: number, targetZ: number) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (this.checkPlayerRestricted(this.state.currentTurn)) return;
        const { selectedUnitId, units, revealedTiles, currentTurn } = this.state;
        if (!selectedUnitId) return;
        const unit = units.find(u => u.id === selectedUnitId);
        if (!unit || unit.playerId !== currentTurn || unit.stats.movement === 0) return;
        if (unit.status.stepsTaken >= unit.stats.movement) return;
        if (this.checkUnitFrozen(unit)) return;

        // Check if the entire target footprint is occupied
        const occupied = this.getAllOccupiedCells(unit.id);
        let isTargetBlocked = false;
        const size = unit.stats.size;

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const cx = targetX + i;
                const cz = targetZ + j;
                // Check board bounds
                if (cx >= BOARD_SIZE || cz >= BOARD_SIZE) {
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

        if (isTargetBlocked) return;

        const remainingSteps = unit.stats.movement - unit.status.stepsTaken;
        const path = findPath(
            unit.position,
            { x: targetX, z: targetZ },
            occupied,
            new Set(revealedTiles),
            this.state.terrain,
            size
        );
        this.state = { ...this.state, previewPath: path.slice(0, remainingSteps) };
        this.notify();
    }

    public confirmMove(isRemote: boolean = false) {
        if (this.state.appStatus !== AppStatus.PLAYING) return;
        if (!isRemote && this.checkPlayerRestricted(this.state.currentTurn)) return;

        const { selectedUnitId, units, previewPath, currentTurn } = this.state;
        if (!selectedUnitId || previewPath.length === 0) return;

        const unitIndex = units.findIndex(u => u.id === selectedUnitId);
        if (unitIndex === -1 || (units[unitIndex].playerId !== currentTurn && !isRemote)) return;

        const unit = units[unitIndex];
        if (unit.status.stepsTaken >= unit.stats.movement) return;

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

        // Dispatch if local
        if (!isRemote) {
            this.dispatchAction('MOVE', {
                unitId: selectedUnitId,
                path: previewPath
            });
        }

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
    }

    public triggerCharacterAction(actionId: string) {
        if (this.state.appStatus !== AppStatus.PLAYING) {
            console.log("TriggerAction Skipped: Not Playing");
            return;
        }
        const playerId = this.state.currentTurn;
        if (this.checkPlayerRestricted(playerId)) {
            console.log("TriggerAction Skipped: Player Restricted");
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

        if (this.state.interactionState.mode !== 'NORMAL' || this.state.selectedCardId || this.state.selectedUnitId) {
            this.cancelInteraction();
            // If we are cancelling interaction, we don't dispatch skip turn yet?
            // Wait, hitting space usually acts as End Turn.
            // If interaction is active, space cancels it. It does NOT end turn.
            return;
        }

        // Dispatch if local
        if (!isRemote) {
            this.dispatchAction('SKIP_TURN', {});
        }

        this.log(`> TURN ENDED BY ${isRemote ? 'OPPONENT' : 'USER'}`, this.state.currentTurn);
        this.endTurn(this.state.units);
    }

    public chooseTalent(talent: Talent) {
        if (this.state.appStatus !== AppStatus.TALENT_SELECTION) return;
        const player = this.state.currentTurn;

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

    private triggerTalentSelection(playerId: PlayerId) {
        const pool = [...TALENT_POOL];
        const shuffled = pool.sort(() => 0.5 - Math.random());
        const choices = shuffled.slice(0, 3);
        this.state.talentChoices = choices;
        this.state.appStatus = AppStatus.TALENT_SELECTION;
        this.log(`> LEVEL UP! SELECT TALENT PROTOCOL INITIATED.`, playerId);
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

            const nextTurn = this.state.currentTurn === PlayerId.ONE ? PlayerId.TWO : PlayerId.ONE;
            let nextRound = this.state.roundNumber;

            if (this.state.currentTurn === PlayerId.TWO) {
                nextRound++;
                this.log(`> SIMULATION LEVEL ${nextRound}`);
                this.state.units = this.state.units.map(u => ({ ...u, level: (u.level || 1) + 1 }));
                this.processDeliveries(nextRound);
            }

            // Reset Units for Next Turn
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

            this.notify();
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
