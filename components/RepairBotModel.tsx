
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

interface RepairBotModelProps {
    color: string;
    isMoving?: boolean;
    isDying?: boolean;
    isAttacking?: boolean;
}

// Extract Wheel to avoid re-mounting issues
const Wheel = ({ position, wheelRef }: { position: [number, number, number], wheelRef: React.RefObject<Group> }) => {
    return (
        <group ref={wheelRef} position={position}>
            <group rotation={[0, 0, Math.PI / 2]}>
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 0.1, 12]} />
                    <meshStandardMaterial color="#111" />
                    <Edges color="#444" />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.12, 6]} />
                    <meshStandardMaterial color="#555" />
                </mesh>
            </group>
        </group>
    );
};

const RepairBotModel: React.FC<RepairBotModelProps> = ({ color, isMoving, isDying, isAttacking }) => {
    const groupRef = useRef<Group>(null);
    const armRef = useRef<Group>(null);
    // Removed dishRef as we aren't rotating it anymore, might as well keep it static or remove if not needed.
    // I'll keep the mesh static for the "rover" look but no ref needed for animation.

    const wheelRef1 = useRef<Group>(null);
    const wheelRef2 = useRef<Group>(null);
    const wheelRef3 = useRef<Group>(null);
    const wheelRef4 = useRef<Group>(null);

    useFrame((state) => {
        if (!groupRef.current) return;
        const time = state.clock.elapsedTime;

        if (isDying) {
            groupRef.current.rotation.x += 0.05;
            groupRef.current.position.y -= 0.05;
            return;
        }

        if (isMoving) {
            // Wheel rotation
            [wheelRef1, wheelRef2, wheelRef3, wheelRef4].forEach((ref) => {
                if (ref.current) ref.current.rotation.x -= 0.2;
            });
            // Body bounce
            groupRef.current.position.y = 0.2 + Math.sin(time * 15) * 0.02;
        } else {
            groupRef.current.position.y = 0.2 + Math.sin(time * 2) * 0.01;
        }

        // Arm animation (only when attacking/repairing)
        if (armRef.current) {
            if (isAttacking) {
                // Swinging the pick - functional animation
                armRef.current.rotation.z = Math.sin(time * 15) * 0.5;
            } else {
                // Static rest pose
                armRef.current.rotation.z = -0.2;
            }
        }
    });

    const renderMatrixMat = (opacity = 1) => (
        <>
            <meshStandardMaterial color="#222" roughness={0.7} metalness={0.5} transparent opacity={opacity} />
            <Edges color={color} threshold={15} scale={1.0} />
        </>
    );

    return (
        <group ref={groupRef} position={[0, 0.2, 0]}>
            {/* Chassis - Mars Rover Style Box */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.4, 0.15, 0.5]} />
                {renderMatrixMat()}
            </mesh>

            {/* Upper Deck / Electronics */}
            <mesh position={[0, 0.12, -0.1]}>
                <boxGeometry args={[0.3, 0.1, 0.25]} />
                <meshStandardMaterial color="#333" />
                <Edges color={color} />
            </mesh>

            {/* Cam / Head Mast */}
            <group position={[0, 0.2, 0.15]} >
                {/* Neck */}
                <mesh position={[0, -0.05, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.15]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
                {/* Head Box */}
                <mesh position={[0, 0.05, 0]}>
                    <boxGeometry args={[0.12, 0.08, 0.1]} />
                    <meshStandardMaterial color={color} />
                </mesh>
                {/* Eyes */}
                <mesh position={[0.035, 0.05, 0.051]}>
                    <planeGeometry args={[0.03, 0.03]} />
                    <meshBasicMaterial color="#0ff" />
                </mesh>
                <mesh position={[-0.035, 0.05, 0.051]}>
                    <planeGeometry args={[0.03, 0.03]} />
                    <meshBasicMaterial color="#0ff" />
                </mesh>
            </group>

            {/* Wheels */}
            <Wheel position={[0.25, -0.1, 0.2]} wheelRef={wheelRef1} />
            <Wheel position={[-0.25, -0.1, 0.2]} wheelRef={wheelRef2} />
            <Wheel position={[0.25, -0.1, -0.2]} wheelRef={wheelRef3} />
            <Wheel position={[-0.25, -0.1, -0.2]} wheelRef={wheelRef4} />

            {/* Repair Arm with PICK (Right side) */}
            <group ref={armRef} position={[0.22, 0.05, 0.0]}>
                {/* Shoulder */}
                <mesh>
                    <sphereGeometry args={[0.04]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
                {/* Main Boom */}
                {/* Angle it forward slightly */}
                <group rotation={[0, 0, -0.5]}>
                    <mesh position={[0, 0.1, 0]}>
                        <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                        <meshStandardMaterial color="#666" />
                    </mesh>
                    {/* Pick Head at end */}
                    <group position={[0, 0.2, 0]} rotation={[0, 0, 2.0]}> {/* Angle pick down */}
                        {/* Pick structure */}
                        <mesh position={[0, 0, 0]}>
                            <boxGeometry args={[0.04, 0.12, 0.04]} />
                            <meshStandardMaterial color="#555" />
                        </mesh>
                        {/* Pick Tip */}
                        <mesh position={[0, 0.08, 0]}>
                            <coneGeometry args={[0.02, 0.08, 4]} />
                            <meshStandardMaterial color={color} metalness={0.9} />
                        </mesh>
                        {/* Back spike */}
                        <mesh position={[0, -0.06, 0]}>
                            <coneGeometry args={[0.02, 0.04, 4]} />
                            <meshStandardMaterial color="#888" metalness={0.9} />
                        </mesh>
                    </group>
                </group>
            </group>

            {/* Static Antenna/Mast (No rotation) */}
            <group position={[-0.15, 0.2, -0.15]}>
                <mesh>
                    <cylinderGeometry args={[0.01, 0.01, 0.2]} />
                    <meshStandardMaterial color="#444" />
                </mesh>
                <mesh position={[0, 0.1, 0]}>
                    <sphereGeometry args={[0.02]} />
                    <meshBasicMaterial color={color} />
                </mesh>
            </group>

        </group>
    );
};

export default RepairBotModel;
