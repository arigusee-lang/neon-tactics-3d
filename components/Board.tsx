
import React, { useState, useEffect } from 'react';
import { TILE_SIZE, TILE_SPACING, BOARD_OFFSET, COLORS, CARD_CONFIG, ELEVATION_HEIGHT } from '../constants';
import { gameService } from '../services/gameService';
import Tile from './Tile';
import { Unit, PlayerId, Position, CardCategory, InteractionState, TerrainData } from '../types';
import { Html } from '@react-three/drei';

interface BoardProps {
  revealedTiles: string[];
  units: Unit[];
  currentTurnPlayerId: PlayerId;
  selectedCardId: string | null;
  selectedUnitId: string | null;
  previewPath: Position[];
  mapId: 'EMPTY' | 'MAP_1';
}

const Board: React.FC<BoardProps> = ({ 
    revealedTiles, 
    units, 
    currentTurnPlayerId, 
    selectedCardId, 
    selectedUnitId,
    previewPath,
    mapId
}) => {
  // Hack to access internal game state for interaction mode via a hook-like pattern 
  const interactionState = (gameService as any).state.interactionState as InteractionState;
  const terrainData = (gameService as any).state.terrain as Record<string, TerrainData>;
  
  const [hoveredTile, setHoveredTile] = useState<Position | null>(null);

  // Helper to find currently selected unit object
  const selectedUnit = selectedUnitId ? units.find(u => u.id === selectedUnitId) : null;

  const getUnitAt = (x: number, z: number): Unit | undefined => {
      return units.find(u => {
          const size = u.stats.size;
          const xMatch = x >= u.position.x && x < u.position.x + size;
          const zMatch = z >= u.position.z && z < u.position.z + size;
          return xMatch && zMatch;
      });
  };

  const handleTileClick = (x: number, z: number) => {
    gameService.handleTileClick(x, z);
  };

  const handleTileHover = (x: number, z: number) => {
    setHoveredTile({ x, z });
    
    // Preview movement only if selecting a unit in NORMAL mode
    if (interactionState.mode === 'NORMAL' && selectedUnitId) {
        const unit = getUnitAt(x, z);
        if (unit && unit.id !== selectedUnitId) {
            gameService.clearPreview();
            return; 
        }
        gameService.previewMove(x, z);
    }
  };

  const handleTileHoverEnd = (x: number, z: number) => {
    setHoveredTile((prev) => {
        if (prev && prev.x === x && prev.z === z) {
            return null;
        }
        return prev;
    });
  };

  // 1. Prepare fast lookup sets
  const revealedSet = new Set(revealedTiles);
  const occupiedSet = new Set<string>();
  units.forEach(u => {
      const size = u.stats.size;
      for(let i=0; i<size; i++) {
          for(let j=0; j<size; j++) {
              occupiedSet.add(`${u.position.x + i},${u.position.z + j}`);
          }
      }
  });

  // Calculate environmental hazards for visual blocking
  if (mapId === 'MAP_1') {
      const worldCX = 0;
      const worldCZ = 15;
      const radius = 3.8;
      const radiusSq = radius * radius;
      const tileStride = TILE_SIZE + TILE_SPACING;

      // We only need to check tiles in the vicinity, but for visual consistency on Board render, 
      // we can just check the tiles we are rendering if they fall into the circle.
      // Or replicate the logic from GameService for consistency.
      
      const gridCX = (worldCX + BOARD_OFFSET) / tileStride;
      const gridCZ = (worldCZ + BOARD_OFFSET) / tileStride;
      const gridRad = radius / tileStride;
      
      const minX = Math.floor(gridCX - gridRad);
      const maxX = Math.ceil(gridCX + gridRad);
      const minZ = Math.floor(gridCZ - gridRad);
      const maxZ = Math.ceil(gridCZ + gridRad);

      for(let x = minX; x <= maxX; x++) {
          for(let z = minZ; z <= maxZ; z++) {
              const wx = (x * tileStride) - BOARD_OFFSET;
              const wz = (z * tileStride) - BOARD_OFFSET;
              const distSq = Math.pow(wx - worldCX, 2) + Math.pow(wz - worldCZ, 2);
              
              if (distSq < radiusSq) {
                  occupiedSet.add(`${x},${z}`);
              }
          }
      }
  }

  // 2. Logic to determine VALIDITY and FOOTPRINT based on Mode
  const placementFootprint = new Set<string>();
  let isPlacementValid = false;
  let isPlacementMode = false;
  let highlightColor = '#ffffff';
  let isTargetingMode = false;

  if (hoveredTile) {
    const { x, z } = hoveredTile;
    const key = `${x},${z}`;
    
    // --- MODE: TERRAIN EDIT ---
    if (interactionState.mode === 'TERRAIN_EDIT') {
        isPlacementMode = true;
        placementFootprint.add(key);
        
        // Cannot modify occupied tiles
        const isValid = !occupiedSet.has(key);
        isPlacementValid = isValid;
        highlightColor = isPlacementValid ? '#ffaa00' : '#ff0000'; // Orange for terrain tool
    }

    // --- MODE: WALL PLACEMENT ---
    else if (interactionState.mode === 'WALL_PLACEMENT' && interactionState.lastPos) {
        isPlacementMode = true;
        placementFootprint.add(key);
        
        // Adjacency Check (Manhattan = 1)
        const dx = Math.abs(x - interactionState.lastPos.x);
        const dz = Math.abs(z - interactionState.lastPos.z);
        const isAdjacent = (dx + dz === 1);
        const isValid = !occupiedSet.has(key) && revealedSet.has(key);

        isPlacementValid = isAdjacent && isValid;
        // Visuals: Blue for valid link
        highlightColor = isPlacementValid ? '#00ffff' : '#ff0000'; 
    }
    
    // --- MODE: SUMMON ABILITY ---
    else if (interactionState.mode === 'ABILITY_SUMMON' && interactionState.sourceUnitId) {
        isPlacementMode = true;
        placementFootprint.add(key);

        const sourceUnit = units.find(u => u.id === interactionState.sourceUnitId);
        
        if (sourceUnit) {
            // Radius Check (Chebyshev = 1)
            const dx = Math.abs(x - sourceUnit.position.x);
            const dz = Math.abs(z - sourceUnit.position.z);
            const inRange = (dx <= 1 && dz <= 1) && !(dx === 0 && dz === 0);
            const isValid = !occupiedSet.has(key) && revealedSet.has(key);

            isPlacementValid = inRange && isValid;
            highlightColor = isPlacementValid ? '#ffff00' : '#ff0000';
        }
    }

    // --- MODE: TELEPORT ABILITY ---
    else if (interactionState.mode === 'ABILITY_TELEPORT') {
        isPlacementMode = true;
        placementFootprint.add(key);
        
        // Global Map Check
        const isValid = !occupiedSet.has(key) && revealedSet.has(key);
        isPlacementValid = isValid;
        highlightColor = isPlacementValid ? '#00ccff' : '#ff0000';
    }

    // --- MODE: FREEZE ABILITY ---
    else if (interactionState.mode === 'ABILITY_FREEZE') {
        isTargetingMode = true;
        isPlacementMode = true;
        placementFootprint.add(key);
        
        const targetUnit = getUnitAt(x, z);
        const isValid = targetUnit && targetUnit.playerId !== interactionState.playerId;
        
        isPlacementValid = !!isValid;
        highlightColor = isPlacementValid ? '#00ffff' : '#ff0000';
    }

    // --- MODE: HEAL ABILITY ---
    else if (interactionState.mode === 'ABILITY_HEAL') {
        isTargetingMode = true;
        isPlacementMode = true;
        placementFootprint.add(key);

        const sourceUnit = units.find(u => u.id === interactionState.sourceUnitId);
        const targetUnit = getUnitAt(x, z);
        
        let isValid = false;
        if (sourceUnit && targetUnit) {
            const dx = Math.abs(sourceUnit.position.x - targetUnit.position.x);
            const dz = Math.abs(sourceUnit.position.z - targetUnit.position.z);
            const inRange = dx <= 2 && dz <= 2;
            const isFriendly = targetUnit.playerId === interactionState.playerId;
            isValid = inRange && isFriendly;
        }

        isPlacementValid = isValid;
        highlightColor = isPlacementValid ? '#00ff00' : '#ff0000';
    }

    // --- MODE: ION CANNON TARGETING ---
    else if (interactionState.mode === 'ION_CANNON_TARGETING') {
        isTargetingMode = true;
        isPlacementMode = true;
        
        // Define 3x3 footprint (1.5 radius effectively)
        for (let ix = -1; ix <= 1; ix++) {
            for (let iz = -1; iz <= 1; iz++) {
                const px = x + ix;
                const pz = z + iz;
                placementFootprint.add(`${px},${pz}`);
            }
        }
        
        // It's always valid to target somewhere (blast happens regardless)
        isPlacementValid = true;
        highlightColor = '#ff4400'; // Orange-Red for danger
    }

    // --- MODE: CARD PLACEMENT (Normal) ---
    else if (selectedCardId && interactionState.mode === 'NORMAL') {
        const card = gameService.getCard(selectedCardId);
        if (card) {
            isPlacementMode = true;
            // Determine footprint
            const size = card.category === CardCategory.ACTION ? 1 : (CARD_CONFIG[card.type]!.baseStats!.size || 1);
            
            for(let i=0; i<size; i++) {
                for(let j=0; j<size; j++) {
                    placementFootprint.add(`${x + i},${z + j}`);
                }
            }

            // Check if ANY part of footprint is invalid
            let valid = true;
            for (const pKey of placementFootprint) {
                if (occupiedSet.has(pKey) || !revealedSet.has(pKey)) {
                    valid = false;
                    break;
                }
            }
            
            isPlacementValid = valid;
            highlightColor = isPlacementValid ? '#00ff00' : '#ff0000';
        }
    }
  }

  // Calculate Attack Validity for highlighting (Normal Mode)
  const getIsAttackable = (x: number, z: number) => {
      if (!selectedUnitId || interactionState.mode !== 'NORMAL') return false;
      const selectedUnit = units.find(u => u.id === selectedUnitId);
      if (!selectedUnit) return false;

      const targetUnit = getUnitAt(x, z);
      if (targetUnit && targetUnit.playerId !== selectedUnit.playerId) {
          const target = targetUnit;
          const attacker = selectedUnit;
          
          // Range Check
          const dx = Math.max(attacker.position.x - (target.position.x + target.stats.size - 1), target.position.x - (attacker.position.x + attacker.stats.size - 1), 0);
          const dz = Math.max(attacker.position.z - (target.position.z + target.stats.size - 1), target.position.z - (attacker.position.z + attacker.stats.size - 1), 0);
          const dist = Math.max(dx, dz);

          if (dist > selectedUnit.stats.range) return false;

          // LOS Check (Replicated simple check for visual feedback)
          const startX = attacker.position.x + attacker.stats.size / 2;
          const startZ = attacker.position.z + attacker.stats.size / 2;
          const endX = target.position.x + target.stats.size / 2;
          const endZ = target.position.z + target.stats.size / 2;

          const rayDx = endX - startX;
          const rayDz = endZ - startZ;
          const rayDist = Math.sqrt(rayDx*rayDx + rayDz*rayDz);
          const steps = Math.ceil(rayDist * 2);

          for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cx = startX + rayDx * t;
            const cz = startZ + rayDz * t;
            const tx = Math.floor(cx);
            const tz = Math.floor(cz);
            
            // Check if this tile is occupied by a blocker
            const blocker = units.find(u => 
                u.stats.blocksLos && 
                u.id !== attacker.id && u.id !== target.id &&
                tx >= u.position.x && tx < u.position.x + u.stats.size &&
                tz >= u.position.z && tz < u.position.z + u.stats.size
            );

            if (blocker) return false; // LOS Blocked
          }

          return true;
      }
      return false;
  };

  return (
    <group>
      {/* Playable Tiles */}
      {revealedTiles.map((key) => {
        const [x, z] = key.split(',').map(Number);
        const worldX = (x * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET;
        const worldZ = (z * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET;
        const terrain = terrainData[key];
        const elevation = terrain?.elevation || 0;
        
        let visualHeight = elevation * ELEVATION_HEIGHT;
        if (terrain?.type === 'RAMP') {
            visualHeight += 0.25; 
        }

        const isOccupied = occupiedSet.has(key);
        
        // --- PATH HIGHLIGHTING (UPDATED FOR UNIT SIZE) ---
        // Check if this tile falls within the footprint of any step in the path
        const selectedUnitSize = selectedUnit?.stats.size || 1;
        const isPath = previewPath.some(p => 
            x >= p.x && x < p.x + selectedUnitSize &&
            z >= p.z && z < p.z + selectedUnitSize
        );
        
        const isAttackTarget = isOccupied && getIsAttackable(x, z);
        
        // Determine if this specific tile is part of the placement footprint
        const isInFootprint = placementFootprint.has(key);
        const showSpecialHighlight = isInFootprint;
        
        // Check Nemesis Status (Auto-Attack Target)
        let isNemesis = false;
        if (selectedUnit?.status.autoAttackTargetId && isOccupied) {
            const unitOnTile = getUnitAt(x, z);
            if (unitOnTile && unitOnTile.id === selectedUnit.status.autoAttackTargetId) {
                isNemesis = true;
            }
        }

        return (
          <React.Fragment key={key}>
            <Tile
                x={x}
                z={z}
                position={[worldX, 0, worldZ]} 
                terrain={terrain}
                onClick={handleTileClick}
                isOccupied={isOccupied}
                onHover={handleTileHover}
                onHoverEnd={handleTileHoverEnd}
                isPlacementHover={showSpecialHighlight || isAttackTarget} 
                isPlacementValid={isTargetingMode ? isPlacementValid : (!isAttackTarget ? isPlacementValid : false)} 
                isAttackTarget={isAttackTarget || (isTargetingMode && isInFootprint)} 
                isNemesis={isNemesis}
            />
            
            {/* Path Highlight Indicator - Adjusted for elevation */}
            {isPath && (
                <mesh position={[worldX, visualHeight + 0.05, worldZ]} rotation={[-Math.PI/2, 0, 0]}>
                    <planeGeometry args={[TILE_SIZE * 0.4, TILE_SIZE * 0.4]} />
                    <meshBasicMaterial color={COLORS.PATH_HIGHLIGHT} opacity={0.5} transparent />
                </mesh>
            )}
            
            {/* Special Highlight Overlay (Color Override) - Adjusted for elevation */}
            {showSpecialHighlight && (
                 <mesh position={[worldX, visualHeight + 0.06, worldZ]} rotation={[-Math.PI/2, 0, 0]}>
                    <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
                    <meshBasicMaterial color={highlightColor} opacity={0.2} transparent />
                 </mesh>
            )}

            {/* Hint for Wall Chain Source */}
            {interactionState.mode === 'WALL_PLACEMENT' && interactionState.lastPos?.x === x && interactionState.lastPos?.z === z && (
                 <mesh position={[worldX, visualHeight + 0.1, worldZ]}>
                    <ringGeometry args={[0.3, 0.4, 4]} />
                    <meshBasicMaterial color="#00ffff" />
                 </mesh>
            )}

          </React.Fragment>
        );
      })}

      {/* Grid Helper - Lowered slightly */}
      <gridHelper 
        args={[200, 100, COLORS.GRID_LINE, COLORS.GRID_LINE]} 
        position={[0, -0.05, 0]} 
        material-transparent={true}
        material-opacity={0.45}
      />
      
      {/* Coordinate Tooltip - Adjusted Height */}
      {hoveredTile && (
        <Html 
            position={[
                (hoveredTile.x * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET, 
                ((terrainData[`${hoveredTile.x},${hoveredTile.z}`]?.elevation || 0) * ELEVATION_HEIGHT) + 0.5, 
                (hoveredTile.z * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET
            ]}
            pointerEvents="none"
        >
            <div className="bg-transparent backdrop-blur-sm text-[10px] text-green-400 font-mono px-1.5 py-0.5 border border-green-600/50 rounded whitespace-nowrap -translate-x-1/2 -translate-y-[150%] shadow-[0_0_5px_rgba(0,0,0,0.5)]">
                [{hoveredTile.x}, {hoveredTile.z}]
            </div>
        </Html>
      )}
    </group>
  );
};

export default Board;
