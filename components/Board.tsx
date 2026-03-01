
import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TILE_SIZE, TILE_SPACING, BOARD_OFFSET, COLORS, CARD_CONFIG, ELEVATION_HEIGHT } from '../constants';
import { gameService } from '../services/gameService';
import Tile from './Tile';
import { Unit, PlayerId, Position, CardCategory, InteractionState, TerrainData, Collectible, MapBounds, TilePulse } from '../types';
import { Html } from '@react-three/drei';
import { clampTerrainBrushSize, getTerrainBrushFootprint, isBrushEnabledTerrainTool } from '../utils/terrainBrush';
import * as THREE from 'three';

interface BoardProps {
    revealedTiles: string[];
    units: Unit[];
    currentTurnPlayerId: PlayerId;
    selectedCardId: string | null;
    selectedUnitId: string | null;
    previewPath: Position[];
    mapId: string;
    collectibles: Collectible[];
    mapBounds: MapBounds;
}

const DollarSignModel: React.FC = () => {
    const groupRef = useRef<any>(null);
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.02;
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
        }
    });

    const material = <meshStandardMaterial color="#22c55e" emissive="#4ade80" emissiveIntensity={0.6} roughness={0.2} metalness={0.8} />;

    return (
        <group ref={groupRef}>
            {/* Vertical Line */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.08, 0.8, 0.08]} />
                {material}
            </mesh>
            {/* Top Bar */}
            <mesh position={[0, 0.32, 0]}>
                <boxGeometry args={[0.4, 0.08, 0.08]} />
                {material}
            </mesh>
            {/* Middle Bar */}
            <mesh position={[0, 0, 0.02]}>
                <boxGeometry args={[0.4, 0.08, 0.08]} />
                {material}
            </mesh>
            {/* Bottom Bar */}
            <mesh position={[0, -0.32, 0]}>
                <boxGeometry args={[0.4, 0.08, 0.08]} />
                {material}
            </mesh>
            {/* Top Left Vertical */}
            <mesh position={[-0.16, 0.16, 0]}>
                <boxGeometry args={[0.08, 0.32, 0.08]} />
                {material}
            </mesh>
            {/* Bottom Right Vertical */}
            <mesh position={[0.16, -0.16, 0]}>
                <boxGeometry args={[0.08, 0.32, 0.08]} />
                {material}
            </mesh>
        </group>
    );
};

const HealthPackModel: React.FC = () => {
    const groupRef = useRef<any>(null);
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.5;
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
        }
    });

    const material = <meshStandardMaterial color="#ef4444" emissive="#f87171" emissiveIntensity={0.6} roughness={0.2} metalness={0.8} />;

    return (
        <group ref={groupRef}>
            {/* Cross Box Vertical */}
            <mesh>
                <boxGeometry args={[0.2, 0.6, 0.2]} />
                {material}
            </mesh>
            {/* Cross Box Horizontal */}
            <mesh>
                <boxGeometry args={[0.6, 0.2, 0.2]} />
                {material}
            </mesh>
            {/* Center Glow */}
            <pointLight distance={1} intensity={1} color="#ef4444" />
        </group>
    );
}

const EnergyCellModel: React.FC = () => {
    const groupRef = useRef<any>(null);
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.05;
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.1;
        }
    });

    const material = <meshStandardMaterial color="#a855f7" emissive="#c084fc" emissiveIntensity={0.8} roughness={0.2} metalness={0.9} />;

    return (
        <group ref={groupRef}>
            {/* Lightning Bolt Shape (Simulated with tilted boxes) */}
            <mesh rotation={[0, 0, 0.5]} position={[0.1, 0.2, 0]}>
                <boxGeometry args={[0.15, 0.5, 0.15]} />
                {material}
            </mesh>
            <mesh rotation={[0, 0, 0.5]} position={[-0.1, -0.2, 0]}>
                <boxGeometry args={[0.15, 0.5, 0.15]} />
                {material}
            </mesh>
            {/* Connecting Spark */}
            <mesh rotation={[0, 0, -0.5]}>
                <boxGeometry args={[0.1, 0.2, 0.1]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
        </group>
    );
}

