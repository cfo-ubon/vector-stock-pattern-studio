import type { StyleDna } from '../engine/styleDna';

// Style DNA Manager persistence — custom (user-created/duplicated) styles
// and favorites. Unlike storage/savedStore.ts (dense SVG pattern data, needs
// IndexedDB's much larger quota), a Style DNA is a small plain-JSON config
// object — a few dozen of them sit comfortably inside localStorage's ~5MB
// cap, so there's no need for the heavier IndexedDB machinery here.

const CUSTOM_STYLES_KEY = 'vsp-style-dna-custom-v1';
const FAVORITES_KEY = 'vsp-style-dna-favorites-v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or storage unavailable — non-fatal, just doesn't persist
  }
}

export function loadCustomStyles(): StyleDna[] {
  return readJson<StyleDna[]>(CUSTOM_STYLES_KEY, []);
}

export function saveCustomStyles(styles: StyleDna[]): void {
  writeJson(CUSTOM_STYLES_KEY, styles);
}

export function loadFavoriteStyleIds(): string[] {
  return readJson<string[]>(FAVORITES_KEY, []);
}

export function saveFavoriteStyleIds(ids: string[]): void {
  writeJson(FAVORITES_KEY, ids);
}
