import type { PopulationTierDefinition, PopulationTierId } from './types.ts';

export const POPULATION_TIERS: Record<PopulationTierId, PopulationTierDefinition> = {
  pioneers: {
    id: 'pioneers',
    name: 'Pioneers',
    badge: '⛺',
    taxPer10PopPerMin: 9,
    insightPer10PopPerMin: 0.6,
    description: 'Hardworking early settlers who felled the first trees. Require Fish and a nearby Market Square to thrive and upgrade.',
    needs: [
      {
        id: 'need_fish',
        label: 'Salted Fish',
        resource: 'fish',
        consumptionPer10PopPerMin: 0.9,
        happinessWeight: 55,
        requiredForUpgrade: true
      },
      {
        id: 'need_market',
        label: 'Market Access',
        service: 'market',
        happinessWeight: 45,
        requiredForUpgrade: true
      }
    ]
  },
  colonists: {
    id: 'colonists',
    name: 'Colonists',
    badge: '🏘️',
    taxPer10PopPerMin: 20,
    insightPer10PopPerMin: 1.8,
    description: 'Skilled artisans and farmers who staff advanced workshops. Demand Bread, Tools, and Sanitation to join the Enlightened.',
    needs: [
      {
        id: 'need_fish',
        label: 'Salted Fish',
        resource: 'fish',
        consumptionPer10PopPerMin: 0.7,
        happinessWeight: 20,
        requiredForUpgrade: true
      },
      {
        id: 'need_bread',
        label: 'Artisan Bread',
        resource: 'bread',
        consumptionPer10PopPerMin: 0.8,
        happinessWeight: 30,
        requiredForUpgrade: true
      },
      {
        id: 'need_tools',
        label: 'Precision Tools',
        resource: 'tools',
        consumptionPer10PopPerMin: 0.45,
        happinessWeight: 25,
        requiredForUpgrade: true
      },
      {
        id: 'need_market',
        label: 'Market Access',
        service: 'market',
        happinessWeight: 15,
        requiredForUpgrade: true
      },
      {
        id: 'need_sanitation',
        label: 'Apothecary Sanitation',
        service: 'sanitation',
        happinessWeight: 10,
        requiredForUpgrade: false
      }
    ]
  },
  innovators: {
    id: 'innovators',
    name: 'Innovators',
    badge: '🔭',
    taxPer10PopPerMin: 38,
    insightPer10PopPerMin: 2.8,
    description: 'Colonial thinkers educated in your future scientific principles. Generate substantial Silver and Future Insight.',
    needs: [
      {
        id: 'need_bread',
        label: 'Artisan Bread',
        resource: 'bread',
        consumptionPer10PopPerMin: 0.9,
        happinessWeight: 25,
        requiredForUpgrade: false
      },
      {
        id: 'need_tools',
        label: 'Precision Tools',
        resource: 'tools',
        consumptionPer10PopPerMin: 0.55,
        happinessWeight: 20,
        requiredForUpgrade: false
      },
      {
        id: 'need_medicine',
        label: 'Antiseptic Tonics',
        resource: 'medicine',
        consumptionPer10PopPerMin: 0.5,
        happinessWeight: 25,
        requiredForUpgrade: false
      },
      {
        id: 'need_sanitation',
        label: 'Apothecary Sanitation',
        service: 'sanitation',
        happinessWeight: 15,
        requiredForUpgrade: false
      },
      {
        id: 'need_knowledge',
        label: 'Observatory Exchange',
        service: 'knowledge',
        happinessWeight: 15,
        requiredForUpgrade: false
      }
    ]
  }
};

export const POPULATION_TIER_ORDER: PopulationTierId[] = ['pioneers', 'colonists', 'innovators'];
