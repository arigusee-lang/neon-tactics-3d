
import React, { useState } from 'react';
import { TerrainTool } from '../types';
import { gameService } from '../services/gameService';

interface MapEditorProps {
    activeTool?: TerrainTool;
}

const MapEditor: React.FC<MapEditorProps> = ({ activeTool }) => {
    const [isMinimized, setIsMinimized] = useState(true);

    const tools: { id: TerrainTool, label: string, icon: React.ReactNode }[] = [
        { 
            id: 'ELEVATE', 
            label: 'Elevate', 
            icon: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
                    <path d="M12 4V20 M5 11L12 4L19 11 M5 20H19" />
                </svg>
            )
        },
        { 
            id: 'LOWER', 
            label: 'Lower', 
            icon: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
                    <path d="M12 20V4 M19 13L12 20L5 13 M5 4H19" />
                </svg>
            )
        },
        { 
            id: 'RAMP', 
            label: 'Tilt', 
            icon: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
                    <path d="M4 20L20 4V20H4Z" />
                </svg>
            )
        },
        { 
            id: 'DESTROY', 
            label: 'Flatten', 
            icon: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
                    <path d="M18 6L6 18 M6 6L18 18" />
                </svg>
            )
        },
        {
            id: 'SET_P1_SPAWN',
            label: 'P1 Zone',
            icon: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
                    <rect x="4" y="4" width="16" height="16" strokeDasharray="4 2" />
                    <text x="12" y="16" fontSize="10" textAnchor="middle" fill="currentColor" stroke="none">P1</text>
                </svg>
            )
        },
        {
            id: 'SET_P2_SPAWN',
            label: 'P2 Zone',
            icon: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
                    <rect x="4" y="4" width="16" height="16" strokeDasharray="4 2" />
                    <text x="12" y="16" fontSize="10" textAnchor="middle" fill="currentColor" stroke="none">P2</text>
                </svg>
            )
        }
    ];

    const handleSelect = (toolId: TerrainTool) => {
        gameService.selectTerrainTool(toolId);
    };

    return (
        <div 
            className={`rounded-xl border border-yellow-500/60 shadow-[0_0_20px_rgba(255,200,0,0.1)] overflow-hidden transition-all duration-300 flex flex-col bg-black/40 ${isMinimized ? 'h-10 flex-none' : 'h-64 flex-none'}`}
        >
            <div 
                className="flex items-center justify-between px-4 py-2 bg-black/40 hover:bg-black/60 border-b border-yellow-500/30 flex-none h-10 select-none cursor-pointer"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <h2 className="text-xs font-bold text-yellow-500 uppercase tracking-widest drop-shadow-md">
                    Map Editor <span className="font-mono text-[10px] ml-2 text-white">[DEV MODE]</span>
                </h2>
                <span className="font-mono text-[10px] text-yellow-300 ml-2">{isMinimized ? '[+]' : '[-]'}</span>
            </div>

            <div className={`p-4 pb-6 flex-1 overflow-y-auto bg-transparent ${isMinimized ? 'hidden' : 'block'}`}>
                 <div className="grid grid-cols-2 gap-3 h-full">
                    {tools.map(tool => {
                        const isActive = activeTool === tool.id;
                        return (
                            <button
                                key={tool.id}
                                onClick={() => handleSelect(tool.id)}
                                className={`flex flex-col items-center justify-center w-full h-full min-h-[4rem] rounded border transition-all duration-200 group
                                    ${isActive 
                                        ? 'bg-yellow-900/40 border-yellow-400 text-yellow-400 shadow-[0_0_10px_rgba(255,200,0,0.4)]' 
                                        : 'bg-black/40 border-yellow-900/60 text-yellow-700 hover:border-yellow-600 hover:text-yellow-500'
                                    }
                                `}
                            >
                                <div className="mb-1">{tool.icon}</div>
                                <span className="text-[9px] font-bold uppercase text-center leading-tight px-1">{tool.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MapEditor;
