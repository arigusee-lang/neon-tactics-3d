
import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';

interface MedicModelProps {
  color: string;
  isMoving: boolean;
  isDying?: boolean;
}

const MedicModel: React.FC<MedicModelProps> = ({ color, isMoving, isDying }) => {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  
  const matRefs = useRef<MeshStandardMaterial[]>([]);
  const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

  const explosionVectors = useMemo(() => ({
      head: new THREE.Vector3(0, 1, 0).normalize().multiplyScalar(0.015),
      lArm: new THREE.Vector3(-1, 0.5, 0).normalize().multiplyScalar(0.015),
      rArm: new THREE.Vector3(1, 0.5, 0).normalize().multiplyScalar(0.015),
      lLeg: new THREE.Vector3(-0.5, -0.5, 0).normalize().multiplyScalar(0.01),
      rLeg: new THREE.Vector3(0.5, -0.5, 0).normalize().multiplyScalar(0.01)
  }), []);

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) {
        matRefs.current.push(mat);
    }
  };

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    
    if (isDying) {
        if (deathStartTime === null) setDeathStartTime(t);
        const elapsed = t - (deathStartTime || t);
        
        if (headRef.current) headRef.current.position.add(explosionVectors.head);
        if (leftArmRef.current) leftArmRef.current.position.add(explosionVectors.lArm);
        if (rightArmRef.current) rightArmRef.current.position.add(explosionVectors.rArm);
        
        // Collapse
        if (elapsed < 0.8) {
             groupRef.current.position.y = Math.max(0.1, 0.5 - elapsed * 0.8);
             groupRef.current.rotation.x = -Math.PI / 2 * elapsed;
        }

        const opacity = Math.max(0, 1 - (elapsed / 2));
        matRefs.current.forEach(mat => { mat.opacity = opacity; mat.transparent = true; });

    } else {
        if (isMoving) {
            groupRef.current.position.y = Math.abs(Math.sin(t * 10)) * 0.05;
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 10) * 0.5;
            if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 10 + Math.PI) * 0.5;
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t * 10 + Math.PI) * 0.5;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t * 10) * 0.5;
        } else {
            groupRef.current.position.y = Math.sin(t * 2) * 0.01;
            if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
            if (rightArmRef.current) rightArmRef.current.rotation.x = -0.4; // Hold scanner up
        }
    }
  });

  const baseColor = "#e5e7eb"; // White/Grey armor for Medic

  return (
    <group ref={groupRef}>
        {/* Torso */}
        <mesh position={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.3, 0.35, 0.2]} />
            <meshStandardMaterial ref={addMatRef} color={baseColor} />
        </mesh>
        {/* Red Cross on Chest */}
        <mesh position={[0, 0.15, 0.11]}>
             <planeGeometry args={[0.12, 0.04]} />
             <meshBasicMaterial color="red" />
        </mesh>
        <mesh position={[0, 0.15, 0.11]}>
             <planeGeometry args={[0.04, 0.12]} />
             <meshBasicMaterial color="red" />
        </mesh>

        {/* Backpack (Medkit) */}
        <group position={[0, 0.2, -0.15]}>
            <mesh castShadow>
                <boxGeometry args={[0.25, 0.25, 0.15]} />
                <meshStandardMaterial ref={addMatRef} color="#333" />
            </mesh>
            {/* Green Light */}
            <mesh position={[0, 0.05, -0.08]}>
                <boxGeometry args={[0.1, 0.02, 0.01]} />
                <meshBasicMaterial color="#00ff00" />
            </mesh>
        </group>

        {/* Head */}
        <group ref={headRef} position={[0, 0.45, 0]}>
            <mesh castShadow>
                <boxGeometry args={[0.18, 0.2, 0.2]} />
                <meshStandardMaterial ref={addMatRef} color={baseColor} />
            </mesh>
            {/* Visor */}
            <mesh position={[0, 0, 0.11]}>
                <planeGeometry args={[0.14, 0.06]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>

        {/* Arms */}
        <group ref={leftArmRef} position={[-0.2, 0.3, 0]}>
            <mesh castShadow>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial ref={addMatRef} color={baseColor} />
            </mesh>
        </group>
        
        <group ref={rightArmRef} position={[0.2, 0.3, 0]}>
            <mesh castShadow>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial ref={addMatRef} color={baseColor} />
            </mesh>
            {/* Scanner Tool */}
            <group position={[0, -0.2, 0.1]} rotation={[Math.PI/2, 0, 0]}>
                <mesh>
                    <boxGeometry args={[0.06, 0.06, 0.2]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                <mesh position={[0, 0, 0.1]}>
                     <cylinderGeometry args={[0.02, 0.04, 0.05]} />
                     <meshBasicMaterial color="#00ff00" transparent opacity={0.6} />
                </mesh>
            </group>
        </group>

        {/* Legs */}
        <group ref={leftLegRef} position={[-0.1, 0, 0]}>
             <mesh position={[0, -0.25, 0]} castShadow>
                <boxGeometry args={[0.12, 0.35, 0.14]} />
                <meshStandardMaterial ref={addMatRef} color="#333" />
            </mesh>
        </group>
        <group ref={rightLegRef} position={[0.1, 0, 0]}>
             <mesh position={[0, -0.25, 0]} castShadow>
                <boxGeometry args={[0.12, 0.35, 0.14]} />
                <meshStandardMaterial ref={addMatRef} color="#333" />
            </mesh>
        </group>

    </group>
  );
};

export default MedicModel;
