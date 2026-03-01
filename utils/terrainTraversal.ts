import { Position, TerrainData } from '../types';

export type EdgeDirection = 'N' | 'E' | 'S' | 'W';

const getOppositeDirection = (direction: EdgeDirection): EdgeDirection => {
    switch (direction) {
        case 'N': return 'S';
        case 'E': return 'W';
        case 'S': return 'N';
        case 'W': return 'E';
    }
};

export const getStepDirection = (from: Position, to: Position): EdgeDirection | null => {
    const dx = to.x - from.x;
    const dz = to.z - from.z;

    if (Math.abs(dx) + Math.abs(dz) !== 1) {
        return null;
    }

    if (dx === 1) return 'E';
    if (dx === -1) return 'W';
    if (dz === 1) return 'S';
    return 'N';
};

const getRampHighSide = (rotation: number): EdgeDirection => {
    switch (((rotation % 4) + 4) % 4) {
        case 1: return 'E';
        case 2: return 'S';
        case 3: return 'W';
        case 0:
        default:
            return 'N';
    }
};

const getTileEdgeHeight = (tile: TerrainData | undefined, direction: EdgeDirection): number | null => {
    if (!tile) {
        return null;
    }

    if (tile.type !== 'RAMP') {
        return tile.elevation;
    }

    const highSide = getRampHighSide(tile.rotation || 0);
    const lowSide = getOppositeDirection(highSide);

    if (direction === highSide) {
        return tile.elevation + 1;
    }

    if (direction === lowSide) {
        return tile.elevation;
    }

    return null;
};

export const canTraverseTerrainEdge = (
    from: Position,
    to: Position,
    terrain: Record<string, TerrainData>
): boolean => {
    const direction = getStepDirection(from, to);
    if (!direction) {
        return false;
    }

    const fromTile = terrain[`${from.x},${from.z}`];
    const toTile = terrain[`${to.x},${to.z}`];
    const fromExitHeight = getTileEdgeHeight(fromTile, direction);
    const toEntryHeight = getTileEdgeHeight(toTile, getOppositeDirection(direction));

    return fromExitHeight !== null && toEntryHeight !== null && fromExitHeight === toEntryHeight;
};
