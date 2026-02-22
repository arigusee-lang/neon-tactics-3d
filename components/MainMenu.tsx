import React, { useEffect, useMemo, useState } from 'react';
import { AppStatus } from '../types';
import { gameService } from '../services/gameService';
import { BOARD_SIZE } from '../constants';

interface MainMenuProps {
  status: AppStatus;
  onResume: () => void;
  onAbortToMenu: () => void;
  onRestartCurrentMap: () => void;
  availableMaps: string[];
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
  const [selectedMultiplayerMap, setSelectedMultiplayerMap] = useState('MAP_1');

  const isTopLevelMenuStatus = status === AppStatus.MENU || status === AppStatus.MAP_SELECTION;
  const canRestartCurrentMap = !isMultiplayer && !isDevMode;

  const allMaps = useMemo(() => {
    const uniqueMaps = new Set<string>(['MAP_1', ...availableMaps]);
    return Array.from(uniqueMaps).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [availableMaps]);

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
    if (allMaps.length === 0) return;
    if (!allMaps.includes(selectedMultiplayerMap)) {
      setSelectedMultiplayerMap(allMaps[0]);
    }
  }, [allMaps, selectedMultiplayerMap]);

  const enterMultiplayerMenu = () => {
    setMenuView('MULTIPLAYER');
    setIsGeneratingRoomCode(false);
  };

  const joinRoom = () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) return;
    gameService.joinLobby(code);
  };

  const handleMapSelect = (mapId: string, useDevMode: boolean) => {
    gameService.beginMatchSetup(mapId, useDevMode);
  };

  const handleEmptyDevMapSelect = () => {
    gameService.beginMatchSetup('EMPTY', true, { x: fieldWidth, y: fieldDepth });
  };

  const createMultiplayerLobby = () => {
    setIsGeneratingRoomCode(true);
    gameService.createLobby(selectedMultiplayerMap);
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto">
      <div className="flex flex-col items-center gap-6 p-12 border border-green-500/50 bg-black/70 shadow-[0_0_50px_rgba(0,255,0,0.2)] rounded-xl max-w-md w-full relative overflow-hidden backdrop-blur-sm">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-cyan-400 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,0,0.5)] z-10 text-center uppercase">
          Neon Tactics
          <span className="block text-sm text-green-500/80 font-mono tracking-[0.5em] mt-2">SIMULATION LINK</span>
        </h1>

        <div className="flex flex-col gap-4 w-full z-10 mt-4">
          {isTopLevelMenuStatus && menuView === 'ROOT' && (
            <>
              <button
                onClick={() => setMenuView('START')}
                className="group relative px-8 py-3 bg-green-900/40 hover:bg-green-600/20 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-green-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Start
              </button>

              <button
                onClick={() => gameService.enterCardCatalogue()}
                className="group relative px-8 py-3 bg-cyan-900/40 hover:bg-cyan-600/20 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Catalogue
              </button>
            </>
          )}

          {isTopLevelMenuStatus && menuView === 'START' && (
            <>
              <button
                onClick={() => setMenuView('SOLO_MAPS')}
                className="group relative px-8 py-3 bg-green-900/40 hover:bg-green-600/20 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-green-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Solo Mode
              </button>

              <button
                onClick={() => setMenuView('DEV_MAPS')}
                className="group relative px-8 py-3 bg-yellow-900/40 hover:bg-yellow-600/20 border border-yellow-500/50 hover:border-yellow-400 text-yellow-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-yellow-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Dev Mode
              </button>

              <button
                onClick={enterMultiplayerMenu}
                className="group relative px-8 py-3 bg-purple-900/40 hover:bg-purple-600/20 border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-purple-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Multiplayer
              </button>

              <button
                onClick={() => setMenuView('ROOT')}
                className="group relative px-8 py-2 mt-2 bg-gray-900/40 hover:bg-gray-600/20 border border-gray-500/50 hover:border-gray-400 text-gray-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                &lt; Back
              </button>
            </>
          )}

          {isTopLevelMenuStatus && (menuView === 'SOLO_MAPS' || menuView === 'DEV_MAPS') && (
            <div className="flex flex-col gap-3 w-full animate-fadeIn">
              <div className="text-center text-sm font-mono text-green-300 mb-1">
                {menuView === 'SOLO_MAPS' ? 'SOLO MODE | SELECT MAP' : 'DEV MODE | SELECT MAP'}
              </div>

              {menuView === 'DEV_MAPS' && (
                <div className="flex flex-col gap-2 mb-1">
                  <button
                    onClick={handleEmptyDevMapSelect}
                    className="group relative px-8 py-3 border bg-yellow-900/40 hover:bg-yellow-600/20 border-yellow-500/50 hover:border-yellow-400 text-yellow-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
                  >
                    <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-yellow-400/10" />
                    Empty
                  </button>

                  <div className="flex gap-2 justify-center items-center">
                    <label className="text-[10px] text-gray-500 font-mono uppercase">Size:</label>
                    <input
                      type="number"
                      value={fieldWidth}
                      onChange={(e) => setFieldWidth(Math.max(4, Math.min(BOARD_SIZE, parseInt(e.target.value, 10) || 10)))}
                      className="w-14 bg-black/50 border border-yellow-500/30 text-yellow-300 text-center text-xs p-1 outline-none focus:border-yellow-500"
                      placeholder="X"
                    />
                    <span className="text-gray-500 text-xs self-center">x</span>
                    <input
                      type="number"
                      value={fieldDepth}
                      onChange={(e) => setFieldDepth(Math.max(4, Math.min(BOARD_SIZE, parseInt(e.target.value, 10) || 10)))}
                      className="w-14 bg-black/50 border border-yellow-500/30 text-yellow-300 text-center text-xs p-1 outline-none focus:border-yellow-500"
                      placeholder="Y"
                    />
                  </div>
                </div>
              )}

              {allMaps.map((mapId) => {
                const isDevList = menuView === 'DEV_MAPS';
                const buttonColor = isDevList
                  ? 'bg-yellow-900/40 hover:bg-yellow-600/20 border-yellow-500/50 hover:border-yellow-400 text-yellow-400'
                  : 'bg-green-900/40 hover:bg-green-600/20 border-green-500/50 hover:border-green-400 text-green-400';
                const accentColor = isDevList ? 'bg-yellow-400/10' : 'bg-green-400/10';

                return (
                  <button
                    key={mapId}
                    onClick={() => handleMapSelect(mapId, isDevList)}
                    className={`group relative px-8 py-3 border hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden ${buttonColor}`}
                  >
                    <div className={`absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ${accentColor}`} />
                    {mapId}
                  </button>
                );
              })}

              <button
                onClick={() => setMenuView('START')}
                className="group relative px-8 py-2 mt-2 bg-gray-900/40 hover:bg-gray-600/20 border border-gray-500/50 hover:border-gray-400 text-gray-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                &lt; Back
              </button>
            </div>
          )}

          {isTopLevelMenuStatus && menuView === 'MULTIPLAYER' && (
            <div className="flex flex-col gap-4 w-full animate-fadeIn">
              <div className="text-center text-sm font-mono text-purple-300">MULTIPLAYER UPLINK</div>

              <div className="text-center text-[10px] font-mono text-purple-300/80">Select host map</div>

              <div className="grid grid-cols-2 gap-2">
                {allMaps.map((mapId) => {
                  const isSelected = selectedMultiplayerMap === mapId;
                  return (
                    <button
                      key={mapId}
                      onClick={() => setSelectedMultiplayerMap(mapId)}
                      className={`px-3 py-2 border font-mono text-xs font-bold uppercase transition-colors ${
                        isSelected
                          ? 'bg-purple-700/30 border-purple-400 text-white'
                          : 'bg-purple-900/20 border-purple-500/40 text-purple-300 hover:border-purple-300 hover:text-white'
                      }`}
                    >
                      {mapId}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={createMultiplayerLobby}
                className="group relative px-8 py-3 bg-purple-900/40 hover:bg-purple-600/20 border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-purple-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Create Lobby (Host)
              </button>

              <div className="text-center text-xs font-mono text-purple-100 border border-purple-500/40 bg-purple-900/20 px-3 py-2">
                Host map: <span className="font-bold tracking-widest text-purple-300">{selectedMultiplayerMap}</span>
                <br />
                Your room code:{' '}
                <span className="font-bold tracking-widest text-purple-300">
                  {isGeneratingRoomCode ? 'Generating...' : (roomId || '----')}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="ENTER ROOM CODE"
                  className="bg-black/50 border border-purple-500/30 text-purple-300 p-3 font-mono text-center outline-none focus:border-purple-500 w-2/3 uppercase"
                />
                <button
                  onClick={joinRoom}
                  className="bg-purple-900/40 hover:bg-purple-600/20 border border-purple-500/50 hover:border-purple-400 text-purple-400 font-mono font-bold w-1/3 transition-colors"
                >
                  JOIN
                </button>
              </div>

              <button
                onClick={() => setMenuView('START')}
                className="group relative px-8 py-2 mt-2 bg-gray-900/40 hover:bg-gray-600/20 border border-gray-500/50 hover:border-gray-400 text-gray-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                &lt; Back
              </button>
            </div>
          )}

          {status === AppStatus.PAUSED && (
            <>
              <button
                onClick={onResume}
                className="group relative px-8 py-3 bg-cyan-900/40 hover:bg-cyan-600/20 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Resume Simulation
              </button>

              {canRestartCurrentMap && (
                <button
                  onClick={onRestartCurrentMap}
                  className="group relative px-8 py-3 bg-amber-900/40 hover:bg-amber-600/20 border border-amber-500/50 hover:border-amber-400 text-amber-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-amber-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  Restart Map
                </button>
              )}

              <button
                onClick={onAbortToMenu}
                className="group relative px-8 py-3 bg-red-900/40 hover:bg-red-600/20 border border-red-500/50 hover:border-red-400 text-red-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                Abort To Main Menu
              </button>
            </>
          )}

          {status === AppStatus.GAME_OVER && (
            <button
              onClick={onAbortToMenu}
              className="group relative px-8 py-3 bg-green-900/40 hover:bg-green-600/20 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-green-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              Main Menu
            </button>
          )}
        </div>

        <div className="text-[10px] text-gray-500 font-mono mt-4 z-10">
          SYSTEM STATUS: {status === AppStatus.PAUSED ? 'SUSPENDED' : isTopLevelMenuStatus ? 'STANDBY' : 'TERMINATED'}
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
