import { BUILDINGS } from '../data/buildings.ts';
import { HISTORICAL_EVENTS } from '../data/events.ts';
import { POPULATION_TIERS, POPULATION_TIER_ORDER } from '../data/population.ts';
import { BASE_WAREHOUSE_CAPACITY, RESOURCES, RESOURCE_ORDER } from '../data/resources.ts';
import { TECHNOLOGIES } from '../data/technologies.ts';
import { TUTORIAL_STEPS, type TutorialStepDefinition } from '../data/tutorial.ts';
import type {
  BuildingDefinition,
  EventChoice,
  PopulationTierId,
  RecipeDefinition,
  ResourceId,
  ServiceType,
  TerrainType
} from '../data/types.ts';
import { type GeneratedTileData, MAP_HEIGHT, MAP_WIDTH, generateColonialMap } from './mapGenerator.ts';

export type BuildingStatus =
  | 'constructing'
  | 'working'
  | 'no_road'
  | 'no_workers'
  | 'missing_inputs'
  | 'storage_full'
  | 'paused'
  | 'housing'
  | 'civic';

export interface PlacedBuilding {
  id: string;
  defId: string;
  x: number;
  y: number;
  activeRecipeId: string;
  progressSeconds: number;
  constructionProgressSeconds: number;
  buildTimeSeconds: number;
  isConstructed: boolean;
  residents: number;
  paused: boolean;
  connectedToLogistics: boolean;
  servicesAvailable: Record<ServiceType, boolean>;
  status: BuildingStatus;
  efficiency: number;
}

export interface Tile extends GeneratedTileData {
  buildingId?: string;
}

export interface ChronicleEntry {
  id: string;
  day: number;
  yearText: string;
  title: string;
  text: string;
  category: 'event' | 'tech' | 'milestone';
}

export interface GameState {
  seed: number;
  width: number;
  height: number;
  tiles: Tile[][];
  buildings: Record<string, PlacedBuilding>;
  nextBuildingSeq: number;
  resources: Record<ResourceId, number>;
  netRatesPerMin: Record<ResourceId, number>;
  storageCapacity: number;
  populationByTier: Record<PopulationTierId, number>;
  housingCapacityByTier: Record<PopulationTierId, number>;
  totalPopulation: number;
  workersNeeded: number;
  laborEfficiency: number;
  happiness: number;
  permanentHappinessBonus: number;
  permanentProductionBonus: number;
  needSatisfaction: Record<string, number>;
  unlockedTechIds: string[];
  completedEventIds: string[];
  activeEventId: string | null;
  activeEventDeadlineDay: number | null;
  eventDeferred: boolean;
  divergence: number;
  paradox: number;
  day: number;
  dayProgress: number;
  speed: 0 | 1 | 2 | 4;
  won: boolean;
  winDismissed: boolean;
  introSeen: boolean;
  tutorialActive: boolean;
  tutorialStepIndex: number;
  tutorialCompleted: boolean;
  tutorialBrowsingManually?: boolean;
  completedTutorialStepIds: string[];
  achievedMilestoneIds: string[];
  trunksUnsealed: boolean;
  lastEventDay: number;
  chronicle: ChronicleEntry[];
}

export const WIN_CONDITIONS = {
  minPopulation: 75,
  minDivergence: 50,
  minInnovators: 20,
  maxParadox: 70
};

export const SECONDS_PER_DAY = 25;
export const MIN_DAYS_BETWEEN_EVENTS = 8;
export const EVENT_DECISION_WINDOW_DAYS = 5;

export function getColonialYearString(day: number): string {
  const baseYear = 1607;
  const yearsElapsed = Math.floor((day - 1) / 12);
  const seasonIndex = Math.floor(((day - 1) % 12) / 3);
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  return `${seasons[seasonIndex]} ${baseYear + yearsElapsed}`;
}

export function createInitialGameState(seed = 1607, withStarterSettlement = false): GameState {
  const rawMap = generateColonialMap(seed);
  const tiles: Tile[][] = rawMap.map((row) => row.map((cell) => ({ ...cell })));

  const resources = {} as Record<ResourceId, number>;
  const netRatesPerMin = {} as Record<ResourceId, number>;
  for (const resId of RESOURCE_ORDER) {
    resources[resId] = RESOURCES[resId].startingAmount;
    netRatesPerMin[resId] = 0;
  }

  const state: GameState = {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    buildings: {},
    nextBuildingSeq: 1,
    resources,
    netRatesPerMin,
    storageCapacity: BASE_WAREHOUSE_CAPACITY,
    populationByTier: { pioneers: 0, colonists: 0, innovators: 0 },
    housingCapacityByTier: { pioneers: 0, colonists: 0, innovators: 0 },
    totalPopulation: 0,
    workersNeeded: 0,
    laborEfficiency: 1,
    happiness: 75,
    permanentHappinessBonus: 0,
    permanentProductionBonus: 0,
    needSatisfaction: {},
    unlockedTechIds: [],
    completedEventIds: [],
    activeEventId: null,
    activeEventDeadlineDay: null,
    eventDeferred: false,
    divergence: 5,
    paradox: 2,
    day: 1,
    dayProgress: 0,
    speed: 1,
    won: false,
    winDismissed: false,
    introSeen: false,
    tutorialActive: true,
    tutorialStepIndex: 0,
    tutorialCompleted: false,
    completedTutorialStepIds: [],
    achievedMilestoneIds: [],
    trunksUnsealed: false,
    lastEventDay: 1,
    chronicle: [
      {
        id: 'chronicle_arrival',
        day: 1,
        yearText: 'Spring 1607',
        title: 'Landfall at James River Point',
        text: 'Your time-displaced expedition wades ashore in colonial Virginia. Choose a landing site and secure timber, fishing, and shelter before unsealing the future archives.',
        category: 'milestone'
      }
    ]
  };

  if (withStarterSettlement) {
    seedStarterSettlement(state);
    state.completedTutorialStepIds.push('place_landing', 'build_first_cabin');
    state.tutorialStepIndex = 2;
  }

  recalculateNetworkAndCapacities(state);
  return state;
}

export function getBestUnlockedRecipe(
  state: GameState,
  def: BuildingDefinition
): RecipeDefinition | undefined {
  if (!def.recipes || def.recipes.length === 0) return undefined;
  for (let i = def.recipes.length - 1; i >= 0; i--) {
    const r = def.recipes[i];
    if (!r.requiredTechId || state.unlockedTechIds.includes(r.requiredTechId)) {
      return r;
    }
  }
  return def.recipes[0];
}

function seedStarterSettlement(state: GameState): void {
  const placeFree = (defId: string, x: number, y: number, initialResidents?: number) => {
    const def = BUILDINGS[defId];
    if (!def) return;
    const id = `bld_${state.nextBuildingSeq++}`;
    const defaultRecipe = getBestUnlockedRecipe(state, def)?.id ?? '';
    const buildTime = def.buildTimeSeconds ?? (def.isRoad ? 1.5 : 5);
    const bld: PlacedBuilding = {
      id,
      defId,
      x,
      y,
      activeRecipeId: defaultRecipe,
      progressSeconds: 0,
      constructionProgressSeconds: buildTime,
      buildTimeSeconds: buildTime,
      isConstructed: true,
      residents: initialResidents ?? (def.housing ? Math.min(def.housing.capacity, 6) : 0),
      paused: false,
      connectedToLogistics: true,
      servicesAvailable: { logistics: false, market: false, sanitation: false, knowledge: false },
      status: def.housing ? 'housing' : def.recipes ? 'working' : 'civic',
      efficiency: 1
    };
    state.buildings[id] = bld;
    state.tiles[y][x].buildingId = id;
  };

  // Temporal Landing & Warehouse at (7, 8)
  placeFree('founding_camp', 7, 8);

  // Short starter Colonial Cart Road stub at (8, 8) and (9, 8)
  placeFree('dirt_road', 8, 8);
  placeFree('dirt_road', 9, 8);

  // Founding crew's initial Pioneer Cabin at (8, 7)
  placeFree('pioneer_cabin', 8, 7, 6);
}

