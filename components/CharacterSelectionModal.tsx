
import React, { useState } from 'react';
import { CHARACTERS, COLORS } from '../constants';
import { Character, PlayerId } from '../types';
import { gameService } from '../services/gameService';

// Avatar image mapping for each character
const AVATAR_IMAGES: Record<string, string> = {
    'NYX': '/nyx_avatar.png',
    'GRIFF': '/griff_avatar.png'
};

const CyberpunkAvatar: React.FC<{ charId: string }> = ({ charId }) => {
    const imageSrc = AVATAR_IMAGES[charId];

    if (imageSrc) {
        return (
            <img
                src={imageSrc}
                alt={charId}
                className="w-full h-full object-cover rounded-full drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]"
            />
        );
    }

    return <div className="text-gray-500 font-mono text-xs">NO_DATA</div>;
};

// Perk Node Component
const PerkNode: React.FC<{ level: number, description: string, active: boolean }> = ({ level, description, active }) => (
    <div className={`relative flex items-start gap-3 mb-6 group ${active ? 'opacity-100' : 'opacity-40'}`}>
        {/* Node Circle */}
        <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono text-[9px] flex-shrink-0 mt-0.5 border ${level === 0 ? 'bg-green-500 text-black border-green-400' : 'bg-black text-gray-500 border-gray-700'}`}>
            {level}
        </div>

        {/* Content Box */}
        <div className="flex-1">
            <div className={`text-[9px] font-bold uppercase tracking-wider leading-none mb-1 ${level === 0 ? 'text-green-400' : 'text-gray-400'}`}>
                LEVEL {level} {level === 0 ? '' : '[LOCKED]'}
            </div>
            <div className="text-[10px] text-gray-400 font-sans leading-snug">
                {description}
            </div>
        </div>

        {/* Connector Line */}
        {level !== 100 && (
            <div className="absolute left-[11px] top-7 bottom-[-20px] w-[1px] bg-gray-800 -z-10 group-hover:bg-gray-700" />
        )}
    </div>
);

const CharacterSelectionModal: React.FC = () => {
    const [selectionStep, setSelectionStep] = useState<PlayerId>(PlayerId.ONE);
    const [selectedCharId, setSelectedCharId] = useState<string | null>(CHARACTERS[0].id);

    const activeCharacter = CHARACTERS.find(c => c.id === selectedCharId);

    const handleConfirm = () => {
        if (!selectedCharId) return;

        gameService.selectCharacter(selectionStep, selectedCharId);

        if (selectionStep === PlayerId.ONE) {
            setSelectionStep(PlayerId.TWO);
            setSelectedCharId(CHARACTERS[0].id);
        } else {
            gameService.enterMapSelection();
        }
    };

    const playerName = selectionStep === PlayerId.ONE ? "PLAYER 1" : "PLAYER 2";

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">

            {/* Main Container */}
            <div className="w-[85vw] max-w-5xl h-[75vh] flex border border-green-500/30 bg-black/80 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl font-mono">

                {/* LEFT: Character List */}
                <div className="w-64 border-r border-gray-800/50 flex flex-col min-w-0">
                    <div className="px-6 py-4 bg-gradient-to-r from-green-900/10 to-transparent border-b border-green-500/20">
                        <div className="text-[9px] font-bold text-green-500/70 uppercase tracking-widest mb-0.5">SELECT AVATAR</div>
                        <h2 className="text-lg font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 tracking-tighter">
                            {playerName}
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {CHARACTERS.map(char => {
                            const isSelected = selectedCharId === char.id;
                            return (
                                <button
                                    key={char.id}
                                    onClick={() => setSelectedCharId(char.id)}
                                    className={`w-full px-6 py-4 text-left border-b border-gray-800/50 transition-all duration-200 group relative overflow-hidden
                                        ${isSelected
                                            ? 'bg-green-900/20 text-white'
                                            : 'bg-transparent text-gray-500 hover:bg-white/5 hover:text-green-300'
                                        }
                                    `}
                                >
                                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />}
                                    <div className="text-xs font-bold uppercase tracking-widest relative z-10">{char.name}</div>
                                    <div className="text-[9px] opacity-50 mt-1 truncate relative z-10">{char.description}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* MIDDLE: Character Details */}
                {activeCharacter && (
                    <div className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-b from-gray-900/20 to-black/40">

                        <div className="flex-1 p-8 flex flex-col items-center justify-center relative z-10">

                            {/* Avatar Circle */}
                            <div className="w-48 h-48 mb-6 relative p-1 rounded-full border border-green-500/20 bg-black/40 shadow-[0_0_30px_rgba(74,222,128,0.1)]">
                                <div className="absolute inset-0 rounded-full border border-dashed border-green-500/20 animate-spin-slow opacity-30" />
                                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-black/60">
                                    <CyberpunkAvatar charId={activeCharacter.id} />
                                </div>
                            </div>

                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 uppercase tracking-tighter mb-2 drop-shadow-lg text-center">
                                {activeCharacter.name}
                            </h1>

                            <div className="w-12 h-0.5 bg-gradient-to-r from-green-500 to-transparent mb-6" />

                            <p className="text-xs text-gray-400 font-sans leading-relaxed text-center max-w-sm border-l-2 border-green-500/30 pl-4">
                                {activeCharacter.description}
                            </p>

                            <div className="mt-auto w-full max-w-xs">
                                <button
                                    onClick={handleConfirm}
                                    className="w-full py-3 rounded bg-green-600 hover:bg-green-500 text-white font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-green-900/20 hover:shadow-green-500/30 active:scale-[0.98]"
                                >
                                    Confirm Selection
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* RIGHT: Perk Tree */}
                {activeCharacter && (
                    <div className="w-72 bg-black/40 border-l border-gray-800/50 flex flex-col backdrop-blur-md">
                        <div className="px-6 py-4 bg-gradient-to-r from-green-900/10 to-transparent border-b border-green-500/20">
                            <div className="text-[9px] font-bold text-green-500/70 uppercase tracking-widest mb-0.5">PROGRESSION</div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                Class Matrix
                            </h2>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                            {activeCharacter.perks.map((perk) => (
                                <PerkNode
                                    key={perk.level}
                                    level={perk.level}
                                    description={perk.description}
                                    active={true}
                                />
                            ))}
                        </div>
                    </div>
                )}

            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
};

export default CharacterSelectionModal;
