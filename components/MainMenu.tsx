import React, { useEffect, useMemo, useState } from 'react';
import MapPreview3D from './MapPreview3D';
import { AppStatus, MapMetadata } from '../types';
import { gameService } from '../services/gameService';
import { BOARD_SIZE } from '../constants';

interface MainMenuProps {
  status: AppStatus;
  onResume: () => void;
  onAbortToMenu: () => void;
  onRestartCurrentMap: () => void;
  availableMaps: MapMetadata[];
  roomId: string | null;
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

  const isTopLevelMenuStatus = status === AppStatus.MENU || status === AppStatus.MAP_SELECTION;
  const canRestartCurrentMap = !isMultiplayer && !isDevMode;
  const isMapBrowserView = menuView === 'SOLO_MAPS' || menuView === 'DEV_MAPS' || menuView === 'MULTIPLAYER';

  const soloMaps = useMemo(() => {
    return availableMaps.filter((map) => map.players === 2 || map.players === 'dev');
  }, [availableMaps]);

  const devMapOptions = useMemo(() => {
    return [
      {
        id: 'EMPTY',
        description: 'Blank sandbox generated from the selected dimensions.',
        players: 'dev' as const
      },
      ...soloMaps
    ];
  }, [soloMaps]);

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

  const selectedPreview = useMemo(() => {
    if (menuView === 'SOLO_MAPS') {
      return gameService.getMapPreviewData(selectedSoloMap);
    }

    if (menuView === 'DEV_MAPS') {
      const customSize = selectedDevMap === 'EMPTY' ? { x: fieldWidth, y: fieldDepth } : undefined;
      return gameService.getMapPreviewData(selectedDevMap, customSize);
    }

    if (menuView === 'MULTIPLAYER') {
      return gameService.getMapPreviewData(selectedMultiplayerMap);
    }

    return null;
  }, [fieldDepth, fieldWidth, menuView, selectedDevMap, selectedMultiplayerMap, selectedSoloMap]);

  useEffect(() => {
    if (status === AppStatus.MENU) {
      setMenuView('ROOT');
      setRoomCodeInput('');
      setIsGeneratingRoomCode(false);
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
      gameService.beginMatchSetup('EMPTY', true, { x: fieldWidth, y: fieldDepth });
      return;
    }

    gameService.beginMatchSetup(selectedDevMap, true);
  };

  const createMultiplayerLobby = () => {
    setIsGeneratingRoomCode(true);
    gameService.createLobby(selectedMultiplayerMap);
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
    status === AppStatus.CARD_CATALOGUE ||
    status === AppStatus.CHARACTER_SELECTION ||
    status === AppStatus.SHOP ||
    status === AppStatus.TALENT_SELECTION
  ) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto p-4">
      <div className={`relative w-full overflow-hidden rounded-xl border border-green-500/50 bg-black/70 p-8 shadow-[0_0_50px_rgba(0,255,0,0.2)] backdrop-blur-sm ${isMapBrowserView ? 'max-w-6xl' : 'max-w-md'}`}>
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        <div className="relative z-10">
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
                  <div className="flex min-h-[520px] flex-col rounded-2xl border border-white/10 bg-black/35 p-4">
                    <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.35em] text-gray-400">
                      Map List
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
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
                            onChange={(e) => setFieldWidth(Math.max(4, Math.min(BOARD_SIZE, parseInt(e.target.value, 10) || 10)))}
                            className="w-16 border border-yellow-500/30 bg-black/50 p-2 text-center text-xs text-yellow-300 outline-none focus:border-yellow-500"
                            placeholder="X"
                          />
                          <span className="text-xs text-gray-500">x</span>
                          <input
                            type="number"
                            value={fieldDepth}
                            onChange={(e) => setFieldDepth(Math.max(4, Math.min(BOARD_SIZE, parseInt(e.target.value, 10) || 10)))}
                            className="w-16 border border-yellow-500/30 bg-black/50 p-2 text-center text-xs text-yellow-300 outline-none focus:border-yellow-500"
                            placeholder="Y"
                          />
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

                  <div className="flex min-h-[520px] flex-col rounded-2xl border border-cyan-500/20 bg-black/35 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-cyan-300/80">
                          3D Preview
                        </div>
                        <div className="mt-2 text-2xl font-black uppercase tracking-[0.18em] text-white">
                          {menuView === 'DEV_MAPS' ? selectedDevMapMeta?.id : selectedSoloMapMeta?.id}
                        </div>
                      </div>
                      <div className="rounded-full border border-cyan-400/30 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-200/75">
                        {(menuView === 'DEV_MAPS' ? selectedDevMapMeta : selectedSoloMapMeta)?.players === 'dev'
                          ? 'Solo / Dev'
                          : `${(menuView === 'DEV_MAPS' ? selectedDevMapMeta : selectedSoloMapMeta)?.players || 2} Players`}
                      </div>
                    </div>

                    <div className="mb-4 text-sm leading-relaxed text-gray-300">
                      {(menuView === 'DEV_MAPS' ? selectedDevMapMeta : selectedSoloMapMeta)?.description || 'No map description provided.'}
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
                  <div className="flex min-h-[520px] flex-col rounded-2xl border border-white/10 bg-black/35 p-4">
                    <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.35em] text-gray-400">
                      Hostable Maps
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      {multiplayerMaps.map((map) =>
                        renderMapListItem(map, selectedMultiplayerMap, setSelectedMultiplayerMap, 'purple')
                      )}
                    </div>

                    <button
                      onClick={createMultiplayerLobby}
                      className="mt-4 border border-purple-400/60 bg-purple-600/15 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.28em] text-purple-100 transition-colors hover:border-purple-300 hover:bg-purple-500/20"
                    >
                      Create Lobby
                    </button>

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
                        className="w-2/3 border border-purple-500/30 bg-black/50 p-3 text-center font-mono uppercase text-purple-300 outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={joinRoom}
                        className="w-1/3 border border-purple-500/50 bg-purple-900/40 font-mono font-bold text-purple-300 transition-colors hover:border-purple-400 hover:bg-purple-600/20 hover:text-white"
                      >
                        JOIN
                      </button>
                    </div>

                    <button
                      onClick={() => setMenuView('START')}
                      className="mt-4 border border-gray-500/50 bg-gray-900/40 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.22em] text-gray-300 transition-colors hover:border-gray-400 hover:bg-gray-700/20 hover:text-white"
                    >
                      Back
                    </button>
                  </div>

                  <div className="flex min-h-[520px] flex-col rounded-2xl border border-purple-500/20 bg-black/35 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-purple-300/80">
                          Locked Multiplayer Pool
                        </div>
                        <div className="mt-2 text-2xl font-black uppercase tracking-[0.18em] text-white">
                          {selectedMultiplayerMapMeta?.id || 'NO MAP'}
                        </div>
                      </div>
                      <div className="rounded-full border border-purple-400/30 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-purple-200/75">
                        2 Players
                      </div>
                    </div>

                    <div className="mb-4 text-sm leading-relaxed text-gray-300">
                      {selectedMultiplayerMapMeta?.description || 'Multiplayer is currently restricted to the CrossMap rotation.'}
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
