import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';

interface HackerModelProps {
    color: string;
    isMoving: boolean;
    isDying?: boolean;
    isMindControlling?: boolean;
    isAttacking?: boolean;
}

const HackerModel: React.FC<HackerModelProps> = ({ color, isMoving, isDying, isMindControlling, isAttacking }) => {
    const groupRef = useRef<Group>(null);
    const bodyRef = useRef<Group>(null);
    const headRef = useRef<Group>(null);
    const leftArmRef = useRef<Group>(null);
    const rightArmRef = useRef<Group>(null);
    const leftLegRef = useRef<Group>(null);
    const rightLegRef = useRef<Group>(null);
    const weaponRef = useRef<Group>(null);
    const laptopRef = useRef<Group>(null);

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
        weapon: new Vector3(0.5, 0.5, 1).normalize().multiplyScalar(0.04),
        laptop: new Vector3(0, 1, 1).normalize().multiplyScalar(0.05)
    }), []);

    const addMatRef = (mat: MeshStandardMaterial) => {
        if (mat && !matRefs.current.includes(mat)) {
            matRefs.current.push(mat);
        }
    };

    useFrame((state) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;

        // === DEATH ANIMATION ===
        if (isDying) {
            if (deathStartTime === null) setDeathStartTime(t);
            const elapsed = t - (deathStartTime || t);

            // Explode parts
            if (headRef.current) {
                headRef.current.position.add(explosionVectors.head);
                headRef.current.rotation.x += 0.1;
                headRef.current.scale.setScalar(1 - elapsed * 0.5);
            }
            if (leftArmRef.current) leftArmRef.current.position.add(explosionVectors.lArm);
            if (rightArmRef.current) rightArmRef.current.position.add(explosionVectors.rArm);
            if (leftLegRef.current) leftLegRef.current.position.add(explosionVectors.lLeg);
            if (rightLegRef.current) rightLegRef.current.position.add(explosionVectors.rLeg);
            if (weaponRef.current) {
                weaponRef.current.position.add(explosionVectors.weapon);
                weaponRef.current.rotation.z -= 0.2;
            }
            if (laptopRef.current) {
                laptopRef.current.position.add(explosionVectors.laptop);
                laptopRef.current.rotation.x += 0.2;
            }

            // General tumble
            if (bodyRef.current) {
                bodyRef.current.rotation.x -= 0.05;
                bodyRef.current.scale.setScalar(Math.max(0.1, 1 - elapsed));
            }
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
                    // Sneaky Run Cycle
                    const runSpeed = 12;
                    groupRef.current.position.y = Math.abs(Math.sin(t * runSpeed)) * 0.08;
                    bodyRef.current.rotation.y = Math.sin(t * runSpeed * 0.5) * 0.15; // More torso twist
                    bodyRef.current.rotation.x = 0.3; // Lean forward heavily

                    if (leftLegRef.current) {
                        leftLegRef.current.rotation.x = Math.sin(t * runSpeed) * 0.9;
                        leftLegRef.current.position.y = Math.sin(t * runSpeed) > 0 ? 0.15 : 0;
                    }
                    if (rightLegRef.current) {
                        rightLegRef.current.rotation.x = Math.sin(t * runSpeed + Math.PI) * 0.9;
                        rightLegRef.current.position.y = Math.sin(t * runSpeed + Math.PI) > 0 ? 0.15 : 0;
                    }

                    // Arms tight
                    if (leftArmRef.current) {
                        leftArmRef.current.rotation.x = 0.8 + Math.sin(t * runSpeed) * 0.3;
                        leftArmRef.current.rotation.y = 0.5;
                    }
                    if (rightArmRef.current) {
                        rightArmRef.current.rotation.x = 0.8 + Math.sin(t * runSpeed + Math.PI) * 0.3;
                        rightArmRef.current.rotation.y = -0.5;
                    }
                } else {
                    // Idle logic
                    const breathe = Math.sin(t * 1.5) * 0.01;
                    groupRef.current.position.y = breathe;

                    if (isMindControlling) {
                        // === HACKING POSE ===
                        // Standing still, focused on floating laptop
                        bodyRef.current.rotation.x = 0.05; // Slight hunch
                        bodyRef.current.rotation.y = 0;

                        // Head down intently
                        if (headRef.current) {
                            headRef.current.rotation.x = 0.3;
                            headRef.current.rotation.y = Math.sin(t * 2) * 0.05; // Scanning screen
                        }

                        // Arms up typing furiously
                        if (leftArmRef.current) {
                            leftArmRef.current.rotation.x = -0.6; // Raised forward
                            leftArmRef.current.rotation.z = -0.3; // Inwards
                            // Typing motion
                            leftArmRef.current.position.y = 0.5 + Math.sin(t * 20) * 0.015;
                            leftArmRef.current.position.z = 0.2;
                        }
                        if (rightArmRef.current) {
                            rightArmRef.current.rotation.x = -0.6;
                            rightArmRef.current.rotation.z = 0.3;
                            rightArmRef.current.position.y = 0.5 + Math.cos(t * 22) * 0.015;
                            rightArmRef.current.position.z = 0.2;
                        }

                        // Laptop floating
                        if (laptopRef.current) {
                            laptopRef.current.position.y = 0.4 + Math.sin(t * 3) * 0.01;
                            laptopRef.current.position.z = 0.5;
                            laptopRef.current.rotation.x = 0.1;

                            // Glitch effect on rotation
                            if (Math.random() > 0.98) {
                                laptopRef.current.position.x = (Math.random() - 0.5) * 0.05;
                            } else {
                                laptopRef.current.position.x = 0;
                            }
                        }

                    } else {
                        // === PISTOL IDLE ===
                        bodyRef.current.rotation.x = 0;
                        bodyRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;

                        if (headRef.current) {
                            // Scanning environment
                            headRef.current.rotation.y = Math.sin(t * 0.8) * 0.3;
                            headRef.current.rotation.x = -0.1;
                        }

                        // Weapon ready
                        if (leftArmRef.current) {
                            leftArmRef.current.rotation.x = 0.1;
                            leftArmRef.current.rotation.z = 0.1;
                        }
                        if (rightArmRef.current) {
                            // Holding pistol relaxedly
                            rightArmRef.current.rotation.x = -0.3;
                            rightArmRef.current.rotation.y = -0.1;
                            rightArmRef.current.rotation.z = 0;
                        }
                    }

                    // Legs Idle
                    if (leftLegRef.current) {
                        leftLegRef.current.rotation.x = 0;
                        leftLegRef.current.rotation.z = 0.05;
                    }
                    if (rightLegRef.current) {
                        rightLegRef.current.rotation.x = 0;
                        rightLegRef.current.rotation.z = -0.05;
                    }
                }
            }
        }
    });

    const armorPrimary = color;
    const armorDark = '#111';
    const armorLight = '#333';
    const laptopColor = '#1a1a1a';
    const laptopScreen = '#0f0';

    return (
        <group ref={groupRef}>
            <group ref={bodyRef}>
                {/* === CLOAK/TRENCH COAT === */}
                <group position={[0, 0.25, 0]}>
                    {/* Lower Coat Tail */}
                    <mesh position={[0, -0.25, -0.1]}>
                        <boxGeometry args={[0.26, 0.4, 0.05]} />
                        <meshStandardMaterial ref={addMatRef} color={armorDark} roughness={0.9} />
                    </mesh>
                    {/* Side Flaps */}
                    <mesh position={[0.13, -0.25, 0]}>
                        <boxGeometry args={[0.02, 0.4, 0.2]} />
                        <meshStandardMaterial ref={addMatRef} color={armorDark} roughness={0.9} />
                    </mesh>
                    <mesh position={[-0.13, -0.25, 0]}>
                        <boxGeometry args={[0.02, 0.4, 0.2]} />
                        <meshStandardMaterial ref={addMatRef} color={armorDark} roughness={0.9} />
                    </mesh>
                </group>

                {/* === TORSO === */}
                <group position={[0, 0.3, 0]}>
                    <mesh castShadow position={[0, 0.05, 0]}>
                        <boxGeometry args={[0.24, 0.35, 0.16]} />
                        <meshStandardMaterial ref={addMatRef} color={armorDark} roughness={0.6} metalness={0.1} />
                    </mesh>
                    {/* Tech Vest Plate */}
                    <mesh position={[0, 0.08, 0.09]}>
                        <boxGeometry args={[0.18, 0.15, 0.02]} />
                        <meshStandardMaterial color={armorLight} metalness={0.5} roughness={0.4} />
                    </mesh>
                    {/* Glowing Core */}
                    <mesh position={[0, 0.08, 0.105]}>
                        <planeGeometry args={[0.05, 0.05]} />
                        <meshBasicMaterial color="#0f0" />
                    </mesh>

                    {/* Backpack (Server Rack Style) */}
                    {!isMindControlling && (
                        <group position={[0, 0.1, -0.1]}>
                            <mesh castShadow>
                                <boxGeometry args={[0.22, 0.28, 0.10]} />
                                <meshStandardMaterial color="#222" roughness={0.4} metalness={0.6} />
                            </mesh>
                            {/* Server Lights */}
                            <mesh position={[-0.06, 0.05, 0.055]}>
                                <planeGeometry args={[0.02, 0.15]} />
                                <meshBasicMaterial color="#f00" />
                            </mesh>
                            <mesh position={[0.06, 0.05, 0.055]}>
                                <planeGeometry args={[0.02, 0.15]} />
                                <meshBasicMaterial color="#0f0" />
                            </mesh>
                            {/* Antenna */}
                            <mesh position={[0.08, 0.15, 0]}>
                                <cylinderGeometry args={[0.005, 0.005, 0.3]} />
                                <meshStandardMaterial color="#555" />
                            </mesh>
                        </group>
                    )}
                </group>

                {/* === HEAD (Hooded) === */}
                <group ref={headRef} position={[0, 0.65, 0]}>
                    {/* Hood Shape (Boxy) */}
                    <mesh castShadow>
                        <boxGeometry args={[0.20, 0.22, 0.22]} />
                        <meshStandardMaterial ref={addMatRef} color={armorDark} roughness={0.9} />
                    </mesh>

                    {/* Face Mask/Face */}
                    <mesh position={[0, -0.02, 0.10]} rotation={[0, 0, 0]}>
                        <boxGeometry args={[0.14, 0.14, 0.04]} />
                        <meshStandardMaterial color="#1a1a1a" />
                    </mesh>

                    {/* Cyber Visor (Strip) */}
                    <mesh position={[0, 0.02, 0.121]}>
                        <planeGeometry args={[0.14, 0.04]} />
                        <meshStandardMaterial color="#0f0" emissive="#0f0" emissiveIntensity={2} />
                    </mesh>

                    {/* Hood Rim */}
                    <mesh position={[0, 0.11, 0.05]}>
                        <boxGeometry args={[0.21, 0.02, 0.22]} />
                        <meshStandardMaterial color={armorDark} />
                    </mesh>
                </group>

                {/* === ARMS === */}
                <group ref={leftArmRef} position={[-0.18, 0.45, 0]}>
                    <mesh position={[0, -0.12, 0]}>
                        <boxGeometry args={[0.09, 0.26, 0.09]} />
                        <meshStandardMaterial color={armorDark} />
                    </mesh>
                    {/* Cyberglove */}
                    <mesh position={[0, -0.2, 0]}>
                        <boxGeometry args={[0.1, 0.12, 0.1]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                </group>

                <group ref={rightArmRef} position={[0.18, 0.45, 0]}>
                    <mesh position={[0, -0.12, 0]}>
                        <boxGeometry args={[0.09, 0.26, 0.09]} />
                        <meshStandardMaterial color={armorDark} />
                    </mesh>
                    {/* Cyberglove */}
                    <mesh position={[0, -0.2, 0]}>
                        <boxGeometry args={[0.1, 0.12, 0.1]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>

                    {/* PISTOL (Silenced Tech Pistol) */}
                    {!isMindControlling && (
                        <group ref={weaponRef} position={[0, -0.25, 0.1]}>
                            <mesh position={[0, 0.02, 0]} castShadow>
                                <boxGeometry args={[0.05, 0.08, 0.05]} />
                                <meshStandardMaterial color="#222" metalness={0.8} />
                            </mesh>
                            <mesh position={[0, 0.08, 0.05]}>
                                <boxGeometry args={[0.06, 0.06, 0.20]} />
                                <meshStandardMaterial color="#222" metalness={0.8} />
                            </mesh>
                            {/* Silencer */}
                            <mesh position={[0, 0.08, 0.20]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.02, 0.02, 0.1]} />
                                <meshStandardMaterial color="#111" />
                            </mesh>
                            {/* Laser Sight */}
                            <mesh position={[0.035, 0.08, 0.1]}>
                                <boxGeometry args={[0.01, 0.01, 0.08]} />
                                <meshBasicMaterial color="#f00" />
                            </mesh>
                        </group>
                    )}
                </group>

                {/* === LEGS === */}
                <group ref={leftLegRef} position={[-0.1, 0.15, 0]}>
                    <mesh position={[0, -0.15, 0]}>
                        <boxGeometry args={[0.11, 0.35, 0.11]} />
                        <meshStandardMaterial color="#222" roughness={0.8} />
                    </mesh>
                    {/* Knee Pad */}
                    <mesh position={[0, -0.1, 0.06]}>
                        <boxGeometry args={[0.12, 0.1, 0.02]} />
                        <meshStandardMaterial color={armorLight} />
                    </mesh>
                </group>

                <group ref={rightLegRef} position={[0.1, 0.15, 0]}>
                    <mesh position={[0, -0.15, 0]}>
                        <boxGeometry args={[0.11, 0.35, 0.11]} />
                        <meshStandardMaterial color="#222" roughness={0.8} />
                    </mesh>
                    {/* Knee Pad */}
                    <mesh position={[0, -0.1, 0.06]}>
                        <boxGeometry args={[0.12, 0.1, 0.02]} />
                        <meshStandardMaterial color={armorLight} />
                    </mesh>
                </group>

                {/* === CYBERDECK (Laptop) === */}
                {isMindControlling && (
                    <group ref={laptopRef} position={[0, 0.45, 0.4]} rotation={[0.4, 0, 0]}>
                        {/* Base (Thicker rugged deck) */}
                        <mesh position={[0, -0.01, 0]}>
                            <boxGeometry args={[0.35, 0.04, 0.22]} />
                            <meshStandardMaterial color={laptopColor} roughness={0.3} metalness={0.7} />
                        </mesh>
                        {/* Glowing keys area */}
                        <mesh position={[0, 0.015, 0.02]} rotation={[-0.1, 0, 0]}>
                            <planeGeometry args={[0.3, 0.12]} />
                            <meshBasicMaterial color="#0f0" transparent opacity={0.3} />
                        </mesh>

                        {/* Screen */}
                        <group position={[0, 0.12, -0.11]} rotation={[-0.2, 0, 0]}>
                            <mesh>
                                <boxGeometry args={[0.35, 0.25, 0.02]} />
                                <meshStandardMaterial color={laptopColor} roughness={0.3} metalness={0.7} />
                            </mesh>
                            <mesh position={[0, 0, 0.015]}>
                                <planeGeometry args={[0.32, 0.22]} />
                                <meshStandardMaterial color={laptopScreen} emissive={laptopScreen} emissiveIntensity={0.5} />
                            </mesh>
                            {/* Holographic Projection above screen */}
                            <mesh position={[0, 0.15, 0.1]} rotation={[0.2, 0, 0]}>
                                <planeGeometry args={[0.4, 0.3]} />
                                <meshBasicMaterial color="#0f0" transparent opacity={0.1} side={THREE.DoubleSide} wireframe />
                            </mesh>
                        </group>
                    </group>
                )}
            </group>
        </group>
    );
};

export default HackerModel;
