import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';
import { deriveAssetRelationships } from './relationships';
import { validateAssetPool, isAssetPoolValid, validateAssetRelationshipIntegrity, isAssetRelationshipIntegrityValid } from './validation';

function realAssets(categoryId: string, seed: string) {
  return extractAssetsFromCollection(generateCollection({ ...defaultParams(), categoryId, seed }));
}

describe('validateAssetPool', () => {
  it('every real extracted asset passes its own schema', () => {
    const assets = realAssets('botanical', 'validate-1');
    const results = validateAssetPool(assets);
    const bad = results.filter((r) => r.issues.length > 0);
    expect(bad).toEqual([]);
    expect(isAssetPoolValid(assets)).toBe(true);
  });

  it('flags a schema violation on a real asset with a field mutated to the wrong type', () => {
    const [asset] = realAssets('botanical', 'validate-2');
    const broken = { ...asset, metadata: { ...asset.metadata, complexity: 'not-a-number' as unknown as number } };
    const results = validateAssetPool([broken]);
    expect(results[0].issues.length).toBeGreaterThan(0);
    expect(isAssetPoolValid([broken])).toBe(false);
  });
});

describe('validateAssetRelationshipIntegrity', () => {
  it('every real derived relationship resolves to real asset ids', () => {
    const assets = realAssets('botanical', 'validate-3');
    const relationships = deriveAssetRelationships(assets);
    const results = validateAssetRelationshipIntegrity(assets, relationships);
    expect(results.every((r) => r.issues.length === 0)).toBe(true);
    expect(isAssetRelationshipIntegrityValid(assets, relationships)).toBe(true);
  });

  it('every real asset\'s categoryId resolves to a real knowledge/motif record', () => {
    const assets = realAssets('botanical', 'validate-4');
    const results = validateAssetRelationshipIntegrity(assets, []);
    expect(results.every((r) => r.issues.length === 0)).toBe(true);
  });

  it('flags a relationship referencing an unknown asset id', () => {
    const assets = realAssets('botanical', 'validate-5');
    const badRelationships = [{ fromAssetId: assets[0].metadata.id, toAssetId: 'does-not-exist', type: 'sameFamily' as const, note: 'bad' }];
    const results = validateAssetRelationshipIntegrity(assets, badRelationships);
    const badEntry = results.find((r) => r.id === `${assets[0].metadata.id}->does-not-exist`);
    expect(badEntry).toBeDefined();
    expect(badEntry?.issues[0].path).toBe('toAssetId');
  });

  it('flags an asset with an unknown categoryId', () => {
    const [asset] = realAssets('botanical', 'validate-6');
    const broken = { ...asset, metadata: { ...asset.metadata, categoryId: 'not-a-real-category' } };
    const results = validateAssetRelationshipIntegrity([broken], []);
    expect(results[0].issues.length).toBeGreaterThan(0);
  });
});
