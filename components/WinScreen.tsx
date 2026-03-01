import React from 'react';
import { AppStatus, PlayerId } from '../types';

interface WinScreenProps {
  winner: PlayerId | null;
  myPlayerId: PlayerId | null;
  isMultiplayer: boolean;
  isDevMode: boolean;
  roundNumber: number;
  onRestartCurrentMap: () => void;
  onAbortToMenu: () => void;
}

const WinScreen: React.FC<WinScreenProps> = ({
  winner,
  myPlayerId,
  isMultiplayer,
  isDevMode,
  roundNumber,
  onRestartCurrentMap,
  onAbortToMenu
}) => {
  const canRestartCurrentMap = !isMultiplayer && !isDevMode;
  const isVictory = winner !== null && (!isMultiplayer || myPlayerId === winner);
  const title = isVictory ? 'Victory' : 'Defeat';
  const accentClass = isVictory
    ? 'border-emerald-500/60 text-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.18)]'
    : 'border-red-500/60 text-red-300 shadow-[0_0_35px_rgba(239,68,68,0.18)]';
  const badgeClass = isVictory
    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
    : 'border-red-400/40 bg-red-500/10 text-red-200';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/72 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl border bg-neutral-950/92 p-8 ${accentClass}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-neutral-500">Simulation Ended</div>
            <h1 className="mt-2 text-4xl font-black uppercase tracking-[0.12em]">{title}</h1>
          </div>
          <div className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] ${badgeClass}`}>
            Round {roundNumber}
          </div>
        </div>

        <div className="mb-8 border-l-2 border-neutral-800 pl-4 text-sm leading-6 text-neutral-300">
          {winner ? `${winner} controls the battlefield.` : 'Match terminated.'}
        </div>

        <div className="flex flex-col gap-3">
          {canRestartCurrentMap && (
            <button
              onClick={onRestartCurrentMap}
              className="rounded-xl border border-cyan-500/50 bg-cyan-900/25 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-500/15 hover:text-white"
            >
              Play Again
            </button>
          )}

          <button
            onClick={onAbortToMenu}
            className="rounded-xl border border-neutral-700 bg-neutral-900/70 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default WinScreen;
