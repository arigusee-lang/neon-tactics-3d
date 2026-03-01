import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { BOARD_OFFSET, COLORS, ELEVATION_HEIGHT, TILE_SIZE, TILE_SPACING } from '../constants';
import { Collectible, MapPreviewData, PlayerId, TerrainData, Unit } from '../types';

interface MapPreview3DProps {
  preview: MapPreviewData | null;
}

const getTerrainColor = (terrain?: TerrainData): string => {
  if (terrain?.landingZone === PlayerId.ONE) return '#14532d';
  if (terrain?.landingZone === PlayerId.TWO) return '#1e3a8a';
  if (terrain?.type === 'PLATFORM') return '#6b7280';
  if (terrain?.type === 'RAMP') return '#4b5563';
  return '#1f2937';
};

const getUnitColor = (unit: Unit): string => {
  if (unit.playerId === PlayerId.ONE) return '#22c55e';
  if (unit.playerId === PlayerId.TWO) return '#60a5fa';
  return '#f59e0b';
};

const getCollectibleColor = (collectible: Collectible): string => {
  if (collectible.type === 'HEALTH_PACK') return '#ef4444';
  if (collectible.type === 'ENERGY_CELL') return '#a855f7';
  return '#facc15';
};

const PreviewScene: React.FC<{ preview: MapPreviewData }> = ({ preview }) => {
  const tileStride = TILE_SIZE + TILE_SPACING;
  const centerX = ((preview.mapBounds.originX + ((preview.mapBounds.width - 1) / 2)) * tileStride) - BOARD_OFFSET;
  const centerZ = ((preview.mapBounds.originZ + ((preview.mapBounds.height - 1) / 2)) * tileStride) - BOARD_OFFSET;
  const cameraDistance = Math.max(10, Math.max(preview.mapBounds.width, preview.mapBounds.height) * 0.9);

  const terrainEntries = useMemo(() => Object.entries(preview.terrain), [preview]);

  const getTileVisualHeight = (key: string) => {
    const terrain = preview.terrain[key];
    let height = (terrain?.elevation || 0) * ELEVATION_HEIGHT;
    if (terrain?.type === 'RAMP') {
      height += 0.25;
    }
    return height;
  };

  return (
    <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <PerspectiveCamera makeDefault position={[centerX + cameraDistance * 0.6, cameraDistance, centerZ + cameraDistance * 0.85]} fov={42} />
      <Environment preset="city" blur={0.7} background={false} />
      <ambientLight intensity={0.7} color="#f8fafc" />
      <pointLight position={[centerX + 10, 16, centerZ + 8]} intensity={60} color="#dbeafe" />
      <pointLight position={[centerX - 8, 10, centerZ - 8]} intensity={18} color="#34d399" />

      <group>
        {terrainEntries.map(([key, terrain]) => {
          const [x, z] = key.split(',').map(Number);
          const worldX = (x * tileStride) - BOARD_OFFSET;
          const worldZ = (z * tileStride) - BOARD_OFFSET;
          const height = Math.max(0.15, getTileVisualHeight(key) + 0.15);

          return (
            <mesh key={key} position={[worldX, height / 2, worldZ]} castShadow receiveShadow>
              <boxGeometry args={[TILE_SIZE, height, TILE_SIZE]} />
              <meshStandardMaterial
                color={getTerrainColor(terrain)}
                emissive={terrain.landingZone ? getTerrainColor(terrain) : '#000000'}
                emissiveIntensity={terrain.landingZone ? 0.18 : 0.04}
                metalness={0.45}
                roughness={0.55}
              />
            </mesh>
          );
        })}

        {preview.units.map((unit) => {
          const size = unit.stats.size;
          const footprintCenterX = ((unit.position.x + ((size - 1) / 2)) * tileStride) - BOARD_OFFSET;
          const footprintCenterZ = ((unit.position.z + ((size - 1) / 2)) * tileStride) - BOARD_OFFSET;
          let baseHeight = 0;

          for (let dx = 0; dx < size; dx++) {
            for (let dz = 0; dz < size; dz++) {
              baseHeight = Math.max(baseHeight, getTileVisualHeight(`${unit.position.x + dx},${unit.position.z + dz}`));
            }
          }

          return (
            <mesh
              key={unit.id}
              position={[footprintCenterX, baseHeight + 0.45, footprintCenterZ]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[Math.max(0.6, size * 0.85), 0.7, Math.max(0.6, size * 0.85)]} />
              <meshStandardMaterial
                color={getUnitColor(unit)}
                emissive={getUnitColor(unit)}
                emissiveIntensity={0.2}
                metalness={0.75}
                roughness={0.35}
              />
            </mesh>
          );
        })}

        {preview.collectibles.map((collectible) => {
          const key = `${collectible.position.x},${collectible.position.z}`;
          const worldX = (collectible.position.x * tileStride) - BOARD_OFFSET;
          const worldZ = (collectible.position.z * tileStride) - BOARD_OFFSET;
          const baseHeight = getTileVisualHeight(key);
          const color = getCollectibleColor(collectible);

          return (
            <group key={collectible.id} position={[worldX, baseHeight + 0.55, worldZ]}>
              <mesh castShadow>
                <sphereGeometry args={[0.18, 18, 18]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.4} roughness={0.2} />
              </mesh>
              <pointLight distance={2.5} intensity={7} color={color} />
            </group>
          );
        })}

        <gridHelper
          args={[
            Math.max(tileStride, tileStride * Math.max(preview.mapBounds.width, preview.mapBounds.height)),
            Math.max(1, Math.max(preview.mapBounds.width, preview.mapBounds.height)),
            COLORS.GRID_LINE,
            COLORS.GRID_LINE
          ]}
          position={[centerX, -0.02, centerZ]}
          material-transparent={true}
          material-opacity={0.3}
          raycast={() => null}
        />
      </group>

      <OrbitControls
        makeDefault
        target={[centerX, 0.4, centerZ]}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.7}
        minDistance={6}
        maxDistance={cameraDistance * 1.8}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.15}
      />

      <color attach="background" args={['#050816']} />
      <fog attach="fog" args={['#050816', cameraDistance * 0.8, cameraDistance * 2.4]} />
    </Canvas>
  );
};

const MapPreview3D: React.FC<MapPreview3DProps> = ({ preview }) => {
  if (!preview) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center border border-cyan-500/20 bg-black/50 text-sm font-mono text-cyan-200/70">
        MAP PREVIEW UNAVAILABLE
      </div>
    );
  }

  return (
    <div className="h-full min-h-[320px] overflow-hidden rounded-xl border border-cyan-500/30 bg-black/60 shadow-[0_0_50px_rgba(0,255,255,0.08)]">
      <PreviewScene preview={preview} />
    </div>
  );
};

export default MapPreview3D;
