import { describe, it, expect } from 'vitest';
import { buildBeautyReview, BEAUTY_DIMENSIONS, type BeautyReviewInput } from './beautyReview';
import type { CompositionMetrics } from '../engine/scoring';

function baseMetrics(overrides: Partial<CompositionMetrics> = {}): CompositionMetrics {
  const strong: CompositionMetrics = {
    composition: 90, spacing: 90, quadrantBalance: 90, horizontalBalance: 90, verticalBalance: 90,
    visualCenterOffset: 90, occupancyRatio: 90, densityVariance: 90, largestEmptyRegion: 90, hierarchy: 90,
    scaleDiversity: 90, rotationDiversity: 90, colorBalance: 90, paletteContrast: 90, overlapQuality: 90,
    heroSeparation: 90, edgeDensity: 90, adjacencyRepetition: 90, seamlessIntegrity: 90, svgHealth: 90,
    flowCoherence: 90, rhythmRegularity: 90, motifShapeDiversity: 90, cornerContinuity: 90,
    heroDetailRatio: 90, isolationScore: 90, clusterCohesion: 90, gridAppearanceScore: 90, spacingUniformity: 90,
  } as CompositionMetrics;
  return { ...strong, ...overrides };
}

function baseInput(overrides: Partial<BeautyReviewInput> = {}): BeautyReviewInput {
  return {
    metrics: baseMetrics(),
    heroVisibility: 90,
    fragmentedSilhouette: false,
    deadSpace: false,
    thumbnail200: 90,
    illustrationQuality: 90,
    illustrationQualityV2Overall: 90,
    productTargetFit: 90,
    productTargetFitV2: 90,
    ...overrides,
  };
}

describe('buildBeautyReview (Build 023)', () => {
  it('returns all 12 named dimensions', () => {
    const review = buildBeautyReview(baseInput());
    for (const { key } of BEAUTY_DIMENSIONS) {
      expect(typeof review.beautyDiagnostics[key]).toBe('number');
    }
    expect(Object.keys(review.beautyDiagnostics).length).toBe(BEAUTY_DIMENSIONS.length);
  });

  it('produces a high beautyScore with no failure reasons for uniformly strong input', () => {
    const review = buildBeautyReview(baseInput());
    expect(review.beautyScore).toBeGreaterThan(85);
    expect(review.beautyFailureReasons).toHaveLength(0);
  });

  it('caps silhouetteCohesion and explains it when fragmentedSilhouette is flagged, even if clusterCohesion is high', () => {
    const review = buildBeautyReview(baseInput({ fragmentedSilhouette: true }));
    expect(review.beautyDiagnostics.silhouetteCohesion).toBeLessThanOrEqual(40);
    expect(review.beautyFailureReasons.some((r) => r.toLowerCase().includes('fragment') || r.toLowerCase().includes('cohesion'))).toBe(true);
  });

  it('caps negativeSpaceQuality and explains it when deadSpace is flagged', () => {
    const review = buildBeautyReview(baseInput({ deadSpace: true }));
    expect(review.beautyDiagnostics.negativeSpaceQuality).toBeLessThanOrEqual(40);
    expect(review.beautyFailureReasons.some((r) => r.toLowerCase().includes('negative space'))).toBe(true);
  });

  it('falls back to composition when no illustration quality is available (non-botanical category)', () => {
    const review = buildBeautyReview(baseInput({ illustrationQuality: undefined, illustrationQualityV2Overall: undefined }));
    expect(review.beautyDiagnostics.illustrationRefinement).toBe(90);
  });

  it('falls back to productTargetFit, then a neutral 50, when V2 is unavailable', () => {
    const withV1Only = buildBeautyReview(baseInput({ productTargetFitV2: undefined, productTargetFit: 70 }));
    expect(withV1Only.beautyDiagnostics.productSuitability).toBe(70);
    const neither = buildBeautyReview(baseInput({ productTargetFitV2: undefined, productTargetFit: undefined }));
    expect(neither.beautyDiagnostics.productSuitability).toBe(50);
  });

  it('reads thumbnailImpact directly from the given thumbnail200 readability score', () => {
    const review = buildBeautyReview(baseInput({ thumbnail200: 12 }));
    expect(review.beautyDiagnostics.thumbnailImpact).toBe(12);
    expect(review.beautyFailureReasons.some((r) => r.toLowerCase().includes('thumbnail'))).toBe(true);
  });

  it('is a pure function of its input (no hidden state, no randomness)', () => {
    const input = baseInput({ heroVisibility: 42 });
    const a = buildBeautyReview(input);
    const b = buildBeautyReview(input);
    expect(a).toEqual(b);
  });

  it('never mutates the input metrics object', () => {
    const input = baseInput();
    const metricsCopy = { ...input.metrics };
    buildBeautyReview(input);
    expect(input.metrics).toEqual(metricsCopy);
  });
});
