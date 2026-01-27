
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Unit, PlayerId, TerrainData } from '../types';
import { BOARD_SIZE, COLORS, CARD_CONFIG } from '../constants';

interface MinimapProps {
    units: Unit[];
    revealedTiles: string[];
    terrain: Record<string, TerrainData>;
}

const Minimap: React.FC<MinimapProps> = ({ units, revealedTiles, terrain }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isMinimized, setIsMinimized] = useState(true);
    const [zoom, setZoom] = useState(6); // Pixels per tile
    const [tooltip, setTooltip] = useState<{ unit: Unit, x: number, y: number } | null>(null);

    const revealedSet = useMemo(() => new Set(revealedTiles), [revealedTiles]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate dimensions
        const size = BOARD_SIZE * zoom;
        canvas.width = size;
        canvas.height = size;

        // Draw Revealed Terrain
        revealedTiles.forEach(key => {
            const [x, z] = key.split(',').map(Number);
            const tileData = terrain[key];

            // Color logic for landing zones
            if (tileData?.landingZone === PlayerId.ONE) {
                ctx.fillStyle = '#004f5f'; // Dark Cyan for P1 Zone
            } else if (tileData?.landingZone === PlayerId.TWO) {
                ctx.fillStyle = '#5f002f'; // Dark Pink for P2 Zone
            } else {
                ctx.fillStyle = '#113311'; // Default Dark Green
            }

            ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        });

        // Draw Units
        units.forEach(unit => {
            const x = unit.position.x;
            const z = unit.position.z;
            const size = unit.stats.size;
            
            // Determine Color
            let color = '#888888';
            if (unit.playerId === PlayerId.ONE) color = COLORS.P1;
            if (unit.playerId === PlayerId.TWO) color = COLORS.P2;
            if (unit.type === 'WALL') color = '#00ff00'; // Walls specifically bright green

            ctx.fillStyle = color;
            
            // Draw unit footprint
            const pad = zoom > 4 ? 1 : 0;
            ctx.fillRect((x * zoom) + pad, (z * zoom) + pad, (size * zoom) - pad*2, (size * zoom) - pad*2);
        });

    }, [units, revealedTiles, zoom, revealedSet, terrain]);

    const handleZoom = (delta: number) => {
        setZoom(prev => Math.max(2, Math.min(12, prev + delta)));
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert mouse position to grid coordinates
        const gridX = Math.floor(mouseX / zoom);
        const gridZ = Math.floor(mouseY / zoom);

        // Find if a unit occupies this tile
        // Check standard collision: x <= gridX < x + size
        const foundUnit = units.find(u => {
            const size = u.stats.size;
            return (
                gridX >= u.position.x && gridX < u.position.x + size &&
                gridZ >= u.position.z && gridZ < u.position.z + size
            );
        });

        if (foundUnit) {
            setTooltip({
                unit: foundUnit,
                x: e.clientX,
                y: e.clientY
            });
        } else {
            setTooltip(null);
        }
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

    return (
        <div 
            className={`rounded-xl border border-green-500/60 shadow-[0_0_20px_rgba(0,255,0,0.1)] overflow-hidden transition-all duration-300 flex flex-col bg-black/40 ${isMinimized ? 'h-10 flex-none' : 'h-64 flex-none'}`}
        >
            <div 
                className="flex items-center justify-between px-4 py-2 bg-black/40 hover:bg-black/60 border-b border-green-500/30 flex-none h-10 select-none cursor-pointer"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-4">
                    <h2 className="text-xs font-bold text-white uppercase tracking-widest drop-shadow-md">
                        Tactical Map
                    </h2>
                    
                    {!isMinimized && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                                onClick={() => handleZoom(-2)}
                                className="w-5 h-5 flex items-center justify-center border border-green-700 bg-green-900/30 text-green-400 text-[10px] hover:bg-green-700/50 rounded"
                            >
                                -
                            </button>
                            <button 
                                onClick={() => handleZoom(2)}
                                className="w-5 h-5 flex items-center justify-center border border-green-700 bg-green-900/30 text-green-400 text-[10px] hover:bg-green-700/50 rounded"
                            >
                                +
                            </button>
                        </div>
                    )}
                </div>
                <span className="font-mono text-[10px] text-green-300">{isMinimized ? '[+]' : '[-]'}</span>
            </div>

            <div className={`p-2 flex-1 overflow-auto flex items-center justify-center bg-transparent ${isMinimized ? 'hidden' : 'block'}`}>
                {/* Scrollable Container */}
                <div className="relative border border-green-900/50 bg-black/20 shadow-inner">
                    <canvas 
                        ref={canvasRef} 
                        className="block image-pixelated cursor-crosshair" 
                        style={{ imageRendering: 'pixelated' }} 
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    />
                </div>
            </div>

            {/* Tooltip Portal */}
            {tooltip && createPortal(
                <div 
                    className="fixed z-[100] bg-black/95 border p-2 rounded text-[9px] font-mono shadow-[0_0_15px_rgba(0,0,0,0.8)] whitespace-nowrap backdrop-blur-md pointer-events-none transform -translate-y-full -translate-x-1/2 mt-[-8px]"
                    style={{ 
                        left: tooltip.x, 
                        top: tooltip.y,
                        borderColor: tooltip.unit.playerId === PlayerId.ONE ? COLORS.P1 : tooltip.unit.playerId === PlayerId.TWO ? COLORS.P2 : '#888'
                    }}
                >
                    <div className="font-bold text-white uppercase mb-0.5" style={{ color: tooltip.unit.playerId === PlayerId.ONE ? COLORS.P1 : tooltip.unit.playerId === PlayerId.TWO ? COLORS.P2 : '#aaa' }}>
                        {CARD_CONFIG[tooltip.unit.type]?.name || tooltip.unit.type}
                    </div>
                    <div className="flex gap-2 text-gray-400">
                         <span>HP: <span className="text-white">{tooltip.unit.stats.hp}</span></span>
                         {tooltip.unit.stats.movement > 0 && <span>MOV: <span className="text-white">{tooltip.unit.stats.movement - tooltip.unit.status.stepsTaken}</span></span>}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Minimap;
