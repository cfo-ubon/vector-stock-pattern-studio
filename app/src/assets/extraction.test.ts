import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';

function botanicalCollection(seed: string) {
  return generateCollection({ ...defaultParams(), categoryId: 'botanical', seed });
}

describe('extractAssetsFromCollection', () => {
  it('extracts one asset per real FactoryMotif plus 4 borders and 4 frames', () => {
    const collection = botanicalCollection('extract-1');
    const assets = extractAssetsFromCollection(collection);
    expect(assets.filter((a) => a.metadata.kind === 'border').length).toBe(4);
    expect(assets.filter((a) => a.metadata.kind === 'frame').length).toBe(4);
    expect(assets.length).toBe(collection.motifs.length + 8);
  });

  it('every asset carries a real, non-empty SvgNode and positive dimensions', () => {
    const assets = extractAssetsFromCollection(botanicalCollection('extract-2'));
    for (const asset of assets) {
      expect(asset.node).toBeDefined();
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(asset.radius).toBeGreaterThanOrEqual(0);
    }
  });

  it('hero-role motifs are always kind heroMotif regardless of family', () => {
    const collection = botanicalCollection('extract-3');
    const assets = extractAssetsFromCollection(collection);
    const heroSourceMotifs = collection.motifs.filter((m) => m.role === 'hero');
    for (const motif of heroSourceMotifs) {
      const asset = assets.find((a) => a.metadata.sourceMotifIds.includes(motif.id) && a.metadata.kind !== 'border' && a.metadata.kind !== 'frame');
      expect(asset?.metadata.kind).toBe('heroMotif');
    }
  });

  it('reuses the real FactoryMotif.complexity value directly, not a recomputed one', () => {
    const collection = botanicalCollection('extract-4');
    const assets = extractAssetsFromCollection(collection);
    const motifAsset = assets.find((a) => a.metadata.sourceMotifIds.length === 1 && a.metadata.kind !== 'border' && a.metadata.kind !== 'frame');
    expect(motifAsset).toBeDefined();
    if (motifAsset) {
      const sourceMotif = collection.motifs.find((m) => m.id === motifAsset.metadata.sourceMotifIds[0]);
      expect(motifAsset.metadata.complexity).toBe(sourceMotif?.complexity);
    }
  });

  it('border and frame assets reference real motif ids from the collection filler pool', () => {
    const collection = botanicalCollection('extract-5');
    const assets = extractAssetsFromCollection(collection);
    const fillerIds = new Set(collection.motifs.filter((m) => m.role === 'filler').map((m) => m.id));
    for (const asset of assets.filter((a) => a.metadata.kind === 'border' || a.metadata.kind === 'frame')) {
      expect(asset.metadata.sourceMotifIds.length).toBeGreaterThan(0);
      for (const id of asset.metadata.sourceMotifIds) expect(fillerIds.has(id)).toBe(true);
    }
  });

  it('border extraction is fully deterministic for the same collection', () => {
    const collectionA = botanicalCollection('extract-deterministic');
    const collectionB = botanicalCollection('extract-deterministic');
    const assetsA = extractAssetsFromCollection(collectionA);
    const assetsB = extractAssetsFromCollection(collectionB);
    const borderA = assetsA.find((a) => a.metadata.kind === 'border');
    const borderB = assetsB.find((a) => a.metadata.kind === 'border');
    expect(borderA?.node).toEqual(borderB?.node);
    expect(borderA?.metadata.sourceMotifIds).toEqual(borderB?.metadata.sourceMotifIds);
  });

  it('populates real compatibility data from the Design Knowledge Engine, not a fabricated list', () => {
    const assets = extractAssetsFromCollection(botanicalCollection('extract-6'));
    const asset = assets[0];
    expect(asset.metadata.patternTypes.length).toBeGreaterThan(0);
    expect(asset.metadata.patternTypes).toEqual(asset.metadata.compatibility.patternGrammars);
  });

  it('every asset id is unique and stable across the whole extraction', () => {
    const assets = extractAssetsFromCollection(botanicalCollection('extract-7'));
    const ids = assets.map((a) => a.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
