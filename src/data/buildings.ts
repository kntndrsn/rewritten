import type { BuildingDefinition } from './types.ts';

export const BUILDINGS: Record<string, BuildingDefinition> = {
  founding_camp: {
    id: 'founding_camp',
    name: 'Temporal Landing & Warehouse',
    category: 'civic',
    icon: '🏛️',
    color: '#3d5a80',
    accentColor: '#98c1d9',
    description: 'Your expedition hub and central warehouse. Connects roads, stores +100 goods, and houses your hidden archive of future notes.',
    cost: { wood: 30, planks: 15, stone: 10, coin: 120 },
    upkeepCoinPerMin: 2,
    workersRequired: 0,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: false,
    serviceRadius: 8,
    serviceType: 'logistics',
    storageBonus: 100,
    passiveInsightPerMin: 2.0,
    paradoxDampeningPerMin: 0.4
  },
  dirt_road: {
    id: 'dirt_road',
    name: 'Colonial Cart Road',
    category: 'civic',
    icon: '🛤️',
    color: '#8d6e63',
    accentColor: '#bcaaa4',
    description: 'Links residences, farms, and workshops to your Warehouse and Market network.',
    cost: { wood: 1, coin: 2 },
    upkeepCoinPerMin: 0,
    workersRequired: 0,
    allowedTerrains: ['grass', 'fertile_soil', 'forest'],
    requiresRoad: false,
    isRoad: true
  },
  market_square: {
    id: 'market_square',
    name: 'Colonial Market Square',
    category: 'civic',
    icon: '⚖️',
    color: '#b56576',
    accentColor: '#f4a261',
    description: 'Distributes food and goods to nearby homes within 6 tiles and reassures townsfolk, reducing Paradox suspicion.',
    cost: { wood: 20, planks: 10, coin: 60 },
    upkeepCoinPerMin: 4,
    workersRequired: 4,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    serviceRadius: 6,
    serviceType: 'market',
    paradoxDampeningPerMin: 0.8
  },
  pioneer_cabin: {
    id: 'pioneer_cabin',
    name: 'Pioneer Cabin',
    category: 'housing',
    icon: '🛖',
    color: '#9c6644',
    accentColor: '#ddb892',
    description: 'Log cabin housing up to 8 Pioneers. Supply Fish and Market access to upgrade into a Colonial Homestead.',
    cost: { wood: 10, coin: 15 },
    upkeepCoinPerMin: 0,
    workersRequired: 0,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    housing: {
      tier: 'pioneers',
      capacity: 8,
      upgradesToBuildingId: 'colonial_homestead',
      upgradeCost: { planks: 8, stone: 4, coin: 30 }
    }
  },
  colonial_homestead: {
    id: 'colonial_homestead',
    name: 'Colonial Homestead',
    category: 'housing',
    icon: '🏠',
    color: '#bc4749',
    accentColor: '#f2e8cf',
    description: 'Spacious timber-and-stone residence housing 14 Colonists. Can be upgraded to an Enlightened Manor once Scientific Method is unlocked.',
    cost: { wood: 12, planks: 10, stone: 6, coin: 45 },
    upkeepCoinPerMin: 0,
    workersRequired: 0,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    housing: {
      tier: 'colonists',
      capacity: 14,
      upgradesToBuildingId: 'enlightened_manor',
      upgradeCost: { planks: 12, stone: 10, tools: 6, coin: 80 },
      requiredTechForUpgrade: 'scientific_press'
    }
  },
  enlightened_manor: {
    id: 'enlightened_manor',
    name: 'Enlightened Manor',
    category: 'housing',
    icon: '🏛️',
    color: '#5e548e',
    accentColor: '#e0b1cb',
    description: 'Georgian residence for 22 Time-Touched Innovators. Generates high tax revenue and accelerates Future Insight.',
    cost: { planks: 18, stone: 14, tools: 8, coin: 120 },
    upkeepCoinPerMin: 0,
    workersRequired: 0,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    requiredTechId: 'scientific_press',
    divergenceOnBuild: 2,
    housing: {
      tier: 'innovators',
      capacity: 22
    }
  },
  lumberjack_hut: {
    id: 'lumberjack_hut',
    name: 'Lumberjack Camp',
    category: 'gathering',
    icon: '🪓',
    color: '#6b4423',
    accentColor: '#a3b18a',
    description: 'Fells and replants timber. Must be placed on or directly adjacent to Old-Growth Timberland.',
    cost: { wood: 8, coin: 20 },
    upkeepCoinPerMin: 2,
    workersRequired: 4,
    allowedTerrains: ['grass', 'fertile_soil', 'forest'],
    adjacentTerrainRequired: ['forest'],
    requiresRoad: true,
    recipes: [
      {
        id: 'fell_timber',
        name: 'Colonial Logging',
        inputs: {},
        outputs: { wood: 4 },
        cycleSeconds: 6,
        description: 'Harvests 4 Timber every 6 seconds from nearby forest stands.'
      }
    ]
  },
  sawmill: {
    id: 'sawmill',
    name: 'Sawmill',
    category: 'production',
    icon: '🪚',
    color: '#b07d4f',
    accentColor: '#ffe5d9',
    description: 'Cuts raw Timber into Milled Planks for advanced colonial buildings.',
    cost: { wood: 16, stone: 4, coin: 35 },
    upkeepCoinPerMin: 3,
    workersRequired: 5,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    recipes: [
      {
        id: 'pit_saw_planks',
        name: 'Two-Man Pit Sawing',
        inputs: { wood: 3 },
        outputs: { planks: 3 },
        cycleSeconds: 6,
        description: 'Traditional colonial pit sawing converts 3 Timber into 3 Planks.'
      },
      {
        id: 'circular_saw_planks',
        name: 'Water-Driven Circular Saw (Anachronistic)',
        inputs: { wood: 2 },
        outputs: { planks: 5 },
        cycleSeconds: 5,
        requiredTechId: 'water_circular_saw',
        isAnachronistic: true,
        description: '19th-century rotary blade geometry yields 5 Planks from just 2 Timber.'
      }
    ]
  },
  fishery: {
    id: 'fishery',
    name: 'Coastal Fishery',
    category: 'gathering',
    icon: '🎣',
    color: '#1d6fa5',
    accentColor: '#90e0ef',
    description: 'Catches and salts fish to feed Pioneers and Colonists. Must be placed on or adjacent to Coastal Shallows or River.',
    cost: { wood: 14, coin: 25 },
    upkeepCoinPerMin: 2,
    workersRequired: 4,
    allowedTerrains: ['coastal_water', 'river', 'grass'],
    adjacentTerrainRequired: ['coastal_water', 'river'],
    requiresRoad: true,
    recipes: [
      {
        id: 'coastal_netting',
        name: 'Weir & Line Fishing',
        inputs: {},
        outputs: { fish: 4 },
        cycleSeconds: 6,
        description: 'Produces 4 Salted Fish every 6 seconds.'
      }
    ]
  },
  wheat_farm: {
    id: 'wheat_farm',
    name: 'Colonial Wheat Farm',
    category: 'gathering',
    icon: '🌾',
    color: '#c9a227',
    accentColor: '#ede0d4',
    description: 'Cultivates Wheat Grain. Must be built on Alluvial Loam (Fertile Soil).',
    cost: { wood: 14, planks: 6, coin: 35 },
    upkeepCoinPerMin: 3,
    workersRequired: 5,
    allowedTerrains: ['fertile_soil'],
    requiresRoad: true,
    recipes: [
      {
        id: 'colonial_fallow_farming',
        name: 'Two-Field Broadcast Sowing',
        inputs: {},
        outputs: { grain: 4 },
        cycleSeconds: 7,
        description: 'Traditional sowing yields 4 Wheat Grain per cycle.'
      },
      {
        id: 'four_course_seed_drill',
        name: 'Norfolk 4-Course & Seed Drill (Anachronistic)',
        inputs: {},
        outputs: { grain: 9 },
        cycleSeconds: 6,
        requiredTechId: 'crop_rotation',
        isAnachronistic: true,
        description: 'Clover nitrogen fixation and mechanical row drilling more than double grain output.'
      }
    ]
  },
  bakery: {
    id: 'bakery',
    name: 'Mill & Bakehouse',
    category: 'production',
    icon: '🥖',
    color: '#d97706',
    accentColor: '#fef3c7',
    description: 'Grinds Wheat Grain into flour and bakes Artisan Bread for Colonists and Innovators.',
    cost: { wood: 12, planks: 10, stone: 8, coin: 50 },
    upkeepCoinPerMin: 4,
    workersRequired: 6,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    recipes: [
      {
        id: 'brick_hearth_bread',
        name: 'Brick Hearth Baking',
        inputs: { grain: 3, wood: 1 },
        outputs: { bread: 4 },
        cycleSeconds: 6,
        description: 'Bakes 4 Bread from 3 Grain and 1 Timber fuel.'
      },
      {
        id: 'convection_yeast_bread',
        name: 'Pure-Culture Yeast & Cast-Iron Oven (Anachronistic)',
        inputs: { grain: 2 },
        outputs: { bread: 7 },
        cycleSeconds: 5,
        requiredTechId: 'crop_rotation',
        isAnachronistic: true,
        description: 'Isolated yeast strains and baffled heat retention produce 7 Bread from 2 Grain.'
      }
    ]
  },
  quarry: {
    id: 'quarry',
    name: 'Stone Quarry',
    category: 'gathering',
    icon: '⛏️',
    color: '#6c757d',
    accentColor: '#dee2e6',
    description: 'Extracts Cut Stone. Must be built on or directly adjacent to a Granite Outcrop.',
    cost: { wood: 18, planks: 6, coin: 40 },
    upkeepCoinPerMin: 3,
    workersRequired: 5,
    allowedTerrains: ['stone_deposit', 'grass'],
    adjacentTerrainRequired: ['stone_deposit'],
    requiresRoad: true,
    recipes: [
      {
        id: 'quarry_stone',
        name: 'Plug & Feather Quarrying',
        inputs: {},
        outputs: { stone: 3 },
        cycleSeconds: 7,
        description: 'Quarries 3 Cut Stone every 7 seconds.'
      }
    ]
  },
  iron_mine: {
    id: 'iron_mine',
    name: 'Iron Mine',
    category: 'gathering',
    icon: '🪨',
    color: '#5c4033',
    accentColor: '#d6ccc2',
    description: 'Extracts Iron Ore. Must be built on or directly adjacent to an Iron Ore Seam.',
    cost: { wood: 20, planks: 10, stone: 8, coin: 55 },
    upkeepCoinPerMin: 4,
    workersRequired: 6,
    allowedTerrains: ['iron_deposit', 'grass'],
    adjacentTerrainRequired: ['iron_deposit'],
    requiresRoad: true,
    recipes: [
      {
        id: 'mine_iron_ore',
        name: 'Shaft & Winch Mining',
        inputs: {},
        outputs: { iron_ore: 3 },
        cycleSeconds: 7,
        description: 'Extracts 3 Iron Ore every 7 seconds.'
      }
    ]
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Blacksmith & Foundry',
    category: 'production',
    icon: '⚒️',
    color: '#374151',
    accentColor: '#f87171',
    description: 'Smelts Iron Ore with Timber charcoal to forge Precision Tools.',
    cost: { planks: 12, stone: 12, coin: 70 },
    upkeepCoinPerMin: 5,
    workersRequired: 6,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    recipes: [
      {
        id: 'bloomery_tools',
        name: 'Colonial Bloomery Forge',
        inputs: { iron_ore: 2, wood: 2 },
        outputs: { tools: 2 },
        cycleSeconds: 7,
        description: 'Forges 2 Tools from 2 Iron Ore and 2 Timber.'
      },
      {
        id: 'crucible_steel_tools',
        name: 'Bessemer Air-Blast Crucible (Anachronistic)',
        inputs: { iron_ore: 2, wood: 1 },
        outputs: { tools: 5 },
        cycleSeconds: 5,
        requiredTechId: 'bessemer_metallurgy',
        isAnachronistic: true,
        description: 'Forced-air decarburization produces 5 high-carbon Steel Tools with half the fuel.'
      }
    ]
  },
  herb_garden: {
    id: 'herb_garden',
    name: 'Botanical Herbary',
    category: 'gathering',
    icon: '🌿',
    color: '#2d6a4f',
    accentColor: '#95d5b2',
    description: 'Cultivates medicinal willow bark, cinchona, and antiseptic herbs.',
    cost: { wood: 12, planks: 6, coin: 35 },
    upkeepCoinPerMin: 2,
    workersRequired: 4,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    recipes: [
      {
        id: 'cultivate_herbs',
        name: 'Physic Garden Cultivation',
        inputs: {},
        outputs: { herbs: 3 },
        cycleSeconds: 6,
        description: 'Harvests 3 Medicinal Herbs every 6 seconds.'
      }
    ]
  },
  apothecary: {
    id: 'apothecary',
    name: 'Sanitation Clinic & Apothecary',
    category: 'temporal',
    icon: '⚕️',
    color: '#0f766e',
    accentColor: '#5eead4',
    description: 'Anachronistic public-health clinic. Provides Sanitation within 7 tiles and distills Antiseptic Tonics from Herbs.',
    cost: { planks: 14, stone: 10, tools: 4, coin: 85 },
    upkeepCoinPerMin: 5,
    workersRequired: 5,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    serviceRadius: 7,
    serviceType: 'sanitation',
    requiredTechId: 'germ_theory',
    divergenceOnBuild: 4,
    recipes: [
      {
        id: 'distill_antiseptic',
        name: 'Boiled-Water & Salicylate Distillation (Anachronistic)',
        inputs: { herbs: 2 },
        outputs: { medicine: 3 },
        cycleSeconds: 6,
        isAnachronistic: true,
        description: 'Distills 3 Antiseptic Tonics from 2 Herbs while keeping nearby water supplies clean.'
      }
    ]
  },
  chronicle_observatory: {
    id: 'chronicle_observatory',
    name: 'Time Traveler’s Academy & Press',
    category: 'temporal',
    icon: '🔭',
    color: '#6d28d9',
    accentColor: '#c4b5fd',
    description: 'Translates your future archives into colonial treatises. Generates +6 Insight/min, provides Knowledge within 7 tiles, and stabilizes Paradox.',
    cost: { planks: 16, stone: 14, tools: 6, coin: 110 },
    upkeepCoinPerMin: 6,
    workersRequired: 6,
    allowedTerrains: ['grass', 'fertile_soil'],
    requiresRoad: true,
    serviceRadius: 7,
    serviceType: 'knowledge',
    passiveInsightPerMin: 6.0,
    paradoxDampeningPerMin: 1.2,
    divergenceOnBuild: 5
  }
};

export const BUILDING_LIST: BuildingDefinition[] = Object.values(BUILDINGS);
