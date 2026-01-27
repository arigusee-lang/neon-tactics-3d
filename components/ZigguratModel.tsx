
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { Edges, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// --- Reusable Voxel Component ---
const VoxelBox = ({ 
    position, 
    size, 
    color, 
    emissive = false, 
    emissiveIntensity = 2.0,
    opacity = 1, 
    transparent = false,
    wireframe = false,
    roughness = 0.2,
    metalness = 0.8
}: { 
    position: [number, number, number], 
    size: [number, number, number], 
    color: string, 
    emissive?: boolean, 
    emissiveIntensity?: number,
    opacity?: number, 
    transparent?: boolean,
    wireframe?: boolean,
    roughness?: number,
    metalness?: number
}) => (
  <mesh position={position}>
    <boxGeometry args={size} />
    <meshStandardMaterial 
      color={color} 
      emissive={emissive ? color : '#000000'}
      emissiveIntensity={emissive ? emissiveIntensity : 0}
      roughness={roughness} 
      metalness={metalness} 
      transparent={transparent}
      opacity={opacity}
      wireframe={wireframe}
    />
    {!wireframe && <Edges color={emissive ? '#ffffff' : '#003300'} threshold={15} scale={1.01} opacity={0.3} transparent />}
  </mesh>
);

// --- Slime Stream Effect (Legacy, kept for Naxxramas) ---
const SlimeStream = ({ height = 15, width = 2, color="#00ff00" }: { height?: number, width?: number, color?: string }) => {
    const group = useRef<Group>(null);
    const particleCount = 40;
    
    const drops = useMemo(() => new Array(particleCount).fill(0).map((_, i) => ({
        pos: new THREE.Vector3(
            (Math.random() - 0.5) * width, 
            -(Math.random() * height), 
            (Math.random() - 0.5) * width
        ),
        speed: 0.1 + Math.random() * 0.1,
        scale: new THREE.Vector3(
            0.2 + Math.random() * 0.3,
            0.8 + Math.random() * 1.5,
            0.2 + Math.random() * 0.3
        )
    })), [height, width]);

    useFrame(() => {
        if (!group.current) return;
        group.current.children.forEach((child, i) => {
            const d = drops[i];
            child.position.y -= d.speed;
            if (child.position.y < -height) {
                child.position.y = 0;
            }
        });
    });

    return (
        <group ref={group} position={[0, -1, 0]}>
            {drops.map((d, i) => (
                <mesh key={i} position={d.pos}>
                    <boxGeometry args={[d.scale.x, d.scale.y, d.scale.z]} />
                    <meshBasicMaterial color={color} transparent opacity={0.6} />
                </mesh>
            ))}
        </group>
    )
}

// --- Original Cyber Ziggurat ---
const CyberZiggurat = ({ position }: { position: [number, number, number] }) => {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 0.3) * 0.5;
    }
    if (ringRef.current) {
        ringRef.current.rotation.y -= 0.005;
        ringRef.current.rotation.z = Math.sin(t * 0.2) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={[0.35, 0.35, 0.35]}>
        <group>
            <VoxelBox position={[0, 4, 0]} size={[8, 1, 8]} color="#051a05" /> 
            <VoxelBox position={[0, 4.5, 0]} size={[6, 2, 6]} color="#0a2a0a" />
            <VoxelBox position={[0, 2.5, 0]} size={[12, 2, 12]} color="#020a02" />
            <VoxelBox position={[6.1, 2.5, 0]} size={[0.2, 2, 4]} color="#114411" />
            <VoxelBox position={[-6.1, 2.5, 0]} size={[0.2, 2, 4]} color="#114411" />
            <VoxelBox position={[0, 0.5, 0]} size={[16, 2, 16]} color="#051a05" />
            <VoxelBox position={[0, 0.5, 8.1]} size={[8, 1, 0.2]} color="#1a4a1a" />
            <VoxelBox position={[0, -1.5, 0]} size={[12, 2, 12]} color="#020a02" />
            <VoxelBox position={[0, -3.5, 0]} size={[8, 2, 8]} color="#051a05" />
            <VoxelBox position={[0, -5, 0]} size={[4, 1, 4]} color="#000000" />
        </group>

        <group position={[0, 6, 0]}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh>
                    <octahedronGeometry args={[1.5]} />
                    <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={1} wireframe />
                </mesh>
                <mesh>
                    <octahedronGeometry args={[1.0]} />
                    <meshStandardMaterial color="#ccffcc" emissive="#00ff00" emissiveIntensity={2} />
                </mesh>
            </Float>
        </group>

        <group position={[0, -5.5, 0]}>
             <mesh>
                 <cylinderGeometry args={[2.0, 0.5, 1, 8]} />
                 <meshStandardMaterial color="#051a05" />
             </mesh>
             <mesh position={[0, -0.5, 0]}>
                 <cylinderGeometry args={[1.5, 1.5, 0.1, 8]} />
                 <meshBasicMaterial color="#00ff00" />
             </mesh>
             <SlimeStream height={20} width={2.5} />
        </group>

        <group ref={ringRef}>
            {new Array(12).fill(0).map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const radius = 12 + Math.random() * 2;
                return (
                    <group key={i} position={[Math.cos(angle) * radius, (Math.random()-0.5)*2, Math.sin(angle) * radius]} rotation={[Math.random(), Math.random(), Math.random()]}>
                        <VoxelBox position={[0,0,0]} size={[0.8, 0.8, 0.8]} color="#1a3a1a" />
                    </group>
                )
            })}
        </group>
        <pointLight position={[0, -8, 0]} color="#00ff00" intensity={5} distance={20} decay={2} />
    </group>
  );
};

