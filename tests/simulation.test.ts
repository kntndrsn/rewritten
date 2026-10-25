import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canPlaceBuilding,
  canUnlockTech,
  canUpgradeHouse,
  createInitialGameState,
  demolishTile,
  placeBuilding,
  resolveHistoricalEvent,
  stepSimulation,
  unlockTech,
  upgradeHouse
} from '../src/core/simulation.ts';

describe('Rewritten Core Simulation Engine', () => {
  it('initializes map and starter settlement with connected road network', () => {
    const state = createInitialGameState(1607, true);
    assert.equal(state.width, 28);
    assert.equal(state.height, 20);
    assert.ok(state.totalPopulation >= 18, 'Expected starter population from 3 pioneer cabins');
    assert.ok(state.storageCapacity >= 250, 'Expected base + founding camp storage');

    const buildings = Object.values(state.buildings);
    assert.ok(buildings.length >= 10, 'Expected starter buildings and road spine');
    for (const bld of buildings) {
      assert.equal(bld.connectedToLogistics, true, `Building ${bld.defId} should be connected`);
    }
  });

  it('validates terrain and adjacency rules when placing buildings', () => {
    const state = createInitialGameState(1607, true);

    // Wheat farm requires fertile_soil; (8, 10) is guaranteed fertile_soil
    const validFarm = canPlaceBuilding(state, 'wheat_farm', 8, 10);
    assert.equal(validFarm.valid, true);

    // Cannot place wheat farm on grass tile (10, 7)
    const invalidFarm = canPlaceBuilding(state, 'wheat_farm', 10, 7);
    assert.equal(invalidFarm.valid, false);

    // Quarry requires stone_deposit on or adjacent; (13, 6) is grass adjacent to (13, 5) stone_deposit
    const validQuarry = canPlaceBuilding(state, 'quarry', 13, 6);
    assert.equal(validQuarry.valid, true);

    // Place Sawmill at (10, 7) adjacent to road at (10, 8)
    const beforeWood = state.resources.wood;
    const placed = placeBuilding(state, 'sawmill', 10, 7);
    assert.equal(placed.success, true);
    assert.ok(state.resources.wood < beforeWood, 'Wood cost should be deducted');
    assert.equal(placed.building?.connectedToLogistics, true);
  });

  it('runs production chains and converts inputs into outputs over time', () => {
    const state = createInitialGameState(1607, true);
    // Place a Sawmill at (10, 7) next to road (10, 8)
    const sawmillRes = placeBuilding(state, 'sawmill', 10, 7);
    assert.equal(sawmillRes.success, true);

    const initialPlanks = state.resources.planks;
    stepSimulation(state, 7);
    assert.ok(
      state.resources.planks > initialPlanks,
      `Expected Sawmill to produce planks (was ${initialPlanks}, now ${state.resources.planks})`
    );
  });

  it('unlocks Future Knowledge breakthroughs and switches buildings to anachronistic recipes', () => {
    const state = createInitialGameState(1607, true);
    placeBuilding(state, 'sawmill', 10, 7);

    // Starts with 35 Insight; water_circular_saw costs 20 Insight
    const canUnlock = canUnlockTech(state, 'water_circular_saw');
    assert.equal(canUnlock.valid, true);

    const prevDivergence = state.divergence;
    const unlockRes = unlockTech(state, 'water_circular_saw');
    assert.equal(unlockRes.success, true);
    assert.ok(state.unlockedTechIds.includes('water_circular_saw'));
    assert.ok(state.divergence > prevDivergence);

    const sawmill = Object.values(state.buildings).find((b) => b.defId === 'sawmill');
    assert.equal(
      sawmill?.activeRecipeId,
      'circular_saw_planks',
      'Sawmill should automatically upgrade to the anachronistic circular saw recipe'
    );
  });

  it('upgrades Pioneer Cabin to Colonial Homestead and Enlightened Manor when needs and tech are met', () => {
    const state = createInitialGameState(1607, true);
    stepSimulation(state, 2); // Calculate need satisfaction

    const cabin = Object.values(state.buildings).find((b) => b.defId === 'pioneer_cabin');
    assert.ok(cabin, 'Expected a starter pioneer cabin');

    const check1 = canUpgradeHouse(state, cabin.id);
    assert.equal(check1.valid, true, check1.reason);

    const upg1 = upgradeHouse(state, cabin.id);
    assert.equal(upg1.success, true);
    assert.equal(cabin.defId, 'colonial_homestead');

    // Upgrading to Enlightened Manor requires scientific_press tech
    state.resources.insight = 200;
    state.resources.planks = 100;
    state.resources.stone = 100;
    state.resources.tools = 100;
    state.resources.bread = 100;
    state.resources.fish = 100;
    state.resources.coin = 500;

    unlockTech(state, 'germ_theory');
    unlockTech(state, 'scientific_press');
    stepSimulation(state, 2);

    const upg2 = upgradeHouse(state, cabin.id);
    assert.equal(upg2.success, true, upg2.reason);
    assert.equal(cabin.defId, 'enlightened_manor');
  });

  it('triggers and resolves historical events with butterfly effects', () => {
    const state = createInitialGameState(1607, true);
    // Advance past Day 3 to trigger 'starving_winter_1609'
    stepSimulation(state, 20);
    assert.equal(state.activeEventId, 'starving_winter_1609');

    const prevDiv = state.divergence;
    const prevChronLen = state.chronicle.length;
    const res = resolveHistoricalEvent(state, 'starving_winter_1609', 'cold_frame_root_cellars');
    assert.equal(res.success, true);
    assert.equal(state.activeEventId, null);
    assert.ok(state.divergence > prevDiv);
    assert.equal(state.chronicle.length, prevChronLen + 1);
  });

  it('protects primary warehouse from demolition and refunds 50% on normal buildings', () => {
    const state = createInitialGameState(1607, true);
    // Founding camp is at (7, 8)
    const cantDemolishHub = demolishTile(state, 7, 8);
    assert.equal(cantDemolishHub.success, false);

    // Place and demolish a cabin at (7, 7)
    placeBuilding(state, 'pioneer_cabin', 7, 7);
    const woodAfterPlace = state.resources.wood;
    const demRes = demolishTile(state, 7, 7);
    assert.equal(demRes.success, true);
    assert.equal(state.resources.wood, woodAfterPlace + 5);
  });
});
