
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import { Edges, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface ChargingStationModelProps {
  color: string;
  isDying?: boolean;
}

const ChargingStationModel: React.FC<ChargingStationModelProps> = ({ color, isDying }) => {
  const groupRef = useRef<Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  
  const matRefs = useRef<MeshStandardMaterial[]>([]);
  const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) {
        matRefs.current.push(mat);
    }
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (isDying) {
        if (deathStartTime === null) setDeathStartTime(t);
        const elapsed = t - (deathStartTime || t);

        if (groupRef.current) {
            groupRef.current.position.y -= delta * 0.5; // Sink
            groupRef.current.rotation.x += delta * 0.2;
        }

        const opacity = Math.max(0, 1 - elapsed);
        matRefs.current.forEach(m => {
            m.opacity = opacity;
            m.transparent = true;
            m.emissiveIntensity = 0;
        });

    } else {
        // Idle Animation
        
        // Vertical bobbing of rings
        if (ring1Ref.current) {
            ring1Ref.current.position.y = 0.5 + Math.sin(t * 2) * 0.1;
            ring1Ref.current.rotation.y += delta;
        }
        if (ring2Ref.current) {
            ring2Ref.current.position.y = 0.5 + Math.sin(t * 2 + Math.PI) * 0.1;
            ring2Ref.current.rotation.y -= delta;
        }

        // Pulse Core
        if (coreRef.current) {
            const pulse = 1.5 + Math.sin(t * 5) * 0.5;
            (coreRef.current.material as MeshStandardMaterial).emissiveIntensity = pulse;
        }
    }
  });

  return (
    <group ref={groupRef}>
        {/* Base Platform */}
        <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.45, 0.5, 0.2, 8]} />
            <meshStandardMaterial ref={addMatRef} color="#222" roughness={0.5} metalness={0.8} />
            <Edges color={color} />
        </mesh>

        {/* Central Core (Energy Column) */}
        <mesh ref={coreRef} position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 1.0, 8]} />
            <meshStandardMaterial 
                ref={addMatRef} 
                color={color} 
                emissive={color}
                emissiveIntensity={2}
                transparent 
                opacity={0.8} 
            />
        </mesh>

        {/* Floating Rings */}
        <mesh ref={ring1Ref} position={[0, 0.5, 0]} rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.35, 0.03, 8, 16]} />
            <meshStandardMaterial ref={addMatRef} color="#444" metalness={0.9} roughness={0.2} />
        </mesh>
        
        <mesh ref={ring2Ref} position={[0, 0.5, 0]} rotation={[-0.2, 0, 0]}>
            <torusGeometry args={[0.35, 0.03, 8, 16]} />
            <meshStandardMaterial ref={addMatRef} color="#444" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Conductive Rods (4 corners) */}
        {[0, Math.PI/2, Math.PI, -Math.PI/2].map((rot, i) => (
            <mesh key={i} position={[Math.cos(rot)*0.35, 0.4, Math.sin(rot)*0.35]}>
                <cylinderGeometry args={[0.03, 0.03, 0.6]} />
                <meshStandardMaterial ref={addMatRef} color="#555" />
            </mesh>
        ))}

        {/* Particles */}
        <Sparkles 
            count={20} 
            scale={1.2} 
            size={4} 
            speed={2} 
            opacity={0.8} 
            color={color}
            position={[0, 0.6, 0]}
        />
    </group>
  );
};

export default ChargingStationModel;
