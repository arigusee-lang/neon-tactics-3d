import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, DoubleSide, Shape, ExtrudeGeometry, Vector3 } from 'three';
import * as THREE from 'three';

interface ArcPortalModelV2Props {
    color: string;
    isDying?: boolean;
}

const FluxTowerReplica = ({ position, scale = 1, color }: { position: [number, number, number], scale?: number, color: string }) => {
    const groupRef = useRef<Group>(null);
    const ringsRef = useRef<Group>(null);

    useFrame((state, delta) => {
        if (ringsRef.current) {
            ringsRef.current.rotation.y += delta * 0.2;
        }
    });

    return (
        <group position={position} scale={[scale, scale, scale]} ref={groupRef}>
            {/* Base */}
            <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.3, 0.4, 0.4, 8]} />
                <meshStandardMaterial color="#222" metalness={0.8} />
            </mesh>

            {/* Core Column */}
            <group position={[0, 1.2, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 2.0, 8]} />
                    <meshStandardMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={2}
                        toneMapped={false}
                    />
                </mesh>
                <mesh>
                    <cylinderGeometry args={[0.15, 0.15, 2.1, 8]} />
                    <meshStandardMaterial
                        color="#88ccff"
                        transparent
                        opacity={0.3}
                        roughness={0.1}
                        side={DoubleSide}
                    />
                </mesh>
            </group>

            {/* Scaffolding Rails */}
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, i) => (
                <group key={i} rotation={[0, rot, 0]}>
                    <mesh position={[0.22, 1.2, 0]}>
                        <boxGeometry args={[0.04, 2.0, 0.04]} />
                        <meshStandardMaterial color="#333" metalness={0.6} />
                    </mesh>
                    {[0.4, 1.2, 2.0].map((y, j) => (
                        <mesh key={j} position={[0.22, y, 0]}>
                            <boxGeometry args={[0.06, 0.08, 0.06]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                    ))}
                </group>
            ))}

            {/* Rings */}
            <group ref={ringsRef} position={[0, 1.5, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.3, 0.02, 4, 16]} />
                    <meshStandardMaterial color={color} emissive={color} />
                </mesh>
            </group>

            {/* Emitter Head */}
            <group position={[0, 2.3, 0]}>
                <mesh>
                    <octahedronGeometry args={[0.2]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
                </mesh>
            </group>
        </group>
    );
};

