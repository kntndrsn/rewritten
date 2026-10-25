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
    id: 'survey_landing',
    title: '1. Survey the James River Landing',
    subtitle: 'Familiarize yourself with your foothold',
    narrative:
      'We have pitched our Temporal Landing & Warehouse at (7, 8) alongside a single Pioneer Cabin for our founding crew. Our sealed trunks of future notes are stowed away until basic survival is assured.',
    objectiveText:
      'Click our Temporal Landing at (7, 8) to inspect it, or click "Complete Step" once you have surveyed the surrounding woods and river shallows.',
    highlightTiles: [{ x: 7, y: 8, label: 'Landing' }],
    allowManualAdvance: true
  },
  {
    index: 1,
    id: 'build_lumberjack',
    title: '2. Fell the Old-Growth Timber',
    subtitle: 'Establish your primary Timber supply',
    narrative:
      'Every structure on the colonial frontier requires wood. East of our landing stands dense Old-Growth Timberland. We must set up a Lumberjack Camp on the forest edge.',
    objectiveText:
      'Select "Lumberjack Camp" (🪓 Gathering) and place it on or adjacent to Forest—such as tile (10, 7) or (11, 7).',
    recommendedBuildDefId: 'lumberjack_hut',
    recommendedCategory: 'gathering',
    highlightTiles: [
      { x: 10, y: 7, label: 'Build Lumberjack' },
      { x: 11, y: 7, label: 'Forest Edge' }
    ]
  },
  {
    index: 2,
    id: 'connect_lumberjack_road',
    title: '3. Lay a Colonial Cart Road',
    subtitle: 'Connect your Lumberjack Camp to the Warehouse',
    narrative:
      'In an Anno-style settlement, workshops must be linked to the Warehouse by road so carters can haul timber into storage.',
    objectiveText:
      'Select "Colonial Cart Road" (🏛️ Civic & Roads) and lay road tiles (e.g. along y = 8) until your Lumberjack Camp is connected and operating.',
    recommendedBuildDefId: 'dirt_road',
    recommendedCategory: 'civic',
    highlightTiles: [
      { x: 10, y: 8, label: 'Road' },
      { x: 11, y: 8, label: 'Road' }
    ]
  },
  {
    index: 3,
    id: 'build_fishery',
    title: '4. Cast Nets in the Shallows',
    subtitle: 'Secure Salted Fish before landing rations run out',
    narrative:
      'Our pioneers consume Salted Fish every minute. The western bay and tidal river teem with perch and shad—we must establish a Coastal Fishery and link it by road.',
    objectiveText:
      'Build a "Coastal Fishery" at (5, 8) next to the Coastal Shallows and connect it to the Warehouse with a "Colonial Cart Road" at (6, 8).',
    recommendedBuildDefId: 'fishery',
    recommendedCategory: 'gathering',
    highlightTiles: [
      { x: 5, y: 8, label: 'Build Fishery' },
      { x: 6, y: 8, label: 'Road Link' }
    ]
  },
  {
    index: 4,
    id: 'shelter_and_market',
    title: '5. Shelter Pioneers & Open a Market',
    subtitle: 'Grow your workforce and distribute rations',
    narrative:
      'With timber and fish flowing into our Warehouse, more settlers can come ashore. They need Pioneer Cabins for shelter and a central Colonial Market Square to receive rations.',
    objectiveText:
      'Have at least 3 connected "Pioneer Cabins" (build 2 more, e.g. at (8, 9) and (9, 9)) and 1 connected "Colonial Market Square" (e.g. at (9, 7)).',
    recommendedBuildDefId: 'pioneer_cabin',
    recommendedCategory: 'housing',
    highlightTiles: [
      { x: 9, y: 7, label: 'Market Square' },
      { x: 8, y: 9, label: 'Cabin' },
      { x: 9, y: 9, label: 'Cabin' }
    ]
  },
  {
    index: 5,
    id: 'build_sawmill',
    title: '6. Mill Structural Planks',
    subtitle: 'Refine raw Timber into Milled Planks',
    narrative:
      'Rough logs suffice for frontier huts, but homestead upgrades, farms, and laboratories require Milled Planks cut at a Sawmill.',
    objectiveText:
      'Build a connected "Sawmill" (⚒️ Production, e.g. at (7, 7) or (10, 9)) so your colony begins milling Planks.',
    recommendedBuildDefId: 'sawmill',
    recommendedCategory: 'production',
    highlightTiles: [
      { x: 7, y: 7, label: 'Build Sawmill' },
      { x: 10, y: 9, label: 'Build Sawmill' }
    ]
  },
  {
    index: 6,
    id: 'unseal_future_knowledge',
    title: '7. Unseal the Future Archives',
    subtitle: 'Introduce your first anachronistic invention',
    narrative:
      'Our colonial foothold is self-sustaining! Your team has unsealed the oilskin trunks of future scientific treatises (+20 Future Insight granted). Now we can begin rewriting history.',
    objectiveText:
      'Click "⏳ Future Knowledge" in the top bar and unlock your first anachronistic breakthrough (such as Rotary Saw or Norfolk Crop Rotation).'
  }
];
