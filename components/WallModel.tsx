
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import * as THREE from 'three';

interface WallModelProps {
  color: string;
  isDying?: boolean;
}

const WallModel: React.FC<WallModelProps> = ({ color, isDying }) => {
  const groupRef = useRef<Group>(null);
  
  // Refs for individual parts to animate them separately
  const leftPostRef = useRef<Mesh>(null);
  const rightPostRef = useRef<Mesh>(null);
  const leftGlassRef = useRef<Mesh>(null);
  const rightGlassRef = useRef<Mesh>(null);
  
  // Material refs for pulsing/fading
  const matRefs = useRef<MeshStandardMaterial[]>([]);

  // Death animation state
  const [deathStartTime, setDeathStartTime] = useState<number | null>(null);

  // Define trajectory vectors for the explosion (Relative to the wall)
  const debris = useMemo(() => ({
    leftPost: {
        velocity: new Vector3(-0.8, 2.0, 0), // Up and Left
        rotation: new Vector3(0, 0, 2.0)     // Spin Z
    },
    rightPost: {
        velocity: new Vector3(0.8, 2.0, 0),  // Up and Right
        rotation: new Vector3(0, 0, -2.0)    // Spin Z
    },
    leftGlass: {
        velocity: new Vector3(-0.2, -1.0, 0.2), // Down, slight left, forward
        rotation: new Vector3(1.0, 0, 0)        // Tumble forward
    },
    rightGlass: {
        velocity: new Vector3(0.2, -1.0, -0.2), // Down, slight right, back
        rotation: new Vector3(-1.0, 0, 0)       // Tumble back
    }
  }), []);

  const addMatRef = (mat: MeshStandardMaterial) => {
    if (mat && !matRefs.current.includes(mat)) {
        matRefs.current.push(mat);
    }
  };

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    if (isDying) {
        // --- DEATH ANIMATION ---
        if (deathStartTime === null) {
            setDeathStartTime(time);
        }

        const elapsed = time - (deathStartTime || time);
        
        // Apply Physics-like movement to parts
        if (leftPostRef.current) {
            leftPostRef.current.position.x += debris.leftPost.velocity.x * delta;
            leftPostRef.current.position.y += debris.leftPost.velocity.y * delta;
            leftPostRef.current.rotation.z += debris.leftPost.rotation.z * delta;
            // Gravity on velocity
            debris.leftPost.velocity.y -= 9.8 * delta;
        }

        if (rightPostRef.current) {
            rightPostRef.current.position.x += debris.rightPost.velocity.x * delta;
            rightPostRef.current.position.y += debris.rightPost.velocity.y * delta;
            rightPostRef.current.rotation.z += debris.rightPost.rotation.z * delta;
            debris.rightPost.velocity.y -= 9.8 * delta;
        }

        if (leftGlassRef.current) {
            leftGlassRef.current.position.add(debris.leftGlass.velocity.clone().multiplyScalar(delta));
            leftGlassRef.current.rotation.x += debris.leftGlass.rotation.x * delta;
            leftGlassRef.current.scale.multiplyScalar(1 - delta); // Shrink
        }

        if (rightGlassRef.current) {
            rightGlassRef.current.position.add(debris.rightGlass.velocity.clone().multiplyScalar(delta));
            rightGlassRef.current.rotation.x += debris.rightGlass.rotation.x * delta;
            rightGlassRef.current.scale.multiplyScalar(1 - delta); // Shrink
        }

        // Fade Out Materials
        const opacity = Math.max(0, 0.9 - (elapsed * 1.5));
        matRefs.current.forEach(mat => {
            mat.opacity = opacity;
            mat.transparent = true;
            // Kill emissive glow quickly
            mat.emissiveIntensity = Math.max(0, 0.5 - elapsed * 2); 
        });

    } else {
        // --- IDLE ANIMATION ---
        // Subtle pulse on wall material
        const pulse = 0.3 + Math.sin(time * 2) * 0.2;
        matRefs.current.forEach(mat => {
            if (mat.name === 'glass') {
                mat.emissiveIntensity = pulse;
            }
        });
    }
  });

  return (
    <group ref={groupRef}>
        {/* We split the main barrier into two pieces to allow them to break apart */}
        
        {/* Left Half Glass */}
        <mesh 
            ref={leftGlassRef}
            position={[-0.22, 0.4, 0]} 
            castShadow 
        >
            <boxGeometry args={[0.44, 0.8, 0.3]} />
            <meshStandardMaterial 
                name="glass"
                ref={addMatRef}
                color="#111" 
                emissive={color} 
                emissiveIntensity={0.5} 
                roughness={0.2} 
                metalness={0.8} 
                transparent
                opacity={0.9}
            />
            {/* Wireframe Child */}
            <mesh position={[0, 0, 0]}>
                 <boxGeometry args={[0.45, 0.82, 0.31]} />
                 <meshBasicMaterial color={color} wireframe opacity={0.3} transparent />
            </mesh>
        </mesh>

        {/* Right Half Glass */}
        <mesh 
            ref={rightGlassRef}
            position={[0.22, 0.4, 0]} 
            castShadow 
        >
            <boxGeometry args={[0.44, 0.8, 0.3]} />
            <meshStandardMaterial 
                name="glass"
                ref={addMatRef}
                color="#111" 
                emissive={color} 
                emissiveIntensity={0.5} 
                roughness={0.2} 
                metalness={0.8} 
                transparent
                opacity={0.9}
            />
            {/* Wireframe Child */}
            <mesh position={[0, 0, 0]}>
                 <boxGeometry args={[0.45, 0.82, 0.31]} />
                 <meshBasicMaterial color={color} wireframe opacity={0.3} transparent />
            </mesh>
        </mesh>

        {/* Left Post */}
        <mesh ref={leftPostRef} position={[-0.45, 0.4, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.8]} />
            <meshStandardMaterial ref={addMatRef} color="#444" />
        </mesh>

        {/* Right Post */}
        <mesh ref={rightPostRef} position={[0.45, 0.4, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.8]} />
            <meshStandardMaterial ref={addMatRef} color="#444" />
        </mesh>
    </group>
  );
};

export default WallModel;
