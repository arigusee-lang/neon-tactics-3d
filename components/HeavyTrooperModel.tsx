import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';

interface HeavyTrooperModelProps {
    color: string;
    isMoving: boolean;
    isDying?: boolean;
}

type MaterialRegister = (material: MeshStandardMaterial | null) => void;

interface RoundedPauldronProps {
    side: -1 | 1;
    trimColor: string;
    registerMaterial: MaterialRegister;
}

interface LegAssemblyProps {
    side: -1 | 1;
    legRef: React.RefObject<Group | null>;
    registerMaterial: MaterialRegister;
}

interface RotaryCannonProps {
    glowColor: string;
    registerMaterial: MaterialRegister;
    barrelGroupRef: React.RefObject<Group | null>;
}

const RoundedPauldron: React.FC<RoundedPauldronProps> = ({ side, trimColor, registerMaterial }) => {
    const mirroredRotation = side === -1 ? Math.PI : 0;

    return (
        <group position={[side * 0.01, 0.12, 0]} rotation={[0, mirroredRotation, 0]}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.18, 0.22, 0.36, 20, 1, false, Math.PI, Math.PI]} />
                <meshStandardMaterial ref={registerMaterial} color="#313131" roughness={0.42} metalness={0.74} />
            </mesh>
            <mesh castShadow position={[0, 0, 0.14]}>
                <boxGeometry args={[0.34, 0.15, 0.05]} />
                <meshStandardMaterial ref={registerMaterial} color="#4b4b4b" roughness={0.35} metalness={0.72} />
            </mesh>
            <mesh position={[0, -0.08, -0.02]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.07, 0.08, 0.14, 14]} />
                <meshStandardMaterial ref={registerMaterial} color="#151515" roughness={0.8} metalness={0.35} />
            </mesh>
            <mesh position={[0, 0.06, 0.17]}>
                <boxGeometry args={[0.18, 0.05, 0.02]} />
                <meshStandardMaterial color={trimColor} emissive={trimColor} emissiveIntensity={0.18} toneMapped={false} />
            </mesh>
            {[-0.11, 0, 0.11].map((x, index) => (
                <mesh key={index} position={[x, -0.02, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.016, 0.016, 0.025, 10]} />
                    <meshStandardMaterial ref={registerMaterial} color="#101010" roughness={0.5} metalness={0.8} />
                </mesh>
            ))}
        </group>
    );
};

const RotaryCannon: React.FC<RotaryCannonProps> = ({ glowColor, registerMaterial, barrelGroupRef }) => (
    <group position={[0.06, -0.36, 0.08]}>
        <mesh castShadow position={[0, 0.04, 0.02]}>
            <boxGeometry args={[0.26, 0.34, 0.48]} />
            <meshStandardMaterial ref={registerMaterial} color="#1f1f1f" roughness={0.46} metalness={0.8} />
        </mesh>
        <mesh castShadow position={[0.08, -0.02, 0.02]}>
            <boxGeometry args={[0.12, 0.26, 0.52]} />
            <meshStandardMaterial ref={registerMaterial} color="#2b2b2b" roughness={0.38} metalness={0.78} />
        </mesh>
        <mesh position={[-0.12, 0.08, -0.08]} rotation={[0.4, 0, 0.45]}>
            <boxGeometry args={[0.12, 0.14, 0.2]} />
            <meshStandardMaterial ref={registerMaterial} color="#141414" roughness={0.8} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.2, 0.02]}>
            <boxGeometry args={[0.16, 0.04, 0.34]} />
            <meshStandardMaterial ref={registerMaterial} color="#101010" roughness={0.82} metalness={0.4} />
        </mesh>
        <mesh position={[-0.135, 0.07, -0.04]}>
            <planeGeometry args={[0.1, 0.16]} />
            <meshBasicMaterial color={glowColor} transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh position={[0.02, 0.03, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.14, 14]} />
            <meshStandardMaterial ref={registerMaterial} color="#0e0e0e" roughness={0.44} metalness={0.9} />
        </mesh>
        <group ref={barrelGroupRef} position={[0.02, 0.03, 0.39]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.62, 12]} />
                <meshStandardMaterial ref={registerMaterial} color="#090909" roughness={0.32} metalness={0.95} />
            </mesh>
            {new Array(6).fill(0).map((_, index) => {
                const angle = (index / 6) * Math.PI * 2;

                return (
                    <mesh
                        key={index}
                        position={[Math.cos(angle) * 0.07, Math.sin(angle) * 0.07, 0]}
                        rotation={[Math.PI / 2, 0, 0]}
                    >
                        <cylinderGeometry args={[0.016, 0.02, 0.66, 8]} />
                        <meshStandardMaterial ref={registerMaterial} color="#121212" roughness={0.3} metalness={0.92} />
                    </mesh>
                );
            })}
        </group>
        <mesh position={[0.02, 0.03, 0.73]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
            <meshStandardMaterial ref={registerMaterial} color="#111111" roughness={0.36} metalness={0.9} />
        </mesh>
    </group>
);

