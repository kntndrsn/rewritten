import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECONDS_PER_DAY,
  advanceTutorialManually,
  canPlaceBuilding,
  canUnlockTech,
  canUpgradeHouse,
  createInitialGameState,
  demolishTile,
  placeBuilding,
  resolveHistoricalEvent,
  skipTutorial,
  stepSimulation,
  unlockTech,
  upgradeHouse
} from '../src/core/simulation.ts';

describe('Rewritten Core Simulation Engine', () => {
  it('initializes minimal landfall settlement with paced calendar and sealed trunks', () => {
    const state = createInitialGameState(1607, true);
    assert.equal(state.width, 28);
    assert.equal(state.height, 20);
    assert.equal(SECONDS_PER_DAY, 25);
    assert.equal(state.totalPopulation, 6, 'Expected 6 founding pioneers in the single starter cabin');
    assert.equal(state.resources.insight, 4, 'Expected low starting Insight before trunks are unsealed');
    assert.equal(state.tutorialActive, true);
    assert.equal(state.tutorialStepIndex, 0);

    const buildings = Object.values(state.buildings);
    assert.equal(buildings.length, 4, 'Expected Founding Camp, 2 road tiles, and 1 Pioneer Cabin');
    for (const bld of buildings) {
      assert.equal(bld.connectedToLogistics, true, `Building ${bld.defId} should be connected`);
    }
  });

  it('walks through the 7-step tutorial and unseals Future Archives when basic survival is built', () => {
    const state = createInitialGameState(1607, true);
    assert.equal(state.tutorialStepIndex, 0);

    // Step 1: Survey Landing -> manual advance
    advanceTutorialManually(state);
    assert.equal(state.tutorialStepIndex, 1);

    // Step 2: Build Lumberjack Camp at (11, 7) (disconnected initially)
    const lj = placeBuilding(state, 'lumberjack_hut', 11, 7);
    assert.equal(lj.success, true);
    assert.equal(state.tutorialStepIndex, 2, 'Should advance to Step 3 (Connect Road)');

    // Step 3: Connect Lumberjack Camp by road at (10, 8) and (11, 8)
    placeBuilding(state, 'dirt_road', 10, 8);
    placeBuilding(state, 'dirt_road', 11, 8);
    assert.equal(state.tutorialStepIndex, 3, 'Should advance to Step 4 (Build Fishery)');

    // Step 4: Build Fishery at (5, 8) and road at (6, 8)
    placeBuilding(state, 'dirt_road', 6, 8);
    placeBuilding(state, 'fishery', 5, 8);
    assert.equal(state.tutorialStepIndex, 4, 'Should advance to Step 5 (Shelter & Market)');

    // Step 5: Build 2 more Pioneer Cabins and 1 Market Square
    placeBuilding(state, 'pioneer_cabin', 8, 9);
    placeBuilding(state, 'pioneer_cabin', 9, 9);
    placeBuilding(state, 'market_square', 9, 7);
    assert.equal(state.tutorialStepIndex, 5, 'Should advance to Step 6 (Build Sawmill)');
    assert.equal(state.trunksUnsealed, false);

    // Step 6: Build Sawmill at (7, 7) -> unseals Future Archives (+20 Insight) and advances to Step 7
    placeBuilding(state, 'sawmill', 7, 7);
    assert.equal(state.tutorialStepIndex, 6, 'Should advance to Step 7 (Unseal Future Knowledge)');
    assert.equal(state.trunksUnsealed, true, 'Future trunks should be unsealed');
    assert.ok(state.resources.insight >= 24, 'Should have received +20 Insight from trunks');

    // Step 7: Unlock first Future Knowledge breakthrough -> completes tutorial
    const unlockRes = unlockTech(state, 'water_circular_saw');
    assert.equal(unlockRes.success, true);
    assert.equal(state.tutorialCompleted, true);
    assert.equal(state.tutorialActive, false);
  });

  it('allows skipping the tutorial at any point', () => {
    const state = createInitialGameState(1607, true);
    assert.equal(state.tutorialActive, true);
    skipTutorial(state);
    assert.equal(state.tutorialActive, false);
    assert.equal(state.tutorialCompleted, true);
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

    // Place Sawmill at (9, 7) adjacent to road at (9, 8)
    const beforeWood = state.resources.wood;
    const placed = placeBuilding(state, 'sawmill', 9, 7);
    assert.equal(placed.success, true);
    assert.ok(state.resources.wood < beforeWood, 'Wood cost should be deducted');
    assert.equal(placed.building?.connectedToLogistics, true);
  });

  it('runs production chains at the slower colonial pace and converts inputs into outputs', () => {
    const state = createInitialGameState(1607, true);
    const sawmillRes = placeBuilding(state, 'sawmill', 9, 7);
    assert.equal(sawmillRes.success, true);

    const initialPlanks = state.resources.planks;
    stepSimulation(state, 15);
    assert.ok(
      state.resources.planks > initialPlanks,
      `Expected Sawmill to produce planks after 15s cycle (was ${initialPlanks}, now ${state.resources.planks})`
    );
  });

  it('unlocks Future Knowledge breakthroughs and switches buildings to anachronistic recipes', () => {
    const state = createInitialGameState(1607, true);
    state.resources.insight = 30;
    placeBuilding(state, 'sawmill', 9, 7);

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
    placeBuilding(state, 'market_square', 9, 7);
    stepSimulation(state, 2);

    const cabin = Object.values(state.buildings).find((b) => b.defId === 'pioneer_cabin');
    assert.ok(cabin, 'Expected a starter pioneer cabin');

    const check1 = canUpgradeHouse(state, cabin.id);
    assert.equal(check1.valid, true, check1.reason);

    const upg1 = upgradeHouse(state, cabin.id);
    assert.equal(upg1.success, true);
    assert.equal(cabin.defId, 'colonial_homestead');

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

  it('triggers and resolves historical events only after tutorial and day/population thresholds', () => {
    const state = createInitialGameState(1607, true);
    skipTutorial(state);
    placeBuilding(state, 'pioneer_cabin', 8, 9);
    placeBuilding(state, 'pioneer_cabin', 9, 9);
    // Advance 9 days (9 * 25s = 225s) with enough fish so population reaches >= 16
    state.resources.fish = 200;
    stepSimulation(state, 225);
    assert.equal(state.activeEventId, 'starving_winter_1609');

    state.resources.insight = 25;
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
    const cantDemolishHub = demolishTile(state, 7, 8);
    assert.equal(cantDemolishHub.success, false);

    placeBuilding(state, 'pioneer_cabin', 7, 7);
    const woodAfterPlace = state.resources.wood;
    const demRes = demolishTile(state, 7, 7);
    assert.equal(demRes.success, true);
    assert.equal(state.resources.wood, woodAfterPlace + 5);
  });
});

