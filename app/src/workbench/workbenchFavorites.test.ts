import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptyFavorites,
  loadFavorites,
  saveFavorites,
  toggleFavoriteTrendPack,
  toggleFavoriteStyleDna,
  toggleFavoritePalette,
  toggleFavoriteMarketplace,
  saveMotifCollection,
  removeMotifCollection,
} from './workbenchFavorites';

beforeEach(() => {
  localStorage.clear();
});

describe('workbenchFavorites: persistence', () => {
  it('loadFavorites returns an empty record when nothing is stored', () => {
    expect(loadFavorites()).toEqual(emptyFavorites());
  });

  it('saveFavorites persists and loadFavorites round-trips it', () => {
    const favorites = toggleFavoriteStyleDna(emptyFavorites(), 'editorialBotanical');
    saveFavorites(favorites);
    expect(loadFavorites()).toEqual(favorites);
  });

  it('loadFavorites tolerates corrupted JSON by returning an empty record', () => {
    localStorage.setItem('vsp-workbench-favorites-v1', 'not json');
    expect(loadFavorites()).toEqual(emptyFavorites());
  });

  it('loadFavorites fills in any missing keys from an older/partial stored record', () => {
    localStorage.setItem('vsp-workbench-favorites-v1', JSON.stringify({ styleDnaIds: ['a'] }));
    expect(loadFavorites()).toEqual({ ...emptyFavorites(), styleDnaIds: ['a'] });
  });
});

describe('workbenchFavorites: toggles', () => {
  it('toggleFavoriteTrendPack adds then removes an id', () => {
    let favorites = emptyFavorites();
    favorites = toggleFavoriteTrendPack(favorites, '2026-Q1');
    expect(favorites.trendPackIds).toEqual(['2026-Q1']);
    favorites = toggleFavoriteTrendPack(favorites, '2026-Q1');
    expect(favorites.trendPackIds).toEqual([]);
  });

  it('toggleFavoritePalette and toggleFavoriteMarketplace behave the same way', () => {
    let favorites = emptyFavorites();
    favorites = toggleFavoritePalette(favorites, 'pastel-dream');
    favorites = toggleFavoriteMarketplace(favorites, 'shutterstock');
    expect(favorites.paletteIds).toEqual(['pastel-dream']);
    expect(favorites.marketplaceIds).toEqual(['shutterstock']);
  });
});

describe('workbenchFavorites: motif collections', () => {
  it('saveMotifCollection adds a new named collection with a generated id', () => {
    const favorites = saveMotifCollection(emptyFavorites(), 'My Botanical Mix', {
      heroMotifs: [{ categoryId: 'botanical', role: 'hero' }],
      secondaryMotifs: [],
      fillers: [],
    });
    expect(favorites.motifCollections).toHaveLength(1);
    expect(favorites.motifCollections[0].name).toBe('My Botanical Mix');
    expect(favorites.motifCollections[0].id).toBeTruthy();
  });

  it('removeMotifCollection removes only the targeted collection', () => {
    let favorites = saveMotifCollection(emptyFavorites(), 'A', { heroMotifs: [], secondaryMotifs: [], fillers: [] });
    favorites = saveMotifCollection(favorites, 'B', { heroMotifs: [], secondaryMotifs: [], fillers: [] });
    const idToRemove = favorites.motifCollections[0].id;
    favorites = removeMotifCollection(favorites, idToRemove);
    expect(favorites.motifCollections).toHaveLength(1);
    expect(favorites.motifCollections[0].name).toBe('B');
  });
});
