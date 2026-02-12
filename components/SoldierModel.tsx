import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';

interface SoldierModelProps {
    color: string;
    isMoving: boolean;
    isDying?: boolean;
    isTeleporting?: boolean;
    isAttacking?: boolean;
}

const SoldierModel: React.FC<SoldierModelProps> = ({ color, isMoving, isDying, isTeleporting, isAttacking }) => {
    const groupRef = useRef<Group>(null);
    const bodyRef = useRef<Group>(null);
    const headRef = useRef<Group>(null);
    const leftArmRef = useRef<Group>(null);
    const rightArmRef = useRef<Group>(null);
    const leftLegRef = useRef<Group>(null);
    const rightLegRef = useRef<Group>(null);
    const weaponRef = useRef<Group>(null);

    const matRefs = useRef<MeshStandardMaterial[]>([]);
    const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

    // Define explosion vectors for death animation
    const explosionVectors = useMemo(() => ({
        head: new Vector3(0, 1, -0.5).normalize().multiplyScalar(0.04),
        lArm: new Vector3(-1, 0.5, 0).normalize().multiplyScalar(0.03),
        rArm: new Vector3(1, 0.5, 0).normalize().multiplyScalar(0.03),
        lLeg: new Vector3(-0.5, -0.5, 0).normalize().multiplyScalar(0.02),
        rLeg: new Vector3(0.5, -0.5, 0).normalize().multiplyScalar(0.02),
        torso: new Vector3(0, 0, -1).normalize().multiplyScalar(0.02),
        weapon: new Vector3(0.5, 0.5, 1).normalize().multiplyScalar(0.04)
    }), []);

    const addMatRef = (mat: MeshStandardMaterial) => {
        if (mat && !matRefs.current.includes(mat)) {
            matRefs.current.push(mat);
        }
    };

    useFrame((state) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;

        // === TELEPORT EFFECT ===
        if (isTeleporting) {
            groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, 4, 0.1);
            groupRef.current.scale.x = THREE.MathUtils.lerp(groupRef.current.scale.x, 0, 0.1);
            groupRef.current.scale.z = THREE.MathUtils.lerp(groupRef.current.scale.z, 0, 0.1);
            return;
        } else {
            groupRef.current.scale.set(1, 1, 1);
        }

        // === DEATH ANIMATION ===
        if (isDying) {
            if (deathStartTime === null) setDeathStartTime(t);
            const elapsed = t - (deathStartTime || t);

            // Explode parts
            if (headRef.current) {
                headRef.current.position.add(explosionVectors.head);
                headRef.current.rotation.x += 0.1;
            }
            if (leftArmRef.current) leftArmRef.current.position.add(explosionVectors.lArm);
            if (rightArmRef.current) rightArmRef.current.position.add(explosionVectors.rArm);
            if (leftLegRef.current) leftLegRef.current.position.add(explosionVectors.lLeg);
            if (rightLegRef.current) rightLegRef.current.position.add(explosionVectors.rLeg);
            if (weaponRef.current) {
                weaponRef.current.position.add(explosionVectors.weapon);
                weaponRef.current.rotation.z -= 0.2;
            }

            // General tumble
            if (bodyRef.current) bodyRef.current.rotation.x -= 0.05;
            groupRef.current.position.y += Math.sin(elapsed * 5) * 0.01; // Slight bounce

            // Fade out
            const opacity = Math.max(0, 1 - elapsed * 1.5);
            matRefs.current.forEach(mat => {
                mat.opacity = opacity;
                mat.transparent = true;
            });

        } else {
            // === ALIVE ANIMATION ===
            if (bodyRef.current) {
                if (isMoving) {
                    // Heavy Run Cycle
                    const runSpeed = 12;
                    groupRef.current.position.y = Math.abs(Math.sin(t * runSpeed)) * 0.08;
                    bodyRef.current.rotation.y = Math.sin(t * runSpeed * 0.5) * 0.1; // Torso twist
                    bodyRef.current.rotation.x = 0.2; // Lean forward

                    if (leftLegRef.current) {
                        leftLegRef.current.rotation.x = Math.sin(t * runSpeed) * 0.8;
                        leftLegRef.current.position.y = Math.sin(t * runSpeed) > 0 ? 0.1 : 0; // Lift leg
                    }
                    if (rightLegRef.current) {
                        rightLegRef.current.rotation.x = Math.sin(t * runSpeed + Math.PI) * 0.8;
                        rightLegRef.current.position.y = Math.sin(t * runSpeed + Math.PI) > 0 ? 0.1 : 0;
                    }

                    // Arms pumping/swaying with weapon
                    if (leftArmRef.current) {
                        leftArmRef.current.rotation.x = 0.5 + Math.sin(t * runSpeed) * 0.2;
                        leftArmRef.current.rotation.y = 0.5;
                    }
                    if (rightArmRef.current) {
                        rightArmRef.current.rotation.x = 0.5 + Math.sin(t * runSpeed) * 0.2;
                        rightArmRef.current.rotation.y = -0.5;
                    }
                } else {
                    // Idle: Heavy breathing, looking around
                    const breathe = Math.sin(t * 1.5) * 0.01;
                    groupRef.current.position.y = breathe;
                    bodyRef.current.rotation.x = 0;
                    bodyRef.current.rotation.y = 0;

                    // Subtle head scan
                    if (headRef.current) {
                        headRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
                        headRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
                    }

                    // Ready stance
                    if (leftLegRef.current) {
                        leftLegRef.current.rotation.x = 0.1;
                        leftLegRef.current.position.z = -0.1;
                    }
                    if (rightLegRef.current) {
                        rightLegRef.current.rotation.x = -0.1;
                        rightLegRef.current.position.z = 0.1;
                    }

                    // Weapon ready
                    if (leftArmRef.current) {
                        leftArmRef.current.rotation.x = 0.2 + breathe * 2;
                        leftArmRef.current.rotation.y = 0.4;
                    }
                    if (rightArmRef.current) {
                        rightArmRef.current.rotation.x = 0.2 + breathe * 2;
                        rightArmRef.current.rotation.y = -0.4;
                    }
                }
            }
        }
    });

    // Palette
    const armorPrimary = color; // Player Color
    const armorSecondary = '#2d3748'; // Dark metallic grey
    const undersuit = '#1a202c'; // Nearly black
    const visorColor = '#fbbf24'; // Amber gold visor
    const metalDetails = '#a0aec0';

    return (
        <group ref={groupRef}>
            <group ref={bodyRef}>
                {/* === TORSO === */}
                <group position={[0, 0.35, 0]}>
                    {/* Main Chest Plate */}
                    <mesh castShadow position={[0, 0.05, 0.05]}>
                        <boxGeometry args={[0.26, 0.28, 0.16]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPrimary} roughness={0.3} metalness={0.7} />
                    </mesh>
                    {/* Abdominal Plating (Undersuit style) */}
                    <mesh position={[0, -0.12, 0.02]}>
                        <boxGeometry args={[0.20, 0.15, 0.12]} />
                        <meshStandardMaterial color={undersuit} roughness={0.8} />
                    </mesh>
                    {/* Power Core / Chest Light */}
                    <mesh position={[0, 0.08, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
                        <meshBasicMaterial color="#00ffff" />
                    </mesh>

                    {/* Backpack (Power Unit) */}
                    <group position={[0, 0.05, -0.12]}>
                        <mesh castShadow>
                            <boxGeometry args={[0.22, 0.25, 0.12]} />
                            <meshStandardMaterial color={armorSecondary} roughness={0.5} metalness={0.6} />
                        </mesh>
                        {/* Vents */}
                        <mesh position={[-0.08, 0.08, -0.065]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
                            <meshStandardMaterial color="#000" />
                        </mesh>
                        <mesh position={[0.08, 0.08, -0.065]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
                            <meshStandardMaterial color="#000" />
                        </mesh>
                    </group>
                </group>

                {/* === HEAD === */}
                <group ref={headRef} position={[0, 0.65, 0]}>
                    {/* Helmet Base */}
                    <mesh castShadow>
                        <boxGeometry args={[0.18, 0.20, 0.22]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPrimary} roughness={0.4} metalness={0.6} />
                    </mesh>
                    {/* Visor */}
                    <mesh position={[0, 0.02, 0.115]}>
                        <boxGeometry args={[0.14, 0.08, 0.02]} />
                        <meshStandardMaterial color={visorColor} emissive={visorColor} emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
                    </mesh>
                    {/* Helmet Top Ridge */}
                    <mesh position={[0, 0.11, 0]}>
                        <boxGeometry args={[0.08, 0.03, 0.24]} />
                        <meshStandardMaterial color={armorSecondary} />
                    </mesh>
                    {/* Side Ear Pieces */}
                    <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
                        <meshStandardMaterial color={armorSecondary} />
                    </mesh>
                    <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
                        <meshStandardMaterial color={armorSecondary} />
                    </mesh>
                </group>

                {/* === ARMS === */}
                {/* Left Arm */}
                <group ref={leftArmRef} position={[-0.22, 0.5, 0]}>
                    {/* Pauldron (Shoulder Pad) - Large */}
                    <mesh position={[0, 0.05, 0]} castShadow>
                        <boxGeometry args={[0.16, 0.16, 0.16]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPrimary} roughness={0.3} metalness={0.6} />
                    </mesh>
                    {/* Arm Body */}
                    <mesh position={[0, -0.15, 0]}>
                        <boxGeometry args={[0.08, 0.20, 0.08]} />
                        <meshStandardMaterial color={undersuit} />
                    </mesh>
                    {/* Gauntlet */}
                    <mesh position={[0, -0.22, 0]}>
                        <boxGeometry args={[0.1, 0.15, 0.1]} />
                        <meshStandardMaterial color={armorSecondary} metalness={0.5} />
                    </mesh>
                </group>

                {/* Right Arm */}
                <group ref={rightArmRef} position={[0.22, 0.5, 0]}>
                    {/* Pauldron */}
                    <mesh position={[0, 0.05, 0]} castShadow>
                        <boxGeometry args={[0.16, 0.16, 0.16]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPrimary} roughness={0.3} metalness={0.6} />
                    </mesh>
                    {/* Arm Body */}
                    <mesh position={[0, -0.15, 0]}>
                        <boxGeometry args={[0.08, 0.20, 0.08]} />
                        <meshStandardMaterial color={undersuit} />
                    </mesh>
                    {/* Gauntlet */}
                    <mesh position={[0, -0.22, 0]}>
                        <boxGeometry args={[0.1, 0.15, 0.1]} />
                        <meshStandardMaterial color={armorSecondary} metalness={0.5} />
                    </mesh>

                    {/* === WEAPON: HEAVY PULSE RIFLE === */}
                    <group ref={weaponRef} position={[0, -0.20, 0.15]}>
                        {/* Main Body */}
                        <mesh position={[0, 0, 0.15]} rotation={[0, 0, 0]}>
                            <boxGeometry args={[0.08, 0.12, 0.45]} />
                            <meshStandardMaterial color="#2d3748" metalness={0.6} roughness={0.4} />
                        </mesh>
                        {/* Barrel */}
                        <mesh position={[0, 0.02, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
                            <meshStandardMaterial color="#1a202c" />
                        </mesh>
                        {/* Scope */}
                        <mesh position={[0, 0.08, 0.1]}>
                            <boxGeometry args={[0.04, 0.04, 0.15]} />
                            <meshStandardMaterial color="#1a202c" />
                        </mesh>
                        {/* Magazine */}
                        <mesh position={[0, -0.1, 0.1]}>
                            <boxGeometry args={[0.06, 0.1, 0.08]} />
                            <meshStandardMaterial color="#1a202c" />
                        </mesh>
                        {/* Blue Energy Glow strips */}
                        <mesh position={[-0.041, 0, 0.2]}>
                            <planeGeometry args={[0.05, 0.2]} />
                            <meshBasicMaterial color="#00ffff" side={THREE.DoubleSide} />
                        </mesh>
                        <mesh position={[0.041, 0, 0.2]}>
                            <planeGeometry args={[0.05, 0.2]} />
                            <meshBasicMaterial color="#00ffff" side={THREE.DoubleSide} />
                        </mesh>
                    </group>
                </group>

                {/* === LEGS === */}
                {/* Left Leg */}
                <group ref={leftLegRef} position={[-0.12, 0.2, 0]}>
                    {/* Thigh */}
                    <mesh position={[0, -0.15, 0]}>
                        <boxGeometry args={[0.12, 0.25, 0.12]} />
                        <meshStandardMaterial color={undersuit} />
                    </mesh>
                    {/* Thigh Plate */}
                    <mesh position={[0, -0.12, 0.065]}>
                        <boxGeometry args={[0.10, 0.15, 0.02]} />
                        <meshStandardMaterial color={armorPrimary} />
                    </mesh>
                    {/* Boot/Greave */}
                    <mesh position={[0, -0.35, 0.02]}>
                        <boxGeometry args={[0.14, 0.20, 0.16]} />
                        <meshStandardMaterial color={armorSecondary} metalness={0.5} roughness={0.6} />
                    </mesh>
                </group>

                {/* Right Leg */}
                <group ref={rightLegRef} position={[0.12, 0.2, 0]}>
                    {/* Thigh */}
                    <mesh position={[0, -0.15, 0]}>
                        <boxGeometry args={[0.12, 0.25, 0.12]} />
                        <meshStandardMaterial color={undersuit} />
                    </mesh>
                    {/* Thigh Plate */}
                    <mesh position={[0, -0.12, 0.065]}>
                        <boxGeometry args={[0.10, 0.15, 0.02]} />
                        <meshStandardMaterial color={armorPrimary} />
                    </mesh>
                    {/* Boot/Greave */}
                    <mesh position={[0, -0.35, 0.02]}>
                        <boxGeometry args={[0.14, 0.20, 0.16]} />
                        <meshStandardMaterial color={armorSecondary} metalness={0.5} roughness={0.6} />
                    </mesh>
                </group>
            </group>
        </group>
    );
};

export default SoldierModel;
