import { describe, expect, it } from 'vitest';
import { computePortfolioDuplicates } from './duplicates';
import { makePortfolioRecord } from './testFixtures';

function fp(density: number, nodes: number, palette = 'earthTone') {
  return `style:stockClean|layout:grid|zone:none|palette:${palette}|family:none|hierarchy:none|product:wallpaper|density:${density}|negSpace:0.3|nodes:${nodes}|shapes:2`;
}

describe('computePortfolioDuplicates', () => {
  it('flags two same-bucket tiles with identical shapes and structure as exactDuplicate', () => {
    const a = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['x', 'y'], productTarget: 'wallpaper', compositionZone: undefined, similarityFingerprint: fp(0.3, 400) });
    const b = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['x', 'y'], productTarget: 'wallpaper', compositionZone: undefined, similarityFingerprint: fp(0.3, 400) });
    const counts = computePortfolioDuplicates([a, b]);
    expect(counts.exactDuplicate).toBe(1);
    expect(a.duplicateStatus).toBe('exactDuplicate');
    expect(b.duplicateStatus).toBe('exactDuplicate');
    expect(a.similarTo).toContain(b.patternId);
    expect(b.similarTo).toContain(a.patternId);
  });

  it('never compares tiles from different (styleDnaId, layoutId) buckets', () => {
    const a = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['x', 'y'], similarityFingerprint: fp(0.3, 400) });
    const b = makePortfolioRecord({ styleDnaId: 'premiumTextile', layoutId: 'radial', shapeSignatures: ['x', 'y'], similarityFingerprint: fp(0.3, 400) });
    const counts = computePortfolioDuplicates([a, b]);
    expect(counts.exactDuplicate).toBe(0);
    expect(a.duplicateStatus).toBeUndefined();
    expect(a.similarTo).toEqual([]);
  });

  it('leaves distinct same-bucket tiles with no duplicateStatus', () => {
    const a = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['x', 'y'], similarityFingerprint: fp(0.3, 400) });
    const b = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['p', 'q'], similarityFingerprint: fp(0.3, 400) });
    computePortfolioDuplicates([a, b]);
    expect(a.duplicateStatus).toBeUndefined();
    expect(b.duplicateStatus).toBeUndefined();
  });

  it('keeps the most severe classification when a tile matches multiple neighbors', () => {
    const a = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['x', 'y'], productTarget: 'wallpaper', similarityFingerprint: fp(0.3, 400) });
    const exactMatch = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['x', 'y'], productTarget: 'wallpaper', similarityFingerprint: fp(0.3, 400) });
    const nearMatch = makePortfolioRecord({ styleDnaId: 'stockClean', layoutId: 'grid', shapeSignatures: ['x', 'y', 'z', 'w'], productTarget: 'wallpaper', similarityFingerprint: fp(0.3, 400) });
    computePortfolioDuplicates([a, exactMatch, nearMatch]);
    expect(a.duplicateStatus).toBe('exactDuplicate');
  });
});
