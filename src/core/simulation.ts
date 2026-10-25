import { BUILDINGS } from '../data/buildings.ts';
import { HISTORICAL_EVENTS } from '../data/events.ts';
import { POPULATION_TIERS, POPULATION_TIER_ORDER } from '../data/population.ts';
import { BASE_WAREHOUSE_CAPACITY, RESOURCES, RESOURCE_ORDER } from '../data/resources.ts';
import { TECHNOLOGIES } from '../data/technologies.ts';
import type {
  BuildingDefinition,
  PopulationTierId,
  RecipeDefinition,
  ResourceId,
  ServiceType,
  TerrainType
} from '../data/types.ts';
import { type GeneratedTileData, MAP_HEIGHT, MAP_WIDTH, generateColonialMap } from './mapGenerator.ts';

export type BuildingStatus =
  | 'working'
  | 'no_road'
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
  divergence: number;
  paradox: number;
  day: number;
  dayProgress: number;
  speed: 0 | 1 | 2 | 4;
  won: boolean;
  winDismissed: boolean;
  chronicle: ChronicleEntry[];
}

export const WIN_CONDITIONS = {
  minPopulation: 75,
  minDivergence: 50,
  minInnovators: 20,
  maxParadox: 70
};

const SECONDS_PER_DAY = 8;

export function getColonialYearString(day: number): string {
  const baseYear = 1607;
  const yearsElapsed = Math.floor((day - 1) / 12);
  const seasonIndex = Math.floor(((day - 1) % 12) / 3);
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  return `${seasons[seasonIndex]} ${baseYear + yearsElapsed}`;
}

export function createInitialGameState(seed = 1607, withStarterSettlement = true): GameState {
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
    divergence: 5,
    paradox: 2,
    day: 1,
    dayProgress: 0,
    speed: 1,
    won: false,
    winDismissed: false,
    chronicle: [
      {
        id: 'chronicle_arrival',
        day: 1,
        yearText: 'Spring 1607',
        title: 'Landfall at James River Point',
        text: 'Your time-displaced expedition establishes a beachhead in colonial Virginia, carrying sealed trunks of future metallurgy, agronomy, and medical treatises.',
        category: 'milestone'
      }
    ]
  };

  if (withStarterSettlement) {
    seedStarterSettlement(state);
  }

  recalculateNetworkAndCapacities(state);
  return state;
}

