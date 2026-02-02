
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import * as THREE from 'three';

interface SniperModelProps {
    color: string;
    isMoving: boolean;
    isDying?: boolean;
    isAttacking?: boolean;
}

const SniperModel: React.FC<SniperModelProps> = ({ color, isMoving, isDying, isAttacking }) => {
    const groupRef = useRef<Group>(null);
    const bodyRef = useRef<Group>(null);
    const headRef = useRef<Group>(null);
    const leftArmRef = useRef<Group>(null);
    const rightArmRef = useRef<Group>(null);
    const leftLegRef = useRef<Group>(null);
    const rightLegRef = useRef<Group>(null);
    const cloakRef = useRef<Group>(null);
    const rifleRef = useRef<Group>(null);

    const matRefs = useRef<MeshStandardMaterial[]>([]);
    const [deathStartTime, setDeathStartTime] = useState<number | null>(null);
    const [attackStartTime, setAttackStartTime] = useState<number | null>(null);

    // Explosion vectors for death animation
    const explosionVectors = useMemo(() => ({
        head: new THREE.Vector3(0, 1, -0.5).normalize().multiplyScalar(0.025),
        lArm: new THREE.Vector3(-1, 0.5, 0.2).normalize().multiplyScalar(0.02),
        rArm: new THREE.Vector3(1, 0.5, 0.2).normalize().multiplyScalar(0.02),
        lLeg: new THREE.Vector3(-0.5, -0.5, 0).normalize().multiplyScalar(0.015),
        rLeg: new THREE.Vector3(0.5, -0.5, 0).normalize().multiplyScalar(0.015),
        cloak: new THREE.Vector3(0, 0.5, -1).normalize().multiplyScalar(0.02),
        rifle: new THREE.Vector3(1, 0.8, 0.5).normalize().multiplyScalar(0.03)
    }), []);

    const addMatRef = (mat: MeshStandardMaterial) => {
        if (mat && !matRefs.current.includes(mat)) {
            matRefs.current.push(mat);
        }
    };

    React.useEffect(() => {
        if (isAttacking) {
            setAttackStartTime(Date.now());
        } else {
            setAttackStartTime(null);
        }
    }, [isAttacking]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;

        // === DYING ANIMATION: Break apart ===
        if (isDying) {
            if (deathStartTime === null) setDeathStartTime(t);
            const elapsed = t - (deathStartTime || t);

            // Explode body parts outward
            if (headRef.current) headRef.current.position.add(explosionVectors.head);
            if (leftArmRef.current) leftArmRef.current.position.add(explosionVectors.lArm);
            if (rightArmRef.current) rightArmRef.current.position.add(explosionVectors.rArm);
            if (leftLegRef.current) leftLegRef.current.position.add(explosionVectors.lLeg);
            if (rightLegRef.current) rightLegRef.current.position.add(explosionVectors.rLeg);
            if (cloakRef.current) cloakRef.current.position.add(explosionVectors.cloak);
            if (rifleRef.current) rifleRef.current.position.add(explosionVectors.rifle);

            // Spin and shrink
            groupRef.current.rotation.y += 0.15;
            groupRef.current.scale.multiplyScalar(Math.max(0, 1 - elapsed * 1.5));

            // Fade out
            const opacity = Math.max(0, 1 - elapsed * 1.2);
            matRefs.current.forEach(mat => {
                mat.opacity = opacity;
                mat.transparent = true;
            });
            return;
        }

        // === ATTACK ANIMATION: Sniper shot ===
        if (isAttacking && attackStartTime) {
            const elapsed = (Date.now() - attackStartTime) / 1000;
            const duration = 0.8;
            const progress = Math.min(elapsed / duration, 1);

            if (progress < 0.3) {
                // Phase 1: Aiming / Steadying
                if (bodyRef.current) {
                    bodyRef.current.rotation.x = THREE.MathUtils.lerp(0, 0.15, progress / 0.3);
                }
                // Brace arms
                if (leftArmRef.current) {
                    leftArmRef.current.rotation.z = THREE.MathUtils.lerp(0.3, 0.5, progress / 0.3);
                }
            } else if (progress < 0.5) {
                // Phase 2: Recoil
                const recoilP = (progress - 0.3) / 0.2;
                if (rifleRef.current) {
                    rifleRef.current.position.z = THREE.MathUtils.lerp(0.15, 0.35, recoilP);
                }
                if (bodyRef.current) {
                    bodyRef.current.position.z = Math.sin(recoilP * Math.PI) * -0.05;
                }
            } else {
                // Phase 3: Recovery
                const recoverP = (progress - 0.5) / 0.5;
                if (rifleRef.current) {
                    rifleRef.current.position.z = THREE.MathUtils.lerp(0.35, 0.15, recoverP);
                }
                if (bodyRef.current) {
                    bodyRef.current.rotation.x = THREE.MathUtils.lerp(0.15, 0, recoverP);
                    bodyRef.current.position.z = THREE.MathUtils.lerp(-0.05, 0, recoverP);
                }
            }
            return;
        }

        // === IDLE / MOVE ANIMATION ===
        if (bodyRef.current) {
            bodyRef.current.rotation.x = 0;
            bodyRef.current.position.z = 0;

            if (isMoving) {
                // Stealthy crouched run
                groupRef.current.position.y = Math.abs(Math.sin(t * 10)) * 0.08;
                bodyRef.current.rotation.x = 0.25; // Slight crouch forward

                // Leg animation
                if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t * 10) * 0.6;
                if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t * 10 + Math.PI) * 0.6;

                // Arms steady with rifle
                if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 10) * 0.2;
                if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 10 + Math.PI) * 0.15;

                // Cloak flutter
                if (cloakRef.current) {
                    cloakRef.current.rotation.x = 0.3 + Math.sin(t * 12) * 0.15;
                }
            } else {
                // Idle: Alert stance, slight breathing
                groupRef.current.position.y = Math.sin(t * 1.5) * 0.015;

                // Subtle head scanning
                if (headRef.current) {
                    headRef.current.rotation.y = Math.sin(t * 0.8) * 0.15;
                }

                // Reset legs
                if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
                if (rightLegRef.current) rightLegRef.current.rotation.x = 0;

                // Arms at ready
                if (leftArmRef.current) {
                    leftArmRef.current.rotation.x = 0;
                    leftArmRef.current.rotation.z = 0.3;
                }
                if (rightArmRef.current) {
                    rightArmRef.current.rotation.x = -0.3;
                }

                // Cloak slight movement
                if (cloakRef.current) {
                    cloakRef.current.rotation.x = Math.sin(t * 0.5) * 0.05;
                }
            }
        }
    });

    // Color palette
    const suitColor = "#1a2a2a"; // Dark teal-black
    const armorColor = "#2a3a3a"; // Slightly lighter
    const hoodColor = "#151f1f"; // Very dark
    const metalColor = "#333333";
    const glowColor = color; // Player color for accents

    return (
        <group ref={groupRef}>
            <group ref={bodyRef}>

                {/* === HEAD WITH HOOD === */}
                <group ref={headRef} position={[0, 0.65, 0]}>
                    {/* Hood outer shell - main */}
                    <mesh position={[0, 0.05, -0.02]} castShadow>
                        <boxGeometry args={[0.22, 0.24, 0.24]} />
                        <meshStandardMaterial ref={addMatRef} color={hoodColor} roughness={0.9} />
                    </mesh>

                    {/* Hood fabric folds (voxel detail) */}
                    <mesh position={[-0.09, 0.02, 0.02]}>
                        <boxGeometry args={[0.03, 0.18, 0.18]} />
                        <meshStandardMaterial color="#0d1515" roughness={0.95} />
                    </mesh>
                    <mesh position={[0.09, 0.02, 0.02]}>
                        <boxGeometry args={[0.03, 0.18, 0.18]} />
                        <meshStandardMaterial color="#0d1515" roughness={0.95} />
                    </mesh>

                    {/* Hood peak/visor */}
                    <mesh position={[0, 0.12, 0.08]} rotation={[-0.3, 0, 0]}>
                        <boxGeometry args={[0.20, 0.06, 0.12]} />
                        <meshStandardMaterial ref={addMatRef} color={hoodColor} roughness={0.9} />
                    </mesh>

                    {/* Hood rim detail */}
                    <mesh position={[0, 0.16, 0.03]}>
                        <boxGeometry args={[0.18, 0.02, 0.22]} />
                        <meshStandardMaterial color="#1a2525" roughness={0.85} />
                    </mesh>

                    {/* Face (dark) */}
                    <mesh position={[0, 0, 0.1]}>
                        <boxGeometry args={[0.14, 0.12, 0.04]} />
                        <meshStandardMaterial color="#0a0a0a" roughness={0.8} />
                    </mesh>

                    {/* Lower face mask */}
                    <mesh position={[0, -0.04, 0.11]}>
                        <boxGeometry args={[0.12, 0.05, 0.03]} />
                        <meshStandardMaterial color="#111" roughness={0.7} />
                    </mesh>

                    {/* Night vision goggles - Left lens housing */}
                    <mesh position={[-0.045, 0.02, 0.12]}>
                        <cylinderGeometry args={[0.038, 0.038, 0.045, 8]} />
                        <meshStandardMaterial color="#080808" metalness={0.8} roughness={0.2} />
                    </mesh>
                    {/* Left lens inner ring */}
                    <mesh position={[-0.045, 0.02, 0.14]}>
                        <cylinderGeometry args={[0.035, 0.035, 0.01, 8]} />
                        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
                    </mesh>
                    {/* Left lens glow */}
                    <mesh position={[-0.045, 0.02, 0.145]}>
                        <circleGeometry args={[0.030, 8]} />
                        <meshBasicMaterial color={glowColor} />
                    </mesh>

                    {/* Night vision goggles - Right lens housing */}
                    <mesh position={[0.045, 0.02, 0.12]}>
                        <cylinderGeometry args={[0.038, 0.038, 0.045, 8]} />
                        <meshStandardMaterial color="#080808" metalness={0.8} roughness={0.2} />
                    </mesh>
                    {/* Right lens inner ring */}
                    <mesh position={[0.045, 0.02, 0.14]}>
                        <cylinderGeometry args={[0.035, 0.035, 0.01, 8]} />
                        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
                    </mesh>
                    {/* Right lens glow */}
                    <mesh position={[0.045, 0.02, 0.145]}>
                        <circleGeometry args={[0.030, 8]} />
                        <meshBasicMaterial color={glowColor} />
                    </mesh>

                    {/* Goggles bridge */}
                    <mesh position={[0, 0.02, 0.11]}>
                        <boxGeometry args={[0.025, 0.025, 0.035]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
                    </mesh>

                    {/* Goggles head strap */}
                    <mesh position={[0, 0.02, -0.01]}>
                        <boxGeometry args={[0.24, 0.02, 0.02]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>

                    {/* Antenna on hood */}
                    <mesh position={[0.08, 0.15, -0.05]}>
                        <cylinderGeometry args={[0.008, 0.005, 0.15]} />
                        <meshStandardMaterial color={metalColor} metalness={0.9} />
                    </mesh>
                    <mesh position={[0.08, 0.22, -0.05]}>
                        <sphereGeometry args={[0.012, 6, 6]} />
                        <meshBasicMaterial color={glowColor} />
                    </mesh>

                    {/* Second antenna (radio) */}
                    <mesh position={[-0.07, 0.12, -0.08]}>
                        <cylinderGeometry args={[0.006, 0.004, 0.1]} />
                        <meshStandardMaterial color="#222" metalness={0.8} />
                    </mesh>
                </group>

                {/* === TORSO === */}
                <group position={[0, 0.38, 0]}>
                    {/* Main torso - slim build */}
                    <mesh castShadow>
                        <boxGeometry args={[0.22, 0.32, 0.12]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} roughness={0.8} />
                    </mesh>

                    {/* Tactical vest base */}
                    <mesh position={[0, 0.02, 0.06]}>
                        <boxGeometry args={[0.20, 0.26, 0.02]} />
                        <meshStandardMaterial ref={addMatRef} color={armorColor} roughness={0.6} metalness={0.2} />
                    </mesh>

                    {/* Vest pouches - upper left */}
                    <mesh position={[-0.06, 0.08, 0.075]}>
                        <boxGeometry args={[0.05, 0.06, 0.02]} />
                        <meshStandardMaterial color="#1a2020" roughness={0.7} />
                    </mesh>
                    {/* Vest pouches - upper right */}
                    <mesh position={[0.06, 0.08, 0.075]}>
                        <boxGeometry args={[0.05, 0.06, 0.02]} />
                        <meshStandardMaterial color="#1a2020" roughness={0.7} />
                    </mesh>
                    {/* Vest pouches - lower left */}
                    <mesh position={[-0.06, -0.02, 0.075]}>
                        <boxGeometry args={[0.05, 0.08, 0.02]} />
                        <meshStandardMaterial color="#1a2020" roughness={0.7} />
                    </mesh>
                    {/* Vest pouches - lower right */}
                    <mesh position={[0.06, -0.02, 0.075]}>
                        <boxGeometry args={[0.05, 0.08, 0.02]} />
                        <meshStandardMaterial color="#1a2020" roughness={0.7} />
                    </mesh>

                    {/* Player color accent stripe down center */}
                    <mesh position={[0, 0.02, 0.086]}>
                        <boxGeometry args={[0.025, 0.22, 0.003]} />
                        <meshBasicMaterial color={glowColor} />
                    </mesh>

                    {/* Collar */}
                    <mesh position={[0, 0.15, 0.01]}>
                        <boxGeometry args={[0.18, 0.04, 0.10]} />
                        <meshStandardMaterial color={hoodColor} roughness={0.9} />
                    </mesh>

                    {/* Tech backpack */}
                    <group position={[0, 0.02, -0.1]}>
                        <mesh castShadow>
                            <boxGeometry args={[0.16, 0.22, 0.08]} />
                            <meshStandardMaterial ref={addMatRef} color="#121818" roughness={0.7} />
                        </mesh>
                        {/* Backpack straps */}
                        <mesh position={[-0.06, 0.02, 0.05]}>
                            <boxGeometry args={[0.02, 0.18, 0.02]} />
                            <meshStandardMaterial color="#1a1a1a" />
                        </mesh>
                        <mesh position={[0.06, 0.02, 0.05]}>
                            <boxGeometry args={[0.02, 0.18, 0.02]} />
                            <meshStandardMaterial color="#1a1a1a" />
                        </mesh>
                        {/* Ammo pouches */}
                        <mesh position={[-0.05, -0.08, 0.045]}>
                            <boxGeometry args={[0.035, 0.07, 0.03]} />
                            <meshStandardMaterial color={armorColor} />
                        </mesh>
                        <mesh position={[0.05, -0.08, 0.045]}>
                            <boxGeometry args={[0.035, 0.07, 0.03]} />
                            <meshStandardMaterial color={armorColor} />
                        </mesh>
                        {/* Status light on backpack */}
                        <mesh position={[0, 0.08, -0.04]}>
                            <boxGeometry args={[0.015, 0.015, 0.005]} />
                            <meshBasicMaterial color={glowColor} />
                        </mesh>
                    </group>

                    {/* Belt with buckle */}
                    <mesh position={[0, -0.14, 0]}>
                        <boxGeometry args={[0.24, 0.035, 0.14]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.4} />
                    </mesh>
                    {/* Belt buckle */}
                    <mesh position={[0, -0.14, 0.07]}>
                        <boxGeometry args={[0.04, 0.025, 0.01]} />
                        <meshStandardMaterial color={metalColor} metalness={0.8} />
                    </mesh>
                    {/* Side pouches on belt */}
                    <mesh position={[-0.1, -0.14, 0.05]}>
                        <boxGeometry args={[0.03, 0.04, 0.04]} />
                        <meshStandardMaterial color="#151515" />
                    </mesh>
                    <mesh position={[0.1, -0.14, 0.05]}>
                        <boxGeometry args={[0.03, 0.04, 0.04]} />
                        <meshStandardMaterial color="#151515" />
                    </mesh>
                </group>

                {/* === CLOAK / GHILLIE CAPE === */}
                <group ref={cloakRef} position={[0, 0.45, -0.08]}>
                    {/* Main cape body */}
                    <mesh position={[0, -0.25, -0.02]} rotation={[0.1, 0, 0]}>
                        <boxGeometry args={[0.35, 0.55, 0.02]} />
                        <meshStandardMaterial
                            ref={addMatRef}
                            color={hoodColor}
                            roughness={0.95}
                            side={THREE.DoubleSide}
                        />
                    </mesh>

                    {/* Ghillie/camo strips (voxel detail) */}
                    <mesh position={[-0.12, -0.15, -0.025]}>
                        <boxGeometry args={[0.04, 0.25, 0.015]} />
                        <meshStandardMaterial color="#0a1212" roughness={1} />
                    </mesh>
                    <mesh position={[0.08, -0.20, -0.025]}>
                        <boxGeometry args={[0.035, 0.30, 0.015]} />
                        <meshStandardMaterial color="#0d1515" roughness={1} />
                    </mesh>
                    <mesh position={[-0.05, -0.30, -0.025]}>
                        <boxGeometry args={[0.05, 0.20, 0.015]} />
                        <meshStandardMaterial color="#101818" roughness={1} />
                    </mesh>
                    <mesh position={[0.14, -0.35, -0.025]}>
                        <boxGeometry args={[0.04, 0.18, 0.015]} />
                        <meshStandardMaterial color="#0a1212" roughness={1} />
                    </mesh>

                    {/* Cape weathered edge */}
                    <mesh position={[0, -0.52, -0.02]}>
                        <boxGeometry args={[0.38, 0.025, 0.022]} />
                        <meshStandardMaterial color="#182020" roughness={0.9} />
                    </mesh>
                    {/* Ragged edge detail */}
                    <mesh position={[-0.1, -0.535, -0.02]}>
                        <boxGeometry args={[0.06, 0.02, 0.02]} />
                        <meshStandardMaterial color="#0d1515" />
                    </mesh>
                    <mesh position={[0.12, -0.54, -0.02]}>
                        <boxGeometry args={[0.05, 0.025, 0.02]} />
                        <meshStandardMaterial color="#0d1515" />
                    </mesh>
                </group>

                {/* === LEFT ARM (Front grip) === */}
                <group ref={leftArmRef} position={[-0.15, 0.45, 0]}>
                    {/* Shoulder pad */}
                    <mesh position={[0, 0, 0]} castShadow>
                        <boxGeometry args={[0.085, 0.085, 0.085]} />
                        <meshStandardMaterial ref={addMatRef} color={armorColor} />
                    </mesh>
                    {/* Shoulder detail */}
                    <mesh position={[-0.02, 0.02, 0.04]}>
                        <boxGeometry args={[0.02, 0.04, 0.02]} />
                        <meshStandardMaterial color="#1a2020" />
                    </mesh>
                    {/* Upper arm */}
                    <mesh position={[0, -0.1, 0]} castShadow>
                        <boxGeometry args={[0.065, 0.12, 0.065]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Forearm */}
                    <mesh position={[0.02, -0.2, 0.06]} rotation={[0.5, 0, 0.2]} castShadow>
                        <boxGeometry args={[0.055, 0.12, 0.055]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Wrist computer / datapad */}
                    <mesh position={[0.04, -0.22, 0.08]} rotation={[0.5, 0, 0.2]}>
                        <boxGeometry args={[0.035, 0.05, 0.025]} />
                        <meshStandardMaterial color="#0a0a0a" metalness={0.5} />
                    </mesh>
                    {/* Wrist screen (glow) */}
                    <mesh position={[0.055, -0.22, 0.085]} rotation={[0.5, 0.3, 0.2]}>
                        <planeGeometry args={[0.02, 0.03]} />
                        <meshBasicMaterial color={glowColor} transparent opacity={0.7} />
                    </mesh>
                    {/* Glove */}
                    <mesh position={[0.03, -0.28, 0.1]}>
                        <boxGeometry args={[0.04, 0.04, 0.04]} />
                        <meshStandardMaterial color="#0a0a0a" />
                    </mesh>
                    {/* Glove fingers detail */}
                    <mesh position={[0.03, -0.30, 0.12]}>
                        <boxGeometry args={[0.035, 0.02, 0.02]} />
                        <meshStandardMaterial color="#080808" />
                    </mesh>
                </group>

                {/* === RIGHT ARM (Trigger hand) === */}
                <group ref={rightArmRef} position={[0.15, 0.45, 0]}>
                    {/* Shoulder */}
                    <mesh position={[0, 0, 0]} castShadow>
                        <boxGeometry args={[0.08, 0.08, 0.08]} />
                        <meshStandardMaterial ref={addMatRef} color={armorColor} />
                    </mesh>
                    {/* Upper arm */}
                    <mesh position={[0, -0.1, 0]} castShadow>
                        <boxGeometry args={[0.065, 0.12, 0.065]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Forearm */}
                    <mesh position={[-0.01, -0.18, 0.05]} rotation={[0.3, 0, -0.1]} castShadow>
                        <boxGeometry args={[0.055, 0.1, 0.055]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Glove */}
                    <mesh position={[-0.01, -0.24, 0.08]}>
                        <boxGeometry args={[0.04, 0.04, 0.04]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>
                </group>

                {/* === SNIPER RIFLE (Detailed) === */}
                <group ref={rifleRef} position={[0.05, 0.32, 0.15]} rotation={[0, 0, -0.1]}>
                    {/* Stock - adjustable with cheek rest */}
                    <mesh position={[0, 0, -0.15]}>
                        <boxGeometry args={[0.04, 0.075, 0.16]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                    </mesh>
                    {/* Stock cheek rest */}
                    <mesh position={[0, 0.04, -0.12]}>
                        <boxGeometry args={[0.035, 0.025, 0.08]} />
                        <meshStandardMaterial color="#0d0d0d" roughness={0.7} />
                    </mesh>
                    {/* Stock butt pad */}
                    <mesh position={[0, 0, -0.235]}>
                        <boxGeometry args={[0.042, 0.08, 0.02]} />
                        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
                    </mesh>
                    {/* Stock adjustment holes */}
                    <mesh position={[0.022, 0, -0.18]}>
                        <boxGeometry args={[0.005, 0.05, 0.06]} />
                        <meshStandardMaterial color="#080808" />
                    </mesh>

                    {/* Receiver body */}
                    <mesh position={[0, 0.01, 0.02]}>
                        <boxGeometry args={[0.048, 0.06, 0.22]} />
                        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
                    </mesh>
                    {/* Receiver top rail */}
                    <mesh position={[0, 0.04, 0.02]}>
                        <boxGeometry args={[0.025, 0.015, 0.24]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
                    </mesh>
                    {/* Rail grooves (voxel detail) */}
                    {[-0.08, -0.04, 0, 0.04, 0.08].map((z, i) => (
                        <mesh key={i} position={[0, 0.048, z]}>
                            <boxGeometry args={[0.028, 0.003, 0.015]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                    ))}

                    {/* Bolt handle */}
                    <mesh position={[0.03, 0.015, -0.02]}>
                        <boxGeometry args={[0.025, 0.015, 0.04]} />
                        <meshStandardMaterial color="#222" metalness={0.8} />
                    </mesh>
                    {/* Bolt knob */}
                    <mesh position={[0.045, 0.015, -0.02]}>
                        <sphereGeometry args={[0.012, 6, 6]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.7} />
                    </mesh>

                    {/* Barrel shroud */}
                    <mesh position={[0, 0.01, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.022, 0.022, 0.12, 8]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
                    </mesh>
                    {/* Barrel */}
                    <mesh position={[0, 0.01, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.014, 0.016, 0.28, 8]} />
                        <meshStandardMaterial color="#222" metalness={0.9} roughness={0.2} />
                    </mesh>

                    {/* Suppressor */}
                    <mesh position={[0, 0.01, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.024, 0.024, 0.12, 8]} />
                        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.4} />
                    </mesh>
                    {/* Suppressor vents */}
                    {[0.44, 0.48, 0.52].map((z, i) => (
                        <mesh key={i} position={[0, 0.01, z]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.026, 0.026, 0.008, 8]} />
                            <meshStandardMaterial color="#080808" metalness={0.7} />
                        </mesh>
                    ))}

                    {/* Scope mount */}
                    <mesh position={[0, 0.048, 0]}>
                        <boxGeometry args={[0.03, 0.015, 0.04]} />
                        <meshStandardMaterial color="#111" metalness={0.7} />
                    </mesh>
                    <mesh position={[0, 0.048, 0.06]}>
                        <boxGeometry args={[0.03, 0.015, 0.04]} />
                        <meshStandardMaterial color="#111" metalness={0.7} />
                    </mesh>

                    {/* Scope body */}
                    <group position={[0, 0.075, 0.02]}>
                        {/* Main tube */}
                        <mesh rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.028, 0.028, 0.14, 8]} />
                            <meshStandardMaterial color="#0a0a0a" metalness={0.8} roughness={0.2} />
                        </mesh>
                        {/* Objective lens housing (front) */}
                        <mesh position={[0, 0, 0.065]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.035, 0.030, 0.025, 8]} />
                            <meshStandardMaterial color="#080808" metalness={0.7} />
                        </mesh>
                        {/* Scope lens front (glow) */}
                        <mesh position={[0, 0, 0.078]}>
                            <circleGeometry args={[0.032, 8]} />
                            <meshBasicMaterial color={glowColor} transparent opacity={0.85} />
                        </mesh>
                        {/* Eyepiece (rear) */}
                        <mesh position={[0, 0, -0.065]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.022, 0.026, 0.025, 8]} />
                            <meshStandardMaterial color="#0a0a0a" metalness={0.7} />
                        </mesh>
                        {/* Scope lens rear */}
                        <mesh position={[0, 0, -0.078]} rotation={[0, Math.PI, 0]}>
                            <circleGeometry args={[0.020, 8]} />
                            <meshBasicMaterial color={glowColor} transparent opacity={0.5} />
                        </mesh>
                        {/* Elevation turret */}
                        <mesh position={[0, 0.02, -0.02]} rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.012, 0.012, 0.025, 6]} />
                            <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
                        </mesh>
                        {/* Windage turret */}
                        <mesh position={[0.025, 0, -0.02]}>
                            <cylinderGeometry args={[0.010, 0.010, 0.02, 6]} />
                            <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
                        </mesh>
                    </group>

                    {/* Magazine - extended */}
                    <mesh position={[0, -0.045, 0.02]}>
                        <boxGeometry args={[0.028, 0.065, 0.055]} />
                        <meshStandardMaterial color="#0d0d0d" />
                    </mesh>
                    {/* Magazine base plate */}
                    <mesh position={[0, -0.08, 0.02]}>
                        <boxGeometry args={[0.032, 0.01, 0.058]} />
                        <meshStandardMaterial color="#080808" />
                    </mesh>

                    {/* Trigger guard */}
                    <mesh position={[0, -0.02, -0.02]}>
                        <boxGeometry args={[0.02, 0.025, 0.05]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>

                    {/* Bipod mount */}
                    <mesh position={[0, -0.02, 0.18]}>
                        <boxGeometry args={[0.03, 0.015, 0.025]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
                    </mesh>
                    {/* Bipod legs (folded) */}
                    <mesh position={[0.018, -0.025, 0.18]} rotation={[0, 0, 0.4]}>
                        <cylinderGeometry args={[0.005, 0.005, 0.1]} />
                        <meshStandardMaterial color={metalColor} metalness={0.8} />
                    </mesh>
                    <mesh position={[-0.018, -0.025, 0.18]} rotation={[0, 0, -0.4]}>
                        <cylinderGeometry args={[0.005, 0.005, 0.1]} />
                        <meshStandardMaterial color={metalColor} metalness={0.8} />
                    </mesh>

                    {/* Laser sight (under barrel) */}
                    <mesh position={[0, -0.02, 0.10]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.008, 0.008, 0.04, 6]} />
                        <meshStandardMaterial color="#0a0a0a" metalness={0.6} />
                    </mesh>
                    {/* Laser emitter */}
                    <mesh position={[0, -0.02, 0.12]}>
                        <circleGeometry args={[0.006, 6]} />
                        <meshBasicMaterial color={glowColor} />
                    </mesh>
                </group>

                {/* === LEGS === */}
                {/* Left Leg */}
                <group ref={leftLegRef} position={[-0.07, 0.15, 0]}>
                    {/* Thigh */}
                    <mesh position={[0, -0.08, 0]} castShadow>
                        <boxGeometry args={[0.08, 0.18, 0.08]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Knee pad */}
                    <mesh position={[0, -0.16, 0.04]}>
                        <boxGeometry args={[0.07, 0.05, 0.03]} />
                        <meshStandardMaterial color={armorColor} />
                    </mesh>
                    {/* Shin */}
                    <mesh position={[0, -0.26, 0]} castShadow>
                        <boxGeometry args={[0.07, 0.16, 0.07]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Boot */}
                    <mesh position={[0, -0.36, 0.01]}>
                        <boxGeometry args={[0.075, 0.06, 0.1]} />
                        <meshStandardMaterial color="#0a0a0a" />
                    </mesh>
                </group>

                {/* Right Leg */}
                <group ref={rightLegRef} position={[0.07, 0.15, 0]}>
                    {/* Thigh */}
                    <mesh position={[0, -0.08, 0]} castShadow>
                        <boxGeometry args={[0.08, 0.18, 0.08]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Knife holster */}
                    <mesh position={[0.045, -0.05, 0]}>
                        <boxGeometry args={[0.025, 0.1, 0.04]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    {/* Knee pad */}
                    <mesh position={[0, -0.16, 0.04]}>
                        <boxGeometry args={[0.07, 0.05, 0.03]} />
                        <meshStandardMaterial color={armorColor} />
                    </mesh>
                    {/* Shin */}
                    <mesh position={[0, -0.26, 0]} castShadow>
                        <boxGeometry args={[0.07, 0.16, 0.07]} />
                        <meshStandardMaterial ref={addMatRef} color={suitColor} />
                    </mesh>
                    {/* Boot */}
                    <mesh position={[0, -0.36, 0.01]}>
                        <boxGeometry args={[0.075, 0.06, 0.1]} />
                        <meshStandardMaterial color="#0a0a0a" />
                    </mesh>
                </group>

            </group>
        </group>
    );
};

export default SniperModel;
