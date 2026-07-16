import type { DesignSpecMotifRef } from '../trend/designSpecTypes';

// Design Workbench Section 8 ("Favorites") persistence — same localStorage
// pattern as storage/styleDnaStore.ts's favorites (small plain-JSON config,
// no need for IndexedDB). One favorites record covers all 5 kinds Section 8
// names (Trend Packs, Style DNA, Palettes, Motif Collections, Marketplace
// Profiles) since they're all just id lists except Motif Collections, which
// are small named presets a user builds by hand (no existing "Motif
// Collection" concept elsewhere to reference by id — this is where it's
// defined).

const FAVORITES_KEY = 'vsp-workbench-favorites-v1';

export interface WorkbenchMotifCollection {
  id: string;
  name: string;
  createdAt: number;
  heroMotifs: DesignSpecMotifRef[];
  secondaryMotifs: DesignSpecMotifRef[];
  fillers: DesignSpecMotifRef[];
}

export interface WorkbenchFavorites {
  trendPackIds: string[];
  styleDnaIds: string[];
  paletteIds: string[];
  marketplaceIds: string[];
  motifCollections: WorkbenchMotifCollection[];
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyFavorites(): WorkbenchFavorites {
  return { trendPackIds: [], styleDnaIds: [], paletteIds: [], marketplaceIds: [], motifCollections: [] };
}

export function loadFavorites(): WorkbenchFavorites {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return emptyFavorites();
    const parsed = JSON.parse(raw) as Partial<WorkbenchFavorites>;
    return {
      trendPackIds: parsed.trendPackIds ?? [],
      styleDnaIds: parsed.styleDnaIds ?? [],
      paletteIds: parsed.paletteIds ?? [],
      marketplaceIds: parsed.marketplaceIds ?? [],
      motifCollections: parsed.motifCollections ?? [],
    };
  } catch {
    return emptyFavorites();
  }
}

export function saveFavorites(favorites: WorkbenchFavorites): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // quota exceeded or storage unavailable — non-fatal, just doesn't persist
  }
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export function toggleFavoriteTrendPack(favorites: WorkbenchFavorites, id: string): WorkbenchFavorites {
  return { ...favorites, trendPackIds: toggleId(favorites.trendPackIds, id) };
}

export function toggleFavoriteStyleDna(favorites: WorkbenchFavorites, id: string): WorkbenchFavorites {
  return { ...favorites, styleDnaIds: toggleId(favorites.styleDnaIds, id) };
}

export function toggleFavoritePalette(favorites: WorkbenchFavorites, id: string): WorkbenchFavorites {
  return { ...favorites, paletteIds: toggleId(favorites.paletteIds, id) };
}

export function toggleFavoriteMarketplace(favorites: WorkbenchFavorites, id: string): WorkbenchFavorites {
  return { ...favorites, marketplaceIds: toggleId(favorites.marketplaceIds, id) };
}

export function saveMotifCollection(
  favorites: WorkbenchFavorites,
  name: string,
  motifs: Pick<WorkbenchMotifCollection, 'heroMotifs' | 'secondaryMotifs' | 'fillers'>,
): WorkbenchFavorites {
  const collection: WorkbenchMotifCollection = { id: newId('motifcol'), name, createdAt: Date.now(), ...motifs };
  return { ...favorites, motifCollections: [...favorites.motifCollections, collection] };
}

export function removeMotifCollection(favorites: WorkbenchFavorites, id: string): WorkbenchFavorites {
  return { ...favorites, motifCollections: favorites.motifCollections.filter((c) => c.id !== id) };
}
