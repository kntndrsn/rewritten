import type { TerrainType } from '../data/types.ts';

export const MAP_WIDTH = 28;
export const MAP_HEIGHT = 20;

export interface GeneratedTileData {
  x: number;
  y: number;
  terrain: TerrainType;
  elevation: number;
  decorationSeed: number;
}

function pseudoRandom(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function generateColonialMap(seed = 1607): GeneratedTileData[][] {
  const grid: GeneratedTileData[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: GeneratedTileData[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const rng = pseudoRandom(x, y, seed);
      const rng2 = pseudoRandom(x + 19, y + 47, seed);

      // Western bay / Atlantic coast on left (x <= 4) and bottom-left cove
      const coastlineX = 3.2 + Math.sin(y * 0.42) * 1.3 + (y > 14 ? (y - 14) * 0.8 : 0);

      // Winding tidal river flowing from north-east (x=22, y=0) to the western bay (x=3, y=11)
      const riverCenterY = 11.2 - (x - 3) * 0.42 + Math.sin(x * 0.45) * 1.4;
      const distToRiver = Math.abs(y - riverCenterY);

      let terrain: TerrainType = 'grass';
      let elevation = 0.35 + rng * 0.15;

      if (x < coastlineX - 1.4) {
        terrain = 'deep_water';
        elevation = 0.05;
      } else if (x < coastlineX) {
        terrain = 'coastal_water';
        elevation = 0.15;
      } else if (distToRiver < 0.72) {
        terrain = 'river';
        elevation = 0.18;
      } else if (distToRiver < 2.2 && x >= 5 && x <= 23) {
        terrain = 'fertile_soil';
        elevation = 0.28;
      } else {
        // Rocky outcrops & mineral seams in the northern and southeastern hills
        const isNorthHills = y <= 3 && x >= 11 && x <= 25;
        const isSouthEastHills = y >= 15 && x >= 17 && x <= 26;

        if ((x === 14 && y === 2) || (x === 15 && y === 2) || (x === 21 && y === 16) || (x === 22 && y === 16)) {
          terrain = 'stone_deposit';
          elevation = 0.75;
        } else if ((x === 19 && y === 2) || (x === 20 && y === 2) || (x === 24 && y === 14) || (x === 24 && y === 15)) {
          terrain = 'iron_deposit';
          elevation = 0.8;
        } else if (isNorthHills || isSouthEastHills) {
          terrain = rng > 0.35 ? 'forest' : 'grass';
          elevation = 0.55;
        } else {
          // Central settlement clearing around (8..16, 5..14) stays mostly clear meadow
          const inStarterClearing = x >= 6 && x <= 15 && y >= 5 && y <= 14;
          if (!inStarterClearing && (rng > 0.52 || (x >= 20 && rng2 > 0.35) || (y <= 4 && rng2 > 0.4))) {
            terrain = 'forest';
            elevation = 0.48;
          } else {
            terrain = 'grass';
          }
        }
      }

      row.push({
        x,
        y,
        terrain,
        elevation,
        decorationSeed: rng2
      });
    }
    grid.push(row);
  }

  // Ensure guaranteed buildable & harvestable tiles near starter area for reliable gameplay & tests
  const forceTiles: Array<{ x: number; y: number; terrain: TerrainType }> = [
    // Coastal fishing access
    { x: 4, y: 8, terrain: 'coastal_water' },
    { x: 4, y: 9, terrain: 'coastal_water' },
    { x: 5, y: 8, terrain: 'grass' },
    { x: 5, y: 9, terrain: 'grass' },
    // Central hub & roads
    { x: 6, y: 8, terrain: 'grass' },
    { x: 7, y: 8, terrain: 'grass' },
    { x: 8, y: 8, terrain: 'grass' },
    { x: 9, y: 8, terrain: 'grass' },
    { x: 10, y: 8, terrain: 'grass' },
    { x: 11, y: 8, terrain: 'grass' },
    { x: 8, y: 7, terrain: 'grass' },
    { x: 9, y: 7, terrain: 'grass' },
    { x: 10, y: 7, terrain: 'grass' },
    { x: 7, y: 7, terrain: 'grass' },
    { x: 7, y: 9, terrain: 'grass' },
    { x: 8, y: 9, terrain: 'grass' },
    { x: 9, y: 9, terrain: 'grass' },
    { x: 10, y: 9, terrain: 'grass' },
    // Guaranteed forest stand adjacent to (11, 7)
    { x: 11, y: 6, terrain: 'forest' },
    { x: 12, y: 6, terrain: 'forest' },
    { x: 12, y: 7, terrain: 'forest' },
    { x: 11, y: 7, terrain: 'grass' },
    // Guaranteed fertile soil south of hub
    { x: 8, y: 10, terrain: 'fertile_soil' },
    { x: 9, y: 10, terrain: 'fertile_soil' },
    { x: 10, y: 10, terrain: 'fertile_soil' },
    { x: 11, y: 10, terrain: 'fertile_soil' },
    // Guaranteed stone & iron reachable to the north-east
    { x: 13, y: 5, terrain: 'stone_deposit' },
    { x: 13, y: 6, terrain: 'grass' },
    { x: 15, y: 5, terrain: 'iron_deposit' },
    { x: 15, y: 6, terrain: 'grass' }
  ];

  for (const item of forceTiles) {
    if (grid[item.y] && grid[item.y][item.x]) {
      grid[item.y][item.x].terrain = item.terrain;
    }
  }

  return grid;
}
