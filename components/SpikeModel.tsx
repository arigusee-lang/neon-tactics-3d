
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

interface SpikeModelProps {
    color: string;
    isAttacking?: boolean;
    isDying?: boolean;
}

const SpikeModel: React.FC<SpikeModelProps> = ({ color, isAttacking, isDying }) => {
    const groupRef = useRef<THREE.Group>(null);
    const internalRef = useRef<THREE.Group>(null);
    const ring1Ref = useRef<THREE.Mesh>(null);
    const ring2Ref = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const deathStartRef = useRef<number | null>(null);
    const [debrisVectors] = useState(() => ({
        upper: new THREE.Vector3(0.18, 0.9, -0.1).normalize().multiplyScalar(0.018),
        lower: new THREE.Vector3(-0.16, 0.55, 0.12).normalize().multiplyScalar(0.014),
        ring1: new THREE.Vector3(0.22, 0.25, 0.18).normalize().multiplyScalar(0.022),
        ring2: new THREE.Vector3(-0.2, 0.18, -0.22).normalize().multiplyScalar(0.02),
    }));

    // Helper to render the common "Matrix" material style inline
    const renderMatrixMat = (opacity = 0.8, colorOverride?: string) => (
        <>
            <meshStandardMaterial
                color={colorOverride || "#0a0a0a"}
                transparent
                opacity={opacity}
                roughness={0.2}
                metalness={0.8}
                emissive={isAttacking ? color : "#000"}
                emissiveIntensity={isAttacking ? 2 : 0}
            />
            <Edges color={color} threshold={15} scale={1.0} />
        </>
    );

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;

        if (isDying) {
            if (deathStartRef.current === null) {
                deathStartRef.current = time;
            }
            const elapsed = time - deathStartRef.current;
            const fade = Math.max(0, 1 - elapsed * 1.6);

            if (groupRef.current) {
                groupRef.current.rotation.y += delta * 1.8;
                groupRef.current.position.y -= delta * 0.15;
            }
            if (internalRef.current) {
                internalRef.current.position.addScaledVector(debrisVectors.upper, delta * 12);
                internalRef.current.rotation.x += delta * 2.5;
                internalRef.current.rotation.z += delta * 1.8;
            }
            if (ring1Ref.current) {
                ring1Ref.current.position.addScaledVector(debrisVectors.ring1, delta * 10);
                ring1Ref.current.rotation.x += delta * 5;
                ring1Ref.current.rotation.y += delta * 3;
                const material = ring1Ref.current.material as THREE.MeshBasicMaterial;
                material.opacity = 0.8 * fade;
                material.transparent = true;
            }
            if (ring2Ref.current) {
                ring2Ref.current.position.addScaledVector(debrisVectors.ring2, delta * 10);
                ring2Ref.current.rotation.x -= delta * 4;
                ring2Ref.current.rotation.z += delta * 4;
                const material = ring2Ref.current.material as THREE.MeshBasicMaterial;
                material.opacity = 0.6 * fade;
                material.transparent = true;
            }
            if (coreRef.current) {
                coreRef.current.position.addScaledVector(debrisVectors.lower, delta * 9);
                coreRef.current.scale.multiplyScalar(Math.max(0.94, fade));
                const material = coreRef.current.material as THREE.MeshBasicMaterial;
                material.transparent = true;
                material.opacity = fade;
            }
            return;
        }

        deathStartRef.current = null;

        if (internalRef.current) {
            // Hover animation
            internalRef.current.position.y = Math.sin(time * 1.5) * 0.1;
            // Slow rotation of the main body
            internalRef.current.rotation.y = time * 0.5;
        }

        // Gyroscopic Rings
        if (ring1Ref.current) {
            ring1Ref.current.rotation.x = time * 0.8;
            ring1Ref.current.rotation.y = time * 0.3;
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.x = time * -0.6;
            ring2Ref.current.rotation.z = time * 0.4;
        }

        // Core Pulse
        if (coreRef.current) {
            const pulse = isAttacking
                ? 2 + Math.sin(time * 50) * 1  // Fast flicker when attacking
                : 1 + Math.sin(time * 3) * 0.5; // Slow pulse when idle

            (coreRef.current.material as THREE.MeshBasicMaterial).color.set(color);
            coreRef.current.scale.setScalar(isAttacking ? 1.2 : 1.0);
        }
    });

    return (
        <group ref={groupRef}>
            {/* Base Projection (Holographic Base) */}
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.3, 0.7, 6]} />
                <meshBasicMaterial color={color} side={THREE.DoubleSide} wireframe transparent opacity={0.3} />
            </mesh>

            {/* Main Floating Structure */}
            <group ref={internalRef}>
                {/* Lower Crystal Shard */}
                <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI]}>
                    <coneGeometry args={[0.25, 0.8, 5]} />
                    {renderMatrixMat(0.9)}
                </mesh>

                {/* Upper Crystal Shard */}
                <mesh position={[0, 1.3, 0]}>
                    <coneGeometry args={[0.2, 1.0, 5]} />
                    {renderMatrixMat(0.9)}
                </mesh>

                {/* Central Energy Core */}
                <mesh ref={coreRef} position={[0, 0.85, 0]}>
                    <octahedronGeometry args={[0.18]} />
                    <meshBasicMaterial color={color} toneMapped={false} />
                </mesh>

                {/* Energy Connectors */}
                {[0, Math.PI * 0.66, Math.PI * 1.33].map((angle, i) => (
                    <mesh key={i} position={[Math.sin(angle) * 0.25, 0.85, Math.cos(angle) * 0.25]} rotation={[0, angle, 0]}>
                        <boxGeometry args={[0.05, 0.4, 0.05]} />
                        <meshBasicMaterial color={color} transparent opacity={0.6} />
                    </mesh>
                ))}
            </group>

            {/* Orbiting Tech Rings */}
            <group position={[0, 0.9, 0]}>
                <mesh ref={ring1Ref}>
                    <torusGeometry args={[0.5, 0.015, 4, 32]} />
                    <meshBasicMaterial color="#666" transparent opacity={0.8} />
                </mesh>
                <mesh ref={ring2Ref} scale={[0.8, 0.8, 0.8]}>
                    <torusGeometry args={[0.5, 0.015, 4, 32]} />
                    <meshBasicMaterial color="#888" transparent opacity={0.6} />
                </mesh>
            </group>
        </group>
    );
};

export default SpikeModel;