export function getTile(state: GameState, x: number, y: number): Tile | undefined {
  if (y < 0 || y >= state.height || x < 0 || x >= state.width) {
    return undefined;
  }
  return state.tiles[y][x];
}

export function getOrthogonalNeighbors(state: GameState, x: number, y: number): Tile[] {
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];
  const result: Tile[] = [];
  for (const d of dirs) {
    const t = getTile(state, x + d.dx, y + d.dy);
    if (t) result.push(t);
  }
  return result;
}

export function hasEnoughResources(
  state: GameState,
  cost?: Partial<Record<ResourceId, number>>
): { ok: boolean; missing?: ResourceId } {
  if (!cost) return { ok: true };
  for (const [resKey, amount] of Object.entries(cost) as Array<[ResourceId, number]>) {
    if ((amount ?? 0) > 0 && state.resources[resKey] < amount) {
      return { ok: false, missing: resKey };
    }
  }
  return { ok: true };
}

export function payResources(state: GameState, cost?: Partial<Record<ResourceId, number>>): void {
  if (!cost) return;
  for (const [resKey, amount] of Object.entries(cost) as Array<[ResourceId, number]>) {
    if (amount) {
      state.resources[resKey] = Math.max(0, state.resources[resKey] - amount);
    }
  }
}

export function addResourceWithCap(state: GameState, resId: ResourceId, delta: number): number {
  const current = state.resources[resId];
  const def = RESOURCES[resId];
  if (def.isStoredInWarehouse) {
    const next = Math.max(0, Math.min(state.storageCapacity, current + delta));
    const actualAdded = next - current;
    state.resources[resId] = next;
    return actualAdded;
  } else {
    const next = Math.max(0, current + delta);
    const actualAdded = next - current;
    state.resources[resId] = next;
    return actualAdded;
  }
}

export function getEffectiveBuildingCost(
  state: GameState,
  defId: string
): Partial<Record<ResourceId, number>> | undefined {
  const def = BUILDINGS[defId];
  if (!def) return undefined;
  // The player's very first Temporal Landing & Warehouse placement is free
  if (defId === 'founding_camp') {
    const hasWarehouse = Object.values(state.buildings).some((b) => b.defId === 'founding_camp');
    if (!hasWarehouse) {
      return {};
    }
  }
  return def.cost;
}

export function canPlaceBuilding(
  state: GameState,
  defId: string,
  x: number,
  y: number
): { valid: boolean; reason?: string } {
  const def = BUILDINGS[defId];
  if (!def) {
    return { valid: false, reason: 'Unknown building type.' };
  }

  if (def.requiredTechId && !state.unlockedTechIds.includes(def.requiredTechId)) {
    const techName = TECHNOLOGIES[def.requiredTechId]?.name ?? def.requiredTechId;
    return { valid: false, reason: `Requires Future Knowledge: ${techName}.` };
  }

  const tile = getTile(state, x, y);
  if (!tile) {
    return { valid: false, reason: 'Out of map bounds.' };
  }

  if (tile.buildingId) {
    return { valid: false, reason: 'Tile is already occupied.' };
  }

  if (!def.allowedTerrains.includes(tile.terrain)) {
    return {
      valid: false,
      reason: `${def.name} cannot be placed on ${tile.terrain.replace('_', ' ')}.`
    };
  }

  if (def.adjacentTerrainRequired && def.adjacentTerrainRequired.length > 0) {
    const neighbors = [tile, ...getOrthogonalNeighbors(state, x, y)];
    const matchesAdjacent = neighbors.some((n) => def.adjacentTerrainRequired!.includes(n.terrain));
    if (!matchesAdjacent) {
      const needed = def.adjacentTerrainRequired.map((t) => t.replace('_', ' ')).join(' or ');
      return {
        valid: false,
        reason: `Must be placed on or adjacent to ${needed}.`
      };
    }
  }

  const effectiveCost = getEffectiveBuildingCost(state, defId);
  const costCheck = hasEnoughResources(state, effectiveCost);
  if (!costCheck.ok && costCheck.missing) {
    return {
      valid: false,
      reason: `Insufficient ${RESOURCES[costCheck.missing].name}.`
    };
  }

  return { valid: true };
}

export function placeBuilding(
  state: GameState,
  defId: string,
  x: number,
  y: number
): { success: boolean; reason?: string; building?: PlacedBuilding } {
  const check = canPlaceBuilding(state, defId, x, y);
  if (!check.valid) {
    return { success: false, reason: check.reason };
  }

  const def = BUILDINGS[defId];
  const effectiveCost = getEffectiveBuildingCost(state, defId);
  payResources(state, effectiveCost);

  const id = `bld_${state.nextBuildingSeq++}`;
  const defaultRecipe = getBestUnlockedRecipe(state, def)?.id ?? '';
  const buildTime = def.buildTimeSeconds ?? (def.isRoad ? 1.5 : 6);

  const building: PlacedBuilding = {
    id,
    defId,
    x,
    y,
    activeRecipeId: defaultRecipe,
    progressSeconds: 0,
    constructionProgressSeconds: 0,
    buildTimeSeconds: buildTime,
    isConstructed: false,
    residents: 0,
    paused: false,
    connectedToLogistics: false,
    servicesAvailable: { logistics: false, market: false, sanitation: false, knowledge: false },
    status: 'constructing',
    efficiency: 0
  };

  state.buildings[id] = building;
  state.tiles[y][x].buildingId = id;

  recalculateNetworkAndCapacities(state);
  evaluateTutorialProgress(state);
  return { success: true, building };
}

export function demolishTile(
  state: GameState,
  x: number,
  y: number
): { success: boolean; reason?: string } {
  const tile = getTile(state, x, y);
  if (!tile || !tile.buildingId) {
    return { success: false, reason: 'Nothing to demolish on this tile.' };
  }

  const building = state.buildings[tile.buildingId];
  if (!building) {
    tile.buildingId = undefined;
    return { success: false, reason: 'Building not found.' };
  }

  // Prevent demolishing the sole Founding Camp warehouse
  if (building.defId === 'founding_camp') {
    const warehouseCount = Object.values(state.buildings).filter(
      (b) => b.defId === 'founding_camp'
    ).length;
    if (warehouseCount <= 1) {
      return {
        success: false,
        reason: 'Cannot demolish your primary Temporal Landing & Warehouse.'
      };
    }
  }

  const def = BUILDINGS[building.defId];
  // Refund 50% of material costs
  if (def?.cost) {
    for (const [resKey, amount] of Object.entries(def.cost) as Array<[ResourceId, number]>) {
      if (amount && amount > 1) {
        addResourceWithCap(state, resKey, Math.floor(amount * 0.5));
      }
    }
  }

  delete state.buildings[building.id];
  tile.buildingId = undefined;
  recalculateNetworkAndCapacities(state);
  return { success: true };
}

export function canUpgradeHouse(
  state: GameState,
  buildingId: string
): { valid: boolean; reason?: string; targetDefId?: string } {
  const bld = state.buildings[buildingId];
  if (!bld) return { valid: false, reason: 'Building not found.' };
  if (bld.isConstructed === false) {
    return { valid: false, reason: 'Wait for construction to finish before upgrading.' };
  }

  const def = BUILDINGS[bld.defId];
  if (!def?.housing || !def.housing.upgradesToBuildingId) {
    return { valid: false, reason: 'This residence is already at maximum tier.' };
  }

  const housing = def.housing;
  if (housing.requiredTechForUpgrade && !state.unlockedTechIds.includes(housing.requiredTechForUpgrade)) {
    const tech = TECHNOLOGIES[housing.requiredTechForUpgrade];
    return {
      valid: false,
      reason: `Requires Future Knowledge: ${tech ? tech.name : housing.requiredTechForUpgrade}.`
    };
  }

  if (!bld.connectedToLogistics) {
    return { valid: false, reason: 'Residence must be connected to a Warehouse by road.' };
  }

  // Check tier upgrade need requirements
  const tierDef = POPULATION_TIERS[housing.tier];
  for (const need of tierDef.needs) {
    if (!need.requiredForUpgrade) continue;
    if (need.service && !bld.servicesAvailable[need.service]) {
      return { valid: false, reason: `Missing required service: ${need.label}.` };
    }
    if (need.resource && (state.needSatisfaction[need.id] ?? 0) < 0.7) {
      return { valid: false, reason: `Needs steady supply of ${need.label} before upgrading.` };
    }
  }

  const costCheck = hasEnoughResources(state, housing.upgradeCost);
  if (!costCheck.ok && costCheck.missing) {
    return {
      valid: false,
      reason: `Insufficient ${RESOURCES[costCheck.missing].name} for upgrade.`
    };
  }

  return { valid: true, targetDefId: housing.upgradesToBuildingId };
}

