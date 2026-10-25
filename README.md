# Rewritten

**Rewritten** is a browser-based Anno-style colonial settlement builder with a time-travel twist. You lead a time-displaced expedition arriving in 1607 coastal Virginia with trunks of future scientific, metallurgical, agricultural, and medical knowledge.

## Core Features (Vertical Slice Prototype)

- **Narrative Introduction & Skippable 7-Step Tutorial Walkthrough**:
  - Sets the scene at your May 1607 James River landfall and guides you through establishing basic colonial survival (felling Old-Growth Timber, laying Colonial Cart Roads, casting nets in the Coastal Shallows, sheltering Pioneers, opening a Market Square, and milling Planks) before unsealing the Future Archives.
  - Can be skipped at any point from either the introduction screen or the in-game walkthrough panel.
- **Isometric 3D Colonial Settlement & Camera**:
  - Procedural 28×20 coastal and riverine valley map rendered in a 2:1 isometric projection with 3D terrain elevation slabs, recessed water basins, 3D pine/oak forests, granite outcrops, and iron ore seams.
  - Bespoke 3D-styled isometric architectural models and UI thumbnails for all 17 buildings, inspired by and referencing [unknown-horizons/gfx](https://github.com/unknown-horizons/gfx) (see [`LICENSE`](./LICENSE)).
  - Smooth pan (`WASD` / Arrow keys / Right-click drag) and cursor-centered zoom (Mouse wheel), plus isometric service-radius ellipses, tutorial target beacons, and 3D placement validation ghosts.
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

## Deploying to a Web Server

`npm run build` compiles the entire game into static files inside the `dist/` directory (`index.html`, `styles.css`, and `bundle.js`) with no backend server required.

### Option 1: GitHub Pages (Included Workflow)
A ready-to-use GitHub Actions workflow is included at `.github/workflows/deploy-pages.yml`:
1. In your GitHub repository (`kntndrsn/rewritten`), go to **Settings ➔ Pages**.
2. Under **Build and deployment ➔ Source**, select **GitHub Actions**.
3. Merge this branch into `main` (or go to **Actions ➔ Deploy Rewritten to GitHub Pages ➔ Run workflow** and select this branch).
4. Your game will be live at `https://kntndrsn.github.io/rewritten/`.

### Option 2: Cloudflare Pages, Netlify, or Vercel
Import the `kntndrsn/rewritten` repository and use:
- **Build Command**: `npm run build`
- **Output / Publish Directory**: `dist`

### Option 3: Any Static Web Server (Nginx, Apache, Caddy, S3)
Run `npm run build` and upload the contents of `dist/` (`index.html`, `styles.css`, `bundle.js`) to your web root.

## License & Attribution

See [`LICENSE`](./LICENSE) for details:
- Source code is licensed under the **MIT License**.
- Colonial building architectures, market stall palettes, and terrain visual designs reference **[unknown-horizons/gfx](https://github.com/unknown-horizons/gfx)** by the Unknown Horizons project and contributors under **CC BY-SA 3.0**.

