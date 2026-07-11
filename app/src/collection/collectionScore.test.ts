import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { STYLE_DNA_PRESETS, resolveStyleDna } from '../engine/styleDna';
import { generateCollection } from './collectionGenerator';
import { computeCollectionScore, REQUIRED_ASSET_TYPES } from './collectionScore';

describe('computeCollectionScore', () => {
  it('scores a normal, positive-path collection at 100 on every dimension', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-score-clean' });
    const score = computeCollectionScore(collection);
    expect(score.styleConsistency).toBe(100);
    expect(score.paletteConsistency).toBe(100);
    expect(score.motifConsistency).toBe(100);
    expect(score.flowConsistency).toBe(100);
    expect(score.commercialReadiness).toBe(100);
    expect(score.overall).toBe(100);
    expect(score.issues).toEqual([]);
  });

  it('carries the active Style DNA through to a consistent score', () => {
    const dna = STYLE_DNA_PRESETS.darkBotanical;
    const params = { ...defaultParams(), ...resolveStyleDna(dna, 'collection-score-dna'), seed: 'collection-score-dna' };
    const collection = generateCollection(params, dna);
    const score = computeCollectionScore(collection);
    expect(score.styleConsistency).toBe(100);
    expect(score.overall).toBe(100);
  });

  it('is fully deterministic for the same base params', () => {
    const params = { ...defaultParams(), seed: 'collection-score-det' };
    const a = computeCollectionScore(generateCollection(params));
    const b = computeCollectionScore(generateCollection(params));
    expect(a).toEqual(b);
  });

  it('genuinely flags a real palette disagreement — regression guard', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-score-mismatch' });
    // Simulate a drifted asset by mutating one pattern's palette in the
    // already-generated patternParams the same way a real bug would.
    const drifted = { ...collection, patternParams: [collection.patternParams[0], { ...collection.patternParams[1], paletteId: 'jewel-tones' }, ...collection.patternParams.slice(2)] };
    const score = computeCollectionScore(drifted);
    expect(score.paletteConsistency).toBeLessThan(100);
    expect(score.issues.some((i) => i.includes('Palette'))).toBe(true);
  });

  it('penalizes commercialReadiness when a required asset type is missing', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-score-missing' });
    const withoutPreview = { ...collection, assets: collection.assets.filter((a) => a.type !== 'collectionPreview') };
    const score = computeCollectionScore(withoutPreview);
    expect(score.commercialReadiness).toBeLessThan(100);
    expect(score.issues.some((i) => i.includes('collectionPreview'))).toBe(true);
  });

  it('penalizes commercialReadiness when an asset has structurally invalid SVG', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-score-invalid-svg' });
    const heroIndex = collection.assets.findIndex((a) => a.type === 'heroPattern');
    const brokenAssets = [...collection.assets];
    brokenAssets[heroIndex] = { ...brokenAssets[heroIndex], svg: brokenAssets[heroIndex].svg!.replace('0', 'NaN') };
    const score = computeCollectionScore({ ...collection, assets: brokenAssets });
    expect(score.commercialReadiness).toBeLessThan(100);
  });

  it('requires exactly the 10 core creative asset types', () => {
    expect(REQUIRED_ASSET_TYPES).toEqual([
      'heroPattern', 'secondaryPattern', 'blenderPattern', 'miniPattern', 'stripePattern',
      'borderPattern', 'cornerPattern', 'spotMotifSheet', 'decorativeElementsSheet', 'collectionPreview',
    ]);
  });
});
