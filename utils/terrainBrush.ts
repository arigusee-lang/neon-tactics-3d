import { Position, TerrainTool } from '../types';

export const TERRAIN_BRUSH_MIN = 1;
export const TERRAIN_BRUSH_MAX = 5;

const BRUSH_ENABLED_TOOLS: Set<TerrainTool> = new Set([
    'ELEVATE',
    'LOWER',
    'RAMP',
    'DESTROY',
    'DELETE',
    'SET_P1_SPAWN',
    'SET_P2_SPAWN'
]);

export const isBrushEnabledTerrainTool = (tool?: TerrainTool): boolean => {
    if (!tool) return false;
    return BRUSH_ENABLED_TOOLS.has(tool);
};

export const clampTerrainBrushSize = (size: number): number => {
    return Math.max(TERRAIN_BRUSH_MIN, Math.min(TERRAIN_BRUSH_MAX, size));
};

export const getTerrainBrushFootprint = (centerX: number, centerZ: number, size: number): Position[] => {
    const clampedSize = clampTerrainBrushSize(size);
    const startX = centerX - Math.floor(clampedSize / 2);
    const startZ = centerZ - Math.floor(clampedSize / 2);
    const footprint: Position[] = [];

    for (let dx = 0; dx < clampedSize; dx++) {
        for (let dz = 0; dz < clampedSize; dz++) {
            footprint.push({ x: startX + dx, z: startZ + dz });
        }
    }

    return footprint;
};
