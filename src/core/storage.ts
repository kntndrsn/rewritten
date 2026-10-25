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
    if (typeof parsed.introSeen !== 'boolean') parsed.introSeen = true;
    if (typeof parsed.tutorialActive !== 'boolean') parsed.tutorialActive = false;
    if (typeof parsed.tutorialStepIndex !== 'number') parsed.tutorialStepIndex = 0;
    if (typeof parsed.tutorialCompleted !== 'boolean') parsed.tutorialCompleted = true;
    if (typeof parsed.trunksUnsealed !== 'boolean') parsed.trunksUnsealed = true;
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
