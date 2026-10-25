export type ResourceId =
  | 'wood'
  | 'planks'
  | 'fish'
  | 'grain'
  | 'bread'
  | 'stone'
  | 'iron_ore'
  | 'tools'
  | 'herbs'
  | 'medicine'
  | 'coin'
  | 'insight';

export type TerrainType =
  | 'deep_water'
  | 'coastal_water'
  | 'river'
  | 'grass'
  | 'fertile_soil'
  | 'forest'
  | 'stone_deposit'
  | 'iron_deposit';

export type BuildingCategory =
  | 'civic'
  | 'housing'
  | 'gathering'
  | 'production'
  | 'temporal';

export type PopulationTierId = 'pioneers' | 'colonists' | 'innovators';

export type ServiceType = 'logistics' | 'market' | 'sanitation' | 'knowledge';

export interface ResourceDefinition {
  id: ResourceId;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  category: 'material' | 'food' | 'industrial' | 'special';
  isStoredInWarehouse: boolean;
  startingAmount: number;
  description: string;
}

export interface TerrainDefinition {
  id: TerrainType;
  name: string;
  color: string;
  secondaryColor: string;
  buildable: boolean;
  walkable: boolean;
  description: string;
  resourceHint?: string;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  inputs: Partial<Record<ResourceId, number>>;
  outputs: Partial<Record<ResourceId, number>>;
  cycleSeconds: number;
  requiredTechId?: string;
  isAnachronistic?: boolean;
  description: string;
}

export interface HousingConfig {
  tier: PopulationTierId;
  capacity: number;
  upgradesToBuildingId?: string;
  upgradeCost?: Partial<Record<ResourceId, number>>;
  requiredTechForUpgrade?: string;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  icon: string;
  color: string;
  accentColor: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  upkeepCoinPerMin: number;
  workersRequired: number;
  allowedTerrains: TerrainType[];
  adjacentTerrainRequired?: TerrainType[];
  requiresRoad: boolean;
  isRoad?: boolean;
  serviceRadius?: number;
  serviceType?: ServiceType;
  housing?: HousingConfig;
  recipes?: RecipeDefinition[];
  passiveInsightPerMin?: number;
  storageBonus?: number;
  paradoxDampeningPerMin?: number;
  divergenceOnBuild?: number;
  requiredTechId?: string;
}

export interface NeedItem {
  id: string;
  label: string;
  resource?: ResourceId;
  service?: ServiceType;
  consumptionPer10PopPerMin?: number;
  happinessWeight: number;
  requiredForUpgrade: boolean;
}

export interface PopulationTierDefinition {
  id: PopulationTierId;
  name: string;
  badge: string;
  taxPer10PopPerMin: number;
  insightPer10PopPerMin: number;
  needs: NeedItem[];
  description: string;
}

export interface TechEffect {
  type:
    | 'unlock_building'
    | 'unlock_recipe'
    | 'production_multiplier'
    | 'happiness_bonus'
    | 'storage_bonus'
    | 'insight_multiplier'
    | 'paradox_reduction';
  targetId?: string;
  value?: number;
  description: string;
}

export interface TechnologyDefinition {
  id: string;
  name: string;
  eraOrigin: string;
  category: 'agriculture' | 'medicine' | 'metallurgy' | 'industry' | 'enlightenment';
  icon: string;
  insightCost: number;
  divergenceImpact: number;
  paradoxImpact: number;
  prerequisites: string[];
  summary: string;
  flavorText: string;
  effects: TechEffect[];
}

export interface EventChoiceEffect {
  resources?: Partial<Record<ResourceId, number>>;
  divergenceDelta?: number;
  paradoxDelta?: number;
  happinessModifierDelta?: number;
  productionMultiplierDelta?: number;
  populationDelta?: number;
  chronicleEntry: string;
}

export interface EventChoice {
  id: string;
  label: string;
  isAnachronistic?: boolean;
  requiredTechId?: string;
  cost?: Partial<Record<ResourceId, number>>;
  outcomeText: string;
  effects: EventChoiceEffect;
}

export interface HistoricalEventDefinition {
  id: string;
  title: string;
  year: string;
  minDay: number;
  minPopulation?: number;
  minDivergence?: number;
  minParadox?: number;
  description: string;
  historicalContext: string;
  choices: EventChoice[];
}
