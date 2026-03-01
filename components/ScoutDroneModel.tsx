import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';

interface ScoutDroneModelProps {
    color: string;
    isMoving: boolean;
    isDying?: boolean;
}

const ScoutDroneModel: React.FC<ScoutDroneModelProps> = ({ color, isMoving, isDying }) => {
    const groupRef = useRef<Group>(null);
    const coreRef = useRef<Group>(null);
    const partRefs = useRef<Group[]>([]);
    const matRefs = useRef<MeshStandardMaterial[]>([]);
    const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

    const debris = useMemo(() => {
        return new Array(5).fill(0).map(() => ({
            velocity: new Vector3((Math.random() - 0.5) * 1.8, Math.random() * 1.8 + 0.4, (Math.random() - 0.5) * 1.8),
            rotation: new Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3)
        }));
    }, []);

    const addPartRef = (part: Group | null) => {
        if (part && !partRefs.current.includes(part)) {
            partRefs.current.push(part);
        }
    };

    const addMatRef = (mat: MeshStandardMaterial | null) => {
        if (mat && !matRefs.current.includes(mat)) {
            matRefs.current.push(mat);
        }
    };

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;

        if (isDying) {
            if (deathStartTime === null) setDeathStartTime(t);
            const elapsed = t - (deathStartTime || t);

            partRefs.current.forEach((part, index) => {
                const motion = debris[index];
                if (!part || !motion) return;

                part.position.add(motion.velocity.clone().multiplyScalar(delta));
                motion.velocity.y -= 5.2 * delta;
                part.rotation.x += motion.rotation.x * delta;
                part.rotation.y += motion.rotation.y * delta;
                part.rotation.z += motion.rotation.z * delta;
            });

            if (coreRef.current) {
                coreRef.current.scale.setScalar(Math.max(0.1, 1 - elapsed * 1.4));
            }

            const opacity = Math.max(0, 1 - elapsed * 1.2);
            matRefs.current.forEach((mat) => {
                mat.opacity = opacity;
                mat.transparent = true;
            });

            return;
        }

        const hoverBase = 0.02;
        const hoverAmp = isMoving ? 0.08 : 0.05;
        groupRef.current.position.y = hoverBase + Math.sin(t * (isMoving ? 8 : 4)) * hoverAmp;

        if (coreRef.current) {
            coreRef.current.rotation.z = Math.sin(t * 3) * 0.15;
            coreRef.current.rotation.x = Math.sin(t * 2) * 0.1;
        }
    });

    return (
        <group ref={groupRef}>
            <group ref={coreRef}>
                <mesh castShadow>
                    <boxGeometry args={[0.2, 0.15, 0.25]} />
                    <meshStandardMaterial ref={addMatRef} color="#0a0a0a" roughness={0.2} metalness={0.8} />
                </mesh>
                <mesh position={[0, 0, 0.13]}>
                    <planeGeometry args={[0.1, 0.05]} />
                    <meshBasicMaterial color={color} />
                </mesh>
            </group>

            <group>
                <group ref={addPartRef} position={[0.25, 0, 0.25]} rotation={[0, Math.PI / 4, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.4, 0.02, 0.05]} />
                        <meshStandardMaterial ref={addMatRef} color="#333" />
                    </mesh>
                </group>
                <group ref={addPartRef} position={[-0.25, 0, 0.25]} rotation={[0, -Math.PI / 4, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.4, 0.02, 0.05]} />
                        <meshStandardMaterial ref={addMatRef} color="#333" />
                    </mesh>
                </group>
                <group ref={addPartRef} position={[0.25, 0, -0.25]} rotation={[0, -Math.PI / 4, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.4, 0.02, 0.05]} />
                        <meshStandardMaterial ref={addMatRef} color="#333" />
                    </mesh>
                </group>
                <group ref={addPartRef} position={[-0.25, 0, -0.25]} rotation={[0, Math.PI / 4, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.4, 0.02, 0.05]} />
                        <meshStandardMaterial ref={addMatRef} color="#333" />
                    </mesh>
                </group>
            </group>

            <group ref={addPartRef}>
                {[
                    [0.4, 0.05, 0.4], [-0.4, 0.05, 0.4],
                    [0.4, 0.05, -0.4], [-0.4, 0.05, -0.4]
                ].map((pos, i) => (
                    <mesh key={i} position={pos as [number, number, number]}>
                        <cylinderGeometry args={[0.12, 0.12, 0.01, 8]} />
                        <meshBasicMaterial color={color} wireframe opacity={0.4} transparent />
                    </mesh>
                ))}
                <mesh position={[0, -0.15, 0]}>
                    <boxGeometry args={[0.1, 0.1, 0.1]} />
                    <meshStandardMaterial ref={addMatRef} color="#0a0a0a" roughness={0.2} metalness={0.8} opacity={0.5} transparent />
                </mesh>
            </group>
        </group>
    );
};

export default ScoutDroneModel;
