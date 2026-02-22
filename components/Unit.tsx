
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, ThreeEvent, useThree, createPortal } from '@react-three/fiber';
import { Vector3, Group, Scene, Quaternion } from 'three';
import { Html, Edges, Line } from '@react-three/drei';
import { Unit as UnitType, UnitType as EUnitType, PlayerId, AppStatus, TerrainData } from '../types';
import { TILE_SIZE, TILE_SPACING, BOARD_OFFSET, COLORS, CARD_CONFIG, ELEVATION_HEIGHT } from '../constants';
import * as THREE from 'three';
import SoldierModel from './SoldierModel';
import HeavyTrooperModel from './HeavyTrooperModel';
import MedicModel from './MedicModel';
import WallModel from './WallModel';
import SuicideDroneModel from './SuicideDroneModel';
import TowerModel from './TowerModel';
import TitanModel from './TitanModel';
import LightTankModel from './LightTankModel';
import HeavyTankModel from './HeavyTankModel';
import ChargingStationModel from './ChargingStationModel';
import PortalModel from './PortalModel';
import ApexBladeModel from './ApexBladeModel';
import SniperModel from './SniperModel';
import HackerModel from './HackerModel';
import ArcPortalModelV2 from './ArcPortalModelV2';
import RepairBotModel from './RepairBotModel';
import SpikeModel from './SpikeModel';
import { gameService } from '../services/gameService';

interface UnitProps {
    data: UnitType;
    isSelected: boolean;
    appStatus: AppStatus;
}

// --- COMBAT EFFECTS COMPONENTS ---

// Muzzle Flash Effect
const MuzzleFlash = ({ position, color }: { position: Vector3, color: string }) => {
    const ref = useRef<THREE.Mesh>(null);
    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.scale.multiplyScalar(1.2);
            (ref.current.material as THREE.MeshBasicMaterial).opacity -= delta * 10;
        }
    });
    return (
        <mesh position={position} ref={ref}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
    );
};

// Impact Explosion Effect
const Impact = ({ position, color }: { position: Vector3, color: string }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const sparksRef = useRef<Group>(null);

    useFrame((state, delta) => {
        // Expand Ring
        if (ringRef.current) {
            ringRef.current.scale.multiplyScalar(1 + delta * 5);
            ringRef.current.rotation.z += delta * 2;
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity -= delta * 3;
        }
        // Expand Sparks
        if (sparksRef.current) {
            sparksRef.current.children.forEach((child) => {
                child.position.add(child.userData.velocity);
                child.scale.multiplyScalar(0.9);
            });
        }
    });

    const sparks = useMemo(() => {
        return new Array(6).fill(0).map((_, i) => ({
            velocity: new Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2)
        }));
    }, []);

    return (
        <group position={position}>
            {/* Energy Ring */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.2, 0.3, 16]} />
                <meshBasicMaterial color={color} transparent opacity={1} side={THREE.DoubleSide} />
            </mesh>
            {/* Sparks */}
            <group ref={sparksRef}>
                {sparks.map((s, i) => (
                    <mesh key={i} userData={{ velocity: s.velocity }}>
                        <boxGeometry args={[0.05, 0.05, 0.05]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                ))}
            </group>
        </group>
    );
};

// Lightning Strike Effect for Neural Spike
const LightningStrike: React.FC<{ target: Vector3, color: string }> = ({ target, color }) => {
    const { scene } = useThree();
    const [points, setPoints] = useState<Vector3[]>(() => [
        target.clone().add(new Vector3(0, 10, 0)),
        target.clone()
    ]);
    const [isVisible, setIsVisible] = useState(true);

    // Effect for charge delay removed to ensure visibility

    useFrame(() => {
        if (!isVisible) return;
        const start = target.clone().add(new Vector3(0, 10, 0));
        const end = target.clone();
        const segments = 8;
        const newPoints = [start];
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const pos = new Vector3().lerpVectors(start, end, t);
            pos.x += (Math.random() - 0.5) * 0.5;
            pos.z += (Math.random() - 0.5) * 0.5;
            newPoints.push(pos);
        }
        newPoints.push(end);
        setPoints(newPoints);
    });

    if (!isVisible) return null;
    if (points.length < 2) return null;

    return createPortal(
        <group>
            <Line points={points} color="white" lineWidth={3} transparent opacity={0.8} />
            <Line points={points} color={color} lineWidth={8} transparent opacity={0.4} />
            <Impact position={target} color={color} />
            <pointLight position={target.clone().add(new Vector3(0, 1, 0))} intensity={5} distance={5} color={color} decay={2} />
        </group>,
        scene
    );
}

