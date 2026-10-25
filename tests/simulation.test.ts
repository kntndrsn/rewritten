import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_DAYS_BETWEEN_EVENTS,
  SECONDS_PER_DAY,
  canPlaceBuilding,
  canUnlockTech,
  canUpgradeHouse,
  checkAndTriggerHistoricalEvents,
  createInitialGameState,
  demolishTile,
  dismissTutorial,
  getEffectiveBuildingCost,
  placeBuilding,
  resolveHistoricalEvent,
  skipTutorial,
  stepSimulation,
  stepTutorial,
  toggleTutorial,
  unlockTech,
  unsealFutureTrunks,
  upgradeHouse
} from '../src/core/simulation.ts';
import { TUTORIAL_STEPS } from '../src/data/tutorial.ts';

describe('Rewritten Core Simulation Engine', () => {
  it('starts new games with zero auto-placed buildings and a free first Temporal Landing', () => {
    const state = createInitialGameState(1607);
    assert.equal(state.width, 28);
    assert.equal(state.height, 20);
    assert.equal(SECONDS_PER_DAY, 25);
    assert.equal(Object.keys(state.buildings).length, 0, 'Expected 0 auto-placed buildings');
    assert.equal(state.totalPopulation, 0);
    assert.equal(state.resources.insight, 4);
    assert.deepEqual(
      getEffectiveBuildingCost(state, 'founding_camp'),
      {},
      'First Temporal Landing & Warehouse placement should be free'
    );

    const beforeWood = state.resources.wood;
    const beforeCoin = state.resources.coin;
    const landing = placeBuilding(state, 'founding_camp', 7, 8);
    assert.equal(landing.success, true);
    assert.equal(state.resources.wood, beforeWood, 'Free first landing should deduct 0 wood');
    assert.equal(state.resources.coin, beforeCoin, 'Free first landing should deduct 0 coin');

    // Second warehouse costs normal resources
    const secondCost = getEffectiveBuildingCost(state, 'founding_camp');
    assert.ok((secondCost?.wood ?? 0) > 0, 'Second warehouse should require normal resources');
  });

  it('walks through the tutorial from player-chosen landing to Academy and supports Back/Next/Dismiss', () => {
    const state = createInitialGameState(1607);
    assert.equal(state.tutorialStepIndex, 0);

    // Step 1: Place Temporal Landing at (7, 8)
    placeBuilding(state, 'founding_camp', 7, 8);
    assert.equal(state.tutorialStepIndex, 1, 'Should advance to Step 2 (Build Lumberjack)');

    // Test stepping backward and forward manually
    stepTutorial(state, -1);
    assert.equal(state.tutorialStepIndex, 0);
    stepTutorial(state, 1);
    assert.equal(state.tutorialStepIndex, 1);

    // Test dismissing and toggling guide without granting duplicate Insight
    const insightBeforeDismiss = state.resources.insight;
    dismissTutorial(state);
    assert.equal(state.tutorialActive, false);
    assert.equal(state.resources.insight, insightBeforeDismiss);
    toggleTutorial(state);
    assert.equal(state.tutorialActive, true);

    // Step 2: Build Lumberjack Camp at (11, 7)
    placeBuilding(state, 'lumberjack_hut', 11, 7);
    assert.equal(state.tutorialStepIndex, 2);

    // Step 3: Connect Lumberjack Camp by road at (8,8)..(11,8)
    placeBuilding(state, 'dirt_road', 8, 8);
    placeBuilding(state, 'dirt_road', 9, 8);
    placeBuilding(state, 'dirt_road', 10, 8);
    placeBuilding(state, 'dirt_road', 11, 8);
    assert.equal(state.tutorialStepIndex, 3);

    // Step 4: Build Fishery at (5, 8) and road at (6, 8)
    placeBuilding(state, 'dirt_road', 6, 8);
    placeBuilding(state, 'fishery', 5, 8);
    assert.equal(state.tutorialStepIndex, 4);

    // Step 5: Build 3 Pioneer Cabins and 1 Market Square
    placeBuilding(state, 'pioneer_cabin', 8, 7);
    placeBuilding(state, 'pioneer_cabin', 8, 9);
    placeBuilding(state, 'pioneer_cabin', 9, 9);
    placeBuilding(state, 'market_square', 9, 7);
    assert.equal(state.tutorialStepIndex, 5);
    assert.equal(state.trunksUnsealed, false);

    // Step 6: Build Sawmill at (7, 7) -> unseals Future Archives (+20 Insight once)
    placeBuilding(state, 'sawmill', 7, 7);
    assert.equal(state.tutorialStepIndex, 6);
    assert.equal(state.trunksUnsealed, true);
    const insightAfterUnseal = state.resources.insight;
    assert.ok(insightAfterUnseal >= 24);

    // Calling unsealFutureTrunks again must never grant another +20 Insight
    assert.equal(unsealFutureTrunks(state), false);
    assert.equal(state.resources.insight, insightAfterUnseal);

    // Step 7: Unlock first Future Knowledge breakthrough -> advances to Step 8 (Quarry & Upgrade)
    unlockTech(state, 'water_circular_saw');
    assert.equal(state.tutorialStepIndex, 7);
  });

  it('keeps tutorial text free of coordinate numbers and Anno references', () => {
    for (const step of TUTORIAL_STEPS) {
      const combined = `${step.title} ${step.subtitle} ${step.narrative} ${step.objectiveText}`;
      assert.equal(
        /\(\d+\s*,\s*\d+\)/.test(combined),
        false,
        `Step ${step.id} should not contain coordinate pairs: ${combined}`
      );
      assert.equal(
        /anno/i.test(combined),
        false,
        `Step ${step.id} should not reference Anno: ${combined}`
      );
    }
  });

  it('awards mid-game milestone Insight and generates active Insight at the Time Traveler Academy', () => {
    const state = createInitialGameState(1607, true);
    state.resources.planks = 50;
    state.resources.stone = 50;
    state.resources.tools = 50;
    state.resources.coin = 500;

    const beforeInsight = state.resources.insight;
    // Place Time Traveler's Academy at (10, 7) adjacent to road (9, 8)/(9, 7)
    placeBuilding(state, 'dirt_road', 10, 8);
    const acad = placeBuilding(state, 'chronicle_observatory', 10, 7);
    assert.equal(acad.success, true);
    assert.ok(
      state.resources.insight >= beforeInsight + 8,
      'Building the first Academy should award the +8 Insight milestone bonus'
    );

    const afterMilestoneInsight = state.resources.insight;
    stepSimulation(state, 16);
    assert.ok(
      state.resources.insight > afterMilestoneInsight + 3,
      'Academy should produce passive Insight plus +3 Insight from compiling Field Notes'
    );
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

  it('validates all highlighted tutorial Lumberjack target tiles are buildable', () => {
    const state = createInitialGameState(1607, true);
    const lumberjackStep = TUTORIAL_STEPS.find((s) => s.id === 'build_lumberjack');
    assert.ok(lumberjackStep?.highlightTiles && lumberjackStep.highlightTiles.length > 0);
    for (const tile of lumberjackStep.highlightTiles) {
      const check = canPlaceBuilding(state, 'lumberjack_hut', tile.x, tile.y);
      assert.equal(
        check.valid,
        true,
        `Expected tutorial highlight (${tile.x}, ${tile.y}) to be valid for lumberjack_hut: ${check.reason}`
      );
    }
  });

  it('defers historical events when no choice is affordable and waives Insight when requiredTechId is unlocked', () => {
    const state = createInitialGameState(1607, true);
    skipTutorial(state);
    state.completedEventIds.push('starving_winter_1609');
    state.day = 18;
    state.totalPopulation = 24;
    state.resources.tools = 0; // indigenous_envoy_1611 requires 4 or 6 tools

    checkAndTriggerHistoricalEvents(state);
    assert.equal(
      state.activeEventId,
      null,
      'Should defer indigenous_envoy_1611 when player has 0 tools'
    );

    state.resources.tools = 4;
    state.lastEventDay = 1;
    checkAndTriggerHistoricalEvents(state);
    assert.equal(state.activeEventId, 'indigenous_envoy_1611');
    resolveHistoricalEvent(state, 'indigenous_envoy_1611', 'guarded_barter');

    // Enforces MIN_DAYS_BETWEEN_EVENTS cooldown before next event can trigger
    assert.equal(state.lastEventDay, 18);
    state.day = 24;
    state.totalPopulation = 30;
    checkAndTriggerHistoricalEvents(state);
    assert.equal(
      state.activeEventId,
      null,
      `Should enforce ${MIN_DAYS_BETWEEN_EVENTS}-day cooldown between historical events`
    );

    state.day = 18 + MIN_DAYS_BETWEEN_EVENTS;
    checkAndTriggerHistoricalEvents(state);
    assert.equal(state.activeEventId, 'marsh_fever_outbreak');

    // Test Germ Theory waiving 18 Insight on marsh_fever_outbreak
    state.unlockedTechIds.push('germ_theory');
    state.resources.insight = 0;
    state.resources.stone = 8;
    const feverRes = resolveHistoricalEvent(
      state,
      'marsh_fever_outbreak',
      'chlorinated_sand_filtration'
    );
    assert.equal(
      feverRes.success,
      true,
      'Unlocked germ_theory should waive the 18 Insight cost for chlorinated_sand_filtration'
    );
    assert.equal(state.resources.stone, 0);
  });
});

