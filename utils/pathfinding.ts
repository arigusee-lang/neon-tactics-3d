
import { Position, TerrainData } from '../types';
import { BOARD_SIZE } from '../constants';

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
  unitSize: number = 1
): Position[] => {
  const openList: Node[] = [];
  const closedList: Set<string> = new Set();

  const startNode: Node = { ...start, f: 0, g: 0, h: 0, parent: null };
  openList.push(startNode);

  while (openList.length > 0) {
    // Sort by lowest F cost
    openList.sort((a, b) => a.f - b.f);
    const currentNode = openList.shift()!;
    const currentKey = `${currentNode.x},${currentNode.z}`;

    if (currentNode.x === end.x && currentNode.z === end.z) {
      const path: Position[] = [];
      let curr: Node | null = currentNode;
      while (curr) {
        path.push({ x: curr.x, z: curr.z });
        curr = curr.parent;
      }
      // Return path from start (excluding start itself) to end
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
      if (neighbor.x < 0 || neighbor.x >= BOARD_SIZE || neighbor.z < 0 || neighbor.z >= BOARD_SIZE) continue;
      
      // 2. Closed List Check (Optimized to check anchor only)
      if (closedList.has(neighborKey)) continue;

      // 3. Footprint Collision Check
      // We must ensure every tile the unit would occupy at this position is valid and empty
      let isBlocked = false;
      
      for(let i = 0; i < unitSize; i++) {
          for(let j = 0; j < unitSize; j++) {
              const checkX = neighbor.x + i;
              const checkZ = neighbor.z + j;
              const checkKey = `${checkX},${checkZ}`;

              // Check Map Boundaries for footprint
              if (checkX >= BOARD_SIZE || checkZ >= BOARD_SIZE) {
                  isBlocked = true;
                  break;
              }

              // Check Fog of War (Must be revealed)
              if (!revealed.has(checkKey)) {
                  isBlocked = true;
                  break;
              }

              // Check Obstacles
              // Note: We allow the 'end' footprint to be processed if the pathfinder logic requires it,
              // but in this game, units move to empty tiles. 
              // We don't skip obstacle check for 'end' because you can't move ONTO an enemy.
              if (obstacles.has(checkKey)) {
                  isBlocked = true;
                  break;
              }
          }
          if (isBlocked) break;
      }

      if (isBlocked) continue;

      const gScore = currentNode.g + 1;
      let neighborNode = openList.find(n => n.x === neighbor.x && n.z === neighbor.z);

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
      } else if (gScore < neighborNode.g) {
        neighborNode.g = gScore;
        neighborNode.f = neighborNode.g + neighborNode.h;
        neighborNode.parent = currentNode;
      }
    }
  }

  return []; // No path found
};
