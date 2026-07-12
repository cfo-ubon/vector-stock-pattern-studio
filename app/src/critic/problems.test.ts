import { describe, it, expect } from 'vitest';
import { SOFT_PENALTY_RULES, type CompositionMetrics } from '../engine/scoring';
import { detectProblems } from './problems';

function healthyMetrics(): CompositionMetrics {
  const base: Record<string, number> = {};
  const keys = [
    'composition', 'spacing', 'quadrantBalance', 'horizontalBalance', 'verticalBalance', 'visualCenterOffset',
    'occupancyRatio', 'densityVariance', 'largestEmptyRegion', 'hierarchy', 'scaleDiversity', 'rotationDiversity',
    'colorBalance', 'paletteContrast', 'overlapQuality', 'heroSeparation', 'edgeDensity', 'adjacencyRepetition',
    'seamlessIntegrity', 'svgHealth', 'flowCoherence', 'rhythmRegularity', 'motifShapeDiversity', 'cornerContinuity',
    'heroDetailRatio', 'isolationScore', 'clusterCohesion', 'gridAppearanceScore', 'spacingUniformity',
  ];
  for (const k of keys) base[k] = 90;
  return base as unknown as CompositionMetrics;
}

describe('detectProblems', () => {
  it('returns [] for metrics that clear every real penalty-rule threshold', () => {
    expect(detectProblems(healthyMetrics())).toEqual([]);
  });

  it('detects exactly the real SOFT_PENALTY_RULES that trigger, with matching id/label/points', () => {
    const metrics = { ...healthyMetrics(), gridAppearanceScore: 10 };
    const problems = detectProblems(metrics);
    const rule = SOFT_PENALTY_RULES.find((r) => r.id === 'gridAppearance')!;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toEqual({ id: rule.id, label: rule.label, points: rule.points, severity: 'high' });
  });

  it('assigns severity from the rule\'s own real point value: >=20 high, >=10 medium, else low', () => {
    const metrics = {
      ...healthyMetrics(),
      gridAppearanceScore: 10, // gridAppearance, 20pts -> high
      adjacencyRepetition: 10, // adjacentRepetition, 6pts -> low
      hierarchy: 10, // weakHierarchy, 15pts -> medium
    };
    const problems = detectProblems(metrics);
    const byId = Object.fromEntries(problems.map((p) => [p.id, p.severity]));
    expect(byId.gridAppearance).toBe('high');
    expect(byId.adjacentRepetition).toBe('low');
    expect(byId.weakHierarchy).toBe('medium');
  });

  it('sorts problems highest-points-first', () => {
    const metrics = { ...healthyMetrics(), gridAppearanceScore: 10, adjacencyRepetition: 10 };
    const problems = detectProblems(metrics);
    for (let i = 1; i < problems.length; i++) {
      expect(problems[i - 1].points).toBeGreaterThanOrEqual(problems[i].points);
    }
  });

  it('the compound mechanicalComposition rule only fires when all 3 of its real signals agree', () => {
    const partial = { ...healthyMetrics(), gridAppearanceScore: 10 };
    expect(detectProblems(partial).some((p) => p.id === 'mechanicalComposition')).toBe(false);

    const full = { ...healthyMetrics(), gridAppearanceScore: 10, spacingUniformity: 10, rotationDiversity: 10 };
    expect(detectProblems(full).some((p) => p.id === 'mechanicalComposition')).toBe(true);
  });

  it('is deterministic for the same metrics', () => {
    const metrics = { ...healthyMetrics(), overlapQuality: 5 };
    expect(detectProblems(metrics)).toEqual(detectProblems(metrics));
  });
});
