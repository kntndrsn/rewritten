# Rewritten

**Rewritten** is a browser-based Anno-style colonial settlement builder with a time-travel twist. You lead a time-displaced expedition arriving in 1607 coastal Virginia with trunks of future scientific, metallurgical, agricultural, and medical knowledge.

## Core Features (Vertical Slice Prototype)

- **Grid-Based Colonial Settlement & Camera**:
  - Procedural 28×20 coastal and riverine valley map featuring Deep Atlantic Waters, Coastal Shallows, a winding Tidal River, Alluvial Loam floodplains, Old-Growth Timberlands, Granite Outcrops, and Iron Ore Seams.
  - Smooth pan (`WASD` / Arrow keys / Right-click drag) and cursor-centered zoom (Mouse wheel), plus service-radius overlays and placement validation ghosts.
- **Anno-Style Logistics & Production Chains**:
  - Road network flood-fill from your **Temporal Landing & Warehouse**.
  - **Timber** (`Lumberjack Camp`) ➔ **Milled Planks** (`Sawmill`)
  - **Salted Fish** (`Coastal Fishery`)
  - **Wheat Grain** (`Colonial Wheat Farm`) ➔ **Artisan Bread** (`Mill & Bakehouse`)
  - **Cut Stone** (`Stone Quarry`) & **Iron Ore** (`Iron Mine`) ➔ **Precision Tools** (`Blacksmith & Foundry`)
  - **Medicinal Herbs** (`Botanical Herbary`) ➔ **Antiseptic Tonics** (`Sanitation Clinic & Apothecary`)
- **Population Tiers & Escalating Needs**:
  - **Pioneers** (`Pioneer Cabin`) ➔ **Colonists** (`Colonial Homestead`) ➔ **Innovators** (`Enlightened Manor`).
  - Meeting resource and service needs (Fish, Bread, Tools, Medicine, Market Square, Sanitation, Observatory Knowledge) drives happiness, tax revenue (`Coin`), and `Future Insight`.
- **Future Knowledge (`Insight`) & Anachronistic Recipes**:
  - Spend `Insight` in the **Future Knowledge** tree to introduce breakthroughs centuries early (*Rotary Saw & Standardized Joinery*, *Norfolk 4-Course & Seed Drill*, *Germ Theory & Boiled-Water Sanitation*, *Forced-Air Crucible Metallurgy*, *Movable-Type Scientific Press*, *Semaphore Telegraph*).
  - Unlocking breakthroughs automatically upgrades your workshops to high-yield **Anachronistic Recipes**.
- **Historical Events, Butterfly Effects & Paradox Pressure**:
  - Interactive timeline dilemmas (*The Frost of 1609*, *Algonquian Trade Delegation*, *Summer Marsh Fever*, *Royal Charter Commissioner*, *Whispers of Time-Sorcery*) allow you to follow history or intervene with future science.
  - Achieve **Victory ("The Enlightened Commonwealth")** by reaching 75+ Population, 20+ Innovators, and 50%+ Historical Divergence while keeping Paradox Pressure below 70%.

## Running & Testing

```bash
# Build browser bundle into dist/
npm run build

# Run unit tests
npm test

# Start local dev server (http://127.0.0.1:5173)
npm run dev
```