export function upgradeHouse(
  state: GameState,
  buildingId: string
): { success: boolean; reason?: string } {
  const check = canUpgradeHouse(state, buildingId);
  if (!check.valid || !check.targetDefId) {
    return { success: false, reason: check.reason };
  }

  const bld = state.buildings[buildingId];
  const oldDef = BUILDINGS[bld.defId];
  const newDef = BUILDINGS[check.targetDefId];

  payResources(state, oldDef.housing?.upgradeCost);
  bld.defId = newDef.id;
  bld.residents = Math.max(bld.residents + 2, Math.floor((newDef.housing?.capacity ?? 12) * 0.75));

  if (newDef.divergenceOnBuild) {
    state.divergence = Math.min(100, state.divergence + newDef.divergenceOnBuild);
  }

  recalculateNetworkAndCapacities(state);
  evaluateTutorialProgress(state);
  return { success: true };
}

export function getAvailableRecipes(state: GameState, def: BuildingDefinition): RecipeDefinition[] {
  if (!def.recipes) return [];
  return def.recipes.filter(
    (r) => !r.requiredTechId || state.unlockedTechIds.includes(r.requiredTechId)
  );
}

export function setBuildingRecipe(state: GameState, buildingId: string, recipeId: string): boolean {
  const bld = state.buildings[buildingId];
  if (!bld) return false;
  const def = BUILDINGS[bld.defId];
  if (!def?.recipes) return false;

  const recipe = def.recipes.find((r) => r.id === recipeId);
  if (!recipe) return false;
  if (recipe.requiredTechId && !state.unlockedTechIds.includes(recipe.requiredTechId)) {
    return false;
  }

  bld.activeRecipeId = recipeId;
  bld.progressSeconds = 0;
  return true;
}

export function toggleBuildingPaused(state: GameState, buildingId: string): boolean {
  const bld = state.buildings[buildingId];
  if (!bld) return false;
  bld.paused = !bld.paused;
  recalculateNetworkAndCapacities(state);
  return true;
}

export function canUnlockTech(
  state: GameState,
  techId: string
): { valid: boolean; reason?: string } {
  const tech = TECHNOLOGIES[techId];
  if (!tech) return { valid: false, reason: 'Unknown technology.' };
  if (state.unlockedTechIds.includes(techId)) {
    return { valid: false, reason: 'Already unlocked.' };
  }

  for (const prereq of tech.prerequisites) {
    if (!state.unlockedTechIds.includes(prereq)) {
      const prereqName = TECHNOLOGIES[prereq]?.name ?? prereq;
      return { valid: false, reason: `Requires ${prereqName} first.` };
    }
  }

  if (state.resources.insight < tech.insightCost) {
    return {
      valid: false,
      reason: `Requires ${tech.insightCost} Future Insight (have ${Math.floor(state.resources.insight)}).`
    };
  }

  return { valid: true };
}

export function unlockTech(
  state: GameState,
  techId: string
): { success: boolean; reason?: string } {
  const check = canUnlockTech(state, techId);
  if (!check.valid) return { success: false, reason: check.reason };

  const tech = TECHNOLOGIES[techId];
  state.resources.insight -= tech.insightCost;
  state.unlockedTechIds.push(techId);

  state.divergence = Math.min(100, state.divergence + tech.divergenceImpact);
  state.paradox = Math.max(0, Math.min(100, state.paradox + tech.paradoxImpact));

  for (const effect of tech.effects) {
    if (effect.type === 'paradox_reduction' && effect.value) {
      state.paradox = Math.max(0, state.paradox - effect.value);
    }
    // Automatically upgrade existing buildings to newly unlocked anachronistic recipes!
    if (effect.type === 'unlock_recipe' && effect.targetId) {
      for (const bld of Object.values(state.buildings)) {
        const def = BUILDINGS[bld.defId];
        const matchingRecipe = def?.recipes?.find((r) => r.id === effect.targetId);
        if (matchingRecipe) {
          bld.activeRecipeId = matchingRecipe.id;
        }
      }
    }
  }

  state.chronicle.unshift({
    id: `tech_${techId}_${state.day}`,
    day: state.day,
    yearText: getColonialYearString(state.day),
    title: `Introduced ${tech.name}`,
    text: `${tech.flavorText} (+${tech.divergenceImpact}% Divergence)`,
    category: 'tech'
  });

  recalculateNetworkAndCapacities(state);
  evaluateTutorialProgress(state);
  checkWinCondition(state);
  return { success: true };
}

export function getEffectiveEventChoiceCost(
  state: GameState,
  choice: EventChoice
): Partial<Record<ResourceId, number>> | undefined {
  if (!choice.cost) return undefined;
  // If the choice offers a requiredTechId alternative (e.g. "Requires Germ Theory or 18 Insight")
  // and the player has already unlocked that technology, waive the Insight portion of the cost.
  if (choice.requiredTechId && state.unlockedTechIds.includes(choice.requiredTechId)) {
    const adjusted: Partial<Record<ResourceId, number>> = { ...choice.cost };
    delete adjusted.insight;
    return Object.keys(adjusted).length > 0 ? adjusted : undefined;
  }
  return choice.cost;
}

export function canAffordEventChoice(
  state: GameState,
  choice: EventChoice
): { ok: boolean; missing?: ResourceId } {
  return hasEnoughResources(state, getEffectiveEventChoiceCost(state, choice));
}

export function resolveHistoricalEvent(
  state: GameState,
  eventId: string,
  choiceId: string
): { success: boolean; reason?: string; outcomeText?: string } {
  const eventDef = HISTORICAL_EVENTS.find((e) => e.id === eventId);
  if (!eventDef) return { success: false, reason: 'Event not found.' };

  const choice = eventDef.choices.find((c) => c.id === choiceId);
  if (!choice) return { success: false, reason: 'Choice not found.' };

  const effectiveCost = getEffectiveEventChoiceCost(state, choice);
  if (effectiveCost) {
    const costCheck = hasEnoughResources(state, effectiveCost);
    if (!costCheck.ok && costCheck.missing) {
      return {
        success: false,
        reason: `Not enough ${RESOURCES[costCheck.missing].name} for this decision.`
      };
    }
    payResources(state, effectiveCost);
  }

  const eff = choice.effects;
  if (eff.resources) {
    for (const [resId, delta] of Object.entries(eff.resources) as Array<[ResourceId, number]>) {
      if (delta) {
        addResourceWithCap(state, resId, delta);
      }
    }
  }
  if (eff.divergenceDelta) {
    state.divergence = Math.max(0, Math.min(100, state.divergence + eff.divergenceDelta));
  }
  if (eff.paradoxDelta) {
    state.paradox = Math.max(0, Math.min(100, state.paradox + eff.paradoxDelta));
  }
  if (eff.happinessModifierDelta) {
    state.permanentHappinessBonus += eff.happinessModifierDelta;
  }
  if (eff.productionMultiplierDelta) {
    state.permanentProductionBonus += eff.productionMultiplierDelta;
  }

  if (!state.completedEventIds.includes(eventId)) {
    state.completedEventIds.push(eventId);
  }
  if (state.activeEventId === eventId) {
    state.activeEventId = null;
    state.activeEventDeadlineDay = null;
    state.eventDeferred = false;
  }
  state.lastEventDay = state.day;

  state.chronicle.unshift({
    id: `evt_${eventId}_${state.day}`,
    day: state.day,
    yearText: eventDef.year,
    title: eventDef.title,
    text: eff.chronicleEntry,
    category: 'event'
  });

  recalculateNetworkAndCapacities(state);
  checkWinCondition(state);
  return { success: true, outcomeText: choice.outcomeText };
}