const ArcPortalModelV2: React.FC<ArcPortalModelV2Props> = ({ color, isDying }) => {
    const groupRef = useRef<Group>(null);
    const pedestalRef = useRef<Group>(null);
    const leftTowerRef = useRef<Group>(null);
    const rightTowerRef = useRef<Group>(null);
    const leftUrnRef = useRef<Group>(null);
    const rightUrnRef = useRef<Group>(null);
    const portalAssemblyRef = useRef<Group>(null);
    const hoodRef = useRef<Group>(null);
    const portalRef = useRef<Mesh>(null);
    const topLightsRef = useRef<Group>(null);
    const urnGlowRef = useRef<Group>(null);
    const deathStartRef = useRef<number | null>(null);
    const deathVectors = useMemo(() => ({
        pedestal: new THREE.Vector3(0, -0.12, 0.04),
        leftTower: new THREE.Vector3(-0.22, 0.18, -0.08),
        rightTower: new THREE.Vector3(0.22, 0.18, -0.08),
        leftUrn: new THREE.Vector3(-0.28, 0.14, 0.16),
        rightUrn: new THREE.Vector3(0.28, 0.14, 0.16),
        portalAssembly: new THREE.Vector3(0, 0.26, -0.18),
        hood: new THREE.Vector3(0, 0.22, -0.1)
    }), []);

    // --- GEOMETRY ---
    const { portalGeometry, topCoverGeometry } = useMemo(() => {
        // Portal Arch Shape
        const width = 1.4;
        const straightHeight = 1.8;
        const radius = width / 2; // 0.7

        const shape = new Shape();
        shape.moveTo(-width / 2, 0);
        shape.lineTo(-width / 2, straightHeight);
        shape.absarc(0, straightHeight, radius, Math.PI, 0, true);
        shape.lineTo(width / 2, 0);
        shape.lineTo(-width / 2, 0);

        const portalGeo = new ExtrudeGeometry(shape, {
            depth: 0.4,
            bevelEnabled: false,
            curveSegments: 32
        });
        portalGeo.translate(0, 0, -0.2);

        // Top Cover Arc (The Hood)
        const coverRadius = radius + 0.35;
        const hoodS = new Shape();
        hoodS.moveTo(-coverRadius, 0);
        hoodS.absarc(0, 0, coverRadius, Math.PI, 0, true);
        hoodS.lineTo(coverRadius, 0);
        hoodS.lineTo(radius, 0);
        hoodS.absarc(0, 0, radius, 0, Math.PI, false);
        hoodS.lineTo(-coverRadius, 0);

        const hoodGeo = new ExtrudeGeometry(hoodS, {
            depth: 0.5,
            bevelEnabled: true,
            bevelSize: 0.05,
            bevelThickness: 0.05
        });
        hoodGeo.translate(0, 0, -0.25);

        return { portalGeometry: portalGeo, topCoverGeometry: hoodGeo };
    }, []);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;

        if (isDying) {
            if (deathStartRef.current === null) {
                deathStartRef.current = time;
            }
            const elapsed = time - deathStartRef.current;
            const fade = Math.max(0, 1 - elapsed * 1.2);

            if (groupRef.current) {
                groupRef.current.traverse((child) => {
                    if (!(child instanceof Mesh)) return;

                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material) => {
                        if (material instanceof MeshStandardMaterial) {
                            if (material.userData.baseOpacity === undefined) {
                                material.userData.baseOpacity = material.opacity;
                            }
                            if (material.userData.baseEmissiveIntensity === undefined) {
                                material.userData.baseEmissiveIntensity = material.emissiveIntensity;
                            }
                            material.transparent = true;
                            material.opacity = material.userData.baseOpacity * fade;
                            material.emissiveIntensity = material.userData.baseEmissiveIntensity * fade;
                        } else if (material instanceof THREE.MeshBasicMaterial) {
                            if (material.userData.baseOpacity === undefined) {
                                material.userData.baseOpacity = material.opacity;
                            }
                            material.transparent = true;
                            material.opacity = material.userData.baseOpacity * fade;
                        }
                    });
                });
            }

            if (pedestalRef.current) {
                pedestalRef.current.position.addScaledVector(deathVectors.pedestal, delta * 2.5);
                pedestalRef.current.rotation.x = Math.min(0.18, pedestalRef.current.rotation.x + delta * 0.15);
            }
            if (leftTowerRef.current) {
                leftTowerRef.current.position.addScaledVector(deathVectors.leftTower, delta * 3.2);
                leftTowerRef.current.rotation.z -= delta * 1.4;
                leftTowerRef.current.rotation.x += delta * 0.8;
            }
            if (rightTowerRef.current) {
                rightTowerRef.current.position.addScaledVector(deathVectors.rightTower, delta * 3.2);
                rightTowerRef.current.rotation.z += delta * 1.4;
                rightTowerRef.current.rotation.x += delta * 0.8;
            }
            if (leftUrnRef.current) {
                leftUrnRef.current.position.addScaledVector(deathVectors.leftUrn, delta * 4.2);
                leftUrnRef.current.rotation.z -= delta * 2.2;
                leftUrnRef.current.rotation.x += delta * 1.1;
            }
            if (rightUrnRef.current) {
                rightUrnRef.current.position.addScaledVector(deathVectors.rightUrn, delta * 4.2);
                rightUrnRef.current.rotation.z += delta * 2.2;
                rightUrnRef.current.rotation.x += delta * 1.1;
            }
            if (portalAssemblyRef.current) {
                portalAssemblyRef.current.position.addScaledVector(deathVectors.portalAssembly, delta * 3.4);
                portalAssemblyRef.current.rotation.x -= delta * 0.7;
            }
            if (hoodRef.current) {
                hoodRef.current.position.addScaledVector(deathVectors.hood, delta * 4);
                hoodRef.current.rotation.x -= delta * 1.8;
            }
            if (portalRef.current) {
                portalRef.current.scale.setScalar(Math.max(0.12, 1 - elapsed * 0.55));
                portalRef.current.rotation.z += delta * 1.4;
            }
            if (topLightsRef.current) {
                topLightsRef.current.rotation.y += delta * 3.5;
            }
            if (urnGlowRef.current) {
                urnGlowRef.current.rotation.y -= delta * 1.8;
            }
            return;
        }

        deathStartRef.current = null;

        if (portalRef.current) {
            const pulse = 1.2 + Math.sin(time * 1.5) * 0.3;
            (portalRef.current.material as MeshStandardMaterial).emissiveIntensity = pulse;
            (portalRef.current.material as MeshStandardMaterial).opacity = 0.85 + Math.sin(time * 1.0) * 0.05;
            // Update color if prop changes
            (portalRef.current.material as MeshStandardMaterial).color.set(color);
            (portalRef.current.material as MeshStandardMaterial).emissive.set(color);
        }
        if (topLightsRef.current) {
            topLightsRef.current.children.forEach((light, i) => {
                if (light instanceof Mesh && light.material instanceof MeshStandardMaterial) {
                    light.material.emissiveIntensity = 2.0 + Math.sin(time * 5 + i) * 1.0;
                    light.material.color.set(color);
                    light.material.emissive.set(color);
                }
            });
        }
        if (urnGlowRef.current) {
            urnGlowRef.current.children.forEach((group) => {
                // The urn group has children: [0] cylinder (body), [1] sphere (glow)
                const glow = group.children[1];
                if (glow instanceof Mesh && glow.material instanceof MeshStandardMaterial) {
                    glow.material.emissiveIntensity = 1.5 + Math.sin(time * 2) * 0.5;
                    glow.material.color.set(color);
                    glow.material.emissive.set(color);
                }
            });
        }
    });

    // Colors
    const stoneColor = "#151515";
    const metalColor = "#333";
    const urnColor = "#222";

    // Helper for Static Lines using PLAYER COLOR
    const StaticLine = ({ args, position, rotation }: any) => (
        <mesh position={position} rotation={rotation}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
    );

    return (
        <group ref={groupRef}>
            {/* 1. PEDESTAL / PLATFORM */}
            <group ref={pedestalRef} position={[0, 0.2, -0.3]}>
                {/* Main Slab */}
                <mesh position={[0, 0, 0]} receiveShadow>
                    <boxGeometry args={[3.4, 0.4, 1.6]} />
                    <meshStandardMaterial color={stoneColor} roughness={0.8} />
                </mesh>

                {/* 2. HYBRID FRONT: CENTER SLOPE, SIDE STAIRS */}
                <group position={[0, 0, 0.8]}>

                    {/* CENTER RAMP (Width 1.2) */}
                    <group position={[0, 0, 0.4]}>
                        {/* Sloped Box */}
                        <mesh rotation={[0.46, 0, 0]}>
                            <boxGeometry args={[1.2, 0.1, 0.9]} />
                            <meshStandardMaterial color={stoneColor} />
                        </mesh>
                        {/* Player Color Lines ON RAMP Slope */}
                        <StaticLine args={[0.08, 0.02, 0.9]} position={[-0.4, 0.06, 0]} rotation={[0.46, 0, 0]} />
                        <StaticLine args={[0.08, 0.02, 0.9]} position={[0.4, 0.06, 0]} rotation={[0.46, 0, 0]} />
                    </group>

                    {/* Player Color Lines CONTINUING ON PLATFORM */}
                    <StaticLine args={[0.08, 0.02, 1.0]} position={[-0.4, 0.21, -0.5]} />
                    <StaticLine args={[0.08, 0.02, 1.0]} position={[0.4, 0.21, -0.5]} />

                    {/* SIDE STAIRS */}
                    {/* Left Stairs */}
                    <group position={[-1.15, -0.2, 0.4]}>
                        <mesh position={[0, 0.066, 0.26]}>
                            <boxGeometry args={[0.9, 0.133, 0.26]} />
                            <meshStandardMaterial color={stoneColor} />
                        </mesh>
                        <mesh position={[0, 0.2, 0]}>
                            <boxGeometry args={[0.9, 0.133, 0.26]} />
                            <meshStandardMaterial color={stoneColor} />
                        </mesh>
                        <mesh position={[0, 0.333, -0.26]}>
                            <boxGeometry args={[0.9, 0.133, 0.26]} />
                            <meshStandardMaterial color={stoneColor} />
                        </mesh>
                    </group>

                    {/* Right Stairs */}
                    <group position={[1.15, -0.2, 0.4]}>
                        <mesh position={[0, 0.066, 0.26]}>
                            <boxGeometry args={[0.9, 0.133, 0.26]} />
                            <meshStandardMaterial color={stoneColor} />
                        </mesh>
                        <mesh position={[0, 0.2, 0]}>
                            <boxGeometry args={[0.9, 0.133, 0.26]} />
                            <meshStandardMaterial color={stoneColor} />
                        </mesh>
                        <mesh position={[0, 0.333, -0.26]}>
                            <boxGeometry args={[0.9, 0.133, 0.26]} />
                            <meshStandardMaterial color={stoneColor} />
                        </mesh>
                    </group>
                </group>

            </group>

            {/* 4. FLUX TOWERS (Pulled Closer) */}
            <group ref={leftTowerRef}>
                <FluxTowerReplica position={[-1.1, 0.4, -0.3]} scale={0.9} color={color} />
            </group>
            <group ref={rightTowerRef}>
                <FluxTowerReplica position={[1.1, 0.4, -0.3]} scale={0.9} color={color} />
            </group>

            {/* URNS (Near Towers) */}
            <group ref={urnGlowRef}>
                <group ref={leftUrnRef} position={[-1.1, 0.4, 0.3]}>
                    <mesh castShadow>
                        <cylinderGeometry args={[0.15, 0.1, 0.3, 8]} />
                        <meshStandardMaterial color={urnColor} />
                    </mesh>
                    <mesh position={[0, 0.16, 0]}>
                        <sphereGeometry args={[0.1, 16, 16]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                    </mesh>
                </group>
                <group ref={rightUrnRef} position={[1.1, 0.4, 0.3]}>
                    <mesh castShadow>
                        <cylinderGeometry args={[0.15, 0.1, 0.3, 8]} />
                        <meshStandardMaterial color={urnColor} />
                    </mesh>
                    <mesh position={[0, 0.16, 0]}>
                        <sphereGeometry args={[0.1, 16, 16]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                    </mesh>
                </group>
            </group>

            {/* 5. CENTRAL PORTAL */}
            <group ref={portalAssemblyRef} position={[0, 0.4, -0.3]}>
                <mesh ref={portalRef} geometry={portalGeometry}>
                    <meshStandardMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={1.2}
                        transparent
                        opacity={0.9}
                        roughness={0.2}
                        side={DoubleSide}
                    />
                </mesh>

                {/* 6. STEEL CARCASS FRAME */}
                <group>
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[1.6, 0.2, 0.6]} />
                        <meshStandardMaterial color={metalColor} />
                    </mesh>
                    {[-0.8, 0.8].map((x, i) => (
                        <group key={i} position={[x, 1.0, 0]}>
                            <mesh position={[0, 0, 0.25]}><boxGeometry args={[0.1, 2.0, 0.1]} /><meshStandardMaterial color={metalColor} /></mesh>
                            <mesh position={[0, 0, -0.25]}><boxGeometry args={[0.1, 2.0, 0.1]} /><meshStandardMaterial color={metalColor} /></mesh>
                        </group>
                    ))}
                    {[0.6, 1.2, 1.8].map((y, i) => (
                        <group key={i} position={[0, y, 0]}>
                            <mesh position={[-0.8, 0, 0]}><boxGeometry args={[0.12, 0.05, 0.6]} /><meshStandardMaterial color={metalColor} /></mesh>
                            <mesh position={[0.8, 0, 0]}><boxGeometry args={[0.12, 0.05, 0.6]} /><meshStandardMaterial color={metalColor} /></mesh>
                        </group>
                    ))}

                    {/* 7. TOP COVER ARC (Hood) */}
                    <group ref={hoodRef} position={[0, 1.8, 0]}>
                        <mesh geometry={topCoverGeometry} castShadow receiveShadow>
                            <meshStandardMaterial color={stoneColor} metalness={0.5} roughness={0.7} />
                        </mesh>

                        {/* Player Color Lights on Top of Frame */}
                        <group ref={topLightsRef}>
                            <mesh position={[0, 0.9, 0.26]}>
                                <sphereGeometry args={[0.08]} />
                                <meshStandardMaterial color={color} emissive={color} />
                            </mesh>
                            <mesh position={[-0.5, 0.75, 0.26]} rotation={[0, 0, 0.5]}>
                                <sphereGeometry args={[0.08]} />
                                <meshStandardMaterial color={color} emissive={color} />
                            </mesh>
                            <mesh position={[0.5, 0.75, 0.26]} rotation={[0, 0, -0.5]}>
                                <sphereGeometry args={[0.08]} />
                                <meshStandardMaterial color={color} emissive={color} />
                            </mesh>
                        </group>
                    </group>
                </group>
            </group>

        </group>
    );
};

export default ArcPortalModelV2;
