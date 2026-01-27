
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

interface TitanModelProps {
  color: string;
  isDying?: boolean;
}

const TitanModel: React.FC<TitanModelProps> = ({ color, isDying }) => {
  const groupRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const radarRef = useRef<THREE.Mesh>(null);
  
  // Refs for debris parts
  const partsRefs = useRef<Group[]>([]);
  
  const matRefs = useRef<MeshStandardMaterial[]>([]);
  const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

  // Debris vectors for explosion
  const debris = useMemo(() => {
      return new Array(5).fill(0).map(() => ({
          velocity: new Vector3((Math.random() - 0.5) * 4, Math.random() * 5, (Math.random() - 0.5) * 4),
          rotation: new Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5)
      }));
  }, []);

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) {
        matRefs.current.push(mat);
    }
  };

  const addPartRef = (grp: Group) => {
      if (grp && !partsRefs.current.includes(grp)) {
          partsRefs.current.push(grp);
      }
  };

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    if (isDying) {
        if (deathStartTime === null) setDeathStartTime(time);
        const elapsed = time - (deathStartTime || time);

        // Explosion Animation
        partsRefs.current.forEach((part, i) => {
            if (part && debris[i]) {
                part.position.add(debris[i].velocity.clone().multiplyScalar(delta));
                part.rotation.x += debris[i].rotation.x * delta;
                part.rotation.y += debris[i].rotation.y * delta;
                // Gravity
                debris[i].velocity.y -= 9.8 * delta;
            }
        });

        // Fade out
        const opacity = Math.max(0, 1 - elapsed);
        matRefs.current.forEach(mat => {
            mat.opacity = opacity;
            mat.transparent = true;
            mat.emissiveIntensity = 0;
        });

    } else {
        // Idle Animation
        if (radarRef.current) {
            radarRef.current.rotation.y += delta * 2; // Spin radar
            radarRef.current.rotation.z = Math.sin(time) * 0.2; // Wobble
        }
        
        // Subtle breathing/bobbing of the gun head
        if (headRef.current) {
            headRef.current.position.y = 0.4 + Math.sin(time * 0.5) * 0.02;
        }
    }
  });

  return (
    <group ref={groupRef}>
        {/* --- BASE (Part 0) --- */}
        <group ref={addPartRef}>
            {/* Central Hub */}
            <mesh position={[0, 0.15, 0]} castShadow>
                <cylinderGeometry args={[0.5, 0.6, 0.3, 6]} />
                <meshStandardMaterial ref={addMatRef} color="#111" roughness={0.7} metalness={0.5} />
                <Edges color={color} threshold={15} />
            </mesh>
            {/* 4 Stabilizer Legs */}
            {[0, Math.PI/2, Math.PI, -Math.PI/2].map((rot, i) => (
                <group key={i} rotation={[0, rot, 0]}>
                    <mesh position={[0.6, 0.1, 0]}>
                        <boxGeometry args={[0.6, 0.2, 0.3]} />
                        <meshStandardMaterial ref={addMatRef} color="#222" />
                        <Edges color="#444" />
                    </mesh>
                    <mesh position={[0.85, 0, 0]}>
                        <cylinderGeometry args={[0.15, 0.15, 0.2, 6]} />
                        <meshStandardMaterial ref={addMatRef} color="#111" />
                    </mesh>
                </group>
            ))}
        </group>

        {/* --- TURRET HEAD (Part 1) --- */}
        <group ref={addPartRef}>
            <group ref={headRef} position={[0, 0.4, 0]}>
                
                {/* Main Carriage */}
                <mesh castShadow>
                    <boxGeometry args={[0.6, 0.5, 0.8]} />
                    <meshStandardMaterial ref={addMatRef} color="#222" roughness={0.3} metalness={0.8} />
                    <Edges color={color} threshold={15} />
                </mesh>

                {/* Side Armour Plates */}
                <mesh position={[0.35, 0, 0]}>
                    <boxGeometry args={[0.1, 0.4, 0.7]} />
                    <meshStandardMaterial ref={addMatRef} color="#1a1a1a" />
                </mesh>
                <mesh position={[-0.35, 0, 0]}>
                    <boxGeometry args={[0.1, 0.4, 0.7]} />
                    <meshStandardMaterial ref={addMatRef} color="#1a1a1a" />
                </mesh>

                {/* Dual Railguns */}
                <group position={[0, 0, 0.4]}>
                    {/* Left Barrel */}
                    <group position={[-0.2, 0, 0]}>
                        <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.4]}>
                            <cylinderGeometry args={[0.08, 0.1, 0.8, 8]} />
                            <meshStandardMaterial ref={addMatRef} color="#333" />
                        </mesh>
                        {/* Coils */}
                        {[0.2, 0.4, 0.6].map((z, i) => (
                            <mesh key={i} position={[0, 0, z]} rotation={[Math.PI/2, 0, 0]}>
                                <torusGeometry args={[0.09, 0.02, 8, 16]} />
                                <meshBasicMaterial color={color} />
                            </mesh>
                        ))}
                    </group>

                    {/* Right Barrel */}
                    <group position={[0.2, 0, 0]}>
                        <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.4]}>
                            <cylinderGeometry args={[0.08, 0.1, 0.8, 8]} />
                            <meshStandardMaterial ref={addMatRef} color="#333" />
                        </mesh>
                        {/* Coils */}
                        {[0.2, 0.4, 0.6].map((z, i) => (
                            <mesh key={i} position={[0, 0, z]} rotation={[Math.PI/2, 0, 0]}>
                                <torusGeometry args={[0.09, 0.02, 8, 16]} />
                                <meshBasicMaterial color={color} />
                            </mesh>
                        ))}
                    </group>
                </group>

                {/* Radar Dish */}
                <group position={[0, 0.3, -0.2]}>
                    <group ref={radarRef} rotation={[0.2, 0, 0]}>
                        <mesh position={[0, 0.15, 0]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.2, 0.05, 0.05, 16]} />
                            <meshStandardMaterial ref={addMatRef} color="#111" />
                            <Edges color={color} scale={1.1} />
                        </mesh>
                        <mesh position={[0, 0, 0]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.15]} />
                            <meshStandardMaterial color="#555" />
                        </mesh>
                    </group>
                </group>

                {/* Rear Vents */}
                <mesh position={[0, 0, -0.41]}>
                    <planeGeometry args={[0.4, 0.3]} />
                    <meshBasicMaterial color="#ff4400" opacity={0.5} transparent />
                </mesh>
                <group position={[0, 0, -0.42]}>
                     {[0.1, 0, -0.1].map((y, i) => (
                         <mesh key={i} position={[0, y, 0]}>
                             <boxGeometry args={[0.42, 0.02, 0.05]} />
                             <meshStandardMaterial color="#111" />
                         </mesh>
                     ))}
                </group>

            </group>
        </group>
    </group>
  );
};

export default TitanModel;
