import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_DECISION_WINDOW_DAYS,
  MIN_DAYS_BETWEEN_EVENTS,
  SECONDS_PER_DAY,
  canPlaceBuilding,
  canUnlockTech,
  canUpgradeHouse,
  checkAndTriggerHistoricalEvents,
  createInitialGameState,
  deferHistoricalEvent,
  demolishTile,
  dismissTutorial,
  getDynamicTutorialTargets,
  getEffectiveBuildingCost,
  isTutorialStepSatisfied,
  placeBuilding,
  reopenDeferredEvent,
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
import {
  createLocalProjector,
  getTerrainSurfaceW,
  pickIsoTileAtScreenPoint
} from '../src/render/isoAssets.ts';

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

  it('walks through the tutorial with housing required before gathering and construction time required', () => {
    const state = createInitialGameState(1607);
    assert.equal(state.tutorialStepIndex, 0);
    assert.equal(state.resources.wood, 24);
    assert.equal(state.resources.planks, 0);
    assert.equal(state.resources.stone, 0);

    // Step 1: Place Temporal Landing at (7, 8) -> requires 3s construction time
    const landing = placeBuilding(state, 'founding_camp', 7, 8);
    assert.equal(landing.building?.isConstructed, false);
    assert.equal(landing.building?.status, 'constructing');
    assert.equal(state.tutorialStepIndex, 0, 'Should stay on Step 1 while Landing is under construction');
    stepSimulation(state, 3.5);
    assert.equal(landing.building?.isConstructed, true);
    assert.equal(state.tutorialStepIndex, 1, 'Should advance to Step 2 (Shelter the Landing Party)');
    assert.equal(TUTORIAL_STEPS[state.tutorialStepIndex].id, 'build_first_cabin');

    // Verify that if a Lumberjack Camp is built before any housing exists, it has 0% workforce ('no_workers')
    placeBuilding(state, 'lumberjack_hut', 11, 7);
    placeBuilding(state, 'dirt_road', 8, 8);
    placeBuilding(state, 'dirt_road', 9, 8);
    placeBuilding(state, 'dirt_road', 10, 8);
    placeBuilding(state, 'dirt_road', 11, 8);
    stepSimulation(state, 7);
    const ljBld = Object.values(state.buildings).find((b) => b.defId === 'lumberjack_hut')!;
    assert.equal(
      ljBld.status,
      'no_workers',
      'Lumberjack should not operate when colony has 0 housed settlers'
    );
    assert.equal(state.laborEfficiency, 0);

    // Step 2: Build first Pioneer Cabin at (8, 7) -> once constructed, provides 6 Pioneers so Lumberjack starts working!
    placeBuilding(state, 'pioneer_cabin', 8, 7);
    stepSimulation(state, 5.5);
    assert.equal(state.totalPopulation, 8);
    assert.equal(ljBld.status, 'working');
    assert.equal(
      state.tutorialStepIndex,
      4,
      'With Landing, First Cabin, Lumberjack, and Road complete, should be on Step 5 (Build Fishery)'
    );

    // Let Lumberjack harvest wood so we can afford Fishery, Sawmill, Cabins, and Market Square
    stepSimulation(state, 100);
    assert.ok(state.resources.wood >= 28, 'Lumberjack should have harvested timber');

    // Step 5: Build Fishery at (5, 8) and road at (6, 8)
    placeBuilding(state, 'dirt_road', 6, 8);
    placeBuilding(state, 'fishery', 5, 8);
    stepSimulation(state, 6.5);
    assert.equal(state.tutorialStepIndex, 5, 'Should advance to Step 6 (Build Sawmill)');

    // Step 6: Build Sawmill at (7, 7) and let it mill Planks
    placeBuilding(state, 'sawmill', 7, 7);
    stepSimulation(state, 8.5);
    assert.equal(state.tutorialStepIndex, 6, 'Should advance to Step 7 (Expand Housing & Market)');

    // Wait for Sawmill and Lumberjack to produce enough Wood & Planks for 2 more Cabins + Market Square
    stepSimulation(state, 150);
    placeBuilding(state, 'pioneer_cabin', 8, 9);
    placeBuilding(state, 'pioneer_cabin', 9, 9);
    placeBuilding(state, 'market_square', 9, 7);
    stepSimulation(state, 8.5);
    assert.equal(state.tutorialStepIndex, 7, 'Should advance to Step 8 (Unseal Future Knowledge)');
    assert.equal(state.trunksUnsealed, true);

    // Calling unsealFutureTrunks again must never grant another +20 Insight
    const insightAfterUnseal = state.resources.insight;
    assert.equal(unsealFutureTrunks(state), false);
    assert.equal(state.resources.insight, insightAfterUnseal);

    // Step 8: Unlock first Future Knowledge breakthrough -> advances to Step 9 (How to Gain More Future Insight: Academy)
    unlockTech(state, 'water_circular_saw');
    assert.equal(state.tutorialStepIndex, 8);
    assert.equal(TUTORIAL_STEPS[state.tutorialStepIndex].id, 'build_academy');
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
        /\banno\b/i.test(combined),
        false,
        `Step ${step.id} should not reference Anno: ${combined}`
      );
    }
  });

  it('awards mid-game milestone Insight and generates active Insight at the Time Traveler Academy', () => {
    const state = createInitialGameState(1607, true);
    state.resources.wood = 50;
    state.resources.planks = 50;
    state.resources.stone = 50;
    state.resources.tools = 50;
    state.resources.coin = 500;

    const beforeInsight = state.resources.insight;
    placeBuilding(state, 'dirt_road', 10, 8);
    const acad = placeBuilding(state, 'chronicle_observatory', 10, 7);
    assert.equal(acad.success, true);
    // Complete construction of road (1.5s) and Academy (12s)
    stepSimulation(state, 12.5);
    assert.ok(
      state.resources.insight >= beforeInsight + 8,
      'Building and completing the first Academy should award the +8 Insight milestone bonus'
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
    state.resources.wood = 50;
    state.resources.planks = 20;
    state.resources.stone = 20;
    state.resources.coin = 200;

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
    stepSimulation(state, 8.5);
    assert.equal(placed.building?.connectedToLogistics, true);
  });

  it('runs production chains at the slower colonial pace and converts inputs into outputs', () => {
    const state = createInitialGameState(1607, true);
    state.resources.wood = 50;
    const sawmillRes = placeBuilding(state, 'sawmill', 9, 7);
    assert.equal(sawmillRes.success, true);

    const initialPlanks = state.resources.planks;
    // 8s construction + 15s production cycle
    stepSimulation(state, 24);
    assert.ok(
      state.resources.planks > initialPlanks,
      `Expected Sawmill to produce planks after construction + cycle (was ${initialPlanks}, now ${state.resources.planks})`
    );
  });

  it('unlocks Future Knowledge breakthroughs and automatically applies upgraded recipes to both existing and newly built buildings', () => {
    const state = createInitialGameState(1607, true);
    state.resources.insight = 60;
    state.resources.wood = 60;
    state.resources.planks = 30;
    state.resources.coin = 200;
    placeBuilding(state, 'sawmill', 9, 7);
    stepSimulation(state, 8.5);

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
      'Existing Sawmill should automatically upgrade to the anachronistic circular saw recipe'
    );

    // Unlock crop_rotation and then place a brand new wheat_farm on fertile_soil (8, 10)
    unlockTech(state, 'crop_rotation');
    const newFarm = placeBuilding(state, 'wheat_farm', 8, 10);
    assert.equal(newFarm.success, true);
    assert.equal(
      newFarm.building?.activeRecipeId,
      'four_course_seed_drill',
      'Newly placed Wheat Farm should automatically use the upgraded Norfolk 4-Course recipe'
    );
  });

  it('upgrades Pioneer Cabin to Colonial Homestead and Enlightened Manor when needs and tech are met', () => {
    const state = createInitialGameState(1607, true);
    state.resources.wood = 50;
    state.resources.planks = 50;
    state.resources.stone = 50;
    state.resources.coin = 300;
    placeBuilding(state, 'market_square', 9, 7);
    stepSimulation(state, 9);

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

  it('triggers historical events at later days, supports deferring with a countdown timer, and resolves with butterfly effects', () => {
    const state = createInitialGameState(1607, true);
    skipTutorial(state);
    state.resources.wood = 40;
    placeBuilding(state, 'pioneer_cabin', 8, 9);
    placeBuilding(state, 'pioneer_cabin', 9, 9);
    // Advance 15 days (15 * 25s = 375s) with enough fish so population reaches >= 16
    state.resources.fish = 200;
    stepSimulation(state, 375);
    assert.equal(state.activeEventId, 'starving_winter_1609');
    assert.equal(state.activeEventDeadlineDay, state.day + EVENT_DECISION_WINDOW_DAYS);
    assert.equal(state.eventDeferred, false);

    // Defer the event ("Decide Later") so simulation can continue while gathering Insight
    const deferred = deferHistoricalEvent(state);
    assert.equal(deferred, true);
    assert.equal(state.eventDeferred, true);
    assert.equal(state.speed, 1);

    // Advance 2 days while deferred — event stays deferred
    stepSimulation(state, 50);
    assert.equal(state.eventDeferred, true);

    // Advance past the 5-day decision window — event automatically reopens and pauses
    stepSimulation(state, 75);
    assert.equal(state.eventDeferred, false);
    assert.equal(state.speed, 0);

    // Also test manual reopen helper
    state.eventDeferred = true;
    reopenDeferredEvent(state);
    assert.equal(state.eventDeferred, false);

    state.resources.insight = 25;
    state.resources.wood = 20;
    const prevDiv = state.divergence;
    const prevChronLen = state.chronicle.length;
    const res = resolveHistoricalEvent(state, 'starving_winter_1609', 'cold_frame_root_cellars');
    assert.equal(res.success, true);
    assert.equal(state.activeEventId, null);
    assert.equal(state.activeEventDeadlineDay, null);
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
    state.day = 26;
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
    assert.equal(state.lastEventDay, 26);
    state.day = 30;
    state.totalPopulation = 30;
    checkAndTriggerHistoricalEvents(state);
    assert.equal(
      state.activeEventId,
      null,
      `Should enforce ${MIN_DAYS_BETWEEN_EVENTS}-day cooldown between historical events`
    );

    state.day = 26 + MIN_DAYS_BETWEEN_EVENTS;
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

  it('splits simulation ticks at construction completion boundaries so buildings do not operate retroactively', () => {
    const state = createInitialGameState(1607, true);
    state.resources.wood = 50;
    const placed = placeBuilding(state, 'sawmill', 9, 7);
    assert.equal(placed.success, true);
    const sawmill = placed.building!;
    assert.equal(sawmill.buildTimeSeconds, 8);

    // Step 14s in one call: 8s should be spent constructing, leaving only 6s of production (< 14s cycle)
    const planksBefore = state.resources.planks;
    stepSimulation(state, 14);
    assert.equal(sawmill.isConstructed, true);
    assert.equal(
      state.resources.planks,
      planksBefore,
      'Sawmill should only have 6s of post-construction operation, not a full 14s cycle'
    );
    assert.ok(sawmill.progressSeconds > 0 && sawmill.progressSeconds < 14);
  });

  it('requires both a connected Quarry and an upgraded Homestead for quarry_and_upgrade and resumes guide after dismissal', () => {
    const state = createInitialGameState(1607);
    // Dismiss guide on Step 1, then build and finish Warehouse while guide is dismissed
    dismissTutorial(state);
    assert.equal(state.tutorialActive, false);
    placeBuilding(state, 'founding_camp', 7, 8);
    stepSimulation(state, 3.5);

    // Reopening the guide should advance to Step 2 (build_first_cabin) rather than staying stuck on Step 1
    toggleTutorial(state, true);
    assert.equal(state.tutorialStepIndex, 1);

    // Verify quarry_and_upgrade requires BOTH quarry AND homestead
    state.resources.wood = 100;
    state.resources.planks = 100;
    state.resources.stone = 100;
    state.resources.fish = 100;
    state.resources.coin = 500;
    placeBuilding(state, 'pioneer_cabin', 8, 7);
    placeBuilding(state, 'market_square', 9, 7);
    placeBuilding(state, 'quarry', 13, 6);
    // Use dynamic road pathfinder to connect the quarry at (13, 6) to the warehouse at (7, 8)
    state.tutorialStepIndex = 9; // quarry_and_upgrade
    const roadTiles = getDynamicTutorialTargets(state);
    for (const rt of roadTiles) {
      placeBuilding(state, 'dirt_road', rt.x, rt.y);
    }
    stepSimulation(state, 9);

    assert.equal(
      isTutorialStepSatisfied(state, 'quarry_and_upgrade'),
      false,
      'Quarry alone should not complete quarry_and_upgrade before upgrading a residence'
    );

    const cabin = Object.values(state.buildings).find((b) => b.defId === 'pioneer_cabin')!;
    const upg = upgradeHouse(state, cabin.id);
    assert.equal(upg.success, true);
    assert.equal(
      isTutorialStepSatisfied(state, 'quarry_and_upgrade'),
      true,
      'Both connected Quarry and upgraded Homestead should complete quarry_and_upgrade'
    );
  });

  it('computes dynamic tutorial targets and road routes from arbitrary landing locations', () => {
    const state = createInitialGameState(1607);
    // Place the free Temporal Landing at (15, 6) instead of the default (7, 8)
    const landing = placeBuilding(state, 'founding_camp', 15, 6);
    assert.equal(landing.success, true);
    stepSimulation(state, 3.5);
    assert.equal(state.tutorialStepIndex, 1);

    // Dynamic targets for Step 2 (build_first_cabin) should be near (15, 6) and connected!
    const cabinTargets = getDynamicTutorialTargets(state);
    assert.ok(cabinTargets.length > 0);
    const firstTarget = cabinTargets[0];
    const cabinRes = placeBuilding(state, 'pioneer_cabin', firstTarget.x, firstTarget.y);
    assert.equal(cabinRes.success, true);
    stepSimulation(state, 5.5);
    assert.equal(
      cabinRes.building?.connectedToLogistics,
      true,
      'Dynamically recommended cabin site near arbitrary landing (15, 6) must be connected'
    );
    assert.equal(state.tutorialStepIndex, 2);
  });

  it('extends deferred event deadline if no choice is affordable at expiry and completes reordered tutorial steps', () => {
    const state = createInitialGameState(1607, true);
    skipTutorial(state);
    state.completedEventIds.push('starving_winter_1609');
    state.day = 25;
    state.lastEventDay = 1;
    state.totalPopulation = 24;
    state.resources.tools = 4;

    checkAndTriggerHistoricalEvents(state);
    assert.equal(state.activeEventId, 'indigenous_envoy_1611');
    assert.equal(deferHistoricalEvent(state), true);

    // Spend all tools before the 5-day deadline expires
    state.resources.tools = 0;
    stepSimulation(state, 5 * SECONDS_PER_DAY);
    assert.equal(
      state.eventDeferred,
      true,
      'Deferred event should stay deferred and extend deadline when no choice is affordable at expiry'
    );
    assert.ok((state.activeEventDeadlineDay ?? 0) > state.day);

    // Once tools are available again, the next day reopens the event cleanly
    state.resources.tools = 4;
    stepSimulation(state, SECONDS_PER_DAY);
    assert.equal(state.eventDeferred, false);
  });

  it('projects 3D isometric tile coordinates and terrain surface elevations accurately', () => {
    const cx = 400;
    const cy = 300;
    const halfW = 46;
    const halfH = 23;
    const pt = createLocalProjector(cx, cy, halfW, halfH, 0);

    // Center of diamond (u=0.5, v=0.5, w=0) maps to (cx, cy)
    assert.deepEqual(pt(0.5, 0.5, 0), { x: cx, y: cy });
    // Top corner (u=0, v=0, w=0) maps to (cx, cy - halfH)
    assert.deepEqual(pt(0, 0, 0), { x: cx, y: cy - halfH });
    // Right corner (u=1, v=0, w=0) maps to (cx + halfW, cy)
    assert.deepEqual(pt(1, 0, 0), { x: cx + halfW, y: cy });
    // Bottom corner (u=1, v=1, w=0) maps to (cx, cy + halfH)
    assert.deepEqual(pt(1, 1, 0), { x: cx, y: cy + halfH });
    // Left corner (u=0, v=1, w=0) maps to (cx - halfW, cy)
    assert.deepEqual(pt(0, 1, 0), { x: cx - halfW, y: cy });
    // Vertical 3D height w=1 lifts screen Y upward by 2 * halfH
    assert.deepEqual(pt(0.5, 0.5, 1), { x: cx, y: cy - 2 * halfH });

    // Water is recessed below land, and mineral outcrops are elevated above grass
    assert.ok(getTerrainSurfaceW('deep_water') < getTerrainSurfaceW('coastal_water'));
    assert.ok(getTerrainSurfaceW('coastal_water') < getTerrainSurfaceW('grass'));
    assert.ok(getTerrainSurfaceW('stone_deposit') > getTerrainSurfaceW('grass'));
    assert.ok(getTerrainSurfaceW('iron_deposit') >= getTerrainSurfaceW('stone_deposit'));
  });

  it('hit-tests visible foreground building roofs before rear tiles in select and demolish modes while retaining ground picking in build mode', () => {
    const state = createInitialGameState(1607);
    state.resources.wood = 100;
    state.resources.planks = 100;
    state.resources.stone = 100;
    state.resources.coin = 500;

    // Place a rear Pioneer Cabin at (7, 7) and a tall foreground Temporal Landing at (8, 8)
    placeBuilding(state, 'founding_camp', 8, 8);
    placeBuilding(state, 'pioneer_cabin', 7, 7);
    stepSimulation(state, 6);

    const offsetX = 500;
    const offsetY = 100;
    const halfW = 46;
    const halfH = 23;

    // Screen center of tile (8, 8) is (offsetX, offsetY + 17 * halfH).
    // A point near the upper spire/roof of (8, 8) at cy - 1.6 * halfH projects over the ground diamond of rear tile (7, 7).
    const fgCx = offsetX + (8 - 8) * halfW;
    const fgCy = offsetY + (8 + 8 + 1) * halfH;
    const roofClickX = fgCx;
    const roofClickY = fgCy - 1.6 * halfH;

    // In select and demolish modes, clicking the foreground roof must pick (8, 8), not (7, 7)
    assert.deepEqual(
      pickIsoTileAtScreenPoint(roofClickX, roofClickY, offsetX, offsetY, halfW, halfH, state, 'select'),
      { x: 8, y: 8 }
    );
    assert.deepEqual(
      pickIsoTileAtScreenPoint(roofClickX, roofClickY, offsetX, offsetY, halfW, halfH, state, 'demolish'),
      { x: 8, y: 8 }
    );

    // In build mode, ground diamond picking is retained so hovering that screen position targets (7, 7)
    assert.deepEqual(
      pickIsoTileAtScreenPoint(roofClickX, roofClickY, offsetX, offsetY, halfW, halfH, state, 'build'),
      { x: 7, y: 7 }
    );
  });
});

