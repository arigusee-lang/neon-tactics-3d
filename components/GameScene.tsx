
import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Sparkles, Environment } from '@react-three/drei';
import Board from './Board';
import Unit from './Unit';
import { Unit as UnitType, PlayerId, Position, AppStatus, Collectible } from '../types';
import { COLORS } from '../constants';
import ZigguratModel from './ZigguratModel';

interface GameSceneProps {
  units: UnitType[];
  currentTurn: PlayerId;
  revealedTiles: string[];
  selectedCardId: string | null;
  selectedUnitId: string | null;
  previewPath?: Position[];
  appStatus: AppStatus;
  lightMode: 'DARK' | 'LIGHT';
  mapId: string;
  collectibles: Collectible[];
}

const GameScene: React.FC<GameSceneProps> = ({
  units,
  currentTurn,
  revealedTiles,
  selectedCardId,
  selectedUnitId,
  previewPath = [],
  appStatus,
  lightMode,
  mapId,
  collectibles
}) => {
  const isPlaying = appStatus === AppStatus.PLAYING;
  const isDark = lightMode === 'DARK';

  // Environment Configuration
  // Dark: Matrix/Cyberpunk Space
  // Light: Venerian Apocalyptic Dawn (Desert/Rust)

  const bgColor = isDark ? COLORS.BG : '#1a0805'; // Deep rusty dark
  const fogColor = isDark ? COLORS.BG : '#4a2010'; // Dusty orange/brown fog
  const fogNear = isDark ? 10 : 2;
  const fogFar = isDark ? 60 : 45;

  // Reduced Lighting Intensities for darker, higher contrast look
  const ambientColor = isDark ? '#ffffff' : '#ffebd6';
  const ambientIntensity = isDark ? 0.2 : 0.8;

  const mainLightColor = isDark ? '#ccddee' : '#ffaa88';
  const mainLightIntensity = isDark ? 1.0 : 2.0; // Reduced from 1.5 to 1.0
  const mainLightPos: [number, number, number] = isDark ? [10, 20, 10] : [30, 15, 10];

  const fillLightColor = isDark ? '#00ccff' : '#8800ff';
  const fillLightIntensity = isDark ? 0.5 : 1.0; // Reduced from 0.8 to 0.5

  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.minPolarAngle = 0;
      controlsRef.current.maxPolarAngle = Math.PI / 2.2;
    }
  }, []);

  return (
    <div className="w-full h-full">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 10, 12]} fov={50} />

        {/* Environment Map for Metallic Reflections */}
        <Environment preset={isDark ? "city" : "sunset"} blur={0.8} background={false} />

        {/* Dynamic Lighting */}
        <ambientLight intensity={ambientIntensity} color={ambientColor} />
        <pointLight position={mainLightPos} intensity={mainLightIntensity} color={mainLightColor} distance={80} castShadow />
        <pointLight position={[-10, 5, -10]} intensity={fillLightIntensity} color={fillLightColor} distance={40} />

        <group>
          <Board
            revealedTiles={revealedTiles}
            units={units}
            currentTurnPlayerId={currentTurn}
            selectedCardId={selectedCardId}
            selectedUnitId={selectedUnitId}
            previewPath={previewPath}
            mapId={mapId}
            collectibles={collectibles}
          />
          {units.map((unit) => (
            <Unit
              key={unit.id}
              data={unit}
              isSelected={selectedUnitId === unit.id}
              appStatus={appStatus}
            />
          ))}

          {/* Render Environment Objects based on Map */}
          {mapId === 'MAP_1' && <ZigguratModel />}
        </group>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          maxDistance={40}
          minDistance={5}
          autoRotate={!isPlaying}
          autoRotateSpeed={0.5}
          enablePan={isPlaying}
          enableZoom={isPlaying}
          enableRotate={isPlaying}
        />

        {/* Environment Effects */}
        {isDark ? (
          // @ts-ignore
          <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} raycast={() => null} />
        ) : (
          // Venerian Dust/Ash
          <group>
            {/* @ts-ignore */}
            <Sparkles count={800} scale={40} size={4} speed={0.4} opacity={0.6} color="#ffcc00" raycast={() => null} />
            {/* @ts-ignore */}
            <Sparkles count={200} scale={30} size={8} speed={0.2} opacity={0.4} color="#ff4400" raycast={() => null} />
          </group>
        )}

        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
      </Canvas>
    </div>
  );
};

export default GameScene;
