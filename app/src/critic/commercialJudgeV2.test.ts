import { describe, it, expect } from 'vitest';
import { computeCommercialJudgeV2 } from './commercialJudgeV2';
import type { CommercialAppealScoreV2 } from './commercialAppealScore';
import type { ScoreResultV2 } from '../engine/scoringV2';
import type { CompositionMetrics } from '../engine/scoring';
import { computeStyleEvaluationProfile } from '../engine/styleEvaluation';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';

function makeAppeal(overrides: Partial<CommercialAppealScoreV2> = {}): CommercialAppealScoreV2 {
  return {
    luxuryFeel: 80,
    editorialQuality: 75,
    shelfImpact: 70,
    premiumImpression: 78,
    productSuitability: 72,
    collectionConsistency: undefined,
    overall: 75,
    ...overrides,
  };
}

function makeScoreV2(overrides: Partial<ScoreResultV2> = {}): ScoreResultV2 {
  return {
    score: 80,
    baseScore: 80,
    presetId: 'stockClean',
    layoutClass: 'organic',
    productId: undefined,
    appliedPenalties: [],
    exemptedPenalties: [],
    lowMetricReasons: [],
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<CompositionMetrics> = {}): CompositionMetrics {
  const base: CompositionMetrics = {
    composition: 80, spacing: 80, quadrantBalance: 80, horizontalBalance: 80,
    verticalBalance: 80, visualCenterOffset: 80, occupancyRatio: 50, densityVariance: 80,
    largestEmptyRegion: 80, hierarchy: 80, scaleDiversity: 80, rotationDiversity: 80,
    colorBalance: 80, paletteContrast: 80, overlapQuality: 80, heroSeparation: 80,
    edgeDensity: 80, adjacencyRepetition: 80, seamlessIntegrity: 100, svgHealth: 100,
    flowCoherence: 80, rhythmRegularity: 80, motifShapeDiversity: 80, cornerContinuity: 90,
    heroDetailRatio: 80, isolationScore: 80, clusterCohesion: 80, gridAppearanceScore: 80,
    spacingUniformity: 80,
  };
  return { ...base, ...overrides };
}

describe('computeCommercialJudgeV2', () => {
  it('reuses the appeal score dimensions verbatim, never recomputing them', () => {
    const appeal = makeAppeal();
    const result = computeCommercialJudgeV2({ appeal, scoreV2: makeScoreV2(), metrics: makeMetrics() });
    expect(result.luxuryFeel).toBe(appeal.luxuryFeel);
    expect(result.editorialQuality).toBe(appeal.editorialQuality);
    expect(result.shelfImpact).toBe(appeal.shelfImpact);
    expect(result.productSuitability).toBe(appeal.productSuitability);
  });

  it('omits collectionConsistency when the appeal score did not supply one', () => {
    const result = computeCommercialJudgeV2({ appeal: makeAppeal(), scoreV2: makeScoreV2(), metrics: makeMetrics() });
    expect(result.collectionConsistency).toBeUndefined();
  });

  it('includes collectionConsistency when the appeal score supplied one', () => {
    const result = computeCommercialJudgeV2({ appeal: makeAppeal({ collectionConsistency: 85 }), scoreV2: makeScoreV2(), metrics: makeMetrics() });
    expect(result.collectionConsistency).toBe(85);
  });

  it('computes surfacePatternSuitability from repeat integrity alone when no style context is given', () => {
    const metrics = makeMetrics({ seamlessIntegrity: 100, cornerContinuity: 80 });
    const result = computeCommercialJudgeV2({ appeal: makeAppeal(), scoreV2: makeScoreV2(), metrics });
    expect(result.surfacePatternSuitability).toBe(90);
  });

  it('blends in style-aware density fit when a style profile and declared density are given', () => {
    const profile = computeStyleEvaluationProfile(STYLE_DNA_PRESETS.minimalBotanical);
    const metrics = makeMetrics({ occupancyRatio: 30 });
    const result = computeCommercialJudgeV2({
      appeal: makeAppeal(), scoreV2: makeScoreV2(), metrics, styleProfile: profile, declaredDensity: 0.3,
    });
    expect(result.surfacePatternSuitability).toBeGreaterThan(0);
    expect(result.surfacePatternSuitability).toBeLessThanOrEqual(100);
  });

  it('carries the full penalty explanation trace through from scoreV2', () => {
    const scoreV2 = makeScoreV2({
      layoutClass: 'lattice',
      exemptedPenalties: [{ ruleId: 'gridAppearance', label: 'grid-like', points: 20, reason: 'lattice-intentional', confidence: 'high' }],
    });
    const result = computeCommercialJudgeV2({ appeal: makeAppeal(), scoreV2, metrics: makeMetrics() });
    expect(result.explanation.layoutClass).toBe('lattice');
    expect(result.explanation.exemptedPenalties).toHaveLength(1);
    expect(result.explanation.exemptedPenalties[0].ruleId).toBe('gridAppearance');
  });

  it('produces a verdict string mentioning the overall score', () => {
    const result = computeCommercialJudgeV2({ appeal: makeAppeal(), scoreV2: makeScoreV2(), metrics: makeMetrics() });
    expect(result.verdict).toContain(String(result.overall));
  });

  it('overall is the plain average of the dimensions actually present', () => {
    const appeal = makeAppeal({ luxuryFeel: 100, editorialQuality: 100, shelfImpact: 100, productSuitability: 100 });
    const metrics = makeMetrics({ seamlessIntegrity: 100, cornerContinuity: 100 });
    const result = computeCommercialJudgeV2({ appeal, scoreV2: makeScoreV2(), metrics });
    expect(result.overall).toBe(100);
  });
});
