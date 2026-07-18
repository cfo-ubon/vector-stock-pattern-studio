import { describe, it, expect } from 'vitest';
import { computeOverallScoreV2 } from './scoringV2';
import { computeOverallScore, type CompositionMetrics } from './scoring';

function healthyMetrics(overrides: Partial<CompositionMetrics> = {}): CompositionMetrics {
  const base: CompositionMetrics = {
    composition: 100, spacing: 100, quadrantBalance: 100, horizontalBalance: 100,
    verticalBalance: 100, visualCenterOffset: 100, occupancyRatio: 60, densityVariance: 100,
    largestEmptyRegion: 100, hierarchy: 100, scaleDiversity: 100, rotationDiversity: 100,
    colorBalance: 100, paletteContrast: 100, overlapQuality: 100, heroSeparation: 100,
    edgeDensity: 100, adjacencyRepetition: 100, seamlessIntegrity: 100, svgHealth: 100,
    flowCoherence: 100, rhythmRegularity: 100, motifShapeDiversity: 100, cornerContinuity: 100,
    heroDetailRatio: 100, isolationScore: 100, clusterCohesion: 100, gridAppearanceScore: 100,
    spacingUniformity: 100,
  };
  return { ...base, ...overrides };
}

// A metrics fixture matching the empirically-observed lattice failure mode:
// low gridAppearanceScore/spacingUniformity/rotationDiversity (the 3 signals
// mechanicalComposition itself ANDs together) plus low largestEmptyRegion/
// hierarchy/heroDetailRatio, mirroring BUILD_012_AUDIT.md's real residual
// findings for minimalBotanical/boutiquePackaging.
function latticeLikeMetrics(): CompositionMetrics {
  return healthyMetrics({
    gridAppearanceScore: 5,
    spacingUniformity: 10,
    rotationDiversity: 15,
    largestEmptyRegion: 20,
    hierarchy: 30,
    heroDetailRatio: 30,
  });
}

describe('computeOverallScoreV2', () => {
  it('produces the identical score to V1 when metrics are entirely healthy', () => {
    const m = healthyMetrics();
    const v1 = computeOverallScore(m, 'stockClean').score;
    const v2 = computeOverallScoreV2(m, 'stockClean', { layoutClass: 'organic' });
    expect(v2.score).toBe(v1);
    expect(v2.appliedPenalties).toEqual([]);
    expect(v2.exemptedPenalties).toEqual([]);
  });

  it('applies the full V1 penalty set for organic-layout context (no exemptions)', () => {
    const m = latticeLikeMetrics();
    const v1 = computeOverallScore(m, 'stockClean').score;
    const v2 = computeOverallScoreV2(m, 'stockClean', { layoutClass: 'organic' });
    expect(v2.score).toBe(v1);
    expect(v2.appliedPenalties.length).toBeGreaterThan(0);
  });

  it('scores meaningfully higher than V1 for the same lattice-like metrics under lattice-layout context', () => {
    const m = latticeLikeMetrics();
    const v1 = computeOverallScore(m, 'stockClean').score;
    const v2 = computeOverallScoreV2(m, 'stockClean', { layoutClass: 'lattice' });
    expect(v2.score).toBeGreaterThan(v1);
    expect(v2.exemptedPenalties.length).toBeGreaterThan(0);
  });

  it('records exempted penalties with their own reason/confidence, never silently dropped', () => {
    const m = latticeLikeMetrics();
    const v2 = computeOverallScoreV2(m, 'stockClean', { layoutClass: 'lattice' });
    for (const entry of v2.exemptedPenalties) {
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(entry.confidence);
    }
  });

  it('base score is identical regardless of layout context (only penalty gating differs)', () => {
    const m = latticeLikeMetrics();
    const organic = computeOverallScoreV2(m, 'stockClean', { layoutClass: 'organic' });
    const lattice = computeOverallScoreV2(m, 'stockClean', { layoutClass: 'lattice' });
    expect(organic.baseScore).toBe(lattice.baseScore);
  });

  it('never returns a score outside [0, 100]', () => {
    const worst = healthyMetrics({
      composition: 0, spacing: 0, quadrantBalance: 0, largestEmptyRegion: 0, heroSeparation: 0,
      adjacencyRepetition: 0, edgeDensity: 0, paletteContrast: 0, cornerContinuity: 0,
      motifShapeDiversity: 0, overlapQuality: 0, heroDetailRatio: 0, spacingUniformity: 0,
      isolationScore: 0, hierarchy: 0, clusterCohesion: 0, rotationDiversity: 0,
      gridAppearanceScore: 0, scaleDiversity: 0,
    });
    const v2 = computeOverallScoreV2(worst, 'stockClean', { layoutClass: 'organic' });
    expect(v2.score).toBeGreaterThanOrEqual(0);
    expect(v2.score).toBeLessThanOrEqual(100);
  });
});
