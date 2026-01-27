
import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import * as THREE from 'three';

interface SoldierModelProps {
  color: string;
  isMoving: boolean;
  isDying?: boolean;
  isTeleporting?: boolean;
}

const SoldierModel: React.FC<SoldierModelProps> = ({ color, isMoving, isDying, isTeleporting }) => {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  
  const matRefs = useRef<MeshStandardMaterial[]>([]);
  const [deathStartTime, setDeathStartTime] = useState<number | null>(null);
  
  const explosionVectors = useMemo(() => ({
      head: new THREE.Vector3(0, 1, -0.5).normalize().multiplyScalar(0.02),
      lArm: new THREE.Vector3(-1, 0.5, 0).normalize().multiplyScalar(0.02),
      rArm: new THREE.Vector3(1, 0.5, 0).normalize().multiplyScalar(0.02),
      lLeg: new THREE.Vector3(-0.5, -0.5, 0).normalize().multiplyScalar(0.01),
      rLeg: new THREE.Vector3(0.5, -0.5, 0).normalize().multiplyScalar(0.01),
      torso: new THREE.Vector3(0, 0, -1).normalize().multiplyScalar(0.01)
  }), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    
    if (isTeleporting) {
        // Teleport Effect: Stretches up and fades out
        groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, 4, 0.1);
        groupRef.current.scale.x = THREE.MathUtils.lerp(groupRef.current.scale.x, 0, 0.1);
        groupRef.current.scale.z = THREE.MathUtils.lerp(groupRef.current.scale.z, 0, 0.1);
        return;
    } else {
        // Reset scale if not teleporting
        groupRef.current.scale.set(1, 1, 1);
    }

    if (isDying) {
        if (deathStartTime === null) setDeathStartTime(t);
        const elapsed = t - (deathStartTime || t);
        
        if (headRef.current) headRef.current.position.add(explosionVectors.head);
        if (leftArmRef.current) leftArmRef.current.position.add(explosionVectors.lArm);
        if (rightArmRef.current) rightArmRef.current.position.add(explosionVectors.rArm);
        if (leftLegRef.current) leftLegRef.current.position.add(explosionVectors.lLeg);
        if (rightLegRef.current) rightLegRef.current.position.add(explosionVectors.rLeg);
        
        // Spin and shrink
        groupRef.current.rotation.y += 0.1;
        groupRef.current.scale.multiplyScalar(Math.max(0, 1 - elapsed * 2));
        
        const opacity = Math.max(0, 1 - elapsed * 1.5);
        matRefs.current.forEach(mat => {
            mat.opacity = opacity;
            mat.transparent = true;
        });

    } else {
        if (isMoving) {
            // Run cycle
            groupRef.current.position.y = Math.abs(Math.sin(t * 12)) * 0.1;
            
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 12) * 0.8;
            if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 12 + Math.PI) * 0.8;
            
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t * 12 + Math.PI) * 0.8;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t * 12) * 0.8;
        } else {
            // Idle breathing
            groupRef.current.position.y = Math.sin(t * 2) * 0.02;
            
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 2) * 0.05;
            if (rightArmRef.current) rightArmRef.current.rotation.x = -0.5 + Math.sin(t * 2 + Math.PI) * 0.05; // Holding gun up
            
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
        }
    }
  });

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) {
        matRefs.current.push(mat);
    }
  };

  return (
    <group ref={groupRef}>
        {/* Torso */}
        <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.25, 0.35, 0.15]} />
            <meshStandardMaterial ref={addMatRef} color="#333" />
        </mesh>
        {/* Armor Plate */}
        <mesh position={[0, 0.3, 0.08]}>
            <boxGeometry args={[0.2, 0.2, 0.05]} />
            <meshStandardMaterial color={color} />
        </mesh>

        {/* Head */}
        <group ref={headRef} position={[0, 0.5, 0]}>
            <mesh castShadow>
                <boxGeometry args={[0.15, 0.18, 0.18]} />
                <meshStandardMaterial ref={addMatRef} color="#222" />
            </mesh>
            {/* Visor */}
            <mesh position={[0, 0.02, 0.1]}>
                <planeGeometry args={[0.12, 0.05]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>

        {/* Arms */}
        <group ref={leftArmRef} position={[-0.2, 0.35, 0]}>
            <mesh castShadow>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial ref={addMatRef} color="#333" />
            </mesh>
        </group>
        <group ref={rightArmRef} position={[0.2, 0.35, 0]}>
            <mesh castShadow>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial ref={addMatRef} color="#333" />
            </mesh>
            {/* Weapon */}
            <mesh position={[0, -0.2, 0.15]} rotation={[Math.PI/2, 0, 0]}>
                <boxGeometry args={[0.08, 0.4, 0.08]} />
                <meshStandardMaterial color="#111" />
            </mesh>
        </group>

        {/* Legs */}
        <group ref={leftLegRef} position={[-0.1, 0.1, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
                <boxGeometry args={[0.11, 0.35, 0.12]} />
                <meshStandardMaterial ref={addMatRef} color="#222" />
            </mesh>
        </group>
        <group ref={rightLegRef} position={[0.1, 0.1, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
                <boxGeometry args={[0.11, 0.35, 0.12]} />
                <meshStandardMaterial ref={addMatRef} color="#222" />
            </mesh>
        </group>
    </group>
  );
};

export default SoldierModel;
