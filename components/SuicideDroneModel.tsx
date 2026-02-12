
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';

interface SuicideDroneModelProps {
    color: string;
    isDying?: boolean;
    isExploding?: boolean;
}

const SuicideDroneModel: React.FC<SuicideDroneModelProps> = ({ color, isDying, isExploding }) => {
    const groupRef = useRef<Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);

    // Ref for the explosion sphere
    const explosionRef = useRef<THREE.Mesh>(null);
    const shockwaveRef = useRef<THREE.Mesh>(null);
    const sparksRef = useRef<THREE.Group>(null);

    // Parts refs for dying animation
    const partRefs = useRef<THREE.Mesh[]>([]);

    const [animStartTime, setAnimStartTime] = useState<number | null>(null);

    // Random debris for death
    const debris = useMemo(() => {
        return new Array(4).fill(0).map(() => ({
            velocity: new Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2),
            rotation: new Vector3(Math.random(), Math.random(), Math.random())
        }));
    }, []);

    // Random sparks for explosion
    const sparks = useMemo(() => {
        return new Array(8).fill(0).map(() => ({
            velocity: new Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5).normalize().multiplyScalar(Math.random() * 5 + 2)
        }));
    }, []);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;

        if (isExploding) {
            // --- EXPLOSION ANIMATION ---
            if (animStartTime === null) setAnimStartTime(time);
            const elapsed = time - (animStartTime || time);

            // 1. Core Flash & Vanish
            if (coreRef.current) {
                if (elapsed < 0.1) {
                    coreRef.current.scale.setScalar(1 + elapsed * 20); // Quick flash expansion
                    (coreRef.current.material as THREE.MeshBasicMaterial).color.set('#ffffff');
                } else {
                    coreRef.current.visible = false;
                }
            }

            // 2. Explosion sphere expands (Controlled size)
            if (explosionRef.current) {
                const scale = 1 + elapsed * 6; // Reduced from 15 to 6
                explosionRef.current.scale.set(scale, scale, scale);
                const opacity = Math.max(0, 1 - elapsed * 3); // Faster fade
                (explosionRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8;
                explosionRef.current.rotation.y += delta;
                explosionRef.current.rotation.z += delta;
            }

            // 3. Shockwave Ring (New)
            if (shockwaveRef.current) {
                const scale = 1 + elapsed * 8;
                if (scale < 5) { // Cap size
                    shockwaveRef.current.scale.set(scale, scale, 1);
                    const opacity = Math.max(0, 1 - elapsed * 2.5);
                    (shockwaveRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
                } else {
                    shockwaveRef.current.visible = false;
                }
            }

            // 4. Sparks Fly Out (New)
            if (sparksRef.current) {
                sparksRef.current.children.forEach((child, i) => {
                    const velocity = sparks[i].velocity;
                    child.position.add(velocity.clone().multiplyScalar(delta));
                    child.rotation.x += delta * 10;
                    child.rotation.y += delta * 10;
                    child.scale.multiplyScalar(0.92); // Shrink
                });
            }

            // 3. Hide original body parts quickly
            if (elapsed > 0.1) {
                partRefs.current.forEach(mesh => {
                    if (mesh) mesh.visible = false;
                });
            }

        } else if (isDying) {
            // --- REGULAR DEATH ANIMATION (Falling apart) ---
            if (animStartTime === null) setAnimStartTime(time);
            const elapsed = time - (animStartTime || time);

            partRefs.current.forEach((mesh, i) => {
                if (mesh) {
                    // Apply velocity + gravity
                    mesh.position.add(debris[i].velocity.clone().multiplyScalar(delta));
                    debris[i].velocity.y -= 9.8 * delta; // Gravity

                    // Rotate
                    mesh.rotation.x += debris[i].rotation.x * delta;
                    mesh.rotation.y += debris[i].rotation.y * delta;

                    // Floor collision
                    if (mesh.position.y < -0.5) {
                        mesh.position.y = -0.5;
                        debris[i].velocity.set(0, 0, 0);
                    }
                }
            });

            // Fade out core
            if (coreRef.current) {
                (coreRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - elapsed);
            }

        } else {
            // --- IDLE ANIMATION ---
            if (groupRef.current) {
                groupRef.current.position.y = 0.5 + Math.sin(time * 8) * 0.1; // Fast jittery hover
            }
            if (coreRef.current) {
                // Pulsing red core
                const pulse = 0.5 + Math.sin(time * 10) * 0.5;
                (coreRef.current.material as THREE.MeshBasicMaterial).color.setHSL(0, 1, 0.3 + pulse * 0.4);
            }
        }
    });

    // Helper to add parts to refs
    const addToParts = (el: THREE.Mesh | null) => {
        if (el && !partRefs.current.includes(el)) {
            partRefs.current.push(el);
        }
    }

    return (
        <group ref={groupRef}>
            {/* Explosion Sphere (Hidden unless exploding) */}
            {isExploding && (
                <group>
                    <mesh ref={explosionRef}>
                        <icosahedronGeometry args={[0.4, 1]} />
                        <meshBasicMaterial color="#ff5500" transparent opacity={0.8} wireframe={false} />
                    </mesh>
                    {/* Inner Flash Sphere */}
                    <mesh scale={[0.5, 0.5, 0.5]}>
                        <sphereGeometry args={[0.4, 8, 8]} />
                        <meshBasicMaterial color="#ffff00" transparent opacity={0.5} />
                    </mesh>

                    {/* Shockwave Ring */}
                    <mesh ref={shockwaveRef} rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[0.3, 0.45, 16]} />
                        <meshBasicMaterial color="#ffaa00" transparent opacity={0.8} side={THREE.DoubleSide} />
                    </mesh>

                    {/* Sparks */}
                    <group ref={sparksRef}>
                        {sparks.map((_, i) => (
                            <mesh key={i} position={[0, 0, 0]}>
                                <boxGeometry args={[0.05, 0.05, 0.05]} />
                                <meshBasicMaterial color="#ffffcc" />
                            </mesh>
                        ))}
                    </group>
                </group>
            )}

            {/* Central Core (Explosive Payload) */}
            <mesh ref={coreRef} position={[0, 0, 0]}>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshBasicMaterial color="#ff0000" />
            </mesh>

            {/* Body Frame Parts */}
            <group>
                {/* Top Plate */}
                <mesh ref={addToParts} position={[0, 0.25, 0]}>
                    <cylinderGeometry args={[0.15, 0.25, 0.05, 6]} />
                    <meshStandardMaterial color="#222" roughness={0.4} metalness={0.8} />
                    <Edges color={color} />
                </mesh>

                {/* Bottom Plate */}
                <mesh ref={addToParts} position={[0, -0.25, 0]}>
                    <cylinderGeometry args={[0.1, 0.05, 0.1, 6]} />
                    <meshStandardMaterial color="#222" roughness={0.4} metalness={0.8} />
                </mesh>

                {/* Side Arms / Rotors */}
                <mesh ref={addToParts} position={[0.3, 0, 0]} rotation={[0, 0, -0.5]}>
                    <boxGeometry args={[0.3, 0.05, 0.1]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                <mesh ref={addToParts} position={[-0.3, 0, 0]} rotation={[0, 0, 0.5]}>
                    <boxGeometry args={[0.3, 0.05, 0.1]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
            </group>
        </group>
    );
};

export default SuicideDroneModel;
