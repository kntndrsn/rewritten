import { BUILDINGS } from '../data/buildings.ts';
import { TERRAINS } from '../data/terrain.ts';
import { TUTORIAL_STEPS } from '../data/tutorial.ts';
import {
  type GameState,
  type PlacedBuilding,
  canPlaceBuilding,
  canUpgradeHouse,
  getOrthogonalNeighbors,
  getTile
} from '../core/simulation.ts';

export type InteractionTool =
  | { mode: 'select' }
  | { mode: 'build'; defId: string }
  | { mode: 'demolish' };

export interface CameraState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private baseTileSize = 54;
  public camera: CameraState = { offsetX: 80, offsetY: 40, zoom: 1.0 };

  public hoveredTile: { x: number; y: number } | null = null;
  public selectedTile: { x: number; y: number } | null = { x: 7, y: 8 };
  public tool: InteractionTool = { mode: 'select' };

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private keysPressed = new Set<string>();
  private animTime = 0;

  private onTileClickCallback?: (x: number, y: number, button: number) => void;
  private onHoverChangeCallback?: (x: number | null, y: number | null) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not initialize 2D context');
    this.ctx = ctx;

    this.setupEventListeners();
    this.resize();
  }

  public onTileClick(cb: (x: number, y: number, button: number) => void): void {
    this.onTileClickCallback = cb;
  }

  public onHoverChange(cb: (x: number | null, y: number | null) => void): void {
    this.onHoverChangeCallback = cb;
  }

  public centerOnTile(tileX: number, tileY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const ts = this.baseTileSize * this.camera.zoom;
    this.camera.offsetX = rect.width / 2 - (tileX + 0.5) * ts;
    this.camera.offsetY = rect.height / 2 - (tileY + 0.5) * ts;
  }

  public resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keysPressed.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
        this.isPanning = true;
        this.panStartX = e.clientX - this.camera.offsetX;
        this.panStartY = e.clientY - this.camera.offsetY;
        return;
      }

      if (e.button === 0) {
        const coords = this.screenToTile(e.clientX, e.clientY);
        if (coords && this.onTileClickCallback) {
          this.onTileClickCallback(coords.x, coords.y, e.button);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2 && !this.isPanning) {
        // Right-click cancels active build/demolish mode
        if (this.onTileClickCallback && this.hoveredTile) {
          this.onTileClickCallback(this.hoveredTile.x, this.hoveredTile.y, 2);
        }
      }
      this.isPanning = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.camera.offsetX = e.clientX - this.panStartX;
        this.camera.offsetY = e.clientY - this.panStartY;
        return;
      }

      const coords = this.screenToTile(e.clientX, e.clientY);
      const changed =
        coords?.x !== this.hoveredTile?.x || coords?.y !== this.hoveredTile?.y;
      this.hoveredTile = coords;
      if (changed && this.onHoverChangeCallback) {
        this.onHoverChangeCallback(coords ? coords.x : null, coords ? coords.y : null);
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredTile = null;
      if (this.onHoverChangeCallback) {
        this.onHoverChangeCallback(null, null);
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const prevZoom = this.camera.zoom;
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        const nextZoom = Math.max(0.55, Math.min(1.85, prevZoom * zoomFactor));

        // Zoom toward cursor
        const worldX = (mouseX - this.camera.offsetX) / prevZoom;
        const worldY = (mouseY - this.camera.offsetY) / prevZoom;

        this.camera.zoom = nextZoom;
        this.camera.offsetX = mouseX - worldX * nextZoom;
        this.camera.offsetY = mouseY - worldY * nextZoom;
      },
      { passive: false }
    );
  }

  public screenToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const ts = this.baseTileSize * this.camera.zoom;
    const tileX = Math.floor((localX - this.camera.offsetX) / ts);
    const tileY = Math.floor((localY - this.camera.offsetY) / ts);
    return { x: tileX, y: tileY };
  }

  public updateCameraInput(dtSeconds: number): void {
    const panSpeed = 360 * dtSeconds;
    if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) {
      this.camera.offsetY += panSpeed;
    }
    if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) {
      this.camera.offsetY -= panSpeed;
    }
    if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) {
      this.camera.offsetX += panSpeed;
    }
    if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) {
      this.camera.offsetX -= panSpeed;
    }
  }

  public render(state: GameState, dtSeconds: number): void {
    this.animTime += dtSeconds;
    this.updateCameraInput(dtSeconds);

    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Deep ocean background
    ctx.fillStyle = '#0f2537';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const ts = this.baseTileSize * this.camera.zoom;

    // 1. Draw Terrain Tiles
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const px = this.camera.offsetX + x * ts;
        const py = this.camera.offsetY + y * ts;
        if (px + ts < 0 || py + ts < 0 || px > rect.width || py > rect.height) {
          continue;
        }

        const tile = state.tiles[y][x];
        const tDef = TERRAINS[tile.terrain];

        ctx.fillStyle = (x + y) % 2 === 0 ? tDef.color : tDef.secondaryColor;
        ctx.fillRect(px, py, ts + 0.6, ts + 0.6);

        this.drawShorelineBorders(ctx, state, x, y, px, py, ts, tile.terrain);
        this.drawTerrainDetails(ctx, state, x, y, px, py, ts, tile.terrain, tile.decorationSeed);

        // Subtle grid line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, ts, ts);
      }
    }

    // 2. Draw Service Radius Overlay if a service building is selected or being placed
    this.drawServiceRadiusOverlay(ctx, state, ts);

    // 3. Draw Placed Buildings & Roads
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.buildingId) continue;
        const bld = state.buildings[tile.buildingId];
        if (!bld) continue;

        const px = this.camera.offsetX + x * ts;
        const py = this.camera.offsetY + y * ts;
        if (px + ts < 0 || py + ts < 0 || px > rect.width || py > rect.height) continue;

        this.drawBuilding(ctx, state, bld, px, py, ts);
      }
    }

    // 3.5. Draw Tutorial Target Beacons if tutorial is active
    this.drawTutorialHighlights(ctx, state, ts);

    // 4. Draw Selection Highlight
    if (this.selectedTile) {
      const { x, y } = this.selectedTile;
      if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
        const px = this.camera.offsetX + x * ts;
        const py = this.camera.offsetY + y * ts;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1.5, py + 1.5, ts - 3, ts - 3);
      }
    }

    // 5. Draw Hover / Placement Ghost
    if (this.hoveredTile) {
      const { x, y } = this.hoveredTile;
      if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
        const px = this.camera.offsetX + x * ts;
        const py = this.camera.offsetY + y * ts;
        this.drawHoverAndPlacementGhost(ctx, state, x, y, px, py, ts);
      }
    }
  }

  private drawShorelineBorders(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    px: number,
    py: number,
    ts: number,
    terrain: string
  ): void {
    const isWater =
      terrain === 'deep_water' || terrain === 'coastal_water' || terrain === 'river';
    if (isWater) return;

    const band = Math.max(3, ts * 0.09);
    ctx.fillStyle = '#d4be8d';

    const top = getTile(state, x, y - 1);
    const right = getTile(state, x + 1, y);
    const bottom = getTile(state, x, y + 1);
    const left = getTile(state, x - 1, y);

    const checkWater = (t?: { terrain: string }) =>
      Boolean(
        t &&
          (t.terrain === 'deep_water' ||
            t.terrain === 'coastal_water' ||
            t.terrain === 'river')
      );

    if (checkWater(top)) ctx.fillRect(px, py, ts, band);
    if (checkWater(bottom)) ctx.fillRect(px, py + ts - band, ts, band);
    if (checkWater(left)) ctx.fillRect(px, py, band, ts);
    if (checkWater(right)) ctx.fillRect(px + ts - band, py, band, ts);
  }

  private drawTerrainDetails(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    px: number,
    py: number,
    ts: number,
    terrain: string,
    seed: number
  ): void {
    const tile = state.tiles[y][x];
    // Skip tall tree/rock decorations if a building is placed on top
    const hasBuilding = Boolean(tile.buildingId);

    if (terrain === 'deep_water' || terrain === 'coastal_water' || terrain === 'river') {
      const waveOffset = Math.sin(this.animTime * 2 + x * 0.9 + y * 0.7) * (ts * 0.06);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = Math.max(1, ts * 0.03);
      ctx.beginPath();
      ctx.moveTo(px + ts * 0.2, py + ts * 0.45 + waveOffset);
      ctx.quadraticCurveTo(
        px + ts * 0.5,
        py + ts * 0.35 + waveOffset,
        px + ts * 0.78,
        py + ts * 0.45 + waveOffset
      );
      ctx.stroke();

      if (terrain === 'coastal_water' || terrain === 'river') {
        // Subtle fish ripple on some tiles
        if (seed > 0.65 && !hasBuilding) {
          ctx.fillStyle = 'rgba(144, 224, 239, 0.28)';
          ctx.beginPath();
          ctx.arc(px + ts * 0.5, py + ts * 0.62, ts * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    if (terrain === 'fertile_soil' && !hasBuilding) {
      ctx.strokeStyle = 'rgba(233, 196, 106, 0.25)';
      ctx.lineWidth = Math.max(1, ts * 0.035);
      for (let i = 1; i <= 3; i++) {
        const ly = py + (ts * i) / 4;
        ctx.beginPath();
        ctx.moveTo(px + ts * 0.15, ly);
        ctx.lineTo(px + ts * 0.85, ly);
        ctx.stroke();
      }
      return;
    }

    if (terrain === 'forest' && !hasBuilding) {
      const nearLumberjack = getOrthogonalNeighbors(state, x, y).some(
        (n) => n.buildingId && state.buildings[n.buildingId]?.defId === 'lumberjack_hut'
      );
      if (nearLumberjack) {
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(px + ts * 0.66, py + ts * 0.66, ts * 0.16, ts * 0.12);
        ctx.fillStyle = '#d4a373';
        ctx.beginPath();
        ctx.arc(px + ts * 0.74, py + ts * 0.66, ts * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      // Draw 3 layered colonial pines/oaks
      const centers = [
        { cx: 0.32, cy: 0.36, r: 0.2 },
        { cx: 0.68, cy: 0.38, r: 0.19 },
        { cx: 0.5, cy: 0.65, r: 0.23 }
      ];
      for (const tree of centers) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.arc(px + ts * (tree.cx + 0.03), py + ts * (tree.cy + 0.05), ts * tree.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1b4332';
        ctx.beginPath();
        ctx.arc(px + ts * tree.cx, py + ts * tree.cy, ts * tree.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#40916c';
        ctx.beginPath();
        ctx.arc(
          px + ts * (tree.cx - 0.03),
          py + ts * (tree.cy - 0.03),
          ts * (tree.r * 0.65),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      return;
    }

    if ((terrain === 'stone_deposit' || terrain === 'iron_deposit') && !hasBuilding) {
      ctx.fillStyle = terrain === 'stone_deposit' ? '#adb5bd' : '#b5651d';
      ctx.beginPath();
      ctx.moveTo(px + ts * 0.2, py + ts * 0.78);
      ctx.lineTo(px + ts * 0.38, py + ts * 0.25);
      ctx.lineTo(px + ts * 0.65, py + ts * 0.22);
      ctx.lineTo(px + ts * 0.84, py + ts * 0.75);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = terrain === 'stone_deposit' ? '#dee2e6' : '#f4a261';
      ctx.beginPath();
      ctx.arc(px + ts * 0.5, py + ts * 0.48, ts * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBuilding(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    bld: PlacedBuilding,
    px: number,
    py: number,
    ts: number
  ): void {
    const def = BUILDINGS[bld.defId];
    if (!def) return;

    if (def.isRoad) {
      this.drawRoadTile(ctx, state, bld.x, bld.y, px, py, ts);
      return;
    }

    const pad = ts * 0.09;
    const bx = px + pad;
    const by = py + pad;
    const bw = ts - pad * 2;
    const bh = ts - pad * 2;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.fillRect(bx + 2, by + 3, bw, bh);

    // Roof / border accent
    const activeRecipe = def.recipes?.find((r) => r.id === bld.activeRecipeId);
    const isAnachronisticActive = Boolean(
      activeRecipe?.isAnachronistic || def.category === 'temporal'
    );

    // Unknown Horizons-inspired colonial architectural illustration
    this.drawColonialArchitecture(ctx, bld, bx, by, bw, bh, px, py, ts, isAnachronisticActive);

    ctx.strokeStyle = isAnachronisticActive ? '#c084fc' : def.accentColor;
    ctx.lineWidth = isAnachronisticActive ? 2.2 : 1.5;
    ctx.strokeRect(bx, by, bw, bh);

    if (
      bld.status === 'working' &&
      (bld.defId === 'bakery' || bld.defId === 'blacksmith' || bld.defId === 'apothecary')
    ) {
      this.drawChimneySmoke(ctx, px + ts * 0.74, py + ts * 0.22, ts, isAnachronisticActive);
    }

    // Building Icon badge
    ctx.font = `${Math.floor(ts * 0.26)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(def.icon, px + ts * 0.73, py + ts * 0.3);

    // Production progress bar at bottom of building
    if (def.recipes && def.recipes.length > 0 && activeRecipe) {
      const ratio = Math.min(1, Math.max(0, bld.progressSeconds / activeRecipe.cycleSeconds));
      const barX = bx + 3;
      const barY = by + bh - 6;
      const barW = bw - 6;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle =
        bld.status === 'working'
          ? isAnachronisticActive
            ? '#c084fc'
            : '#4ade80'
          : '#f59e0b';
      ctx.fillRect(barX, barY, barW * ratio, 4);
    }

    // Housing resident count & upgrade indicator
    if (def.housing) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(bx + 2, by + bh - 12, bw - 4, 10);
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${Math.max(8, Math.floor(ts * 0.17))}px system-ui, sans-serif`;
      ctx.fillText(
        `${Math.floor(bld.residents)}/${def.housing.capacity}`,
        px + ts * 0.5,
        by + bh - 7
      );

      const upg = canUpgradeHouse(state, bld.id);
      if (upg.valid) {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(px + ts - pad - 4, py + pad + 4, ts * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#052e16';
        ctx.font = `bold ${Math.max(8, Math.floor(ts * 0.16))}px system-ui, sans-serif`;
        ctx.fillText('▲', px + ts - pad - 4, py + pad + 4.5);
      }
    }

    // Status warning badge (no road, missing inputs, paused)
    if (bld.status === 'no_road' || bld.status === 'missing_inputs' || bld.status === 'paused') {
      ctx.fillStyle = bld.status === 'paused' ? '#64748b' : '#ef4444';
      ctx.beginPath();
      ctx.arc(px + pad + 5, py + pad + 5, ts * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(8, Math.floor(ts * 0.16))}px system-ui, sans-serif`;
      ctx.fillText(bld.status === 'paused' ? '⏸' : '!', px + pad + 5, py + pad + 5.5);
    }
  }

  private drawColonialArchitecture(
    ctx: CanvasRenderingContext2D,
    bld: PlacedBuilding,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    px: number,
    py: number,
    ts: number,
    isAnachronistic: boolean
  ): void {
    const def = BUILDINGS[bld.defId];
    ctx.fillStyle = def.color;
    ctx.fillRect(bx, by, bw, bh);

    switch (bld.defId) {
      case 'founding_camp': {
        ctx.fillStyle = '#cbb389';
        ctx.fillRect(bx + 2, by + bh * 0.55, bw - 4, bh * 0.42);
        ctx.fillStyle = '#2b4562';
        ctx.fillRect(bx + 4, by + bh * 0.22, bw - 8, bh * 0.48);
        ctx.fillStyle = '#456990';
        ctx.beginPath();
        ctx.moveTo(bx + 2, by + bh * 0.35);
        ctx.lineTo(px + ts * 0.5, by + 4);
        ctx.lineTo(bx + bw - 2, by + bh * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#a36836';
        ctx.fillRect(bx + 6, by + bh * 0.68, bw * 0.22, bh * 0.2);
        ctx.fillRect(bx + bw * 0.34, by + bh * 0.7, bw * 0.2, bh * 0.18);
        break;
      }
      case 'market_square': {
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
        ctx.fillStyle = '#e76f51';
        ctx.fillRect(bx + 4, by + 5, bw * 0.44, bh * 0.34);
        ctx.fillStyle = '#f4f1de';
        ctx.fillRect(bx + 4 + bw * 0.14, by + 5, bw * 0.14, bh * 0.34);
        ctx.fillStyle = '#2a9d8f';
        ctx.fillRect(bx + 5, by + bh * 0.52, bw * 0.42, bh * 0.32);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(px + ts * 0.62, py + ts * 0.6, ts * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'pioneer_cabin':
      case 'colonial_homestead':
      case 'enlightened_manor': {
        const wallColor =
          bld.defId === 'pioneer_cabin'
            ? '#7f5539'
            : bld.defId === 'colonial_homestead'
              ? '#e6ccb2'
              : '#d8e2dc';
        const roofColor =
          bld.defId === 'pioneer_cabin'
            ? '#9c6644'
            : bld.defId === 'colonial_homestead'
              ? '#9e2a2b'
              : '#4a4e69';
        ctx.fillStyle = wallColor;
        ctx.fillRect(bx + bw * 0.12, by + bh * 0.38, bw * 0.68, bh * 0.4);
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.06, by + bh * 0.42);
        ctx.lineTo(px + ts * 0.42, by + bh * 0.12);
        ctx.lineTo(bx + bw * 0.82, by + bh * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(bx + bw * 0.22, by + bh * 0.48, bw * 0.14, bh * 0.14);
        ctx.fillRect(bx + bw * 0.48, by + bh * 0.48, bw * 0.14, bh * 0.14);
        break;
      }
      case 'lumberjack_hut': {
        ctx.fillStyle = '#583101';
        ctx.fillRect(bx + 4, by + bh * 0.25, bw * 0.52, bh * 0.45);
        ctx.fillStyle = '#bc6c25';
        ctx.fillRect(bx + bw * 0.56, by + bh * 0.54, bw * 0.34, bh * 0.12);
        ctx.fillRect(bx + bw * 0.58, by + bh * 0.42, bw * 0.3, bh * 0.1);
        break;
      }
      case 'sawmill': {
        ctx.fillStyle = '#7f4f24';
        ctx.fillRect(bx + 4, by + bh * 0.28, bw * 0.55, bh * 0.48);
        const angle = bld.status === 'working' ? this.animTime * 3.5 : 0;
        const wx = bx + bw * 0.68;
        const wy = by + bh * 0.58;
        const wr = ts * 0.13;
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(angle);
        ctx.strokeStyle = isAnachronistic ? '#e9d5ff' : '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, wr, 0, Math.PI * 2);
        ctx.moveTo(-wr, 0);
        ctx.lineTo(wr, 0);
        ctx.moveTo(0, -wr);
        ctx.lineTo(0, wr);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'fishery': {
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(bx + 2, by + bh * 0.52, bw - 4, bh * 0.32);
        ctx.fillStyle = '#1d3557';
        ctx.fillRect(bx + 5, by + bh * 0.2, bw * 0.52, bh * 0.42);
        break;
      }
      case 'wheat_farm': {
        ctx.fillStyle = '#eab308';
        for (let r = 0; r < 3; r++) {
          ctx.fillRect(bx + 4, by + bh * (0.38 + r * 0.16), bw - 8, bh * 0.1);
        }
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(bx + 4, by + 4, bw * 0.42, bh * 0.28);
        break;
      }
      case 'bakery': {
        ctx.fillStyle = '#9a3412';
        ctx.fillRect(bx + 5, by + bh * 0.32, bw * 0.56, bh * 0.46);
        const sailAngle = bld.status === 'working' ? this.animTime * 2.2 : 0.4;
        const sx = bx + bw * 0.34;
        const sy = by + bh * 0.36;
        const sr = ts * 0.17;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sailAngle);
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-sr, 0);
        ctx.lineTo(sr, 0);
        ctx.moveTo(0, -sr);
        ctx.lineTo(0, sr);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'blacksmith': {
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(bx + 4, by + bh * 0.26, bw - 8, bh * 0.52);
        ctx.fillStyle = isAnachronistic ? '#c084fc' : '#f97316';
        ctx.beginPath();
        ctx.arc(px + ts * 0.38, py + ts * 0.56, ts * 0.11, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'chronicle_observatory': {
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(bx + 4, by + bh * 0.42, bw - 8, bh * 0.38);
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(px + ts * 0.44, py + ts * 0.44, ts * 0.17, Math.PI, 0);
        ctx.fill();
        break;
      }
      default:
        break;
    }
  }

  private drawChimneySmoke(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    ts: number,
    isAnachronistic: boolean
  ): void {
    for (let i = 0; i < 2; i++) {
      const phase = (this.animTime * 0.9 + i * 0.5) % 1;
      const sx = x + Math.sin(phase * Math.PI * 2) * 3;
      const sy = y - phase * (ts * 0.22);
      const alpha = (1 - phase) * 0.5;
      ctx.fillStyle = isAnachronistic
        ? `rgba(216, 180, 254, ${alpha})`
        : `rgba(226, 232, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, ts * (0.05 + phase * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawTutorialHighlights(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ts: number
  ): void {
    if (!state.tutorialActive || state.tutorialCompleted) return;
    const step = TUTORIAL_STEPS[state.tutorialStepIndex];
    if (!step?.highlightTiles) return;

    const pulse = (Math.sin(this.animTime * 4) + 1) * 0.5;

    for (const target of step.highlightTiles) {
      const px = this.camera.offsetX + target.x * ts;
      const py = this.camera.offsetY + target.y * ts;

      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.55 + pulse * 0.45})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
      ctx.restore();

      if (target.label && this.camera.zoom >= 0.75) {
        ctx.font = 'bold 10px system-ui, sans-serif';
        const tw = ctx.measureText(target.label).width;
        const bx = px + ts * 0.5 - (tw + 8) * 0.5;
        const by = py - 16;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(bx, by, tw + 8, 14);
        ctx.fillStyle = '#fde047';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(target.label, px + ts * 0.5, by + 7);
      }
    }
  }

  private drawRoadTile(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    px: number,
    py: number,
    ts: number
  ): void {
    const cx = px + ts * 0.5;
    const cy = py + ts * 0.5;
    const roadW = ts * 0.34;

    ctx.fillStyle = '#8d6e63';
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = roadW;
    ctx.lineCap = 'round';

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    let hasConnection = false;
    ctx.beginPath();
    for (const d of dirs) {
      const nb = getTile(state, x + d.dx, y + d.dy);
      if (nb && nb.buildingId) {
        hasConnection = true;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + d.dx * (ts * 0.5), cy + d.dy * (ts * 0.5));
      }
    }
    if (hasConnection) {
      ctx.stroke();
      ctx.strokeStyle = '#a1887f';
      ctx.lineWidth = roadW * 0.65;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#a1887f';
      ctx.beginPath();
      ctx.arc(cx, cy, roadW * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawServiceRadiusOverlay(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ts: number
  ): void {
    let centerTile: { x: number; y: number } | null = null;
    let radius = 0;
    let color = 'rgba(56, 189, 248, 0.18)';
    let stroke = 'rgba(56, 189, 248, 0.7)';

    if (this.tool.mode === 'build' && this.hoveredTile) {
      const def = BUILDINGS[this.tool.defId];
      if (def?.serviceRadius) {
        centerTile = this.hoveredTile;
        radius = def.serviceRadius;
      }
    } else if (this.selectedTile) {
      const tile = getTile(state, this.selectedTile.x, this.selectedTile.y);
      if (tile?.buildingId) {
        const bld = state.buildings[tile.buildingId];
        const def = bld ? BUILDINGS[bld.defId] : undefined;
        if (def?.serviceRadius) {
          centerTile = this.selectedTile;
          radius = def.serviceRadius;
          if (def.serviceType === 'sanitation') {
            color = 'rgba(45, 212, 191, 0.16)';
            stroke = 'rgba(45, 212, 191, 0.75)';
          } else if (def.serviceType === 'knowledge') {
            color = 'rgba(168, 85, 247, 0.16)';
            stroke = 'rgba(168, 85, 247, 0.75)';
          }
        }
      }
    }

    if (!centerTile || radius <= 0) return;

    const cx = this.camera.offsetX + (centerTile.x + 0.5) * ts;
    const cy = this.camera.offsetY + (centerTile.y + 0.5) * ts;
    const rPx = radius * ts;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawHoverAndPlacementGhost(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    px: number,
    py: number,
    ts: number
  ): void {
    if (this.tool.mode === 'select') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      return;
    }

    if (this.tool.mode === 'demolish') {
      const tile = getTile(state, x, y);
      const hasBld = Boolean(tile?.buildingId);
      ctx.fillStyle = hasBld ? 'rgba(239, 68, 68, 0.38)' : 'rgba(148, 163, 184, 0.2)';
      ctx.fillRect(px, py, ts, ts);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      return;
    }

    if (this.tool.mode === 'build') {
      const def = BUILDINGS[this.tool.defId];
      if (!def) return;
      const check = canPlaceBuilding(state, def.id, x, y);

      ctx.fillStyle = check.valid ? 'rgba(34, 197, 94, 0.34)' : 'rgba(239, 68, 68, 0.38)';
      ctx.fillRect(px, py, ts, ts);

      ctx.strokeStyle = check.valid ? '#4ade80' : '#f87171';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);

      ctx.font = `${Math.floor(ts * 0.42)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(def.icon, px + ts * 0.5, py + ts * 0.5);

      if (!check.valid && check.reason) {
        ctx.font = '600 11px system-ui, sans-serif';
        const textWidth = ctx.measureText(check.reason).width;
        const boxW = textWidth + 14;
        const boxX = px + ts * 0.5 - boxW * 0.5;
        const boxY = py - 24;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(boxX, boxY, boxW, 20);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, 20);
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(check.reason, px + ts * 0.5, boxY + 10);
      }
    }
  }
}
