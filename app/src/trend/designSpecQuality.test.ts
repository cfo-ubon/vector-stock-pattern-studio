import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import {
  qualityPresetForDesignSpec,
  checkDesignSpecQuality,
  runDesignSpecQualityLoop,
  type DesignSpecQualityReport,
} from './designSpecQuality';
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

  it('is fully deterministic for the same spec + seed + mode + maxRounds', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const a = runDesignSpecQualityLoop(spec, 'seed-loop-det', 'fast', 2);
    const b = runDesignSpecQualityLoop(spec, 'seed-loop-det', 'fast', 2);
    expect(a.check).toEqual(b.check);
    expect(a.roundsUsed).toBe(b.roundsUsed);
    expect(a.pool.winner.tileData).toEqual(b.pool.winner.tileData);
  });

  it('keeps the higher-scoring round when multiple rounds run without meeting targets', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const impossible = { ...spec, qualityTargets: { minOverallScore: 999, minSeamlessIntegrity: 999, minMotifDiversity: 999, minCommercialReadiness: 999 } };
    const result = runDesignSpecQualityLoop(impossible, 'seed-loop-keep-best', 'fast', 3);
    expect(result.pool.winner.score).toBe(result.check.report.overall);
  });
});
