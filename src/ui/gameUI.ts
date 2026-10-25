import { BUILDINGS, BUILDING_LIST } from '../data/buildings.ts';
import { HISTORICAL_EVENTS } from '../data/events.ts';
import { POPULATION_TIERS, POPULATION_TIER_ORDER } from '../data/population.ts';
import { RESOURCES, RESOURCE_ORDER } from '../data/resources.ts';
import { TECHNOLOGIES, TECHNOLOGY_LIST } from '../data/technologies.ts';
import { TERRAINS } from '../data/terrain.ts';
import type { BuildingCategory, ResourceId } from '../data/types.ts';
import {
  type GameState,
  WIN_CONDITIONS,
  canPlaceBuilding,
  canUnlockTech,
  canUpgradeHouse,
  demolishTile,
  getColonialYearString,
  getTile,
  hasEnoughResources,
  placeBuilding,
  resolveHistoricalEvent,
  setBuildingRecipe,
  toggleBuildingPaused,
  unlockTech,
  upgradeHouse
} from '../core/simulation.ts';
import { clearSavedGame, saveGameToStorage } from '../core/storage.ts';
import { CanvasRenderer } from '../render/canvasRenderer.ts';

export class GameUI {
  private state: GameState;
  private renderer: CanvasRenderer;
  private onResetGame: () => void;

  private activeCategory: BuildingCategory | 'all' = 'all';
  private activeModal: 'tech' | 'chronicle' | null = null;
  private lastRenderedEventId: string | null = null;
  private toastTimeout: number | null = null;

  constructor(state: GameState, renderer: CanvasRenderer, onResetGame: () => void) {
    this.state = state;
    this.renderer = renderer;
    this.onResetGame = onResetGame;

    this.bindStaticControls();
    this.renderBuildToolbar();
    this.renderInspector();
    this.updateHUD();
  }

  public setState(newState: GameState): void {
    this.state = newState;
    this.lastRenderedEventId = null;
    this.renderBuildToolbar();
    this.renderInspector();
    this.updateHUD();
  }

