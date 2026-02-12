
import React, { useState, useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { TILE_SIZE, COLORS, ELEVATION_HEIGHT } from '../constants';
import { TerrainData, PlayerId } from '../types';

interface TileProps {
    x: number;
    z: number;
    position: [number, number, number];
    terrain?: TerrainData;
    onClick: (x: number, z: number) => void;
    isOccupied: boolean;
    onHover?: (x: number, z: number) => void;
    onHoverEnd?: (x: number, z: number) => void;
    isPlacementHover?: boolean;
    isPlacementValid?: boolean;
    isAttackTarget?: boolean;
    isNemesis?: boolean;
    isPath?: boolean;
}

const AutoAttackBorder: React.FC<{ width: number, height: number }> = ({ width, height }) => {
    const lineRef = useRef<THREE.Line>(null);
    const materialRef = useRef<THREE.LineDashedMaterial>(null);

    useFrame((state, delta) => {
        if (materialRef.current) {
            // Animate dash offset for "moving" effect
            // Negative delta moves dashes along the path direction (Clockwise)
            (materialRef.current as any).dashOffset -= delta * 3;
        }
    });

    const points = useMemo(() => {
        const w = width / 2;
        const h = height / 2;
        // Define rectangle path (Clockwise)
        // TL -> TR -> BR -> BL -> TL (Explicit closed loop for Line primitive)
        return [
            new THREE.Vector3(-w, h, 0),
            new THREE.Vector3(w, h, 0),
            new THREE.Vector3(w, -h, 0),
            new THREE.Vector3(-w, -h, 0),
            new THREE.Vector3(-w, h, 0)
        ];
    }, [width, height]);

    useLayoutEffect(() => {
        if (lineRef.current) {
            lineRef.current.geometry.setFromPoints(points);
            lineRef.current.computeLineDistances(); // Critical for dashed lines
        }
    }, [points]);

    return (
        // @ts-ignore
        <line ref={lineRef as any} raycast={() => null}>
            <bufferGeometry />
            <lineDashedMaterial
                ref={materialRef}
                color="#ff3300"
                dashSize={0.2}
                gapSize={0.15}
                linewidth={2}
                transparent
                opacity={1}
                toneMapped={false}
            />
        </line>
    );
};

const CyberpunkPathMarker = React.memo(({ width, height }: { width: number, height: number }) => {
    const groupRef = useRef<THREE.Group>(null);
    // Random offset for animation phase to de-sync tiles
    const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

    useFrame((state, delta) => {
        if (groupRef.current) {
            const time = state.clock.elapsedTime;

            // Pulse scale slightly
            const scale = 1 + Math.sin(time * 3 + phaseOffset) * 0.05;
            groupRef.current.scale.set(scale, scale, 1);

            // Rotate the inner wireframe (if we add one, or rotate the whole group on Z)
            // groupRef.current.rotation.z = Math.sin(time * 0.5 + phaseOffset) * 0.1;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Base Glow Plate */}
            <mesh position={[0, 0, 0]} raycast={() => null}>
                <planeGeometry args={[width * 0.7, height * 0.7]} />
                <meshBasicMaterial
                    color={COLORS.PATH_HIGHLIGHT}
                    opacity={0.15}
                    transparent
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Corner Brackets / Tech Edges */}
            {/* We can use a ring or a specific SVG path, but let's use a simple wireframe square for "Matrix" wireframe look */}
            <mesh position={[0, 0, 0.01]} raycast={() => null}>
                <ringGeometry args={[width * 0.3, width * 0.35, 4]} />
                <meshBasicMaterial color={COLORS.PATH_HIGHLIGHT} opacity={0.6} transparent side={THREE.DoubleSide} />
            </mesh>

            {/* Center Data Dot */}
            <mesh position={[0, 0, 0.01]} raycast={() => null}>
                <circleGeometry args={[width * 0.05, 8]} />
                <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
            </mesh>

            {/* Floating Wireframe Cube (projected 2D essentially, but using lines) */}
            <lineSegments position={[0, 0, 0.05]} raycast={() => null}>
                <edgesGeometry args={[new THREE.BoxGeometry(width * 0.4, height * 0.4, width * 0.1)]} />
                <lineBasicMaterial color={COLORS.PATH_HIGHLIGHT} opacity={0.5} transparent />
            </lineSegments>
        </group>
    );
}); // End CyberpunkPathMarker

const Tile: React.FC<TileProps> = React.memo(({
    x, z, position, terrain, onClick, isOccupied, onHover, onHoverEnd,
    isPlacementHover, isPlacementValid = true, isAttackTarget = false, isNemesis = false,
    isPath = false
}) => {
    const [hovered, setHovered] = useState(false);

    useCursor(hovered, isAttackTarget ? 'crosshair' : 'pointer', 'auto');

    const handleClick = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onClick(x, z);
    };

    const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        if (onHover) {
            onHover(x, z);
        }
    };

    const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(false);
        if (onHoverEnd) {
            onHoverEnd(x, z);
        }
    };

    // Determine colors based on state
    let edgeColor = COLORS.TILE_EDGE;
    let edgeOpacity = 0.3; // Base visibility (subtle)
    let fillColor = COLORS.TILE_HOVER;

    if (isPlacementHover) {
        edgeColor = isPlacementValid ? '#00ff00' : '#ff0000';
        edgeOpacity = 1;
        fillColor = isPlacementValid ? '#00ff00' : '#ff0000';

        // Override for attack target specifically to ensure red indication if invalid placement logic interfered
        if (isAttackTarget) {
            edgeColor = '#ff0000';
            fillColor = '#ff0000';
        }

    } else if (hovered) {
        edgeColor = COLORS.HIGHLIGHT;
        edgeOpacity = 1;
        fillColor = COLORS.TILE_HOVER;
    }

    // Nemesis Overlay (Persisting Attack Target)
    const showNemesis = isNemesis;

    // Show highlight if placement hover is active (even if occupied) OR if normal hover on empty tile
    const showHighlight = isPlacementHover || (hovered && !isOccupied);

    // --- Terrain Geometry Logic ---
    const type = terrain?.type || 'NORMAL';
    const elevation = terrain?.elevation || 0;
    const rotationIndex = terrain?.rotation || 0; // 0, 1, 2, 3
    const landingZone = terrain?.landingZone;

    // Calculate Base Height
    const baseHeight = elevation * ELEVATION_HEIGHT;

    // Geometry configuration
    let geometryRotation: [number, number, number] = [-Math.PI / 2, 0, 0];
    let geometryPosition: [number, number, number] = [0, 0, 0];

    // Geometry arguments depending on type
    const planeWidth = TILE_SIZE;
    const planeHeight = type === 'RAMP' ? TILE_SIZE * 1.15 : TILE_SIZE;

    if (type === 'RAMP') {
        // Rotate 30 degrees (approx Math.PI/6) up relative to the flat plane
        // But we need to rotate the whole container based on direction
        // The local rotation for the slope:
        geometryRotation = [-Math.PI / 2 + (Math.PI / 6), 0, 0];
        // Adjust position to center the ramp visually
        geometryPosition = [0, 0.25, 0];
    }

    // Group rotation for orientation (N/E/S/W)
    const groupRotation: [number, number, number] = [0, -rotationIndex * (Math.PI / 2), 0];

    // Landing Zone Colors
    let zoneColor = null;
    if (landingZone === PlayerId.ONE) zoneColor = COLORS.P1;
    else if (landingZone === PlayerId.TWO) zoneColor = COLORS.P2;

    return (
        <group position={[position[0], position[1] + baseHeight, position[2]]}>
            <group rotation={groupRotation}>
                {/* Tile Body - Transparent Matrix Glass Style */}
                <mesh
                    position={geometryPosition}
                    rotation={geometryRotation}
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                    onClick={handleClick}
                    userData={{ type: 'TILE', x, z }}
                    receiveShadow
                >
                    <planeGeometry args={[planeWidth, planeHeight]} />
                    <meshStandardMaterial
                        color={COLORS.TILE_BODY}
                        transparent={true}
                        opacity={0.05}
                        side={THREE.DoubleSide}
                        roughness={0.8}
                        metalness={0.2}
                        envMapIntensity={0}
                    />
                </mesh>

                {/* Landing Zone Overlay */}
                {zoneColor && (
                    <mesh position={[geometryPosition[0], geometryPosition[1] + 0.01, geometryPosition[2]]} rotation={geometryRotation} raycast={() => null}>
                        <planeGeometry args={[planeWidth, planeHeight]} />
                        <meshBasicMaterial
                            color={zoneColor}
                            opacity={0.15}
                            transparent
                            side={THREE.DoubleSide}
                            depthWrite={false}
                        />
                    </mesh>
                )}

                {/* Matrix Style Edges - Raised slightly, using renderOrder to pop over transparent effects like light beams */}
                <lineSegments
                    position={[geometryPosition[0], geometryPosition[1] + 0.05, geometryPosition[2]]}
                    rotation={geometryRotation}
                    renderOrder={1}
                    raycast={() => null}
                >
                    <edgesGeometry args={[new THREE.PlaneGeometry(planeWidth, planeHeight)]} />
                    <lineBasicMaterial
                        color={edgeColor}
                        linewidth={2}
                        transparent={true}
                        opacity={edgeOpacity}
                        toneMapped={false}
                        depthWrite={false}
                    />
                </lineSegments>

                {/* Nemesis Highlight (Moving Dashed Border) */}
                {showNemesis && (
                    <group position={[geometryPosition[0], geometryPosition[1] + 0.06, geometryPosition[2]]} rotation={geometryRotation} renderOrder={2}>
                        <AutoAttackBorder width={planeWidth * 0.9} height={planeHeight * 0.9} />
                    </group>
                )}

                {/* Hover/Placement Selection Indicator */}
                {showHighlight && (
                    <mesh position={[geometryPosition[0], geometryPosition[1] + 0.04, geometryPosition[2]]} rotation={geometryRotation} raycast={() => null}>
                        <planeGeometry args={[planeWidth * 0.9, planeHeight * 0.9]} />
                        <meshBasicMaterial
                            color={fillColor}
                            opacity={isPlacementHover ? 0.4 : 0.2}
                            transparent
                            side={THREE.DoubleSide}
                            toneMapped={false}
                        />
                    </mesh>
                )}

                {/* Path Highlight (Yellow Squares) */}
                {isPath && (
                    <group position={[geometryPosition[0], geometryPosition[1] + 0.05, geometryPosition[2]]} rotation={geometryRotation}>
                        <CyberpunkPathMarker width={planeWidth} height={planeHeight} />
                    </group>
                )}
            </group>
        </group>
    );
});

export default Tile;
