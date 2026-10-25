import { BUILDINGS } from '../data/buildings.ts';
import { TERRAINS } from '../data/terrain.ts';
import { TUTORIAL_STEPS } from '../data/tutorial.ts';
import {
  type GameState,
  type PlacedBuilding,
  canPlaceBuilding,
  canUpgradeHouse,
  getDynamicTutorialTargets,
  getTile
} from '../core/simulation.ts';
import {
  createLocalProjector,
  drawIsoBuildingModel,
  drawIsoConstructionSite,
  drawIsoNaturalProp,
  drawIsoRoadTile,
  drawIsoTerrainTile,
  fillIsoPoly,
  getTerrainSurfaceW
} from './isoAssets.ts';

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
  private baseTileW = 92;
  private baseTileH = 46;
  private viewportW = 0;
  private viewportH = 0;
  private lastState: GameState | null = null;
  public camera: CameraState = { offsetX: 520, offsetY: 80, zoom: 1.0 };

  public hoveredTile: { x: number; y: number } | null = null;
  public selectedTile: { x: number; y: number } | null = { x: 7, y: 8 };
  public tool: InteractionTool = { mode: 'select' };

  private isPanning = false;
  private panMoved = false;
  private downClientX = 0;
  private downClientY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private isTouchPanning = false;
  private touchMoved = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private lastPinchDist = 0;
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

  private getHalfDims(): { halfW: number; halfH: number } {
    return {
      halfW: (this.baseTileW * this.camera.zoom) * 0.5,
      halfH: (this.baseTileH * this.camera.zoom) * 0.5
    };
  }

  /**
   * Projects a tile's (x, y) center on the w=0 reference plane to screen coordinates.
   */
  public tileCenterToScreen(tileX: number, tileY: number): { cx: number; cy: number } {
    const { halfW, halfH } = this.getHalfDims();
    return {
      cx: this.camera.offsetX + (tileX - tileY) * halfW,
      cy: this.camera.offsetY + (tileX + tileY + 1) * halfH
    };
  }

  public centerOnTile(tileX: number, tileY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.viewportW || 960;
    const height = rect.height || this.viewportH || 640;
    const { halfW, halfH } = this.getHalfDims();
    this.camera.offsetX = width * 0.5 - (tileX - tileY) * halfW;
    this.camera.offsetY = height * 0.5 - (tileX + tileY + 1) * halfH;
  }

  public resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (this.viewportW > 0 && this.viewportH > 0 && width > 0 && height > 0) {
      this.camera.offsetX += (width - this.viewportW) * 0.5;
      this.camera.offsetY += (height - this.viewportH) * 0.5;
    }
    this.viewportW = width;
    this.viewportH = height;
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
        this.panMoved = false;
        this.downClientX = e.clientX;
        this.downClientY = e.clientY;
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
      if (e.button === 2 && !this.panMoved) {
        const coords = this.hoveredTile ?? this.screenToTile(e.clientX, e.clientY);
        if (this.onTileClickCallback && coords) {
          this.onTileClickCallback(coords.x, coords.y, 2);
        }
      }
      this.isPanning = false;
      this.panMoved = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        if (Math.hypot(e.clientX - this.downClientX, e.clientY - this.downClientY) > 4) {
          this.panMoved = true;
        }
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

        const worldX = (mouseX - this.camera.offsetX) / prevZoom;
        const worldY = (mouseY - this.camera.offsetY) / prevZoom;

        this.camera.zoom = nextZoom;
        this.camera.offsetX = mouseX - worldX * nextZoom;
        this.camera.offsetY = mouseY - worldY * nextZoom;
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          this.isTouchPanning = true;
          this.touchMoved = false;
          this.touchStartX = t.clientX;
          this.touchStartY = t.clientY;
          this.panStartX = t.clientX - this.camera.offsetX;
          this.panStartY = t.clientY - this.camera.offsetY;
          this.hoveredTile = this.screenToTile(t.clientX, t.clientY);
        } else if (e.touches.length === 2) {
          this.isTouchPanning = false;
          this.touchMoved = true;
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          this.lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        }
      },
      { passive: true }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && this.isTouchPanning) {
          const t = e.touches[0];
          if (Math.hypot(t.clientX - this.touchStartX, t.clientY - this.touchStartY) > 6) {
            this.touchMoved = true;
          }
          if (this.touchMoved) {
            this.camera.offsetX = t.clientX - this.panStartX;
            this.camera.offsetY = t.clientY - this.panStartY;
          }
        } else if (e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          if (this.lastPinchDist > 10 && dist > 10) {
            const rect = this.canvas.getBoundingClientRect();
            const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
            const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
            const prevZoom = this.camera.zoom;
            const nextZoom = Math.max(0.55, Math.min(1.85, prevZoom * (dist / this.lastPinchDist)));
            const worldX = (midX - this.camera.offsetX) / prevZoom;
            const worldY = (midY - this.camera.offsetY) / prevZoom;
            this.camera.zoom = nextZoom;
            this.camera.offsetX = midX - worldX * nextZoom;
            this.camera.offsetY = midY - worldY * nextZoom;
          }
          this.lastPinchDist = dist;
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchend',
      (e) => {
        if (!this.touchMoved && e.changedTouches.length === 1) {
          if (e.cancelable) {
            e.preventDefault();
          }
          const t = e.changedTouches[0];
          const coords = this.screenToTile(t.clientX, t.clientY);
          this.hoveredTile = coords;
          if (coords && this.onTileClickCallback) {
            this.onTileClickCallback(coords.x, coords.y, 0);
          }
        }
        if (e.touches.length === 0) {
          this.isTouchPanning = false;
          this.lastPinchDist = 0;
        }
      },
      { passive: false }
    );
  }

  public screenToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const { halfW, halfH } = this.getHalfDims();

    const dx = (localX - this.camera.offsetX) / halfW;
    const dy = (localY - this.camera.offsetY) / halfH;
    const gx = (dx + dy) * 0.5;
    const gy = (dy - dx) * 0.5;
    const baseX = Math.floor(gx);
    const baseY = Math.floor(gy);

    if (!this.lastState) {
      return { x: baseX, y: baseY };
    }

    // Refine hit against elevated top diamonds in front-to-back order
    const candidates: Array<{ x: number; y: number }> = [];
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const tx = baseX + ox;
        const ty = baseY + oy;
        if (tx >= 0 && tx < this.lastState.width && ty >= 0 && ty < this.lastState.height) {
          candidates.push({ x: tx, y: ty });
        }
      }
    }
    candidates.sort((a, b) => b.x + b.y - (a.x + a.y));

    for (const c of candidates) {
      const tile = this.lastState.tiles[c.y][c.x];
      const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
      const { cx, cy } = this.tileCenterToScreen(c.x, c.y);
      const surfaceCy = cy - wTop * (2 * halfH);
      const normDist =
        Math.abs(localX - cx) / halfW + Math.abs(localY - surfaceCy) / halfH;
      if (normDist <= 1.0) {
        return c;
      }
    }

    return { x: baseX, y: baseY };
  }

  public updateCameraInput(dtSeconds: number): void {
    const panSpeed = 420 * dtSeconds;
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
    this.lastState = state;
    this.animTime += dtSeconds;
    this.updateCameraInput(dtSeconds);

    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Deep ocean atmospheric backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, rect.height);
    bgGrad.addColorStop(0, '#091929');
    bgGrad.addColorStop(0.5, '#0f2537');
    bgGrad.addColorStop(1, '#081523');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const { halfW, halfH } = this.getHalfDims();
    const maxSum = state.width + state.height - 2;

    // 1. Pass 1: 3D Terrain Blocks (Back-to-Front painter's order)
    for (let sum = 0; sum <= maxSum; sum++) {
      const minX = Math.max(0, sum - (state.height - 1));
      const maxX = Math.min(state.width - 1, sum);
      for (let x = minX; x <= maxX; x++) {
        const y = sum - x;
        const { cx, cy } = this.tileCenterToScreen(x, y);
        if (
          cx + halfW < -60 ||
          cx - halfW > rect.width + 60 ||
          cy + halfH * 2 < -80 ||
          cy - halfH * 2 > rect.height + 80
        ) {
          continue;
        }
        drawIsoTerrainTile(ctx, state, x, y, cx, cy, halfW, halfH, this.animTime);
      }
    }

    // 2. Pass 2: Ground Overlays (Service Radius, Tutorial Highlights, Selection & Hover Diamonds)
    this.drawServiceRadiusOverlay(ctx, state, halfW, halfH);
    this.drawTutorialGroundHighlights(ctx, state, halfW, halfH);

    if (this.selectedTile) {
      const { x, y } = this.selectedTile;
      if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
        this.drawTileDiamondOutline(ctx, state, x, y, halfW, halfH, '#ffd166', 2.6);
      }
    }

    if (this.hoveredTile) {
      const { x, y } = this.hoveredTile;
      if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
        this.drawHoverGroundHighlight(ctx, state, x, y, halfW, halfH);
      }
    }

    // 3. Pass 3: 3D Structures, Roads, Trees, Outcrops, and Placement Ghost (Back-to-Front)
    for (let sum = 0; sum <= maxSum; sum++) {
      const minX = Math.max(0, sum - (state.height - 1));
      const maxX = Math.min(state.width - 1, sum);
      for (let x = minX; x <= maxX; x++) {
        const y = sum - x;
        const { cx, cy } = this.tileCenterToScreen(x, y);
        if (
          cx + halfW < -80 ||
          cx - halfW > rect.width + 80 ||
          cy + halfH * 2 < -120 ||
          cy - halfH * 3.5 > rect.height + 120
        ) {
          continue;
        }

        const tile = state.tiles[y][x];
        const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
        const surfaceCy = cy - wTop * (2 * halfH);

        if (tile.buildingId) {
          const bld = state.buildings[tile.buildingId];
          if (bld) {
            const roofH = this.drawBuilding3D(ctx, state, bld, cx, cy, surfaceCy, halfW, halfH, wTop);
            this.drawBuildingOverlayHUD(ctx, state, bld, cx, surfaceCy, roofH, halfW, halfH);
          }
        } else {
          drawIsoNaturalProp(ctx, state, x, y, cx, cy, halfW, halfH);
        }

        // If hovering in build mode on this tile, render a translucent 3D building ghost in depth order
        if (
          this.tool.mode === 'build' &&
          this.hoveredTile &&
          this.hoveredTile.x === x &&
          this.hoveredTile.y === y &&
          !tile.buildingId
        ) {
          this.drawBuildGhost3D(ctx, state, x, y, cx, cy, halfW, halfH, wTop);
        }
      }
    }

    // 4. Pass 4: Floating Tutorial Callouts & Deposit / Placement Tooltips
    this.drawTutorialFloatingLabels(ctx, state, halfW, halfH);
    this.drawSelectionAndHoverBadges(ctx, state, halfW, halfH);
  }

  private drawTileDiamondOutline(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    halfW: number,
    halfH: number,
    strokeStyle: string,
    lineWidth: number,
    fillStyle?: string
  ): void {
    const tile = state.tiles[y][x];
    const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
    const { cx, cy } = this.tileCenterToScreen(x, y);
    const pt = createLocalProjector(cx, cy, halfW, halfH, wTop + 0.008);
    fillIsoPoly(
      ctx,
      pt,
      [
        [0.03, 0.03, 0],
        [0.97, 0.03, 0],
        [0.97, 0.97, 0],
        [0.03, 0.97, 0]
      ],
      fillStyle ?? 'rgba(0, 0, 0, 0)',
      strokeStyle,
      lineWidth
    );
  }

  private drawBuilding3D(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    bld: PlacedBuilding,
    cx: number,
    cy: number,
    surfaceCy: number,
    halfW: number,
    halfH: number,
    wTop: number
  ): number {
    const def = BUILDINGS[bld.defId];
    if (!def) return 0.4;

    if (def.isRoad) {
      drawIsoRoadTile(ctx, state, bld.x, bld.y, cx, cy, halfW, halfH);
      return 0.1;
    }

    const pt = createLocalProjector(cx, cy, halfW, halfH, wTop);

    if (bld.isConstructed === false) {
      const ratio = Math.min(
        1,
        Math.max(0, (bld.constructionProgressSeconds || 0) / (bld.buildTimeSeconds || 5))
      );
      drawIsoConstructionSite(ctx, pt, ratio);
      return 0.55;
    }

    const activeRecipe = def.recipes?.find((r) => r.id === bld.activeRecipeId);
    const isAnachronisticActive = Boolean(
      activeRecipe?.isAnachronistic || def.category === 'temporal'
    );

    // Anachronistic / Temporal base aura ring on the ground
    if (isAnachronisticActive) {
      fillIsoPoly(
        ctx,
        pt,
        [
          [0.08, 0.08, 0.004],
          [0.92, 0.08, 0.004],
          [0.92, 0.92, 0.004],
          [0.08, 0.92, 0.004]
        ],
        'rgba(192, 132, 252, 0.14)',
        'rgba(192, 132, 252, 0.65)',
        1.4
      );
    }

    const roofH = drawIsoBuildingModel(
      ctx,
      bld,
      pt,
      halfW,
      halfH,
      this.animTime,
      isAnachronisticActive
    );

    if (
      bld.status === 'working' &&
      (bld.defId === 'bakery' ||
        bld.defId === 'blacksmith' ||
        bld.defId === 'apothecary' ||
        bld.defId === 'pioneer_cabin' ||
        bld.defId === 'colonial_homestead')
    ) {
      const smokeTop = surfaceCy - roofH * (2 * halfH) * 0.85;
      this.drawChimneySmoke(ctx, cx + halfW * 0.18, smokeTop, halfH * 2, isAnachronisticActive);
    }

    return roofH;
  }

  private drawBuildingOverlayHUD(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    bld: PlacedBuilding,
    cx: number,
    surfaceCy: number,
    roofH: number,
    halfW: number,
    halfH: number
  ): void {
    const def = BUILDINGS[bld.defId];
    if (!def) return;
    const scale = this.camera.zoom;

    if (bld.isConstructed === false) {
      const ratio = Math.min(
        1,
        Math.max(0, (bld.constructionProgressSeconds || 0) / (bld.buildTimeSeconds || 5))
      );
      const barW = Math.max(24, halfW * 0.9);
      const barX = cx - barW * 0.5;
      const barY = surfaceCy + halfH * 0.35;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(barX, barY, barW * ratio, 5);

      if (!def.isRoad) {
        ctx.font = `${Math.max(12, Math.floor(16 * scale))}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, cx, surfaceCy - halfH * 0.65);
      }
      return;
    }

    if (def.isRoad) return;

    const activeRecipe = def.recipes?.find((r) => r.id === bld.activeRecipeId);
    const isAnachronisticActive = Boolean(
      activeRecipe?.isAnachronistic || def.category === 'temporal'
    );

    // Production progress bar positioned cleanly on the front base of the building
    if (def.recipes && def.recipes.length > 0 && activeRecipe) {
      const ratio = Math.min(1, Math.max(0, bld.progressSeconds / activeRecipe.cycleSeconds));
      const barW = Math.max(22, halfW * 0.72);
      const barX = cx - barW * 0.5;
      const barY = surfaceCy + halfH * 0.14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle =
        bld.status === 'working'
          ? isAnachronisticActive
            ? '#c084fc'
            : '#4ade80'
          : '#f59e0b';
      ctx.fillRect(barX, barY, barW * ratio, 4);
    }

    // Housing resident pill & upgrade indicator
    if (def.housing) {
      const pillW = Math.max(26, halfW * 0.72);
      const pillH = Math.max(11, halfH * 0.44);
      const pillX = cx - pillW * 0.5;
      const pillY = surfaceCy - halfH * 0.08;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.fillRect(pillX, pillY, pillW, pillH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(pillX, pillY, pillW, pillH);

      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${Math.max(8, Math.floor(9.5 * scale))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${Math.floor(bld.residents)}/${def.housing.capacity}`,
        cx,
        pillY + pillH * 0.52
      );

      const upg = canUpgradeHouse(state, bld.id);
      if (upg.valid) {
        const badgeX = cx + halfW * 0.36;
        const badgeY = surfaceCy - roofH * (2 * halfH) * 0.7;
        const r = Math.max(6, halfH * 0.3);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#052e16';
        ctx.font = `bold ${Math.max(8, Math.floor(9 * scale))}px system-ui, sans-serif`;
        ctx.fillText('▲', badgeX, badgeY + 0.5);
      }
    }

    // Status warning badge (no road, no workers, missing inputs, paused)
    if (
      bld.status === 'no_road' ||
      bld.status === 'no_workers' ||
      bld.status === 'missing_inputs' ||
      bld.status === 'paused'
    ) {
      const badgeX = cx - halfW * 0.32;
      const badgeY = surfaceCy - roofH * (2 * halfH) * 0.72;
      const r = Math.max(6, halfH * 0.32);
      ctx.fillStyle = bld.status === 'paused' ? '#64748b' : '#ef4444';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(8, Math.floor(9.5 * scale))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bld.status === 'paused' ? '⏸' : '!', badgeX, badgeY + 0.5);
    }
  }

  private drawChimneySmoke(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    ts: number,
    isAnachronistic: boolean
  ): void {
    for (let i = 0; i < 3; i++) {
      const phase = (this.animTime * 0.75 + i * 0.33) % 1;
      const sx = x + Math.sin(phase * Math.PI * 2) * 4 + phase * 5;
      const sy = y - phase * (ts * 0.34);
      const alpha = (1 - phase) * 0.48;
      ctx.fillStyle = isAnachronistic
        ? `rgba(216, 180, 254, ${alpha})`
        : `rgba(226, 232, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, ts * (0.045 + phase * 0.055), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawTutorialGroundHighlights(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    halfW: number,
    halfH: number
  ): void {
    if (!state.tutorialActive) return;
    const step = TUTORIAL_STEPS[state.tutorialStepIndex];
    if (!step) return;
    const targets = getDynamicTutorialTargets(state, step);
    if (targets.length === 0) return;

    const pulse = (Math.sin(this.animTime * 4) + 1) * 0.5;
    for (const target of targets) {
      if (target.x < 0 || target.x >= state.width || target.y < 0 || target.y >= state.height) {
        continue;
      }
      this.drawTileDiamondOutline(
        ctx,
        state,
        target.x,
        target.y,
        halfW,
        halfH,
        `rgba(250, 204, 21, ${0.65 + pulse * 0.35})`,
        2.4,
        `rgba(250, 204, 21, ${0.12 + pulse * 0.12})`
      );
    }
  }

  private drawTutorialFloatingLabels(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    halfW: number,
    halfH: number
  ): void {
    if (!state.tutorialActive || this.camera.zoom < 0.7) return;
    const step = TUTORIAL_STEPS[state.tutorialStepIndex];
    if (!step) return;
    const targets = getDynamicTutorialTargets(state, step);
    if (targets.length === 0) return;

    const bob = Math.sin(this.animTime * 3.5) * 3;
    for (const target of targets) {
      if (!target.label) continue;
      const tile = getTile(state, target.x, target.y);
      if (!tile) continue;
      const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
      const { cx, cy } = this.tileCenterToScreen(target.x, target.y);
      const surfaceCy = cy - wTop * (2 * halfH);

      ctx.save();
      ctx.font = 'bold 10px system-ui, sans-serif';
      const tw = ctx.measureText(target.label).width;
      const bx = cx - (tw + 10) * 0.5;
      const by = surfaceCy - halfH * 1.45 + bob;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(bx, by, tw + 10, 15);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, tw + 10, 15);
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(target.label, cx, by + 7.5);
      ctx.restore();
    }
  }

  private drawServiceRadiusOverlay(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    halfW: number,
    halfH: number
  ): void {
    let centerTile: { x: number; y: number } | null = null;
    let radius = 0;
    let color = 'rgba(56, 189, 248, 0.14)';
    let stroke = 'rgba(56, 189, 248, 0.78)';

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
            color = 'rgba(45, 212, 191, 0.14)';
            stroke = 'rgba(45, 212, 191, 0.78)';
          } else if (def.serviceType === 'knowledge') {
            color = 'rgba(168, 85, 247, 0.14)';
            stroke = 'rgba(168, 85, 247, 0.78)';
          }
        }
      }
    }

    if (!centerTile || radius <= 0) return;

    const { cx, cy } = this.tileCenterToScreen(centerTile.x, centerTile.y);
    const rx = radius * Math.SQRT2 * halfW;
    const ry = radius * Math.SQRT2 * halfH;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawHoverGroundHighlight(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    halfW: number,
    halfH: number
  ): void {
    if (this.tool.mode === 'select') {
      this.drawTileDiamondOutline(
        ctx,
        state,
        x,
        y,
        halfW,
        halfH,
        'rgba(255, 255, 255, 0.65)',
        1.8,
        'rgba(255, 255, 255, 0.08)'
      );
      return;
    }

    if (this.tool.mode === 'demolish') {
      const tile = getTile(state, x, y);
      const hasBld = Boolean(tile?.buildingId);
      this.drawTileDiamondOutline(
        ctx,
        state,
        x,
        y,
        halfW,
        halfH,
        '#ef4444',
        2.2,
        hasBld ? 'rgba(239, 68, 68, 0.36)' : 'rgba(148, 163, 184, 0.2)'
      );
      return;
    }

    if (this.tool.mode === 'build') {
      const def = BUILDINGS[this.tool.defId];
      if (!def) return;
      const check = canPlaceBuilding(state, def.id, x, y);
      this.drawTileDiamondOutline(
        ctx,
        state,
        x,
        y,
        halfW,
        halfH,
        check.valid ? '#4ade80' : '#f87171',
        2.2,
        check.valid ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.34)'
      );
    }
  }

  private drawBuildGhost3D(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    wTop: number
  ): void {
    if (this.tool.mode !== 'build') return;
    const def = BUILDINGS[this.tool.defId];
    if (!def) return;

    ctx.save();
    ctx.globalAlpha = 0.72;
    if (def.isRoad) {
      drawIsoRoadTile(ctx, state, x, y, cx, cy, halfW, halfH);
    } else {
      const pt = createLocalProjector(cx, cy, halfW, halfH, wTop);
      const ghostBld: PlacedBuilding = {
        id: '__ghost__',
        defId: def.id,
        x,
        y,
        activeRecipeId: def.recipes?.[0]?.id ?? '',
        progressSeconds: 0,
        constructionProgressSeconds: 0,
        buildTimeSeconds: 1,
        isConstructed: true,
        residents: 0,
        paused: false,
        connectedToLogistics: true,
        servicesAvailable: {
          logistics: true,
          market: true,
          sanitation: true,
          knowledge: true
        },
        status: 'working',
        efficiency: 1
      };
      drawIsoBuildingModel(ctx, ghostBld, pt, halfW, halfH, this.animTime, false);
    }
    ctx.restore();
  }

  private drawSelectionAndHoverBadges(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    halfW: number,
    halfH: number
  ): void {
    if (this.selectedTile) {
      const { x, y } = this.selectedTile;
      const selTile = getTile(state, x, y);
      if (
        selTile &&
        !selTile.buildingId &&
        (selTile.terrain === 'stone_deposit' || selTile.terrain === 'iron_deposit')
      ) {
        this.drawTerrainLabelBadge(ctx, state, x, y, selTile.terrain, halfW, halfH);
      }
    }

    if (!this.hoveredTile) return;
    const { x, y } = this.hoveredTile;
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;

    if (this.tool.mode === 'select') {
      const tile = getTile(state, x, y);
      if (
        tile &&
        !tile.buildingId &&
        (tile.terrain === 'stone_deposit' || tile.terrain === 'iron_deposit')
      ) {
        this.drawTerrainLabelBadge(ctx, state, x, y, tile.terrain, halfW, halfH);
      }
      return;
    }

    if (this.tool.mode === 'build') {
      const def = BUILDINGS[this.tool.defId];
      if (!def) return;
      const check = canPlaceBuilding(state, def.id, x, y);
      if (!check.valid && check.reason) {
        const tile = state.tiles[y][x];
        const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
        const { cx, cy } = this.tileCenterToScreen(x, y);
        const surfaceCy = cy - wTop * (2 * halfH);

        ctx.save();
        ctx.font = '600 11px system-ui, sans-serif';
        const textWidth = ctx.measureText(check.reason).width;
        const boxW = textWidth + 14;
        const boxX = cx - boxW * 0.5;
        const boxY = surfaceCy - halfH * 1.5;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(boxX, boxY, boxW, 20);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, 20);
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(check.reason, cx, boxY + 10);
        ctx.restore();
      }
    }
  }

  private drawTerrainLabelBadge(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    x: number,
    y: number,
    terrain: string,
    halfW: number,
    halfH: number
  ): void {
    const tDef = TERRAINS[terrain as keyof typeof TERRAINS];
    if (!tDef) return;
    const tile = state.tiles[y][x];
    const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
    const { cx, cy } = this.tileCenterToScreen(x, y);
    const surfaceCy = cy - wTop * (2 * halfH);

    const icon =
      terrain === 'stone_deposit'
        ? '🪨'
        : terrain === 'iron_deposit'
          ? '⛏️'
          : terrain === 'fertile_soil'
            ? '🌾'
            : terrain === 'forest'
              ? '🌲'
              : '🐟';
    const label = tDef.resourceHint
      ? `${icon} ${tDef.name} (${tDef.resourceHint})`
      : `${icon} ${tDef.name}`;

    ctx.save();
    ctx.font = '600 11px system-ui, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + 14;
    const boxX = cx - boxW * 0.5;
    const boxY = surfaceCy - halfH * 1.65;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, 20);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, 20);
    ctx.fillStyle = '#fef3c7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, boxY + 10);
    ctx.restore();
  }
}

