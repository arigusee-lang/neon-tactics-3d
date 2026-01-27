
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

  // Parts refs for dying animation
  const partRefs = useRef<THREE.Mesh[]>([]);
  
  const [animStartTime, setAnimStartTime] = useState<number | null>(null);

  // Random debris vectors
  const debris = useMemo(() => {
    return new Array(4).fill(0).map(() => ({
        velocity: new Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2),
        rotation: new Vector3(Math.random(), Math.random(), Math.random())
    }));
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    
    if (isExploding) {
        // --- EXPLOSION ANIMATION ---
        if (animStartTime === null) setAnimStartTime(time);
        const elapsed = time - (animStartTime || time);

        // 1. Core swells rapidly
        if (coreRef.current) {
            coreRef.current.scale.multiplyScalar(1 + delta * 10);
            (coreRef.current.material as THREE.MeshBasicMaterial).color.set('#ffffff');
        }

        // 2. Explosion sphere expands
        if (explosionRef.current) {
            const scale = 1 + elapsed * 15;
            explosionRef.current.scale.set(scale, scale, scale);
            const opacity = Math.max(0, 1 - elapsed * 2);
            (explosionRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
        }

        // 3. Hide original body parts quickly
        if (elapsed > 0.1) {
            partRefs.current.forEach(mesh => {
                if(mesh) mesh.visible = false;
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
                    debris[i].velocity.set(0,0,0);
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
             <mesh ref={explosionRef}>
                 <sphereGeometry args={[0.5, 16, 16]} />
                 <meshBasicMaterial color="#ff5500" transparent opacity={0.8} />
             </mesh>
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
