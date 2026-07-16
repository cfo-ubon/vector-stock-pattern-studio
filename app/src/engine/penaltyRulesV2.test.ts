import { describe, it, expect } from 'vitest';
import { PENALTY_RULES_V2, isPenaltyApplicable } from './penaltyRulesV2';
import { SOFT_PENALTY_RULES, type CompositionMetrics } from './scoring';

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

describe('PENALTY_RULES_V2', () => {
  it('ports every SOFT_PENALTY_RULES entry with the same id, points, and check', () => {
    expect(PENALTY_RULES_V2.length).toBe(SOFT_PENALTY_RULES.length);
    for (const v1Rule of SOFT_PENALTY_RULES) {
      const v2Rule = PENALTY_RULES_V2.find((r) => r.id === v1Rule.id);
      expect(v2Rule).toBeDefined();
      expect(v2Rule!.points).toBe(v1Rule.points);
      expect(v2Rule!.check).toBe(v1Rule.check);
    }
  });

  it('every rule declares a non-empty reason, confidence, and applicability', () => {
    for (const rule of PENALTY_RULES_V2) {
      expect(rule.reason.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(rule.confidence);
      expect(rule.applicableLayouts === 'all' || Array.isArray(rule.applicableLayouts)).toBe(true);
      expect(rule.applicableProducts === 'all' || rule.applicableProducts === 'repeat-only').toBe(true);
    }
  });

  it('restricts the 4 highest-confidence lattice-biased rules to organic-only applicability', () => {
    for (const id of ['gridAppearance', 'equalSpacingDetected', 'repeatedMotifOrientation', 'mechanicalComposition']) {
      const rule = PENALTY_RULES_V2.find((r) => r.id === id)!;
      expect(rule.applicableLayouts).toEqual(['organic']);
      expect(rule.confidence).toBe('high');
    }
  });

  it('keeps unbiased rules universal', () => {
    for (const id of ['quadrantImbalance', 'heroClustering', 'lowPaletteContrast', 'zeroMotifOverlap']) {
      const rule = PENALTY_RULES_V2.find((r) => r.id === id)!;
      expect(rule.applicableLayouts).toBe('all');
    }
  });

  it('restricts cornerDeadZone to repeat products only', () => {
    const rule = PENALTY_RULES_V2.find((r) => r.id === 'cornerDeadZone')!;
    expect(rule.applicableProducts).toBe('repeat-only');
  });
});

describe('isPenaltyApplicable', () => {
  const gridAppearanceRule = PENALTY_RULES_V2.find((r) => r.id === 'gridAppearance')!;
  const cornerDeadZoneRule = PENALTY_RULES_V2.find((r) => r.id === 'cornerDeadZone')!;
  const universalRule = PENALTY_RULES_V2.find((r) => r.id === 'quadrantImbalance')!;

  it('exempts an organic-only rule for lattice-layout context', () => {
    expect(isPenaltyApplicable(gridAppearanceRule, { layoutClass: 'lattice' })).toBe(false);
  });

  it('applies an organic-only rule for organic-layout context', () => {
    expect(isPenaltyApplicable(gridAppearanceRule, { layoutClass: 'organic' })).toBe(true);
  });

  it('exempts a repeat-only rule for a non-repeat product (poster)', () => {
    expect(isPenaltyApplicable(cornerDeadZoneRule, { layoutClass: 'organic', productId: 'poster' })).toBe(false);
  });

  it('applies a repeat-only rule for a repeat product (wallpaper)', () => {
    expect(isPenaltyApplicable(cornerDeadZoneRule, { layoutClass: 'organic', productId: 'wallpaper' })).toBe(true);
  });

  it('applies a repeat-only rule when no product context is given (matches V1 default behavior)', () => {
    expect(isPenaltyApplicable(cornerDeadZoneRule, { layoutClass: 'organic' })).toBe(true);
  });

  it('applies a universal rule regardless of layout class', () => {
    expect(isPenaltyApplicable(universalRule, { layoutClass: 'lattice' })).toBe(true);
    expect(isPenaltyApplicable(universalRule, { layoutClass: 'organic' })).toBe(true);
  });
});

describe('healthyMetrics test fixture sanity', () => {
  it('triggers zero of the original SOFT_PENALTY_RULES by default', () => {
    const m = healthyMetrics();
    const triggered = SOFT_PENALTY_RULES.filter((r) => r.check(m));
    expect(triggered).toEqual([]);
  });

  it('can trigger gridAppearance in isolation via override', () => {
    const m = healthyMetrics({ gridAppearanceScore: 10 });
    expect(SOFT_PENALTY_RULES.find((r) => r.id === 'gridAppearance')!.check(m)).toBe(true);
  });
});