function seedStarterSettlement(state: GameState): void {
  const placeFree = (defId: string, x: number, y: number, initialResidents?: number) => {
    const def = BUILDINGS[defId];
    if (!def) return;
    const id = `bld_${state.nextBuildingSeq++}`;
    const defaultRecipe = def.recipes && def.recipes.length > 0 ? def.recipes[0].id : '';
    const bld: PlacedBuilding = {
      id,
      defId,
      x,
      y,
      activeRecipeId: defaultRecipe,
      progressSeconds: 0,
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

  // Main Colonial Cart Road spine along y = 8 from x = 6 to x = 11
  placeFree('dirt_road', 6, 8);
  placeFree('dirt_road', 8, 8);
  placeFree('dirt_road', 9, 8);
  placeFree('dirt_road', 10, 8);
  placeFree('dirt_road', 11, 8);

  // Market Square at (9, 7)
  placeFree('market_square', 9, 7);

  // 3 Pioneer Cabins
  placeFree('pioneer_cabin', 8, 7, 7);
  placeFree('pioneer_cabin', 8, 9, 7);
  placeFree('pioneer_cabin', 9, 9, 6);

  // Starter Fishery at (5, 8) next to coastal_water (4, 8)
  placeFree('fishery', 5, 8);

  // Starter Lumberjack Hut at (11, 7) next to forest (11, 6) and (12, 7)
  placeFree('lumberjack_hut', 11, 7);
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

  const costCheck = hasEnoughResources(state, def.cost);
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
  payResources(state, def.cost);

  const id = `bld_${state.nextBuildingSeq++}`;
  const defaultRecipe = def.recipes && def.recipes.length > 0 ? def.recipes[0].id : '';

  const building: PlacedBuilding = {
    id,
    defId,
    x,
    y,
    activeRecipeId: defaultRecipe,
    progressSeconds: 0,
    residents: def.housing ? Math.max(2, Math.floor(def.housing.capacity * 0.5)) : 0,
    paused: false,
    connectedToLogistics: false,
    servicesAvailable: { logistics: false, market: false, sanitation: false, knowledge: false },
    status: def.housing ? 'housing' : def.recipes ? 'working' : 'civic',
    efficiency: 1
  };

  state.buildings[id] = building;
  state.tiles[y][x].buildingId = id;

  if (def.divergenceOnBuild) {
    state.divergence = Math.min(100, state.divergence + def.divergenceOnBuild);
  }

  recalculateNetworkAndCapacities(state);
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
  checkWinCondition(state);
  return { success: true };
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

  // If the choice requires a tech OR cost, allow if tech is unlocked OR player can pay cost
  if (choice.cost) {
    const costCheck = hasEnoughResources(state, choice.cost);
    if (!costCheck.ok && costCheck.missing) {
      return {
        success: false,
        reason: `Not enough ${RESOURCES[costCheck.missing].name} for this decision.`
      };
    }
    payResources(state, choice.cost);
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
  }

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
  // 1. Storage capacity
  let cap = BASE_WAREHOUSE_CAPACITY;
  for (const bld of Object.values(state.buildings)) {
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

  // 2. Flood-fill road network from all 'founding_camp' warehouses
  const visitedRoad = new Set<string>();
  const connectedRoadTiles = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [];

  for (const bld of Object.values(state.buildings)) {
    if (bld.defId === 'founding_camp') {
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
      if (!nbBld) continue;
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

  // Any building orthogonally adjacent to a connected road or warehouse (or within 2 tiles of a warehouse) is connected
  const warehouses = Object.values(state.buildings).filter((b) => b.defId === 'founding_camp');
  for (const bld of Object.values(state.buildings)) {
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
    if (provider.paused || !provider.connectedToLogistics) continue;
    const pDef = BUILDINGS[provider.defId];
    if (!pDef?.serviceType || !pDef.serviceRadius) continue;

    for (const target of Object.values(state.buildings)) {
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
  } else {
    // Allow 100% workforce efficiency as long as totalPopulation >= workersNeeded
    state.laborEfficiency = Math.min(1, Math.max(0.25, state.totalPopulation / workersNeeded));
  }
}

export function getBuildingProductionMultiplier(state: GameState, defId: string): number {
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

  // High happiness grants up to +15% bonus; high paradox imposes a penalty
  if (state.happiness >= 80) {
    mult += 0.12;
  } else if (state.happiness < 40) {
    mult -= 0.15;
  }

  if (state.paradox > 60) {
    mult -= 0.2;
  }

  return Math.max(0.25, mult * state.laborEfficiency);
}

export function stepSimulation(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return;

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
    const def = BUILDINGS[bld.defId];
    if (!def?.housing) continue;

    bld.status = bld.connectedToLogistics ? 'housing' : 'no_road';
    if (!bld.connectedToLogistics) continue;

    const cap = def.housing.capacity;
    if (state.happiness >= 55 && bld.residents < cap) {
      const growthPerSec = state.happiness >= 80 ? 0.35 : 0.18;
      bld.residents = Math.min(cap, bld.residents + growthPerSec * dtSeconds);
    } else if (state.happiness < 30 && bld.residents > 2) {
      bld.residents = Math.max(2, bld.residents - 0.1 * dtSeconds);
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
    const def = BUILDINGS[bld.defId];
    if (!def) continue;
    if (!bld.paused) {
      netCoinPerMin -= def.upkeepCoinPerMin;
    }
    if (!bld.paused && bld.connectedToLogistics) {
      if (def.passiveInsightPerMin) {
        netInsightPerMin += def.passiveInsightPerMin * state.laborEfficiency;
      }
      if (def.paradoxDampeningPerMin) {
        netParadoxDampeningPerMin += def.paradoxDampeningPerMin * state.laborEfficiency;
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

  // 5. Advance Colonial Calendar & Trigger Historical Events
  state.dayProgress += dtSeconds / SECONDS_PER_DAY;
  while (state.dayProgress >= 1) {
    state.dayProgress -= 1;
    state.day += 1;
    checkAndTriggerHistoricalEvents(state);
  }

  recalculateNetworkAndCapacities(state);
  checkWinCondition(state);
}

export function checkAndTriggerHistoricalEvents(state: GameState): void {
  if (state.activeEventId) return;

  for (const evt of HISTORICAL_EVENTS) {
    if (state.completedEventIds.includes(evt.id)) continue;
    if (state.day < evt.minDay) continue;
    if (evt.minPopulation && state.totalPopulation < evt.minPopulation) continue;
    if (evt.minDivergence && state.divergence < evt.minDivergence) continue;
    if (evt.minParadox && state.paradox < evt.minParadox) continue;

    state.activeEventId = evt.id;
    state.speed = 0; // Pause so the player can weigh their historical decision
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