export function recalculateNetworkAndCapacities(state: GameState): void {
  // Ensure all buildings with recipes automatically use their best unlocked process
  for (const bld of Object.values(state.buildings)) {
    const def = BUILDINGS[bld.defId];
    if (def?.recipes && def.recipes.length > 0) {
      const best = getBestUnlockedRecipe(state, def);
      if (best && bld.activeRecipeId !== best.id) {
        bld.activeRecipeId = best.id;
      }
    }
  }

  // 1. Storage capacity
  let cap = BASE_WAREHOUSE_CAPACITY;
  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false) continue;
    const def = BUILDINGS[bld.defId];
    if (def?.storageBonus) {
      cap += def.storageBonus;
    }
  }
  for (const techId of state.unlockedTechIds) {
    const tech = TECHNOLOGIES[techId];
    for (const eff of tech?.effects ?? []) {
      if (eff.type === 'storage_bonus' && eff.value) {
        cap += eff.value;
      }
    }
  }
  state.storageCapacity = cap;

  // 2. Flood-fill road network from all constructed 'founding_camp' warehouses
  const visitedRoad = new Set<string>();
  const connectedRoadTiles = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [];

  for (const bld of Object.values(state.buildings)) {
    if (bld.defId === 'founding_camp' && bld.isConstructed !== false) {
      bld.connectedToLogistics = true;
      const key = `${bld.x},${bld.y}`;
      visitedRoad.add(key);
      connectedRoadTiles.add(key);
      queue.push({ x: bld.x, y: bld.y });
    } else {
      bld.connectedToLogistics = false;
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const neighbor of getOrthogonalNeighbors(state, curr.x, curr.y)) {
      if (!neighbor.buildingId) continue;
      const nbBld = state.buildings[neighbor.buildingId];
      if (!nbBld || nbBld.isConstructed === false) continue;
      const nbDef = BUILDINGS[nbBld.defId];
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (nbDef?.isRoad && !visitedRoad.has(nKey)) {
        visitedRoad.add(nKey);
        connectedRoadTiles.add(nKey);
        nbBld.connectedToLogistics = true;
        queue.push({ x: neighbor.x, y: neighbor.y });
      }
    }
  }

  // Any constructed building orthogonally adjacent to a connected road or warehouse (or within 2 tiles of a warehouse) is connected
  const warehouses = Object.values(state.buildings).filter(
    (b) => b.defId === 'founding_camp' && b.isConstructed !== false
  );
  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false) {
      bld.connectedToLogistics = false;
      continue;
    }
    const def = BUILDINGS[bld.defId];
    if (!def) continue;
    if (!def.requiresRoad) {
      bld.connectedToLogistics = true;
      continue;
    }

    const adj = getOrthogonalNeighbors(state, bld.x, bld.y);
    const touchesConnectedRoad = adj.some((t) => connectedRoadTiles.has(`${t.x},${t.y}`));
    const nearWarehouse = warehouses.some(
      (w) => Math.abs(w.x - bld.x) + Math.abs(w.y - bld.y) <= 2
    );

    bld.connectedToLogistics = touchesConnectedRoad || nearWarehouse;
  }

  // 3. Reset and compute service radii coverage (market, sanitation, knowledge, logistics)
  for (const bld of Object.values(state.buildings)) {
    bld.servicesAvailable = {
      logistics: bld.connectedToLogistics,
      market: false,
      sanitation: false,
      knowledge: false
    };
  }

  for (const provider of Object.values(state.buildings)) {
    if (provider.isConstructed === false || provider.paused || !provider.connectedToLogistics) {
      continue;
    }
    const pDef = BUILDINGS[provider.defId];
    if (!pDef?.serviceType || !pDef.serviceRadius) continue;

    for (const target of Object.values(state.buildings)) {
      if (target.isConstructed === false) continue;
      const dist = Math.hypot(provider.x - target.x, provider.y - target.y);
      if (dist <= pDef.serviceRadius) {
        target.servicesAvailable[pDef.serviceType] = true;
      }
    }
  }

  // 4. Population & Workforce totals
  state.populationByTier = { pioneers: 0, colonists: 0, innovators: 0 };
  state.housingCapacityByTier = { pioneers: 0, colonists: 0, innovators: 0 };
  let workersNeeded = 0;

  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false) continue;
    const def = BUILDINGS[bld.defId];
    if (!def) continue;
    if (def.housing) {
      const tier = def.housing.tier;
      state.populationByTier[tier] += Math.floor(bld.residents);
      state.housingCapacityByTier[tier] += def.housing.capacity;
    }
    if (!bld.paused && bld.connectedToLogistics && def.workersRequired > 0) {
      workersNeeded += def.workersRequired;
    }
  }

  state.totalPopulation =
    state.populationByTier.pioneers +
    state.populationByTier.colonists +
    state.populationByTier.innovators;
  state.workersNeeded = workersNeeded;

  if (workersNeeded <= 0) {
    state.laborEfficiency = 1;
  } else if (state.totalPopulation <= 0) {
    // Without any housed settlers, workshops have 0 workforce and cannot operate!
    state.laborEfficiency = 0;
  } else {
    state.laborEfficiency = Math.min(1, state.totalPopulation / workersNeeded);
  }
}

export function getBuildingProductionMultiplier(state: GameState, defId: string): number {
  const def = BUILDINGS[defId];
  if (def && def.workersRequired > 0 && state.totalPopulation <= 0) {
    return 0;
  }

  let mult = 1 + state.permanentProductionBonus;

  for (const techId of state.unlockedTechIds) {
    const tech = TECHNOLOGIES[techId];
    for (const eff of tech?.effects ?? []) {
      if (
        eff.type === 'production_multiplier' &&
        (eff.targetId === defId || eff.targetId === 'all') &&
        eff.value
      ) {
        mult += eff.value;
      }
    }
  }

  // High happiness grants up to +12% bonus; high paradox imposes a penalty
  if (state.happiness >= 80) {
    mult += 0.12;
  } else if (state.happiness < 40) {
    mult -= 0.15;
  }

  if (state.paradox > 60) {
    mult -= 0.2;
  }

  return Math.max(0.1, mult) * state.laborEfficiency;
}

