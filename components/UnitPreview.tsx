
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
import SniperModel from './SniperModel';
import HackerModel from './HackerModel';

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
            case UnitType.SNIPER: return <SniperModel color={color} isMoving={false} />;
            case UnitType.HACKER: return <HackerModel color={color} isMoving={false} />;

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
                            <mesh position={[0.25, 0, 0.25]} rotation={[0, Math.PI / 4, 0]}>
                                <boxGeometry args={[0.4, 0.02, 0.05]} />
                                <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[-0.25, 0, 0.25]} rotation={[0, -Math.PI / 4, 0]}>
                                <boxGeometry args={[0.4, 0.02, 0.05]} />
                                <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[0.25, 0, -0.25]} rotation={[0, -Math.PI / 4, 0]}>
                                <boxGeometry args={[0.4, 0.02, 0.05]} />
                                <meshStandardMaterial color="#333" />
                            </mesh>
                            <mesh position={[-0.25, 0, -0.25]} rotation={[0, Math.PI / 4, 0]}>
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





            case UnitType.SPIKE:
                return (
                    <group>
                        {/* Base Ring */}
                        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
