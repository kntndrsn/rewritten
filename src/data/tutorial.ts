import type { BuildingCategory } from './types.ts';

export interface IntroStoryConfig {
  subtitle: string;
  headline: string;
  dateLocation: string;
  paragraphs: string[];
  directives: string[];
}

export interface TutorialStepDefinition {
  index: number;
  id: string;
  title: string;
  subtitle: string;
  narrative: string;
  objectiveText: string;
  recommendedBuildDefId?: string;
  recommendedCategory?: BuildingCategory;
  highlightTiles?: Array<{ x: number; y: number; label?: string }>;
  allowManualAdvance?: boolean;
}

export const INTRO_STORY: IntroStoryConfig = {
  subtitle: 'CHRONO-EXPEDITION DOSSIER // ARCHIVE 1607-VA',
  headline: 'Stranded on the Tidewater Frontier',
  dateLocation: 'May 14, 1607 — James River Peninsula, Virginia',
  paragraphs: [
    'Your temporal transit craft lies scuttled beneath the brackish waters off Cape Henry. Disguised as a chartered Virginia Company supply party, your small team of 21st-century engineers, physicians, and historians has waded ashore onto a mosquito-ridden peninsula of dense timberland and tidal shallows.',
    'Locked inside your oilskin trunks are the blueprints of centuries yet to come: rotary sawmills, nitrogen-fixing crop rotation, germ theory sanitation, and Bessemer crucible steel. Yet none of those treatises can feed a hungry camp tonight or fell a single oak.',
    'Before you can dare to rewrite history, you must survive it. Establish a working colonial foothold—fell timber, cast fishing nets, build cart roads, shelter pioneers, and mill planks—before unsealing the Future Archives.'
  ],
  directives: [
    '🪵 First Survival: Gather Timber & Salted Fish using frontier labor before your landing rations run dry.',
    '🛤️ Colonial Logistics: Connect every camp, cabin, and workshop to your Temporal Landing with Cart Roads.',
    '⏳ Paced Progression: Only once your settlement is self-sustaining can you unpack your Future Insight trunks and introduce anachronistic breakthroughs.'
  ]
};