export function stepSimulation(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return;

  // If any building under construction finishes strictly inside (0, dtSeconds),
  // split the step at the earliest completion boundary so newly completed buildings
  // only operate for the remaining time after construction finishes.
  let earliestCompletionDt = Infinity;
  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false) {
      const targetTime = bld.buildTimeSeconds || 5;
      const remaining = targetTime - (bld.constructionProgressSeconds || 0);
      if (remaining > 1e-6 && remaining < dtSeconds - 1e-6 && remaining < earliestCompletionDt) {
        earliestCompletionDt = remaining;
      }
    }
  }

  if (earliestCompletionDt < Infinity) {
    stepSimulation(state, earliestCompletionDt);
    stepSimulation(state, dtSeconds - earliestCompletionDt);
    return;
  }

  // 0. Advance active building construction sites
  const justCompletedConstructionIds = new Set<string>();
  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false) {
      const targetTime = bld.buildTimeSeconds || 5;
      bld.constructionProgressSeconds = Math.min(
        targetTime,
        (bld.constructionProgressSeconds || 0) + dtSeconds
      );
      bld.status = 'constructing';
      if (bld.constructionProgressSeconds + 1e-6 >= targetTime) {
        bld.constructionProgressSeconds = targetTime;
        bld.isConstructed = true;
        justCompletedConstructionIds.add(bld.id);
        const def = BUILDINGS[bld.defId];
        if (def?.housing) {
          const otherConstructedHouses = Object.values(state.buildings).filter(
            (other) =>
              other.id !== bld.id &&
              other.isConstructed !== false &&
              Boolean(BUILDINGS[other.defId]?.housing)
          ).length;
          bld.residents =
            otherConstructedHouses === 0
              ? def.housing.capacity
              : Math.max(2, Math.floor(def.housing.capacity * 0.5));
          bld.status = 'housing';
        } else if (def?.recipes && def.recipes.length > 0) {
          bld.status = 'working';
        } else {
          bld.status = 'civic';
        }
        if (def?.divergenceOnBuild) {
          state.divergence = Math.min(100, state.divergence + def.divergenceOnBuild);
        }
      }
    }
  }

  recalculateNetworkAndCapacities(state);

  // Track instantaneous resource deltas per minute for UI display
  const rateAccumulator: Record<ResourceId, number> = {} as Record<ResourceId, number>;
  for (const resId of RESOURCE_ORDER) {
    rateAccumulator[resId] = 0;
  }

  // 1. Population Needs & Happiness calculation
  let weightedSatisfactionSum = 0;
  let totalWeight = 0;

  for (const tierId of POPULATION_TIER_ORDER) {
    const tierPop = state.populationByTier[tierId];
    const tierDef = POPULATION_TIERS[tierId];

    for (const need of tierDef.needs) {
      let satisfaction = 1;

      if (need.resource && need.consumptionPer10PopPerMin) {
        const ratePerMin = (tierPop / 10) * need.consumptionPer10PopPerMin;
        const consumedThisTick = (ratePerMin / 60) * dtSeconds;
        rateAccumulator[need.resource] -= ratePerMin;

        if (tierPop === 0) {
          satisfaction = state.resources[need.resource] > 0 ? 1 : 0;
        } else if (state.resources[need.resource] >= consumedThisTick && state.resources[need.resource] > 0.2) {
          state.resources[need.resource] = Math.max(0, state.resources[need.resource] - consumedThisTick);
          satisfaction = 1;
        } else {
          state.resources[need.resource] = 0;
          satisfaction = 0;
        }
      } else if (need.service) {
        const housesOfTier = Object.values(state.buildings).filter(
          (b) => BUILDINGS[b.defId]?.housing?.tier === tierId
        );
        if (housesOfTier.length === 0) {
          satisfaction = 1;
        } else {
          const covered = housesOfTier.filter((h) => h.servicesAvailable[need.service!]).length;
          satisfaction = covered / housesOfTier.length;
        }
      }

      state.needSatisfaction[need.id] = satisfaction;
      if (tierPop > 0) {
        weightedSatisfactionSum += satisfaction * need.happinessWeight * tierPop;
        totalWeight += need.happinessWeight * tierPop;
      }
    }
  }

  let baseHappiness = totalWeight > 0 ? (weightedSatisfactionSum / totalWeight) * 85 : 75;
  for (const techId of state.unlockedTechIds) {
    const tech = TECHNOLOGIES[techId];
    for (const eff of tech?.effects ?? []) {
      if (eff.type === 'happiness_bonus' && eff.value) {
        baseHappiness += eff.value;
      }
    }
  }
  baseHappiness += state.permanentHappinessBonus;
  // Paradox pressure above 35 makes colonists uneasy
  if (state.paradox > 35) {
    baseHappiness -= (state.paradox - 35) * 0.45;
  }

  state.happiness = Math.max(5, Math.min(100, Math.round(baseHappiness)));

  // 2. Housing population growth (when happy & connected)
  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false || justCompletedConstructionIds.has(bld.id)) continue;
    const def = BUILDINGS[bld.defId];
    if (!def?.housing) continue;

    bld.status = bld.connectedToLogistics ? 'housing' : 'no_road';
    if (!bld.connectedToLogistics) continue;

    const cap = def.housing.capacity;
    if (state.happiness >= 45 && bld.residents < cap) {
      const growthPerSec = state.happiness >= 75 ? 0.09 : 0.05;
      bld.residents = Math.min(cap, bld.residents + growthPerSec * dtSeconds);
    } else if (state.happiness < 30 && bld.residents > 2) {
      bld.residents = Math.max(2, bld.residents - 0.04 * dtSeconds);
    }
  }

  // 3. Tax Coin, Upkeep, and Future Insight generation
  let netCoinPerMin = 0;
  let netInsightPerMin = 0;
  let netParadoxDampeningPerMin = 0.6; // Natural baseline adaptation

  for (const tierId of POPULATION_TIER_ORDER) {
    const pop = state.populationByTier[tierId];
    const tierDef = POPULATION_TIERS[tierId];
    const happinessTaxMod = 0.6 + (state.happiness / 100) * 0.6;
    netCoinPerMin += (pop / 10) * tierDef.taxPer10PopPerMin * happinessTaxMod;
    netInsightPerMin += (pop / 10) * tierDef.insightPer10PopPerMin;
  }

  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false || justCompletedConstructionIds.has(bld.id)) continue;
    const def = BUILDINGS[bld.defId];
    if (!def) continue;
    if (!bld.paused) {
      netCoinPerMin -= def.upkeepCoinPerMin;
    }
    if (!bld.paused && bld.connectedToLogistics) {
      if (def.passiveInsightPerMin) {
        const eff = def.workersRequired > 0 ? state.laborEfficiency : 1;
        netInsightPerMin += def.passiveInsightPerMin * eff;
      }
      if (def.paradoxDampeningPerMin) {
        const eff = def.workersRequired > 0 ? state.laborEfficiency : 1;
        netParadoxDampeningPerMin += def.paradoxDampeningPerMin * eff;
      }
    }
  }

  let insightMultiplier = 1;
  for (const techId of state.unlockedTechIds) {
    const tech = TECHNOLOGIES[techId];
    for (const eff of tech?.effects ?? []) {
      if (eff.type === 'insight_multiplier' && eff.value) {
        insightMultiplier += eff.value;
      }
    }
  }
  netInsightPerMin *= insightMultiplier;

  addResourceWithCap(state, 'coin', (netCoinPerMin / 60) * dtSeconds);
  addResourceWithCap(state, 'insight', (netInsightPerMin / 60) * dtSeconds);
  rateAccumulator.coin += netCoinPerMin;
  rateAccumulator.insight += netInsightPerMin;

  // Dampen paradox over time via Markets, Observatories, and natural adaptation
  state.paradox = Math.max(0, state.paradox - (netParadoxDampeningPerMin / 60) * dtSeconds);

  // 4. Production & Gathering buildings
  for (const bld of Object.values(state.buildings)) {
    if (bld.isConstructed === false || justCompletedConstructionIds.has(bld.id)) continue;
    const def = BUILDINGS[bld.defId];
    if (!def || !def.recipes || def.recipes.length === 0) continue;

    if (bld.paused) {
      bld.status = 'paused';
      bld.efficiency = 0;
      continue;
    }

    if (!bld.connectedToLogistics) {
      bld.status = 'no_road';
      bld.efficiency = 0;
      continue;
    }

    if (def.workersRequired > 0 && state.totalPopulation <= 0) {
      bld.status = 'no_workers';
      bld.efficiency = 0;
      continue;
    }

    const recipe = def.recipes.find((r) => r.id === bld.activeRecipeId) ?? def.recipes[0];
    const mult = getBuildingProductionMultiplier(state, def.id);
    bld.efficiency = mult;

    // Check if storage is full for all outputs
    const outputsEntries = Object.entries(recipe.outputs) as Array<[ResourceId, number]>;
    const allOutputsFull = outputsEntries.every(
      ([resId]) =>
        RESOURCES[resId].isStoredInWarehouse && state.resources[resId] >= state.storageCapacity
    );
    if (allOutputsFull) {
      bld.status = 'storage_full';
      continue;
    }

    // Check inputs availability
    const inputCheck = hasEnoughResources(state, recipe.inputs);
    if (!inputCheck.ok) {
      bld.status = 'missing_inputs';
      continue;
    }

    bld.status = 'working';
    const effectiveCycleSeconds = recipe.cycleSeconds / mult;
    const cyclesPerMin = 60 / effectiveCycleSeconds;

    for (const [inRes, inAmt] of Object.entries(recipe.inputs) as Array<[ResourceId, number]>) {
      if (inAmt) rateAccumulator[inRes] -= inAmt * cyclesPerMin;
    }
    for (const [outRes, outAmt] of outputsEntries) {
      if (outAmt) rateAccumulator[outRes] += outAmt * cyclesPerMin;
    }

    bld.progressSeconds += dtSeconds * mult;
    while (bld.progressSeconds >= recipe.cycleSeconds) {
      const canStillPay = hasEnoughResources(state, recipe.inputs);
      if (!canStillPay.ok) {
        bld.progressSeconds = recipe.cycleSeconds * 0.95;
        bld.status = 'missing_inputs';
        break;
      }
      payResources(state, recipe.inputs);
      for (const [outRes, outAmt] of outputsEntries) {
        if (outAmt) {
          addResourceWithCap(state, outRes, outAmt);
        }
      }
      bld.progressSeconds -= recipe.cycleSeconds;
    }
  }

  for (const resId of RESOURCE_ORDER) {
    state.netRatesPerMin[resId] = Math.round(rateAccumulator[resId] * 10) / 10;
  }

  recalculateNetworkAndCapacities(state);

  // 5. Advance Colonial Calendar & Trigger Historical Events
  state.dayProgress += dtSeconds / SECONDS_PER_DAY;
  while (state.dayProgress >= 1) {
    state.dayProgress -= 1;
    state.day += 1;
    if (
      state.activeEventId &&
      state.eventDeferred &&
      state.activeEventDeadlineDay !== null &&
      state.day >= state.activeEventDeadlineDay
    ) {
      // Deferred decision window expired — reopen the event modal for final resolution
      state.eventDeferred = false;
      state.speed = 0;
      state.dayProgress = 0;
      break;
    }
    checkAndTriggerHistoricalEvents(state);
    if (state.activeEventId && !state.eventDeferred) {
      state.dayProgress = 0;
      break;
    }
  }

  recalculateNetworkAndCapacities(state);
  evaluateTutorialProgress(state);
  checkWinCondition(state);
}

