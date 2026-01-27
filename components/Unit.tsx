
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
    const [isVisible, setIsVisible] = useState(false);
    
    useEffect(() => {
        const t1 = setTimeout(() => {
            setIsVisible(true);
        }, 300); // Wait for building glow charge
        return () => clearTimeout(t1);
    }, []);

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

// --- MAIN UNIT COMPONENT ---

const Unit: React.FC<UnitProps> = ({ data, isSelected, appStatus }) => {
  const groupRef = useRef<Group>(null);
  const internalRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null); 

  const [hovered, setHovered] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  
  const [attackTargetPos, setAttackTargetPos] = useState<Vector3 | null>(null);
  const attackStartRef = useRef(0);
  
  const processingStep = useRef(false);

  const size = data.stats.size || 1;
  const sizeOffset = ((size - 1) * (TILE_SIZE + TILE_SPACING)) / 2;
  const playerColor = data.playerId === PlayerId.ONE ? COLORS.P1 : data.playerId === PlayerId.NEUTRAL ? '#888888' : COLORS.P2;
  const isDying = data.status.isDying || false;
  const isTeleporting = data.status.isTeleporting || false;
  const isExploding = data.status.isExploding || false;

  const isFrozen = data.effects.some(e => e.name === 'CRYO STASIS');
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
    if (data.type === EUnitType.LIGHT_TANK || data.type === EUnitType.HEAVY_TANK) {
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
            internalRef.current.children.forEach((child) => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.emissiveIntensity = 2 + Math.sin(time * 50) * 1;
                    child.material.emissive = new THREE.Color(playerColor);
                }
            });
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
            if (internalRef.current) {
                 internalRef.current.position.y = Math.sin(time * 1.5) * 0.1;
                 internalRef.current.rotation.y = time * 0.5;
                 if (!data.status.attackTargetId) {
                     internalRef.current.children.forEach((child) => {
                         if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                             child.material.emissiveIntensity = 0;
                         }
                     });
                 }
            }
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
        case EUnitType.SOLDIER: return <SoldierModel color={playerColor} isMoving={isMoving} isDying={isDying} isTeleporting={isTeleporting} />;
        case EUnitType.HEAVY: return <HeavyTrooperModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
        case EUnitType.MEDIC: return <MedicModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
        case EUnitType.LIGHT_TANK: return <LightTankModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
        case EUnitType.HEAVY_TANK: return <HeavyTankModel color={playerColor} isMoving={isMoving} isDying={isDying} />;
        case EUnitType.CHARGING_STATION: return <ChargingStationModel color={playerColor} isDying={isDying} />;
        case EUnitType.PORTAL: return <PortalModel color={playerColor} isDying={isDying} />;
        case EUnitType.WALL: return <WallModel color={playerColor} isDying={isDying} />;
        case EUnitType.TOWER: return <TowerModel color={playerColor} isDying={isDying} />;
        case EUnitType.TITAN: return <TitanModel color={playerColor} isDying={isDying} />;
        case EUnitType.SUICIDE_DRONE: return <SuicideDroneModel color={playerColor} isDying={isDying} isExploding={isExploding} />;
        case EUnitType.CONE: return <ApexBladeModel color={playerColor} isMoving={isMoving} isDying={isDying} isAttacking={!!data.status.attackTargetId} />;
        // ... (Keeping rest of cases like BOX, SERVER, RESIDENTIAL, SPIKE as they were)
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
                      <mesh position={[0.25, 0, 0.25]} rotation={[0, Math.PI/4, 0]}>
                           <boxGeometry args={[0.4, 0.02, 0.05]} />
                           <meshStandardMaterial color="#333" />
                      </mesh>
                      <mesh position={[-0.25, 0, 0.25]} rotation={[0, -Math.PI/4, 0]}>
                           <boxGeometry args={[0.4, 0.02, 0.05]} />
                           <meshStandardMaterial color="#333" />
                      </mesh>
                      <mesh position={[0.25, 0, -0.25]} rotation={[0, -Math.PI/4, 0]}>
                           <boxGeometry args={[0.4, 0.02, 0.05]} />
                           <meshStandardMaterial color="#333" />
                      </mesh>
                      <mesh position={[-0.25, 0, -0.25]} rotation={[0, Math.PI/4, 0]}>
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

        case EUnitType.SERVER: 
           return (
               <group>
                  <mesh position={[0, 0.8, 0]} castShadow>
                      <boxGeometry args={[0.7, 1.6, 0.7]} />
                      {renderMatrixMat(0.95, "#050505")}
                  </mesh>
                  <mesh position={[0.4, 0.8, 0]}>
                      <boxGeometry args={[0.1, 1.4, 0.5]} />
                      <meshStandardMaterial color="#222" />
                  </mesh>
                  <mesh position={[-0.4, 0.8, 0]}>
                      <boxGeometry args={[0.1, 1.4, 0.5]} />
                      <meshStandardMaterial color="#222" />
                  </mesh>
                  <mesh position={[0, 1.0, 0.36]}>
                      <planeGeometry args={[0.5, 0.3]} />
                      <meshBasicMaterial color={playerColor} opacity={0.3} transparent />
                  </mesh>
                  {[0.4, 0.8, 1.2].map((y, i) => (
                      <mesh key={i} position={[0, y, 0]}>
                           <boxGeometry args={[0.72, 0.02, 0.72]} />
                           <meshBasicMaterial color={playerColor} toneMapped={false} />
                      </mesh>
                  ))}
                  <group position={[0, 2.0, 0]}>
                      <mesh position={[0.3, 0, 0]}>
                           <boxGeometry args={[0.1, 0.1, 0.1]} />
                           <meshBasicMaterial color={playerColor} wireframe />
                      </mesh>
                       <mesh position={[-0.2, 0.2, -0.2]}>
                           <boxGeometry args={[0.08, 0.08, 0.08]} />
                           <meshBasicMaterial color={playerColor} wireframe />
                      </mesh>
                  </group>
               </group>
           );

        case EUnitType.RESIDENTIAL: 
           return (
               <group>
                   <mesh position={[0, 0.75, 0]}>
                       <boxGeometry args={[1.2, 1.5, 1.2]} />
                       {renderMatrixMat(0.9, "#1a1a1a")}
                   </mesh>
                   <mesh position={[0.5, 0.4, 0.5]}>
                       <boxGeometry args={[0.6, 0.8, 0.6]} />
                       {renderMatrixMat(0.9, "#222")}
                   </mesh>
                    <mesh position={[0, 1.55, 0]}>
                       <boxGeometry args={[0.8, 0.1, 0.8]} />
                       <meshStandardMaterial color="#888888" />
                   </mesh>
                   {[0.2, 0.6, 1.0, 1.3].map((y, i) => (
                       <group key={i} position={[0, y, 0.61]}>
                           <mesh position={[-0.3, 0, 0]}>
                               <planeGeometry args={[0.15, 0.1]} />
                               <meshBasicMaterial color={playerColor} opacity={0.6} transparent />
                           </mesh>
                           <mesh position={[0.3, 0, 0]}>
                               <planeGeometry args={[0.15, 0.1]} />
                               <meshBasicMaterial color={playerColor} opacity={0.4} transparent />
                           </mesh>
                       </group>
                   ))}
               </group>
           );

        case EUnitType.SPIKE: 
           return (
               <group>
                  <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
                       <ringGeometry args={[0.4, 0.6, 6]} />
                       <meshBasicMaterial color={playerColor} side={THREE.DoubleSide} wireframe />
                  </mesh>
                  <group ref={internalRef}>
                      <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI]}>
                          <coneGeometry args={[0.3, 0.8, 4]} />
                          {renderMatrixMat(0.8)}
                      </mesh>
                      <mesh position={[0, 1.2, 0]}>
                          <coneGeometry args={[0.25, 1.0, 4]} />
                          {renderMatrixMat(0.8)}
                      </mesh>
                      <mesh position={[0, 0.8, 0]}>
                          <octahedronGeometry args={[0.15]} />
                          <meshBasicMaterial color={playerColor} toneMapped={false} />
                      </mesh>
                  </group>
                  <mesh position={[0, 1.0, 0]} rotation={[0.5, 0, 0]}>
                       <torusGeometry args={[0.6, 0.02, 4, 24]} />
                       <meshBasicMaterial color="#555" />
                  </mesh>
               </group>
           );
        
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
    gameService.handleUnitClick(data.id);
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
