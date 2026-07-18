import { describe, expect, it } from 'vitest';
import { discoverFailurePatterns, discoverSuccessPatterns } from './successFailure';
import { computePortfolioRanking } from './ranking';
import { makePortfolioRecord } from './testFixtures';

function buildPopulation() {
  // 30 patterns: top 3 (10%) all share layoutId 'radial' and strengthTag
  // 'strongHierarchy'; the rest use 'grid' and lack that tag — a real,
  // constructed correlation the discovery functions should surface.
  const patterns = [
    ...Array.from({ length: 3 }, () => makePortfolioRecord({
      layoutId: 'radial', strengthTags: ['strongHierarchy'],
      absoluteCommercialQualityV2: 95, commercialAppealV2Overall: 95, luxuryCompositionOverall: 95, surfacePatternSuitability: 95, productTargetScore: 95,
    })),
    ...Array.from({ length: 3 }, () => makePortfolioRecord({
      layoutId: 'brick', failureModes: ['gridAppearance'],
      absoluteCommercialQualityV2: 10, commercialAppealV2Overall: 10, luxuryCompositionOverall: 10, surfacePatternSuitability: 10, productTargetScore: 10,
    })),
    ...Array.from({ length: 24 }, (_, i) => makePortfolioRecord({
      layoutId: 'grid', absoluteCommercialQualityV2: 50 + (i % 5), commercialAppealV2Overall: 50, luxuryCompositionOverall: 50, surfacePatternSuitability: 50, productTargetScore: 50,
    })),
  ];
  computePortfolioRanking(patterns);
  return patterns;
}

describe('discoverSuccessPatterns', () => {
  it('surfaces a trait over-represented in the top decile with lift > 1', () => {
    const patterns = buildPopulation();
    const findings = discoverSuccessPatterns(patterns, 'top10');
    const radialFinding = findings.find((f) => f.traitName === 'layoutId' && f.value === 'radial');
    expect(radialFinding).toBeDefined();
    expect(radialFinding!.lift).toBeGreaterThan(1);

    const hierarchyFinding = findings.find((f) => f.traitName === 'strengthTag' && f.value === 'strongHierarchy');
    expect(hierarchyFinding).toBeDefined();
    expect(hierarchyFinding!.lift).toBeGreaterThan(1);
  });

  it('returns an empty array when no patterns fall in the requested bucket', () => {
    const patterns = [makePortfolioRecord()];
    computePortfolioRanking(patterns);
    expect(discoverSuccessPatterns(patterns, 'top1')).toEqual([]);
  });

  it('never reports a trait with lift <= 1 as a success finding', () => {
    const patterns = buildPopulation();
    const findings = discoverSuccessPatterns(patterns, 'top10');
    expect(findings.every((f) => f.lift > 1)).toBe(true);
  });
});

describe('discoverFailurePatterns', () => {
  it('surfaces a failureMode over-represented in the bottom decile', () => {
    const patterns = buildPopulation();
    const findings = discoverFailurePatterns(patterns, 'bottom10');
    const gridFinding = findings.find((f) => f.traitName === 'failureMode' && f.value === 'gridAppearance');
    expect(gridFinding).toBeDefined();
    expect(gridFinding!.lift).toBeGreaterThan(1);
  });

  it('reports low confidence for small sample sizes, never inflating confidence', () => {
    const patterns = buildPopulation();
    const findings = discoverFailurePatterns(patterns, 'bottom10');
    // only 3 bottom-decile members — well below the 30-sample floor.
    expect(findings.every((f) => f.confidence === 'low')).toBe(true);
  });
});