export function unsealFutureTrunks(state: GameState): boolean {
  if (state.trunksUnsealed) return false;
  state.trunksUnsealed = true;
  state.resources.insight += 20;
  // Give a 4-day breathing room before the first historical event can trigger after unsealing trunks
  state.lastEventDay = Math.max(state.lastEventDay ?? 1, state.day - (MIN_DAYS_BETWEEN_EVENTS - 4));
  state.chronicle.unshift({
    id: `chronicle_trunks_${state.day}`,
    day: state.day,
    yearText: getColonialYearString(state.day),
    title: 'Unsealed the Oilskin Archives',
    text: 'With basic timber, fishing, and shelter secured, your expedition unlocked the sealed trunks of future scientific treatises (+20 Future Insight).',
    category: 'milestone'
  });
  return true;
}

function awardMilestoneInsight(
  state: GameState,
  milestoneId: string,
  title: string,
  text: string,
  insightBonus = 8
): void {
  if (!state.achievedMilestoneIds) state.achievedMilestoneIds = [];
  if (state.achievedMilestoneIds.includes(milestoneId)) return;
  state.achievedMilestoneIds.push(milestoneId);
  state.resources.insight += insightBonus;
  state.chronicle.unshift({
    id: `chron_${milestoneId}_${state.day}`,
    day: state.day,
    yearText: getColonialYearString(state.day),
    title,
    text: `${text} (+${insightBonus} Future Insight)`,
    category: 'milestone'
  });
}

export function isTutorialStepSatisfied(state: GameState, stepId: string): boolean {
  const blds = Object.values(state.buildings).filter((b) => b.isConstructed !== false);
  const hasWarehouse = blds.some((b) => b.defId === 'founding_camp');
  const hasConnectedCabin = blds.some(
    (b) => Boolean(BUILDINGS[b.defId]?.housing) && b.connectedToLogistics
  );
  const hasLumberjack = blds.some((b) => b.defId === 'lumberjack_hut');
  const hasConnectedLumberjack = blds.some(
    (b) => b.defId === 'lumberjack_hut' && b.connectedToLogistics
  );
  const hasConnectedFishery = blds.some(
    (b) => b.defId === 'fishery' && b.connectedToLogistics
  );
  const connectedResidences = blds.filter(
    (b) => Boolean(BUILDINGS[b.defId]?.housing) && b.connectedToLogistics
  ).length;
  const hasConnectedMarket = blds.some(
    (b) => b.defId === 'market_square' && b.connectedToLogistics
  );
  const hasConnectedSawmill = blds.some(
    (b) => b.defId === 'sawmill' && b.connectedToLogistics
  );
  const hasConnectedQuarry = blds.some(
    (b) => b.defId === 'quarry' && b.connectedToLogistics
  );
  const hasUpgradedHomestead = blds.some(
    (b) => b.defId === 'colonial_homestead' || b.defId === 'enlightened_manor'
  );
  const hasConnectedAcademy = blds.some(
    (b) => b.defId === 'chronicle_observatory' && b.connectedToLogistics
  );

  switch (stepId) {
    case 'place_landing':
      return hasWarehouse;
    case 'build_first_cabin':
      return hasConnectedCabin;
    case 'build_lumberjack':
      return hasLumberjack;
    case 'connect_lumberjack_road':
      return hasConnectedLumberjack;
    case 'build_fishery':
      return hasConnectedFishery;
    case 'build_sawmill':
      return hasConnectedSawmill;
    case 'shelter_and_market':
      return connectedResidences >= 3 && hasConnectedMarket;
    case 'unseal_future_knowledge':
      return state.unlockedTechIds.length >= 1;
    case 'quarry_and_upgrade':
      return hasConnectedQuarry && hasUpgradedHomestead;
    case 'build_academy':
      return hasConnectedAcademy;
    default:
      return false;
  }
}

export function evaluateTutorialProgress(
  state: GameState
): { advanced: boolean; completedStepTitle?: string } {
  if (!state.completedTutorialStepIds) state.completedTutorialStepIds = [];
  if (!state.achievedMilestoneIds) state.achievedMilestoneIds = [];

  const blds = Object.values(state.buildings).filter((b) => b.isConstructed !== false);
  const hasConnectedLumberjack = blds.some(
    (b) => b.defId === 'lumberjack_hut' && b.connectedToLogistics
  );
  const hasConnectedFishery = blds.some(
    (b) => b.defId === 'fishery' && b.connectedToLogistics
  );
  const hasConnectedSawmill = blds.some(
    (b) => b.defId === 'sawmill' && b.connectedToLogistics
  );
  const hasConnectedMarket = blds.some(
    (b) => b.defId === 'market_square' && b.connectedToLogistics
  );

  // Unseal trunks once basic survival infrastructure (including Market Square & Sawmill) is built
  if (
    !state.trunksUnsealed &&
    hasConnectedLumberjack &&
    hasConnectedFishery &&
    hasConnectedSawmill &&
    hasConnectedMarket
  ) {
    unsealFutureTrunks(state);
  }

  // Check mid-game colonial growth milestones (+8 Insight each, one-time)
  if (blds.some((b) => b.defId === 'colonial_homestead' || b.defId === 'enlightened_manor')) {
    awardMilestoneInsight(
      state,
      'milestone_homestead',
      'First Colonial Homestead',
      'Established permanent timber-and-stone Colonial Homesteads, freeing scholars to study future notes.'
    );
  }
  if (
    blds.some(
      (b) => (b.defId === 'quarry' || b.defId === 'iron_mine') && b.connectedToLogistics
    )
  ) {
    awardMilestoneInsight(
      state,
      'milestone_mining',
      'Mineral Extraction Established',
      'Opened colonial quarries and mines, providing raw stone and ore for experimental apparatus.'
    );
  }
  if (blds.some((b) => b.defId === 'chronicle_observatory' && b.connectedToLogistics)) {
    awardMilestoneInsight(
      state,
      'milestone_academy',
      'Founded the Time Traveler’s Academy',
      'Inaugurated the Academy & Press to actively compile Colonial Field Notes into Future Insight.'
    );
  }
  if (
    blds.some((b) => b.defId === 'wheat_farm' && b.connectedToLogistics) &&
    blds.some((b) => b.defId === 'bakery' && b.connectedToLogistics)
  ) {
    awardMilestoneInsight(
      state,
      'milestone_bread',
      'Alluvial Agriculture & Baking',
      'Established a full grain-to-bread supply chain across the river floodplain.'
    );
  }

  let advanced = false;
  let completedStepTitle: string | undefined;

  // Record any newly satisfied tutorial steps
  for (const step of TUTORIAL_STEPS) {
    if (
      !state.completedTutorialStepIds.includes(step.id) &&
      isTutorialStepSatisfied(state, step.id)
    ) {
      state.completedTutorialStepIds.push(step.id);

      // Advance the active step pointer unless the user is intentionally browsing an earlier step while the guide is open
      const canAutoAdvance =
        !state.tutorialBrowsingManually || !state.tutorialActive || state.tutorialStepIndex === step.index;
      if (canAutoAdvance && state.tutorialStepIndex <= step.index) {
        completedStepTitle = step.title;
        advanced = true;
        state.tutorialBrowsingManually = false;
        while (
          state.tutorialStepIndex < TUTORIAL_STEPS.length &&
          state.completedTutorialStepIds.includes(TUTORIAL_STEPS[state.tutorialStepIndex].id)
        ) {
          state.tutorialStepIndex += 1;
          if (
            state.tutorialStepIndex < TUTORIAL_STEPS.length &&
            TUTORIAL_STEPS[state.tutorialStepIndex].id === 'unseal_future_knowledge'
          ) {
            unsealFutureTrunks(state);
          }
        }
        if (state.tutorialStepIndex >= TUTORIAL_STEPS.length) {
          state.tutorialStepIndex = TUTORIAL_STEPS.length - 1;
          state.tutorialCompleted = true;
          state.tutorialActive = false;
        }
      }
    }
  }

  return { advanced, completedStepTitle };
}

