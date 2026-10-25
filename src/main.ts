import { type GameState, createInitialGameState, stepSimulation } from './core/simulation.ts';
import { loadGameFromStorage, saveGameToStorage } from './core/storage.ts';
import { CanvasRenderer } from './render/canvasRenderer.ts';
import { GameUI } from './ui/gameUI.ts';

declare global {
  interface Window {
    __REWRITTEN__?: {
      getState: () => GameState;
      step: (seconds: number) => void;
    };
  }
}

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('#game-canvas element not found');
  }

  let state: GameState = loadGameFromStorage() ?? createInitialGameState(1607, true);
  const renderer = new CanvasRenderer(canvas);
  renderer.centerOnTile(8, 8);

  const resetGame = () => {
    state = createInitialGameState(1607, true);
    ui.setState(state);
    renderer.selectedTile = { x: 7, y: 8 };
    renderer.centerOnTile(8, 8);
    ui.renderInspector();
  };

  const ui = new GameUI(state, renderer, resetGame);

  // Dismiss victory modal button
  document.getElementById('btn-dismiss-victory')?.addEventListener('click', () => {
    state.winDismissed = true;
    ui.updateHUD();
  });

  window.__REWRITTEN__ = {
    getState: () => state,
    step: (seconds: number) => {
      stepSimulation(state, seconds);
      ui.updateHUD();
      ui.renderInspector();
    }
  };

  let lastFrameTime = performance.now();
  let uiRefreshTimer = 0;
  let autoSaveTimer = 0;

  function frame(now: number): void {
    const rawDt = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    if (state.speed > 0 && !state.activeEventId) {
      stepSimulation(state, rawDt * state.speed);
    }

    renderer.render(state, rawDt);

    uiRefreshTimer += rawDt;
    if (uiRefreshTimer >= 0.25) {
      uiRefreshTimer = 0;
      ui.updateHUD();
      if (renderer.selectedTile) {
        ui.renderInspector();
      }
    }

    autoSaveTimer += rawDt;
    if (autoSaveTimer >= 15) {
      autoSaveTimer = 0;
      saveGameToStorage(state);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
