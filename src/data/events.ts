import type { HistoricalEventDefinition } from './types.ts';

export const HISTORICAL_EVENTS: HistoricalEventDefinition[] = [
  {
    id: 'starving_winter_1609',
    title: 'The Frost of 1609: Early Blight & Cold Snap',
    year: 'Autumn 1609',
    minDay: 15,
    minPopulation: 16,
    description: 'An unseasonably bitter frost rolls down the river valley. Historically, this winter devastated early colonial settlements, forcing rations down to acorns and boiled leather.',
    historicalContext: 'In the original timeline, the "Starving Time" of 1609–1610 claimed over two-thirds of the Jamestown colonists.',
    choices: [
      {
        id: 'strict_colonial_rations',
        label: 'Enforce Strict Colonial Rations (Historical Path)',
        outcomeText: 'You ration fish and firewood strictly. The colony endures the chill with bruised morale, keeping the timeline intact.',
        effects: {
          resources: { fish: -12, wood: -15 },
          happinessModifierDelta: -5,
          divergenceDelta: 0,
          paradoxDelta: -2,
          chronicleEntry: '1609: Survived the Great Frost through grim colonial rationing; history stayed near its familiar course.'
        }
      },
      {
        id: 'cold_frame_root_cellars',
        label: 'Introduce Insulated Root Cellars & Cold-Frame Greenhouses (Spend 10 Insight)',
        isAnachronistic: true,
        cost: { insight: 10, wood: 10 },
        outcomeText: 'Using future thermodynamic principles, you build sunken thermal cellars and glazed cold frames. Not a single settler goes hungry!',
        effects: {
          resources: { grain: 20, fish: 15 },
          happinessModifierDelta: 6,
          divergenceDelta: 12,
          paradoxDelta: 5,
          chronicleEntry: '1609: Rewrote the "Starving Time" using thermal root cellars and cold frames—zero famine mortality recorded.'
        }
      }
    ]
  },
  {
    id: 'indigenous_envoy_1611',
    title: 'Algonquian Trade Delegation at the River Bend',
    year: 'Spring 1611',
    minDay: 24,
    minPopulation: 20,
    description: 'An envoy of neighboring Algonquian leaders arrives at your perimeter, observing your strange waterwheels and Surveying stakes. Historically, land disputes and broken treaties soon led to war.',
    historicalContext: 'Early colonial expansion frequently triggered violent conflict over fertile river bottomlands and food stores.',
    choices: [
      {
        id: 'guarded_barter',
        label: 'Conduct Cautious Fur & Corn Barter',
        cost: { tools: 4 },
        outcomeText: 'You trade iron tools for local seed corn and botanical knowledge, maintaining a polite but distant peace.',
        effects: {
          resources: { grain: 18, herbs: 12, coin: 40 },
          divergenceDelta: 4,
          paradoxDelta: 0,
          chronicleEntry: '1611: Established a peaceful river barter for corn and medicinal flora.'
        }
      },
      {
        id: 'treaty_of_shared_agronomy',
        label: 'Forge the Covenant of Shared Agronomy & Medicine (Spend 15 Insight)',
        isAnachronistic: true,
        cost: { insight: 15, tools: 6 },
        outcomeText: 'You share steel toolmaking and antiseptic techniques in exchange for indigenous three-sisters polyculture and regional maps. A permanent alliance blossoms!',
        effects: {
          resources: { grain: 25, herbs: 20, coin: 90 },
          productionMultiplierDelta: 0.1,
          happinessModifierDelta: 5,
          divergenceDelta: 18,
          paradoxDelta: 6,
          chronicleEntry: '1611: Signed the unprecedented Covenant of Shared Agronomy, uniting indigenous ecology with future metallurgy.'
        }
      }
    ]
  },
  {
    id: 'marsh_fever_outbreak',
    title: 'Summer Marsh Fever & Contaminated Wells',
    year: 'Summer 1613',
    minDay: 34,
    minPopulation: 26,
    description: 'Stagnant summer water brings an outbreak of dysentery and typhoid fever to the riverbank cabins. Settlers blame "bad night air" (miasma).',
    historicalContext: 'Waterborne illnesses and mosquito-borne fevers routinely crippled 17th-century coastal settlements.',
    choices: [
      {
        id: 'bleeding_and_quarantine',
        label: 'Order Traditional Quarantine & Herbal Poultices',
        cost: { herbs: 6, coin: 40 },
        outcomeText: 'The outbreak slowly subsides, though work slows and the settlers remain fearful of the summer air.',
        effects: {
          happinessModifierDelta: -4,
          divergenceDelta: 0,
          paradoxDelta: 0,
          chronicleEntry: '1613: Endured the Summer Marsh Fever with traditional quarantines.'
        }
      },
      {
        id: 'chlorinated_sand_filtration',
        label: 'Construct Charcoal-Sand Water Filters & Enforce Boiling (Requires Germ Theory or 18 Insight)',
        isAnachronistic: true,
        requiredTechId: 'germ_theory',
        cost: { insight: 18, stone: 8 },
        outcomeText: 'You seal contaminated shallow wells, install layered sand-and-charcoal filters, and mandate boiled water. The fever vanishes in 48 hours!',
        effects: {
          resources: { medicine: 12 },
          happinessModifierDelta: 8,
          divergenceDelta: 16,
          paradoxDelta: 5,
          chronicleEntry: '1613: Eradicated waterborne typhus centuries ahead of John Snow using charcoal-sand filtration.'
        }
      }
    ]
  },
  {
    id: 'royal_commissioner_inspection',
    title: 'The Crown’s Charter Commissioner Arrives',
    year: 'Autumn 1615',
    minDay: 44,
    minDivergence: 15,
    description: 'A Royal Frigate drops anchor offshore. Commissioner Lord Dunmore is astonished—and deeply suspicious—of your settlement’s unusual machinery, high literacy, and unorthodox workshops.',
    historicalContext: 'Mercantilist charters strictly forbade colonial manufacturing that competed with English guild monopolies.',
    choices: [
      {
        id: 'pay_royal_tribute',
        label: 'Bribe the Commissioner & Disguise Workshops as Guild Mills',
        cost: { coin: 120, planks: 15 },
        outcomeText: 'A generous chest of silver and carefully staged inspections convince Lord Dunmore to file a glowing, unremarkable report to London.',
        effects: {
          paradoxDelta: -12,
          divergenceDelta: 2,
          chronicleEntry: '1615: Pacified the Crown Commissioner with silver tribute, concealing our technological leap from Whitehall.'
        }
      },
      {
        id: 'charter_of_scientific_autonomy',
        label: 'Demonstrate High-Carbon Steel & Demand a Royal Society Charter (Spend 20 Insight)',
        isAnachronistic: true,
        cost: { insight: 20, tools: 10 },
        outcomeText: 'Stunned by your crucible steel instruments and accurate chronometers, the Commissioner sponsors an autonomous "New World Philosophical Charter," drawing scholars across the Atlantic!',
        effects: {
          resources: { coin: 180 },
          productionMultiplierDelta: 0.12,
          divergenceDelta: 22,
          paradoxDelta: 10,
          chronicleEntry: '1615: Secured the Charter of Scientific Autonomy, transforming the colony into a magnet for Atlantic thinkers.'
        }
      }
    ]
  },
  {
    id: 'witchcraft_paradox_panic',
    title: 'Whispers of "Time-Sorcery" in the Parish',
    year: 'Winter 1617',
    minDay: 54,
    minParadox: 18,
    description: 'Rapid anachronistic changes have unsettled superstitions. A zealous preacher accuses your Observatory scholars of consulting "books not yet written by man."',
    historicalContext: '17th-century anxiety over rapid social or unexplained change frequently erupted into witchcraft panics.',
    choices: [
      {
        id: 'host_town_hall_exposition',
        label: 'Hold a Public Mechanics Fair & Feast at the Market Square',
        cost: { bread: 12, fish: 12, coin: 60 },
        outcomeText: 'By letting every colonist inspect the gears, lenses, and bread ovens firsthand over warm loaves, fear turns into civic pride.',
        effects: {
          paradoxDelta: -16,
          happinessModifierDelta: 6,
          divergenceDelta: 6,
          chronicleEntry: '1617: Defused a superstition panic with the first Colonial Mechanics Exposition, replacing fear with empirical curiosity.'
        }
      },
      {
        id: 'publish_almanac_of_reason',
        label: 'Print "Poor Traveler’s Almanac of Natural Law" for Every Household (Spend 15 Insight)',
        isAnachronistic: true,
        cost: { insight: 15, coin: 40 },
        outcomeText: 'Your printed almanacs explain weather, microbes, and metallurgy in plain vernacular, sparking an early American Enlightenment!',
        effects: {
          paradoxDelta: -14,
          divergenceDelta: 15,
          happinessModifierDelta: 8,
          chronicleEntry: '1617: Published the "Almanac of Natural Law," inoculating the colony against superstition and witch trials.'
        }
      }
    ]
  }
];
