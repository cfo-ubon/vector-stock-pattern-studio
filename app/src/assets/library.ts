import type { AssetLibraryFavorites, AssetPack } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 7 "Asset Collections":
// Favorites, Collections (Packs), and Templates (Packs flagged as
// reusable starter kits). Pure reducers over a plain, JSON-serializable
// state object, persisted to localStorage — the exact same shape/
// convention `workbench/workbenchFavorites.ts` already established for
// Trend Packs/Style DNA/Palettes/Marketplaces, applied here to real
// asset ids instead. "Libraries" (Section 7's fourth named concept) is
// the full persisted Asset store itself (`storage/assetStore.ts`) — this
// module only manages which of those library assets are favorited or
// grouped into a pack, it doesn't duplicate the library's own storage.

const STORAGE_KEY = 'vsp-asset-favorites-v1';

export function emptyAssetFavorites(): AssetLibraryFavorites {
  return { assetIds: [], packs: [] };
}

export function loadAssetFavorites(): AssetLibraryFavorites {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAssetFavorites();
    const parsed = JSON.parse(raw) as Partial<AssetLibraryFavorites>;
    return {
      assetIds: Array.isArray(parsed.assetIds) ? parsed.assetIds.filter((id): id is string => typeof id === 'string') : [],
      packs: Array.isArray(parsed.packs) ? parsed.packs.filter(isValidPack) : [],
    };
  } catch {
    return emptyAssetFavorites();
  }
}

function isValidPack(value: unknown): value is AssetPack {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<AssetPack>;
  return typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.assetIds) && typeof p.createdAt === 'number' && typeof p.isTemplate === 'boolean';
}

export function saveAssetFavorites(favorites: AssetLibraryFavorites): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // storage unavailable — favorites just won't persist across reloads
  }
}

export function toggleFavoriteAsset(favorites: AssetLibraryFavorites, assetId: string): AssetLibraryFavorites {
  const isFavorite = favorites.assetIds.includes(assetId);
  return { ...favorites, assetIds: isFavorite ? favorites.assetIds.filter((id) => id !== assetId) : [...favorites.assetIds, assetId] };
}

function makePackId(): string {
  return `pack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAssetPack(favorites: AssetLibraryFavorites, name: string, assetIds: string[], isTemplate = false): AssetLibraryFavorites {
  const pack: AssetPack = { id: makePackId(), name, assetIds: [...assetIds], createdAt: Date.now(), isTemplate };
  return { ...favorites, packs: [pack, ...favorites.packs] };
}

export function removeAssetPack(favorites: AssetLibraryFavorites, packId: string): AssetLibraryFavorites {
  return { ...favorites, packs: favorites.packs.filter((p) => p.id !== packId) };
}

export function addAssetToPack(favorites: AssetLibraryFavorites, packId: string, assetId: string): AssetLibraryFavorites {
  return {
    ...favorites,
    packs: favorites.packs.map((p) => (p.id === packId && !p.assetIds.includes(assetId) ? { ...p, assetIds: [...p.assetIds, assetId] } : p)),
  };
}

export function removeAssetFromPack(favorites: AssetLibraryFavorites, packId: string, assetId: string): AssetLibraryFavorites {
  return { ...favorites, packs: favorites.packs.map((p) => (p.id === packId ? { ...p, assetIds: p.assetIds.filter((id) => id !== assetId) } : p)) };
}

export function listTemplates(favorites: AssetLibraryFavorites): AssetPack[] {
  return favorites.packs.filter((p) => p.isTemplate);
}

export function listCollections(favorites: AssetLibraryFavorites): AssetPack[] {
  return favorites.packs.filter((p) => !p.isTemplate);
}
