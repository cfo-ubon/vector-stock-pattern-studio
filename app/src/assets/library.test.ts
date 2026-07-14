import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptyAssetFavorites,
  loadAssetFavorites,
  saveAssetFavorites,
  toggleFavoriteAsset,
  createAssetPack,
  removeAssetPack,
  addAssetToPack,
  removeAssetFromPack,
  listTemplates,
  listCollections,
} from './library';

beforeEach(() => {
  localStorage.clear();
});

describe('emptyAssetFavorites / loadAssetFavorites', () => {
  it('returns an empty state when nothing is stored', () => {
    expect(loadAssetFavorites()).toEqual(emptyAssetFavorites());
  });

  it('recovers gracefully from corrupt JSON', () => {
    localStorage.setItem('vsp-asset-favorites-v1', '{not json');
    expect(loadAssetFavorites()).toEqual(emptyAssetFavorites());
  });

  it('drops malformed pack entries but keeps valid ones', () => {
    localStorage.setItem(
      'vsp-asset-favorites-v1',
      JSON.stringify({ assetIds: ['a'], packs: [{ id: 'p1', name: 'Real Pack', assetIds: [], createdAt: 1, isTemplate: false }, { id: 'bad' }] }),
    );
    const loaded = loadAssetFavorites();
    expect(loaded.assetIds).toEqual(['a']);
    expect(loaded.packs.length).toBe(1);
    expect(loaded.packs[0].id).toBe('p1');
  });
});

describe('toggleFavoriteAsset', () => {
  it('adds then removes an asset id', () => {
    let favorites = emptyAssetFavorites();
    favorites = toggleFavoriteAsset(favorites, 'asset-1');
    expect(favorites.assetIds).toContain('asset-1');
    favorites = toggleFavoriteAsset(favorites, 'asset-1');
    expect(favorites.assetIds).not.toContain('asset-1');
  });
});

describe('createAssetPack / removeAssetPack', () => {
  it('creates a Collection pack (isTemplate false) by default', () => {
    const favorites = createAssetPack(emptyAssetFavorites(), 'My Pack', ['a', 'b']);
    expect(favorites.packs.length).toBe(1);
    expect(favorites.packs[0].isTemplate).toBe(false);
    expect(favorites.packs[0].assetIds).toEqual(['a', 'b']);
  });

  it('creates a Template pack when isTemplate is true', () => {
    const favorites = createAssetPack(emptyAssetFavorites(), 'Starter Kit', ['a'], true);
    expect(favorites.packs[0].isTemplate).toBe(true);
  });

  it('removes a pack by id', () => {
    let favorites = createAssetPack(emptyAssetFavorites(), 'Pack', []);
    const packId = favorites.packs[0].id;
    favorites = removeAssetPack(favorites, packId);
    expect(favorites.packs.length).toBe(0);
  });
});

describe('addAssetToPack / removeAssetFromPack', () => {
  it('adds an asset id without duplicating it', () => {
    let favorites = createAssetPack(emptyAssetFavorites(), 'Pack', ['a']);
    const packId = favorites.packs[0].id;
    favorites = addAssetToPack(favorites, packId, 'a');
    favorites = addAssetToPack(favorites, packId, 'b');
    expect(favorites.packs[0].assetIds).toEqual(['a', 'b']);
  });

  it('removes an asset id from a pack', () => {
    let favorites = createAssetPack(emptyAssetFavorites(), 'Pack', ['a', 'b']);
    const packId = favorites.packs[0].id;
    favorites = removeAssetFromPack(favorites, packId, 'a');
    expect(favorites.packs[0].assetIds).toEqual(['b']);
  });
});

describe('listTemplates / listCollections', () => {
  it('separates template packs from ordinary collection packs', () => {
    let favorites = createAssetPack(emptyAssetFavorites(), 'Template Pack', [], true);
    favorites = createAssetPack(favorites, 'Collection Pack', [], false);
    expect(listTemplates(favorites).map((p) => p.name)).toEqual(['Template Pack']);
    expect(listCollections(favorites).map((p) => p.name)).toEqual(['Collection Pack']);
  });
});

describe('saveAssetFavorites', () => {
  it('round-trips through localStorage', () => {
    const favorites = toggleFavoriteAsset(emptyAssetFavorites(), 'asset-x');
    saveAssetFavorites(favorites);
    expect(loadAssetFavorites()).toEqual(favorites);
  });
});
