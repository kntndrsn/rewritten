import type { TerrainDefinition, TerrainType } from './types.ts';

export const TERRAINS: Record<TerrainType, TerrainDefinition> = {
  deep_water: {
    id: 'deep_water',
    name: 'Deep Atlantic Waters',
    color: '#163853',
    secondaryColor: '#1d4768',
    buildable: false,
    walkable: false,
    description: 'Deep ocean waters off the colonial coast. Navigable by ocean vessels.'
  },
  coastal_water: {
    id: 'coastal_water',
    name: 'Coastal Shallows',
    color: '#245c82',
    secondaryColor: '#2d709c',
    buildable: true,
    walkable: false,
    description: 'Teeming coastal waters ideal for constructing Fisheries.',
    resourceHint: 'Rich Fishing Grounds'
  },
  river: {
    id: 'river',
    name: 'Tidal River',
    color: '#2b6f96',
    secondaryColor: '#3785b0',
    buildable: true,
    walkable: false,
    description: 'Freshwater river feeding the valley. Supports Fisheries along its banks.',
    resourceHint: 'Freshwater Fish'
  },
  grass: {
    id: 'grass',
    name: 'Colonial Meadow',
    color: '#4c7c44',
    secondaryColor: '#568a4d',
    buildable: true,
    walkable: true,
    description: 'Clear, level ground well-suited for roads, housing, markets, and workshops.'
  },
  fertile_soil: {
    id: 'fertile_soil',
    name: 'Alluvial Loam',
    color: '#6b8e3d',
    secondaryColor: '#7ea349',
    buildable: true,
    walkable: true,
    description: 'Nutrient-rich soil along the river floodplain. Ideal for Wheat Farms and Herb Gardens.',
    resourceHint: 'High Crop Fertility'
  },
  forest: {
    id: 'forest',
    name: 'Old-Growth Timberland',
    color: '#2d5a34',
    secondaryColor: '#214526',
    buildable: true,
    walkable: true,
    description: 'Dense pine and oak forest. Place Lumberjack Huts on or adjacent to harvest Timber.',
    resourceHint: 'Timber Source'
  },
  stone_deposit: {
    id: 'stone_deposit',
    name: 'Granite Outcrop',
    color: '#6c757d',
    secondaryColor: '#8d99ae',
    buildable: true,
    walkable: false,
    description: 'Exposed bedrock outcrop. Construct a Stone Quarry directly on this tile.',
    resourceHint: 'Stone Deposit'
  },
  iron_deposit: {
    id: 'iron_deposit',
    name: 'Iron Ore Seam',
    color: '#694e42',
    secondaryColor: '#9c6644',
    buildable: true,
    walkable: false,
    description: 'Rich surface iron vein. Construct an Iron Mine directly on this tile.',
    resourceHint: 'Iron Vein'
  }
};
