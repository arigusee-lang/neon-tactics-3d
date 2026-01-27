
import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import * as THREE from 'three';

interface HeavyTrooperModelProps {
  color: string;
  isMoving: boolean;
  isDying?: boolean;
}

const HeavyTrooperModel: React.FC<HeavyTrooperModelProps> = ({ color, isMoving, isDying }) => {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const weaponRef = useRef<Group>(null);
  
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
        if (deathStartTime === null) {
            setDeathStartTime(t);
        }
        
        const elapsed = t - (deathStartTime || t);
        
        // Explosion logic
        if (headRef.current) {
            headRef.current.position.add(explosionVectors.head);
            headRef.current.rotation.x += 0.05;
        }
        if (leftArmRef.current) {
            leftArmRef.current.position.add(explosionVectors.lArm);
            leftArmRef.current.rotation.z += 0.05;
        }
        if (rightArmRef.current) {
            rightArmRef.current.position.add(explosionVectors.rArm);
            rightArmRef.current.rotation.z -= 0.05;
        }
        if (leftLegRef.current) leftLegRef.current.position.add(explosionVectors.lLeg);
        if (rightLegRef.current) rightLegRef.current.position.add(explosionVectors.rLeg);
        
        // Fall over heavily
        if (elapsed < 0.8) {
            groupRef.current.rotation.x = -Math.PI / 2 * (elapsed * 1.25);
            groupRef.current.position.y = Math.max(0.1, 0.2 - elapsed * 0.5); 
        }

        // Fade out
        const opacity = Math.max(0, 1 - (elapsed / 2.5));
        matRefs.current.forEach(mat => {
            if (mat) {
                mat.opacity = opacity;
                mat.transparent = true;
            }
        });

    } else {
        // Heavy, lumbering movement
        if (isMoving) {
            groupRef.current.position.y = Math.abs(Math.sin(t * 6)) * 0.05; // Slower bob
            
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 6) * 0.3;
            if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 6 + Math.PI) * 0.3;

            if (leftLegRef.current) {
                leftLegRef.current.rotation.x = Math.sin(t * 6 + Math.PI) * 0.6;
            }
            if (rightLegRef.current) {
                rightLegRef.current.rotation.x = Math.sin(t * 6) * 0.6;
            }
        } else {
            // Idle Breathing
            groupRef.current.position.y = Math.sin(t * 1.5) * 0.01;
            // Weapon sway
            if (rightArmRef.current) rightArmRef.current.rotation.x = 0; 
            if (weaponRef.current) weaponRef.current.rotation.x = Math.sin(t * 2) * 0.05;
        }
    }
  });

  // Bulky Colors
  const armorPrimary = "#2a2a2a"; // Dark Heavy Metal
  const armorSecondary = "#555555"; // Plating
  const jointColor = "#111111"; // Undersuit

  return (
    <group ref={groupRef}>
        {/* --- TORSO GROUP --- */}
        <group position={[0, 0.4, 0]}>
            {/* Main Chest Armor - Bulky Box */}
            <mesh castShadow position={[0, 0.1, 0.05]}>
                <boxGeometry args={[0.55, 0.45, 0.4]} />
                <meshStandardMaterial ref={addMatRef} color={armorPrimary} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Chest Plate Highlight */}
            <mesh position={[0, 0.1, 0.26]}>
                <planeGeometry args={[0.3, 0.2]} />
                <meshStandardMaterial ref={addMatRef} color={armorSecondary} />
            </mesh>
            
            {/* Massive Backpack (Reactor/Ammo) */}
            <mesh position={[0, 0.15, -0.25]} castShadow>
                <boxGeometry args={[0.45, 0.55, 0.25]} />
                <meshStandardMaterial ref={addMatRef} color="#222" />
            </mesh>
            {/* Reactor Core Glow */}
            <mesh position={[0, 0.2, -0.38]}>
                <circleGeometry args={[0.1, 16]} />
                <meshBasicMaterial color={color} />
            </mesh>

            {/* Waist/Abdomen */}
            <mesh position={[0, -0.25, 0]}>
                <cylinderGeometry args={[0.22, 0.25, 0.3, 8]} />
                <meshStandardMaterial ref={addMatRef} color={jointColor} />
            </mesh>
        </group>

        {/* --- HEAD (Positioned Higher) --- */}
        <group ref={headRef} position={[0, 0.85, 0.05]}>
            {/* Helmet */}
            <mesh castShadow>
                <boxGeometry args={[0.28, 0.3, 0.32]} />
                <meshStandardMaterial ref={addMatRef} color={armorSecondary} roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Face Shield / Sensor Cluster */}
            <mesh position={[0, 0, 0.17]}>
                <boxGeometry args={[0.2, 0.12, 0.05]} />
                <meshStandardMaterial color="#111" roughness={0.2} />
            </mesh>
            {/* Glowing Eye Slit */}
            <mesh position={[0, 0.02, 0.2]}>
                <planeGeometry args={[0.15, 0.04]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>

        {/* --- LEFT ARM --- */}
        <group ref={leftArmRef} position={[-0.4, 0.65, 0]}>
            {/* Massive Pauldron */}
            <mesh position={[0, 0.1, 0]} castShadow>
                <boxGeometry args={[0.35, 0.35, 0.4]} />
                <meshStandardMaterial ref={addMatRef} color={armorPrimary} />
            </mesh>
            {/* Upper Arm */}
            <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.12, 0.1, 0.3]} />
                <meshStandardMaterial ref={addMatRef} color={jointColor} />
            </mesh>
            {/* Heavy Gauntlet */}
            <mesh position={[0, -0.4, 0]} castShadow>
                <boxGeometry args={[0.22, 0.35, 0.22]} />
                <meshStandardMaterial ref={addMatRef} color={armorSecondary} />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -0.6, 0]}>
                <boxGeometry args={[0.15, 0.15, 0.15]} />
                <meshStandardMaterial ref={addMatRef} color="#111" />
            </mesh>
        </group>

        {/* --- RIGHT ARM (Weapon Arm) --- */}
        <group ref={rightArmRef} position={[0.4, 0.65, 0]}>
            {/* Massive Pauldron */}
            <mesh position={[0, 0.1, 0]} castShadow>
                <boxGeometry args={[0.35, 0.35, 0.4]} />
                <meshStandardMaterial ref={addMatRef} color={armorPrimary} />
            </mesh>
            {/* Upper Arm */}
            <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.12, 0.1, 0.3]} />
                <meshStandardMaterial ref={addMatRef} color={jointColor} />
            </mesh>
            {/* Heavy Gauntlet */}
            <mesh position={[0, -0.4, 0]} castShadow>
                <boxGeometry args={[0.22, 0.35, 0.22]} />
                <meshStandardMaterial ref={addMatRef} color={armorSecondary} />
            </mesh>
            
            {/* HEAVY MINIGUN (Underslung) */}
            <group ref={weaponRef} position={[0.15, -0.5, 0.3]}>
                {/* Gun Body */}
                <mesh rotation={[0, 0, 0]} castShadow>
                    <boxGeometry args={[0.25, 0.3, 0.6]} />
                    <meshStandardMaterial ref={addMatRef} color="#333" />
                </mesh>
                {/* Barrels (Rotating assembly visual) */}
                <group position={[0, -0.05, 0.35]} rotation={[Math.PI/2, 0, 0]}>
                    <cylinderGeometry args={[0.12, 0.12, 0.6, 6]} />
                    <meshStandardMaterial ref={addMatRef} color="#111" />
                    {/* Individual barrel tips */}
                    {[0, Math.PI/3*2, Math.PI/3*4].map((rot, i) => (
                        <mesh key={i} position={[Math.cos(rot)*0.06, 0.3, Math.sin(rot)*0.06]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.05]} />
                            <meshStandardMaterial color="#000" />
                        </mesh>
                    ))}
                </group>
                {/* Ammo Feed Port */}
                <mesh position={[-0.15, 0, -0.1]}>
                    <boxGeometry args={[0.1, 0.2, 0.2]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
            </group>
        </group>

        {/* --- LEGS --- */}
        <group position={[0, 0.1, 0]}>
             {/* Left Leg */}
             <group ref={leftLegRef} position={[-0.2, 0, 0]}>
                {/* Thigh */}
                <mesh position={[0, -0.2, 0]} castShadow>
                    <boxGeometry args={[0.25, 0.45, 0.25]} />
                    <meshStandardMaterial ref={addMatRef} color={armorSecondary} />
                </mesh>
                {/* Knee Plate */}
                <mesh position={[0, -0.4, 0.14]} rotation={[-0.2, 0, 0]}>
                    <boxGeometry args={[0.18, 0.15, 0.05]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPrimary} />
                </mesh>
                {/* Heavy Boot */}
                <mesh position={[0, -0.6, 0.05]} castShadow>
                    <boxGeometry args={[0.28, 0.35, 0.4]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPrimary} />
                </mesh>
             </group>

             {/* Right Leg */}
             <group ref={rightLegRef} position={[0.2, 0, 0]}>
                {/* Thigh */}
                <mesh position={[0, -0.2, 0]} castShadow>
                    <boxGeometry args={[0.25, 0.45, 0.25]} />
                    <meshStandardMaterial ref={addMatRef} color={armorSecondary} />
                </mesh>
                {/* Knee Plate */}
                <mesh position={[0, -0.4, 0.14]} rotation={[-0.2, 0, 0]}>
                    <boxGeometry args={[0.18, 0.15, 0.05]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPrimary} />
                </mesh>
                {/* Heavy Boot */}
                <mesh position={[0, -0.6, 0.05]} castShadow>
                    <boxGeometry args={[0.28, 0.35, 0.4]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPrimary} />
                </mesh>
             </group>
        </group>
    </group>
  );
};

export default HeavyTrooperModel;
