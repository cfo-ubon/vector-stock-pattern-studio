import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';
import { deriveAssetRelationships, relationshipsForAsset } from './relationships';

function collectionAssets(categoryId: string, seed: string) {
  return extractAssetsFromCollection(generateCollection({ ...defaultParams(), categoryId, seed }));
}

describe('deriveAssetRelationships', () => {
  it('derives a real flowerToLeaf relationship across a botanical + tropical collection pair', () => {
    const flowerAssets = collectionAssets('botanical', 'rel-flower-1');
    const leafAssets = collectionAssets('tropical', 'rel-leaf-1');
    const relationships = deriveAssetRelationships([...flowerAssets, ...leafAssets]);
    const flowerToLeaf = relationships.filter((r) => r.type === 'flowerToLeaf');
    expect(flowerToLeaf.length).toBeGreaterThan(0);
    for (const rel of flowerToLeaf) {
      const from = [...flowerAssets, ...leafAssets].find((a) => a.metadata.id === rel.fromAssetId);
      const to = [...flowerAssets, ...leafAssets].find((a) => a.metadata.id === rel.toAssetId);
      expect(from?.metadata.family).toBe('flower');
      expect(to?.metadata.family).toBe('leaf');
    }
  });

  it('derives real borderToCorner relationships within one collection via shared motif ids', () => {
    const assets = collectionAssets('botanical', 'rel-border-1');
    const relationships = deriveAssetRelationships(assets);
    const borderToCorner = relationships.filter((r) => r.type === 'borderToCorner');
    expect(borderToCorner.length).toBeGreaterThan(0);
    for (const rel of borderToCorner) {
      const border = assets.find((a) => a.metadata.id === rel.fromAssetId);
      const frame = assets.find((a) => a.metadata.id === rel.toAssetId);
      expect(border?.metadata.kind).toBe('border');
      expect(frame?.metadata.kind).toBe('frame');
      const shared = border!.metadata.sourceMotifIds.filter((id) => frame!.metadata.sourceMotifIds.includes(id));
      expect(shared.length).toBeGreaterThan(0);
    }
  });

  it('derives a real collectionToAsset relationship for every extracted asset', () => {
    const assets = collectionAssets('botanical', 'rel-collection-1');
    const relationships = deriveAssetRelationships(assets);
    const collectionToAsset = relationships.filter((r) => r.type === 'collectionToAsset');
    expect(collectionToAsset.length).toBe(assets.length);
    for (const asset of assets) {
      expect(collectionToAsset.some((r) => r.toAssetId === asset.metadata.id)).toBe(true);
    }
  });

  it('derives sameFamily relationships only across different collections, never within one', () => {
    const assets = collectionAssets('botanical', 'rel-samefamily-1');
    const relationships = deriveAssetRelationships(assets);
    expect(relationships.filter((r) => r.type === 'sameFamily').length).toBe(0);

    const otherCollectionAssets = collectionAssets('botanical', 'rel-samefamily-2');
    const combined = deriveAssetRelationships([...assets, ...otherCollectionAssets]);
    const sameFamily = combined.filter((r) => r.type === 'sameFamily');
    expect(sameFamily.length).toBeGreaterThan(0);
    for (const rel of sameFamily) {
      const from = [...assets, ...otherCollectionAssets].find((a) => a.metadata.id === rel.fromAssetId);
      const to = [...assets, ...otherCollectionAssets].find((a) => a.metadata.id === rel.toAssetId);
      expect(from?.metadata.sourceCollectionId).not.toBe(to?.metadata.sourceCollectionId);
    }
  });

  it('relationshipsForAsset returns every relationship touching that asset in either direction', () => {
    const assets = collectionAssets('botanical', 'rel-lookup-1');
    const relationships = deriveAssetRelationships(assets);
    const target = assets[0];
    const found = relationshipsForAsset(relationships, target.metadata.id);
    for (const rel of found) {
      expect(rel.fromAssetId === target.metadata.id || rel.toAssetId === target.metadata.id).toBe(true);
    }
    expect(found.length).toBeGreaterThan(0);
  });
});
