
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';

interface TowerModelProps {
    color: string;
    isDying?: boolean;
}

const TowerModel: React.FC<TowerModelProps> = ({ color, isDying }) => {
    const groupRef = useRef<Group>(null);

    // Animation Refs
    const ringsRef = useRef<Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const baseRef = useRef<THREE.Mesh>(null);

    const matRefs = useRef<MeshStandardMaterial[]>([]);
    const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

    const addMatRef = (mat: MeshStandardMaterial) => {
        if (mat && !matRefs.current.includes(mat)) matRefs.current.push(mat);
    };

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;

        if (isDying) {
            if (deathStartTime === null) setDeathStartTime(time);
            const elapsed = time - (deathStartTime || time);

            // Collapse animation: Spire falls over
            if (groupRef.current) {
                groupRef.current.rotation.x = Math.min(Math.PI / 2, groupRef.current.rotation.x + delta);
                groupRef.current.position.y = Math.max(0, groupRef.current.position.y - delta * 2);
            }

            const opacity = Math.max(0, 1 - elapsed);
            matRefs.current.forEach(m => {
                m.opacity = opacity;
                m.transparent = true;
                m.emissiveIntensity = 0;
            });

        } else {
            // Idle Animation

            // Spin Rings
            if (ringsRef.current) {
                ringsRef.current.rotation.y += delta * 0.5;
                ringsRef.current.position.y = 1.5 + Math.sin(time * 2) * 0.1;
            }

            // Pulse Core
            if (coreRef.current) {
                const pulse = 2 + Math.sin(time * 5) * 1;
                (coreRef.current.material as MeshStandardMaterial).emissiveIntensity = pulse;
            }
        }
    });

    return (
        <group ref={groupRef}>
            {/* === BASE PLATFORM === */}
            <group position={[0, 0.1, 0]}>
                <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[0.4, 0.5, 0.2, 8]} />
                    <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.15, 0]}>
                    <cylinderGeometry args={[0.3, 0.35, 0.1, 8]} />
                    <meshStandardMaterial color="#111" />
                    <Edges color={color} threshold={15} scale={1} />
                </mesh>
            </group>

            {/* === CENTRAL ENERGY COLUMN === */}
            <group position={[0, 1.2, 0]}>
                {/* Inner Glowing Core */}
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 2.0, 8]} />
                    <meshStandardMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={2}
                        transparent
                        opacity={0.8}
                        roughness={0}
                    />
                </mesh>
                {/* Glass/Shield Casing */}
                <mesh>
                    <cylinderGeometry args={[0.15, 0.15, 2.1, 8]} />
                    <meshStandardMaterial
                        color="#88ccff"
                        transparent
                        opacity={0.3}
                        roughness={0.1}
                        metalness={0.9}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </group>

            {/* === VERTICAL RAIL SUPPORTS === */}
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, i) => (
                <group key={i} rotation={[0, rot, 0]}>
                    <mesh position={[0.22, 1.2, 0]}>
                        <boxGeometry args={[0.05, 1.8, 0.05]} />
                        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
                    </mesh>
                    {/* Connection Nodes */}
                    {[0.4, 1.2, 2.0].map((y, j) => (
                        <mesh key={j} position={[0.22, y, 0]}>
                            <boxGeometry args={[0.08, 0.1, 0.08]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                    ))}
                </group>
            ))}

            {/* === ROTATING RINGS === */}
            <group ref={ringsRef} position={[0, 1.5, 0]}>
                {/* Upper Ring Segment */}
                <group position={[0, 0.4, 0]} rotation={[0.2, 0, 0]}>
                    {[0, Math.PI].map((rot, i) => (
                        <mesh key={i} rotation={[0, rot, 0]} position={[0, 0, 0.35]}>
                            <boxGeometry args={[0.4, 0.05, 0.1]} />
                            <meshStandardMaterial color="#444" metalness={0.8} />
                            <mesh position={[0, 0, 0.06]}>
                                <planeGeometry args={[0.3, 0.02]} />
                                <meshBasicMaterial color={color} side={THREE.DoubleSide} />
                            </mesh>
                        </mesh>
                    ))}
                </group>

                {/* Middle Spinner */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.3, 0.02, 4, 24]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
                </mesh>
            </group>

            {/* === EMITTER HEAD === */}
            <group position={[0, 2.3, 0]}>
                <mesh ref={coreRef}>
                    <octahedronGeometry args={[0.2]} />
                    <meshStandardMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={3}
                        toneMapped={false}
                    />
                </mesh>
                {/* Focusing Lenses */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.25, 0.3, 6]} />
                    <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
                    <ringGeometry args={[0.15, 0.2, 6]} />
                    <meshBasicMaterial color="#fff" transparent opacity={0.4} side={THREE.DoubleSide} />
                </mesh>
            </group>
        </group>
    );
};
export default TowerModel;