// Melee Impact Wrapper
const MeleeImpact: React.FC<{ position: Vector3, delay: number, color: string }> = ({ position, delay, color }) => {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShow(true), delay * 1000);
        return () => clearTimeout(t);
    }, [delay]);
    if (!show) return null;
    return <Impact position={position} color={color} />;
};

// Main Projectile Component
const ProjectileEffect: React.FC<{ start: Vector3, end: Vector3, color: string, type: EUnitType }> = ({ start, end, color, type }) => {
    const { scene } = useThree();
    const meshRef = useRef<THREE.Group>(null);
    const laserRef = useRef<THREE.Mesh>(null); // For Flux Tower instant beam
    const [phase, setPhase] = useState<'muzzle' | 'flying' | 'impact'>('muzzle');
    const progress = useRef(0);
    const lifeTime = useRef(0); // For Flux Tower beam fade

    // Projectile visual properties
    const isTower = type === EUnitType.TOWER;
    const isMedic = type === EUnitType.MEDIC;

    // Standard Projectile settings
    const beamLength = 1.2;
    const beamSpeed = 25;
    const beamThickness = 0.04;
    const beamGlowThickness = 0.08;

    const displayColor = isMedic ? '#00ff00' : color;

    useFrame((state, delta) => {
        // FLUX TOWER LOGIC: Instant Beam
        if (isTower) {
            lifeTime.current += delta;
            // Beam just exists and fades
            if (laserRef.current) {
                const opacity = Math.max(0, 1 - lifeTime.current * 3); // Fade fast
                if (Array.isArray(laserRef.current.material)) {
                    // ignore
                } else {
                    (laserRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
                }

                // Show impact briefly
                if (lifeTime.current > 0.1 && phase !== 'impact') {
                    setPhase('impact');
                }
            }
            return;
        }

        // STANDARD PROJECTILE LOGIC
        // 1. Muzzle Phase
        if (phase === 'muzzle') {
            setPhase('flying');
            return;
        }

        // 2. Flying Phase
        if (phase === 'flying' && meshRef.current) {
            const speed = beamSpeed * delta;
            progress.current += speed;

            if (progress.current >= 1) {
                progress.current = 1;
                setPhase('impact');
            }

            meshRef.current.position.lerpVectors(start, end, progress.current);
            meshRef.current.lookAt(end);
        }
    });

    return createPortal(
        <group>
            {/* Muzzle Flash */}
            {((isTower && lifeTime.current < 0.1) || (!isTower && progress.current < 0.2)) && <MuzzleFlash position={start} color={displayColor} />}

            {/* FLUX TOWER BEAM */}
            {isTower && (
                <group position={start}>
                    {/* Beam is simulated with Line from Drei for simplicity in linking points */}
                </group>
            )}

            {/* FLUX TOWER BEAM REPLACEMENT (Line) */}
            {isTower && (
                <Line
                    points={[start, end]}
                    color={displayColor}
                    lineWidth={10}
                    transparent
                    opacity={Math.max(0, 1 - lifeTime.current * 4)} // Fading
                />
            )}

            {/* STANDARD PROJECTILE */}
            {!isTower && phase === 'flying' && (
                <group ref={meshRef} position={start}>
                    {/* Core Beam */}
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[beamThickness, beamThickness, beamLength, 8]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    {/* Outer Glow */}
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[beamGlowThickness, beamGlowThickness, beamLength * 0.9, 8]} />
                        <meshBasicMaterial color={displayColor} transparent opacity={0.6} />
                    </mesh>
                </group>
            )}

            {/* Impact */}
            {phase === 'impact' && <Impact position={end} color={displayColor} />}
        </group>,
        scene
    );
};

