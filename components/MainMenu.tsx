import React, { useEffect, useMemo, useState } from 'react';
import MapPreview3D from './MapPreview3D';
import { AppStatus, EmptyMapConfig, MapMetadata, MatchMode } from '../types';
import { gameService } from '../services/gameService';
import { BOARD_SIZE } from '../constants';

interface MainMenuProps {
  status: AppStatus;
  onResume: () => void;
  onAbortToMenu: () => void;
  onRestartCurrentMap: () => void;
  availableMaps: MapMetadata[];
  roomId: string | null;
  lobbyMapId: string | null;
  lobbyPlayerCount: number;
  lobbyMaxPlayers: number;
  hostAdminEnabled: boolean;
  isMultiplayer: boolean;
  isDevMode: boolean;
}

type MenuView = 'ROOT' | 'START' | 'SOLO_MAPS' | 'DEV_MAPS' | 'MULTIPLAYER';

const MainMenu: React.FC<MainMenuProps> = ({
  status,
  onResume,
  onAbortToMenu,
  onRestartCurrentMap,
  availableMaps,
  roomId,
  lobbyMapId,
  lobbyPlayerCount,
  lobbyMaxPlayers,
  hostAdminEnabled,
  isMultiplayer,
  isDevMode
}) => {
  const [menuView, setMenuView] = useState<MenuView>('ROOT');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isGeneratingRoomCode, setIsGeneratingRoomCode] = useState(false);
  const [fieldWidth, setFieldWidth] = useState(10);
  const [fieldDepth, setFieldDepth] = useState(10);
  const [selectedSoloMap, setSelectedSoloMap] = useState('MAP_1');
  const [selectedDevMap, setSelectedDevMap] = useState('EMPTY');
  const [selectedMultiplayerMap, setSelectedMultiplayerMap] = useState('CrossMap');
  const [hostAdminRequested, setHostAdminRequested] = useState(false);
  const [emptyPlayerCount, setEmptyPlayerCount] = useState<2 | 3 | 4>(2);
  const [emptyMode, setEmptyMode] = useState<MatchMode>('duel');

  const isTopLevelMenuStatus = status === AppStatus.MENU || status === AppStatus.MAP_SELECTION;
  const canRestartCurrentMap = !isMultiplayer && !isDevMode;
  const isMapBrowserView = menuView === 'SOLO_MAPS' || menuView === 'DEV_MAPS' || menuView === 'MULTIPLAYER';
  const isPauseView = status === AppStatus.PAUSED;

  const soloMaps = useMemo(() => {
    return availableMaps.filter((map) => map.players === 2 || map.players === 'dev');
  }, [availableMaps]);

  const devMapOptions = useMemo(() => {
    return [
      {
        id: 'EMPTY',
        description: 'Blank sandbox generated from the selected dimensions.',
        players: 'dev' as const,
        mode: 'duel' as const
      },
      ...soloMaps
    ];
  }, [soloMaps]);

  const emptyMapConfig = useMemo<EmptyMapConfig>(() => ({
    players: emptyPlayerCount,
    mode: emptyMode
  }), [emptyMode, emptyPlayerCount]);
  const emptyMinWidth = emptyPlayerCount > 2 ? 6 : 4;
  const emptyMinDepth = emptyPlayerCount > 2 ? 7 : 6;

  const multiplayerMaps = useMemo(() => {
    return availableMaps.filter((map) => map.id === 'CrossMap');
  }, [availableMaps]);

  const selectedSoloMapMeta = useMemo(() => {
    return soloMaps.find((map) => map.id === selectedSoloMap) || null;
  }, [soloMaps, selectedSoloMap]);

  const selectedDevMapMeta = useMemo(() => {
    return devMapOptions.find((map) => map.id === selectedDevMap) || null;
  }, [devMapOptions, selectedDevMap]);

  const selectedMultiplayerMapMeta = useMemo(() => {
    return multiplayerMaps.find((map) => map.id === selectedMultiplayerMap) || null;
  }, [multiplayerMaps, selectedMultiplayerMap]);

  const activeLobbyMapMeta = useMemo(() => {
    if (!lobbyMapId) return selectedMultiplayerMapMeta;
    return availableMaps.find((map) => map.id === lobbyMapId) || selectedMultiplayerMapMeta;
  }, [availableMaps, lobbyMapId, selectedMultiplayerMapMeta]);

  const hasPendingLobby = !!roomId && lobbyMaxPlayers > 0;
  const remainingLobbySlots = hasPendingLobby ? Math.max(0, lobbyMaxPlayers - lobbyPlayerCount) : 0;

  const selectedPreview = useMemo(() => {
    if (menuView === 'SOLO_MAPS') {
      return gameService.getMapPreviewData(selectedSoloMap);
    }

    if (menuView === 'DEV_MAPS') {
      const customSize = selectedDevMap === 'EMPTY' ? { x: fieldWidth, y: fieldDepth } : undefined;
      const config = selectedDevMap === 'EMPTY' ? emptyMapConfig : undefined;
      return gameService.getMapPreviewData(selectedDevMap, customSize, config);
    }

    if (menuView === 'MULTIPLAYER') {
      return gameService.getMapPreviewData(lobbyMapId || selectedMultiplayerMap);
    }

    return null;
  }, [emptyMapConfig, fieldDepth, fieldWidth, lobbyMapId, menuView, selectedDevMap, selectedMultiplayerMap, selectedSoloMap]);

  useEffect(() => {
    if (status === AppStatus.MENU) {
      setMenuView('ROOT');
      setRoomCodeInput('');
      setIsGeneratingRoomCode(false);
      setHostAdminRequested(false);
    } else if (status === AppStatus.MAP_SELECTION) {
      setMenuView('SOLO_MAPS');
    }
  }, [status]);

  useEffect(() => {
    if (roomId) {
      setIsGeneratingRoomCode(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (soloMaps.length === 0) return;
    if (!soloMaps.some((map) => map.id === selectedSoloMap)) {
      setSelectedSoloMap(soloMaps[0].id);
    }
  }, [selectedSoloMap, soloMaps]);

  useEffect(() => {
    if (devMapOptions.length === 0) return;
    if (!devMapOptions.some((map) => map.id === selectedDevMap)) {
      setSelectedDevMap(devMapOptions[0].id);
    }
  }, [devMapOptions, selectedDevMap]);

  useEffect(() => {
    if (multiplayerMaps.length === 0) return;
    if (!multiplayerMaps.some((map) => map.id === selectedMultiplayerMap)) {
      setSelectedMultiplayerMap(multiplayerMaps[0].id);
    }
  }, [multiplayerMaps, selectedMultiplayerMap]);

  useEffect(() => {
    if (emptyPlayerCount === 2 && emptyMode !== 'duel') {
      setEmptyMode('duel');
      return;
    }

    if (emptyPlayerCount === 3 && emptyMode !== 'team_2v1' && emptyMode !== 'ffa') {
      setEmptyMode('team_2v1');
      return;
    }

    if (emptyPlayerCount === 4 && emptyMode !== 'team_2v2' && emptyMode !== 'ffa') {
      setEmptyMode('team_2v2');
    }
  }, [emptyMode, emptyPlayerCount]);

  useEffect(() => {
    setFieldWidth((prev) => Math.max(emptyMinWidth, Math.min(BOARD_SIZE, prev)));
    setFieldDepth((prev) => Math.max(emptyMinDepth, Math.min(BOARD_SIZE, prev)));
  }, [emptyMinDepth, emptyMinWidth]);

  const enterMultiplayerMenu = () => {
    setMenuView('MULTIPLAYER');
    setIsGeneratingRoomCode(false);
  };

  const joinRoom = () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) return;
    gameService.joinLobby(code);
  };

  const startSelectedSoloMap = () => {
    gameService.beginMatchSetup(selectedSoloMap, false);
  };

  const startSelectedDevMap = () => {
    if (selectedDevMap === 'EMPTY') {
      gameService.beginMatchSetup('EMPTY', true, { x: fieldWidth, y: fieldDepth }, emptyMapConfig);
      return;
    }

    gameService.beginMatchSetup(selectedDevMap, true);
  };

  const getModeLabel = (mode: MatchMode) => {
    switch (mode) {
      case 'team_2v1':
        return 'P1+P2 vs P3';
      case 'team_2v2':
        return 'P1+P2 vs P3+P4';
      case 'ffa':
        return 'Free For All';
      default:
        return 'P1 vs P2';
    }
  };

  const createMultiplayerLobby = () => {
    if (hasPendingLobby) return;
    setIsGeneratingRoomCode(true);
    gameService.createLobby(selectedMultiplayerMap, hostAdminRequested);
  };

  const getLobbyStatusLabel = () => {
    if (isGeneratingRoomCode && !roomId) return 'Generating room uplink...';
    if (!hasPendingLobby) return 'No active lobby';
    if (remainingLobbySlots === 0) return 'Lobby full. Initializing match...';
    if (remainingLobbySlots === 1) return 'Waiting for 1 more player';
    return `Waiting for ${remainingLobbySlots} more players`;
  };

  const renderMapListItem = (
    map: MapMetadata,
    selectedId: string,
    onSelect: (mapId: string) => void,
    accent: 'green' | 'yellow' | 'purple'
  ) => {
    const isSelected = selectedId === map.id;
    const palette = accent === 'yellow'
      ? {
          base: 'border-yellow-500/30 bg-yellow-950/20 text-yellow-200 hover:border-yellow-400/70',
          selected: 'border-yellow-300 bg-yellow-500/15 text-white shadow-[0_0_25px_rgba(250,204,21,0.16)]',
          chip: 'text-yellow-200/70'
        }
      : accent === 'purple'
        ? {
            base: 'border-purple-500/30 bg-purple-950/20 text-purple-200 hover:border-purple-400/70',
            selected: 'border-purple-300 bg-purple-500/15 text-white shadow-[0_0_25px_rgba(192,132,252,0.16)]',
            chip: 'text-purple-200/70'
          }
        : {
            base: 'border-green-500/30 bg-green-950/20 text-green-200 hover:border-green-400/70',
            selected: 'border-green-300 bg-green-500/15 text-white shadow-[0_0_25px_rgba(74,222,128,0.16)]',
            chip: 'text-green-200/70'
          };
    const availabilityLabel = map.players === 'dev' ? 'SOLO / DEV' : `${map.players}P`;

    return (
      <button
        key={map.id}
        onClick={() => onSelect(map.id)}
        className={`w-full rounded-xl border px-4 py-4 text-left font-mono transition-all duration-200 ${isSelected ? palette.selected : palette.base}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.24em]">{map.id}</div>
            <div className="mt-1 text-[11px] leading-relaxed normal-case text-current/80">
              {map.description || 'No map description provided.'}
            </div>
          </div>
          <div className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] ${palette.chip}`}>
            {availabilityLabel}
          </div>
        </div>
      </button>
    );
  };

  if (
    status === AppStatus.PLAYING ||
    status === AppStatus.RULEBOOK ||
    status === AppStatus.CARD_CATALOGUE ||
    status === AppStatus.CHARACTER_SELECTION ||
    status === AppStatus.SHOP ||
    status === AppStatus.TALENT_SELECTION
  ) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto p-3 md:p-4">
      <div className={`relative w-full overflow-hidden rounded-xl border border-green-500/50 bg-black/70 shadow-[0_0_50px_rgba(0,255,0,0.2)] backdrop-blur-sm ${isMapBrowserView ? 'max-w-6xl max-h-[calc(100vh-1.5rem)] md:max-h-[calc(100vh-2rem)]' : isPauseView ? 'max-w-sm' : 'max-w-md'} ${isMapBrowserView ? 'p-5 md:p-6' : isPauseView ? 'p-6' : 'p-8'}`}>
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        <div className={`relative z-10 ${isMapBrowserView ? 'max-h-[calc(100vh-3.5rem)] overflow-y-auto game-scrollbar pr-1 md:max-h-[calc(100vh-4rem)]' : ''}`}>
          <h1 className="text-center text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,0,0.5)] md:text-5xl">
            Neon Tactics
            <span className="mt-2 block text-sm font-mono tracking-[0.5em] text-green-500/80">SIMULATION LINK</span>
          </h1>

          <div className="mt-6 flex flex-col gap-4">
            {isTopLevelMenuStatus && menuView === 'ROOT' && (
              <>
                <button
                  onClick={() => setMenuView('START')}
                  className="group relative overflow-hidden border border-green-500/50 bg-green-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-green-400 transition-all duration-200 hover:border-green-400 hover:bg-green-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-green-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Start
                </button>

                <button
                  onClick={() => gameService.enterRulebook()}
                  className="group relative overflow-hidden border border-emerald-500/50 bg-emerald-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-emerald-300 transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-emerald-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Rulebook
                </button>

                <button
                  onClick={() => gameService.enterCardCatalogue()}
                  className="group relative overflow-hidden border border-cyan-500/50 bg-cyan-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-cyan-400 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-cyan-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Catalogue
                </button>
              </>
            )}

            {isTopLevelMenuStatus && menuView === 'START' && (
              <>
                <button
                  onClick={() => setMenuView('SOLO_MAPS')}
                  className="group relative overflow-hidden border border-green-500/50 bg-green-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-green-400 transition-all duration-200 hover:border-green-400 hover:bg-green-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-green-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Solo Mode
                </button>

                <button
                  onClick={() => setMenuView('DEV_MAPS')}
                  className="group relative overflow-hidden border border-yellow-500/50 bg-yellow-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-yellow-400 transition-all duration-200 hover:border-yellow-400 hover:bg-yellow-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-yellow-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Dev Mode
                </button>

                <button
                  onClick={enterMultiplayerMenu}
                  className="group relative overflow-hidden border border-purple-500/50 bg-purple-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-purple-400 transition-all duration-200 hover:border-purple-400 hover:bg-purple-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-purple-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Multiplayer
                </button>

                <button
                  onClick={() => setMenuView('ROOT')}
                  className="group relative mt-2 overflow-hidden border border-gray-500/50 bg-gray-900/40 px-8 py-2 font-mono font-bold uppercase tracking-widest text-gray-400 transition-all duration-200 hover:border-gray-400 hover:bg-gray-600/20 hover:text-white"
                >
                  &lt; Back
                </button>
              </>
            )}

            {isTopLevelMenuStatus && (menuView === 'SOLO_MAPS' || menuView === 'DEV_MAPS') && (
              <div className="animate-fadeIn">
                <div className="mb-4 text-center font-mono text-sm text-green-300">
                  {menuView === 'SOLO_MAPS' ? 'SOLO MODE | MAP SELECT' : 'DEV MODE | MAP SELECT'}
                </div>

                <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-black/35 p-4 lg:max-h-[calc(100vh-16rem)]">
                    <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.35em] text-gray-400">
                      Map List
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto game-scrollbar pr-1">
                      {(menuView === 'DEV_MAPS' ? devMapOptions : soloMaps).map((map) =>
                        renderMapListItem(
                          map,
                          menuView === 'DEV_MAPS' ? selectedDevMap : selectedSoloMap,
                          menuView === 'DEV_MAPS' ? setSelectedDevMap : setSelectedSoloMap,
                          menuView === 'DEV_MAPS' ? 'yellow' : 'green'
                        )
                      )}
                    </div>

                    {menuView === 'DEV_MAPS' && selectedDevMap === 'EMPTY' && (
                      <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-950/10 p-3">
                        <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-yellow-200/80">
                          Sandbox Size
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={fieldWidth}
                            onChange={(e) => setFieldWidth(Math.max(emptyMinWidth, Math.min(BOARD_SIZE, parseInt(e.target.value, 10) || 10)))}
                            className="w-16 border border-yellow-500/30 bg-black/50 p-2 text-center text-xs text-yellow-300 outline-none focus:border-yellow-500"
                            placeholder="X"
                          />
                          <span className="text-xs text-gray-500">x</span>
                          <input
                            type="number"
                            value={fieldDepth}
                            onChange={(e) => setFieldDepth(Math.max(emptyMinDepth, Math.min(BOARD_SIZE, parseInt(e.target.value, 10) || 10)))}
                            className="w-16 border border-yellow-500/30 bg-black/50 p-2 text-center text-xs text-yellow-300 outline-none focus:border-yellow-500"
                            placeholder="Y"
                          />
                        </div>
                        <div className="mt-1 text-[10px] font-mono text-yellow-200/60">
                          Minimum size: {emptyMinWidth} x {emptyMinDepth}
                        </div>

                        <div className="mt-4 grid gap-3">
                          <div>
                            <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-yellow-200/80">
                              Player Count
                            </div>
                            <div className="flex gap-2">
                              {[2, 3, 4].map((count) => (
                                <button
                                  key={count}
                                  onClick={() => setEmptyPlayerCount(count as 2 | 3 | 4)}
                                  className={`flex-1 border px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-[0.18em] transition-colors ${
                                    emptyPlayerCount === count
                                      ? 'border-yellow-300 bg-yellow-500/20 text-yellow-100'
                                      : 'border-yellow-500/20 bg-black/30 text-yellow-300/70 hover:border-yellow-400/40'
                                  }`}
                                >
                                  {count}P
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-yellow-200/80">
                              Match Mode
                            </div>
                            <div className="grid gap-2">
                              {(emptyPlayerCount === 2
                                ? [{ value: 'duel', label: 'P1 vs P2' }]
                                : emptyPlayerCount === 3
                                  ? [{ value: 'team_2v1', label: 'P1+P2 vs P3' }, { value: 'ffa', label: 'Free For All' }]
                                  : [{ value: 'team_2v2', label: 'P1+P2 vs P3+P4' }, { value: 'ffa', label: 'Free For All' }]
                              ).map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => setEmptyMode(option.value as MatchMode)}
                                  className={`border px-3 py-2 text-left text-[11px] font-mono font-bold uppercase tracking-[0.14em] transition-colors ${
                                    emptyMode === option.value
                                      ? 'border-yellow-300 bg-yellow-500/20 text-yellow-100'
                                      : 'border-yellow-500/20 bg-black/30 text-yellow-300/70 hover:border-yellow-400/40'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={menuView === 'DEV_MAPS' ? startSelectedDevMap : startSelectedSoloMap}
                        className={`flex-1 border px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.28em] transition-colors ${
                          menuView === 'DEV_MAPS'
                            ? 'border-yellow-400/60 bg-yellow-600/15 text-yellow-200 hover:border-yellow-300 hover:bg-yellow-500/20'
                            : 'border-green-400/60 bg-green-600/15 text-green-200 hover:border-green-300 hover:bg-green-500/20'
                        }`}
                      >
                        Launch
                      </button>
                      <button
                        onClick={() => setMenuView('START')}
                        className="border border-gray-500/50 bg-gray-900/40 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.22em] text-gray-300 transition-colors hover:border-gray-400 hover:bg-gray-700/20 hover:text-white"
                      >
                        Back
                      </button>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col rounded-2xl border border-cyan-500/20 bg-black/35 p-4 lg:max-h-[calc(100vh-16rem)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-cyan-300/80">
                          3D Preview
                        </div>
                        <div className="mt-2 text-2xl font-black uppercase tracking-[0.18em] text-white">
                          {menuView === 'DEV_MAPS' ? (selectedPreview?.id || selectedDevMapMeta?.id) : selectedSoloMapMeta?.id}
                        </div>
                      </div>
                      <div className="rounded-full border border-cyan-400/30 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-200/75">
                        {(menuView === 'DEV_MAPS' ? (selectedPreview || selectedDevMapMeta) : selectedSoloMapMeta)?.players === 'dev'
                          ? 'Solo / Dev'
                          : `${(menuView === 'DEV_MAPS' ? (selectedPreview || selectedDevMapMeta) : selectedSoloMapMeta)?.players || 2} Players`}
                      </div>
                    </div>

                    <div className="mb-4 text-sm leading-relaxed text-gray-300">
                      {(menuView === 'DEV_MAPS' ? (selectedPreview || selectedDevMapMeta) : selectedSoloMapMeta)?.description || 'No map description provided.'}
                      {menuView === 'DEV_MAPS' && selectedDevMap === 'EMPTY' && (
                        <div className="mt-3 text-xs font-mono uppercase tracking-[0.18em] text-cyan-300/75">
                          {getModeLabel(emptyMode)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <MapPreview3D preview={selectedPreview} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isTopLevelMenuStatus && menuView === 'MULTIPLAYER' && (
              <div className="animate-fadeIn">
                <div className="mb-4 text-center text-sm font-mono text-purple-300">MULTIPLAYER UPLINK</div>

                <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-black/35 p-4 lg:max-h-[calc(100vh-16rem)]">
                    <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.35em] text-gray-400">
                      Hostable Maps
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto game-scrollbar pr-1">
                      {multiplayerMaps.map((map) =>
                        renderMapListItem(map, selectedMultiplayerMap, setSelectedMultiplayerMap, 'purple')
                      )}
                    </div>

                    <button
                      onClick={createMultiplayerLobby}
                      disabled={hasPendingLobby}
                      className={`mt-4 border px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.28em] transition-colors ${
                        hasPendingLobby
                          ? 'cursor-not-allowed border-purple-900/60 bg-purple-950/20 text-purple-300/40'
                          : 'border-purple-400/60 bg-purple-600/15 text-purple-100 hover:border-purple-300 hover:bg-purple-500/20'
                      }`}
                    >
                      {hasPendingLobby ? 'Lobby Active' : 'Create Lobby'}
                    </button>

                    <label className={`mt-4 flex items-start gap-3 rounded-xl border px-3 py-3 text-left font-mono transition-colors ${
                      hasPendingLobby
                        ? 'border-purple-900/40 bg-purple-950/10 text-purple-200/45'
                        : 'border-purple-500/30 bg-purple-950/15 text-purple-100'
                    }`}>
                      <input
                        type="checkbox"
                        checked={hasPendingLobby ? hostAdminEnabled : hostAdminRequested}
                        onChange={(e) => setHostAdminRequested(e.target.checked)}
                        disabled={hasPendingLobby}
                        className="mt-0.5 h-4 w-4 border-purple-500/40 bg-black/60 accent-purple-500 disabled:cursor-not-allowed"
                      />
                      <span className="flex-1 text-xs leading-relaxed">
                        <span className="block text-[10px] uppercase tracking-[0.22em] text-purple-300/80">
                          Host Admin In-Game
                        </span>
                        <span>
                          Lets the host edit HP, energy, and core combat stats for any unit from the unit control pane during the match.
                        </span>
                      </span>
                    </label>

                    <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-950/15 px-3 py-3 text-center text-xs font-mono text-purple-100">
                      Room Code:{' '}
                      <span className="font-bold tracking-widest text-purple-300">
                        {isGeneratingRoomCode ? 'Generating...' : (roomId || '----')}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <input
                        type="text"
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                        placeholder="ENTER ROOM CODE"
                        disabled={hasPendingLobby}
                        className="w-2/3 border border-purple-500/30 bg-black/50 p-3 text-center font-mono uppercase text-purple-300 outline-none focus:border-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                      <button
                        onClick={joinRoom}
                        disabled={hasPendingLobby}
                        className="w-1/3 border border-purple-500/50 bg-purple-900/40 font-mono font-bold text-purple-300 transition-colors hover:border-purple-400 hover:bg-purple-600/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        JOIN
                      </button>
                    </div>

                    {hasPendingLobby ? (
                      <button
                        onClick={onAbortToMenu}
                        className="mt-4 border border-red-500/50 bg-red-900/30 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.22em] text-red-200 transition-colors hover:border-red-400 hover:bg-red-700/20 hover:text-white"
                      >
                        Leave Lobby
                      </button>
                    ) : (
                      <button
                        onClick={() => setMenuView('START')}
                        className="mt-4 border border-gray-500/50 bg-gray-900/40 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.22em] text-gray-300 transition-colors hover:border-gray-400 hover:bg-gray-700/20 hover:text-white"
                      >
                        Back
                      </button>
                    )}
                  </div>

                  <div className="flex min-h-0 flex-col rounded-2xl border border-purple-500/20 bg-black/35 p-4 lg:max-h-[calc(100vh-16rem)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-purple-300/80">
                          Locked Multiplayer Pool
                        </div>
                        <div className="mt-2 text-2xl font-black uppercase tracking-[0.18em] text-white">
                          {activeLobbyMapMeta?.id || selectedMultiplayerMapMeta?.id || 'NO MAP'}
                        </div>
                      </div>
                      <div className="rounded-full border border-purple-400/30 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-purple-200/75">
                        {activeLobbyMapMeta?.players === 'dev' ? 'Dev Only' : `${activeLobbyMapMeta?.players || 2} Players`}
                      </div>
                    </div>

                    <div className="mb-4 text-sm leading-relaxed text-gray-300">
                      {activeLobbyMapMeta?.description || 'Multiplayer is currently restricted to the CrossMap rotation.'}
                    </div>

                    <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-950/15 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-purple-300/80">
                          Lobby Status
                        </div>
                        <div className="rounded-full border border-purple-400/20 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-purple-100/80">
                          {hasPendingLobby ? `${lobbyPlayerCount}/${lobbyMaxPlayers}` : '--/--'}
                        </div>
                      </div>
                      <div className="mt-3 text-sm font-mono text-purple-100">
                        {getLobbyStatusLabel()}
                      </div>
                      {hasPendingLobby && (
                        <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.18em] text-purple-300/65">
                          Room {roomId} | {activeLobbyMapMeta?.id || selectedMultiplayerMap}
                        </div>
                      )}
                      {hasPendingLobby && hostAdminEnabled && (
                        <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.18em] text-purple-200/80">
                          Host admin controls enabled
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <MapPreview3D preview={selectedPreview} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === AppStatus.PAUSED && (
              <>
                <button
                  onClick={onResume}
                  className="group relative overflow-hidden border border-cyan-500/50 bg-cyan-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-cyan-400 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-cyan-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Resume Simulation
                </button>

                {canRestartCurrentMap && (
                  <button
                    onClick={onRestartCurrentMap}
                    className="group relative overflow-hidden border border-amber-500/50 bg-amber-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-amber-400 transition-all duration-200 hover:border-amber-400 hover:bg-amber-600/20 hover:text-white"
                  >
                    <div className="absolute inset-0 translate-y-full bg-amber-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                    Restart Map
                  </button>
                )}

                <button
                  onClick={onAbortToMenu}
                  className="group relative overflow-hidden border border-red-500/50 bg-red-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-red-400 transition-all duration-200 hover:border-red-400 hover:bg-red-600/20 hover:text-white"
                >
                  <div className="absolute inset-0 translate-y-full bg-red-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                  Abort To Main Menu
                </button>
              </>
            )}

            {status === AppStatus.GAME_OVER && (
              <button
                onClick={onAbortToMenu}
                className="group relative overflow-hidden border border-green-500/50 bg-green-900/40 px-8 py-3 font-mono font-bold uppercase tracking-widest text-green-400 transition-all duration-200 hover:border-green-400 hover:bg-green-600/20 hover:text-white"
              >
                <div className="absolute inset-0 translate-y-full bg-green-400/10 transition-transform duration-300 group-hover:translate-y-0" />
                Main Menu
              </button>
            )}
          </div>

          <div className="mt-4 text-[10px] font-mono text-gray-500">
            SYSTEM STATUS: {status === AppStatus.PAUSED ? 'SUSPENDED' : isTopLevelMenuStatus ? 'STANDBY' : 'TERMINATED'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