const PowerClaw: React.FC<{ registerMaterial: MaterialRegister }> = ({ registerMaterial }) => (
    <group position={[-0.03, -0.36, 0.02]}>
        <mesh castShadow position={[0, 0.02, 0]}>
            <boxGeometry args={[0.23, 0.34, 0.26]} />
            <meshStandardMaterial ref={registerMaterial} color="#1d1d1d" roughness={0.55} metalness={0.7} />
        </mesh>
        <mesh position={[-0.11, 0.03, 0]}>
            <boxGeometry args={[0.05, 0.38, 0.3]} />
            <meshStandardMaterial ref={registerMaterial} color="#373737" roughness={0.38} metalness={0.75} />
        </mesh>
        {[-0.08, 0, 0.08].map((x, index) => (
            <group key={index} position={[x + 0.02, -0.18, 0.09]}>
                <mesh rotation={[0.55, 0, 0]}>
                    <boxGeometry args={[0.05, 0.2, 0.05]} />
                    <meshStandardMaterial ref={registerMaterial} color="#0d0d0d" roughness={0.34} metalness={0.92} />
                </mesh>
                <mesh position={[0, -0.11, 0.05]} rotation={[0.65, 0, 0]}>
                    <boxGeometry args={[0.04, 0.14, 0.04]} />
                    <meshStandardMaterial ref={registerMaterial} color="#070707" roughness={0.28} metalness={0.95} />
                </mesh>
            </group>
        ))}
        <group position={[0.11, -0.03, -0.08]} rotation={[0, 0, -0.55]}>
            <mesh>
                <boxGeometry args={[0.05, 0.18, 0.05]} />
                <meshStandardMaterial ref={registerMaterial} color="#0d0d0d" roughness={0.34} metalness={0.92} />
            </mesh>
            <mesh position={[0, -0.1, 0.03]} rotation={[0.45, 0, 0]}>
                <boxGeometry args={[0.04, 0.12, 0.04]} />
                <meshStandardMaterial ref={registerMaterial} color="#070707" roughness={0.28} metalness={0.95} />
            </mesh>
        </group>
    </group>
);

