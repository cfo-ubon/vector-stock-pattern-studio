import { describe, it, expect } from 'vitest';
import { buildDesignCritique, DESIGN_CRITIQUE_DIMENSIONS } from './designCritique';
import type { DesignSpecQualityReport } from '../trend/designSpecQuality';
import type { CompositionMetrics } from '../engine/scoring';

function fakeReport(overrides: Partial<DesignSpecQualityReport> = {}): DesignSpecQualityReport {
  return {
    overall: 80, composition: 80, hierarchy: 80, flow: 80, rhythm: 80, balance: 80,
    negativeSpace: 80, repeatQuality: 80, svgHealth: 80, motifDiversity: 80, overlap: 80,
    commercialReadiness: 80, ...overrides,
  };
}

function fakeMetrics(overrides: Partial<CompositionMetrics> = {}): CompositionMetrics {
  const base: Record<string, number> = {
    composition: 80, spacing: 80, quadrantBalance: 80, horizontalBalance: 80, verticalBalance: 80,
    visualCenterOffset: 80, occupancyRatio: 80, densityVariance: 80, largestEmptyRegion: 80, hierarchy: 80,
    scaleDiversity: 80, rotationDiversity: 80, colorBalance: 80, paletteContrast: 80, overlapQuality: 80,
    heroSeparation: 80, edgeDensity: 80, adjacencyRepetition: 80, seamlessIntegrity: 80, svgHealth: 80,
    flowCoherence: 80, rhythmRegularity: 80, motifShapeDiversity: 80, cornerContinuity: 80,
    heroDetailRatio: 80, isolationScore: 80, clusterCohesion: 65, gridAppearanceScore: 80, spacingUniformity: 80,
  };
  return { ...base, ...overrides } as unknown as CompositionMetrics;
}

describe('buildDesignCritique', () => {
  it('reads all 10 shared dimensions 1:1 from the real DesignSpecQualityReport', () => {
    const report = fakeReport({ composition: 91, hierarchy: 72, flow: 33, rhythm: 44, balance: 55, negativeSpace: 66, repeatQuality: 77, motifDiversity: 88, overlap: 99, commercialReadiness: 11, overall: 60 });
    const critique = buildDesignCritique(report, fakeMetrics());
    expect(critique.composition).toBe(91);
    expect(critique.hierarchy).toBe(72);
    expect(critique.flow).toBe(33);
    expect(critique.rhythm).toBe(44);
    expect(critique.balance).toBe(55);
    expect(critique.negativeSpace).toBe(66);
    expect(critique.repeatQuality).toBe(77);
    expect(critique.motifDiversity).toBe(88);
    expect(critique.overlap).toBe(99);
    expect(critique.commercialReadiness).toBe(11);
    expect(critique.overall).toBe(60);
  });

  it('sources clusterQuality from CompositionMetrics.clusterCohesion, the one dimension missing from DesignSpecQualityReport', () => {
    const critique = buildDesignCritique(fakeReport(), fakeMetrics({ clusterCohesion: 37 }));
    expect(critique.clusterQuality).toBe(37);
  });
});

describe('DESIGN_CRITIQUE_DIMENSIONS', () => {
  it('lists exactly the 11 brief-named dimensions (excluding overall)', () => {
    expect(DESIGN_CRITIQUE_DIMENSIONS.map((d) => d.key).sort()).toEqual(
      ['balance', 'clusterQuality', 'commercialReadiness', 'composition', 'flow', 'hierarchy', 'motifDiversity', 'negativeSpace', 'overlap', 'repeatQuality', 'rhythm'].sort(),
    );
  });
});
