
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';

interface ApexBladeModelProps {
  color: string;
  isMoving: boolean;
  isDying?: boolean;
  isAttacking?: boolean;
}

const ApexBladeModel: React.FC<ApexBladeModelProps> = ({ color, isMoving, isDying, isAttacking }) => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const cloakRef = useRef<Group>(null);
  
  const matRefs = useRef<MeshStandardMaterial[]>([]);
  const [deathStartTime, setDeathStartTime] = useState<number | null>(null);
  const [attackStartTime, setAttackStartTime] = useState<number | null>(null);

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) {
        matRefs.current.push(mat);
    }
  };

  useEffect(() => {
      if (isAttacking) {
          setAttackStartTime(Date.now());
      } else {
          setAttackStartTime(null);
      }
  }, [isAttacking]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // --- DYING ANIMATION ---
    if (isDying) {
        if (deathStartTime === null) setDeathStartTime(t);
        const elapsed = t - (deathStartTime || t);
        
        // Crumple
        groupRef.current.position.y -= delta * 0.8;
        groupRef.current.rotation.x += delta * 2;
        groupRef.current.rotation.z += delta;
        groupRef.current.scale.multiplyScalar(Math.max(0, 1 - delta));

        const opacity = Math.max(0, 1 - elapsed);
        matRefs.current.forEach(m => {
            m.opacity = opacity;
            m.transparent = true;
            m.emissiveIntensity = 0;
        });
        return;
    } 
    
    // --- ATTACK ANIMATION (Spin Slash) ---
    if (isAttacking && attackStartTime) {
        const elapsed = (Date.now() - attackStartTime) / 1000;
        const duration = 0.6; // Duration of attack phase in Unit.tsx
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 0.2) {
            // Phase 1: Coiling / Windup
            if (bodyRef.current) {
                bodyRef.current.position.y = THREE.MathUtils.lerp(0, -0.3, progress * 5);
                bodyRef.current.rotation.x = 0.5; // Lean forward
            }
            // Cross arms
            if (leftArmRef.current) {
                leftArmRef.current.rotation.y = -1.5;
                leftArmRef.current.rotation.z = -0.5;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.y = 1.5;
                rightArmRef.current.rotation.z = 0.5;
            }
        } else if (progress < 0.7) {
            // Phase 2: Spin Slash
            const spinP = (progress - 0.2) / 0.5;
            // Jump and Spin
            if (bodyRef.current) {
                bodyRef.current.position.y = Math.sin(spinP * Math.PI) * 0.8; 
                bodyRef.current.rotation.y += delta * 25; // High speed spin
                bodyRef.current.rotation.x = 0; 
            }
            // Arms wide
            if (leftArmRef.current) {
                leftArmRef.current.rotation.y = THREE.MathUtils.lerp(-1.5, 0, spinP * 2);
                leftArmRef.current.rotation.z = 0;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.y = THREE.MathUtils.lerp(1.5, 0, spinP * 2);
                rightArmRef.current.rotation.z = 0;
            }
        } else {
            // Phase 3: Land
            const landP = (progress - 0.7) / 0.3;
            if (bodyRef.current) {
                // Reset rotation to neutral smoothly
                const currentRot = bodyRef.current.rotation.y % (Math.PI * 2);
                bodyRef.current.rotation.y = THREE.MathUtils.lerp(currentRot, 0, landP);
                bodyRef.current.position.y = THREE.MathUtils.lerp(0, 0, landP);
            }
        }
    } 
    // --- IDLE / MOVE ANIMATION ---
    else {
        if (bodyRef.current) {
             bodyRef.current.rotation.y = 0; 
             
             if (isMoving) {
                 // Naruto run style
                 bodyRef.current.rotation.x = 0.6; // Deep lean
                 bodyRef.current.position.y = 0.1 + Math.abs(Math.sin(t * 15)) * 0.1;
                 
                 // Cloak flap
                 if (cloakRef.current) {
                     cloakRef.current.rotation.x = 0.5 + Math.sin(t * 15) * 0.2;
                 }

                 // Arms back
                 if (leftArmRef.current) {
                     leftArmRef.current.rotation.x = 1.2;
                     leftArmRef.current.rotation.y = 0.2;
                 }
                 if (rightArmRef.current) {
                     rightArmRef.current.rotation.x = 1.2;
                     rightArmRef.current.rotation.y = -0.2;
                 }
             } else {
                 // Idle Stance: Dark & Brooding
                 bodyRef.current.rotation.x = 0.1;
                 bodyRef.current.position.y = Math.sin(t * 2) * 0.03;
                 
                 if (cloakRef.current) cloakRef.current.rotation.x = 0;

                 // Breathing arms
                 if (leftArmRef.current) {
                     leftArmRef.current.rotation.x = 0;
                     leftArmRef.current.rotation.z = 0.3 + Math.sin(t) * 0.05;
                     leftArmRef.current.rotation.y = 0.2;
                 }
                 if (rightArmRef.current) {
                     rightArmRef.current.rotation.x = 0;
                     rightArmRef.current.rotation.z = -0.3 - Math.sin(t) * 0.05;
                     rightArmRef.current.rotation.y = -0.2;
                 }
             }
        }
    }
  });

  const cloakColor = "#1a1a1a";
  const armorColor = "#333333";

  return (
    <group ref={groupRef}>
        <group ref={bodyRef}>
            
            {/* --- HEAD --- */}
            <group position={[0, 0.75, 0]}>
                {/* Hood (Cylindrical Cone) */}
                <mesh position={[0, 0.05, 0]} castShadow>
                    <coneGeometry args={[0.2, 0.4, 7]} />
                    <meshStandardMaterial ref={addMatRef} color={cloakColor} roughness={0.9} />
                </mesh>
                {/* Inner Face/Void */}
                <mesh position={[0, -0.05, 0.1]}>
                    <sphereGeometry args={[0.12, 16, 16]} />
                    <meshStandardMaterial color="#000" roughness={0} metalness={0.5} />
                </mesh>
                {/* Glowing Eyes */}
                <mesh position={[0.06, -0.05, 0.18]} rotation={[0.2, 0.3, 0]}>
                    <planeGeometry args={[0.04, 0.015]} />
                    <meshBasicMaterial color={color} />
                </mesh>
                <mesh position={[-0.06, -0.05, 0.18]} rotation={[0.2, -0.3, 0]}>
                    <planeGeometry args={[0.04, 0.015]} />
                    <meshBasicMaterial color={color} />
                </mesh>
            </group>

            {/* --- TORSO --- */}
            <group position={[0, 0.45, 0]}>
                <mesh castShadow>
                    <cylinderGeometry args={[0.15, 0.2, 0.4, 6]} />
                    <meshStandardMaterial ref={addMatRef} color={armorColor} />
                </mesh>
                
                {/* Tech Backpack */}
                <group position={[0, 0.1, -0.15]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.25, 0.3, 0.15]} />
                        <meshStandardMaterial ref={addMatRef} color="#222" />
                    </mesh>
                    <mesh position={[0, 0.1, -0.08]}>
                        <boxGeometry args={[0.05, 0.25, 0.05]} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                    {/* Antennas */}
                    <mesh position={[0.1, 0.2, 0]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.4]} />
                        <meshStandardMaterial color="#666" />
                    </mesh>
                </group>
            </group>

            {/* --- CLOAK --- */}
            <group ref={cloakRef} position={[0, 0.4, -0.1]}>
                {/* Main Cape Body */}
                <mesh position={[0, -0.3, 0.15]} rotation={[-0.1, 0, 0]}>
                    <cylinderGeometry args={[0.2, 0.4, 0.8, 7, 1, true, 0, 6.28]} />
                    <meshStandardMaterial ref={addMatRef} color={cloakColor} side={THREE.DoubleSide} roughness={0.9} />
                </mesh>
            </group>

            {/* --- ARMS --- */}
            
            {/* Left Arm */}
            <group ref={leftArmRef} position={[-0.2, 0.6, 0]}>
                <mesh position={[0, -0.15, 0]}>
                    <cylinderGeometry args={[0.05, 0.04, 0.3]} />
                    <meshStandardMaterial ref={addMatRef} color="#222" />
                </mesh>
                {/* Left Saber (Reverse Grip) */}
                <group position={[0, -0.28, 0.1]} rotation={[Math.PI/2 + 0.2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                        <meshStandardMaterial color="#555" />
                    </mesh>
                    {/* Energy Blade */}
                    <mesh position={[0, 0.35, 0]}>
                        <boxGeometry args={[0.05, 0.6, 0.01]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                    </mesh>
                </group>
            </group>

            {/* Right Arm */}
            <group ref={rightArmRef} position={[0.2, 0.6, 0]}>
                <mesh position={[0, -0.15, 0]}>
                    <cylinderGeometry args={[0.05, 0.04, 0.3]} />
                    <meshStandardMaterial ref={addMatRef} color="#222" />
                </mesh>
                {/* Right Saber (Reverse Grip) */}
                <group position={[0, -0.28, 0.1]} rotation={[Math.PI/2 + 0.2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                        <meshStandardMaterial color="#555" />
                    </mesh>
                    {/* Energy Blade */}
                    <mesh position={[0, 0.35, 0]}>
                        <boxGeometry args={[0.05, 0.6, 0.01]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                    </mesh>
                </group>
            </group>

        </group>
    </group>
  );
};

export default ApexBladeModel;
