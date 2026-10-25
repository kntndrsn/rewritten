import type { TechnologyDefinition } from './types.ts';

export const TECHNOLOGIES: Record<string, TechnologyDefinition> = {
  water_circular_saw: {
    id: 'water_circular_saw',
    name: 'Rotary Saw & Standardized Joinery',
    eraOrigin: 'Adapted from 1810s Milling',
    category: 'industry',
    icon: '⚙️',
    insightCost: 20,
    divergenceImpact: 8,
    paradoxImpact: 4,
    prerequisites: [],
    summary: 'Unlocks the Water-Driven Circular Saw recipe in Sawmills and boosts global Timber & Plank output by +20%.',
    flavorText: 'By replacing slow two-man pit saws with tensioned rotary steel discs and standardized lumber gauges, construction speed across the colony leaps ahead a century.',
    effects: [
      {
        type: 'unlock_recipe',
        targetId: 'circular_saw_planks',
        description: 'Unlocks Water-Driven Circular Saw in Sawmills (2 Wood → 5 Planks)'
      },
      {
        type: 'production_multiplier',
        targetId: 'sawmill',
        value: 0.2,
        description: '+20% Sawmill production efficiency'
      }
    ]
  },
  crop_rotation: {
    id: 'crop_rotation',
    name: 'Norfolk 4-Course & Mechanical Seed Drill',
    eraOrigin: 'Adapted from 1730s–1840s Agronomy',
    category: 'agriculture',
    icon: '🌱',
    insightCost: 25,
    divergenceImpact: 10,
    paradoxImpact: 5,
    prerequisites: [],
    summary: 'Unlocks high-yield Norfolk Crop Rotation in Wheat Farms and Pure-Culture Yeast Baking in Bakeries.',
    flavorText: 'Eliminating fallow years with nitrogen-fixing clover and precision seed drills prevents colonial famines before they ever begin.',
    effects: [
      {
        type: 'unlock_recipe',
        targetId: 'four_course_seed_drill',
        description: 'Unlocks Norfolk 4-Course & Seed Drill in Wheat Farms (9 Grain/cycle)'
      },
      {
        type: 'unlock_recipe',
        targetId: 'convection_yeast_bread',
        description: 'Unlocks Pure-Culture Yeast Baking in Bakeries (2 Grain → 7 Bread)'
      }
    ]
  },
  germ_theory: {
    id: 'germ_theory',
    name: 'Germ Theory & Boiled-Water Sanitation',
    eraOrigin: 'Adapted from 1860s–1880s Microbiology',
    category: 'medicine',
    icon: '🔬',
    insightCost: 30,
    divergenceImpact: 14,
    paradoxImpact: 7,
    prerequisites: [],
    summary: 'Unlocks the Sanitation Clinic & Apothecary building and grants +8 Settlement Happiness.',
    flavorText: 'Simple rules—boiling drinking water, quarantining waste downstream, and distilling willow-bark salicylates—save thousands of lives in the New World.',
    effects: [
      {
        type: 'unlock_building',
        targetId: 'apothecary',
        description: 'Unlocks Sanitation Clinic & Apothecary (Sanitation service + Medicine production)'
      },
      {
        type: 'happiness_bonus',
        value: 8,
        description: '+8 Base Settlement Happiness from drastically lower disease rates'
      }
    ]
  },
  bessemer_metallurgy: {
    id: 'bessemer_metallurgy',
    name: 'Forced-Air Crucible Metallurgy',
    eraOrigin: 'Adapted from 1856 Steelmaking',
    category: 'metallurgy',
    icon: '🔥',
    insightCost: 35,
    divergenceImpact: 15,
    paradoxImpact: 9,
    prerequisites: ['water_circular_saw'],
    summary: 'Unlocks Bessemer Air-Blast Crucible in Blacksmiths and boosts Mine/Quarry extraction by +25%.',
    flavorText: 'Blowing preheated air through molten pig iron burns away impurities in minutes, giving colonial smiths affordable, high-carbon steel centuries early.',
    effects: [
      {
        type: 'unlock_recipe',
        targetId: 'crucible_steel_tools',
        description: 'Unlocks Bessemer Air-Blast Crucible in Blacksmiths (2 Iron + 1 Wood → 5 Tools)'
      },
      {
        type: 'production_multiplier',
        targetId: 'iron_mine',
        value: 0.25,
        description: '+25% Iron Mine extraction speed'
      },
      {
        type: 'production_multiplier',
        targetId: 'quarry',
        value: 0.25,
        description: '+25% Stone Quarry extraction speed'
      }
    ]
  },
  scientific_press: {
    id: 'scientific_press',
    name: 'Movable-Type Scientific Press & Natural Philosophy',
    eraOrigin: 'Adapted from 1750s–1820s Enlightenment',
    category: 'enlightenment',
    icon: '📜',
    insightCost: 40,
    divergenceImpact: 18,
    paradoxImpact: 6,
    prerequisites: ['germ_theory'],
    summary: 'Unlocks Enlightened Manor (Tier 3 Innovators), increases Insight generation by +25%, and reduces Paradox pressure.',
    flavorText: 'Framing future discoveries as "Natural Philosophy" pamphlets legitimizes your breakthroughs in the eyes of colonists and royal observers alike.',
    effects: [
      {
        type: 'unlock_building',
        targetId: 'enlightened_manor',
        description: 'Unlocks Enlightened Manor (Tier 3 Housing for Innovators)'
      },
      {
        type: 'insight_multiplier',
        value: 0.25,
        description: '+25% Future Insight generation across the settlement'
      },
      {
        type: 'paradox_reduction',
        value: 10,
        description: 'Immediately reduces Paradox Pressure by 10 through public education'
      }
    ]
  },
  optical_telegraph_logistics: {
    id: 'optical_telegraph_logistics',
    name: 'Semaphore Telegraph & Chartered Warehousing',
    eraOrigin: 'Adapted from 1790s–1830s Logistics',
    category: 'enlightenment',
    icon: '🗼',
    insightCost: 45,
    divergenceImpact: 16,
    paradoxImpact: 5,
    prerequisites: ['crop_rotation', 'scientific_press'],
    summary: 'Expands Warehouse storage capacity by +150 and boosts all production speeds by +15%.',
    flavorText: 'Hilltop optical shutters and double-entry inventory ledgers coordinate supply chains across the valley with clockwork precision.',
    effects: [
      {
        type: 'storage_bonus',
        value: 150,
        description: '+150 Global Warehouse Storage Capacity'
      },
      {
        type: 'production_multiplier',
        targetId: 'all',
        value: 0.15,
        description: '+15% Production speed across all gathering and workshop buildings'
      }
    ]
  }
};

export const TECHNOLOGY_LIST: TechnologyDefinition[] = Object.values(TECHNOLOGIES);
