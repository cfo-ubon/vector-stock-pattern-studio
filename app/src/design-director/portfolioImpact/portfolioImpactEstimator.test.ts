import { describe, it, expect } from 'vitest';
import { estimatePortfolioImpact } from './portfolioImpactEstimator';
import { createCollectionPlan, type PatternTypeCounts } from '../domain/collectionPlan';
import { createCreativeBrief } from '../domain/creativeBrief';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { PortfolioAsset } from '../../catalog/domain/types';

const counts: PatternTypeCounts = { hero: 2, secondary: 5, blender: 4, stripe: 2, border: 2, coordinate: 3, miniPattern: 1, texture: 1 };

function makeAsset(displayName: string): PortfolioAsset {
  return createPortfolioAsset({ displayName, originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
}

describe('estimatePortfolioImpact', () => {
  it('never mentions revenue and reports "first content" for an empty portfolio', () => {
    const brief = createCreativeBrief({ collectionName: 'Kids Animals', theme: 'Kids Animals', now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'Kids Animals', theme: 'Kids Animals', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const statements = estimatePortfolioImpact(plan, brief, []);
    expect(statements.some((s) => s.statement.toLowerCase().includes('revenue'))).toBe(false);
    expect(statements[0].statement).toContain('first content');
  });

  it('flags improved category coverage for an underrepresented category with real counts as evidence', () => {
    const brief = createCreativeBrief({ collectionName: 'Kids Animals', theme: 'Kids Animals', now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'Kids Animals', theme: 'Kids Animals', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const portfolio = [makeAsset('Geometric Terrazzo'), makeAsset('Abstract Geometric'), makeAsset('Floral Botanical')];
    const statements = estimatePortfolioImpact(plan, brief, portfolio);
    expect(statements.some((s) => s.statement.includes('Kids'))).toBe(true);
  });

  it('flags reduced reliance on a dominant existing category', () => {
    const brief = createCreativeBrief({ collectionName: 'Geometric Deco', theme: 'Geometric Deco', now: 1000 });
    const plan = createCollectionPlan({ briefId: brief.id, name: 'Geometric Deco', theme: 'Geometric Deco', totalSize: 20, patternTypeCounts: counts, now: 1000 });
    const portfolio = Array.from({ length: 5 }, (_, i) => makeAsset(`Floral Botanical ${i}`));
    const statements = estimatePortfolioImpact(plan, brief, portfolio);
    expect(statements.some((s) => s.statement.includes('Reduces reliance on Floral'))).toBe(true);
  });
});
