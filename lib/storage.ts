import { BoardState, BoardSettings } from "./boardTypes";
import { STORAGE_KEY } from "./constants";

const SETTINGS_KEY = "affinity-settings";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function saveBoard(boardState: BoardState): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boardState));
  } catch (e) {
    console.error("Failed to save board:", e);
  }
}

export function loadBoard(): BoardState | null {
  if (!isBrowser()) return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as BoardState;
  } catch (e) {
    console.error("Failed to load board:", e);
    return null;
  }
}

export function clearBoard(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear board:", e);
  }
}

export function saveSettings(settings: BoardSettings): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

export function loadSettings(): BoardSettings | null {
  if (!isBrowser()) return null;
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return null;
    return JSON.parse(data) as BoardSettings;
  } catch (e) {
    console.error("Failed to load settings:", e);
    return null;
  }
}