export const TUTORIAL_STEPS: TutorialStepDefinition[] = [
  {
    index: 0,
    id: 'place_landing',
    title: '1. Choose Your Landing Site',
    subtitle: 'Establish your Temporal Landing & Warehouse',
    narrative:
      'The tidewater valley lies untouched before you. First, choose where to pitch your Temporal Landing & Warehouse—your first placement is completely free and takes a few seconds to erect.',
    objectiveText:
      'Select "Temporal Landing & Warehouse" and place it on any clear meadow tile (such as the highlighted clearing) and wait for construction to finish.',
    recommendedBuildDefId: 'founding_camp',
    recommendedCategory: 'civic',
    highlightTiles: [
      { x: 7, y: 8, label: 'Suggested Landing' },
      { x: 8, y: 8 }
    ]
  },
  {
    index: 1,
    id: 'build_first_cabin',
    title: '2. Shelter the Landing Party',
    subtitle: 'House your first Pioneers so workshops have a workforce',
    narrative:
      'Logging camps and fisheries cannot operate without sheltered colonists! Build your first Pioneer Cabin near your Temporal Landing so your founding crew can move in and provide labor.',
    objectiveText:
      'Select "Pioneer Cabin" (🛖 Housing) and construct it on a highlighted tile next to your Warehouse (or linked by road).',
    recommendedBuildDefId: 'pioneer_cabin',
    recommendedCategory: 'housing',
    highlightTiles: [
      { x: 8, y: 7, label: 'Build Pioneer Cabin' },
      { x: 7, y: 7 }
    ]
  },
  {
    index: 2,
    id: 'build_lumberjack',
    title: '3. Fell the Old-Growth Timber',
    subtitle: 'Establish your primary Timber supply',
    narrative:
      'Your shipboard timber is nearly spent. East of the clearing stands dense Old-Growth Timberland where your newly housed Pioneers can fell pine and oak.',
    objectiveText:
      'Select "Lumberjack Camp" (🪓 Gathering) and place it on one of the highlighted tiles along the forest edge.',
    recommendedBuildDefId: 'lumberjack_hut',
    recommendedCategory: 'gathering',
    highlightTiles: [
      { x: 11, y: 7, label: 'Build Lumberjack' },
      { x: 12, y: 7 }
    ]
  },
  {
    index: 3,
    id: 'connect_lumberjack_road',
    title: '4. Lay a Colonial Cart Road',
    subtitle: 'Connect your Lumberjack Camp and gather Timber',
    narrative:
      'Workshops must be linked to your Temporal Landing by road so carters can haul harvested timber into storage. Once connected, let your loggers gather Timber for your next buildings.',
    objectiveText:
      'Select "Colonial Cart Road" (🏛️ Civic & Roads) and lay road tiles along the highlighted path until your Lumberjack Camp is connected.',
    recommendedBuildDefId: 'dirt_road',
    recommendedCategory: 'civic',
    highlightTiles: [
      { x: 8, y: 8 },
      { x: 9, y: 8, label: 'Connect Road' },
      { x: 10, y: 8 },
      { x: 11, y: 8 }
    ]
  },
  {
    index: 4,
    id: 'build_fishery',
    title: '5. Cast Nets in the Shallows',
    subtitle: 'Secure Salted Fish before landing rations run out',
    narrative:
      'Your pioneers consume Salted Fish every minute. Once your Lumberjack Camp has harvested enough Timber, establish a Coastal Fishery on the western shore and link it by road.',
    objectiveText:
      'Gather 12 Timber, build a "Coastal Fishery" on a highlighted shore tile, and connect it to your Warehouse with a "Colonial Cart Road".',
    recommendedBuildDefId: 'fishery',
    recommendedCategory: 'gathering',
    highlightTiles: [
      { x: 5, y: 8, label: 'Build Fishery' },
      { x: 6, y: 8 }
    ]
  },
  {
    index: 5,
    id: 'build_sawmill',
    title: '6. Mill Structural Planks',
    subtitle: 'Refine raw Timber into Milled Planks',
    narrative:
      'You arrived with zero pre-milled Planks. Before you can erect a Market Square or quarry stone, build a Sawmill along your road network and let it saw raw Timber into Milled Planks.',
    objectiveText:
      'Gather 14 Timber, build a connected "Sawmill" (⚒️ Production) along your road network, and let it mill Planks.',
    recommendedBuildDefId: 'sawmill',
    recommendedCategory: 'production',
    highlightTiles: [
      { x: 7, y: 7, label: 'Build Sawmill' },
      { x: 10, y: 9 }
    ]
  },
  {
    index: 6,
    id: 'shelter_and_market',
    title: '7. Expand Housing & Open a Market',
    subtitle: 'Grow your workforce and distribute rations',
    narrative:
      'As your Sawmill produces Milled Planks and your Lumberjack harvests Timber, build additional Pioneer Cabins for a larger workforce and open a central Colonial Market Square.',
    objectiveText:
      'Have at least 3 connected "Pioneer Cabins" and 1 connected "Colonial Market Square" (requires 6 Planks from your Sawmill).',
    recommendedBuildDefId: 'market_square',
    recommendedCategory: 'civic',
    highlightTiles: [
      { x: 9, y: 7, label: 'Build Market & Cabins' },
      { x: 8, y: 9 },
      { x: 9, y: 9 }
    ]
  },
  {
    index: 7,
    id: 'unseal_future_knowledge',
    title: '8. Unseal the Future Archives',
    subtitle: 'Introduce your first anachronistic invention',
    narrative:
      'Your colonial foothold is self-sustaining! Your team has unsealed the oilskin trunks of future scientific treatises (+20 Future Insight granted). Now you can begin rewriting history.',
    objectiveText:
      'Click "⏳ Future Knowledge" in the top bar and unlock your first anachronistic breakthrough (such as Rotary Saw or Norfolk Crop Rotation).'
  },
  {
    index: 8,
    id: 'quarry_and_upgrade',
    title: '9. Quarry Stone & Upgrade Homesteads',
    subtitle: 'Advance from Pioneers to skilled Colonists',
    narrative:
      'To unlock more Future Knowledge, you need a steady stream of Future Insight. Quarrying Cut Stone (+8 Insight milestone) and upgrading Pioneer Cabins into Colonial Homesteads (+8 Insight milestone) fuels the next era.',
    objectiveText:
      'Build a connected "Stone Quarry" by the northern Granite Outcrop, then upgrade a supplied Pioneer Cabin into a "Colonial Homestead".',
    recommendedBuildDefId: 'quarry',
    recommendedCategory: 'gathering',
    highlightTiles: [
      { x: 13, y: 6, label: 'Build Quarry' },
      { x: 8, y: 7 }
    ]
  },
  {
    index: 9,
    id: 'build_academy',
    title: '10. Build the Time Traveler’s Academy',
    subtitle: 'Generate steady Future Insight for breakthroughs',
    narrative:
      'The Time Traveler’s Academy & Press is your primary engine of Future Insight: it passively generates +3 Insight/min and compiles Colonial Field Notes for +3 Insight every 15 seconds!',
    objectiveText:
      'Select "Time Traveler’s Academy & Press" (⏳ Time-Travel tab) and construct it along your road network (+8 Insight milestone bonus).',
    recommendedBuildDefId: 'chronicle_observatory',
    recommendedCategory: 'temporal',
    highlightTiles: [{ x: 10, y: 7, label: 'Build Academy' }]
  }
];
