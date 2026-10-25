import { BUILDINGS } from '../data/buildings.ts';
import { TERRAINS } from '../data/terrain.ts';
import { type GameState, type PlacedBuilding, getOrthogonalNeighbors, getTile } from '../core/simulation.ts';
import type { TerrainType } from '../data/types.ts';

export type Point2D = { x: number; y: number };
export type LocalProjector = (u: number, v: number, w?: number) => Point2D;

export interface BoxColors {
  top: string;
  left: string;
  right: string;
  stroke?: string;
}

/**
 * Returns the normalized top-surface elevation (in units of tileH) for each terrain type.
 */
export function getTerrainSurfaceW(terrain: TerrainType, tileElevation = 0.35): number {
  switch (terrain) {
    case 'deep_water':
      return -0.15;
    case 'coastal_water':
      return -0.1;
    case 'river':
      return -0.09;
    case 'fertile_soil':
      return 0.0;
    case 'grass':
      return 0.02 + (tileElevation - 0.35) * 0.05;
    case 'forest':
      return 0.04 + (tileElevation - 0.35) * 0.06;
    case 'stone_deposit':
      return 0.11;
    case 'iron_deposit':
      return 0.13;
    default:
      return 0;
  }
}

/**
 * Creates a projector from local tile coordinates (u in [0,1], v in [0,1], w = vertical height)
 * to screen coordinates.
 * (u=0, v=0) is the North (top) vertex; (u=1, v=0) is East (right);
 * (u=1, v=1) is South (bottom); (u=0, v=1) is West (left).
 */
export function createLocalProjector(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  baseW = 0
): LocalProjector {
  const topX = cx;
  const topY = cy - halfH - baseW * (2 * halfH);
  const tileH = 2 * halfH;
  return (u: number, v: number, w = 0): Point2D => ({
    x: topX + (u - v) * halfW,
    y: topY + (u + v) * halfH - w * tileH
  });
}

export function fillIsoPoly(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  coords: Array<[number, number, number]>,
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 0.8
): void {
  if (coords.length === 0) return;
  ctx.beginPath();
  const first = pt(coords[0][0], coords[0][1], coords[0][2]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < coords.length; i++) {
    const p = pt(coords[i][0], coords[i][1], coords[i][2]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draws an axis-aligned 3D isometric box spanning [u0, u1] x [v0, v1] x [w0, w1].
 */
export function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  u0: number,
  v0: number,
  w0: number,
  u1: number,
  v1: number,
  w1: number,
  colors: BoxColors
): void {
  const stroke = colors.stroke ?? 'rgba(15, 23, 42, 0.28)';
  // Left-front face (v = v1, facing SW)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v1, w0],
      [u1, v1, w0],
      [u1, v1, w1],
      [u0, v1, w1]
    ],
    colors.left,
    stroke
  );
  // Right-front face (u = u1, facing SE)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u1, v1, w0],
      [u1, v0, w0],
      [u1, v0, w1],
      [u1, v1, w1]
    ],
    colors.right,
    stroke
  );
  // Top face (w = w1)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v0, w1],
      [u1, v0, w1],
      [u1, v1, w1],
      [u0, v1, w1]
    ],
    colors.top,
    stroke
  );
}

/**
 * Draws a 3D gable roof whose ridge runs along the U axis (NW to SE),
 * with the sunlit roof slope facing SW (left-front) and the triangular gable wall facing SE (right-front).
 */
export function drawIsoGableRoofU(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  wBase: number,
  wPeak: number,
  colors: {
    frontSlope: string;
    backSlope: string;
    gableWall: string;
    stroke?: string;
  }
): void {
  const vMid = (v0 + v1) * 0.5;
  const stroke = colors.stroke ?? 'rgba(15, 23, 42, 0.32)';

  // Back-right slope (v0 to vMid)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v0, wBase],
      [u1, v0, wBase],
      [u1, vMid, wPeak],
      [u0, vMid, wPeak]
    ],
    colors.backSlope,
    stroke
  );

  // Gable triangle on the SE (u1) face
  fillIsoPoly(
    ctx,
    pt,
    [
      [u1, v0, wBase],
      [u1, v1, wBase],
      [u1, vMid, wPeak]
    ],
    colors.gableWall,
    stroke
  );

  // Front-left sunlit slope (vMid to v1)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, vMid, wPeak],
      [u1, vMid, wPeak],
      [u1, v1, wBase],
      [u0, v1, wBase]
    ],
    colors.frontSlope,
    stroke
  );
}

/**
 * Draws a 3D gable roof whose ridge runs along the V axis (NE to SW),
 * with the triangular gable wall facing SW (left-front) and the shaded roof slope facing SE (right-front).
 */
export function drawIsoGableRoofV(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  wBase: number,
  wPeak: number,
  colors: {
    leftSlope: string;
    rightSlope: string;
    gableWall: string;
    stroke?: string;
  }
): void {
  const uMid = (u0 + u1) * 0.5;
  const stroke = colors.stroke ?? 'rgba(15, 23, 42, 0.32)';

  // Back-left slope (u0 to uMid)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v0, wBase],
      [uMid, v0, wPeak],
      [uMid, v1, wPeak],
      [u0, v1, wBase]
    ],
    colors.leftSlope,
    stroke
  );

  // Gable triangle on the SW (v1) face
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v1, wBase],
      [u1, v1, wBase],
      [uMid, v1, wPeak]
    ],
    colors.gableWall,
    stroke
  );

  // Front-right shaded slope (uMid to u1)
  fillIsoPoly(
    ctx,
    pt,
    [
      [uMid, v0, wPeak],
      [u1, v0, wBase],
      [u1, v1, wBase],
      [uMid, v1, wPeak]
    ],
    colors.rightSlope,
    stroke
  );
}

/**
 * Draws a 4-sided pyramid or hipped roof meeting at a center apex (or short ridge).
 */
export function drawIsoPyramidRoof(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  wBase: number,
  wPeak: number,
  colors: {
    left: string;
    right: string;
    backLeft: string;
    backRight: string;
    stroke?: string;
  }
): void {
  const uMid = (u0 + u1) * 0.5;
  const vMid = (v0 + v1) * 0.5;
  const stroke = colors.stroke ?? 'rgba(15, 23, 42, 0.3)';

  // Back-left face (v = v0)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v0, wBase],
      [u1, v0, wBase],
      [uMid, vMid, wPeak]
    ],
    colors.backRight,
    stroke
  );

  // Back-west face (u = u0)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v0, wBase],
      [u0, v1, wBase],
      [uMid, vMid, wPeak]
    ],
    colors.backLeft,
    stroke
  );

  // Front-left face (v = v1, sunlit)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0, v1, wBase],
      [u1, v1, wBase],
      [uMid, vMid, wPeak]
    ],
    colors.left,
    stroke
  );

  // Front-right face (u = u1, shaded)
  fillIsoPoly(
    ctx,
    pt,
    [
      [u1, v1, wBase],
      [u1, v0, wBase],
      [uMid, vMid, wPeak]
    ],
    colors.right,
    stroke
  );
}

/**
 * Draws a vertical 3D cylinder in isometric space.
 */
