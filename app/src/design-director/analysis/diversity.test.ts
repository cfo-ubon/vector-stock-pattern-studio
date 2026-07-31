import { describe, it, expect } from 'vitest';
import { computeCollectionDiversity } from './diversity';
import { createCollectionPlan, type PatternTypeCounts } from '../domain/collectionPlan';
import { createCreativeBrief } from '../domain/creativeBrief';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { PortfolioAsset } from '../../catalog/domain/types';

const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 1, texture: 1 };

function makeAsset(displayName: string, colorPalette: string[] = []): PortfolioAsset {
  return { ...createPortfolioAsset({ displayName, originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null }), colorPalette };
}

describe('computeCollectionDiversity', () => {
  it('marks compositionRepetition/patternRepetition/collectionRepetition as unavailable rather than fabricating a value (plus paletteRepetition when no color direction is set)', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Botanical Spring', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Botanical Spring', now: 1000 });
    const result = computeCollectionDiversity(plan, brief, []);
    const unavailable = result.signals.filter((s) => !s.available);
    expect(unavailable.map((s) => s.id).sort()).toEqual(['collectionRepetition', 'compositionRepetition', 'paletteRepetition', 'patternRepetition']);
    for (const signal of unavailable) expect(signal.value).toBeUndefined();
  });

  it('counts real portfolio assets sharing the theme as hero repetition', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Botanical Spring', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Botanical Spring', now: 1000 });
    const assets = [makeAsset('Botanical Spring bouquet'), makeAsset('Botanical Spring toss'), makeAsset('Unrelated geometric')];
    const result = computeCollectionDiversity(plan, brief, assets);
    const heroRepetition = result.signals.find((s) => s.id === 'heroRepetition')!;
    expect(heroRepetition.available).toBe(true);
    expect(heroRepetition.value).toBe(2);
  });

  it('warns when theme repetition is high', () => {
    const plan = createCollectionPlan({ briefId: 'BRF-1', name: 'X', theme: 'Floral', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Floral', now: 1000 });
    const assets = Array.from({ length: 6 }, (_, i) => makeAsset(`Floral pattern ${i}`));
    const result = computeCollectionDiversity(plan, brief, assets);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
