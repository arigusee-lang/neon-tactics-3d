
import React, { useEffect, useState, useRef } from 'react';
import GameScene from './components/GameScene';
import Deck from './components/Deck';
import UnitControlPanel from './components/UnitControlPanel';
import MainMenu from './components/MainMenu';
import TalentSelectionModal from './components/TalentSelectionModal';
import CharacterSelectionModal from './components/CharacterSelectionModal';
import Minimap from './components/Minimap';
import MapEditor from './components/MapEditor';
import ShopModal from './components/ShopModal';
import CardCatalogue from './components/CardCatalogue';
import DebugPointerInfo from './components/DebugPointerInfo';
import WinScreen from './components/WinScreen';
import { gameService } from './services/gameService';
import { GameState, PlayerId, AppStatus, Effect, UnitType, Talent } from './types';
import { COLORS, CHARACTERS } from './constants';
import { groupCards } from './utils/cardUtils';
import { clampTerrainBrushSize, isBrushEnabledTerrainTool } from './utils/terrainBrush';

// Simple Effect Icon Component
const EffectIcon: React.FC<{ effect: Effect, alignRight?: boolean }> = ({ effect, alignRight }) => {
    return (
        <div className={`group relative flex items-center justify-center w-6 h-6 rounded bg-black/50 border border-gray-500/50 text-xs cursor-help`}>
            <span className="select-none">{effect.icon}</span>

            {/* Tooltip */}
            <div className={`absolute top-full mt-2 ${alignRight ? 'right-0' : 'left-0'} w-48 bg-black/95 border border-gray-600 rounded p-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
                <div className="text-[10px] font-bold text-white uppercase mb-1">{effect.name}</div>
                <div className="text-[9px] text-gray-400 leading-tight mb-2">{effect.description}</div>
                <div className="text-[9px] font-mono text-green-400">
                    DURATION: <span className="text-white">{effect.duration}/{effect.maxDuration}</span> ROUNDS
                </div>
            </div>
        </div>
    );
};

// Player Info Tooltip Component
const PlayerTooltip: React.FC<{
    characterId: string | null;
    talents: Talent[];
    actions: any[];
    alignRight?: boolean;
}> = ({ characterId, talents, actions, alignRight }) => {
    const character = CHARACTERS.find(c => c.id === characterId);

    if (!character && talents.length === 0 && actions.length === 0) return null;

    return (
        <div className={`absolute top-full mt-2 ${alignRight ? 'right-0' : 'left-0'} w-64 bg-black/95 border border-green-500/50 rounded p-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[0_0_20px_rgba(0,255,0,0.2)] backdrop-blur-md`}>

            {/* Character Info */}
            {character && (
                <div className="mb-3 border-b border-green-900/50 pb-2">
                    <div className="text-[10px] text-green-500/70 font-bold uppercase tracking-wider mb-1">Current Character</div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-green-900/30 border border-green-500/30 flex items-center justify-center text-lg shadow-inner">
                            {character.gender === 'FEMALE' ? '👩‍🎤' : '👨‍🎤'}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white leading-none mb-1" style={{ color: character.color }}>{character.name}</div>
                            <div className="text-[9px] text-gray-400 leading-tight">{character.description}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Skills (Actions) */}
            {actions && actions.length > 0 && (
                <div className="mb-3 border-b border-green-900/50 pb-2">
                    <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1">Unlocked Skills</div>
                    <div className="flex flex-col gap-1.5">
                        {actions.map((action, i) => (
                            <div key={i} className="flex gap-2 items-center bg-purple-900/10 p-1 rounded border border-purple-500/20">
                                <div className="text-base min-w-[1.25rem] text-center">{action.icon}</div>
                                <div>
                                    <div className="text-[10px] font-bold text-purple-300 leading-none mb-0.5">{action.name}</div>
                                    <div className="text-[8px] text-gray-400 leading-tight">{action.description}</div>
                                    <div className="text-[8px] text-purple-500/70 font-mono mt-0.5">COOLDOWN: {action.cooldown}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Acquired Perks (Talents) */}
            {talents && talents.length > 0 && (
                <div>
                    <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider mb-1">Acquired Perks</div>
                    <div className="flex flex-col gap-1.5">
                        {talents.map((t, i) => (
                            <div key={i} className="flex gap-2 items-center bg-yellow-900/10 p-1 rounded border border-yellow-500/20">
                                <div className="text-base min-w-[1.25rem] text-center">{t.icon}</div>
                                <div>
                                    <div className="text-[10px] font-bold text-yellow-200 leading-none mb-0.5">{t.name}</div>
                                    <div className="text-[8px] text-gray-400 leading-tight">{t.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Character Action Bar Component
const CharacterActionBar: React.FC<{ actions: any[], playerId: PlayerId, currentTurn: PlayerId, isDevMode: boolean, currentRound: number }> = ({ actions, playerId, currentTurn, isDevMode, currentRound }) => {
    if (!actions || actions.length === 0) return null;

    return (
        <div className="flex gap-2 mb-2 pointer-events-auto justify-center">
            {actions.map(action => {
                const isReady = action.currentCooldown === 0;
                const isMyTurn = playerId === currentTurn;
                const isLevelUnlocked = isDevMode || (currentRound >= (action.minLevel || 0));
                // However, we are in a functional component that might not receive updates unless state is observed.
                // Assuming props updates.
                const canUse = isReady && isMyTurn && isLevelUnlocked;

                return (
                    <button
                        key={action.id}
                        onClick={() => {
                            console.log('Action Clicked:', action.id);
                            gameService.triggerCharacterAction(action.id);
                        }}
                        disabled={!canUse}
                        className={`
                            relative w-10 h-10 rounded border flex items-center justify-center text-xl transition-all group
                            ${canUse
                                ? 'bg-black/60 border-purple-500 text-purple-400 hover:bg-purple-900/40 hover:scale-110 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                                : 'bg-black/40 border-gray-800 text-gray-600 cursor-not-allowed grayscale'
                            }
                        `}
                    >
                        {action.icon}

                        {!isReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded font-mono text-xs font-bold text-white">
                                {action.currentCooldown}
                            </div>
                        )}

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-black/95 border border-purple-500/50 rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <div className="text-[10px] font-bold text-purple-400 uppercase mb-1">{action.name}</div>
                            <div className="text-[9px] text-gray-400 leading-tight">{action.description}</div>
                            <div className="text-[9px] text-gray-500 mt-1 font-mono">COOLDOWN: {action.cooldown} TURNS</div>
                            {action.minLevel > 0 && <div className="text-[9px] text-red-500 mt-1 font-mono">MIN LEVEL: {action.minLevel}</div>}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isProtocolMinimized, setIsProtocolMinimized] = useState(true);
    const [isLogMinimized, setIsLogMinimized] = useState(true);
    const [isDebugPointerVisible, setIsDebugPointerVisible] = useState(true);
    const logEndRef = useRef<HTMLDivElement>(null);
    const gameStateRef = useRef<GameState | null>(null);

    useEffect(() => {
        const unsubscribe = gameService.subscribe(setGameState);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [gameState?.actionLog]);

    useEffect(() => {
        const wheelOptions: AddEventListenerOptions = { passive: false, capture: true };
        const handleWheel = (e: WheelEvent) => {
            const state = gameStateRef.current;
            if (!state) return;
            if (!e.ctrlKey) return;

            const { interactionState } = state;
            const isTerrainBrushMode = state.isDevMode
                && interactionState.mode === 'TERRAIN_EDIT'
                && isBrushEnabledTerrainTool(interactionState.terrainTool);
            const isMassRetreatMode = interactionState.mode === 'MASS_RETREAT_TARGETING';
            if (!isTerrainBrushMode && !isMassRetreatMode) return;

            e.preventDefault();
            e.stopPropagation();

            if (e.deltaY === 0) return;
            const delta = e.deltaY < 0 ? 1 : -1;
            gameService.adjustTerrainBrushSize(delta);
        };

        window.addEventListener('wheel', handleWheel, wheelOptions);
        return () => window.removeEventListener('wheel', handleWheel, wheelOptions);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!gameState) return;

            if (e.code === 'Tab') {
                e.preventDefault();
                gameService.selectNearestControlledUnit();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD' && gameState.isDevMode) {
                e.preventDefault();
                setIsDebugPointerVisible((prev) => !prev);
                return;
            }

            const key = parseInt(e.key);
            if (!isNaN(key) && key > 0 && key <= 9 && !e.shiftKey) {
                const deck = gameState.decks[gameState.currentTurn];
                // Select based on visual group index rather than raw index
                const groupedDeck = groupCards(deck);

                if (groupedDeck && groupedDeck[key - 1]) {
                    // Select the first card of the chosen group
                    gameService.selectCard(groupedDeck[key - 1][0].id);
                }
            }

            if (e.code === 'Space') {
                if (gameState.appStatus === AppStatus.PLAYING) {
                    gameService.skipTurn();
                }
            }

            if (e.code === 'Escape') {
                if (gameState.appStatus === AppStatus.PLAYING || gameState.appStatus === AppStatus.PAUSED) {
                    gameService.togglePause();
                } else if (gameState.appStatus === AppStatus.SHOP) {
                    gameService.closeShop();
                } else if (gameState.appStatus === AppStatus.CARD_CATALOGUE) {
                    gameService.exitCardCatalogue();
                }
            }

            // Unit Ability Hotkeys
            if (gameState.appStatus === AppStatus.PLAYING && gameState.selectedUnitId) {
                const unit = gameState.units.find(u => u.id === gameState.selectedUnitId);
                if (unit && unit.playerId === gameState.currentTurn) {

                    // Soldier
                    if (unit.type === UnitType.SOLDIER) {
                        if (e.code === 'KeyT') gameService.activateTeleportAbility(unit.id);
                        if (e.code === 'KeyS') gameService.activateFreezeAbility(unit.id);
                    }

                    // Cone (Summon Drones)
                    if (unit.type === UnitType.CONE) {
                        if (e.code === 'KeyD') gameService.activateSummonAbility(unit.id);
                    }

                    // Heavy (Suicide Protocol)
                    if (unit.type === UnitType.HEAVY) {
                        // Check specifically for Shift+1
                        if (e.shiftKey && e.code === 'Digit1') {
                            gameService.triggerSuicide(unit.id);
                        }
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState]);

    if (!gameState) return <div className="text-white">Loading...</div>;

    const currentPlayerDeck = gameState.decks[gameState.currentTurn];
    const controlledPlayerId = gameState.isMultiplayer ? gameState.myPlayerId : gameState.currentTurn;
    const isLocalTurn = !gameState.isMultiplayer || gameState.myPlayerId === gameState.currentTurn;
    const playerColor = gameState.currentTurn === PlayerId.ONE ? COLORS.P1 : (gameState.currentTurn === PlayerId.TWO ? COLORS.P2 : COLORS.NEUTRAL);
    const selectedUnit = gameState.units.find(u => u.id === gameState.selectedUnitId) || null;
    const isPlaying = gameState.appStatus === AppStatus.PLAYING || gameState.appStatus === AppStatus.TALENT_SELECTION || gameState.appStatus === AppStatus.SHOP;
    const showInventoryBar = !gameState.isMultiplayer || isLocalTurn;
    const showUnitControlPanel = !gameState.isMultiplayer || isLocalTurn;
    const terrainTool = gameState.interactionState.terrainTool;
    const terrainBrushSize = clampTerrainBrushSize(gameState.interactionState.terrainBrushSize ?? 1);
    const terrainImpactText = isBrushEnabledTerrainTool(terrainTool) ? ` | IMPACT ZONE: ${terrainBrushSize}x${terrainBrushSize}` : '';
    const massRetreatZoneSize = Math.max(2, Math.min(4, gameState.interactionState.terrainBrushSize ?? 2));
    const massRetreatText = gameState.interactionState.mode === 'MASS_RETREAT_TARGETING'
        ? ` | RETREAT ZONE: ${massRetreatZoneSize}x${massRetreatZoneSize}`
        : '';

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-mono">
            {gameState.isDevMode && isDebugPointerVisible && <DebugPointerInfo gameState={gameState} />}

            <div className="absolute inset-0 z-0">
                <GameScene
                    units={gameState.units}
                    currentTurn={gameState.currentTurn}
                    revealedTiles={gameState.revealedTiles}
                    selectedCardId={gameState.selectedCardId}
                    selectedUnitId={gameState.selectedUnitId}
                    previewPath={gameState.previewPath}
                    appStatus={gameState.appStatus}
                    lightMode={gameState.lightMode}
                    mapId={gameState.mapId}
                    collectibles={gameState.collectibles}
                    mapBounds={gameState.mapBounds}
                />
            </div>

            {gameState.appStatus !== AppStatus.GAME_OVER && (
                <MainMenu
                    status={gameState.appStatus}
                    onResume={() => gameService.togglePause()}
                    onAbortToMenu={() => gameService.restartGame()}
                    onRestartCurrentMap={() => gameService.restartCurrentMap()}
                    availableMaps={gameState.availableMaps}
                    roomId={gameState.roomId}
                    isMultiplayer={gameState.isMultiplayer}
                    isDevMode={gameState.isDevMode}
                />
            )}

            {/* Character Selection Modal */}
            {gameState.appStatus === AppStatus.CHARACTER_SELECTION && (
                <CharacterSelectionModal
                    playerCharacters={gameState.playerCharacters}
                    isMultiplayer={gameState.isMultiplayer}
                    myPlayerId={gameState.myPlayerId}
                />
            )}

            {/* Talent Selection Modal Overlay */}
            {gameState.appStatus === AppStatus.TALENT_SELECTION && (!gameState.isMultiplayer || isLocalTurn) && (
                <TalentSelectionModal
                    choices={gameState.talentChoices}
                    onSelect={(t) => gameService.chooseTalent(t)}
                />
            )}

            {/* Shop Modal */}
            {gameState.appStatus === AppStatus.SHOP && (
                <ShopModal
                    availableStock={gameState.shopStock[gameState.currentTurn]}
                    boughtItems={gameState.pendingOrders[gameState.currentTurn]}
                    credits={gameState.credits[gameState.currentTurn]}
                    nextDeliveryRound={gameState.nextDeliveryRound}
                    currentRound={gameState.roundNumber}
                    onBuy={(item) => gameService.buyShopItem(item)}
                    onRefund={(item) => gameService.refundShopItem(item)}
                    onReroll={() => gameService.rerollShop()}
                    onClose={() => gameService.closeShop()}
                />
            )}

            {/* Card Catalogue Modal */}
            {gameState.appStatus === AppStatus.CARD_CATALOGUE && (
                <CardCatalogue
                    onClose={() => gameService.exitCardCatalogue()}
                />
            )}

            {gameState.appStatus === AppStatus.GAME_OVER && (
                <WinScreen
                    winner={gameState.winner}
                    myPlayerId={gameState.myPlayerId}
                    isMultiplayer={gameState.isMultiplayer}
                    isDevMode={gameState.isDevMode}
                    roundNumber={gameState.roundNumber}
                    onRestartCurrentMap={() => gameService.restartCurrentMap()}
                    onAbortToMenu={() => gameService.restartGame()}
                />
            )}

            {isPlaying && (
                <>
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-none w-full max-w-2xl flex flex-col items-center gap-2 z-20">
                        {/* HUD Top Bar */}
                        <div className="flex items-center gap-4 w-full justify-center">

                            {gameState.isDevMode ? (
                                <div className="bg-transparent border border-green-900 px-6 py-2 rounded-full shadow-[0_0_15px_rgba(0,255,0,0.2)] flex items-center gap-6 backdrop-blur-sm pointer-events-auto">
                                    {/* Level Counter (Left) */}
                                    <div className="flex flex-col items-center justify-center px-4 border-r border-slate-700/50">
                                        <div className="text-[8px] text-green-500/70 font-bold uppercase tracking-wider leading-none mb-0.5">LEVEL</div>
                                        <div className="text-lg font-mono font-bold text-white leading-none">{gameState.roundNumber.toString().padStart(2, '0')}</div>
                                    </div>

                                    {/* Player List (Right) */}
                                    <div className="flex items-center gap-6">
                                        {/* Player 1 */}
                                        <div
                                            onClick={() => gameService.debugSetTurn(PlayerId.ONE)}
                                            className={`relative group text-sm font-bold tracking-widest transition-colors cursor-pointer ${gameState.currentTurn === PlayerId.ONE ? 'text-cyan-400 drop-shadow-[0_0_5px_cyan]' : 'text-slate-600 hover:text-slate-400'}`}
                                        >
                                            PLAYER 1
                                            <PlayerTooltip
                                                characterId={gameState.playerCharacters[PlayerId.ONE]}
                                                talents={gameState.playerTalents[PlayerId.ONE]}
                                                actions={gameState.characterActions[PlayerId.ONE]}
                                                alignRight={false}
                                            />
                                        </div>

                                        {/* Player 2 */}
                                        <div
                                            onClick={() => gameService.debugSetTurn(PlayerId.TWO)}
                                            className={`relative group text-sm font-bold tracking-widest transition-colors cursor-pointer ${gameState.currentTurn === PlayerId.TWO ? 'text-pink-400 drop-shadow-[0_0_5px_magenta]' : 'text-slate-600 hover:text-slate-400'}`}
                                        >
                                            PLAYER 2
                                            <PlayerTooltip
                                                characterId={gameState.playerCharacters[PlayerId.TWO]}
                                                talents={gameState.playerTalents[PlayerId.TWO]}
                                                actions={gameState.characterActions[PlayerId.TWO]}
                                                alignRight={false}
                                            />
                                        </div>

                                        {/* Neutral */}
                                        <div
                                            onClick={() => gameService.debugSetTurn(PlayerId.NEUTRAL)}
                                            className={`relative group text-sm font-bold tracking-widest transition-colors cursor-pointer ${gameState.currentTurn === PlayerId.NEUTRAL ? 'text-gray-300 drop-shadow-[0_0_5px_gray]' : 'text-slate-600 hover:text-slate-400'}`}
                                        >
                                            NEUTRAL
                                            <PlayerTooltip
                                                characterId={gameState.playerCharacters[PlayerId.NEUTRAL]}
                                                talents={gameState.playerTalents[PlayerId.NEUTRAL]}
                                                actions={gameState.characterActions[PlayerId.NEUTRAL]}
                                                alignRight={true}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Player 1 Effects */}
                                    <div className="flex gap-1 justify-end min-w-[80px] pointer-events-auto">
                                        {gameState.playerEffects[PlayerId.ONE].map(e => (
                                            <EffectIcon key={e.id} effect={e} alignRight />
                                        ))}
                                    </div>

                                    <div className="bg-transparent border border-green-900 px-6 py-2 rounded-full shadow-[0_0_15px_rgba(0,255,0,0.2)] flex items-center gap-6 backdrop-blur-sm pointer-events-auto">

                                        {/* Player 1 Label + Talent Tooltip */}
                                        <div className={`relative group text-sm font-bold tracking-widest transition-colors cursor-help ${gameState.currentTurn === PlayerId.ONE ? 'text-cyan-400 drop-shadow-[0_0_5px_cyan]' : 'text-slate-600'}`}>
                                            PLAYER 1
                                            <PlayerTooltip
                                                characterId={gameState.playerCharacters[PlayerId.ONE]}
                                                talents={gameState.playerTalents[PlayerId.ONE]}
                                                actions={gameState.characterActions[PlayerId.ONE]}
                                                alignRight={false}
                                            />
                                        </div>

                                        {/* Level Counter */}
                                        <div className="flex flex-col items-center justify-center px-4 border-l border-r border-slate-700/50">
                                            <div className="text-[8px] text-green-500/70 font-bold uppercase tracking-wider leading-none mb-0.5">LEVEL</div>
                                            <div className="text-lg font-mono font-bold text-white leading-none">{gameState.roundNumber.toString().padStart(2, '0')}</div>
                                        </div>

                                        {/* Player 2 Label + Talent Tooltip */}
                                        <div className={`relative group text-sm font-bold tracking-widest transition-colors cursor-help ${gameState.currentTurn === PlayerId.TWO ? 'text-pink-400 drop-shadow-[0_0_5px_magenta]' : 'text-slate-600'}`}>
                                            PLAYER 2
                                            <PlayerTooltip
                                                characterId={gameState.playerCharacters[PlayerId.TWO]}
                                                talents={gameState.playerTalents[PlayerId.TWO]}
                                                actions={gameState.characterActions[PlayerId.TWO]}
                                                alignRight={true}
                                            />
                                        </div>
                                    </div>

                                    {/* Player 2 Effects */}
                                    <div className="flex gap-1 justify-start min-w-[80px] pointer-events-auto">
                                        {gameState.playerEffects[PlayerId.TWO].map(e => (
                                            <EffectIcon key={e.id} effect={e} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* CREDIT DISPLAY (Clickable to Open Shop) */}
                            <button
                                onClick={() => gameService.openShop()}
                                disabled={!gameState.shopAvailable || !isLocalTurn}
                                className={`pointer-events-auto bg-black/60 border text-[10px] font-mono font-bold px-3 py-1.5 rounded shadow flex items-center gap-2 transition-all duration-200
                            ${gameState.shopAvailable && isLocalTurn
                                        ? 'border-green-500 text-green-400 hover:bg-green-900/40 hover:border-green-400 hover:shadow-[0_0_10px_rgba(0,255,0,0.3)] active:scale-95'
                                        : 'border-gray-800 text-gray-600 cursor-not-allowed opacity-70'}
                        `}
                            >
                                <span>CREDITS:</span>
                                <span className={`text-sm ${gameState.shopAvailable && isLocalTurn ? 'text-white' : 'text-gray-500'}`}>${gameState.credits[gameState.currentTurn]}</span>
                                {gameState.shopAvailable && isLocalTurn && <span className="text-[8px] bg-green-900/50 px-1 rounded border border-green-700 text-green-300">SHOP</span>}
                            </button>

                            {isLocalTurn ? (
                                <button
                                    onClick={() => gameService.skipTurn()}
                                    className="pointer-events-auto bg-green-900/60 hover:bg-green-700/80 border border-green-500 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded transition-all shadow-[0_0_10px_rgba(0,255,0,0.3)] hover:shadow-[0_0_20px_rgba(0,255,0,0.6)] active:scale-95"
                                >
                                    END TURN [SPACE]
                                </button>
                            ) : (
                                <div className="pointer-events-none bg-gray-900/70 border border-gray-700 text-gray-300 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded">
                                    OPPONENT TURN
                                </div>
                            )}
                        </div>

                        {gameState.interactionState.mode !== 'NORMAL' && (
                            <div className="pointer-events-auto bg-yellow-900/80 border border-yellow-500 text-yellow-200 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded animate-pulse shadow-[0_0_10px_rgba(255,255,0,0.3)]">
                                {gameState.interactionState.mode === 'WALL_PLACEMENT'
                                    ? `BUILDING WALL... (${gameState.interactionState.remaining} LEFT)`
                                    : gameState.interactionState.mode === 'ABILITY_SUMMON'
                                        ? `SUMMONING... (${gameState.interactionState.remaining} LEFT)`
                                        : gameState.interactionState.mode === 'ABILITY_FREEZE'
                                            ? `TARGETING CRYO SHOT...`
                                            : gameState.interactionState.mode === 'MASS_RETREAT_TARGETING'
                                                ? `SELECT MASS RETREAT ZONE${massRetreatText}`
                                            : gameState.interactionState.mode === 'TERRAIN_EDIT'
                                                ? `TERRAIN MODIFICATION ACTIVE: ${gameState.interactionState.terrainTool}${terrainImpactText}`
                                                : 'SELECT DESTINATION...'
                                }
                                [SPACE TO CANCEL]
                            </div>
                        )}

                        {gameState.systemMessage && (
                            <div className="text-[10px] text-green-400 bg-transparent px-3 py-1 rounded border border-green-900/50 uppercase tracking-widest animate-pulse backdrop-blur-md">
                                {gameState.systemMessage}
                            </div>
                        )}
                    </div>

                    {showInventoryBar && (
                        <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center px-4 pointer-events-none">
                            <div className="w-full max-w-screen-xl flex flex-col items-center gap-1 pointer-events-none">
                                {/* Character Actions */}
                                <CharacterActionBar
                                    actions={gameState.characterActions[gameState.currentTurn]}
                                    playerId={controlledPlayerId || gameState.currentTurn}
                                    currentTurn={gameState.currentTurn}
                                    isDevMode={gameState.isDevMode}
                                    currentRound={gameState.roundNumber}
                                />

                                <Deck
                                    cards={currentPlayerDeck}
                                    selectedId={gameState.selectedCardId}
                                    onSelect={(id) => {
                                        if (isLocalTurn) gameService.selectCard(id);
                                    }}
                                    playerColor={playerColor}
                                    deliveredCardIds={gameState.recentlyDeliveredCardIds[gameState.currentTurn]}
                                />
                            </div>
                        </div>
                    )}

                    {showUnitControlPanel && (
                        <UnitControlPanel unit={selectedUnit} isDevMode={gameState.isDevMode} currentRound={gameState.roundNumber} characterId={selectedUnit ? gameState.playerCharacters[selectedUnit.playerId] : null} />
                    )}

                    <div className="absolute top-16 left-4 w-72 flex flex-col gap-2 pointer-events-auto max-h-[calc(100vh-10rem)] z-10">
                        {/* Action Log Panel */}
                        <div
                            className={`rounded-xl border border-green-500/60 shadow-[0_0_20px_rgba(0,255,0,0.1)] overflow-hidden transition-all duration-300 flex flex-col bg-black/40 ${isLogMinimized ? 'h-10 flex-none' : 'shrink min-h-0 max-h-48'}`}
                        >
                            <div
                                onClick={() => setIsLogMinimized(!isLogMinimized)}
                                className="flex items-center justify-between px-4 py-2 bg-black/40 hover:bg-black/60 cursor-pointer border-b border-green-500/30 flex-none h-10"
                            >
                                <h2 className="text-xs font-bold text-white uppercase tracking-widest drop-shadow-md">Action Log</h2>
                                <span className="font-mono text-[10px] text-green-300">{isLogMinimized ? '[+]' : '[-]'}</span>
                            </div>

                            <div className={`p-2 overflow-y-auto flex-1 ${isLogMinimized ? 'hidden' : 'block'}`}>
                                <div className="flex flex-col gap-1">
                                    {gameState.actionLog.map((log, i) => (
                                        <div key={log.id} className="text-[10px] font-mono break-words leading-tight border-l-2 border-green-500/50 pl-2 py-0.5 drop-shadow-sm text-shadow">
                                            <span className="text-gray-400 mr-2">[{log.timestamp}]</span>
                                            {log.playerId && (
                                                <span className={`mr-2 font-bold ${log.playerId === PlayerId.ONE ? 'text-cyan-400' : 'text-pink-400'}`}>
                                                    [{log.playerId === PlayerId.ONE ? 'P1' : 'P2'}]
                                                </span>
                                            )}
                                            <span className="text-green-300/90 font-semibold">{log.message}</span>
                                        </div>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            </div>
                        </div>

                        {/* System Protocol Panel */}
                        <div
                            className={`rounded-xl border border-green-500/60 shadow-[0_0_20px_rgba(0,255,0,0.1)] text-green-400 overflow-hidden transition-all duration-300 flex flex-col flex-none bg-black/40 ${isProtocolMinimized ? 'h-10' : 'max-h-[20rem]'}`}
                        >
                            <div
                                onClick={() => setIsProtocolMinimized(!isProtocolMinimized)}
                                className="flex items-center justify-between px-4 py-2 bg-black/40 hover:bg-black/60 cursor-pointer border-b border-green-500/30 h-10"
                            >
                                <h2 className="text-xs font-bold text-white uppercase tracking-widest drop-shadow-md">System Protocol</h2>
                                <span className="font-mono text-[10px] text-green-300">{isProtocolMinimized ? '[+]' : '[-]'}</span>
                            </div>

                            <div className={`p-4 pt-3 flex flex-col gap-4 overflow-y-auto ${isProtocolMinimized ? 'hidden' : 'block'}`}>
                                <div>
                                    <h3 className="text-[10px] text-green-500 font-bold uppercase mb-1 border-b border-green-800/50 pb-0.5">Visual Uplink</h3>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[11px] text-gray-300 uppercase tracking-tighter">Lumen Sync</span>
                                        <button
                                            onClick={() => gameService.toggleLightMode()}
                                            className={`w-12 h-5 rounded-full border border-green-500/50 relative transition-all duration-300 ${gameState.lightMode === 'LIGHT' ? 'bg-green-500/30' : 'bg-black/50'}`}
                                        >
                                            <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-green-400 transition-all duration-300 ${gameState.lightMode === 'LIGHT' ? 'left-7 shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-[10px] text-green-500 font-bold uppercase mb-1 border-b border-green-800/50 pb-0.5">Camera Uplink</h3>
                                    <ul className="text-[11px] space-y-1 font-mono text-gray-300">
                                        <li className="flex justify-between"><span>Orbit</span> <span className="text-white">R-Click + Drag</span></li>
                                        <li className="flex justify-between"><span>Pan</span> <span className="text-white">Shift + Drag</span></li>
                                        <li className="flex justify-between"><span>Zoom</span> <span className="text-white">Scroll Wheel</span></li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-[10px] text-green-500 font-bold uppercase mb-1 border-b border-green-800/50 pb-0.5">Command Interface</h3>
                                    <ul className="text-[11px] space-y-2 font-mono text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-green-500">{">>"}</span>
                                            <span>[1-9] Select Unit Card</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-green-500">{">>"}</span>
                                            <span>L-Click Unit to <span className="text-white">SELECT</span></span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-green-500">{">>"}</span>
                                            <span>SPACE to <span className="text-white">END TURN</span></span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-green-500">{">>"}</span>
                                            <span>ESC to <span className="text-white">MENU/PAUSE</span></span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Minimap Panel */}
                        <Minimap
                            units={gameState.units}
                            revealedTiles={gameState.revealedTiles}
                            terrain={gameState.terrain}
                            mapBounds={gameState.mapBounds}
                        />

                        {/* Map Editor (Only in Dev Mode) */}
                        {gameState.isDevMode && (
                            <MapEditor activeTool={gameState.interactionState.terrainTool} />
                        )}

                    </div>
                </>
            )}

        </div>
    );
};

export default App;
