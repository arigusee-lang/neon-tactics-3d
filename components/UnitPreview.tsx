
import React from 'react';
import { UnitType } from '../types';
import { Edges, Float } from '@react-three/drei';
import * as THREE from 'three';

// Import Models
import SoldierModel from './SoldierModel';
import HeavyTrooperModel from './HeavyTrooperModel';
import MedicModel from './MedicModel';
import WallModel from './WallModel';
import SuicideDroneModel from './SuicideDroneModel';
import TowerModel from './TowerModel';
import TitanModel from './TitanModel';
import LightTankModel from './LightTankModel';
import HeavyTankModel from './HeavyTankModel';
import ChargingStationModel from './ChargingStationModel';
import PortalModel from './PortalModel';
import ApexBladeModel from './ApexBladeModel';

interface UnitPreviewProps {
    type: UnitType;
    color: string;
}

const UnitPreview: React.FC<UnitPreviewProps> = ({ type, color }) => {
    
    // Helper to render the common "Matrix" material style inline
    const renderMatrixMat = (opacity = 0.8, colorOverride?: string) => (
        <>
            <meshStandardMaterial color={colorOverride || "#0a0a0a"} transparent opacity={opacity} roughness={0.2} metalness={0.8} />
            <Edges color={color} threshold={15} scale={1.0} />
        </>
    );

    const renderModel = () => {
        switch (type) {
            case UnitType.SOLDIER: return <SoldierModel color={color} isMoving={false} />;
            case UnitType.HEAVY: return <HeavyTrooperModel color={color} isMoving={false} />;
            case UnitType.MEDIC: return <MedicModel color={color} isMoving={false} />;
            case UnitType.LIGHT_TANK: return <LightTankModel color={color} isMoving={false} />;
            case UnitType.HEAVY_TANK: return <HeavyTankModel color={color} isMoving={false} />;
            case UnitType.CHARGING_STATION: return <ChargingStationModel color={color} />;
            case UnitType.WALL: return <WallModel color={color} />;
            case UnitType.TOWER: return <TowerModel color={color} />;
            case UnitType.TITAN: return <TitanModel color={color} />;
            case UnitType.SUICIDE_DRONE: return <SuicideDroneModel color={color} />;
            case UnitType.PORTAL: return <PortalModel color={color} />;
            case UnitType.CONE: return <ApexBladeModel color={color} isMoving={false} />;
            
            case UnitType.BOX: // Scout Drone
                return (
                    <group>
                        {/* Central Core */}
                        <mesh castShadow>
                            <boxGeometry args={[0.2, 0.15, 0.25]} />
                            {renderMatrixMat(0.9)}
                        </mesh>
                        {/* Glowing Eye */}
                        <mesh position={[0, 0, 0.13]}>
                            <planeGeometry args={[0.1, 0.05]} />
                            <meshBasicMaterial color={color} />
                        </mesh>
                        {/* Arms */}
                        <group>
                            <mesh position={[0.25, 0, 0.25]} rotation={[0, Math.PI/4, 0]}>
                                 <boxGeometry args={[0.4, 0.02, 0.05]} />
                                 <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[-0.25, 0, 0.25]} rotation={[0, -Math.PI/4, 0]}>
                                 <boxGeometry args={[0.4, 0.02, 0.05]} />
                                 <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[0.25, 0, -0.25]} rotation={[0, -Math.PI/4, 0]}>
                                 <boxGeometry args={[0.4, 0.02, 0.05]} />
                                 <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[-0.25, 0, -0.25]} rotation={[0, Math.PI/4, 0]}>
                                 <boxGeometry args={[0.4, 0.02, 0.05]} />
                                 <meshStandardMaterial color="#333" />
                            </mesh>
                        </group>
                        {/* Propellers */}
                        {[
                            [0.4, 0.05, 0.4], [-0.4, 0.05, 0.4],
                            [0.4, 0.05, -0.4], [-0.4, 0.05, -0.4]
                        ].map((pos, i) => (
                            <mesh key={i} position={pos as any}>
                                <cylinderGeometry args={[0.12, 0.12, 0.01, 8]} />
                                <meshBasicMaterial color={color} wireframe opacity={0.4} transparent />
                            </mesh>
                        ))}
                        {/* Landing Skids */}
                         <mesh position={[0, -0.15, 0]}>
                             <boxGeometry args={[0.1, 0.1, 0.1]} />
                             {renderMatrixMat(0.5)}
                         </mesh>
                    </group>
                );

            case UnitType.SERVER:
               return (
                   <group>
                      {/* Main Rack */}
                      <mesh position={[0, 0.8, 0]} castShadow>
                          <boxGeometry args={[0.7, 1.6, 0.7]} />
                          {renderMatrixMat(0.95, "#050505")}
                      </mesh>
                      {/* Side Vents */}
                      <mesh position={[0.4, 0.8, 0]}>
                          <boxGeometry args={[0.1, 1.4, 0.5]} />
                          <meshStandardMaterial color="#222" />
                      </mesh>
                      <mesh position={[-0.4, 0.8, 0]}>
                          <boxGeometry args={[0.1, 1.4, 0.5]} />
                          <meshStandardMaterial color="#222" />
                      </mesh>
                      {/* Front Interface Panel */}
                      <mesh position={[0, 1.0, 0.36]}>
                          <planeGeometry args={[0.5, 0.3]} />
                          <meshBasicMaterial color={color} opacity={0.3} transparent />
                      </mesh>
                      {/* Glowing Data Lines - Horizontal */}
                      {[0.4, 0.8, 1.2].map((y, i) => (
                          <mesh key={i} position={[0, y, 0]}>
                               <boxGeometry args={[0.72, 0.02, 0.72]} />
                               <meshBasicMaterial color={color} toneMapped={false} />
                          </mesh>
                      ))}
                      {/* Floating Data Blocks */}
                      <group position={[0, 2.0, 0]}>
                          <mesh position={[0.3, 0, 0]}>
                               <boxGeometry args={[0.1, 0.1, 0.1]} />
                               <meshBasicMaterial color={color} wireframe />
                          </mesh>
                           <mesh position={[-0.2, 0.2, -0.2]}>
                               <boxGeometry args={[0.08, 0.08, 0.08]} />
                               <meshBasicMaterial color={color} wireframe />
                          </mesh>
                      </group>
                   </group>
               );

            case UnitType.RESIDENTIAL:
               return (
                   <group>
                       {/* Main Tower Body */}
                       <mesh position={[0, 0.75, 0]}>
                           <boxGeometry args={[1.2, 1.5, 1.2]} />
                           {renderMatrixMat(0.9, "#1a1a1a")}
                       </mesh>
                       {/* Annex Building */}
                       <mesh position={[0.5, 0.4, 0.5]}>
                           <boxGeometry args={[0.6, 0.8, 0.6]} />
                           {renderMatrixMat(0.9, "#222")}
                       </mesh>
                       {/* Rooftop Tech */}
                        <mesh position={[0, 1.55, 0]}>
                           <boxGeometry args={[0.8, 0.1, 0.8]} />
                           <meshStandardMaterial color="#888888" />
                       </mesh>
                       {/* Windows / Lights Pattern */}
                       {[0.2, 0.6, 1.0, 1.3].map((y, i) => (
                           <group key={i} position={[0, y, 0.61]}>
                               <mesh position={[-0.3, 0, 0]}>
                                   <planeGeometry args={[0.15, 0.1]} />
                                   <meshBasicMaterial color={color} opacity={0.6} transparent />
                               </mesh>
                               <mesh position={[0.3, 0, 0]}>
                                   <planeGeometry args={[0.15, 0.1]} />
                                   <meshBasicMaterial color={color} opacity={0.4} transparent />
                               </mesh>
                           </group>
                       ))}
                   </group>
               );

            case UnitType.SPIKE:
               return (
                   <group>
                      {/* Base Ring */}
                      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
                           <ringGeometry args={[0.4, 0.6, 6]} />
                           <meshBasicMaterial color={color} side={THREE.DoubleSide} wireframe />
                      </mesh>
                      {/* Floating Center Pieces */}
                      <group>
                          {/* Lower Crystal */}
                          <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI]}>
                              <coneGeometry args={[0.3, 0.8, 4]} />
                              {renderMatrixMat(0.8)}
                          </mesh>
                           {/* Upper Crystal */}
                          <mesh position={[0, 1.2, 0]}>
                              <coneGeometry args={[0.25, 1.0, 4]} />
                              {renderMatrixMat(0.8)}
                          </mesh>
                          {/* Core Energy */}
                          <mesh position={[0, 0.8, 0]}>
                              <octahedronGeometry args={[0.15]} />
                              <meshBasicMaterial color={color} toneMapped={false} />
                          </mesh>
                      </group>
                      {/* Orbital Rings */}
                      <mesh position={[0, 1.0, 0]} rotation={[0.5, 0, 0]}>
                           <torusGeometry args={[0.6, 0.02, 4, 24]} />
                           <meshBasicMaterial color="#555" />
                      </mesh>
                   </group>
               );
            
            // Fallback / Actions
            default:
                return (
                    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
                        <mesh>
                            <boxGeometry args={[0.8, 0.8, 0.8]} />
                            <meshStandardMaterial color={color} wireframe transparent opacity={0.5} />
                        </mesh>
                    </Float>
                );
        }
    };

    return (
        <group>
            {renderModel()}
        </group>
    );
};

export default UnitPreview;
