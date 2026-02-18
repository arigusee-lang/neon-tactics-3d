import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, DoubleSide, AdditiveBlending, Shape, ExtrudeGeometry, Vector3, CatmullRomCurve3, TubeGeometry, BoxGeometry, CylinderGeometry } from 'three';
import * as THREE from 'three';

interface ArcPortalModelProps {
    color: string;
    isDying?: boolean;
}

const ArcPortalModel: React.FC<ArcPortalModelProps> = ({ color, isDying }) => {
    const energyRef = useRef<Mesh>(null);
    const hologramRef = useRef<Mesh>(null);
    const glowLinesRef = useRef<Group>(null);
    const generatorsRef = useRef<Group>(null);

    // --- GEOMETRY GENERATION ---
    const {
        frameGeometry,
        rimGeometry,
        portalVolumeGeometry,
        glowingLinesGeometry,
        baseGeometry,
        sideStabilizerGeometry,
        emitterNodesGeometry,
        rampGeometry
    } = useMemo(() => {
        // --- 3x3 TILE SCALE ---
        const frameDepth = 0.8;

        // Opening
        const openingWidth = 1.8;
        const openingRadius = 0.9;
        const openingStraightH = 2.0;

        // Frame
        const frameThickness = 0.35;
        const frameOuterW = openingWidth + (frameThickness * 2); // 2.5
        const frameOuterR = frameOuterW / 2; // 1.25
        const frameStraightH = openingStraightH;

        // Helpers
        const createPath = (w: number, straightH: number, r: number) => {
            const s = new Shape();
            s.moveTo(-w / 2, 0);
            s.lineTo(-w / 2, straightH);
            s.absarc(0, straightH, r, Math.PI, 0, true);
            s.lineTo(w / 2, 0);
            s.lineTo(-w / 2, 0);
            return s;
        };

        // 1. FRAME
        const outerShape = createPath(frameOuterW, frameStraightH, frameOuterR);
        const innerHole = createPath(openingWidth, openingStraightH, openingRadius);
        outerShape.holes.push(innerHole);

        const frameGeo = new ExtrudeGeometry(outerShape, {
            depth: frameDepth,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 2,
            curveSegments: 32
        });
        frameGeo.translate(0, 0, -frameDepth / 2);

        // 2. INNER RIM
        const rimOuterShape = createPath(openingWidth + 0.1, openingStraightH, openingRadius + 0.05);
        rimOuterShape.holes.push(innerHole);
        const rimGeo = new ExtrudeGeometry(rimOuterShape, {
            depth: frameDepth + 0.1,
            bevelEnabled: false,
            curveSegments: 32
        });
        rimGeo.translate(0, 0, -(frameDepth + 0.1) / 2);

        // 3. PORTAL VOLUME
        const portalGeo = new ExtrudeGeometry(innerHole, {
            depth: 0.25,
            bevelEnabled: false,
            curveSegments: 32
        });
        portalGeo.translate(0, 0, -0.125);

        // 4. GREEN GLOWING LINES (Arch Curve)
        const linePoints = [];
        const lineR = frameOuterR - 0.15;
        const lineStraightH = frameStraightH;

        linePoints.push(new Vector3(-lineR, 0, 0));
        linePoints.push(new Vector3(-lineR, lineStraightH, 0));
        const segments = 24;
        for (let i = 1; i <= segments; i++) {
            const theta = Math.PI - (i / segments) * Math.PI;
            linePoints.push(new Vector3(
                Math.cos(theta) * lineR,
                lineStraightH + Math.sin(theta) * lineR,
                0
            ));
        }
        linePoints.push(new Vector3(lineR, lineStraightH, 0));
        linePoints.push(new Vector3(lineR, 0, 0));

        const curve = new CatmullRomCurve3(linePoints);
        const glowTubeGeo = new TubeGeometry(curve, 64, 0.04, 6, false);

        // 5. BASE GEOMETRY
        const baseGeo = new THREE.BoxGeometry(3.4, 0.3, 2.0); // Slightly shorter depth to leave room for ramp

        // 6. RAMP GEOMETRY (Slope Down)
        // A wedge shape
        const w = 2.4; // Ramp width
        const h = 0.3; // Ramp max height (matches base)
        const d = 0.8; // Ramp length
        const rampShape = new Shape();
        rampShape.moveTo(-w / 2, 0);
        rampShape.lineTo(w / 2, 0);
        rampShape.lineTo(w / 2, h);
        rampShape.lineTo(-w / 2, h);
        rampShape.lineTo(-w / 2, 0);

        // Use a simple box rotated or a custom shape extruded sideways?
        // Extruding a triangle profile is easier for "Slope"
        const slopeShape = new Shape();
        slopeShape.moveTo(0, 0); // Bottom Front
        slopeShape.lineTo(0, h); // Top Back (connects to base)
        slopeShape.lineTo(d, 0); // Bottom Front (long slope)
        // Wait, standard ramp: 
        //  |\
        //  |__\

        // Let's modify: Top edge at (0, h), Bottom edge at (d, 0), Corner at (0,0)
        slopeShape.moveTo(0, 0);
        slopeShape.lineTo(0, h);
        slopeShape.lineTo(d, 0);
        slopeShape.lineTo(0, 0);

        const rampGeoEx = new ExtrudeGeometry(slopeShape, {
            depth: w,
            bevelEnabled: false
        });
        // Center the width (Z axis in extrude local)
        rampGeoEx.translate(0, 0, -w / 2);
        // Rotate to face forward (Extrude creates along Z, shape in XY)
        // We want shape profile in YZ plane? 
        // Let's just rotate the mesh later.

        // 7. SIDE STABILIZERS
        const stabShape = new Shape();
        stabShape.moveTo(0, 0);
        stabShape.lineTo(0, 1.2);
        stabShape.lineTo(0.5, 1.0);
        stabShape.lineTo(0.5, 0);
        stabShape.lineTo(0, 0);
        const stabGeo = new ExtrudeGeometry(stabShape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 });
        stabGeo.translate(0, 0, -0.3);

        // 8. EMITTER NODES
        const nodeGeo = new CylinderGeometry(0.1, 0.1, 0.3, 8);
        nodeGeo.rotateZ(Math.PI / 2);

        return {
            frameGeometry: frameGeo,
            portalVolumeGeometry: portalGeo,
            rimGeometry: rimGeo,
            glowingLinesGeometry: glowTubeGeo,
            baseGeometry: baseGeo,
            sideStabilizerGeometry: stabGeo,
            emitterNodesGeometry: nodeGeo,
            rampGeometry: rampGeoEx
        };
    }, []);

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        if (energyRef.current) {
            energyRef.current.material.opacity = 0.6 + Math.sin(time * 3) * 0.1;
            (energyRef.current.material as MeshStandardMaterial).emissiveIntensity = 1.0 + Math.sin(time * 2) * 0.5;
        }
        if (hologramRef.current) {
            hologramRef.current.position.y = 1.0 + Math.sin(time * 1.5) * 0.8;
            hologramRef.current.scale.x = 0.95 + Math.sin(time * 10) * 0.02;
        }
        if (glowLinesRef.current) {
            glowLinesRef.current.children.forEach((child) => {
                if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
                    child.material.emissiveIntensity = 3.0 + Math.sin(time * 4) * 0.5; // Brighter pulse
                }
            });
        }
    });

    if (isDying) return null;

    // Palette
    const stoneColor = "#111";
    const metalColor = "#2a2a2a";
    const darkMetal = "#151515";
    const felGreen = "#39ff14";
    const darkFel = "#003300";
    const neonCyan = "#00ffff";

    // Helper for simple glowing strips
    const GlowStrip = ({ args, position, rotation, color = felGreen }: any) => (
        <mesh position={position} rotation={rotation}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
        </mesh>
    );

    return (
        <group>
            {/* --- BASE COMPLEX --- */}
            {/* Shift base back slightly so ramp fits in 3x3 footprint (centered) */}
            <group position={[0, 0.15, -0.4]}>
                {/* Main Slab */}
                <mesh geometry={baseGeometry} receiveShadow>
                    <meshStandardMaterial color={stoneColor} roughness={0.9} />
                </mesh>
                {/* Tech Grate Top */}
                <mesh position={[0, 0.16, 0]}>
                    <boxGeometry args={[3.0, 0.02, 1.8]} />
                    <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />
                </mesh>

                {/* Base Glowing Lines (Left and Right running back to front) */}
                <GlowStrip args={[0.05, 0.02, 2.0]} position={[-1.2, 0.16, 0]} />
                <GlowStrip args={[0.05, 0.02, 2.0]} position={[1.2, 0.16, 0]} />
                <GlowStrip args={[0.05, 0.02, 2.0]} position={[-0.8, 0.16, 0]} />
                <GlowStrip args={[0.05, 0.02, 2.0]} position={[0.8, 0.16, 0]} />
            </group>

            {/* --- FRONT RAMP (Slope Down) --- */}
            {/* Base ends at Z = -0.4 + 1.0 = 0.6. Ramp starts there. */}
            <group position={[0, 0, 0.6]}>
                {/* Extruded Shape is in XY, extruded along Z. 
                     Profile was: (0,0) -> (0,h) -> (d,0). 
                     We need to rotate it to match floor. 
                     Y is Up. Z is Forward.
                     Shape in XY: Y is height. X is Depth?
                 */}
                <mesh geometry={rampGeometry} rotation={[0, -Math.PI / 2, 0]}>
                    <meshStandardMaterial color={stoneColor} roughness={0.9} />
                </mesh>

                {/* Ramp Decals/Lines continued from base */}
                {/* Sloped lines. Ramp length 0.8, height 0.3. Angle approx 20deg. */}
                {/* Position them manually on the slope surface */}
                <group rotation={[0.36, 0, 0]} position={[0, 0.15, 0.4]}>
                    {/* 0.36 rad is approx angle for 0.3/0.8 rise/run */}
                    <GlowStrip args={[0.05, 0.02, 0.85]} position={[-1.2, 0, 0]} />
                    <GlowStrip args={[0.05, 0.02, 0.85]} position={[1.2, 0, 0]} />
                    <GlowStrip args={[0.05, 0.02, 0.85]} position={[-0.8, 0, 0]} />
                    <GlowStrip args={[0.05, 0.02, 0.85]} position={[0.8, 0, 0]} />
                </group>
            </group>

            {/* --- ARCH STRUCTURE --- */}
            {/* Centered on the main base slab */}
            <group position={[0, 0.3, -0.4]}>

                {/* 1. Stone Frame */}
                <mesh geometry={frameGeometry} castShadow receiveShadow>
                    <meshStandardMaterial color={stoneColor} roughness={0.7} />
                </mesh>

                {/* 2. Metal Liner */}
                <mesh geometry={rimGeometry}>
                    <meshStandardMaterial color={metalColor} metalness={0.8} />
                </mesh>

                {/* 3. Side Stabilizers */}
                <group position={[-1.4, 0, 0]}>
                    <mesh geometry={sideStabilizerGeometry}>
                        <meshStandardMaterial color={darkMetal} />
                    </mesh>
                    {/* Vertical Green Line on Stabilizer */}
                    <GlowStrip args={[0.1, 0.8, 0.05]} position={[0.26, 0.6, 0.32]} />
                </group>
                <group position={[1.4, 0, 0]} scale={[-1, 1, 1]}>
                    <mesh geometry={sideStabilizerGeometry}>
                        <meshStandardMaterial color={darkMetal} />
                    </mesh>
                    <GlowStrip args={[0.1, 0.8, 0.05]} position={[0.26, 0.6, 0.32]} />
                </group>

                {/* 4. Power Generators */}
                <group ref={generatorsRef}>
                    <mesh position={[-1.8, 0.5, 0.5]}>
                        <cylinderGeometry args={[0.15, 0.15, 0.8, 8]} />
                        <meshStandardMaterial color={metalColor} />
                    </mesh>
                    <mesh position={[1.8, 0.5, 0.5]}>
                        <cylinderGeometry args={[0.15, 0.15, 0.8, 8]} />
                        <meshStandardMaterial color={metalColor} />
                    </mesh>
                    {/* Green Rings on Generators */}
                    <mesh position={[-1.8, 0.5, 0.5]}>
                        <cylinderGeometry args={[0.16, 0.16, 0.05, 8]} />
                        <meshBasicMaterial color={felGreen} />
                    </mesh>
                    <mesh position={[1.8, 0.5, 0.5]}>
                        <cylinderGeometry args={[0.16, 0.16, 0.05, 8]} />
                        <meshBasicMaterial color={felGreen} />
                    </mesh>
                </group>

                {/* 5. Glowing Lines Group (Pipes + New Side Lines) */}
                <group ref={glowLinesRef}>
                    {/* Arch Curve Pipes */}
                    <mesh geometry={glowingLinesGeometry} position={[0, 0, 0.42]}>
                        <meshStandardMaterial color={felGreen} emissive={felGreen} emissiveIntensity={2} toneMapped={false} />
                    </mesh>
                    <mesh geometry={glowingLinesGeometry} position={[0, 0, -0.42]}>
                        <meshStandardMaterial color={felGreen} emissive={felGreen} emissiveIntensity={2} toneMapped={false} />
                    </mesh>

                    {/* NEW: Vertical Side Lines on Pillars */}
                    {/* Left Pillar Front */}
                    <GlowStrip args={[0.05, 1.8, 0.02]} position={[-1.3, 0.9, 0.41]} />
                    <GlowStrip args={[0.05, 1.8, 0.02]} position={[-1.1, 2.0, 0.41]} /> {/* Upper Segment */}
                    {/* Right Pillar Front */}
                    <GlowStrip args={[0.05, 1.8, 0.02]} position={[1.3, 0.9, 0.41]} />
                    <GlowStrip args={[0.05, 1.8, 0.02]} position={[1.1, 2.0, 0.41]} />

                    {/* Back Side lines */}
                    <GlowStrip args={[0.05, 1.8, 0.02]} position={[-1.3, 0.9, -0.41]} />
                    <GlowStrip args={[0.05, 1.8, 0.02]} position={[1.3, 0.9, -0.41]} />
                </group>

                {/* 6. Emitter Nodes */}
                {[0.4, 0.8, 1.2, 1.6].map((y, i) => (
                    <group key={i}>
                        <mesh geometry={emitterNodesGeometry} position={[-0.9, y, 0]}>
                            <meshStandardMaterial color={darkMetal} />
                        </mesh>
                        <mesh geometry={emitterNodesGeometry} position={[0.9, y, 0]} rotation={[0, 0, Math.PI]}>
                            <meshStandardMaterial color={darkMetal} />
                        </mesh>
                        <GlowStrip args={[0.05, 0.1, 0.1]} position={[-0.8, y, 0]} />
                        <GlowStrip args={[0.05, 0.1, 0.1]} position={[0.8, y, 0]} />
                    </group>
                ))}

                {/* 7. Portal Volume */}
                <group position={[0, 0, 0]}>
                    <mesh ref={energyRef} geometry={portalVolumeGeometry} position={[0, 0, 0]}>
                        <meshStandardMaterial
                            color={darkFel}
                            emissive={felGreen}
                            emissiveIntensity={1.0}
                            transparent
                            opacity={0.8}
                            roughness={0.1}
                            side={DoubleSide}
                        />
                    </mesh>

                    {/* Floating Runes */}
                    {[0.6, 1.2, 1.8, 2.4].map((y, i) => (
                        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 4, 0, 0]}>
                            <torusGeometry args={[0.3 + i * 0.1, 0.01, 4, 16]} />
                            <meshBasicMaterial color={felGreen} transparent opacity={0.4} />
                        </mesh>
                    ))}

                    <mesh ref={hologramRef} position={[0, 1.0, 0]}>
                        <boxGeometry args={[1.6, 0.02, 0.25]} />
                        <meshBasicMaterial color={felGreen} transparent opacity={0.6} blending={AdditiveBlending} />
                    </mesh>
                </group>

                {/* 8. Keystone Detail */}
                <group position={[0, 3.1, 0]}>
                    <mesh>
                        <boxGeometry args={[0.5, 0.8, 0.7]} />
                        <meshStandardMaterial color={stoneColor} />
                    </mesh>
                    <GlowStrip args={[0.3, 0.1, 0.72]} position={[0, 0, 0]} /> {/* Clean Glowing Band */}
                </group>

            </group>
        </group>
    );
};

export default ArcPortalModel;
