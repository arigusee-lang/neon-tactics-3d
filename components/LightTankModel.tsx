
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

interface LightTankModelProps {
  color: string;
  isMoving: boolean;
  isDying?: boolean;
}

const LightTankModel: React.FC<LightTankModelProps> = ({ color, isMoving, isDying }) => {
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
            turretRef.current.position.y += delta * 2;
            turretRef.current.rotation.x -= delta * 2;
            turretRef.current.rotation.z += delta;
        }
        
        // Pitch nose down into ground
        groupRef.current.rotation.x = Math.min(Math.PI/4, groupRef.current.rotation.x + delta);
        groupRef.current.position.y -= delta * 0.5;

        const opacity = Math.max(0, 1 - elapsed);
        matRefs.current.forEach(m => {
            m.opacity = opacity;
            m.transparent = true;
        });
    } else {
        if (isMoving) {
            // High frequency vibration + forward tilt
            groupRef.current.position.y = Math.sin(t * 30) * 0.01;
            groupRef.current.rotation.x = Math.sin(t * 10) * 0.02; // Minor pitching
        } else {
            // Idle hover breathing
            groupRef.current.position.y = Math.sin(t * 2) * 0.005;
            groupRef.current.rotation.x = 0;
        }

        // Idle turret scan
        if (turretRef.current && !isMoving) {
            turretRef.current.rotation.y = Math.sin(t * 0.8) * 0.15;
        }
    }
  });

  return (
    <group ref={groupRef}>
        {/* Main Body - Stealth Angles */}
        <group position={[0, 0.2, 0]}>
            {/* Center Hull */}
            <mesh castShadow>
                <cylinderGeometry args={[0.3, 0.45, 0.3, 6]} />
                <meshStandardMaterial ref={addMatRef} color="#333" roughness={0.4} metalness={0.7} />
                <Edges color={color} threshold={20} />
            </mesh>
            
            {/* Front Glacis */}
            <mesh position={[0, 0, 0.25]} rotation={[0.4, 0, 0]}>
                <boxGeometry args={[0.5, 0.2, 0.4]} />
                <meshStandardMaterial ref={addMatRef} color="#2a2a2a" />
            </mesh>

            {/* Rear Engine Block */}
            <mesh position={[0, 0.05, -0.3]}>
                <boxGeometry args={[0.5, 0.25, 0.3]} />
                <meshStandardMaterial ref={addMatRef} color="#222" />
            </mesh>
            {/* Exhaust Glow */}
            <mesh position={[0, 0.05, -0.46]}>
                <planeGeometry args={[0.4, 0.1]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>

        {/* Tracks / Wheels System */}
        {[-0.35, 0.35].map((x, i) => (
            <group key={i} position={[x, 0.15, 0]}>
                {/* Track Housing */}
                <mesh>
                    <boxGeometry args={[0.15, 0.25, 0.9]} />
                    <meshStandardMaterial ref={addMatRef} color="#1a1a1a" roughness={0.8} />
                </mesh>
                {/* Wheel details */}
                {[0.3, 0, -0.3].map((z, j) => (
                    <mesh key={j} position={[x > 0 ? 0.08 : -0.08, -0.1, z]} rotation={[0, 0, Math.PI/2]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.05, 12]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>
                ))}
            </group>
        ))}

        {/* Turret Group */}
        <group ref={turretRef} position={[0, 0.4, -0.05]}>
            {/* Turret Base */}
            <mesh castShadow>
                <cylinderGeometry args={[0.25, 0.35, 0.15, 5]} />
                <meshStandardMaterial ref={addMatRef} color="#444" roughness={0.3} metalness={0.6} />
                <Edges color={color} />
            </mesh>
            
            {/* Railgun Barrel */}
            <mesh position={[0, 0, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.06, 0.8]} />
                <meshStandardMaterial ref={addMatRef} color="#111" />
            </mesh>
            
            {/* Muzzle Brake */}
            <mesh position={[0, 0, 0.95]} rotation={[Math.PI/2, 0, 0]}>
                <boxGeometry args={[0.1, 0.15, 0.08]} />
                <meshStandardMaterial ref={addMatRef} color="#222" />
            </mesh>

            {/* Sensor Pod (Right Side) */}
            <mesh position={[0.25, 0.05, 0]}>
                <boxGeometry args={[0.15, 0.1, 0.2]} />
                <meshStandardMaterial ref={addMatRef} color="#333" />
            </mesh>
            {/* Lens */}
            <mesh position={[0.25, 0.05, 0.11]}>
                <circleGeometry args={[0.04]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>
    </group>
  );
};

export default LightTankModel;
