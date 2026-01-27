
import React from 'react';
import { Talent } from '../types';

interface TalentSelectionModalProps {
    choices: Talent[];
    onSelect: (talent: Talent) => void;
}

const TalentSelectionModal: React.FC<TalentSelectionModalProps> = ({ choices, onSelect }) => {
    if (choices.length === 0) return null;

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
            <div className="text-center mb-8 relative">
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-500 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(0,255,0,0.8)]">
                    System Upgrade Available
                </h2>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-green-500/50 mt-2 shadow-[0_0_10px_#00ff00]" />
                <p className="text-green-400 font-mono text-xs mt-4 tracking-[0.2em] animate-pulse">SELECT AUGMENTATION PROTOCOL</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-center justify-center w-full max-w-6xl flex-wrap">
                {choices.map((talent, i) => (
                    <div 
                        key={talent.id}
                        onClick={() => onSelect(talent)}
                        className="group relative w-64 h-80 bg-black/80 border border-green-500/30 hover:border-green-400 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,255,0,0.3)] flex flex-col"
                    >
                        {/* Scanline Overlay */}
                        <div className="absolute inset-0 pointer-events-none opacity-10" style={{ 
                            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                            backgroundSize: '100% 2px, 3px 100%'
                        }} />

                        {/* Card Header */}
                        <div className="h-10 bg-green-900/20 border-b border-green-500/30 flex items-center justify-between px-3">
                            <span className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-wider">{talent.name}</span>
                            <span className="text-[9px] font-mono text-green-600">v1.0.{i+1}</span>
                        </div>

                        {/* Image Placeholder area */}
                        <div 
                            className="flex-1 flex items-center justify-center relative overflow-hidden bg-black"
                        >
                            {/* Grid Background */}
                            <div className="absolute inset-0 opacity-20" style={{ 
                                backgroundImage: `linear-gradient(${talent.color}33 1px, transparent 1px), linear-gradient(90deg, ${talent.color}33 1px, transparent 1px)`,
                                backgroundSize: '20px 20px'
                            }} />
                            
                            {/* Icon Glow Container */}
                            <div className="relative w-24 h-24 flex items-center justify-center rounded-full border border-dashed border-gray-700 group-hover:border-green-400/50 transition-colors duration-300">
                                <div className="absolute inset-0 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: talent.color }} />
                                <div className="text-5xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] z-10 transition-transform duration-300 group-hover:scale-110">
                                    {talent.icon}
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="p-4 bg-black border-t border-green-500/30 h-28 flex flex-col justify-between relative">
                            {/* Corner Accents */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-green-500/60" />
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-500/60" />
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-500/60" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-green-500/60" />

                            <p className="text-[10px] text-gray-400 font-mono leading-relaxed text-center group-hover:text-gray-200 transition-colors">
                                {talent.description}
                            </p>
                            <div className="text-center mt-2">
                                <span className="text-[9px] text-green-500/80 font-bold uppercase tracking-widest group-hover:text-green-400 group-hover:underline decoration-green-500/50 underline-offset-4 transition-all">
                                    [INITIALIZE]
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TalentSelectionModal;
