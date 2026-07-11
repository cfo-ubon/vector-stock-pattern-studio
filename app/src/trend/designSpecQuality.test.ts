import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import {
  qualityPresetForDesignSpec,
  checkDesignSpecQuality,
  runDesignSpecQualityLoop,
  buildQualityRecommendations,
  type DesignSpecQualityReport,
} from './designSpecQuality';
import { STYLE_DNA_PRESETS, computeStyleDnaConsistency } from '../engine/styleDna';
import type { KeywordBundle } from './designSpecTypes';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Spring', 'Muted Green', 'Editorial'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'geometric',
    paletteDirection: 'muted green',
    difficulty: 'simple',
    collectionSize: 8,
    ...overrides,
  };
}

function fakeReport(overrides: Partial<DesignSpecQualityReport> = {}): DesignSpecQualityReport {
  return {
    overall: 90,
    composition: 90,
    hierarchy: 90,
    flow: 90,
    rhythm: 90,
    balance: 90,
    negativeSpace: 90,
    repeatQuality: 100,
    svgHealth: 100,
    motifDiversity: 90,
    overlap: 90,
    commercialReadiness: 90,
    ...overrides,
  };
}

describe('qualityPresetForDesignSpec', () => {
  it('maps every composition style to a real QualityPresetId', () => {
    const styles = ['airy', 'balanced', 'dense', 'editorial', 'maximalist', 'minimal'] as const;
    const validPresets = new Set(['stockClean', 'textilePremium', 'editorialBotanical', 'denseLuxury']);
    for (const composition of styles) {
      const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
      const withComposition = { ...spec, composition };
      expect(validPresets.has(qualityPresetForDesignSpec(withComposition))).toBe(true);
    }
  });

  it('editorial composition maps to the editorialBotanical preset', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    expect(qualityPresetForDesignSpec({ ...spec, composition: 'editorial' })).toBe('editorialBotanical');
  });
});

describe('checkDesignSpecQuality', () => {
  it('meets targets when every value clears the spec\'s own qualityTargets', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const check = checkDesignSpecQuality(fakeReport(), spec);
    expect(check.meetsTargets).toBe(true);
    expect(check.shortfalls).toEqual([]);
  });

  it('flags a shortfall for each of the 4 target fields individually', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const low = fakeReport({ overall: 0, repeatQuality: 0, motifDiversity: 0, commercialReadiness: 0 });
    const check = checkDesignSpecQuality(low, spec);
    expect(check.meetsTargets).toBe(false);
    expect(check.shortfalls.length).toBe(4);
    expect(check.shortfalls.some((s) => s.includes('Overall Score'))).toBe(true);
    expect(check.shortfalls.some((s) => s.includes('Seamless Integrity'))).toBe(true);
    expect(check.shortfalls.some((s) => s.includes('Motif Diversity'))).toBe(true);
    expect(check.shortfalls.some((s) => s.includes('Commercial Readiness'))).toBe(true);
  });

  it('a single failing field produces exactly one shortfall', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const check = checkDesignSpecQuality(fakeReport({ motifDiversity: 0 }), spec);
    expect(check.shortfalls.length).toBe(1);
    expect(check.shortfalls[0]).toContain('Motif Diversity');
  });
});

describe('runDesignSpecQualityLoop', () => {
  it('produces a real candidate pool with a winner and a full 0-100 quality report', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-loop-basic', 'fast');
    expect(result.pool.winner).toBeDefined();
    expect(result.pool.winner.tileData).toBeDefined();
    for (const [key, value] of Object.entries(result.check.report)) {
      expect(value, key).toBeGreaterThanOrEqual(0);
      expect(value, key).toBeLessThanOrEqual(100);
    }
  });

  it('never exceeds maxRounds', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    // Impossible-to-satisfy targets force every round to run out.
    const impossible = { ...spec, qualityTargets: { minOverallScore: 999, minSeamlessIntegrity: 999, minMotifDiversity: 999, minCommercialReadiness: 999 } };
    const result = runDesignSpecQualityLoop(impossible, 'seed-loop-max', 'fast', 2);
    expect(result.roundsUsed).toBe(2);
    expect(result.maxRounds).toBe(2);
    expect(result.check.meetsTargets).toBe(false);
  });

  it('stops early (round 1) when targets are trivially satisfiable', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const trivial = { ...spec, qualityTargets: { minOverallScore: 0, minSeamlessIntegrity: 0, minMotifDiversity: 0, minCommercialReadiness: 0 } };
    const result = runDesignSpecQualityLoop(trivial, 'seed-loop-trivial', 'fast', 3);
    expect(result.roundsUsed).toBe(1);
    expect(result.check.meetsTargets).toBe(true);
  });

  it(
    'is fully deterministic for the same spec + seed + mode + maxRounds',
    () => {
      // Up to 2 full candidate-pool rounds x 2 independent loop calls —
      // the same "some category/layout combos take real time" headroom
      // trend/designSpecCollection.test.ts's sibling tests already
      // document (Cluster Composition Engine layouts place more motifs
      // per tile than the old independent scatter did, by design — see
      // engine/clusterEngine.ts — and Project Phoenix V2's Quality
      // Inspector adds 5 more real metrics computed per candidate).
      const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
      const a = runDesignSpecQualityLoop(spec, 'seed-loop-det', 'fast', 2);
      const b = runDesignSpecQualityLoop(spec, 'seed-loop-det', 'fast', 2);
      expect(a.check).toEqual(b.check);
      expect(a.roundsUsed).toBe(b.roundsUsed);
      expect(a.pool.winner.tileData).toEqual(b.pool.winner.tileData);
    },
    15000,
  );

  it('keeps the higher-scoring round when multiple rounds run without meeting targets', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const impossible = { ...spec, qualityTargets: { minOverallScore: 999, minSeamlessIntegrity: 999, minMotifDiversity: 999, minCommercialReadiness: 999 } };
    const result = runDesignSpecQualityLoop(impossible, 'seed-loop-keep-best', 'fast', 3);
    expect(result.pool.winner.score).toBe(result.check.report.overall);
  });
});

