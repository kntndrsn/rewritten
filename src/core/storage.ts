import { type GameState, recalculateNetworkAndCapacities } from './simulation.ts';

const STORAGE_KEY = 'rewritten_save_v1';

export function saveGameToStorage(state: GameState): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGameFromStorage(): GameState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || !parsed.tiles || !parsed.resources) return null;
    recalculateNetworkAndCapacities(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