// --- Naxxramas Style Fortress ---
const NaxxramasModel = ({ position }: { position: [number, number, number] }) => {
    const groupRef = useRef<Group>(null);
    
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (groupRef.current) {
            groupRef.current.position.y = position[1] + Math.sin(t * 0.2 + 2) * 0.8;
            groupRef.current.rotation.y = Math.sin(t * 0.03) * 0.05;
        }
    });

    const fortressColor = "#333333";
    const darkStone = "#1a1a1a";
    const slimeColor = "#32CD32";

    return (
        <group ref={groupRef} position={position} scale={[0.4, 0.4, 0.4]} rotation={[0, -Math.PI/6, 0]}>
            <group>
                <VoxelBox position={[0, 0, 0]} size={[20, 4, 20]} color={fortressColor} roughness={0.8} metalness={0.2} />
                <VoxelBox position={[0, 2.1, 0]} size={[18, 1, 18]} color={darkStone} />
                <VoxelBox position={[0, -3, 0]} size={[14, 2, 14]} color={fortressColor} />
                <VoxelBox position={[0, -5, 0]} size={[8, 2, 8]} color={darkStone} />
                <VoxelBox position={[0, -7, 0]} size={[4, 2, 4]} color="#000" />
            </group>
            <group position={[0, 2, 0]}>
                <VoxelBox position={[0, 1, 0]} size={[10, 2, 10]} color={darkStone} />
                <VoxelBox position={[0, 3, 0]} size={[7, 2, 7]} color={fortressColor} />
                <VoxelBox position={[0, 5, 0]} size={[4, 3, 4]} color={darkStone} />
                <mesh position={[0, 7.5, 0]}>
                    <octahedronGeometry args={[1.5]} />
                    <meshStandardMaterial color={slimeColor} emissive={slimeColor} emissiveIntensity={2} />
                </mesh>
            </group>
            {[
                { pos: [10, 0, 10], rot: 0 },
                { pos: [-10, 0, 10], rot: Math.PI/2 },
                { pos: [10, 0, -10], rot: -Math.PI/2 },
                { pos: [-10, 0, -10], rot: Math.PI }
            ].map((wing, i) => (
                <group key={i} position={wing.pos as any}>
                     <VoxelBox position={[0, 2, 0]} size={[6, 8, 6]} color={fortressColor} />
                     <VoxelBox position={[0, 6.5, 0]} size={[4, 2, 4]} color={darkStone} />
                     <VoxelBox position={[0, 8, 0]} size={[2, 3, 2]} color={darkStone} />
                     <mesh position={[0, 10.5, 0]}>
                         <coneGeometry args={[2, 3, 4]} />
                         <meshStandardMaterial color="#111" />
                     </mesh>
                     <group lookAt={new THREE.Vector3(0, 0, 0)}>
                         <VoxelBox position={[0, 0, 3.1]} size={[3, 4, 0.5]} color="#000" emissive emissiveIntensity={0.2} />
                         <pointLight position={[0, 0, 4]} color={slimeColor} distance={5} intensity={1} />
                     </group>
                     <group position={[3.5, -2, 0]} rotation={[0, 0, -0.2]}>
                         <SlimeStream height={12} width={1.5} color={slimeColor} />
                         <VoxelBox position={[-0.5, 3, 0]} size={[1, 1, 2]} color={darkStone} />
                     </group>
                </group>
            ))}
            {[
                [8, 5, 8], [-8, 5, 8], [8, 5, -8], [-8, 5, -8]
            ].map((pos, i) => (
                <mesh key={i} position={pos as any} rotation={[0, 0, 0]}>
                    <cylinderGeometry args={[0.2, 0.2, 5]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
            ))}
            <Sparkles count={100} scale={25} size={8} color={slimeColor} opacity={0.3} speed={0.2} />
        </group>
    );
}