describe('runDesignSpecQualityLoop: report is wired to real CompositionMetrics (SVG Intelligence Engine Phase 3)', () => {
  it('flow and rhythm are exact 1:1 reads of the real geometric metrics, not a proxy average', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-wiring-flow-rhythm', 'fast');
    const m = result.pool.winner.metrics;
    expect(result.check.report.flow).toBe(m.flowCoherence);
    expect(result.check.report.rhythm).toBe(m.rhythmRegularity);
  });

  it('repeatQuality is the average of seamlessIntegrity and the real cornerContinuity measurement', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-wiring-repeat', 'fast');
    const m = result.pool.winner.metrics;
    expect(result.check.report.repeatQuality).toBe(Math.round((m.seamlessIntegrity + m.cornerContinuity) / 2));
  });

  it('motifDiversity averages placement diversity (scale/rotation) with real shape-topology diversity', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-wiring-diversity', 'fast');
    const m = result.pool.winner.metrics;
    expect(result.check.report.motifDiversity).toBe(Math.round((m.scaleDiversity + m.rotationDiversity + m.motifShapeDiversity) / 3));
  });

  it('commercialReadiness folds in a real Style DNA consistency measurement when the spec resolves to a known style', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-wiring-commercial', 'fast');
    const m = result.pool.winner.metrics;
    const styleDna = STYLE_DNA_PRESETS[spec.styleDnaId];
    expect(styleDna).toBeDefined();
    const styleConsistency = computeStyleDnaConsistency(m, styleDna);
    const expected = Math.round((m.colorBalance + m.paletteContrast + m.svgHealth + m.cornerContinuity + styleConsistency) / 5);
    expect(result.check.report.commercialReadiness).toBe(expected);
  });

  it('balance is the average of the 3 real balance sub-metrics', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-wiring-balance', 'fast');
    const m = result.pool.winner.metrics;
    expect(result.check.report.balance).toBe(Math.round((m.quadrantBalance + m.horizontalBalance + m.verticalBalance) / 3));
  });

  it('composition, hierarchy, svgHealth and negativeSpace are exact 1:1 reads of their metrics', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-wiring-direct', 'fast');
    const m = result.pool.winner.metrics;
    expect(result.check.report.composition).toBe(m.composition);
    expect(result.check.report.hierarchy).toBe(m.hierarchy);
    expect(result.check.report.svgHealth).toBe(m.svgHealth);
    expect(result.check.report.negativeSpace).toBe(m.largestEmptyRegion);
  });

  it('overlap (Design Workbench Phase 6) is an exact 1:1 read of overlapQuality', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const result = runDesignSpecQualityLoop(spec, 'seed-wiring-overlap', 'fast');
    const m = result.pool.winner.metrics;
    expect(result.check.report.overlap).toBe(m.overlapQuality);
  });
});

describe('buildQualityRecommendations (Design Workbench Phase 6, Section 7)', () => {
  it('a healthy report produces zero recommendations', () => {
    expect(buildQualityRecommendations(fakeReport())).toEqual([]);
  });

  it('a weak dimension produces exactly one real, actionable recommendation naming that dimension', () => {
    const recs = buildQualityRecommendations(fakeReport({ overlap: 20 }));
    expect(recs.length).toBe(1);
    expect(recs[0]).toContain('Overlap');
  });

  it('multiple weak dimensions each produce their own recommendation', () => {
    const recs = buildQualityRecommendations(fakeReport({ hierarchy: 10, negativeSpace: 15, commercialReadiness: 5 }));
    expect(recs.length).toBe(3);
    expect(recs.some((r) => r.includes('Hierarchy'))).toBe(true);
    expect(recs.some((r) => r.includes('Negative Space'))).toBe(true);
    expect(recs.some((r) => r.includes('Commercial Readiness'))).toBe(true);
  });

  it('is deterministic for the same report', () => {
    const report = fakeReport({ flow: 30 });
    expect(buildQualityRecommendations(report)).toEqual(buildQualityRecommendations(report));
  });
});
