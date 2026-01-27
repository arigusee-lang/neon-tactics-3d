
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

interface HeavyTankModelProps {
  color: string;
  isMoving: boolean;
  isDying?: boolean;
}

const HeavyTankModel: React.FC<HeavyTankModelProps> = ({ color, isMoving, isDying }) => {
  const groupRef = useRef<Group>(null);
  const turretRef = useRef<Group>(null);
  
  const matRefs = useRef<MeshStandardMaterial[]>([]);
  const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) matRefs.current.push(mat);
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    if (isDying) {
        if (deathStartTime === null) setDeathStartTime(t);
        const elapsed = t - (deathStartTime || t);

        if (turretRef.current) {
            turretRef.current.rotation.y += delta;
            turretRef.current.position.y += delta * 0.5;
            turretRef.current.rotation.z += delta * 0.2;
        }
        
        groupRef.current.position.y -= delta * 0.1; // Sink

        const opacity = Math.max(0, 1 - elapsed * 0.8);
        matRefs.current.forEach(m => {
            m.opacity = opacity;
            m.transparent = true;
        });
    } else {
        if (isMoving) {
            // Heavy metallic rumble
            groupRef.current.position.y = Math.sin(t * 8) * 0.02;
            groupRef.current.rotation.z = Math.sin(t * 4) * 0.01; // Slight waddle
        } else {
            groupRef.current.position.y = 0;
            groupRef.current.rotation.z = 0;
        }

        // Turret idle tracking
        if (turretRef.current && !isMoving) {
            turretRef.current.rotation.y = Math.sin(t * 0.2) * 0.05;
        }
    }
  });

  return (
    <group ref={groupRef}>
        {/* Main Chassis - Low Profile, Wide */}
        <group position={[0, 0.25, 0]}>
            <mesh castShadow>
                <boxGeometry args={[1.2, 0.4, 1.4]} />
                <meshStandardMaterial ref={addMatRef} color="#202020" roughness={0.7} metalness={0.6} />
                <Edges color={color} threshold={20} scale={1.01} />
            </mesh>
            
            {/* Front Sloped Armor */}
            <mesh position={[0, 0, 0.8]} rotation={[0.5, 0, 0]}>
                <boxGeometry args={[1.0, 0.1, 0.5]} />
                <meshStandardMaterial ref={addMatRef} color="#252525" />
            </mesh>
        </group>

        {/* Heavy Independent Track Pods (4x) */}
        {[
            { pos: [0.85, 0.2, 0.5], scale: [0.4, 0.4, 0.7] },
            { pos: [-0.85, 0.2, 0.5], scale: [0.4, 0.4, 0.7] },
            { pos: [0.85, 0.2, -0.5], scale: [0.4, 0.4, 0.7] },
            { pos: [-0.85, 0.2, -0.5], scale: [0.4, 0.4, 0.7] }
        ].map((pod, i) => (
            <group key={i} position={pod.pos as any}>
                <mesh castShadow>
                    <boxGeometry args={pod.scale as any} />
                    <meshStandardMaterial ref={addMatRef} color="#151515" roughness={0.9} />
                </mesh>
                {/* Track Teeth Detail */}
                <mesh position={[0, 0.21, 0]}>
                    <planeGeometry args={[0.3, 0.6]} />
                    <meshStandardMaterial color="#000" />
                </mesh>
            </group>
        ))}

        {/* Turret Assembly */}
        <group ref={turretRef} position={[0, 0.55, 0]}>
            {/* Main Turret Body */}
            <mesh castShadow>
                <cylinderGeometry args={[0.5, 0.7, 0.35, 8]} />
                <meshStandardMaterial ref={addMatRef} color="#303030" roughness={0.5} metalness={0.7} />
                <Edges color={color} />
            </mesh>

            {/* Rear Ammo Bustle */}
            <mesh position={[0, 0.1, -0.5]}>
                <boxGeometry args={[0.8, 0.3, 0.5]} />
                <meshStandardMaterial ref={addMatRef} color="#2a2a2a" />
            </mesh>

            {/* Dual Cannons */}
            <group position={[0, 0, 0.3]}>
                {[-0.25, 0.25].map((x, i) => (
                    <group key={i} position={[x, 0, 0]}>
                        {/* Mantlet */}
                        <mesh position={[0, 0, 0.1]}>
                            <boxGeometry args={[0.2, 0.2, 0.3]} />
                            <meshStandardMaterial ref={addMatRef} color="#444" />
                        </mesh>
                        {/* Barrel */}
                        <mesh position={[0, 0, 0.8]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.07, 0.08, 1.2, 8]} />
                            <meshStandardMaterial ref={addMatRef} color="#111" />
                        </mesh>
                        {/* Heavy Muzzle Brake */}
                        <mesh position={[0, 0, 1.4]} rotation={[Math.PI/2, 0, 0]}>
                            <boxGeometry args={[0.18, 0.12, 0.15]} />
                            <meshStandardMaterial ref={addMatRef} color="#222" />
                        </mesh>
                    </group>
                ))}
            </group>

            {/* Missile Pods (Side) */}
            <group position={[0.6, 0.1, -0.1]}>
                <mesh rotation={[0, 0, -0.2]}>
                    <boxGeometry args={[0.2, 0.25, 0.5]} />
                    <meshStandardMaterial ref={addMatRef} color="#333" />
                </mesh>
                {/* Missile Tips */}
                {[0.15, 0, -0.15].map((z, k) => (
                    <mesh key={k} position={[0, 0.05, 0.25 + z]} rotation={[Math.PI/2, 0, 0]}>
                        <cylinderGeometry args={[0.03, 0.03, 0.1]} />
                        <meshStandardMaterial color="#ff0000" />
                    </mesh>
                ))}
            </group>
            
            {/* Top Radar/Antenna */}
            <mesh position={[-0.3, 0.25, -0.2]}>
                <cylinderGeometry args={[0.02, 0.02, 0.6]} />
                <meshStandardMaterial color="#888" />
            </mesh>
            <mesh position={[-0.3, 0.55, -0.2]}>
                <sphereGeometry args={[0.05]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>
    </group>
  );
};

export default HeavyTankModel;
