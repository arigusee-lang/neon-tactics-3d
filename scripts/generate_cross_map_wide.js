import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mapData = {
  description: 'Wider 3-player cross arena with centered portals and a side-branch spawn.',
  players: 3,
  mode: 'ffa',
  mapSize: { x: 25, y: 25 },
  mapOrigin: { x: 7, z: 7 },
  terrain: {},
  units: [
    {
      id: 'crossmap-wide-main-p1',
      playerId: 'P1',
      position: { x: 18, z: 10 },
      type: 'ARC_PORTAL',
      rotation: 0,
      level: 1
    },
    {
      id: 'crossmap-wide-main-p2',
      playerId: 'P2',
      position: { x: 26, z: 18 },
      type: 'ARC_PORTAL',
      rotation: -Math.PI / 2,
      level: 1
    },
    {
      id: 'crossmap-wide-main-p3',
      playerId: 'P3',
      position: { x: 18, z: 26 },
      type: 'ARC_PORTAL',
      rotation: Math.PI,
      level: 1
    }
  ],
  collectibles: []
};

const addRect = (startX, endX, startZ, endZ, landingZone) => {
  for (let x = startX; x <= endX; x++) {
    for (let z = startZ; z <= endZ; z++) {
      const key = `${x},${z}`;
      mapData.terrain[key] = {
        type: 'NORMAL',
        elevation: 0,
        rotation: 0,
        ...(landingZone ? { landingZone } : {})
      };
    }
  }
};

// Each leg is extended by 3 tiles while keeping the cross 7 tiles thick.
addRect(16, 22, 7, 16, 'P1');
addRect(16, 22, 22, 31, 'P3');

// The middle bar is 7 tiles thick and spans wider than the original layout.
addRect(7, 31, 16, 22);

// The right branch becomes the third player's landing strip in FFA.
addRect(23, 31, 16, 22, 'P2');

const outputPath = path.join(__dirname, '../maps/CrossMapWide.json');
fs.writeFileSync(outputPath, JSON.stringify(mapData, null, 2));

console.log(`Map generated at ${outputPath}`);
console.log(`Total tiles generated: ${Object.keys(mapData.terrain).length}`);
