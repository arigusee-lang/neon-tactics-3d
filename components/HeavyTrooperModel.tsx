import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
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
    const torsoRef = useRef<Group>(null);
    const barrelRef = useRef<Group>(null);

    const matRefs = useRef<MeshStandardMaterial[]>([]);
    const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

    const explosionVectors = useMemo(() => ({
        head: new Vector3(0, 1, 0).normalize().multiplyScalar(0.02),
        lArm: new Vector3(-1, 0.5, 0).normalize().multiplyScalar(0.02),
        rArm: new Vector3(1, 0, 0.5).normalize().multiplyScalar(0.02),
        lLeg: new Vector3(-0.5, -0.5, 0).normalize().multiplyScalar(0.015),
        rLeg: new Vector3(0.5, -0.5, 0).normalize().multiplyScalar(0.015),
        torso: new Vector3(0, 0.2, -0.5).normalize().multiplyScalar(0.01),
        weapon: new Vector3(1, -0.2, 0.5).normalize().multiplyScalar(0.025)
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

            // Parts flying off
            if (headRef.current) {
                headRef.current.position.add(explosionVectors.head);
                headRef.current.rotation.x += 0.1;
                headRef.current.rotation.y += 0.1;
            }
            if (leftArmRef.current) {
                leftArmRef.current.position.add(explosionVectors.lArm);
                leftArmRef.current.rotation.z += 0.05;
            }
            if (rightArmRef.current) {
                rightArmRef.current.position.add(explosionVectors.rArm);
                rightArmRef.current.rotation.z -= 0.05;
                rightArmRef.current.rotation.x += 0.05;
            }
            if (leftLegRef.current) leftLegRef.current.position.add(explosionVectors.lLeg);
            if (rightLegRef.current) rightLegRef.current.position.add(explosionVectors.rLeg);
            if (weaponRef.current) {
                weaponRef.current.position.add(explosionVectors.weapon);
                weaponRef.current.rotation.x += 0.1;
            }

            // Fall over heavily
            if (elapsed < 0.8) {
                groupRef.current.rotation.x = -Math.PI / 2 * (elapsed * 1.25);
                groupRef.current.position.y = Math.max(0.1, 0.2 - elapsed * 0.5);
            } else {
                // Jitter on ground
                if (Math.random() > 0.8) groupRef.current.position.x += (Math.random() - 0.5) * 0.01;
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
                // Heavier, stompier stride
                const strideSpeed = 5;
                groupRef.current.position.y = Math.abs(Math.sin(t * strideSpeed)) * 0.08;

                // Body sway
                if (torsoRef.current) torsoRef.current.rotation.z = Math.sin(t * strideSpeed) * 0.05;
                if (torsoRef.current) torsoRef.current.rotation.y = Math.sin(t * strideSpeed / 2) * 0.1;

                if (leftArmRef.current) {
                    leftArmRef.current.rotation.x = Math.sin(t * strideSpeed) * 0.4;
                    leftArmRef.current.rotation.z = 0.1 + Math.sin(t * strideSpeed) * 0.1; // Heavy arm sway
                }
                if (rightArmRef.current) {
                    rightArmRef.current.rotation.x = Math.sin(t * strideSpeed + Math.PI) * 0.4;
                }

                if (leftLegRef.current) {
                    leftLegRef.current.rotation.x = Math.sin(t * strideSpeed + Math.PI) * 0.7;
                }
                if (rightLegRef.current) {
                    rightLegRef.current.rotation.x = Math.sin(t * strideSpeed) * 0.7;
                }

                // Barrel spin up
                if (barrelRef.current) barrelRef.current.rotation.z += 0.3;

            } else {
                // Idle Breathing
                groupRef.current.position.y = Math.sin(t * 1.5) * 0.01;

                if (torsoRef.current) {
                    // Subtle heavy breathing
                    torsoRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.005);
                }

                // Weapon sway (heavy)
                if (rightArmRef.current) {
                    rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, 0.1);
                    rightArmRef.current.rotation.z = 0;
                }
                if (weaponRef.current) weaponRef.current.rotation.x = Math.sin(t * 2) * 0.02;

                // Slow barrel idle spin
                if (barrelRef.current) barrelRef.current.rotation.z += 0.05;
            }
        }
    });

    const armorDark = "#222222";
    const armorPlate = "#363636";
    const armorHighlight = "#4a4a4a";
    const jointColor = "#151515";

    return (
        <group ref={groupRef}>

            {/* --- TORSO GROUP --- */}
            <group ref={torsoRef} position={[0, 0.5, 0]}>
                {/* Core Body Chassis */}
                <mesh castShadow position={[0, 0.1, 0]}>
                    <boxGeometry args={[0.5, 0.5, 0.35]} />
                    <meshStandardMaterial ref={addMatRef} color={armorDark} roughness={0.7} metalness={0.5} />
                </mesh>

                {/* Chest Plating (Layered) */}
                <mesh position={[0, 0.15, 0.18]} castShadow>
                    <boxGeometry args={[0.42, 0.25, 0.08]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPlate} roughness={0.5} metalness={0.6} />
                </mesh>
                {/* Reinforced Collar Bone Armor */}
                <mesh position={[0, 0.3, 0.12]} rotation={[0.4, 0, 0]}>
                    <boxGeometry args={[0.38, 0.15, 0.1]} />
                    <meshStandardMaterial ref={addMatRef} color={armorHighlight} />
                </mesh>

                {/* Abdomen Plating (segmentation) */}
                <mesh position={[0, -0.15, 0.16]}>
                    <boxGeometry args={[0.3, 0.12, 0.06]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPlate} />
                </mesh>
                <mesh position={[0, -0.25, 0.15]}>
                    <boxGeometry args={[0.26, 0.1, 0.06]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPlate} />
                </mesh>

                {/* Massive Reactor Backpack */}
                <group position={[0, 0.1, -0.25]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.55, 0.6, 0.3]} />
                        <meshStandardMaterial ref={addMatRef} color="#1a1a1a" roughness={0.8} />
                    </mesh>
                    {/* Vents */}
                    {[-0.15, 0, 0.15].map((x, i) => (
                        <mesh key={i} position={[x, 0.2, 0.16]}>
                            <boxGeometry args={[0.05, 0.15, 0.02]} />
                            <meshStandardMaterial color="#000" />
                        </mesh>
                    ))}
                    {/* Reactor Core (Suicide Protocol Indicator) */}
                    <mesh position={[0, 0, 0.16]}>
                        <circleGeometry args={[0.12, 16]} />
                        <meshBasicMaterial color={color} toneMapped={false} />
                    </mesh>
                    <mesh position={[0, 0, 0.17]}>
                        <ringGeometry args={[0.12, 0.15, 16]} />
                        <meshBasicMaterial color="#000" />
                    </mesh>
                    {/* Lower Vents */}
                    <mesh position={[0, -0.2, 0.16]}>
                        <boxGeometry args={[0.4, 0.1, 0.02]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                </group>

                {/* Power Cables (Torso to Arm) */}
                <mesh position={[0.3, 0.2, -0.1]} rotation={[0, 0, -0.5]}>
                    <cylinderGeometry args={[0.03, 0.03, 0.2, 6]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
            </group>

            {/* --- HEAD --- */}
            <group ref={headRef} position={[0, 0.95, 0.05]}>
                {/* Helm - heavily armored, low profile */}
                <mesh castShadow>
                    <boxGeometry args={[0.24, 0.22, 0.28]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPlate} roughness={0.4} metalness={0.7} />
                </mesh>
                {/* Jaw guard */}
                <mesh position={[0, -0.08, 0.16]} rotation={[0.2, 0, 0]}>
                    <boxGeometry args={[0.26, 0.12, 0.1]} />
                    <meshStandardMaterial ref={addMatRef} color={armorHighlight} />
                </mesh>
                {/* Mono-eye / Sensor strip */}
                <mesh position={[0, 0.02, 0.145]}>
                    <boxGeometry args={[0.18, 0.04, 0.02]} />
                    <meshBasicMaterial color="#000" />
                </mesh>
                <mesh position={[0, 0.02, 0.15]}>
                    <planeGeometry args={[0.08, 0.025]} />
                    <meshBasicMaterial color={color} toneMapped={false} />
                </mesh>
                {/* Antenna */}
                <mesh position={[0.12, 0.05, -0.05]} rotation={[0, 0, -0.2]}>
                    <cylinderGeometry args={[0.01, 0.01, 0.15]} />
                    <meshStandardMaterial color="#555" />
                </mesh>
            </group>

            {/* --- LEFT ARM (Heavy Manipulator/Shield) --- */}
            <group ref={leftArmRef} position={[-0.42, 0.7, 0]}>
                {/* Massive Pauldron (Shoulder) */}
                <group position={[0, 0.15, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.38, 0.35, 0.38]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPlate} roughness={0.5} />
                    </mesh>
                    {/* Decal / Stripe */}
                    <mesh position={[0, 0, 0.2]} rotation={[0.1, 0, 0]}>
                        <boxGeometry args={[0.4, 0.2, 0.05]} />
                        <meshStandardMaterial ref={addMatRef} color={armorHighlight} />
                    </mesh>
                </group>

                {/* Upper Arm */}
                <mesh position={[0, -0.15, 0]}>
                    <cylinderGeometry args={[0.11, 0.1, 0.25, 8]} />
                    <meshStandardMaterial ref={addMatRef} color={jointColor} />
                </mesh>

                {/* Forearm - Armored Gauntlet */}
                <mesh position={[0, -0.45, 0]} castShadow>
                    <boxGeometry args={[0.22, 0.35, 0.22]} />
                    <meshStandardMaterial ref={addMatRef} color={armorDark} />
                </mesh>
                {/* Shield Plate on Forearm */}
                <mesh position={[-0.12, -0.45, 0]}>
                    <boxGeometry args={[0.05, 0.4, 0.25]} />
                    <meshStandardMaterial ref={addMatRef} color={armorPlate} />
                </mesh>

                {/* Heavy Fist */}
                <group position={[0, -0.68, 0]}>
                    <mesh>
                        <boxGeometry args={[0.16, 0.14, 0.18]} />
                        <meshStandardMaterial ref={addMatRef} color="#1a1a1a" />
                    </mesh>
                    {/* Fingers */}
                    {[0.05, 0, -0.05].map((x, i) => (
                        <mesh key={i} position={[x, -0.08, 0.05]} rotation={[0.5, 0, 0]}>
                            <boxGeometry args={[0.04, 0.08, 0.04]} />
                            <meshStandardMaterial color="#333" />
                        </mesh>
                    ))}
                    {/* Thumb */}
                    <mesh position={[0.08, -0.04, -0.05]} rotation={[0, 0, -0.5]}>
                        <boxGeometry args={[0.04, 0.08, 0.04]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                </group>
            </group>

            {/* --- RIGHT ARM (Minigun Integrated) --- */}
            <group ref={rightArmRef} position={[0.42, 0.7, 0]}>
                {/* Massive Pauldron */}
                <group position={[0, 0.15, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.38, 0.35, 0.38]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPlate} roughness={0.5} />
                    </mesh>
                    {/* Warning Stripe */}
                    <mesh position={[0, 0.1, 0.2]} rotation={[0.1, 0, 0]}>
                        <planeGeometry args={[0.3, 0.05]} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                </group>

                {/* Upper Arm */}
                <mesh position={[0, -0.15, 0]}>
                    <cylinderGeometry args={[0.11, 0.1, 0.25, 8]} />
                    <meshStandardMaterial ref={addMatRef} color={jointColor} />
                </mesh>

                {/* MINIGUN ASSEMBLY */}
                <group ref={weaponRef} position={[0.05, -0.4, 0.1]}>
                    {/* Gun Housing */}
                    <mesh castShadow>
                        <boxGeometry args={[0.25, 0.3, 0.6]} />
                        <meshStandardMaterial ref={addMatRef} color="#222" metalness={0.6} />
                    </mesh>
                    {/* Ammo Feed Mechanism */}
                    <mesh position={[-0.15, 0, -0.1]} rotation={[0, 0, 0.2]}>
                        <boxGeometry args={[0.15, 0.15, 0.2]} />
                        <meshStandardMaterial color="#151515" />
                    </mesh>

                    {/* Rotating Barrels */}
                    <group ref={barrelRef} position={[0, -0.05, 0.32]} rotation={[0, 0, 0]}>
                        {/* Center Axis */}
                        <mesh rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                        {/* The 6 Barrels */}
                        {[0, 1, 2, 3, 4, 5].map((i) => {
                            const angle = (i / 6) * Math.PI * 2;
                            return (
                                <mesh key={i} position={[Math.cos(angle) * 0.06, Math.sin(angle) * 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
                                    <cylinderGeometry args={[0.015, 0.015, 0.6, 8]} />
                                    <meshStandardMaterial color="#080808" metalness={0.8} roughness={0.3} />
                                    {/* Muzzle glow tip (subtle) */}
                                    <mesh position={[0, 0.3, 0]}>
                                        <cylinderGeometry args={[0.016, 0.016, 0.02, 8]} />
                                        <meshBasicMaterial color="#333" />
                                    </mesh>
                                </mesh>
                            );
                        })}
                    </group>

                    {/* Cooling Vents on Housing */}
                    <mesh position={[0, 0.16, 0]} rotation={[0, 0, 0]}>
                        <boxGeometry args={[0.15, 0.02, 0.4]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>
                </group>
            </group>

            {/* --- LEGS --- */}
            <group position={[0, 0.1, 0]}>
                {/* Left Leg */}
                <group ref={leftLegRef} position={[-0.22, 0.3, 0]}>
                    {/* Thigh */}
                    <mesh position={[0, -0.15, 0]} castShadow>
                        <boxGeometry args={[0.26, 0.35, 0.26]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPlate} />
                    </mesh>
                    {/* Knee Joint */}
                    <group name="leftKnee" position={[0, -0.35, 0]}>
                        <mesh rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.12, 0.12, 0.24, 8]} />
                            <meshStandardMaterial color={jointColor} />
                        </mesh>
                        {/* Lower Leg / Shin - Massive Armor */}
                        <mesh position={[0, -0.3, 0]} castShadow>
                            <boxGeometry args={[0.28, 0.45, 0.3]} />
                            <meshStandardMaterial ref={addMatRef} color={armorDark} />
                        </mesh>
                        {/* Knee Pad */}
                        <mesh position={[0, -0.1, 0.16]} rotation={[-0.1, 0, 0]}>
                            <boxGeometry args={[0.2, 0.2, 0.05]} />
                            <meshStandardMaterial ref={addMatRef} color={armorHighlight} />
                        </mesh>
                        {/* Foot */}
                        <mesh position={[0, -0.55, 0.05]}>
                            <boxGeometry args={[0.3, 0.12, 0.45]} />
                            <meshStandardMaterial ref={addMatRef} color="#111" />
                        </mesh>
                        {/* Toe Treads */}
                        <mesh position={[0, -0.58, 0.25]}>
                            <boxGeometry args={[0.28, 0.06, 0.1]} />
                            <meshStandardMaterial color="#050505" />
                        </mesh>
                    </group>
                </group>

                {/* Right Leg */}
                <group ref={rightLegRef} position={[0.22, 0.3, 0]}>
                    {/* Thigh */}
                    <mesh position={[0, -0.15, 0]} castShadow>
                        <boxGeometry args={[0.26, 0.35, 0.26]} />
                        <meshStandardMaterial ref={addMatRef} color={armorPlate} />
                    </mesh>
                    {/* Knee Joint */}
                    <group name="rightKnee" position={[0, -0.35, 0]}>
                        <mesh rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.12, 0.12, 0.24, 8]} />
                            <meshStandardMaterial color={jointColor} />
                        </mesh>
                        {/* Lower Leg / Shin */}
                        <mesh position={[0, -0.3, 0]} castShadow>
                            <boxGeometry args={[0.28, 0.45, 0.3]} />
                            <meshStandardMaterial ref={addMatRef} color={armorDark} />
                        </mesh>
                        {/* Knee Pad */}
                        <mesh position={[0, -0.1, 0.16]} rotation={[-0.1, 0, 0]}>
                            <boxGeometry args={[0.2, 0.2, 0.05]} />
                            <meshStandardMaterial ref={addMatRef} color={armorHighlight} />
                        </mesh>
                        {/* Foot */}
                        <mesh position={[0, -0.55, 0.05]}>
                            <boxGeometry args={[0.3, 0.12, 0.45]} />
                            <meshStandardMaterial ref={addMatRef} color="#111" />
                        </mesh>
                        {/* Toe Treads */}
                        <mesh position={[0, -0.58, 0.25]}>
                            <boxGeometry args={[0.28, 0.06, 0.1]} />
                            <meshStandardMaterial color="#050505" />
                        </mesh>
                    </group>
                </group>
            </group>

        </group>
    );
};

export default HeavyTrooperModel;
