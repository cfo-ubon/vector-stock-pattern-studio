import { describe, it, expect } from 'vitest';
import { classifyDuplicateCandidate } from './duplicateClassification';
import type { DuplicateClassificationCandidate } from './duplicateClassification';

function candidate(overrides: Partial<DuplicateClassificationCandidate> = {}): DuplicateClassificationCandidate {
  return {
    productionAssetId: 'PAID-aaaa',
    sourceHashes: ['hash-a'],
    generatorVersion: '1.79',
    styleDna: 'luxuryFloral',
    presetId: 'luxuryFloral',
    compositionType: 'bouquet',
    productTargets: ['fabric'],
    generatorSeed: 'm25-1',
    ...overrides,
  };
}

describe('classifyDuplicateCandidate', () => {
  it('returns NOT_DUPLICATE with no existing assets', () => {
    const result = classifyDuplicateCandidate(candidate(), []);
    expect(result.classification).toBe('NOT_DUPLICATE');
    expect(result.matchedAgainstIndex).toBeNull();
    expect(result.reasons).toEqual([]);
  });

  it('classifies EXACT_DUPLICATE on matching productionAssetId', () => {
    const existing = [candidate({ productionAssetId: 'PAID-aaaa', sourceHashes: ['hash-x'] })];
    const result = classifyDuplicateCandidate(candidate({ productionAssetId: 'PAID-aaaa' }), existing);
    expect(result.classification).toBe('EXACT_DUPLICATE');
    expect(result.matchedAgainstIndex).toBe(0);
    expect(result.reasons[0]).toMatch(/productionAssetId/);
  });

  it('classifies EXACT_DUPLICATE on overlapping source hash even with different productionAssetId', () => {
    const existing = [candidate({ productionAssetId: 'PAID-bbbb', sourceHashes: ['shared-hash'] })];
    const result = classifyDuplicateCandidate(
      candidate({ productionAssetId: 'PAID-cccc', sourceHashes: ['shared-hash'] }),
      existing,
    );
    expect(result.classification).toBe('EXACT_DUPLICATE');
  });

  it('classifies CONFIG_DUPLICATE for same recipe, different seed', () => {
    const existing = [candidate({ productionAssetId: 'PAID-other', sourceHashes: ['hash-other'], generatorSeed: 'm25-2' })];
    const result = classifyDuplicateCandidate(
      candidate({ productionAssetId: 'PAID-mine', sourceHashes: ['hash-mine'], generatorSeed: 'm25-1' }),
      existing,
    );
    expect(result.classification).toBe('CONFIG_DUPLICATE');
  });

  it('classifies SEED_DUPLICATE for same seed+preset but different composition', () => {
    const existing = [
      candidate({ productionAssetId: 'PAID-other', sourceHashes: ['hash-other'], generatorSeed: 'm25-1', compositionType: 'heroScatter' }),
    ];
    const result = classifyDuplicateCandidate(
      candidate({ productionAssetId: 'PAID-mine', sourceHashes: ['hash-mine'], generatorSeed: 'm25-1', compositionType: 'bouquet' }),
      existing,
    );
    expect(result.classification).toBe('SEED_DUPLICATE');
  });

  it('classifies POSSIBLE_VISUAL_DUPLICATE via real shape-signature similarity (different preset, so it is not also a CONFIG_DUPLICATE)', () => {
    const shapes = ['circle-r10', 'petal-5', 'leaf-oval'];
    const existing = [
      candidate({
        productionAssetId: 'PAID-other',
        sourceHashes: ['hash-other'],
        generatorSeed: 'm25-2',
        presetId: 'darkBotanical',
        shapeSignatures: shapes,
      }),
    ];
    const result = classifyDuplicateCandidate(
      candidate({
        productionAssetId: 'PAID-mine',
        sourceHashes: ['hash-mine'],
        generatorSeed: 'm25-3',
        presetId: 'luxuryFloral',
        shapeSignatures: shapes,
      }),
      existing,
    );
    expect(result.classification).toBe('POSSIBLE_VISUAL_DUPLICATE');
    expect(result.shapeSimilarity).toBe(1);
  });

  it('classifies POSSIBLE_VISUAL_DUPLICATE via the disclosed structural-family fallback when no shape signatures exist', () => {
    const existing = [
      candidate({ productionAssetId: 'PAID-other', sourceHashes: ['hash-other'], generatorSeed: 'm25-2', generatorVersion: '1.80' }),
    ];
    const result = classifyDuplicateCandidate(
      candidate({ productionAssetId: 'PAID-mine', sourceHashes: ['hash-mine'], generatorSeed: 'm25-3', generatorVersion: '1.79' }),
      existing,
    );
    expect(result.classification).toBe('POSSIBLE_VISUAL_DUPLICATE');
    expect(result.shapeSimilarity).toBeUndefined();
  });

  it('classifies NOT_DUPLICATE for an unrelated design', () => {
    const existing = [
      candidate({
        productionAssetId: 'PAID-other',
        sourceHashes: ['hash-other'],
        styleDna: 'darkBotanical',
        compositionType: 'toss',
        productTargets: ['wallpaper'],
        generatorSeed: 'zzz-9',
      }),
    ];
    const result = classifyDuplicateCandidate(
      candidate({ productionAssetId: 'PAID-mine', sourceHashes: ['hash-mine'] }),
      existing,
    );
    expect(result.classification).toBe('NOT_DUPLICATE');
  });

  it('reports the strongest classification across multiple existing candidates regardless of order', () => {
    const weakMatch = candidate({
      productionAssetId: 'PAID-weak',
      sourceHashes: ['weak-hash'],
      styleDna: 'darkBotanical',
      compositionType: 'toss',
      productTargets: ['wallpaper'],
      generatorSeed: 'zzz-9',
    });
    const exactMatch = candidate({ productionAssetId: 'PAID-aaaa', sourceHashes: ['exact-hash'] });
    const result = classifyDuplicateCandidate(candidate({ productionAssetId: 'PAID-aaaa' }), [weakMatch, exactMatch]);
    expect(result.classification).toBe('EXACT_DUPLICATE');
    expect(result.matchedAgainstIndex).toBe(1);
  });

  it('never blocks — only classifies (NOT_DUPLICATE candidates are still returned, not thrown/rejected)', () => {
    expect(() => classifyDuplicateCandidate(candidate(), [])).not.toThrow();
  });

  it('treats differently-ordered productTargets as the same config (order must not matter)', () => {
    const existing = [
      candidate({ productionAssetId: 'PAID-other', sourceHashes: ['hash-other'], generatorSeed: 'm25-2', productTargets: ['wallpaper', 'fabric'] }),
    ];
    const result = classifyDuplicateCandidate(
      candidate({ productionAssetId: 'PAID-mine', sourceHashes: ['hash-mine'], generatorSeed: 'm25-1', productTargets: ['fabric', 'wallpaper'] }),
      existing,
    );
    expect(result.classification).toBe('CONFIG_DUPLICATE');
  });
});
