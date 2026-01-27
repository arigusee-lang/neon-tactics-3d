
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
        {/* Base Foundation */}
        <mesh ref={baseRef} position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.7, 0.4, 8]} />
            <meshStandardMaterial ref={addMatRef} color="#111" roughness={0.7} metalness={0.5} />
            <Edges color={color} threshold={15} />
        </mesh>

        {/* Main Spire Body */}
        <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.5, 2.0, 6]} />
            <meshStandardMaterial ref={addMatRef} color="#222" roughness={0.4} metalness={0.8} />
        </mesh>

        {/* Floating Energy Rings */}
        <group ref={ringsRef} position={[0, 1.5, 0]}>
            {/* Inner Ring */}
            <mesh rotation={[0.2, 0, 0]}>
                <torusGeometry args={[0.35, 0.02, 8, 32]} />
                <meshStandardMaterial ref={addMatRef} color={color} emissive={color} emissiveIntensity={1} />
            </mesh>
            {/* Outer Ring */}
            <mesh rotation={[-0.2, Math.PI/2, 0]}>
                <torusGeometry args={[0.5, 0.03, 8, 32]} />
                <meshStandardMaterial ref={addMatRef} color="#444" metalness={0.9} />
            </mesh>
        </group>

        {/* Crystal Core Top */}
        <mesh ref={coreRef} position={[0, 2.3, 0]}>
            <octahedronGeometry args={[0.25]} />
            <meshStandardMaterial 
                ref={addMatRef} 
                color={color} 
                emissive={color} 
                emissiveIntensity={2} 
                transparent
                opacity={0.9}
            />
        </mesh>

        {/* Support Struts */}
        {[0, Math.PI/2, Math.PI, -Math.PI/2].map((rot, i) => (
            <mesh key={i} position={[0, 0.5, 0]} rotation={[0, rot, 0]}>
                <boxGeometry args={[0.1, 0.8, 0.8]} />
                <meshStandardMaterial ref={addMatRef} color="#151515" />
            </mesh>
        ))}
    </group>
  );
};
export default TowerModel;
