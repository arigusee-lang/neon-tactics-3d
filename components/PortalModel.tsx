
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import { Edges, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface PortalModelProps {
  color: string;
  isDying?: boolean;
}

const PortalModel: React.FC<PortalModelProps> = ({ color, isDying }) => {
  const groupRef = useRef<Group>(null);
  const ringOuterRef = useRef<THREE.Mesh>(null);
  const ringInnerRef = useRef<THREE.Mesh>(null);
  const vortexRef = useRef<THREE.Mesh>(null);
  
  const matRefs = useRef<MeshStandardMaterial[]>([]);

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) matRefs.current.push(mat);
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Rotate Rings
    if (ringOuterRef.current) {
        ringOuterRef.current.rotation.z += delta * 0.2;
    }
    if (ringInnerRef.current) {
        ringInnerRef.current.rotation.z -= delta * 0.5;
    }
    
    // Vortex Animation
    if (vortexRef.current) {
        vortexRef.current.rotation.z -= delta * 2;
        const scalePulse = 1 + Math.sin(t * 3) * 0.05;
        vortexRef.current.scale.set(scalePulse, scalePulse, 1);
    }
  });

  return (
    <group ref={groupRef}>
        {/* Base Platform (2x2) */}
        <group position={[0, 0.1, 0]}>
            {/* Corner Pillars */}
            {[
                [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]
            ].map((pos, i) => (
                <mesh key={i} position={[pos[0], 0.2, pos[1]]} castShadow>
                    <boxGeometry args={[0.4, 0.6, 0.4]} />
                    <meshStandardMaterial ref={addMatRef} color="#222" roughness={0.3} metalness={0.8} />
                    <Edges color={color} />
                </mesh>
            ))}
            
            {/* Base Plate */}
            <mesh position={[0, 0, 0]} receiveShadow>
                <boxGeometry args={[2.0, 0.2, 2.0]} />
                <meshStandardMaterial ref={addMatRef} color="#111" roughness={0.8} metalness={0.5} />
            </mesh>
        </group>

        {/* The Gate Structure */}
        <group position={[0, 1.2, 0]}>
            {/* Outer Support Ring */}
            <mesh ref={ringOuterRef}>
                <torusGeometry args={[0.9, 0.1, 8, 32]} />
                <meshStandardMaterial ref={addMatRef} color="#333" metalness={0.8} roughness={0.2} />
            </mesh>
            
            {/* Inner Energy Ring */}
            <mesh ref={ringInnerRef}>
                <torusGeometry args={[0.75, 0.05, 8, 16]} />
                <meshStandardMaterial ref={addMatRef} color={color} emissive={color} emissiveIntensity={1} />
            </mesh>

            {/* Event Horizon (Vortex) */}
            <mesh ref={vortexRef}>
                <circleGeometry args={[0.7, 32]} />
                <meshStandardMaterial 
                    ref={addMatRef} 
                    color={color} 
                    emissive={color} 
                    emissiveIntensity={2} 
                    transparent 
                    opacity={0.6} 
                    side={THREE.DoubleSide} 
                />
            </mesh>

            {/* Particles emitting from center */}
            <Sparkles 
                count={40}
                scale={2.5}
                size={6}
                speed={0.4}
                opacity={0.8}
                color="#ffffff"
            />
        </group>
    </group>
  );
};

export default PortalModel;
