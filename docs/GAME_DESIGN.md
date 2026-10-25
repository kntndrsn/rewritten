# Rewritten — Game Design & Architecture Document (GDD)

> **Purpose of this Document**: This living Game Design & Technical Architecture Document captures the design pillars, data schemas, progression loops, balance rules, and future roadmap for **Rewritten**. Any coding session can read this file alongside `src/data/` and `src/core/simulation.ts` to pick up development seamlessly without needing prior chat history.

---

## 1. Core Concept & Fantasy

**Rewritten** is a browser-based colonial settlement and production strategy game set in **1607 Tidewater Virginia**.

- **The Premise**: You lead a time-displaced expedition from the near future whose transit vessel was scuttled off Cape Henry. Disguised as a Virginia Company party, your team carries sealed oilskin trunks containing blueprints of centuries yet to come (rotary sawmills, nitrogen-fixing crop rotation, germ theory sanitation, crucible steel, and printing presses).
- **The Pacing Arc**:
  1. **Phase 1 — Frontier Landfall & Survival**: You begin on an untouched map with zero pre-placed buildings. You choose where to establish your **Temporal Landing & Warehouse**, build Pioneer Cabins, fell timber, lay cart roads, cast fishing nets, open a Market Square, and mill structural Planks.
  2. **Phase 2 — Unsealing the Archives & Colonial Growth**: Once basic survival infrastructure is operating, your expedition unseals the Future Archives (`+20 Future Insight`). You quarry stone, upgrade Pioneer Cabins into **Colonial Homesteads**, and construct the **Time Traveler’s Academy & Press** to actively generate **Future Insight**.
  3. **Phase 3 — Anachronistic Industry & Timeline Intervention**: Spend **Future Insight** to unlock anachronistic breakthroughs and switch workshops to high-yield future recipes. Navigate **Historical Events** (with an 8-day minimum cooldown between events) where you choose between historical caution and time-traveler intervention.
  4. **Phase 4 — The Enlightened Commonwealth (Victory)**: Upgrade Colonial Homesteads into **Enlightened Manors** (`Innovators`), reach **75+ Total Population**, **20+ Innovators**, and **50%+ Historical Divergence** while keeping **Paradox Pressure** below **70%**.

---

## 2. Technical Architecture & File Map

The project is 100% data-driven and modular, written in strict TypeScript and bundled with `esbuild` into `dist/` (`index.html`, `styles.css`, `bundle.js`).

| Path | Responsibility |
| :--- | :--- |
| `src/data/types.ts` | Shared TypeScript interfaces for resources, terrains, buildings, recipes, population tiers, technologies, and events. |
| `src/data/resources.ts` | Resource metadata, icons, starting amounts, and warehouse storage flags (`wood`, `planks`, `stone`, `fish`, `grain`, `bread`, `iron_ore`, `tools`, `herbs`, `medicine`, `coin`, `insight`). |
| `src/data/terrain.ts` | Terrain types (`deep_water`, `coastal_water`, `river`, `grass`, `fertile_soil`, `forest`, `stone_deposit`, `iron_deposit`). |
| `src/data/buildings.ts` | Building definitions, costs, worker requirements, service radii, housing upgrade paths, and standard vs. anachronistic recipes. |
| `src/data/population.ts` | Population tiers (`pioneers`, `colonists`, `innovators`), tax rates, passive Insight rates, and household needs. |
| `src/data/technologies.ts` | Future Knowledge breakthroughs, Insight costs, prerequisites, Divergence/Paradox impacts, and gameplay effects. |
| `src/data/events.ts` | Historical dilemmas, minimum day/population/divergence triggers, and historical vs. anachronistic choices. |
| `src/data/tutorial.ts` | Narrative introduction text and the 10-step dismissible/navigable **Expedition Guide** (`◀ Back`, `Next ▶`, `Dismiss ✕`). |
| `src/core/mapGenerator.ts` | Deterministic `28×20` coastal & riverine valley generator with guaranteed harvestable deposits. |
| `src/core/simulation.ts` | Pure, deterministic simulation engine: building placement, free first warehouse landing, road flood-fill connectivity, production cycles, need satisfaction, milestone Insight grants, event cooldowns, and win condition checks. |
| `src/core/storage.ts` | `localStorage` save/load persistence (`rewritten_save_v1`). |
| `src/render/canvasRenderer.ts` | HTML5 Canvas 2D renderer with desktop mouse/keyboard controls, mobile 1-finger touch drag/tap & 2-finger pinch-zoom, and `unknown-horizons/gfx`-referenced architectural illustrations. |
| `src/ui/gameUI.ts` | Responsive HUD, categorized build dock, live in-place inspector, collapsible mobile drawer, Future Knowledge modal, Historical Event modal, and Chronicle log. |
| `tests/simulation.test.ts` | Automated Node test suite (`npm test`) covering core simulation rules. |

---

## 3. Economy, Insight & Pacing Rules

### 3.1 How Future Insight (`⏳`) Is Earned
Players have clear, active ways to earn **Future Insight** throughout the game:
1. **Unsealing the Archives Milestone (`+20 Insight`)**: Awarded once basic survival infrastructure (Landing, Lumberjack Camp, Coastal Fishery, and Sawmill) is connected, or when the player reaches the Future Archives step in the Expedition Guide.
2. **Colonial Growth Milestones (`+8 Insight` each, one-time)**:
   - First **Colonial Homestead** upgrade (`milestone_homestead`)
   - First **Stone Quarry** or **Iron Mine** connected (`milestone_mining`)
   - First **Wheat Farm & Bakery** chain connected (`milestone_bread`)
   - First **Time Traveler’s Academy & Press** constructed (`milestone_academy`)
3. **Active Research Recipe at the Time Traveler’s Academy & Press**:
   - **Compile Colonial Field Notes**: Consumes `1 Wood` and produces **`+3 Future Insight`** every `15s` (`+12 Insight/min` per Academy), in addition to its `+3.0/min` passive Insight aura.
4. **Educated Population**:
   - **Pioneers**: `+0.6 Insight/min` per 10 residents
   - **Colonists**: `+1.8 Insight/min` per 10 residents
   - **Innovators**: `+4.5 Insight/min` per 10 residents

### 3.2 Historical Event Pacing
- `SECONDS_PER_DAY = 25` (1 colonial day = 25 seconds at 1x speed).
- `MIN_DAYS_BETWEEN_EVENTS = 8` (at least 8 colonial days must pass after tutorial completion or after resolving a previous event before another historical event can trigger, preventing back-to-back event popups).
- An event only triggers when at least one of its choices is currently affordable.

---

## 4. Roadmap for Future Sessions

When continuing development in a new or existing session, the next logical features to layer in are:
1. **Multi-Tile & Decorative Colonial Structures**: Orchards, town chapels, fortifications, and harbor piers.
2. **Maritime Trade & Atlantic Ships**: A merchant ship arriving periodically at your coastal warehouse pier to barter surplus Planks, Tools, or Medicine for Silver Coin and rare seeds.
3. **Regional Map & Second Settlement**: Expanding along the Chesapeake Bay or inland Piedmont once the first settlement reaches Colonist/Innovator tier.
4. **Expanded Historical Timeline (1620–1700)**: Additional historical forks (e.g., *The Charter of 1624*, *Navigation Acts*, *Early Colonial Printing & Universities*) with branching long-term modifiers.
5. **Sound Effects & Ambient Audio**: Web Audio API procedural colonial ambiance (ocean waves, sawmill rhythm, town bell, forge hammer).