  public showToast(message: string, tone: 'info' | 'success' | 'warn' = 'info'): void {
    const el = document.getElementById('toast-banner');
    if (!el) return;
    el.textContent = message;
    el.className = `toast-banner visible toast-${tone}`;
    if (this.toastTimeout) {
      window.clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = window.setTimeout(() => {
      el.classList.remove('visible');
    }, 3200);
  }

  private bindStaticControls(): void {
    // Speed buttons
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spd = Number(btn.dataset.speed) as 0 | 1 | 2 | 4;
        this.state.speed = spd;
        this.updateHUD();
      });
    });

    // Top bar action buttons
    document.getElementById('btn-open-tech')?.addEventListener('click', () => {
      this.openModal(this.activeModal === 'tech' ? null : 'tech');
    });

    document.getElementById('btn-open-chronicle')?.addEventListener('click', () => {
      this.openModal(this.activeModal === 'chronicle' ? null : 'chronicle');
    });

    document.getElementById('btn-center-camera')?.addEventListener('click', () => {
      this.renderer.centerOnTile(8, 8);
      this.showToast('Camera centered on James River Landing.', 'info');
    });

    document.getElementById('btn-save-game')?.addEventListener('click', () => {
      const ok = saveGameToStorage(this.state);
      this.showToast(
        ok ? 'Timeline & settlement saved to browser storage.' : 'Unable to save in this context.',
        ok ? 'success' : 'warn'
      );
    });

    document.getElementById('btn-reset-game')?.addEventListener('click', () => {
      clearSavedGame();
      this.onResetGame();
      this.showToast('Started a fresh 1607 expedition timeline.', 'info');
    });

    // Category tabs
    document.querySelectorAll<HTMLButtonElement>('[data-build-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.buildCat as BuildingCategory | 'all' | 'select' | 'demolish';
        if (cat === 'select') {
          this.renderer.tool = { mode: 'select' };
          this.updateToolButtons();
          return;
        }
        if (cat === 'demolish') {
          this.renderer.tool = { mode: 'demolish' };
          this.updateToolButtons();
          this.showToast('Demolish Mode active: Click a building to dismantle (50% refund).', 'warn');
          return;
        }
        this.activeCategory = cat;
        document.querySelectorAll('[data-build-cat]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        this.renderBuildToolbar();
      });
    });

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => this.openModal(null));
    });

    // Canvas interactions
    this.renderer.onTileClick((x, y, button) => {
      if (button === 2) {
        // Right-click returns to select mode
        this.renderer.tool = { mode: 'select' };
        this.updateToolButtons();
        this.renderBuildToolbar();
        return;
      }

      if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) return;

      if (this.renderer.tool.mode === 'demolish') {
        const res = demolishTile(this.state, x, y);
        if (res.success) {
          this.showToast('Structure dismantled (50% materials refunded).', 'info');
        } else if (res.reason) {
          this.showToast(res.reason, 'warn');
        }
        this.renderer.selectedTile = { x, y };
        this.renderInspector();
        this.updateHUD();
        return;
      }

      if (this.renderer.tool.mode === 'build') {
        const defId = this.renderer.tool.defId;
        const res = placeBuilding(this.state, defId, x, y);
        if (res.success) {
          const def = BUILDINGS[defId];
          this.showToast(`Constructed ${def.name} at (${x}, ${y}).`, 'success');
          this.renderer.selectedTile = { x, y };
          // Keep road or housing tool active for easy placement; switch to select if insufficient funds
          if (!canPlaceBuilding(this.state, defId, x, y).valid && !def.isRoad) {
            // Stay in build mode so player can place more if they have resources
          }
          this.renderBuildToolbar();
          this.renderInspector();
          this.updateHUD();
        } else if (res.reason) {
          this.showToast(res.reason, 'warn');
        }
        return;
      }

      // Select mode
      this.renderer.selectedTile = { x, y };
      this.renderInspector();
    });

    // Keyboard shortcuts (Escape cancels build/demolish or closes modal, Space toggles pause)
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (this.activeModal) {
          this.openModal(null);
        } else if (this.renderer.tool.mode !== 'select') {
          this.renderer.tool = { mode: 'select' };
          this.updateToolButtons();
          this.renderBuildToolbar();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        this.state.speed = this.state.speed === 0 ? 1 : 0;
        this.updateHUD();
      }
    });
  }

  public openModal(modal: 'tech' | 'chronicle' | null): void {
    this.activeModal = modal;
    const techModal = document.getElementById('modal-tech');
    const chronModal = document.getElementById('modal-chronicle');

    if (techModal) techModal.classList.toggle('hidden', modal !== 'tech');
    if (chronModal) chronModal.classList.toggle('hidden', modal !== 'chronicle');

    if (modal === 'tech') {
      this.renderTechModal();
    } else if (modal === 'chronicle') {
      this.renderChronicleModal();
    }
  }

  public updateHUD(): void {
    // Date & Year
    const yearEl = document.getElementById('hud-year');
    if (yearEl) {
      yearEl.textContent = `${getColonialYearString(this.state.day)} • Day ${this.state.day}`;
    }

    // Speed buttons active state
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((btn) => {
      const spd = Number(btn.dataset.speed);
      btn.classList.toggle('active', this.state.speed === spd);
    });

    // Resource bar
    const resContainer = document.getElementById('resource-bar');
    if (resContainer) {
      resContainer.innerHTML = RESOURCE_ORDER.map((resId) => {
        const def = RESOURCES[resId];
        const amount = Math.floor(this.state.resources[resId]);
        const rate = this.state.netRatesPerMin[resId] ?? 0;
        const rateSign = rate > 0 ? '+' : '';
        const rateClass = rate > 0.05 ? 'rate-pos' : rate < -0.05 ? 'rate-neg' : 'rate-neutral';
        const capText = def.isStoredInWarehouse ? `/${this.state.storageCapacity}` : '';

        return `
          <div class="res-pill ${resId === 'insight' ? 'res-insight' : resId === 'coin' ? 'res-coin' : ''}" title="${def.name}: ${def.description}">
            <span class="res-icon">${def.icon}</span>
            <div class="res-vals">
              <span class="res-name">${def.shortName}</span>
              <span class="res-amount">${amount}<small>${capText}</small></span>
            </div>
            <span class="res-rate ${rateClass}">${rateSign}${rate.toFixed(1)}/m</span>
          </div>
        `;
      }).join('');
    }

    // Settlement Metrics (Pop, Workforce, Happiness, Divergence, Paradox)
    const popEl = document.getElementById('metric-pop');
    if (popEl) {
      const effPct = Math.round(this.state.laborEfficiency * 100);
      popEl.innerHTML = `👥 <strong>${this.state.totalPopulation}</strong> <small>(Work: ${this.state.workersNeeded} • ${effPct}%)</small>`;
    }

    const happyEl = document.getElementById('metric-happiness');
    if (happyEl) {
      const emoji =
        this.state.happiness >= 75 ? '😊' : this.state.happiness >= 45 ? '😐' : '😟';
      happyEl.innerHTML = `${emoji} Happiness: <strong>${this.state.happiness}%</strong>`;
    }

    const divEl = document.getElementById('metric-divergence');
    if (divEl) {
      divEl.innerHTML = `🔀 Divergence: <strong>${Math.round(this.state.divergence)}%</strong>`;
    }

    const parEl = document.getElementById('metric-paradox');
    if (parEl) {
      const warn = this.state.paradox >= 50 ? 'paradox-high' : '';
      parEl.className = `metric-chip ${warn}`;
      parEl.innerHTML = `⚡ Paradox: <strong>${Math.round(this.state.paradox)}%</strong>`;
    }

    // Highlight Future Knowledge button if any tech is affordable right now
    const canBuyAnyTech = TECHNOLOGY_LIST.some((t) => canUnlockTech(this.state, t.id).valid);
    const techBtn = document.getElementById('btn-open-tech');
    if (techBtn) {
      techBtn.classList.toggle('pulse-ready', canBuyAnyTech);
      const unlockedCount = this.state.unlockedTechIds.length;
      techBtn.innerHTML = `⏳ Future Knowledge (${unlockedCount}/${TECHNOLOGY_LIST.length})${canBuyAnyTech ? ' <span class="badge-dot">!</span>' : ''}`;
    }

    // Check if an active Historical Event needs to be shown
    if (this.state.activeEventId !== this.lastRenderedEventId) {
      this.lastRenderedEventId = this.state.activeEventId;
      this.renderEventModal();
    }

    // Check Victory Banner
    const winModal = document.getElementById('modal-victory');
    if (winModal) {
      if (this.state.won && !this.state.winDismissed) {
        winModal.classList.remove('hidden');
      } else {
        winModal.classList.add('hidden');
      }
    }

    this.renderSettlementOverviewCard();
  }

  private updateToolButtons(): void {
    const selectBtn = document.querySelector('[data-build-cat="select"]');
    const demolishBtn = document.querySelector('[data-build-cat="demolish"]');
    if (selectBtn) {
      selectBtn.classList.toggle('active-tool', this.renderer.tool.mode === 'select');
    }
    if (demolishBtn) {
      demolishBtn.classList.toggle('active-tool', this.renderer.tool.mode === 'demolish');
    }
  }

  public renderBuildToolbar(): void {
    this.updateToolButtons();
    const container = document.getElementById('build-cards-container');
    if (!container) return;

    const list = BUILDING_LIST.filter(
      (b) => this.activeCategory === 'all' || b.category === this.activeCategory
    );

    container.innerHTML = list
      .map((def) => {
        const isLocked =
          Boolean(def.requiredTechId) && !this.state.unlockedTechIds.includes(def.requiredTechId!);
        const canAfford = hasEnoughResources(this.state, def.cost).ok;
        const isSelected =
          this.renderer.tool.mode === 'build' && this.renderer.tool.defId === def.id;

        const costBadges = (Object.entries(def.cost) as Array<[ResourceId, number]>)
          .map(([resId, amt]) => {
            const rDef = RESOURCES[resId];
            const enough = this.state.resources[resId] >= amt;
            return `<span class="cost-tag ${enough ? '' : 'cost-short'}">${rDef.icon}${amt}</span>`;
          })
          .join('');

        const lockLabel = isLocked
          ? `<div class="lock-banner">🔒 Unlock via ${TECHNOLOGIES[def.requiredTechId!]?.name ?? 'Future Knowledge'}</div>`
          : '';

        return `
          <button
            class="build-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${!canAfford && !isLocked ? 'unaffordable' : ''}"
            data-build-id="${def.id}"
            title="${def.description}"
          >
            <div class="build-card-top">
              <span class="build-icon">${def.icon}</span>
              <div class="build-title-wrap">
                <span class="build-name">${def.name}</span>
                <span class="build-cat-tag">${def.category}</span>
              </div>
            </div>
            <div class="build-costs">${costBadges}</div>
            ${lockLabel}
          </button>
        `;
      })
      .join('');

    container.querySelectorAll<HTMLButtonElement>('[data-build-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const defId = btn.dataset.buildId!;
        const def = BUILDINGS[defId];
        if (def.requiredTechId && !this.state.unlockedTechIds.includes(def.requiredTechId)) {
          this.showToast(
            `Unlock "${TECHNOLOGIES[def.requiredTechId]?.name}" in Future Knowledge first!`,
            'warn'
          );
          this.openModal('tech');
          return;
        }
        if (this.renderer.tool.mode === 'build' && this.renderer.tool.defId === defId) {
          this.renderer.tool = { mode: 'select' };
        } else {
          this.renderer.tool = { mode: 'build', defId };
        }
        this.renderBuildToolbar();
      });
    });
  }

  public renderInspector(): void {
    const panel = document.getElementById('inspector-content');
    if (!panel) return;

    const sel = this.renderer.selectedTile;
    if (!sel) {
      panel.innerHTML = `<p class="muted-hint">Select any tile or building on the map to inspect its status, switch recipes, or upgrade housing.</p>`;
      return;
    }

    const tile = getTile(this.state, sel.x, sel.y);
    if (!tile) {
      panel.innerHTML = `<p class="muted-hint">Tile out of bounds.</p>`;
      return;
    }

    const tDef = TERRAINS[tile.terrain];
    const bld = tile.buildingId ? this.state.buildings[tile.buildingId] : undefined;

    if (!bld) {
      panel.innerHTML = `
        <div class="inspector-section">
          <div class="inspector-header">
            <span class="inspector-icon">🗺️</span>
            <div>
              <h4>${tDef.name}</h4>
              <span class="coords-tag">Tile (${tile.x}, ${tile.y})</span>
            </div>
          </div>
          <p class="inspector-desc">${tDef.description}</p>
          ${tDef.resourceHint ? `<div class="hint-chip">✨ ${tDef.resourceHint}</div>` : ''}
        </div>
      `;
      return;
    }

    const def = BUILDINGS[bld.defId];
    const statusMap: Record<string, { label: string; cls: string }> = {
      working: { label: '⚡ Operating Normally', cls: 'status-ok' },
      no_road: { label: '⚠️ Disconnected from Road/Warehouse', cls: 'status-err' },
      missing_inputs: { label: '⏳ Waiting for Input Materials', cls: 'status-warn' },
      storage_full: { label: '📦 Warehouse Storage Full', cls: 'status-warn' },
      paused: { label: '⏸ Production Paused', cls: 'status-warn' },
      housing: { label: '🏡 Occupied Residence', cls: 'status-ok' },
      civic: { label: '🏛️ Active Civic Infrastructure', cls: 'status-ok' }
    };
    const stInfo = statusMap[bld.status] ?? { label: bld.status, cls: '' };

    // Housing Inspector Block
    let housingHtml = '';
    if (def.housing) {
      const tierDef = POPULATION_TIERS[def.housing.tier];
      const upgCheck = canUpgradeHouse(this.state, bld.id);
      const nextDef = def.housing.upgradesToBuildingId
        ? BUILDINGS[def.housing.upgradesToBuildingId]
        : null;

      const needsRows = tierDef.needs
        .map((need) => {
          let satisfied = false;
          if (need.service) {
            satisfied = bld.servicesAvailable[need.service];
          } else {
            satisfied = (this.state.needSatisfaction[need.id] ?? 0) >= 0.7;
          }
          return `
            <div class="need-row">
              <span>${need.label}</span>
              <span class="${satisfied ? 'need-ok' : 'need-miss'}">${satisfied ? '✓ Supplied' : '✗ Missing'}</span>
            </div>
          `;
        })
        .join('');

      const upgradeCostHtml =
        def.housing.upgradeCost
          ? Object.entries(def.housing.upgradeCost)
              .map(([k, v]) => `${RESOURCES[k as ResourceId].icon}${v}`)
              .join(' ')
          : '';

      housingHtml = `
        <div class="inspector-box">
          <div class="box-row">
            <span>Residents (${tierDef.badge} ${tierDef.name}):</span>
            <strong>${Math.floor(bld.residents)} / ${def.housing.capacity}</strong>
          </div>
          <div class="needs-list">
            <h5>Household Needs</h5>
            ${needsRows}
          </div>
          ${
            nextDef
              ? `
            <div class="upgrade-box">
              <button id="btn-upgrade-house" class="btn-primary ${upgCheck.valid ? '' : 'btn-disabled'}" ${upgCheck.valid ? '' : 'disabled'}>
                ▲ Upgrade to ${nextDef.name} (${upgradeCostHtml})
              </button>
              ${!upgCheck.valid && upgCheck.reason ? `<small class="upg-reason">${upgCheck.reason}</small>` : ''}
            </div>
          `
              : `<div class="hint-chip">🌟 Maximum Residence Tier Reached</div>`
          }
        </div>
      `;
    }

    // Production Recipes Block
    let recipesHtml = '';
    if (def.recipes && def.recipes.length > 0) {
      const activeRecipe =
        def.recipes.find((r) => r.id === bld.activeRecipeId) ?? def.recipes[0];
      const pct = Math.min(100, Math.round((bld.progressSeconds / activeRecipe.cycleSeconds) * 100));

      const recipeCards = def.recipes
        .map((r) => {
          const unlocked = !r.requiredTechId || this.state.unlockedTechIds.includes(r.requiredTechId);
          const isSelected = r.id === activeRecipe.id;
          const inputsStr =
            Object.entries(r.inputs)
              .map(([k, v]) => `${v} ${RESOURCES[k as ResourceId].icon}`)
              .join(' + ') || 'Natural Harvest';
          const outputsStr = Object.entries(r.outputs)
            .map(([k, v]) => `${v} ${RESOURCES[k as ResourceId].icon}`)
            .join(' + ');

          return `
            <div class="recipe-option ${isSelected ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-recipe-id="${r.id}">
              <div class="recipe-head">
                <strong>${r.name}</strong>
                ${r.isAnachronistic ? '<span class="anach-tag">⏳ Future Method</span>' : ''}
              </div>
              <div class="recipe-io">${inputsStr} ➔ <strong>${outputsStr}</strong> (${r.cycleSeconds}s)</div>
              <div class="recipe-desc">${r.description}</div>
              ${
                !unlocked
                  ? `<div class="recipe-lock-note">🔒 Requires ${TECHNOLOGIES[r.requiredTechId!]?.name}</div>`
                  : ''
              }
            </div>
          `;
        })
        .join('');

      recipesHtml = `
        <div class="inspector-box">
          <div class="box-row">
            <span>Efficiency:</span>
            <strong>${Math.round(bld.efficiency * 100)}%</strong>
          </div>
          <div class="progress-bar-outer">
            <div class="progress-bar-inner" style="width: ${pct}%"></div>
          </div>
          <h5>Production Method (Click to Switch)</h5>
          <div class="recipe-list">${recipeCards}</div>
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="inspector-section">
        <div class="inspector-header">
          <span class="inspector-icon">${def.icon}</span>
          <div>
            <h4>${def.name}</h4>
            <span class="coords-tag">Tile (${bld.x}, ${bld.y}) • ${tDef.name}</span>
          </div>
        </div>
        <div class="status-pill ${stInfo.cls}">${stInfo.label}</div>
        <p class="inspector-desc">${def.description}</p>
        <div class="meta-grid">
          <div><span>Workforce:</span> <strong>${def.workersRequired}</strong></div>
          <div><span>Upkeep:</span> <strong>🪙 ${def.upkeepCoinPerMin}/m</strong></div>
          ${def.passiveInsightPerMin ? `<div><span>Insight:</span> <strong>⏳ +${def.passiveInsightPerMin}/m</strong></div>` : ''}
          ${def.serviceRadius ? `<div><span>Service Radius:</span> <strong>${def.serviceRadius} tiles</strong></div>` : ''}
        </div>
        ${housingHtml}
        ${recipesHtml}
        <div class="inspector-actions">
          ${
            def.recipes && def.recipes.length > 0
              ? `<button id="btn-toggle-pause" class="btn-secondary">${bld.paused ? '▶ Resume Work' : '⏸ Pause Work'}</button>`
              : ''
          }
          ${
            bld.defId !== 'founding_camp'
              ? `<button id="btn-demolish-selected" class="btn-danger">💣 Demolish</button>`
              : ''
          }
        </div>
      </div>
    `;

    // Bind upgrade house button
    document.getElementById('btn-upgrade-house')?.addEventListener('click', () => {
      const res = upgradeHouse(this.state, bld.id);
      if (res.success) {
        const updatedDef = BUILDINGS[bld.defId];
        this.showToast(`Upgraded residence to ${updatedDef.name}!`, 'success');
        this.renderInspector();
        this.updateHUD();
      } else if (res.reason) {
        this.showToast(res.reason, 'warn');
      }
    });

    // Bind recipe switching
    panel.querySelectorAll<HTMLElement>('[data-recipe-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const rId = el.dataset.recipeId!;
        const recipe = def.recipes?.find((r) => r.id === rId);
        if (recipe?.requiredTechId && !this.state.unlockedTechIds.includes(recipe.requiredTechId)) {
          this.showToast(
            `Unlock "${TECHNOLOGIES[recipe.requiredTechId]?.name}" in Future Knowledge first!`,
            'warn'
          );
          this.openModal('tech');
          return;
        }
        if (setBuildingRecipe(this.state, bld.id, rId)) {
          this.showToast(`Switched production to ${recipe?.name}.`, 'success');
          this.renderInspector();
        }
      });
    });

    // Bind pause button
    document.getElementById('btn-toggle-pause')?.addEventListener('click', () => {
      toggleBuildingPaused(this.state, bld.id);
      this.renderInspector();
      this.updateHUD();
    });

    // Bind demolish button
    document.getElementById('btn-demolish-selected')?.addEventListener('click', () => {
      const res = demolishTile(this.state, bld.x, bld.y);
      if (res.success) {
        this.showToast('Structure dismantled (50% materials refunded).', 'info');
        this.renderInspector();
        this.updateHUD();
      } else if (res.reason) {
        this.showToast(res.reason, 'warn');
      }
    });
  }

  private renderSettlementOverviewCard(): void {
    const el = document.getElementById('settlement-overview-card');
    if (!el) return;

    const tiersHtml = POPULATION_TIER_ORDER.map((tId) => {
      const tDef = POPULATION_TIERS[tId];
      const count = this.state.populationByTier[tId];
      const cap = this.state.housingCapacityByTier[tId];
      return `
        <div class="tier-chip">
          <span>${tDef.badge} ${tDef.name}</span>
          <strong>${count} / ${cap}</strong>
        </div>
      `;
    }).join('');

    const popProgress = Math.min(100, Math.round((this.state.totalPopulation / WIN_CONDITIONS.minPopulation) * 100));
    const divProgress = Math.min(100, Math.round((this.state.divergence / WIN_CONDITIONS.minDivergence) * 100));
    const innProgress = Math.min(
      100,
      Math.round((this.state.populationByTier.innovators / WIN_CONDITIONS.minInnovators) * 100)
    );

    el.innerHTML = `
      <h4>Settlement & Timeline</h4>
      <div class="tiers-summary">${tiersHtml}</div>
      <div class="win-goals">
        <div class="goal-item">
          <div class="goal-label"><span>Population Goal</span><strong>${this.state.totalPopulation}/${WIN_CONDITIONS.minPopulation}</strong></div>
          <div class="mini-bar"><div style="width:${popProgress}%"></div></div>
        </div>
        <div class="goal-item">
          <div class="goal-label"><span>Historical Divergence</span><strong>${Math.round(this.state.divergence)}/${WIN_CONDITIONS.minDivergence}%</strong></div>
          <div class="mini-bar"><div class="bar-purple" style="width:${divProgress}%"></div></div>
        </div>
        <div class="goal-item">
          <div class="goal-label"><span>Enlightened Innovators</span><strong>${this.state.populationByTier.innovators}/${WIN_CONDITIONS.minInnovators}</strong></div>
          <div class="mini-bar"><div class="bar-gold" style="width:${innProgress}%"></div></div>
        </div>
      </div>
    `;
  }

  public renderTechModal(): void {
    const container = document.getElementById('tech-grid-container');
    if (!container) return;

    container.innerHTML = TECHNOLOGY_LIST.map((tech) => {
      const unlocked = this.state.unlockedTechIds.includes(tech.id);
      const check = canUnlockTech(this.state, tech.id);

      const effectsList = tech.effects
        .map((eff) => `<li>✨ ${eff.description}</li>`)
        .join('');

      const prereqNames = tech.prerequisites
        .map((p) => TECHNOLOGIES[p]?.name ?? p)
        .join(', ');

      return `
        <div class="tech-card ${unlocked ? 'tech-unlocked' : check.valid ? 'tech-available' : 'tech-locked'}">
          <div class="tech-card-header">
            <span class="tech-icon">${tech.icon}</span>
            <div>
              <h4>${tech.name}</h4>
              <span class="era-badge">${tech.eraOrigin}</span>
            </div>
            <span class="tech-cost-badge">⏳ ${tech.insightCost} Insight</span>
          </div>
          <p class="tech-flavor">"${tech.flavorText}"</p>
          <ul class="tech-effects">${effectsList}</ul>
          <div class="tech-impacts">
            <span class="impact-div">🔀 +${tech.divergenceImpact}% Divergence</span>
            <span class="impact-par">⚡ +${tech.paradoxImpact}% Paradox</span>
          </div>
          ${
            prereqNames
              ? `<div class="tech-prereq">Requires: ${prereqNames}</div>`
              : ''
          }
          <div class="tech-action">
            ${
              unlocked
                ? `<span class="unlocked-pill">✓ Integrated into Colony</span>`
                : `<button class="btn-unlock-tech ${check.valid ? '' : 'btn-disabled'}" data-tech-id="${tech.id}" ${check.valid ? '' : 'disabled'}>
                    ${check.valid ? `Unlock with ${tech.insightCost} Insight` : check.reason}
                  </button>`
            }
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll<HTMLButtonElement>('[data-tech-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const techId = btn.dataset.techId!;
        const res = unlockTech(this.state, techId);
        if (res.success) {
          const tech = TECHNOLOGIES[techId];
          this.showToast(
            `Unlocked ${tech.name}! Anachronistic methods automatically applied.`,
            'success'
          );
          this.renderTechModal();
          this.renderBuildToolbar();
          this.renderInspector();
          this.updateHUD();
        } else if (res.reason) {
          this.showToast(res.reason, 'warn');
        }
      });
    });
  }

  public renderChronicleModal(): void {
    const container = document.getElementById('chronicle-list-container');
    if (!container) return;

    container.innerHTML = this.state.chronicle
      .map(
        (entry) => `
        <div class="chronicle-item chron-${entry.category}">
          <div class="chronicle-meta">
            <span class="chron-year">${entry.yearText} (Day ${entry.day})</span>
            <span class="chron-badge">${entry.category.toUpperCase()}</span>
          </div>
          <h4>${entry.title}</h4>
          <p>${entry.text}</p>
        </div>
      `
      )
      .join('');
  }

  public renderEventModal(): void {
    const modal = document.getElementById('modal-event');
    const body = document.getElementById('event-modal-body');
    if (!modal || !body) return;

    if (!this.state.activeEventId) {
      modal.classList.add('hidden');
      return;
    }

    const evt = HISTORICAL_EVENTS.find((e) => e.id === this.state.activeEventId);
    if (!evt) {
      modal.classList.add('hidden');
      return;
    }

    modal.classList.remove('hidden');

    const choicesHtml = evt.choices
      .map((c) => {
        const canAfford = hasEnoughResources(this.state, c.cost).ok;
        const costText = c.cost
          ? Object.entries(c.cost)
              .map(([k, v]) => `${RESOURCES[k as ResourceId].icon} ${v} ${RESOURCES[k as ResourceId].shortName}`)
              .join(', ')
          : 'Free';

        const effectBadges: string[] = [];
        if (c.effects.divergenceDelta) {
          effectBadges.push(
            `🔀 ${c.effects.divergenceDelta > 0 ? '+' : ''}${c.effects.divergenceDelta}% Divergence`
          );
        }
        if (c.effects.paradoxDelta) {
          effectBadges.push(
            `⚡ ${c.effects.paradoxDelta > 0 ? '+' : ''}${c.effects.paradoxDelta}% Paradox`
          );
        }
        if (c.effects.happinessModifierDelta) {
          effectBadges.push(
            `😊 ${c.effects.happinessModifierDelta > 0 ? '+' : ''}${c.effects.happinessModifierDelta} Happiness`
          );
        }

        return `
          <div class="event-choice-card ${c.isAnachronistic ? 'choice-anach' : ''}">
            <div class="choice-header">
              <strong>${c.label}</strong>
              ${c.isAnachronistic ? '<span class="anach-tag">⏳ Time-Traveler Intervention</span>' : '<span class="hist-tag">📜 Historical Response</span>'}
            </div>
            <p class="choice-preview">${c.outcomeText}</p>
            <div class="choice-footer">
              <span class="choice-cost">Cost: <strong>${costText}</strong></span>
              <span class="choice-effects">${effectBadges.join(' • ')}</span>
            </div>
            <button class="btn-choose-event ${canAfford ? '' : 'btn-disabled'}" data-choice-id="${c.id}" ${canAfford ? '' : 'disabled'}>
              ${canAfford ? 'Enact Decision' : 'Insufficient Resources'}
            </button>
          </div>
        `;
      })
      .join('');

    body.innerHTML = `
      <div class="event-header">
        <span class="event-year-pill">📅 ${evt.year}</span>
        <h3>${evt.title}</h3>
      </div>
      <p class="event-description">${evt.description}</p>
      <div class="historical-note">
        <strong>📖 Original Timeline Record:</strong> ${evt.historicalContext}
      </div>
      <div class="event-choices-list">${choicesHtml}</div>
    `;

    body.querySelectorAll<HTMLButtonElement>('[data-choice-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choiceId = btn.dataset.choiceId!;
        const res = resolveHistoricalEvent(this.state, evt.id, choiceId);
        if (res.success) {
          this.state.speed = 1;
          this.lastRenderedEventId = null;
          modal.classList.add('hidden');
          this.showToast(res.outcomeText ?? 'Timeline updated.', 'success');
          this.updateHUD();
          this.renderInspector();
        } else if (res.reason) {
          this.showToast(res.reason, 'warn');
        }
      });
    });
  }
}