export function drawIsoCylinder(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  halfW: number,
  halfH: number,
  uc: number,
  vc: number,
  radius: number,
  w0: number,
  w1: number,
  colors: {
    top: string;
    left: string;
    right: string;
    stroke?: string;
  }
): void {
  const bot = pt(uc, vc, w0);
  const top = pt(uc, vc, w1);
  const rx = radius * Math.SQRT2 * halfW;
  const ry = radius * Math.SQRT2 * halfH;

  const grad = ctx.createLinearGradient(bot.x - rx, bot.y, bot.x + rx, bot.y);
  grad.addColorStop(0, colors.left);
  grad.addColorStop(0.45, colors.left);
  grad.addColorStop(1, colors.right);

  ctx.beginPath();
  ctx.moveTo(top.x - rx, top.y);
  ctx.lineTo(bot.x - rx, bot.y);
  ctx.ellipse(bot.x, bot.y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(top.x + rx, top.y);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  if (colors.stroke) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Top ellipse cap
  ctx.beginPath();
  ctx.ellipse(top.x, top.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.top;
  ctx.fill();
  if (colors.stroke) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/**
 * Draws a 3D cone in isometric space (great for conifers, spires, silo caps).
 */
export function drawIsoCone(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  halfW: number,
  halfH: number,
  uc: number,
  vc: number,
  radius: number,
  wBase: number,
  wPeak: number,
  leftColor: string,
  rightColor: string
): void {
  const base = pt(uc, vc, wBase);
  const peak = pt(uc, vc, wPeak);
  const rx = radius * Math.SQRT2 * halfW;
  const ry = radius * Math.SQRT2 * halfH;

  const grad = ctx.createLinearGradient(base.x - rx, base.y, base.x + rx, base.y);
  grad.addColorStop(0, leftColor);
  grad.addColorStop(0.52, leftColor);
  grad.addColorStop(1, rightColor);

  ctx.beginPath();
  ctx.moveTo(peak.x, peak.y);
  ctx.lineTo(base.x - rx, base.y);
  ctx.ellipse(base.x, base.y, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Draws a soft isometric drop shadow on the ground plane (w = 0).
 */
export function drawFootprintShadow(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  alpha = 0.28
): void {
  fillIsoPoly(
    ctx,
    pt,
    [
      [u0 + 0.03, v0 + 0.02, 0.002],
      [Math.min(0.99, u1 + 0.09), v0 + 0.02, 0.002],
      [Math.min(0.99, u1 + 0.09), Math.min(0.99, v1 + 0.07), 0.002],
      [u0 + 0.03, Math.min(0.99, v1 + 0.07), 0.002]
    ],
    `rgba(8, 15, 28, ${alpha})`
  );
}

/**
 * Draws a 3D isometric terrain tile block (left cliff wall, right cliff wall, top diamond, and shorelines).
 */
export function drawIsoTerrainTile(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  y: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  animTime: number
): void {
  const tile = state.tiles[y][x];
  const terrain = tile.terrain;
  const tDef = TERRAINS[terrain];
  const wTop = getTerrainSurfaceW(terrain, tile.elevation);
  const wBottom = -0.34;
  const pt = createLocalProjector(cx, cy, halfW, halfH, 0);

  const isWater =
    terrain === 'deep_water' || terrain === 'coastal_water' || terrain === 'river';

  // Determine colors for top, left cliff, and right cliff
  const isEven = (x + y) % 2 === 0;
  let topColor = isEven ? tDef.color : tDef.secondaryColor;
  let leftWallColor = '#5c4738';
  let rightWallColor = '#3f2e21';

  if (isWater) {
    const waveShimmer = Math.sin(animTime * 1.8 + x * 0.7 + y * 0.6) * 0.04;
    if (terrain === 'deep_water') {
      topColor = isEven ? '#153956' : '#1b4567';
      leftWallColor = '#0d263b';
      rightWallColor = '#081b2b';
    } else if (terrain === 'coastal_water') {
      topColor = isEven ? '#226089' : '#296f9c';
      leftWallColor = '#174463';
      rightWallColor = '#11334a';
    } else {
      topColor = isEven ? '#28739e' : '#3183b2';
      leftWallColor = '#1b5070';
      rightWallColor = '#143c54';
    }
    const wWave = wTop + waveShimmer * 0.25;
    drawIsoBox(ctx, pt, 0, 0, wBottom, 1, 1, wWave, {
      top: topColor,
      left: leftWallColor,
      right: rightWallColor,
      stroke: 'rgba(144, 224, 239, 0.08)'
    });

    // Subtle animated specular wave lines on the water diamond
    const waveShift = Math.sin(animTime * 2.2 + x * 0.9 + y * 0.7) * 0.06;
    const p1 = pt(0.22, 0.45 + waveShift, wWave + 0.005);
    const p2 = pt(0.5, 0.36 + waveShift, wWave + 0.005);
    const p3 = pt(0.76, 0.48 + waveShift, wWave + 0.005);
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.24)';
    ctx.lineWidth = Math.max(1, halfH * 0.06);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);
    ctx.stroke();

    // Secondary smaller ripple
    const p4 = pt(0.32, 0.68 - waveShift, wWave + 0.005);
    const p5 = pt(0.64, 0.66 - waveShift, wWave + 0.005);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.16)';
    ctx.beginPath();
    ctx.moveTo(p4.x, p4.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.stroke();

    // Fish school ripple in coastal water or river
    if (
      (terrain === 'coastal_water' || terrain === 'river') &&
      tile.decorationSeed > 0.65 &&
      !tile.buildingId
    ) {
      const fishCenter = pt(0.52, 0.55, wWave + 0.006);
      const pulse = 0.85 + Math.sin(animTime * 3 + x) * 0.2;
      ctx.strokeStyle = 'rgba(144, 224, 239, 0.38)';
      ctx.lineWidth = Math.max(1, halfH * 0.05);
      ctx.beginPath();
      ctx.ellipse(
        fishCenter.x,
        fishCenter.y,
        halfW * 0.16 * pulse,
        halfH * 0.16 * pulse,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    return;
  }

  // Check if neighboring tiles are water for sandy beach / shoreline bevels
  const nbSouth = getTile(state, x, y + 1); // v = 1 neighbor
  const nbEast = getTile(state, x + 1, y); // u = 1 neighbor
  const nbNorth = getTile(state, x, y - 1); // v = 0 neighbor
  const nbWest = getTile(state, x - 1, y); // u = 0 neighbor

  const isWaterTile = (t?: { terrain: TerrainType }) =>
    Boolean(
      t &&
        (t.terrain === 'deep_water' ||
          t.terrain === 'coastal_water' ||
          t.terrain === 'river')
    );

  if (terrain === 'stone_deposit') {
    leftWallColor = '#64748b';
    rightWallColor = '#475569';
  } else if (terrain === 'iron_deposit') {
    leftWallColor = '#6b4c3e';
    rightWallColor = '#4a3329';
  } else if (isWaterTile(nbSouth) || isWaterTile(nbEast)) {
    leftWallColor = isWaterTile(nbSouth) ? '#bfa573' : '#6c533c';
    rightWallColor = isWaterTile(nbEast) ? '#9e8454' : '#4d3a29';
  }

  // Draw the 3D land block
  drawIsoBox(ctx, pt, 0, 0, wBottom, 1, 1, wTop, {
    top: topColor,
    left: leftWallColor,
    right: rightWallColor,
    stroke: 'rgba(255, 255, 255, 0.07)'
  });

  // Top turf/lip bevel on the two front edges so the 3D block has a crisp grass/stone rim
  const lipThickness = 0.035;
  const lipLeft =
    terrain === 'stone_deposit'
      ? '#94a3b8'
      : terrain === 'iron_deposit'
        ? '#8d5b4c'
        : terrain === 'fertile_soil'
          ? '#5f7f35'
          : '#3f6a38';
  const lipRight =
    terrain === 'stone_deposit'
      ? '#64748b'
      : terrain === 'iron_deposit'
        ? '#6d4437'
        : terrain === 'fertile_soil'
          ? '#4b6628'
          : '#2f5229';

  fillIsoPoly(
    ctx,
    pt,
    [
      [0, 1, wTop - lipThickness],
      [1, 1, wTop - lipThickness],
      [1, 1, wTop],
      [0, 1, wTop]
    ],
    lipLeft
  );
  fillIsoPoly(
    ctx,
    pt,
    [
      [1, 1, wTop - lipThickness],
      [1, 0, wTop - lipThickness],
      [1, 0, wTop],
      [1, 1, wTop]
    ],
    lipRight
  );

  // Sandy shoreline bands along edges bordering water
  const sandColor = '#d9c398';
  const band = 0.12;
  if (isWaterTile(nbNorth)) {
    fillIsoPoly(
      ctx,
      pt,
      [
        [0, 0, wTop + 0.001],
        [1, 0, wTop + 0.001],
        [1, band, wTop + 0.001],
        [0, band, wTop + 0.001]
      ],
      sandColor
    );
  }
  if (isWaterTile(nbSouth)) {
    fillIsoPoly(
      ctx,
      pt,
      [
        [0, 1 - band, wTop + 0.001],
        [1, 1 - band, wTop + 0.001],
        [1, 1, wTop + 0.001],
        [0, 1, wTop + 0.001]
      ],
      sandColor
    );
  }
  if (isWaterTile(nbWest)) {
    fillIsoPoly(
      ctx,
      pt,
      [
        [0, 0, wTop + 0.001],
        [band, 0, wTop + 0.001],
        [band, 1, wTop + 0.001],
        [0, 1, wTop + 0.001]
      ],
      sandColor
    );
  }
  if (isWaterTile(nbEast)) {
    fillIsoPoly(
      ctx,
      pt,
      [
        [1 - band, 0, wTop + 0.001],
        [1, 0, wTop + 0.001],
        [1, 1, wTop + 0.001],
        [1 - band, 1, wTop + 0.001]
      ],
      sandColor
    );
  }

  // Fertile soil 3D furrows on empty fertile_soil tiles
  if (terrain === 'fertile_soil' && !tile.buildingId) {
    for (let i = 1; i <= 3; i++) {
      const vRow = i * 0.24;
      drawIsoBox(ctx, pt, 0.16, vRow - 0.03, wTop, 0.84, vRow + 0.03, wTop + 0.025, {
        top: '#8ab054',
        left: '#5c7a32',
        right: '#476025'
      });
    }
  }

  // Subtle meadow grass blades on empty grass tiles
  if (terrain === 'grass' && !tile.buildingId && tile.decorationSeed > 0.35) {
    const uG = 0.28 + (tile.decorationSeed * 1.7) % 0.45;
    const vG = 0.28 + (tile.decorationSeed * 2.3) % 0.45;
    const pG = pt(uG, vG, wTop);
    ctx.strokeStyle = '#6da362';
    ctx.lineWidth = Math.max(1, halfH * 0.06);
    ctx.beginPath();
    ctx.moveTo(pG.x, pG.y);
    ctx.lineTo(pG.x - halfW * 0.04, pG.y - halfH * 0.14);
    ctx.moveTo(pG.x, pG.y);
    ctx.lineTo(pG.x + halfW * 0.04, pG.y - halfH * 0.12);
    ctx.stroke();
  }
}

/**
 * Draws 3D natural features (forest trees, stumps, granite crags, iron ore veins) on unbuilt tiles.
 */
export function drawIsoNaturalProp(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  y: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number
): void {
  const tile = state.tiles[y][x];
  if (tile.buildingId) return;

  const terrain = tile.terrain;
  const wTop = getTerrainSurfaceW(terrain, tile.elevation);
  const pt = createLocalProjector(cx, cy, halfW, halfH, wTop);

  if (terrain === 'forest') {
    const nearLumberjack = getOrthogonalNeighbors(state, x, y).some(
      (n) => n.buildingId && state.buildings[n.buildingId]?.defId === 'lumberjack_hut'
    );

    // Draw 3D trees in back-to-front order inside the tile
    const trees = [
      { u: 0.3, v: 0.28, scale: 0.9, oak: false },
      { u: 0.72, v: 0.32, scale: 0.82, oak: tile.decorationSeed > 0.5 },
      { u: 0.32, v: 0.7, scale: 0.86, oak: tile.decorationSeed <= 0.5 },
      { u: 0.65, v: 0.68, scale: 1.0, oak: false }
    ];

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      if (nearLumberjack && i === 3) {
        // Render a 3D cut tree stump and felled log
        drawIsoCylinder(ctx, pt, halfW, halfH, t.u, t.v, 0.08, 0, 0.1, {
          top: '#ddb892',
          left: '#6c472b',
          right: '#472d18',
          stroke: 'rgba(15, 23, 42, 0.35)'
        });
        continue;
      }

      // Ground shadow
      const sh = pt(t.u + 0.05, t.v + 0.05, 0.002);
      ctx.fillStyle = 'rgba(8, 15, 28, 0.28)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, halfW * 0.19 * t.scale, halfH * 0.19 * t.scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3D Trunk
      drawIsoCylinder(ctx, pt, halfW, halfH, t.u, t.v, 0.045 * t.scale, 0, 0.18 * t.scale, {
        top: '#7f5539',
        left: '#6b4423',
        right: '#432818'
      });

      if (t.oak) {
        // 3D Layered Colonial Oak canopy
        const c1 = pt(t.u, t.v, 0.28 * t.scale);
        const c2 = pt(t.u - 0.03, t.v + 0.02, 0.38 * t.scale);
        const rPx = halfW * 0.22 * t.scale;

        const grad = ctx.createRadialGradient(
          c2.x - rPx * 0.3,
          c2.y - rPx * 0.3,
          rPx * 0.15,
          c1.x,
          c1.y,
          rPx
        );
        grad.addColorStop(0, '#74c69d');
        grad.addColorStop(0.55, '#40916c');
        grad.addColorStop(1, '#1b4332');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c1.x, c1.y, rPx, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 3D Multi-tiered Conifer (3 stacked isometric cones)
        drawIsoCone(
          ctx,
          pt,
          halfW,
          halfH,
          t.u,
          t.v,
          0.18 * t.scale,
          0.12 * t.scale,
          0.38 * t.scale,
          '#2d6a4f',
          '#1b4332'
        );
        drawIsoCone(
          ctx,
          pt,
          halfW,
          halfH,
          t.u,
          t.v,
          0.145 * t.scale,
          0.25 * t.scale,
          0.5 * t.scale,
          '#40916c',
          '#1f4e38'
        );
        drawIsoCone(
          ctx,
          pt,
          halfW,
          halfH,
          t.u,
          t.v,
          0.105 * t.scale,
          0.38 * t.scale,
          0.62 * t.scale,
          '#52b788',
          '#2d6a4f'
        );
      }
    }
    return;
  }

  if (terrain === 'stone_deposit' || terrain === 'iron_deposit') {
    const isStone = terrain === 'stone_deposit';
    drawFootprintShadow(ctx, pt, 0.15, 0.15, 0.85, 0.85, 0.32);

    // Back-left rock spire
    drawIsoBox(ctx, pt, 0.18, 0.18, 0, 0.56, 0.54, 0.28, {
      top: isStone ? '#cbd5e1' : '#a86448',
      left: isStone ? '#94a3b8' : '#7c432b',
      right: isStone ? '#475569' : '#4a2518'
    });
    drawIsoPyramidRoof(ctx, pt, 0.18, 0.18, 0.56, 0.54, 0.28, 0.54, {
      left: isStone ? '#cbd5e1' : '#b86f52',
      right: isStone ? '#64748b' : '#5c3020',
      backLeft: isStone ? '#e2e8f0' : '#d0876a',
      backRight: isStone ? '#94a3b8' : '#7c432b'
    });

    // Main central monolith
    drawIsoBox(ctx, pt, 0.36, 0.32, 0, 0.78, 0.76, 0.36, {
      top: isStone ? '#e2e8f0' : '#c07454',
      left: isStone ? '#94a3b8' : '#8c4c32',
      right: isStone ? '#475569' : '#542a1a'
    });
    drawIsoPyramidRoof(ctx, pt, 0.36, 0.32, 0.78, 0.76, 0.36, 0.64, {
      left: isStone ? '#f1f5f9' : '#d97706',
      right: isStone ? '#64748b' : '#6b341e',
      backLeft: isStone ? '#f8fafc' : '#f59e0b',
      backRight: isStone ? '#94a3b8' : '#8c4c32'
    });

    // Front boulder
    drawIsoBox(ctx, pt, 0.22, 0.58, 0, 0.52, 0.86, 0.2, {
      top: isStone ? '#cbd5e1' : '#e07a5f',
      left: isStone ? '#94a3b8' : '#9c5238',
      right: isStone ? '#475569' : '#5e2e1d'
    });

    // Metallic ore vein glints for iron deposit
    if (!isStone) {
      fillIsoPoly(
        ctx,
        pt,
        [
          [0.44, 0.76, 0.1],
          [0.68, 0.76, 0.22],
          [0.62, 0.76, 0.32],
          [0.4, 0.76, 0.18]
        ],
        '#fbbf24'
      );
    }
  }
}

/**
 * Draws an isometric road tile with 3D raised curbstones and connections to neighboring structures.
 */
export function drawIsoRoadTile(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  y: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number
): void {
  const tile = state.tiles[y][x];
  const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
  const pt = createLocalProjector(cx, cy, halfW, halfH, wTop);

  const nbN = getTile(state, x, y - 1);
  const nbE = getTile(state, x + 1, y);
  const nbS = getTile(state, x, y + 1);
  const nbW = getTile(state, x - 1, y);

  const roadColors: BoxColors = {
    top: '#b09788',
    left: '#7d6053',
    right: '#5d4037',
    stroke: 'rgba(62, 39, 35, 0.22)'
  };

  // Draw road arms first so they merge cleanly into the center hub
  if (nbN?.buildingId) {
    drawIsoBox(ctx, pt, 0.33, 0.0, 0, 0.67, 0.5, 0.028, roadColors);
  }
  if (nbW?.buildingId) {
    drawIsoBox(ctx, pt, 0.0, 0.33, 0, 0.5, 0.67, 0.028, roadColors);
  }
  if (nbS?.buildingId) {
    drawIsoBox(ctx, pt, 0.33, 0.5, 0, 0.67, 1.0, 0.028, roadColors);
  }
  if (nbE?.buildingId) {
    drawIsoBox(ctx, pt, 0.5, 0.33, 0, 1.0, 0.67, 0.028, roadColors);
  }

  // Center hub pad
  drawIsoBox(ctx, pt, 0.31, 0.31, 0, 0.69, 0.69, 0.03, roadColors);

  // Inner cobblestone inlay
  fillIsoPoly(
    ctx,
    pt,
    [
      [0.39, 0.39, 0.032],
      [0.61, 0.39, 0.032],
      [0.61, 0.61, 0.032],
      [0.39, 0.61, 0.032]
    ],
    '#d7ccc8'
  );
}

/**
 * Draws a 3D timber scaffolding & stone foundation site while a building is under construction.
 */
export function drawIsoConstructionSite(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  ratio: number
): void {
  drawFootprintShadow(ctx, pt, 0.14, 0.14, 0.86, 0.86, 0.25);

  // Stone foundation slab
  drawIsoBox(ctx, pt, 0.14, 0.14, 0, 0.86, 0.86, 0.08, {
    top: '#94a3b8',
    left: '#64748b',
    right: '#475569'
  });

  // Rising timber frame box proportional to construction progress
  const h = 0.12 + ratio * 0.42;
  const posts: Array<[number, number]> = [
    [0.18, 0.18],
    [0.8, 0.18],
    [0.8, 0.8],
    [0.18, 0.8]
  ];
  for (const [pu, pv] of posts) {
    drawIsoBox(ctx, pt, pu, pv, 0.08, pu + 0.05, pv + 0.05, h, {
      top: '#fde68a',
      left: '#d97706',
      right: '#92400e'
    });
  }

  // Cross-beams at top of scaffolding
  const beamP1 = pt(0.2, 0.82, h);
  const beamP2 = pt(0.82, 0.82, h);
  const beamP3 = pt(0.82, 0.2, h);
  const beamP4 = pt(0.2, 0.2, h);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(beamP1.x, beamP1.y);
  ctx.lineTo(beamP2.x, beamP2.y);
  ctx.lineTo(beamP3.x, beamP3.y);
  ctx.lineTo(beamP4.x, beamP4.y);
  ctx.closePath();
  ctx.stroke();

  // Lumber stack in the center
  drawIsoBox(ctx, pt, 0.36, 0.42, 0.08, 0.66, 0.64, 0.18, {
    top: '#fcd34d',
    left: '#b45309',
    right: '#78350f'
  });
}

/**
 * Helper to draw small 3D recessed/lit windows on a left-front (v = const) or right-front (u = const) wall.
 */
function drawWallWindows(
  ctx: CanvasRenderingContext2D,
  pt: LocalProjector,
  wall: 'left' | 'right',
  fixedCoord: number,
  positions: number[],
  wBottom: number,
  wTop: number,
  span = 0.09,
  color = '#fef08a'
): void {
  for (const pos of positions) {
    if (wall === 'left') {
      fillIsoPoly(
        ctx,
        pt,
        [
          [pos, fixedCoord + 0.002, wBottom],
          [pos + span, fixedCoord + 0.002, wBottom],
          [pos + span, fixedCoord + 0.002, wTop],
          [pos, fixedCoord + 0.002, wTop]
        ],
        color,
        'rgba(69, 26, 3, 0.6)',
        0.7
      );
    } else {
      fillIsoPoly(
        ctx,
        pt,
        [
          [fixedCoord + 0.002, pos, wBottom],
          [fixedCoord + 0.002, pos + span, wBottom],
          [fixedCoord + 0.002, pos + span, wTop],
          [fixedCoord + 0.002, pos, wTop]
        ],
        color,
        'rgba(69, 26, 3, 0.6)',
        0.7
      );
    }
  }
}

/**
 * Renders the 3D isometric architectural model for any constructed building.
 */
export function drawIsoBuildingModel(
  ctx: CanvasRenderingContext2D,
  bld: PlacedBuilding,
  pt: LocalProjector,
  halfW: number,
  halfH: number,
  animTime: number,
  isAnachronistic: boolean
): number {
  drawFootprintShadow(ctx, pt, 0.12, 0.12, 0.88, 0.88, 0.34);

  switch (bld.defId) {
    case 'founding_camp': {
      // Grand stone foundation plinth
      drawIsoBox(ctx, pt, 0.1, 0.1, 0, 0.9, 0.9, 0.1, {
        top: '#cbd5e1',
        left: '#94a3b8',
        right: '#64748b'
      });
      // Main 2-story colonial storehouse body
      drawIsoBox(ctx, pt, 0.16, 0.16, 0.1, 0.68, 0.82, 0.5, {
        top: '#475569',
        left: '#e2d5b5',
        right: '#b8a682'
      });
      // Timber framing & windows on storehouse
      drawWallWindows(ctx, pt, 'left', 0.82, [0.24, 0.46], 0.24, 0.4, 0.1, '#fde047');
      drawWallWindows(ctx, pt, 'right', 0.68, [0.26, 0.54], 0.24, 0.4, 0.1, '#facc15');

      // Steep blue-slate gable roof
      drawIsoGableRoofU(ctx, pt, 0.13, 0.13, 0.71, 0.85, 0.5, 0.78, {
        frontSlope: '#3d5a80',
        backSlope: '#293d56',
        gableWall: '#cbb892'
      });

      // Temporal Beacon Spire on the NE corner
      drawIsoBox(ctx, pt, 0.64, 0.16, 0.1, 0.86, 0.42, 0.68, {
        top: '#64748b',
        left: '#52799b',
        right: '#324b63'
      });
      drawIsoPyramidRoof(ctx, pt, 0.62, 0.14, 0.88, 0.44, 0.68, 0.94, {
        left: '#38bdf8',
        right: '#0284c7',
        backLeft: '#7dd3fc',
        backRight: '#0369a1'
      });

      // Glowing Temporal Astrolabe Ring above the spire
      const spireTop = pt(0.75, 0.29, 1.0);
      const pulse = 0.85 + Math.sin(animTime * 3.2) * 0.15;
      ctx.save();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(
        spireTop.x,
        spireTop.y,
        halfW * 0.15 * pulse,
        halfH * 0.15 * pulse,
        animTime,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();

      // Wooden cargo crates on the front-right loading deck
      drawIsoBox(ctx, pt, 0.7, 0.54, 0.1, 0.85, 0.7, 0.22, {
        top: '#d97706',
        left: '#b45309',
        right: '#78350f'
      });
      drawIsoBox(ctx, pt, 0.72, 0.72, 0.1, 0.85, 0.85, 0.2, {
        top: '#f59e0b',
        left: '#d97706',
        right: '#92400e'
      });
      return 1.05;
    }

    case 'market_square': {
      // Cobblestone plaza platform
      drawIsoBox(ctx, pt, 0.08, 0.08, 0, 0.92, 0.92, 0.06, {
        top: '#cbd5e1',
        left: '#94a3b8',
        right: '#64748b'
      });

      // Stall 1 (Back-left, Terracotta awning)
      drawIsoBox(ctx, pt, 0.14, 0.16, 0.06, 0.4, 0.44, 0.26, {
        top: '#fef3c7',
        left: '#a16207',
        right: '#713f12'
      });
      drawIsoGableRoofU(ctx, pt, 0.12, 0.14, 0.42, 0.46, 0.26, 0.4, {
        frontSlope: '#e76f51',
        backSlope: '#c2410c',
        gableWall: '#f4a261'
      });

      // Stall 2 (Back-right, Teal awning)
      drawIsoBox(ctx, pt, 0.58, 0.16, 0.06, 0.86, 0.42, 0.26, {
        top: '#fef3c7',
        left: '#a16207',
        right: '#713f12'
      });
      drawIsoGableRoofV(ctx, pt, 0.56, 0.14, 0.88, 0.44, 0.26, 0.4, {
        leftSlope: '#2dd4bf',
        rightSlope: '#0f766e',
        gableWall: '#99f6e4'
      });

      // Central 3D Stone Fountain & Obelisk (drawn after rear stalls and before front stall)
      drawIsoCylinder(ctx, pt, halfW, halfH, 0.5, 0.5, 0.16, 0.06, 0.16, {
        top: '#38bdf8',
        left: '#94a3b8',
        right: '#475569',
        stroke: 'rgba(15, 23, 42, 0.3)'
      });
      drawIsoBox(ctx, pt, 0.45, 0.45, 0.16, 0.55, 0.55, 0.48, {
        top: '#f8fafc',
        left: '#e2e8f0',
        right: '#94a3b8'
      });
      drawIsoPyramidRoof(ctx, pt, 0.44, 0.44, 0.56, 0.56, 0.48, 0.62, {
        left: '#fbbf24',
        right: '#b45309',
        backLeft: '#fde047',
        backRight: '#d97706'
      });

      // Stall 3 (Front-left, Gold/Burgundy awning)
      drawIsoBox(ctx, pt, 0.16, 0.58, 0.06, 0.46, 0.86, 0.26, {
        top: '#fef3c7',
        left: '#a16207',
        right: '#713f12'
      });
      drawIsoGableRoofU(ctx, pt, 0.14, 0.56, 0.48, 0.88, 0.26, 0.4, {
        frontSlope: '#b56576',
        backSlope: '#8338ec',
        gableWall: '#f4a261'
      });
      return 0.66;
    }

    case 'pioneer_cabin': {
      // Stone foundation
      drawIsoBox(ctx, pt, 0.18, 0.2, 0, 0.8, 0.8, 0.06, {
        top: '#94a3b8',
        left: '#64748b',
        right: '#475569'
      });
      // Log cabin walls
      drawIsoBox(ctx, pt, 0.2, 0.22, 0.06, 0.76, 0.78, 0.36, {
        top: '#7f5539',
        left: '#9c6644',
        right: '#6b4423'
      });
      // Warm windows & door
      drawWallWindows(ctx, pt, 'left', 0.78, [0.28, 0.54], 0.15, 0.28, 0.11, '#fde047');
      drawWallWindows(ctx, pt, 'right', 0.76, [0.44], 0.06, 0.24, 0.12, '#451a03');

      // Stone chimney on the right-back wall
      drawIsoBox(ctx, pt, 0.64, 0.2, 0.06, 0.78, 0.34, 0.62, {
        top: '#94a3b8',
        left: '#64748b',
        right: '#475569'
      });

      // Pitched wood-shingle gable roof
      drawIsoGableRoofU(ctx, pt, 0.16, 0.18, 0.8, 0.82, 0.36, 0.58, {
        frontSlope: '#b07d4f',
        backSlope: '#7f5539',
        gableWall: '#8d5b3c'
      });

      // Firewood pile in front
      drawIsoBox(ctx, pt, 0.22, 0.8, 0, 0.42, 0.9, 0.1, {
        top: '#ddb892',
        left: '#7f5539',
        right: '#583101'
      });
      return 0.66;
    }

    case 'colonial_homestead': {
      // Stone plinth
      drawIsoBox(ctx, pt, 0.14, 0.14, 0, 0.86, 0.86, 0.07, {
        top: '#cbd5e1',
        left: '#94a3b8',
        right: '#64748b'
      });
      // Main 2-story half-timbered residence
      drawIsoBox(ctx, pt, 0.16, 0.18, 0.07, 0.68, 0.8, 0.46, {
        top: '#d6ccc2',
        left: '#f2e8cf',
        right: '#d5bdaf'
      });
      // Side brick wing
      drawIsoBox(ctx, pt, 0.68, 0.34, 0.07, 0.86, 0.8, 0.34, {
        top: '#bc4749',
        left: '#e07a5f',
        right: '#9e2a2b'
      });
      drawIsoGableRoofV(ctx, pt, 0.66, 0.32, 0.88, 0.82, 0.34, 0.5, {
        leftSlope: '#bc4749',
        rightSlope: '#8c2327',
        gableWall: '#e6ccb2'
      });

      // Windows on main house
      drawWallWindows(ctx, pt, 'left', 0.8, [0.24, 0.46], 0.14, 0.25, 0.1, '#fef08a');
      drawWallWindows(ctx, pt, 'left', 0.8, [0.24, 0.46], 0.3, 0.41, 0.1, '#fef08a');
      drawWallWindows(ctx, pt, 'right', 0.86, [0.46, 0.64], 0.14, 0.26, 0.09, '#fef08a');

      // Brick chimney
      drawIsoBox(ctx, pt, 0.2, 0.18, 0.46, 0.32, 0.3, 0.78, {
        top: '#9e2a2b',
        left: '#bc4749',
        right: '#780000'
      });

      // Steep red-tile gable roof on main house
      drawIsoGableRoofU(ctx, pt, 0.13, 0.15, 0.71, 0.83, 0.46, 0.74, {
        frontSlope: '#bc4749',
        backSlope: '#780000',
        gableWall: '#e6ccb2'
      });
      return 0.8;
    }

    case 'enlightened_manor': {
      // Grand terraced stone courtyard
      drawIsoBox(ctx, pt, 0.08, 0.08, 0, 0.92, 0.92, 0.09, {
        top: '#e2e8f0',
        left: '#94a3b8',
        right: '#64748b'
      });
      // Symmetrical 2.5-story Georgian stone mansion
      drawIsoBox(ctx, pt, 0.14, 0.14, 0.09, 0.84, 0.78, 0.56, {
        top: '#cbd5e1',
        left: '#f1f5f9',
        right: '#cbd5e1'
      });
      // Classical front portico with columns on SW face
      drawIsoBox(ctx, pt, 0.34, 0.78, 0.09, 0.64, 0.89, 0.46, {
        top: '#e2e8f0',
        left: '#ffffff',
        right: '#cbd5e1'
      });
      drawIsoGableRoofV(ctx, pt, 0.32, 0.76, 0.66, 0.91, 0.46, 0.6, {
        leftSlope: '#6d597a',
        rightSlope: '#4a4e69',
        gableWall: '#f8fafc'
      });

      // Tall arched windows
      drawWallWindows(ctx, pt, 'left', 0.78, [0.18, 0.7], 0.16, 0.32, 0.08, '#fde047');
      drawWallWindows(ctx, pt, 'left', 0.78, [0.18, 0.7], 0.36, 0.5, 0.08, '#fde047');
      drawWallWindows(ctx, pt, 'right', 0.84, [0.22, 0.42, 0.6], 0.16, 0.32, 0.09, '#fde047');
      drawWallWindows(ctx, pt, 'right', 0.84, [0.22, 0.42, 0.6], 0.36, 0.5, 0.09, '#fde047');

      // Hipped royal-slate roof
      drawIsoPyramidRoof(ctx, pt, 0.11, 0.11, 0.87, 0.81, 0.56, 0.82, {
        left: '#5e548e',
        right: '#3f376b',
        backLeft: '#7265a8',
        backRight: '#4a427a'
      });

      // Gilded rooftop cupola / lantern
      drawIsoBox(ctx, pt, 0.42, 0.38, 0.74, 0.56, 0.52, 0.9, {
        top: '#fef08a',
        left: '#f8fafc',
        right: '#cbd5e1'
      });
      drawIsoPyramidRoof(ctx, pt, 0.4, 0.36, 0.58, 0.54, 0.9, 1.02, {
        left: '#fbbf24',
        right: '#b45309',
        backLeft: '#fde047',
        backRight: '#d97706'
      });
      return 1.06;
    }

    case 'lumberjack_hut': {
      // Timber lodge
      drawIsoBox(ctx, pt, 0.14, 0.16, 0, 0.58, 0.68, 0.34, {
        top: '#583101',
        left: '#7f4f24',
        right: '#583101'
      });
      drawIsoGableRoofU(ctx, pt, 0.11, 0.13, 0.61, 0.71, 0.34, 0.54, {
        frontSlope: '#6b4423',
        backSlope: '#432818',
        gableWall: '#9c6644'
      });

      // Stacked 3D timber logs in the forecourt
      drawIsoBox(ctx, pt, 0.62, 0.46, 0, 0.88, 0.66, 0.11, {
        top: '#ddb892',
        left: '#b07d4f',
        right: '#6b4423'
      });
      drawIsoBox(ctx, pt, 0.62, 0.68, 0, 0.88, 0.86, 0.11, {
        top: '#ddb892',
        left: '#b07d4f',
        right: '#6b4423'
      });
      drawIsoBox(ctx, pt, 0.65, 0.56, 0.11, 0.85, 0.76, 0.21, {
        top: '#e6ccb2',
        left: '#bc6c25',
        right: '#7f4f24'
      });
      return 0.58;
    }

    case 'sawmill': {
      // Stone water flume / raceway on the SE side
      drawIsoBox(ctx, pt, 0.66, 0.14, 0, 0.88, 0.86, 0.14, {
        top: '#38bdf8',
        left: '#64748b',
        right: '#475569'
      });
      // Main timber millhouse
      drawIsoBox(ctx, pt, 0.14, 0.16, 0, 0.66, 0.76, 0.44, {
        top: '#7f4f24',
        left: '#b07d4f',
        right: '#7f4f24'
      });
      drawWallWindows(ctx, pt, 'left', 0.76, [0.24, 0.44], 0.18, 0.32, 0.1, '#fef08a');

      drawIsoGableRoofU(ctx, pt, 0.11, 0.13, 0.69, 0.79, 0.44, 0.68, {
        frontSlope: isAnachronistic ? '#7e22ce' : '#9c6644',
        backSlope: isAnachronistic ? '#581c87' : '#6b4423',
        gableWall: '#ddb892'
      });

      // Animated 3D Waterwheel & Circular Saw on the right wall
      const wheelCenter = pt(0.68, 0.5, 0.24);
      const wr = halfH * 0.36;
      const angle = bld.status === 'working' ? animTime * 3.8 : 0;
      ctx.save();
      ctx.translate(wheelCenter.x, wheelCenter.y);
      ctx.rotate(angle);
      ctx.strokeStyle = isAnachronistic ? '#e9d5ff' : '#fde68a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, wr, 0, Math.PI * 2);
      for (let s = 0; s < 4; s++) {
        const a = (s * Math.PI) / 4;
        ctx.moveTo(-Math.cos(a) * wr, -Math.sin(a) * wr);
        ctx.lineTo(Math.cos(a) * wr, Math.sin(a) * wr);
      }
      ctx.stroke();
      ctx.restore();

      // Freshly milled golden plank stacks in front
      drawIsoBox(ctx, pt, 0.2, 0.78, 0, 0.56, 0.92, 0.12, {
        top: '#fde68a',
        left: '#f59e0b',
        right: '#b45309'
      });
      return 0.72;
    }

    case 'fishery': {
      // Wooden pier deck on pilings
      drawIsoBox(ctx, pt, 0.08, 0.08, 0, 0.92, 0.92, 0.08, {
        top: '#a1887f',
        left: '#795548',
        right: '#4e342e'
      });
      // Sea-blue boathouse & salt-curing shed
      drawIsoBox(ctx, pt, 0.14, 0.16, 0.08, 0.64, 0.7, 0.42, {
        top: '#1d3557',
        left: '#2b6cb0',
        right: '#1e4e8c'
      });
      drawWallWindows(ctx, pt, 'left', 0.7, [0.26, 0.44], 0.18, 0.32, 0.09, '#fef08a');
      drawIsoGableRoofU(ctx, pt, 0.11, 0.13, 0.67, 0.73, 0.42, 0.64, {
        frontSlope: '#457b9d',
        backSlope: '#1d3557',
        gableWall: '#90e0ef'
      });

      // Bobbing wooden fishing dory alongside the pier
      const bob = Math.sin(animTime * 2.5) * 0.025;
      drawIsoBox(ctx, pt, 0.68, 0.48, 0.04 + bob, 0.88, 0.84, 0.14 + bob, {
        top: '#ddb892',
        left: '#9c6644',
        right: '#6b4423'
      });
      return 0.68;
    }

    case 'wheat_farm': {
      // 3D Red Colonial Gambrel Barn in the north corner
      drawIsoBox(ctx, pt, 0.12, 0.1, 0, 0.54, 0.46, 0.36, {
        top: '#991b1b',
        left: '#dc2626',
        right: '#991b1b'
      });
      drawIsoGableRoofU(ctx, pt, 0.1, 0.08, 0.56, 0.48, 0.36, 0.58, {
        frontSlope: '#7f1d1d',
        backSlope: '#450a0a',
        gableWall: '#fef2f2'
      });

      // 3D Cylindrical Grain Silo next to the barn
      drawIsoCylinder(ctx, pt, halfW, halfH, 0.72, 0.26, 0.11, 0, 0.52, {
        top: '#e2e8f0',
        left: '#d6ccc2',
        right: '#94a3b8',
        stroke: 'rgba(15, 23, 42, 0.3)'
      });
      drawIsoCone(ctx, pt, halfW, halfH, 0.72, 0.26, 0.12, 0.52, 0.68, '#cbd5e1', '#64748b');

      // 3D Raised rows of golden swaying wheat across the southern half
      const sway = Math.sin(animTime * 2.4) * 0.015;
      for (let r = 0; r < 3; r++) {
        const v0 = 0.54 + r * 0.14;
        drawIsoBox(ctx, pt, 0.14 + sway, v0, 0, 0.86 + sway, v0 + 0.09, 0.16, {
          top: '#facc15',
          left: '#eab308',
          right: '#ca8a04'
        });
      }
      return 0.7;
    }

    case 'bakery': {
      // Tall 3D Windmill Tower (drawn first as rear structure)
      drawIsoCylinder(ctx, pt, halfW, halfH, 0.32, 0.44, 0.16, 0, 0.68, {
        top: '#78350f',
        left: '#f5f5f4',
        right: '#a8a29e',
        stroke: 'rgba(15, 23, 42, 0.35)'
      });
      drawIsoCone(ctx, pt, halfW, halfH, 0.32, 0.44, 0.18, 0.68, 0.88, '#b45309', '#78350f');

      // Foreground Brick Bakehouse Wing
      drawIsoBox(ctx, pt, 0.46, 0.36, 0, 0.88, 0.84, 0.36, {
        top: '#9a3412',
        left: '#ea580c',
        right: '#9a3412'
      });
      drawIsoGableRoofV(ctx, pt, 0.44, 0.34, 0.9, 0.86, 0.36, 0.54, {
        leftSlope: '#b45309',
        rightSlope: '#78350f',
        gableWall: '#fed7aa'
      });

      // Tall Brick Oven Chimney
      drawIsoBox(ctx, pt, 0.74, 0.38, 0.36, 0.86, 0.5, 0.72, {
        top: '#451a03',
        left: '#9a3412',
        right: '#7c2d12'
      });

      // Rotating 3D Windmill Sails mounted on the SW face of the tower
      const hub = pt(0.24, 0.56, 0.62);
      const sailLen = halfW * 0.42;
      const sailAngle = bld.status === 'working' ? animTime * 2.2 : 0.35;
      ctx.save();
      ctx.translate(hub.x, hub.y);
      ctx.rotate(sailAngle);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = 'rgba(254, 243, 199, 0.88)';
        ctx.fillRect(2, -3, sailLen - 2, 6);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(2, -3, sailLen - 2, 6);
      }
      ctx.restore();
      return 0.92;
    }

    case 'quarry': {
      // Terraced stone excavation ledges
      drawIsoBox(ctx, pt, 0.1, 0.1, 0, 0.88, 0.88, 0.1, {
        top: '#94a3b8',
        left: '#64748b',
        right: '#475569'
      });
      drawIsoBox(ctx, pt, 0.14, 0.14, 0.1, 0.56, 0.54, 0.28, {
        top: '#cbd5e1',
        left: '#94a3b8',
        right: '#475569'
      });

      // Mason's timber shed
      drawIsoBox(ctx, pt, 0.58, 0.18, 0.1, 0.86, 0.52, 0.34, {
        top: '#78350f',
        left: '#b45309',
        right: '#78350f'
      });

      // 3D Wooden Derrick Crane & suspended stone block
      const baseP = pt(0.42, 0.64, 0.1);
      const topP = pt(0.42, 0.64, 0.72);
      const jibAngle = bld.status === 'working' ? Math.sin(animTime * 2) * 0.08 : 0;
      const jibTip = pt(0.64 + jibAngle, 0.72, 0.8);
      const blockPos = pt(0.64 + jibAngle, 0.72, 0.42);

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(baseP.x, baseP.y);
      ctx.lineTo(topP.x, topP.y);
      ctx.lineTo(jibTip.x, jibTip.y);
      ctx.moveTo(baseP.x, baseP.y - halfH * 0.2);
      ctx.lineTo(jibTip.x, jibTip.y);
      ctx.stroke();

      // Hoist rope
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(jibTip.x, jibTip.y);
      ctx.lineTo(blockPos.x, blockPos.y);
      ctx.stroke();

      // Cut ashlar granite blocks
      drawIsoBox(ctx, pt, 0.18, 0.62, 0.1, 0.36, 0.82, 0.26, {
        top: '#f1f5f9',
        left: '#cbd5e1',
        right: '#64748b'
      });
      return 0.84;
    }

    case 'iron_mine': {
      // Rocky hill mass with mine portal
      drawIsoBox(ctx, pt, 0.12, 0.12, 0, 0.64, 0.64, 0.38, {
        top: '#9c6644',
        left: '#694e42',
        right: '#4a3329'
      });
      drawIsoPyramidRoof(ctx, pt, 0.12, 0.12, 0.64, 0.64, 0.38, 0.58, {
        left: '#8d5b4c',
        right: '#4a3329',
        backLeft: '#b07d62',
        backRight: '#694e42'
      });

      // Dark adit tunnel portal on the SW face of the rock mass
      fillIsoPoly(
        ctx,
        pt,
        [
          [0.26, 0.642, 0.02],
          [0.48, 0.642, 0.02],
          [0.48, 0.642, 0.28],
          [0.26, 0.642, 0.28]
        ],
        '#0f172a',
        '#d97706',
        1.6
      );

      // Tall 3D Timber Headframe Hoist Tower in front-right
      const hPosts: Array<[number, number]> = [
        [0.64, 0.44],
        [0.84, 0.44],
        [0.84, 0.68],
        [0.64, 0.68]
      ];
      for (const [hu, hv] of hPosts) {
        drawIsoBox(ctx, pt, hu, hv, 0, hu + 0.04, hv + 0.04, 0.72, {
          top: '#f59e0b',
          left: '#b45309',
          right: '#78350f'
        });
      }
      drawIsoBox(ctx, pt, 0.62, 0.42, 0.72, 0.88, 0.72, 0.8, {
        top: '#b45309',
        left: '#92400e',
        right: '#78350f'
      });

      // Ore heap in front
      drawIsoCone(ctx, pt, halfW, halfH, 0.36, 0.82, 0.14, 0, 0.22, '#ea580c', '#7c2d12');
      return 0.84;
    }

    case 'blacksmith': {
      // Heavy stone foundry building
      drawIsoBox(ctx, pt, 0.14, 0.14, 0, 0.68, 0.72, 0.44, {
        top: '#1f2937',
        left: '#4b5563',
        right: '#374151'
      });
      drawIsoGableRoofU(ctx, pt, 0.11, 0.11, 0.71, 0.75, 0.44, 0.68, {
        frontSlope: '#334155',
        backSlope: '#1e293b',
        gableWall: '#64748b'
      });

      // Towering Blast-Furnace Brick Chimney
      drawIsoBox(ctx, pt, 0.56, 0.14, 0.44, 0.74, 0.34, 0.88, {
        top: isAnachronistic ? '#a855f7' : '#ef4444',
        left: '#7f1d1d',
        right: '#450a0a'
      });

      // Open Forge Bay with Glowing Crucible Fire & Anvil in the forecourt
      drawIsoBox(ctx, pt, 0.52, 0.56, 0, 0.86, 0.86, 0.18, {
        top: '#374151',
        left: '#4b5563',
        right: '#1f2937'
      });
      const fireGlow = 0.8 + Math.sin(animTime * 6) * 0.2;
      drawIsoCylinder(ctx, pt, halfW, halfH, 0.69, 0.71, 0.1 * fireGlow, 0.18, 0.26, {
        top: isAnachronistic ? '#e879f9' : '#fde047',
        left: isAnachronistic ? '#a855f7' : '#f97316',
        right: isAnachronistic ? '#6b21a8' : '#dc2626'
      });
      return 0.92;
    }

    case 'herb_garden': {
      // 3D Glass Conservatory / Greenhouse in the back half
      drawIsoBox(ctx, pt, 0.14, 0.12, 0, 0.86, 0.52, 0.12, {
        top: '#94a3b8',
        left: '#64748b',
        right: '#475569'
      });
      drawIsoBox(ctx, pt, 0.16, 0.14, 0.12, 0.84, 0.5, 0.4, {
        top: 'rgba(167, 243, 208, 0.68)',
        left: 'rgba(110, 231, 183, 0.62)',
        right: 'rgba(52, 211, 153, 0.5)',
        stroke: '#065f46'
      });
      drawIsoGableRoofU(ctx, pt, 0.15, 0.13, 0.85, 0.51, 0.4, 0.58, {
        frontSlope: 'rgba(167, 243, 208, 0.78)',
        backSlope: 'rgba(52, 211, 153, 0.6)',
        gableWall: 'rgba(110, 231, 183, 0.7)',
        stroke: '#065f46'
      });

      // 2 Raised 3D Botanical Planter Beds in the front half
      for (const uBed of [0.16, 0.54]) {
        drawIsoBox(ctx, pt, uBed, 0.58, 0, uBed + 0.3, 0.88, 0.1, {
          top: '#3f6212',
          left: '#78716c',
          right: '#57534e'
        });
        drawIsoCone(ctx, pt, halfW, halfH, uBed + 0.15, 0.73, 0.11, 0.1, 0.28, '#4ade80', '#15803d');
      }
      return 0.62;
    }

    case 'apothecary': {
      // Whitewashed stone clinic plinth
      drawIsoBox(ctx, pt, 0.12, 0.12, 0, 0.88, 0.88, 0.08, {
        top: '#cbd5e1',
        left: '#94a3b8',
        right: '#64748b'
      });
      // Main Clinic Building
      drawIsoBox(ctx, pt, 0.16, 0.16, 0.08, 0.66, 0.8, 0.48, {
        top: '#ccfbf1',
        left: '#f0fdfa',
        right: '#cbd5e1'
      });
      drawWallWindows(ctx, pt, 'left', 0.8, [0.24, 0.46], 0.18, 0.36, 0.1, '#5eead4');
      drawIsoGableRoofU(ctx, pt, 0.13, 0.13, 0.69, 0.83, 0.48, 0.74, {
        frontSlope: '#0f766e',
        backSlope: '#115e59',
        gableWall: '#e2e8f0'
      });

      // 3D Copper Alembic Distillation Tank on the right terrace
      drawIsoCylinder(ctx, pt, halfW, halfH, 0.76, 0.52, 0.1, 0.08, 0.42, {
        top: '#fbbf24',
        left: '#f59e0b',
        right: '#b45309',
        stroke: 'rgba(15, 23, 42, 0.35)'
      });
      drawIsoCone(ctx, pt, halfW, halfH, 0.76, 0.52, 0.1, 0.42, 0.58, '#fde047', '#d97706');
      return 0.78;
    }

    case 'chronicle_observatory': {
      // Stepped stone foundation
      drawIsoBox(ctx, pt, 0.1, 0.1, 0, 0.9, 0.9, 0.09, {
        top: '#cbd5e1',
        left: '#94a3b8',
        right: '#64748b'
      });
      // Octagonal / square collegiate stone hall
      drawIsoBox(ctx, pt, 0.16, 0.16, 0.09, 0.84, 0.84, 0.48, {
        top: '#4c1d95',
        left: '#ddd6fe',
        right: '#a78bfa'
      });
      drawWallWindows(ctx, pt, 'left', 0.84, [0.24, 0.46, 0.66], 0.18, 0.38, 0.09, '#fde047');
      drawWallWindows(ctx, pt, 'right', 0.84, [0.24, 0.46, 0.66], 0.18, 0.38, 0.09, '#facc15');

      // 3D Observatory Drum & Hemispherical Dome
      drawIsoCylinder(ctx, pt, halfW, halfH, 0.5, 0.5, 0.24, 0.48, 0.64, {
        top: '#6d28d9',
        left: '#8b5cf6',
        right: '#4c1d95',
        stroke: 'rgba(15, 23, 42, 0.35)'
      });

      const domeBase = pt(0.5, 0.5, 0.64);
      const rx = 0.24 * Math.SQRT2 * halfW;
      const ry = 0.24 * Math.SQRT2 * halfH;
      const domeGrad = ctx.createRadialGradient(
        domeBase.x - rx * 0.35,
        domeBase.y - rx * 0.45,
        rx * 0.1,
        domeBase.x,
        domeBase.y,
        rx * 1.1
      );
      domeGrad.addColorStop(0, '#e9d5ff');
      domeGrad.addColorStop(0.5, '#9333ea');
      domeGrad.addColorStop(1, '#3b0764');

      ctx.beginPath();
      ctx.arc(domeBase.x, domeBase.y, rx, Math.PI, 0);
      ctx.ellipse(domeBase.x, domeBase.y, rx, ry, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = domeGrad;
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Brass Telescope Tube extending from the dome
      const scopeStart = pt(0.42, 0.58, 0.76);
      const scopeEnd = pt(0.2, 0.78, 0.94);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = Math.max(2.5, halfH * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(scopeStart.x, scopeStart.y);
      ctx.lineTo(scopeEnd.x, scopeEnd.y);
      ctx.stroke();

      // Orbiting Temporal Halo
      const haloCenter = pt(0.5, 0.5, 0.96);
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(
        haloCenter.x,
        haloCenter.y,
        halfW * 0.22,
        halfH * 0.16,
        animTime * 0.8,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
      return 1.05;
    }

    default: {
      const def = BUILDINGS[bld.defId];
      drawIsoBox(ctx, pt, 0.18, 0.18, 0, 0.82, 0.82, 0.45, {
        top: def?.accentColor ?? '#94a3b8',
        left: def?.color ?? '#64748b',
        right: '#334155'
      });
      return 0.55;
    }
  }
}

const thumbnailCache = new Map<string, string>();

/**
 * Renders a cached 3D isometric miniature preview data URL for a building definition
 * to display in build cards and the structure inspector.
 */
export function getBuildingThumbnailUrl(defId: string): string {
  const cached = thumbnailCache.get(defId);
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 48;
  const cy = 64;
  const halfW = 36;
  const halfH = 18;
  const pt = createLocalProjector(cx, cy, halfW, halfH, 0);

  // Draw 3D isometric terrain plinth underneath the model
  const isWater = defId === 'fishery';
  const isLoam = defId === 'wheat_farm' || defId === 'herb_garden';
  const isRock = defId === 'quarry' || defId === 'iron_mine';

  drawIsoBox(ctx, pt, 0.02, 0.02, -0.24, 0.98, 0.98, 0, {
    top: isWater ? '#296f9c' : isLoam ? '#6b8e3d' : isRock ? '#64748b' : '#4c7c44',
    left: isWater ? '#174463' : isRock ? '#475569' : '#5c4738',
    right: isWater ? '#11334a' : isRock ? '#334155' : '#3f2e21',
    stroke: 'rgba(255, 255, 255, 0.14)'
  });

  if (defId === 'dirt_road') {
    drawIsoBox(ctx, pt, 0.32, 0.02, 0, 0.68, 0.98, 0.04, {
      top: '#a88b7d',
      left: '#7d6053',
      right: '#5d4037'
    });
    drawIsoBox(ctx, pt, 0.02, 0.32, 0, 0.98, 0.68, 0.04, {
      top: '#a88b7d',
      left: '#7d6053',
      right: '#5d4037'
    });
  } else {
    const def = BUILDINGS[defId];
    const dummyBld: PlacedBuilding = {
      id: '__thumb__',
      defId,
      x: 0,
      y: 0,
      activeRecipeId: def?.recipes?.[0]?.id ?? '',
      progressSeconds: 0,
      constructionProgressSeconds: 0,
      buildTimeSeconds: 1,
      isConstructed: true,
      residents: def?.housing?.capacity ?? 0,
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
    drawIsoBuildingModel(
      ctx,
      dummyBld,
      pt,
      halfW,
      halfH,
      0.85,
      def?.category === 'temporal'
    );
  }

  const url = canvas.toDataURL();
  thumbnailCache.set(defId, url);
  return url;
}

/**
 * Returns the vertical 3D hit-box height (in units of tileH = 2 * halfH) for a placed building.
 */
export function getBuildingHitHeight(bld: PlacedBuilding): number {
  const def = BUILDINGS[bld.defId];
  if (!def || def.isRoad) return 0;
  if (bld.isConstructed === false) return 0.55;
  switch (bld.defId) {
    case 'founding_camp':
      return 1.05;
    case 'enlightened_manor':
      return 1.06;
    case 'chronicle_observatory':
      return 1.05;
    case 'bakery':
    case 'blacksmith':
      return 0.92;
    case 'quarry':
    case 'iron_mine':
      return 0.84;
    case 'colonial_homestead':
      return 0.8;
    case 'apothecary':
      return 0.78;
    case 'sawmill':
      return 0.72;
    case 'wheat_farm':
      return 0.7;
    case 'fishery':
      return 0.68;
    case 'market_square':
    case 'pioneer_cabin':
      return 0.66;
    case 'herb_garden':
      return 0.62;
    case 'lumberjack_hut':
      return 0.58;
    default:
      return 0.6;
  }
}

/**
 * Hit-tests a screen point (localX, localY) against the isometric map.
 * In 'select' and 'demolish' modes, visible 3D structures are hit-tested in reverse painter's
 * draw order before falling back to elevated terrain diamond picking, so clicking a tall roof
 * that overlaps a rear tile selects the foreground structure rather than the tile behind it.
 * In 'build' mode, ground diamond picking is retained for predictable placement.
 */
export function pickIsoTileAtScreenPoint(
  localX: number,
  localY: number,
  offsetX: number,
  offsetY: number,
  halfW: number,
  halfH: number,
  state: GameState | null,
  toolMode: 'select' | 'build' | 'demolish' = 'select'
): { x: number; y: number } {
  const dx = (localX - offsetX) / halfW;
  const dy = (localY - offsetY) / halfH;
  const gx = (dx + dy) * 0.5;
  const gy = (dy - dx) * 0.5;
  const baseX = Math.floor(gx);
  const baseY = Math.floor(gy);

  if (!state) {
    return { x: baseX, y: baseY };
  }

  const candidates: Array<{ x: number; y: number }> = [];
  for (let oy = -1; oy <= 2; oy++) {
    for (let ox = -1; ox <= 2; ox++) {
      const tx = baseX + ox;
      const ty = baseY + oy;
      if (tx >= 0 && tx < state.width && ty >= 0 && ty < state.height) {
        candidates.push({ x: tx, y: ty });
      }
    }
  }

  // Sort in reverse painter's draw order (front-to-back: highest x + y first, then highest x)
  candidates.sort((a, b) => b.x + b.y - (a.x + a.y) || b.x - a.x);

  // 1. In select/demolish modes, hit-test visible 3D structures first in reverse draw order
  if (toolMode === 'select' || toolMode === 'demolish') {
    for (const c of candidates) {
      const tile = state.tiles[c.y][c.x];
      if (!tile.buildingId) continue;
      const bld = state.buildings[tile.buildingId];
      if (!bld) continue;
      const roofH = getBuildingHitHeight(bld);
      if (roofH <= 0) continue;

      const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
      const cx = offsetX + (c.x - c.y) * halfW;
      const cy = offsetY + (c.x + c.y + 1) * halfH;
      const surfaceCy = cy - wTop * (2 * halfH);

      const nx = Math.abs(localX - cx) / halfW;
      if (nx > 0.84) continue;

      const bottomEdgeY = surfaceCy + (1.0 - nx) * halfH;
      const topEdgeY = surfaceCy - roofH * (2 * halfH) + nx * halfH * 0.5;
      if (localY <= bottomEdgeY && localY >= topEdgeY) {
        return c;
      }
    }
  }

  // 2. Fall back to elevated terrain diamond hit-testing in reverse draw order
  for (const c of candidates) {
    const tile = state.tiles[c.y][c.x];
    const wTop = getTerrainSurfaceW(tile.terrain, tile.elevation);
    const cx = offsetX + (c.x - c.y) * halfW;
    const cy = offsetY + (c.x + c.y + 1) * halfH;
    const surfaceCy = cy - wTop * (2 * halfH);
    const normDist =
      Math.abs(localX - cx) / halfW + Math.abs(localY - surfaceCy) / halfH;
    if (normDist <= 1.0) {
      return c;
    }
  }

  return { x: baseX, y: baseY };
}