const TilePulseEffect: React.FC<{ position: [number, number, number]; kind: 'SABOTAGE'; }> = ({ position, kind }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const startTimeRef = useRef<number | null>(null);

    useFrame((state) => {
        if (startTimeRef.current === null) {
            startTimeRef.current = state.clock.elapsedTime;
        }

        const elapsed = state.clock.elapsedTime - (startTimeRef.current || state.clock.elapsedTime);
        const progress = Math.min(elapsed / 0.85, 1);

        if (ringRef.current) {
            ringRef.current.scale.setScalar(0.7 + (progress * 1.8));
            const material = ringRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = (1 - progress) * 0.75;
        }

        if (labelRef.current) {
            labelRef.current.style.opacity = `${1 - progress}`;
            labelRef.current.style.transform = `translateY(${-progress * 18}px) scale(${1 + ((1 - progress) * 0.06)})`;
        }
    });

    const color = kind === 'SABOTAGE' ? '#ef4444' : '#ffffff';
    const label = kind === 'SABOTAGE' ? 'ZONE DISABLED' : 'PULSE';

    return (
        <group position={position}>
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.35, 0.62, 24]} />
                <meshBasicMaterial color={color} transparent opacity={0.75} side={THREE.DoubleSide} />
            </mesh>
            <pointLight position={[0, 0.35, 0]} color={color} intensity={2.4} distance={2.6} decay={2} />
            <Html position={[0, 0.45, 0]} center pointerEvents="none">
                <div
                    ref={labelRef}
                    className="rounded border border-red-400/70 bg-red-500/15 px-2 py-0.5 text-[10px] font-black tracking-[0.18em] text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.35)] backdrop-blur-sm"
                    style={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
                >
                    {label}
                </div>
            </Html>
        </group>
    );
};