// Mind Control Arc Effect (Dynamic)
const DynamicMindControlLink: React.FC<{ start: Vector3, targetId: string }> = ({ start, targetId }) => {
    const { scene } = useThree();
    const lineRef = useRef<any>(null); // Using any because Line from drei has complex types or refs
    const startMeshRef = useRef<THREE.Mesh>(null);
    const endMeshRef = useRef<THREE.Mesh>(null);

    // We need to look up terrain data for height similar to Unit component
    // But accessing gameService state directly in loop is simplest for now

    useFrame(() => {
        const units = gameService['state'].units;
        const target = units.find(u => u.id === targetId);

        if (target && lineRef.current) {
            // Calculate Target Position
            const size = target.stats.size || 1;
            const sizeOffset = ((size - 1) * (TILE_SIZE + TILE_SPACING)) / 2;
            const tx = (target.position.x * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + sizeOffset;
            const tz = (target.position.z * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + sizeOffset;

            // Simple height approximation or look up terrain
            // Since we don't have easy access to getUnitBaseHeight helper here without prop drill
            // We'll read terrain from service directly
            const terrainData = (gameService as any).state.terrain;
            const key = `${Math.floor(target.position.x)},${Math.floor(target.position.z)}`;
            const terrain = terrainData[key];
            const terrainHeight = (terrain?.elevation || 0) * ELEVATION_HEIGHT;
            let rampOffset = terrain?.type === 'RAMP' ? 0.25 : 0;
            const th = terrainHeight + rampOffset + 0.5;

            const endPos = new Vector3(tx, th, tz);

            // Update Line Points
            // Drei Line accepts points as prop. Efficient update might require imperative ref usage if supported,
            // or just re-render is fine for <Line> if optimized. 
            // However, Drei Line usually updates geometry when points change.
            // But we are in useFrame. We can't setState inside useFrame without triggering re-renders every frame.
            // We should use a native THREE.Line or update geometry attribute directly.
            // BUT, for simplicity with curve:

            const curve = new THREE.QuadraticBezierCurve3(
                start,
                start.clone().lerp(endPos, 0.5).add(new Vector3(0, 4.0, 0)),
                endPos
            );
            const points = curve.getPoints(20);

            // For Drei Line, we might need to update the geometry
            if (lineRef.current.geometry) {
                lineRef.current.geometry.setFromPoints(points);
            }

            if (endMeshRef.current) endMeshRef.current.position.copy(endPos);
        }
    });

    return createPortal(
        <group>
            {/* We use a native LineLoop or similar because updating Drei Line props is slow? 
                Actually, let's just use a native mesh for the line to allow direct geometry updates 
            */}
            <line ref={lineRef}>
                <bufferGeometry />
                <lineBasicMaterial color="#00ff00" linewidth={2} />
            </line>

            <mesh position={start} ref={startMeshRef}>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshBasicMaterial color="#00ff00" wireframe />
            </mesh>
            <mesh ref={endMeshRef}>
                <sphereGeometry args={[0.3, 8, 8]} />
                <meshBasicMaterial color="#00ff00" wireframe />
            </mesh>
        </group>,
        scene
    );
};

// --- MAIN UNIT COMPONENT ---

const Unit: React.FC<UnitProps> = ({ data, isSelected, appStatus }) => {
    const groupRef = useRef<Group>(null);
    const internalRef = useRef<Group>(null);
    const bodyRef = useRef<Group>(null);

    const [hovered, setHovered] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    const [attackTargetPos, setAttackTargetPos] = useState<Vector3 | null>(null);
    const [mindControlTargetPos, setMindControlTargetPos] = useState<Vector3 | null>(null);
    const attackStartRef = useRef(0);

    const processingStep = useRef(false);

    const size = data.stats.size || 1;
    const sizeOffset = ((size - 1) * (TILE_SIZE + TILE_SPACING)) / 2;
    const playerColor = data.playerId === PlayerId.ONE ? COLORS.P1 : data.playerId === PlayerId.NEUTRAL ? '#888888' : COLORS.P2;
    const isDying = data.status.isDying || false;
    const isTeleporting = data.status.isTeleporting || false;
    const isExploding = data.status.isExploding || false;

    const isFrozen = data.effects.some(e => e.name === 'CRYO STASIS');
    const hasShield = data.effects.some(e => e.name === 'IMMORTALITY_SHIELD');
    const hasEnergy = data.stats.maxEnergy > 0;
    const isIndestructible = data.type === EUnitType.PORTAL;

    const terrainData = (gameService as any).state.terrain as Record<string, TerrainData>;

    const getUnitBaseHeight = (x: number, z: number, isTargetCalc = false) => {
        const key = `${x},${z}`;
        const terrain = terrainData[key];
        const terrainHeight = (terrain?.elevation || 0) * ELEVATION_HEIGHT;

        let extraHeight = 0;
        if (terrain?.type === 'RAMP') {
            extraHeight = 0.25;
        }

        let unitFloat = 0.5;
        if (data.type === EUnitType.SOLDIER || data.type === EUnitType.HACKER) {
            unitFloat = 0.255;
        } else if (data.type === EUnitType.SNIPER) {
            unitFloat = 0.24;
        } else if (data.type === EUnitType.LIGHT_TANK || data.type === EUnitType.HEAVY_TANK || data.type === EUnitType.REPAIR_BOT) {
            unitFloat = 0.05;
        }
        if (data.stats.movement === 0 && !isTargetCalc) {
            unitFloat = 0;
        }

        return terrainHeight + extraHeight + unitFloat;
    };

    const getWorldPos = (x: number, z: number, heightOverride?: number) => {
        const worldX = (x * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + sizeOffset;
        const worldZ = (z * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + sizeOffset;
        const h = heightOverride ?? getUnitBaseHeight(x, z);
        return new Vector3(worldX, h, worldZ);
    };

    const visualPos = useRef(getWorldPos(data.position.x, data.position.z));

    useEffect(() => {
        processingStep.current = false;
    }, [data.position.x, data.position.z, data.movePath.length]);

    useEffect(() => {
        if (data.status.attackTargetId) {
            attackStartRef.current = Date.now();
            const units = gameService['state'].units;
            const target = units.find(u => u.id === data.status.attackTargetId);
            if (target) {
                const tSizeOffset = ((target.stats.size - 1) * (TILE_SIZE + TILE_SPACING)) / 2;
                const tx = (target.position.x * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + tSizeOffset;
                const tz = (target.position.z * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + tSizeOffset;

                const key = `${target.position.x},${target.position.z}`;
                const terrain = terrainData[key];
                const terrainHeight = (terrain?.elevation || 0) * ELEVATION_HEIGHT;
                let rampOffset = terrain?.type === 'RAMP' ? 0.25 : 0;
                const th = terrainHeight + rampOffset + 0.5;

                setAttackTargetPos(new Vector3(tx, th, tz));
            }
        } else {
            setAttackTargetPos(null);
        }
    }, [data.status.attackTargetId]);

    // Track Mind Control Target Position
    useEffect(() => {
        if (data.status.mindControlTargetId) {
            const units = gameService['state'].units;
            const target = units.find(u => u.id === data.status.mindControlTargetId);
            if (target) {
                const tx = (target.position.x * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + sizeOffset;
                const tz = (target.position.z * (TILE_SIZE + TILE_SPACING)) - BOARD_OFFSET + sizeOffset;
                // Get height
                const key = `${target.position.x},${target.position.z}`;
                const terrain = terrainData[key];
                const terrainHeight = (terrain?.elevation || 0) * ELEVATION_HEIGHT;
                let rampOffset = terrain?.type === 'RAMP' ? 0.25 : 0;
                const th = terrainHeight + rampOffset + 0.5;

                setMindControlTargetPos(new Vector3(tx, th, tz));
            }
        } else {
            setMindControlTargetPos(null);
        }
    }, [data.status.mindControlTargetId, data.position]); // Re-calc if hacker moves too (though he likely won't move while channeling)


    useEffect(() => {
        if (data.movePath.length === 0) {
            const target = getWorldPos(data.position.x, data.position.z);
            visualPos.current.copy(target);
            if (groupRef.current) groupRef.current.position.copy(visualPos.current);
        }
    }, [data.id, data.position.x, data.position.z]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const time = state.clock.elapsedTime;

        if (isDying) {
            return;
        }

        if (data.status.attackTargetId && attackTargetPos) {
            groupRef.current.lookAt(attackTargetPos.x, groupRef.current.position.y, attackTargetPos.z);

            if (data.type === EUnitType.SPIKE && internalRef.current) {
                // Legacy animation logic removed, handled in SpikeModel now via props
            }
        } else {
            if (bodyRef.current) bodyRef.current.rotation.y = 0;
        }

        if (data.movePath.length > 0) {
            setIsMoving(true);
            const nextTile = data.movePath[0];
            const target = getWorldPos(nextTile.x, nextTile.z);
            if (visualPos.current.distanceTo(target) < 0.1) {
                if (!processingStep.current) {
                    processingStep.current = true;
                    visualPos.current.copy(target);
                    gameService.completeStep(data.id);
                }
            } else {
                visualPos.current.lerp(target, 0.2);
                groupRef.current.lookAt(new Vector3(target.x, groupRef.current.position.y, target.z));
            }
            groupRef.current.position.copy(visualPos.current);
        } else {
            setIsMoving(false);
            const idlePos = getWorldPos(data.position.x, data.position.z);

            if (!data.status.attackTargetId) {
                groupRef.current.position.lerp(idlePos, 0.1);
                const targetRot = data.rotation || 0;
                const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRot);
                groupRef.current.quaternion.slerp(targetQuaternion, 0.15);
            }

            if (isFrozen) {
                if (Math.random() > 0.8) groupRef.current.position.x += (Math.random() - 0.5) * 0.03;
            } else if (data.type === EUnitType.SPIKE) {
                // Logic moved to SpikeModel
            } else if (data.type === EUnitType.BOX) {
                groupRef.current.position.y = idlePos.y + 0.3 + Math.sin(time * 4) * 0.1;
                if (internalRef.current) {
                    internalRef.current.rotation.z = Math.sin(time * 3) * 0.15;
                    internalRef.current.rotation.x = Math.sin(time * 2) * 0.1;
                }
            }
        }
    });

    const renderMatrixMat = (opacity = 0.8, colorOverride?: string) => (
        <>
            <meshStandardMaterial color={colorOverride || "#0a0a0a"} transparent opacity={opacity} roughness={0.2} metalness={0.8} />
            <Edges color={playerColor} threshold={15} scale={1.0} />
        </>
    );

    const renderGeometry = () => {
        switch (data.type) {
            case EUnitType.SOLDIER: return <SoldierModel color={playerColor} isMoving={isMoving} isDying={isDying} isTeleporting={isTeleporting} isAttacking={!!data.status.attackTargetId} />;
            case EUnitType.HEAVY: return <HeavyTrooperModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
            case EUnitType.MEDIC: return <MedicModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
            case EUnitType.LIGHT_TANK: return <LightTankModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
            case EUnitType.HEAVY_TANK: return <HeavyTankModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
            case EUnitType.CHARGING_STATION: return <ChargingStationModel color={playerColor} isDying={isDying} />;
            case EUnitType.PORTAL: return <PortalModel color={playerColor} isDying={isDying} />;
            case EUnitType.ARC_PORTAL: return <ArcPortalModelV2 color={playerColor} isDying={isDying} />;
            case EUnitType.WALL: return <WallModel color={playerColor} isDying={isDying} />;
            case EUnitType.TOWER: return <TowerModel color={playerColor} isDying={isDying} />;
            case EUnitType.TITAN: return <TitanModel color={playerColor} isDying={isDying} />;
            case EUnitType.SUICIDE_DRONE: return <SuicideDroneModel color={playerColor} isDying={isDying} isExploding={isExploding} />;
            case EUnitType.CONE: return <ApexBladeModel color={playerColor} isMoving={isMoving} isDying={isDying} isAttacking={!!data.status.attackTargetId} />;
            case EUnitType.CONE: return <ApexBladeModel color={playerColor} isMoving={isMoving} isDying={isDying} isAttacking={!!data.status.attackTargetId} />;
            case EUnitType.SNIPER: return <SniperModel color={playerColor} isMoving={isMoving} isDying={isDying} isAttacking={!!data.status.attackTargetId} />;
            case EUnitType.HACKER: return <HackerModel color={playerColor} isMoving={isMoving} isDying={isDying} isAttacking={!!data.status.attackTargetId} isMindControlling={!!data.status.mindControlTargetId} />;
            case EUnitType.REPAIR_BOT: return <RepairBotModel color={playerColor} isMoving={isMoving} isDying={isDying} isAttacking={!!data.status.attackTargetId || (data.status.attacksUsed > 0 && !data.status.attackTargetId)} />; // attacksUsed check for repair anim? 

            case EUnitType.BOX:
                return (
                    <group ref={internalRef}>
                        <mesh castShadow>
                            <boxGeometry args={[0.2, 0.15, 0.25]} />
                            {renderMatrixMat(0.9)}
                        </mesh>
                        <mesh position={[0, 0, 0.13]}>
                            <planeGeometry args={[0.1, 0.05]} />
                            <meshBasicMaterial color={playerColor} />
                        </mesh>
                        <group>
                            <mesh position={[0.25, 0, 0.25]} rotation={[0, Math.PI / 4, 0]}>
                                <boxGeometry args={[0.4, 0.02, 0.05]} />
                                <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[-0.25, 0, 0.25]} rotation={[0, -Math.PI / 4, 0]}>
                                <boxGeometry args={[0.4, 0.02, 0.05]} />
                                <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[0.25, 0, -0.25]} rotation={[0, -Math.PI / 4, 0]}>
                                <boxGeometry args={[0.4, 0.02, 0.05]} />
                                <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[-0.25, 0, -0.25]} rotation={[0, Math.PI / 4, 0]}>
                                <boxGeometry args={[0.4, 0.02, 0.05]} />
                                <meshStandardMaterial color="#333" />
                            </mesh>
                        </group>
                        {[
                            [0.4, 0.05, 0.4], [-0.4, 0.05, 0.4],
                            [0.4, 0.05, -0.4], [-0.4, 0.05, -0.4]
                        ].map((pos, i) => (
                            <mesh key={i} position={pos as any}>
                                <cylinderGeometry args={[0.12, 0.12, 0.01, 8]} />
                                <meshBasicMaterial color={playerColor} wireframe opacity={0.4} transparent />
                            </mesh>
                        ))}
                        <mesh position={[0, -0.15, 0]}>
                            <boxGeometry args={[0.1, 0.1, 0.1]} />
                            {renderMatrixMat(0.5)}
                        </mesh>
                    </group>
                );

            case EUnitType.SPIKE: return <SpikeModel color={playerColor} isAttacking={!!data.status.attackTargetId} />;

            default:
                return (
                    <mesh position={[0, 0.5, 0]}>
                        <boxGeometry args={[0.5, 0.5, 0.5]} />
                        {renderMatrixMat(0.8)}
                    </mesh>
                );
        }
    };

    const handleClick = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        gameService.handleUnitClick(data.id, {
            source: 'UNIT',
            eventType: e.type,
            button: e.button,
            pointerType: e.pointerType,
            clientX: e.clientX,
            clientY: e.clientY
        });
    };

    const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        gameService.hoverUnit(data.id);
    }

    const baseHeight = getUnitBaseHeight(data.position.x, data.position.z);
    const ringY = -baseHeight + 0.05;
    const frozenY = (size / 2) - 0.5;

    const projectileStartOffset = data.type === EUnitType.TOWER
        ? new Vector3(0, 2.3, 0)
        : (data.type === EUnitType.LIGHT_TANK || data.type === EUnitType.HEAVY_TANK)
            ? new Vector3(0, 0.5, 0)
            : new Vector3(0, 0.8, 0);

    return (
        <group
            ref={groupRef}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={() => setHovered(false)}
        >
            <group ref={bodyRef}>
                {renderGeometry()}
            </group>

            {data.status.mindControlTargetId && (
                <DynamicMindControlLink start={visualPos.current.clone().add(new Vector3(0, 1.0, 0))} targetId={data.status.mindControlTargetId} />
            )}

            {data.status.attackTargetId && attackTargetPos && (
                data.type === EUnitType.CONE ? (
                    <MeleeImpact position={attackTargetPos} delay={0.2} color={playerColor} />
                ) : data.type === EUnitType.SPIKE ? (
                    <LightningStrike target={attackTargetPos} color={playerColor} />
                ) : (
                    <ProjectileEffect
                        start={visualPos.current.clone().add(projectileStartOffset)}
                        end={attackTargetPos.clone()}
                        color={playerColor}
                        type={data.type}
                    />
                )
            )}

            {isFrozen && <mesh position={[0, frozenY, 0]}><boxGeometry args={[size, size, size]} /><meshBasicMaterial color="#00ffff" transparent opacity={0.3} wireframe /></mesh>}
            {hasShield && <mesh position={[0, frozenY, 0]}><sphereGeometry args={[size * 0.7, 16, 16]} /><meshBasicMaterial color="#fbbf24" transparent opacity={0.3} wireframe /></mesh>}
            {isSelected && !isDying && !isExploding && (
                <mesh position={[0, ringY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.65 * size, 0.75 * size, 32]} />
                    <meshBasicMaterial color={playerColor} transparent opacity={0.6} side={THREE.DoubleSide} />
                </mesh>
            )}
            {!isDying && !isExploding && appStatus === AppStatus.PLAYING && (
                <Html position={[0, size > 1 ? 2.8 : (data.type === EUnitType.TOWER ? 2.8 : 1.8), 0]} center distanceFactor={12} zIndexRange={[100, 0]}>
                    <div className="flex flex-col items-center pointer-events-none select-none">
                        <div className="absolute bottom-full mb-0.5 text-[8px] font-black text-white bg-black/60 px-1 rounded border border-gray-700 shadow-sm backdrop-blur-[2px]">
                            LVL {data.level}
                        </div>

                        {!isIndestructible && (
                            <div className="w-14 h-1.5 bg-gray-900 border border-gray-700 rounded-full overflow-hidden mb-0.5 shadow-[0_0_5px_rgba(0,0,0,1)]">
                                <div
                                    className="h-full transition-all duration-300 ease-out"
                                    style={{
                                        width: `${(data.stats.hp / data.stats.maxHp) * 100}%`,
                                        backgroundColor: isFrozen ? '#00ffff' : playerColor,
                                        boxShadow: `0 0 5px ${isFrozen ? '#00ffff' : playerColor}`
                                    }}
                                />
                            </div>
                        )}

                        {hasEnergy && (
                            <div className="w-14 h-1 bg-gray-900 border border-gray-700 rounded-full overflow-hidden mb-1 shadow-[0_0_5px_rgba(0,0,0,1)]">
                                <div
                                    className="h-full transition-all duration-300 ease-out"
                                    style={{
                                        width: `${(data.stats.energy / data.stats.maxEnergy) * 100}%`,
                                        backgroundColor: '#a855f7',
                                        boxShadow: `0 0 5px #a855f7`
                                    }}
                                />
                            </div>
                        )}

                        {isFrozen && <div className="text-[8px] text-cyan-300 font-bold animate-pulse mt-0.5">SYSTEM FROZEN</div>}
                        {hasShield && <div className="text-[8px] text-yellow-300 font-bold animate-pulse mt-0.5 px-1 border border-yellow-500 rounded bg-yellow-900/50">SHIELD ACTIVE</div>}
                        {isIndestructible && <div className="text-[8px] text-yellow-300 font-black tracking-widest mt-0.5 drop-shadow-[0_0_5px_yellow]">STABLE</div>}

                        {hovered && (
                            <div
                                className="bg-black/95 border p-2 rounded text-[9px] font-mono shadow-[0_0_20px_rgba(0,0,0,0.5)] whitespace-nowrap backdrop-blur-md"
                                style={{ borderColor: playerColor }}
                            >
                                <div className="font-bold mb-0.5 tracking-tighter uppercase" style={{ color: playerColor }}>
                                    {CARD_CONFIG[data.type]?.name || data.type} {data.playerId === PlayerId.NEUTRAL ? '(NEUTRAL)' : ''}
                                </div>
                                <div className="flex gap-2 border-t border-gray-800 pt-1 text-gray-400">
                                    {isIndestructible ? (
                                        <span className="text-yellow-400 font-bold">INDESTRUCTIBLE</span>
                                    ) : (
                                        <span>HP: <span className="text-white font-bold">{data.stats.hp}</span></span>
                                    )}
                                    {!isIndestructible && <span>ATK: <span className="text-white font-bold">{data.stats.attack}</span></span>}
                                    <span>LVL: <span className="text-yellow-400 font-bold">{data.level}</span></span>
                                </div>
                                {hasEnergy && (
                                    <div className="text-purple-400 text-[8px] mt-0.5">
                                        ENERGY: <span className="text-white font-bold">{data.stats.energy}/{data.stats.maxEnergy}</span>
                                    </div>
                                )}
                                {data.stats.movement === 0 && <div className="text-[8px] text-yellow-500 mt-1">[IMMOBILE STRUCTURE]</div>}
                            </div>
                        )}
                    </div>
                </Html>
            )}
        </group>
    );
};

export default Unit;
