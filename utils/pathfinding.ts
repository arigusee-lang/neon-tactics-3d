
import { Position, TerrainData, MapBounds } from '../types';
import { BOARD_SIZE } from '../constants';
import { canTraverseTerrainEdge } from './terrainTraversal';

interface Node {
  x: number;
  z: number;
  f: number;
  g: number;
  h: number;
  parent: Node | null;
}

export const findPath = (
  start: Position,
  end: Position,
  obstacles: Set<string>, // "x,z" strings
  revealed: Set<string>,
  terrain: Record<string, TerrainData>,
  unitSize: number = 1,
  mapBounds?: MapBounds
): Position[] => {
  const bounds = mapBounds || {
    originX: 0,
    originZ: 0,
    width: BOARD_SIZE,
    height: BOARD_SIZE
  };
  const maxX = bounds.originX + bounds.width;
  const maxZ = bounds.originZ + bounds.height;

  const openList: Node[] = [];
  const openSet: Map<string, Node> = new Map();
  const closedList: Set<string> = new Set();

  const startNode: Node = { ...start, f: 0, g: 0, h: 0, parent: null };
  openList.push(startNode);
  openSet.set(`${startNode.x},${startNode.z}`, startNode);

  while (openList.length > 0) {
    // Sort by lowest F cost (Simple robust way, can be optimized with Heap but this is likely fast enough for N<2000)
    openList.sort((a, b) => a.f - b.f);

    const currentNode = openList.shift()!;
    const currentKey = `${currentNode.x},${currentNode.z}`;
    openSet.delete(currentKey);

    if (currentNode.x === end.x && currentNode.z === end.z) {
      const path: Position[] = [];
      let curr: Node | null = currentNode;
      while (curr) {
        path.push({ x: curr.x, z: curr.z });
        curr = curr.parent;
      }
      return path.reverse().slice(1);
    }

    closedList.add(currentKey);

    const neighbors = [
      { x: currentNode.x + 1, z: currentNode.z },
      { x: currentNode.x - 1, z: currentNode.z },
      { x: currentNode.x, z: currentNode.z + 1 },
      { x: currentNode.x, z: currentNode.z - 1 },
    ];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.z}`;

      // 1. Basic Anchor Boundary Check
      if (neighbor.x < bounds.originX || neighbor.x >= maxX || neighbor.z < bounds.originZ || neighbor.z >= maxZ) continue;

      // 2. Closed List Check
      if (closedList.has(neighborKey)) continue;

      // 3. Footprint Collision Check
      let isBlocked = false;

      for (let i = 0; i < unitSize; i++) {
        for (let j = 0; j < unitSize; j++) {
          const checkX = neighbor.x + i;
          const checkZ = neighbor.z + j;
          const checkKey = `${checkX},${checkZ}`;

          if (checkX < bounds.originX || checkX >= maxX || checkZ < bounds.originZ || checkZ >= maxZ) {
            isBlocked = true;
            break;
          }
          if (!revealed.has(checkKey)) {
            isBlocked = true;
            break;
          }
          if (!terrain[checkKey]) {
            isBlocked = true;
            break;
          }
          if (obstacles.has(checkKey)) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) break;
      }

      if (isBlocked) continue;

      if (unitSize === 1 && !canTraverseTerrainEdge(currentNode, neighbor, terrain)) {
        continue;
      }

      const gScore = currentNode.g + 1;
      let neighborNode = openSet.get(neighborKey);

      if (!neighborNode) {
        neighborNode = {
          x: neighbor.x,
          z: neighbor.z,
          f: 0,
          g: gScore,
          h: Math.abs(neighbor.x - end.x) + Math.abs(neighbor.z - end.z),
          parent: currentNode
        };
        neighborNode.f = neighborNode.g + neighborNode.h;
        openList.push(neighborNode);
        openSet.set(neighborKey, neighborNode);
      } else if (gScore < neighborNode.g) {
        neighborNode.g = gScore;
        neighborNode.f = neighborNode.g + neighborNode.h;
        neighborNode.parent = currentNode;
      }
    }
  }

  return []; // No path found
};
