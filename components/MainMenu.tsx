
import React, { useState } from 'react';
import { AppStatus } from '../types';
import { gameService } from '../services/gameService';

interface MainMenuProps {
  status: AppStatus;
  onStart: () => void;
  onResume: () => void;
  onRestart: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ status, onStart, onResume, onRestart }) => {
  const [isDevModeChecked, setIsDevModeChecked] = useState(false);
  const [isMultiplayerMenu, setIsMultiplayerMenu] = useState(false);

  // Updated to include CHARACTER_SELECTION in the return null check
  if (status === AppStatus.PLAYING || status === AppStatus.CARD_CATALOGUE || status === AppStatus.CHARACTER_SELECTION) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto">
      <div className="flex flex-col items-center gap-6 p-12 border border-green-500/50 bg-black/70 shadow-[0_0_50px_rgba(0,255,0,0.2)] rounded-xl max-w-md w-full relative overflow-hidden backdrop-blur-sm">

        {/* Decorative Grid Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-cyan-400 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,0,0.5)] z-10 text-center uppercase">
          Neon Tactics
          <span className="block text-sm text-green-500/80 font-mono tracking-[0.5em] mt-2">SIMULATION LINK</span>
        </h1>

        <div className="flex flex-col gap-4 w-full z-10 mt-4">
          {status === AppStatus.MENU && (
            <>
              <button
                onClick={() => gameService.enterCharacterSelection()}
                className="group relative px-8 py-3 bg-green-900/40 hover:bg-green-600/20 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-green-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Initialize System [START]
              </button>

              <button
                onClick={() => gameService.enterCardCatalogue()}
                className="group relative px-8 py-3 bg-cyan-900/40 hover:bg-cyan-600/20 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Cards Catalogue
              </button>

              <button
                onClick={() => setIsMultiplayerMenu(true)}
                className="group relative px-8 py-3 bg-purple-900/40 hover:bg-purple-600/20 border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-purple-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Multiplayer Lobby
              </button>
            </>
          )}

          {isMultiplayerMenu && status === AppStatus.MENU && (
            <div className="flex flex-col gap-4 w-full animate-fadeIn">
              <div className="text-center text-sm font-mono text-purple-300 mb-2">MULTIPLAYER UPLINK</div>

              <button
                onClick={() => gameService.createLobby()}
                className="group relative px-8 py-3 bg-purple-900/40 hover:bg-purple-600/20 border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-purple-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Create Lobby (Host)
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ENTER ROOM CODE"
                  id="roomCodeInput"
                  className="bg-black/50 border border-purple-500/30 text-purple-300 p-3 font-mono text-center outline-none focus:border-purple-500 w-2/3 uppercase"
                />
                <button
                  onClick={() => {
                    const code = (document.getElementById('roomCodeInput') as HTMLInputElement).value;
                    if (code) gameService.joinLobby(code);
                  }}
                  className="bg-purple-900/40 hover:bg-purple-600/20 border border-purple-500/50 hover:border-purple-400 text-purple-400 font-mono font-bold w-1/3 transition-colors"
                >
                  JOIN
                </button>
              </div>

              <button
                onClick={() => setIsMultiplayerMenu(false)}
                className="group relative px-8 py-2 mt-4 bg-gray-900/40 hover:bg-gray-600/20 border border-gray-500/50 hover:border-gray-400 text-gray-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                &lt; BACK
              </button>
            </div>
          )}

          {status === AppStatus.MAP_SELECTION && (
            <>
              <div className="text-center text-sm font-mono text-green-300 mb-2">SELECT BATTLEGROUND</div>

              <button
                onClick={() => gameService.startGame('EMPTY', isDevModeChecked)}
                className="group relative px-8 py-3 bg-green-900/40 hover:bg-green-600/20 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-green-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Standard Field (Empty)
              </button>

              <button
                onClick={() => gameService.startGame('MAP_1', isDevModeChecked)}
                className="group relative px-8 py-3 bg-yellow-900/40 hover:bg-yellow-600/20 border border-yellow-500/50 hover:border-yellow-400 text-yellow-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-yellow-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Map 1
              </button>

              {/* Dev Mode Checkbox */}
              <div className="flex items-center justify-center gap-2 mt-2 cursor-pointer" onClick={() => setIsDevModeChecked(!isDevModeChecked)}>
                <div className={`w-4 h-4 border border-green-500 flex items-center justify-center ${isDevModeChecked ? 'bg-green-500' : 'bg-transparent'}`}>
                  {isDevModeChecked && <span className="text-black font-bold text-xs">✓</span>}
                </div>
                <span className={`text-xs font-mono font-bold uppercase ${isDevModeChecked ? 'text-green-400' : 'text-gray-500'}`}>Dev Mode</span>
              </div>

              <button
                onClick={onRestart}
                className="group relative px-8 py-2 mt-4 bg-gray-900/40 hover:bg-gray-600/20 border border-gray-500/50 hover:border-gray-400 text-gray-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                &lt; BACK
              </button>
            </>
          )}

          {status === AppStatus.PAUSED && (
            <>
              <button
                onClick={onResume}
                className="group relative px-8 py-3 bg-cyan-900/40 hover:bg-cyan-600/20 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Resume Simulation
              </button>

              <button
                onClick={onRestart}
                className="group relative px-8 py-3 bg-red-900/40 hover:bg-red-600/20 border border-red-500/50 hover:border-red-400 text-red-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                Abort & Restart
              </button>
            </>
          )}

          {status === AppStatus.GAME_OVER && (
            <button
              onClick={onRestart}
              className="group relative px-8 py-3 bg-green-900/40 hover:bg-green-600/20 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-white font-mono font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-green-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              New Simulation
            </button>
          )}
        </div>

        <div className="text-[10px] text-gray-500 font-mono mt-4 z-10">
          SYSTEM STATUS: {status === AppStatus.PAUSED ? 'SUSPENDED' : status === AppStatus.MENU || status === AppStatus.MAP_SELECTION ? 'STANDBY' : 'TERMINATED'}
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