export function stepTutorial(state: GameState, delta: number): number {
  const nextIndex = Math.max(
    0,
    Math.min(TUTORIAL_STEPS.length - 1, state.tutorialStepIndex + delta)
  );
  state.tutorialStepIndex = nextIndex;
  state.tutorialBrowsingManually = true;
  return state.tutorialStepIndex;
}

export function advanceTutorialManually(state: GameState): boolean {
  stepTutorial(state, 1);
  return true;
}

export function dismissTutorial(state: GameState): void {
  state.introSeen = true;
  state.tutorialActive = false;
  state.tutorialBrowsingManually = false;
}

export function toggleTutorial(state: GameState, forceState?: boolean): boolean {
  state.introSeen = true;
  state.tutorialActive = forceState !== undefined ? forceState : !state.tutorialActive;
  if (state.tutorialActive) {
    state.tutorialBrowsingManually = false;
    // Sync completed steps and jump to the first incomplete step so reopening after dismissal resumes seamlessly
    evaluateTutorialProgress(state);
    const firstIncomplete = TUTORIAL_STEPS.findIndex(
      (s) => !isTutorialStepSatisfied(state, s.id)
    );
    if (firstIncomplete !== -1) {
      state.tutorialStepIndex = firstIncomplete;
      if (TUTORIAL_STEPS[firstIncomplete].id === 'unseal_future_knowledge') {
        unsealFutureTrunks(state);
      }
    } else {
      state.tutorialStepIndex = TUTORIAL_STEPS.length - 1;
    }
  }
  return state.tutorialActive;
}

function isTileConnectedIfPlaced(state: GameState, x: number, y: number): boolean {
  const warehouses = Object.values(state.buildings).filter(
    (b) => b.defId === 'founding_camp' && b.isConstructed !== false
  );
  if (warehouses.some((w) => Math.abs(w.x - x) + Math.abs(w.y - y) <= 2)) {
    return true;
  }
  for (const nb of getOrthogonalNeighbors(state, x, y)) {
    if (!nb.buildingId) continue;
    const nbBld = state.buildings[nb.buildingId];
    if (
      nbBld &&
      nbBld.isConstructed !== false &&
      nbBld.connectedToLogistics &&
      (nbBld.defId === 'founding_camp' || BUILDINGS[nbBld.defId]?.isRoad)
    ) {
      return true;
    }
  }
  return false;
}

function findShortestRoadPath(
  state: GameState,
  targetX: number,
  targetY: number
): Array<{ x: number; y: number; label?: string }> {
  const roadAllowed = BUILDINGS.dirt_road.allowedTerrains;
  const startSet = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [];
  const parent = new Map<string, string | null>();

  for (const bld of Object.values(state.buildings)) {
    if (
      bld.connectedToLogistics &&
      (bld.defId === 'founding_camp' || BUILDINGS[bld.defId]?.isRoad)
    ) {
      const k = `${bld.x},${bld.y}`;
      startSet.add(k);
      parent.set(k, null);
      queue.push({ x: bld.x, y: bld.y });
    }
  }

  // Fallback if warehouse is still under construction
  if (queue.length === 0) {
    for (const bld of Object.values(state.buildings)) {
      if (bld.defId === 'founding_camp') {
        const k = `${bld.x},${bld.y}`;
        startSet.add(k);
        parent.set(k, null);
        queue.push({ x: bld.x, y: bld.y });
      }
    }
  }

  if (queue.length === 0) return [];

  let goalKey: string | null = null;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (Math.abs(curr.x - targetX) + Math.abs(curr.y - targetY) === 1) {
      goalKey = `${curr.x},${curr.y}`;
      break;
    }

    for (const nb of getOrthogonalNeighbors(state, curr.x, curr.y)) {
      const nKey = `${nb.x},${nb.y}`;
      if (parent.has(nKey)) continue;
      const existingBld = nb.buildingId ? state.buildings[nb.buildingId] : undefined;
      const canTraverse =
        (!nb.buildingId && roadAllowed.includes(nb.terrain)) ||
        (existingBld && BUILDINGS[existingBld.defId]?.isRoad);
      if (!canTraverse) continue;
      parent.set(nKey, `${curr.x},${curr.y}`);
      queue.push({ x: nb.x, y: nb.y });
    }
  }

  if (!goalKey) return [];

  const path: Array<{ x: number; y: number; label?: string }> = [];
  let cur: string | null = goalKey;
  while (cur && !startSet.has(cur)) {
    const [cx, cy] = cur.split(',').map(Number);
    const tile = getTile(state, cx, cy);
    if (tile && !tile.buildingId) {
      path.unshift({ x: cx, y: cy });
    }
    cur = parent.get(cur) ?? null;
  }

  if (path.length > 0) {
    path[Math.floor(path.length / 2)].label = 'Connect Road';
  }
  return path;
}

