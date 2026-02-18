
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const BLOCK_SIZE = 3;
const GRID_SIZE_BLOCKS = 6;
const OFFSET = 11; // To center in 40x40 board (40-18)/2 = 11

const mapData = {
    terrain: {},
    units: [],
    collectibles: []
};

// Pattern:
// Rows 0,1: Cols 2,3
// Rows 2,3: Cols 0-5
// Rows 4,5: Cols 2,3
const blockGrid = [
    [0, 0, 1, 1, 0, 0], // Row 0
    [0, 0, 1, 1, 0, 0], // Row 1
    [1, 1, 1, 1, 1, 1], // Row 2
    [1, 1, 1, 1, 1, 1], // Row 3
    [0, 0, 1, 1, 0, 0], // Row 4
    [0, 0, 1, 1, 0, 0], // Row 5
];

let tileCount = 0;

for (let br = 0; br < GRID_SIZE_BLOCKS; br++) {
    for (let bc = 0; bc < GRID_SIZE_BLOCKS; bc++) {
        if (blockGrid[br][bc] === 1) {
            // Generate 3x3 tiles for this block
            const startX = OFFSET + bc * BLOCK_SIZE;
            const startZ = OFFSET + br * BLOCK_SIZE;

            for (let bx = 0; bx < BLOCK_SIZE; bx++) {
                for (let bz = 0; bz < BLOCK_SIZE; bz++) {
                    const x = startX + bx;
                    const z = startZ + bz;
                    const key = `${x},${z}`;

                    const tile = {
                        type: 'NORMAL',
                        elevation: 0,
                        rotation: 0
                    };

                    // Landing Zones
                    // P1 Top (Rows 0-1)
                    if (br < 2) {
                        tile.landingZone = 'P1';
                    }
                    // P2 Bottom (Rows 4-5)
                    else if (br > 3) {
                        tile.landingZone = 'P2';
                    }

                    mapData.terrain[key] = tile;
                    tileCount++;
                }
            }
        }
    }
}

// Write to file
const outputPath = path.join(__dirname, '../maps/CrossMap.json');
// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(mapData, null, 2));
console.log(`Map generated at ${outputPath}`);
console.log(`Total tiles generated: ${tileCount}`);
