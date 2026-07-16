import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { extractAssetsFromCollection } from './extraction';
import { evaluateAssetQuality } from './qualityScore';

function realAssets(categoryId: string, seed: string) {
  return extractAssetsFromCollection(generateCollection({ ...defaultParams(), categoryId, seed }));
}

describe('evaluateAssetQuality', () => {
  it('every dimension is a real number within 0-100', () => {
    const assets = realAssets('botanical', 'quality-1');
    for (const asset of assets) {
      const score = evaluateAssetQuality(asset);
      for (const key of ['reusability', 'complexity', 'commercialUsefulness', 'compatibility', 'overall'] as const) {
        expect(score[key]).toBeGreaterThanOrEqual(0);
        expect(score[key]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('reuses the asset\'s own real complexity value directly, not a recomputed one', () => {
    const assets = realAssets('botanical', 'quality-2');
    for (const asset of assets) {
      expect(evaluateAssetQuality(asset).complexity).toBe(asset.metadata.complexity);
    }
  });

  it('gives assets with no styleDnaId the neutral commercial baseline, not 0', () => {
    const assets = realAssets('botanical', 'quality-3');
    const noStyle = assets.find((a) => !a.metadata.styleDnaId);
    expect(noStyle).toBeDefined();
    if (noStyle) expect(evaluateAssetQuality(noStyle).commercialUsefulness).toBe(40);
  });

  it('compatibility scales with the real number of compatible pattern grammars', () => {
    const assets = realAssets('botanical', 'quality-4');
    for (const asset of assets) {
      const score = evaluateAssetQuality(asset);
      if (asset.metadata.patternTypes.length === 0) expect(score.compatibility).toBe(0);
      else expect(score.compatibility).toBeGreaterThan(0);
    }
  });

  it('overall is the real average of the other three dimensions plus complexity', () => {
    const assets = realAssets('botanical', 'quality-5');
    for (const asset of assets) {
      const score = evaluateAssetQuality(asset);
      const expected = Math.round((score.reusability + score.complexity + score.commercialUsefulness + score.compatibility) / 4);
      expect(score.overall).toBe(expected);
    }
  });
});