export function getDynamicTutorialTargets(
  state: GameState,
  step?: TutorialStepDefinition
): Array<{ x: number; y: number; label?: string }> {
  const activeStep = step ?? TUTORIAL_STEPS[state.tutorialStepIndex];
  if (!activeStep) return [];

  const warehouses = Object.values(state.buildings).filter((b) => b.defId === 'founding_camp');
  const primaryWarehouse = warehouses[0];
  const anchorX = primaryWarehouse ? primaryWarehouse.x : 7;
  const anchorY = primaryWarehouse ? primaryWarehouse.y : 8;

  const canPlaceIgnoringCost = (defId: string, x: number, y: number): boolean => {
    const def = BUILDINGS[defId];
    const tile = getTile(state, x, y);
    if (!def || !tile || tile.buildingId) return false;
    if (!def.allowedTerrains.includes(tile.terrain)) return false;
    if (def.adjacentTerrainRequired && def.adjacentTerrainRequired.length > 0) {
      const neighbors = [tile, ...getOrthogonalNeighbors(state, x, y)];
      if (!neighbors.some((n) => def.adjacentTerrainRequired!.includes(n.terrain))) {
        return false;
      }
    }
    return true;
  };

  const findClosestValidTiles = (
    defId: string,
    requireConnected: boolean,
    count: number,
    primaryLabel: string
  ): Array<{ x: number; y: number; label?: string }> => {
    const candidates: Array<{ x: number; y: number; dist: number }> = [];
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (!canPlaceIgnoringCost(defId, x, y)) continue;
        if (requireConnected && !isTileConnectedIfPlaced(state, x, y)) continue;
        const dist = Math.abs(x - anchorX) + Math.abs(y - anchorY);
        candidates.push({ x, y, dist });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, count).map((c, idx) => ({
      x: c.x,
      y: c.y,
      label: idx === 0 ? primaryLabel : undefined
    }));
  };

  switch (activeStep.id) {
    case 'place_landing':
      return findClosestValidTiles('founding_camp', false, 2, 'Suggested Landing');

    case 'build_first_cabin': {
      const connected = findClosestValidTiles('pioneer_cabin', true, 2, 'Build Pioneer Cabin');
      return connected.length > 0
        ? connected
        : findClosestValidTiles('pioneer_cabin', false, 2, 'Build Pioneer Cabin');
    }

    case 'build_lumberjack':
      return findClosestValidTiles('lumberjack_hut', false, 2, 'Build Lumberjack');

    case 'connect_lumberjack_road': {
      const lj = Object.values(state.buildings).find(
        (b) => b.defId === 'lumberjack_hut' && !b.connectedToLogistics
      );
      if (lj) {
        const roadPath = findShortestRoadPath(state, lj.x, lj.y);
        if (roadPath.length > 0) return roadPath;
      }
      const fallbackLj = findClosestValidTiles('lumberjack_hut', false, 1, 'Build Lumberjack')[0];
      if (fallbackLj) {
        const roadPath = findShortestRoadPath(state, fallbackLj.x, fallbackLj.y);
        if (roadPath.length > 0) return roadPath;
      }
      return activeStep.highlightTiles ?? [];
    }

    case 'build_fishery': {
      const unconnectedFishery = Object.values(state.buildings).find(
        (b) => b.defId === 'fishery' && !b.connectedToLogistics
      );
      if (unconnectedFishery) {
        const roadPath = findShortestRoadPath(state, unconnectedFishery.x, unconnectedFishery.y);
        if (roadPath.length > 0) return roadPath;
      }
      return findClosestValidTiles('fishery', false, 2, 'Build Fishery');
    }

    case 'build_sawmill': {
      const unconnectedSawmill = Object.values(state.buildings).find(
        (b) => b.defId === 'sawmill' && !b.connectedToLogistics
      );
      if (unconnectedSawmill) {
        const roadPath = findShortestRoadPath(state, unconnectedSawmill.x, unconnectedSawmill.y);
        if (roadPath.length > 0) return roadPath;
      }
      const connected = findClosestValidTiles('sawmill', true, 2, 'Build Sawmill');
      return connected.length > 0
        ? connected
        : findClosestValidTiles('sawmill', false, 2, 'Build Sawmill');
    }

    case 'shelter_and_market': {
      const hasMarket = Object.values(state.buildings).some((b) => b.defId === 'market_square');
      const label = hasMarket ? 'Build Pioneer Cabin' : 'Build Market & Cabins';
      const connected = findClosestValidTiles('market_square', true, 3, label);
      return connected.length > 0
        ? connected
        : findClosestValidTiles('market_square', false, 3, label);
    }

    case 'quarry_and_upgrade': {
      const unconnectedQuarry = Object.values(state.buildings).find(
        (b) => b.defId === 'quarry' && !b.connectedToLogistics
      );
      if (unconnectedQuarry) {
        const roadPath = findShortestRoadPath(state, unconnectedQuarry.x, unconnectedQuarry.y);
        if (roadPath.length > 0) return roadPath;
      }
      const hasConnectedQuarry = Object.values(state.buildings).some(
        (b) => b.defId === 'quarry' && b.connectedToLogistics && b.isConstructed !== false
      );
      if (!hasConnectedQuarry) {
        return findClosestValidTiles('quarry', false, 2, 'Build Quarry');
      }
      const cabin = Object.values(state.buildings).find((b) => b.defId === 'pioneer_cabin');
      if (cabin) {
        return [{ x: cabin.x, y: cabin.y, label: 'Upgrade Cabin' }];
      }
      return findClosestValidTiles('quarry', false, 1, 'Build Quarry');
    }

    case 'build_academy': {
      const unconnectedAcad = Object.values(state.buildings).find(
        (b) => b.defId === 'chronicle_observatory' && !b.connectedToLogistics
      );
      if (unconnectedAcad) {
        const roadPath = findShortestRoadPath(state, unconnectedAcad.x, unconnectedAcad.y);
        if (roadPath.length > 0) return roadPath;
      }
      const connected = findClosestValidTiles('chronicle_observatory', true, 2, 'Build Academy');
      return connected.length > 0
        ? connected
        : findClosestValidTiles('chronicle_observatory', false, 2, 'Build Academy');
    }

    default:
      return activeStep.highlightTiles ?? [];
  }
}

export function skipTutorial(state: GameState): void {
  state.introSeen = true;
  state.tutorialActive = false;
  state.tutorialCompleted = true;
}

export function deferHistoricalEvent(state: GameState): boolean {
  if (!state.activeEventId) return false;
  if (state.activeEventDeadlineDay !== null && state.day >= state.activeEventDeadlineDay) {
    return false;
  }
  state.eventDeferred = true;
  if (state.speed === 0) {
    state.speed = 1;
  }
  return true;
}

export function reopenDeferredEvent(state: GameState): boolean {
  if (!state.activeEventId) return false;
  state.eventDeferred = false;
  state.speed = 0;
  return true;
}

export function checkAndTriggerHistoricalEvents(state: GameState): void {
  if (state.activeEventId) return;
  // Do not interrupt the player before they have established their landing or while actively in the tutorial steps (Steps 1–9, including building the Academy)
  if (state.tutorialActive && !state.tutorialCompleted && state.tutorialStepIndex < 9) return;
  if (!state.trunksUnsealed && !state.tutorialCompleted) return;
  const hasWarehouse = Object.values(state.buildings).some((b) => b.defId === 'founding_camp');
  if (!hasWarehouse) return;

  // Enforce a minimum cooldown between historical events so they never fire in rapid succession
  const lastDay = state.lastEventDay ?? 1;
  if (state.day - lastDay < MIN_DAYS_BETWEEN_EVENTS) return;

  for (const evt of HISTORICAL_EVENTS) {
    if (state.completedEventIds.includes(evt.id)) continue;
    if (state.day < evt.minDay) continue;
    if (evt.minPopulation && state.totalPopulation < evt.minPopulation) continue;
    if (evt.minDivergence && state.divergence < evt.minDivergence) continue;
    if (evt.minParadox && state.paradox < evt.minParadox) continue;
    // Defer event activation until at least one choice is currently affordable so play is never deadlocked
    if (!evt.choices.some((c) => canAffordEventChoice(state, c).ok)) continue;

    state.activeEventId = evt.id;
    state.activeEventDeadlineDay = state.day + EVENT_DECISION_WINDOW_DAYS;
    state.eventDeferred = false;
    state.speed = 0; // Pause so the player can weigh their historical decision (or choose Decide Later)
    break;
  }
}

export function checkWinCondition(state: GameState): void {
  if (state.won) return;

  const meetsPop = state.totalPopulation >= WIN_CONDITIONS.minPopulation;
  const meetsDivergence = state.divergence >= WIN_CONDITIONS.minDivergence;
  const meetsInnovators = state.populationByTier.innovators >= WIN_CONDITIONS.minInnovators;
  const safeParadox = state.paradox <= WIN_CONDITIONS.maxParadox;

  if (meetsPop && meetsDivergence && meetsInnovators && safeParadox) {
    state.won = true;
    state.chronicle.unshift({
      id: `win_chronicle_${state.day}`,
      day: state.day,
      yearText: getColonialYearString(state.day),
      title: 'History Rewritten: The Enlightened Commonwealth',
      text: 'Through thriving production chains, scientific literacy, and decisive temporal interventions, your settlement has permanently altered the trajectory of the New World!',
      category: 'milestone'
    });
  }
}