const LegAssembly: React.FC<LegAssemblyProps> = ({ side, legRef, registerMaterial }) => (
    <group ref={legRef} position={[side * 0.22, 0.26, 0]}>
        <mesh position={[0, 0.02, -0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.065, 0.07, 0.16, 12]} />
            <meshStandardMaterial ref={registerMaterial} color="#111111" roughness={0.78} metalness={0.42} />
        </mesh>
        <mesh castShadow position={[0, -0.18, 0]}>
            <boxGeometry args={[0.22, 0.3, 0.24]} />
            <meshStandardMaterial ref={registerMaterial} color="#383838" roughness={0.48} metalness={0.68} />
        </mesh>
        <mesh position={[0, -0.17, 0.13]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[0.18, 0.2, 0.05]} />
            <meshStandardMaterial ref={registerMaterial} color="#4a4a4a" roughness={0.35} metalness={0.72} />
        </mesh>
        <group position={[0, -0.4, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 12]} />
                <meshStandardMaterial ref={registerMaterial} color="#141414" roughness={0.72} metalness={0.5} />
            </mesh>
            <mesh castShadow position={[0, -0.28, -0.01]}>
                <boxGeometry args={[0.24, 0.42, 0.28]} />
                <meshStandardMaterial ref={registerMaterial} color="#212121" roughness={0.56} metalness={0.66} />
            </mesh>
            <mesh position={[0, -0.18, 0.16]} rotation={[-0.24, 0, 0]}>
                <boxGeometry args={[0.2, 0.22, 0.05]} />
                <meshStandardMaterial ref={registerMaterial} color="#565656" roughness={0.34} metalness={0.72} />
            </mesh>
            <mesh position={[side * -0.08, -0.24, -0.11]} rotation={[0.35, 0, side * 0.16]}>
                <cylinderGeometry args={[0.022, 0.022, 0.32, 8]} />
                <meshStandardMaterial ref={registerMaterial} color="#090909" roughness={0.25} metalness={0.95} />
            </mesh>
            <mesh castShadow position={[0, -0.52, 0.06]}>
                <boxGeometry args={[0.28, 0.1, 0.44]} />
                <meshStandardMaterial ref={registerMaterial} color="#101010" roughness={0.5} metalness={0.82} />
            </mesh>
            <mesh position={[0, -0.55, 0.24]}>
                <boxGeometry args={[0.26, 0.06, 0.12]} />
                <meshStandardMaterial ref={registerMaterial} color="#070707" roughness={0.38} metalness={0.88} />
            </mesh>
            <mesh position={[0, -0.46, -0.12]}>
                <boxGeometry args={[0.14, 0.06, 0.12]} />
                <meshStandardMaterial ref={registerMaterial} color="#0c0c0c" roughness={0.45} metalness={0.78} />
            </mesh>
        </group>
    </group>
);

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
        head: new Vector3(0, 1, 0.1).normalize().multiplyScalar(0.022),
        lArm: new Vector3(-1, 0.45, 0).normalize().multiplyScalar(0.022),
        rArm: new Vector3(1, 0, 0.45).normalize().multiplyScalar(0.022),
        lLeg: new Vector3(-0.45, -0.55, 0).normalize().multiplyScalar(0.016),
        rLeg: new Vector3(0.45, -0.55, 0).normalize().multiplyScalar(0.016),
        weapon: new Vector3(1, -0.15, 0.4).normalize().multiplyScalar(0.026)
    }), []);

    const addMatRef = (material: MeshStandardMaterial | null) => {
        if (material && !matRefs.current.includes(material)) {
            matRefs.current.push(material);
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

            if (headRef.current) {
                headRef.current.position.add(explosionVectors.head);
                headRef.current.rotation.x += 0.08;
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
            if (leftLegRef.current) {
                leftLegRef.current.position.add(explosionVectors.lLeg);
            }
            if (rightLegRef.current) {
                rightLegRef.current.position.add(explosionVectors.rLeg);
            }
            if (weaponRef.current) {
                weaponRef.current.position.add(explosionVectors.weapon);
                weaponRef.current.rotation.x += 0.08;
            }

            if (elapsed < 0.8) {
                groupRef.current.rotation.x = -Math.PI / 2 * (elapsed * 1.25);
                groupRef.current.position.y = Math.max(0.08, 0.18 - elapsed * 0.45);
            } else if (Math.random() > 0.82) {
                groupRef.current.position.x += (Math.random() - 0.5) * 0.008;
            }

            const opacity = Math.max(0, 1 - elapsed / 2.5);
            matRefs.current.forEach((material) => {
                material.opacity = opacity;
                material.transparent = true;
            });

            return;
        }

        if (isMoving) {
            const strideSpeed = 4.6;
            const stride = Math.sin(t * strideSpeed);
            const counterStride = Math.sin(t * strideSpeed + Math.PI);

            groupRef.current.position.y = Math.abs(stride) * 0.07;

            if (torsoRef.current) {
                torsoRef.current.rotation.z = stride * 0.035;
                torsoRef.current.rotation.y = Math.sin(t * strideSpeed * 0.5) * 0.08;
                torsoRef.current.rotation.x = 0.03;
            }

            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = counterStride * 0.28 - 0.06;
                leftArmRef.current.rotation.z = 0.12 + counterStride * 0.07;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = stride * 0.22;
                rightArmRef.current.rotation.z = -0.06;
            }

            if (leftLegRef.current) {
                leftLegRef.current.rotation.x = counterStride * 0.5;
            }
            if (rightLegRef.current) {
                rightLegRef.current.rotation.x = stride * 0.5;
            }

            if (headRef.current) {
                headRef.current.rotation.y = Math.sin(t * 2.2) * 0.05;
            }

            if (barrelRef.current) {
                barrelRef.current.rotation.z += 0.3;
            }
        } else {
            groupRef.current.position.y = Math.sin(t * 1.35) * 0.012;

            if (torsoRef.current) {
                torsoRef.current.rotation.z = 0;
                torsoRef.current.rotation.y = 0;
                torsoRef.current.rotation.x = 0;
                torsoRef.current.scale.setScalar(1 + Math.sin(t * 1.35) * 0.004);
            }

            if (headRef.current) {
                headRef.current.rotation.y = Math.sin(t * 0.6) * 0.08;
                headRef.current.rotation.x = Math.sin(t * 0.45) * 0.03;
            }

            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.06, 0.08);
                leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, 0.12, 0.08);
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, 0.1);
                rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -0.06, 0.1);
            }
            if (leftLegRef.current) {
                leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.08, 0.08);
            }
            if (rightLegRef.current) {
                rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.08, 0.08);
            }

            if (weaponRef.current) {
                weaponRef.current.rotation.x = Math.sin(t * 1.8) * 0.015;
            }

            if (barrelRef.current) {
                barrelRef.current.rotation.z += 0.05;
            }
        }
    });

    return (
        <group ref={groupRef}>
            <group ref={torsoRef} position={[0, 0.48, 0]}>
                <mesh castShadow position={[0, 0.02, -0.02]}>
                    <boxGeometry args={[0.54, 0.58, 0.42]} />
                    <meshStandardMaterial ref={addMatRef} color="#212121" roughness={0.62} metalness={0.56} />
                </mesh>
                <mesh castShadow position={[0, 0.08, 0.15]}>
                    <boxGeometry args={[0.38, 0.44, 0.13]} />
                    <meshStandardMaterial ref={addMatRef} color="#303030" roughness={0.4} metalness={0.74} />
                </mesh>
                <mesh position={[0, -0.17, 0.12]} rotation={[-0.24, 0, 0]}>
                    <boxGeometry args={[0.34, 0.14, 0.09]} />
                    <meshStandardMaterial ref={addMatRef} color="#434343" roughness={0.34} metalness={0.72} />
                </mesh>
                <mesh position={[0, 0.2, 0.11]}>
                    <boxGeometry args={[0.22, 0.1, 0.05]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} toneMapped={false} />
                </mesh>
                <mesh position={[0, 0.03, 0.22]}>
                    <planeGeometry args={[0.15, 0.2]} />
                    <meshBasicMaterial color={color} transparent opacity={0.65} toneMapped={false} />
                </mesh>
                {[-0.11, 0, 0.11].map((x, index) => (
                    <mesh key={index} position={[x, -0.08, 0.215]}>
                        <boxGeometry args={[0.06, 0.08, 0.03]} />
                        <meshStandardMaterial ref={addMatRef} color="#111111" roughness={0.45} metalness={0.82} />
                    </mesh>
                ))}
                <mesh position={[0, 0.34, -0.02]} rotation={[0.1, 0, 0]}>
                    <boxGeometry args={[0.44, 0.12, 0.26]} />
                    <meshStandardMaterial ref={addMatRef} color="#474747" roughness={0.36} metalness={0.76} />
                </mesh>

                <group position={[0, 0.05, -0.29]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.48, 0.54, 0.28]} />
                        <meshStandardMaterial ref={addMatRef} color="#161616" roughness={0.82} metalness={0.34} />
                    </mesh>
                    <mesh position={[0, 0.04, -0.14]}>
                        <boxGeometry args={[0.28, 0.3, 0.05]} />
                        <meshStandardMaterial ref={addMatRef} color="#090909" roughness={0.74} metalness={0.46} />
                    </mesh>
                    {[-0.13, 0.13].map((x, index) => (
                        <group key={index} position={[x, 0.12, 0.16]}>
                            <mesh castShadow>
                                <cylinderGeometry args={[0.06, 0.07, 0.24, 12]} />
                                <meshStandardMaterial ref={addMatRef} color="#242424" roughness={0.42} metalness={0.74} />
                            </mesh>
                            <mesh position={[0, 0.13, 0]}>
                                <cylinderGeometry args={[0.04, 0.05, 0.08, 10]} />
                                <meshStandardMaterial ref={addMatRef} color="#111111" roughness={0.34} metalness={0.88} />
                            </mesh>
                            <mesh position={[0, 0.19, 0]}>
                                <cylinderGeometry args={[0.025, 0.03, 0.05, 8]} />
                                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} toneMapped={false} />
                            </mesh>
                        </group>
                    ))}
                    <mesh position={[0, -0.12, 0.15]}>
                        <boxGeometry args={[0.36, 0.08, 0.04]} />
                        <meshStandardMaterial ref={addMatRef} color="#303030" roughness={0.48} metalness={0.7} />
                    </mesh>
                </group>

                {[-1, 1].map((side) => (
                    <group key={side} position={[side * 0.33, 0.12, -0.08]} rotation={[0, 0, side * 0.55]}>
                        <mesh>
                            <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
                            <meshStandardMaterial ref={addMatRef} color="#090909" roughness={0.28} metalness={0.94} />
                        </mesh>
                    </group>
                ))}
            </group>

            <group ref={headRef} position={[0, 0.92, 0.05]}>
                <mesh castShadow>
                    <boxGeometry args={[0.26, 0.24, 0.24]} />
                    <meshStandardMaterial ref={addMatRef} color="#2e2e2e" roughness={0.36} metalness={0.76} />
                </mesh>
                <mesh position={[0, 0.08, 0]} rotation={[0.1, 0, 0]}>
                    <boxGeometry args={[0.16, 0.04, 0.24]} />
                    <meshStandardMaterial ref={addMatRef} color="#525252" roughness={0.28} metalness={0.8} />
                </mesh>
                <mesh position={[0, -0.08, 0.13]} rotation={[0.28, 0, 0]}>
                    <boxGeometry args={[0.28, 0.1, 0.1]} />
                    <meshStandardMaterial ref={addMatRef} color="#4a4a4a" roughness={0.36} metalness={0.72} />
                </mesh>
                <mesh position={[0, 0.01, 0.13]}>
                    <boxGeometry args={[0.18, 0.04, 0.02]} />
                    <meshStandardMaterial color="#020202" roughness={0.18} metalness={1} />
                </mesh>
                <mesh position={[0, 0.01, 0.14]}>
                    <planeGeometry args={[0.1, 0.022]} />
                    <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
                </mesh>
                <mesh position={[0.12, 0.08, -0.02]} rotation={[0, 0, -0.18]}>
                    <cylinderGeometry args={[0.01, 0.01, 0.18, 6]} />
                    <meshStandardMaterial ref={addMatRef} color="#6a6a6a" roughness={0.45} metalness={0.72} />
                </mesh>
            </group>

            <group ref={leftArmRef} position={[-0.42, 0.69, 0]}>
                <RoundedPauldron side={-1} trimColor={color} registerMaterial={addMatRef} />
                <mesh position={[0, -0.1, -0.01]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.09, 0.1, 0.2, 12]} />
                    <meshStandardMaterial ref={addMatRef} color="#151515" roughness={0.76} metalness={0.38} />
                </mesh>
                <mesh castShadow position={[-0.02, -0.28, 0]}>
                    <boxGeometry args={[0.2, 0.26, 0.22]} />
                    <meshStandardMaterial ref={addMatRef} color="#242424" roughness={0.58} metalness={0.66} />
                </mesh>
                <mesh position={[-0.1, -0.28, 0.01]}>
                    <boxGeometry args={[0.05, 0.3, 0.24]} />
                    <meshStandardMaterial ref={addMatRef} color="#3e3e3e" roughness={0.36} metalness={0.74} />
                </mesh>
                <PowerClaw registerMaterial={addMatRef} />
            </group>

            <group ref={rightArmRef} position={[0.42, 0.69, 0]}>
                <RoundedPauldron side={1} trimColor={color} registerMaterial={addMatRef} />
                <mesh position={[0, -0.1, -0.01]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.09, 0.1, 0.2, 12]} />
                    <meshStandardMaterial ref={addMatRef} color="#151515" roughness={0.76} metalness={0.38} />
                </mesh>
                <mesh castShadow position={[0.02, -0.26, 0]}>
                    <boxGeometry args={[0.18, 0.22, 0.22]} />
                    <meshStandardMaterial ref={addMatRef} color="#252525" roughness={0.52} metalness={0.68} />
                </mesh>
                <group ref={weaponRef}>
                    <RotaryCannon glowColor={color} registerMaterial={addMatRef} barrelGroupRef={barrelRef} />
                </group>
            </group>

            <group position={[0, 0.1, 0]}>
                <LegAssembly side={-1} legRef={leftLegRef} registerMaterial={addMatRef} />
                <LegAssembly side={1} legRef={rightLegRef} registerMaterial={addMatRef} />
            </group>
        </group>
    );
};

export default HeavyTrooperModel;