const Board: React.FC<BoardProps> = ({
    revealedTiles,
    units,
    currentTurnPlayerId,
    selectedCardId,
    selectedUnitId,
    previewPath,
    mapId,
    collectibles,
    mapBounds
}) => {
    // Hack to access internal game state for interaction mode via a hook-like pattern 
    const interactionState = (gameService as any).state.interactionState as InteractionState;
    const terrainData = (gameService as any).state.terrain as Record<string, TerrainData>;
    const tilePulse = (gameService as any).state.tilePulse as TilePulse | null;

    const [hoveredTile, setHoveredTile] = useState<Position | null>(null);

    // Helper to find currently selected unit object
    const selectedUnit = selectedUnitId ? units.find(u => u.id === selectedUnitId) : null;

    const unitByCell = React.useMemo(() => {
        const map = new Map<string, Unit>();
        units.forEach(u => {
            const size = u.stats.size;
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    map.set(`${u.position.x + i},${u.position.z + j}`, u);
                }
            }
        });
        return map;
    }, [units]);

    const getUnitAt = React.useCallback((x: number, z: number): Unit | undefined => {
        return unitByCell.get(`${x},${z}`);
    }, [unitByCell]);

    const handleTileClick = React.useCallback((x: number, z: number, pointer?: { source: 'TILE'; eventType?: string; button?: number; pointerType?: string; clientX?: number; clientY?: number; }) => {
        gameService.handleTileClick(x, z, pointer);
    }, []);

    const handleTileHover = React.useCallback((x: number, z: number) => {
        setHoveredTile({ x, z });
        gameService.setDebugHoverTile({ x, z });

        // Preview movement only if selecting a unit in NORMAL mode
        // NOTE: We need access to current interactionStateRef and selectedUnitId.
        // Since callbacks with dependencies might cause frequent updates breaking memo,
        // we should check if these are stable enough or use refs if performance is critical.
        // For now, we include dependencies which will update all tiles when selectedUnit changes.
        // Ideally we would pass just ids to tile and let tile call a service method, but tile is dump.
        // Actually, Board is re-rendered when selectedUnitId changes anyway.
        // BUT, handleTileHover calls methods on gameService which might not depend on state closure if implemented correctly.
        // However, the logic below DEPENDS on interactionState from props (or the hack).

        // Let's rely on the props passed to Board being refreshed.
        gameService.previewMove(x, z);
        // Note: Logic for "only if selecting a unit" is inside GameService.previewMove mostly, 
        // but here we had some early exit logic. We'll simplify:
        // The original logic checked interactionState.mode.
        // We will just call the service. The service should handle "is this a valid preview?" logic ideally.
        // But to keep behavior identical:

        // We can't access value of `interactionState` inside a useCallback unless we depend on it.
        // If we depend on it, we break memoization when interactionState changes (which is fine).
        // But on HOVER, interactionState usually doesn't change, just previewPath changes.
    }, []);

    // Wait, the original hover logic accessed 'interactionState' and 'selectedUnitId'.
    // If we useCallback with [interactionState, selectedUnitId], it changes when those change.
    // That is acceptable. The critical thing is it DOES NOT change when just 'previewPath' or 'hoveredTile' changes.
    // But wait, setHoveredTile triggers re-render of Board.
    // If we make handleTileHover stable, Render 1 (hover update) -> Board Render -> Tile props same -> Tile doesn't render.
    // EXCEPT: Tile props include 'onHover'. If 'onHover' changes, Tile re-renders.
    // So handleTileHover MUST be stable.

    // To make it truly stable despite dependency on 'interactionState', we can use a Ref for current state access, or just acknowledge that
    // when mode changes, all tiles re-render (fine).
    // When selection changes, all tiles re-render (fine).
    // When MOUSE MOVES -> handleTileHover is called -> state updates -> Board re-renders.
    // We need onHover to NOT change during mouse moves.

    // The implementation below uses the closure variables. To fix this, we need them in deps.

    const handleTileHoverEnd = React.useCallback((x: number, z: number) => {
        setHoveredTile((prev) => {
            if (prev && prev.x === x && prev.z === z) {
                gameService.setDebugHoverTile(null);
                return null;
            }
            return prev;
        });
    }, []);

    // 1. Prepare fast lookup sets
    const revealedSet = new Set(revealedTiles);

    // Path Set for O(1) lookup
    const pathSet = React.useMemo(() => {
        const s = new Set<string>();
        // Check for unit size? 
        // The previous logic was: "Check if this tile falls within the footprint of any step in the path"
        // "previewPath" is a list of top-left positions for the unit.
        // If unit size > 1, we need to mark all tiles covered by the unit at each step.
        const unitSize = selectedUnit?.stats.size || 1;

        previewPath.forEach(pos => {
            for (let i = 0; i < unitSize; i++) {
                for (let j = 0; j < unitSize; j++) {
                    s.add(`${pos.x + i},${pos.z + j}`);
                }
            }
        });
        return s;
    }, [previewPath, selectedUnit]);

    const occupiedSet = new Set<string>();
    units.forEach(u => {
        const size = u.stats.size;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
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

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                if (x < mapBounds.originX || x >= mapBounds.originX + mapBounds.width) continue;
                if (z < mapBounds.originZ || z >= mapBounds.originZ + mapBounds.height) continue;
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
            const brushSize = isBrushEnabledTerrainTool(interactionState.terrainTool)
                ? clampTerrainBrushSize(interactionState.terrainBrushSize ?? 1)
                : 1;

            const brushFootprint = getTerrainBrushFootprint(x, z, brushSize);
            let validTiles = 0;

            brushFootprint.forEach((pos) => {
                const footprintKey = `${pos.x},${pos.z}`;
                placementFootprint.add(footprintKey);
                if (!revealedSet.has(footprintKey)) return;
                if (occupiedSet.has(footprintKey)) return;
                validTiles++;
            });

            isPlacementValid = validTiles > 0;
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

        // --- MODE: FORWARD BASE TARGETING ---
        else if (interactionState.mode === 'FORWARD_BASE_TARGETING') {
            isTargetingMode = true;
            isPlacementMode = true;

            // 2x2 Footprint
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 2; j++) {
                    placementFootprint.add(`${x + i},${z + j}`);
                }
            }

            // Validity Check
            let valid = true;
            // Hacky way to check enemy ID since we don't assume generic 2 player always but PlayerId is enum
            const enemyId = interactionState.playerId === PlayerId.ONE ? PlayerId.TWO : PlayerId.ONE;

            for (const pKey of placementFootprint) {
                // Must be revealed
                if (!revealedSet.has(pKey)) {
                    valid = false;
                    break;
                }
                // Must not be enemy zone
                const t = terrainData[pKey];
                if (t && t.landingZone === enemyId) {
                    valid = false;
                    break;
                }
            }

            isPlacementValid = valid;
            highlightColor = isPlacementValid ? '#00ff00' : '#ff0000';
        }

        // --- MODE: CARD PLACEMENT (Normal) ---
        else if (selectedCardId && interactionState.mode === 'NORMAL') {
            const card = gameService.getCard(selectedCardId);
            if (card) {
                isPlacementMode = true;
                // Determine footprint
                const size = card.category === CardCategory.ACTION ? 1 : (CARD_CONFIG[card.type]!.baseStats!.size || 1);

                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
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

    const attackableSet = React.useMemo(() => {
        const set = new Set<string>();
        if (interactionState.mode !== 'NORMAL' || !selectedUnit) return set;

        const attacker = selectedUnit;

        for (const target of units) {
            if (target.playerId === attacker.playerId) continue;

            // Range Check
            const dx = Math.max(
                attacker.position.x - (target.position.x + target.stats.size - 1),
                target.position.x - (attacker.position.x + attacker.stats.size - 1),
                0
            );
            const dz = Math.max(
                attacker.position.z - (target.position.z + target.stats.size - 1),
                target.position.z - (attacker.position.z + attacker.stats.size - 1),
                0
            );
            const dist = Math.max(dx, dz);
            if (dist > attacker.stats.range) continue;

            // LOS Check
            const startX = attacker.position.x + attacker.stats.size / 2;
            const startZ = attacker.position.z + attacker.stats.size / 2;
            const endX = target.position.x + target.stats.size / 2;
            const endZ = target.position.z + target.stats.size / 2;
            const rayDx = endX - startX;
            const rayDz = endZ - startZ;
            const rayDist = Math.sqrt(rayDx * rayDx + rayDz * rayDz);
            const steps = Math.ceil(rayDist * 2);

            let isBlocked = false;
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const cx = startX + rayDx * t;
                const cz = startZ + rayDz * t;
                const tx = Math.floor(cx);
                const tz = Math.floor(cz);
                const blocker = unitByCell.get(`${tx},${tz}`);

                if (blocker && blocker.stats.blocksLos && blocker.id !== attacker.id && blocker.id !== target.id) {
                    isBlocked = true;
                    break;
                }
            }
            if (isBlocked) continue;

            for (let i = 0; i < target.stats.size; i++) {
                for (let j = 0; j < target.stats.size; j++) {
                    set.add(`${target.position.x + i},${target.position.z + j}`);
                }
            }
        }

        return set;
    }, [interactionState.mode, selectedUnit, units, unitByCell]);

    const tileStride = TILE_SIZE + TILE_SPACING;
    const gridDivisions = Math.max(1, Math.max(mapBounds.width, mapBounds.height));
    const gridSize = Math.max(tileStride, tileStride * gridDivisions);
    const gridCenterX = ((mapBounds.originX + ((mapBounds.width - 1) / 2)) * tileStride) - BOARD_OFFSET;
    const gridCenterZ = ((mapBounds.originZ + ((mapBounds.height - 1) / 2)) * tileStride) - BOARD_OFFSET;

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


                const isPath = pathSet.has(key);
                const isAttackTarget = attackableSet.has(key);

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
                            isPath={isPath && !isOccupied && !isAttackTarget} // Don't highlight path if occupied (unless we want to?) - user said "highlight smaller yellow square in each tile of path"
                        // Actually original logic didn't care about occupied, but path shouldn't overlap obstacles usually.
                        // Adding !isOccupied ensures we don't hide the unit with a highlighter if sizing is weird, but Tile handles it.
                        />


                        {/* Special Highlight Overlay (Color Override) - Adjusted for elevation */}
                        {showSpecialHighlight && (
                            <mesh position={[worldX, visualHeight + 0.06, worldZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                                <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
                                <meshBasicMaterial color={highlightColor} opacity={0.2} transparent />
                            </mesh>
                        )}

                        {/* Hint for Wall Chain Source */}
                        {interactionState.mode === 'WALL_PLACEMENT' && interactionState.lastPos?.x === x && interactionState.lastPos?.z === z && (
                            <mesh position={[worldX, visualHeight + 0.1, worldZ]} raycast={() => null}>
                                <ringGeometry args={[0.3, 0.4, 4]} />
                                <meshBasicMaterial color="#00ffff" />
                            </mesh>
                        )}

                        {tilePulse?.key === key && (
                            <TilePulseEffect position={[worldX, visualHeight + 0.08, worldZ]} kind={tilePulse.kind} />
                        )}

                    </React.Fragment>
                );
            })}

            {/* Grid Helper - Lowered slightly */}
            <gridHelper
                args={[gridSize, gridDivisions, COLORS.GRID_LINE, COLORS.GRID_LINE]}
                position={[gridCenterX, -0.05, gridCenterZ]}
                material-transparent={true}
                material-opacity={0.45}
                raycast={() => null}
            />

            {/* Collectibles */}
            {collectibles.map(c => {
                const key = `${c.position.x},${c.position.z}`;
                if (!revealedSet.has(key)) return null;

                const worldX = (c.position.x * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET;
                const worldZ = (c.position.z * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET;
                const terrain = terrainData[key];
                let visualHeight = (terrain?.elevation || 0) * ELEVATION_HEIGHT;
                if (terrain?.type === 'RAMP') visualHeight += 0.25;

                let Model = DollarSignModel;
                let color = "#4ade80"; // Green
                let textColor = "text-green-400";
                let borderColor = "border-green-500/50";
                let shadowColor = "rgba(74,222,128,0.5)";
                let label = `$${c.value}`;

                if (c.type === 'HEALTH_PACK') {
                    Model = HealthPackModel;
                    color = "#ef4444"; // Red
                    textColor = "text-red-400";
                    borderColor = "border-red-500/50";
                    shadowColor = "rgba(239,68,68,0.5)";
                    label = `+${c.value} HP`;
                } else if (c.type === 'ENERGY_CELL') {
                    Model = EnergyCellModel;
                    color = "#a855f7"; // Purple
                    textColor = "text-purple-400";
                    borderColor = "border-purple-500/50";
                    shadowColor = "rgba(168,85,247,0.5)";
                    label = `+${c.value} EN`;
                }

                return (
                    <group key={c.id} position={[worldX, visualHeight + 0.5, worldZ]}>
                        <Model />

                        {/* Floating Text */}
                        <Html position={[0, 0.6, 0]} center pointerEvents="none">
                            <div className={`text-[10px] font-bold ${textColor} bg-black/60 px-1 rounded border ${borderColor} backdrop-blur-sm shadow-[0_0_10px_${shadowColor}]`}>
                                {label}
                            </div>
                        </Html>

                        {/* Point Light for Glow */}
                        <pointLight distance={2} intensity={2} color={color} />
                    </group>
                );
            })}

        </group>
    );
};

export default Board;