// --- Deployment Ship (Zeppelin Style) ---
const DeploymentShipModel = ({ position }: { position: [number, number, number] }) => {
    const groupRef = useRef<Group>(null);
    const ringRef = useRef<Group>(null);
    
    // Hover animation
    useFrame((state) => {
        // Disabled floating animation as requested
        if (ringRef.current) {
            ringRef.current.rotation.z -= 0.02;
        }
    });

    const hullColor = "#2a2a2a";
    const neonGreen = "#39ff14";
    const darkMetal = "#111";

    return (
        <group ref={groupRef} position={position} scale={[1, 1, 1]}>
            {/* --- Main Hull (Zeppelin) --- */}
            <group rotation={[0, 0, 0]}> 
                {/* Central Body - Elongated Sphere */}
                <group scale={[1, 1, 2.5]}> 
                    <mesh castShadow>
                        <sphereGeometry args={[2.5, 32, 32]} />
                        <meshStandardMaterial color={hullColor} roughness={0.3} metalness={0.8} />
                    </mesh>
                     {/* Wireframe Tech Overlay */}
                     <mesh scale={[1.02, 1.02, 1.02]}>
                        <sphereGeometry args={[2.5, 16, 16]} />
                        <meshBasicMaterial color={neonGreen} wireframe transparent opacity={0.05} />
                     </mesh>
                </group>

                {/* Armor Ribs (Breaks up the 'cucumber' look) */}
                <group scale={[1.1, 1.1, 1.8]}>
                    <mesh rotation={[Math.PI/2, 0, 0]}>
                         <cylinderGeometry args={[2.4, 2.4, 1, 8]} />
                         <meshStandardMaterial color={darkMetal} roughness={0.5} metalness={0.9} />
                    </mesh>
                    <mesh position={[0, 0, 0.8]} rotation={[Math.PI/2, 0, 0]}>
                         <cylinderGeometry args={[2.2, 2.2, 0.5, 8]} />
                         <meshStandardMaterial color={darkMetal} roughness={0.5} metalness={0.9} />
                    </mesh>
                    <mesh position={[0, 0, -0.8]} rotation={[Math.PI/2, 0, 0]}>
                         <cylinderGeometry args={[2.2, 2.2, 0.5, 8]} />
                         <meshStandardMaterial color={darkMetal} roughness={0.5} metalness={0.9} />
                    </mesh>
                </group>

                {/* Bridge / Cockpit (Front Top) */}
                <group position={[0, 1.5, 3]}>
                     <mesh>
                         <boxGeometry args={[1.5, 0.8, 2]} />
                         <meshStandardMaterial color={darkMetal} />
                     </mesh>
                     <mesh position={[0, 0.2, 0.5]}>
                         <boxGeometry args={[1.2, 0.4, 1.2]} />
                         <meshStandardMaterial color={neonGreen} emissive={neonGreen} emissiveIntensity={1} />
                     </mesh>
                </group>
                
                {/* Side Engines / Stabilizers */}
                {[-1, 1].map((side) => (
                    <group key={side} position={[side * 2.2, 0, -1]}>
                        <mesh rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.8, 0.6, 3, 16]} />
                            <meshStandardMaterial color={darkMetal} />
                        </mesh>
                        {/* Engine Glow Back */}
                        <mesh position={[0, 0, -1.6]} rotation={[Math.PI/2, 0, 0]}>
                            <circleGeometry args={[0.5, 16]} />
                            <meshBasicMaterial color={neonGreen} />
                        </mesh>
                        {/* Wing Connector */}
                        <mesh position={[side * -0.6, 0, 0]}>
                            <boxGeometry args={[1, 0.2, 2]} />
                            <meshStandardMaterial color={hullColor} />
                        </mesh>
                    </group>
                ))}

                {/* Bottom Deployment Bay */}
                <group position={[0, -2.2, 0]}>
                     <mesh>
                         <cylinderGeometry args={[1.5, 1.5, 0.5, 16]} />
                         <meshStandardMaterial color={darkMetal} />
                     </mesh>
                     <mesh position={[0, -0.26, 0]} rotation={[-Math.PI/2, 0, 0]}>
                         <ringGeometry args={[0.5, 1.4, 32]} />
                         <meshBasicMaterial color={neonGreen} side={THREE.DoubleSide} />
                     </mesh>
                </group>
            </group>

            {/* --- Deployment Beam (Cone of Light) --- */}
            <group position={[0, -2.5, 0]}>
                 {/* The Beam itself */}
                 <mesh position={[0, -6, 0]}> 
                     <cylinderGeometry args={[1.5, 4, 12, 32, 1, true]} />
                     <meshBasicMaterial color={neonGreen} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
                 </mesh>
                 
                 {/* Inner stronger beam */}
                  <mesh position={[0, -6, 0]}>
                     <cylinderGeometry args={[0.5, 2, 12, 16, 1, true]} />
                     <meshBasicMaterial color="white" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
                 </mesh>
            </group>

            {/* --- Ground Projection (Landing Zone) --- */}
            {/* Ship is at y=10 roughly. Ground is at y=0. Relative y should correspond to negative height. */}
             <group position={[0, -position[1] + 0.1, 0]}>
                 <group ref={ringRef} rotation={[-Math.PI/2, 0, 0]}>
                     <mesh>
                         <ringGeometry args={[3.5, 4, 64]} />
                         <meshBasicMaterial color={neonGreen} transparent opacity={0.5} />
                     </mesh>
                     <mesh>
                         <circleGeometry args={[3.5, 64]} />
                         <meshBasicMaterial color={neonGreen} transparent opacity={0.1} />
                     </mesh>
                     {/* Rotating Runes */}
                     {[0, Math.PI/2, Math.PI, -Math.PI/2].map((rot, i) => (
                        <mesh key={i} rotation={[0, 0, rot]} position={[2.8, 0, 0]}>
                            <planeGeometry args={[0.8, 0.8]} />
                            <meshBasicMaterial color={neonGreen} transparent opacity={0.6} side={THREE.DoubleSide} />
                        </mesh>
                    ))}
                 </group>
             </group>
             
             {/* SpotLight pointing down */}
             <spotLight position={[0, -2, 0]} target-position={[0, -20, 0]} angle={0.4} penumbra={0.5} intensity={8} color={neonGreen} distance={40} />
        </group>
    );
};

const ZigguratModel: React.FC = () => {
  return (
      <group>
          {/* Original Enhanced Cyber Ziggurat */}
          <CyberZiggurat position={[-15, 6, -5]} />
          
          {/* New Naxxramas Style Fortress */}
          <NaxxramasModel position={[12, 8, -10]} />

          {/* Deployment Ship - Hovering High */}
          <DeploymentShipModel position={[0, 10, 15]} />
      </group>
  );
};

export default ZigguratModel;
