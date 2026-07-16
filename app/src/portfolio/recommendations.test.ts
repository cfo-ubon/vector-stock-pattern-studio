import { describe, expect, it } from 'vitest';
import { buildBuild014Recommendation, computeRecommendationTags } from './recommendations';
import { makePortfolioRecord } from './testFixtures';
import type { TraitFinding } from './successFailure';

function finding(overrides: Partial<TraitFinding>): TraitFinding {
  return {
    traitName: 'failureMode', value: 'gridAppearance', occurrences: 100, subgroupSize: 200, populationSize: 5000,
    populationFraction: 0.06, subgroupFraction: 0.5, lift: 8.3, confidence: 'high', reason: 'strong signal',
    ...overrides,
  };
}

describe('computeRecommendationTags', () => {
  it('translates each real failureMode into a human-readable action', () => {
    const pattern = makePortfolioRecord({ failureModes: ['weakHierarchy', 'gridAppearance'] });
    const tags = computeRecommendationTags(pattern);
    expect(tags).toEqual(['Strengthen hero-to-support size/detail contrast', 'Increase positional jitter / reduce lattice regularity']);
  });

  it('returns an empty array for a pattern with no failure modes', () => {
    expect(computeRecommendationTags(makePortfolioRecord({ failureModes: [] }))).toEqual([]);
  });

  it('falls back to a generic phrasing for any failure mode without a mapped action', () => {
    const pattern = makePortfolioRecord({ failureModes: ['unmappedMode' as never] });
    expect(computeRecommendationTags(pattern)).toEqual(['Address unmappedMode']);
  });
});

describe('buildBuild014Recommendation', () => {
  it('picks the highest-lift, sufficiently-confident failureMode finding', () => {
    const findings = [
      finding({ value: 'gridAppearance', lift: 8.3, confidence: 'high' }),
      finding({ value: 'weakHierarchy', lift: 3.1, confidence: 'high' }),
      finding({ traitName: 'styleDnaId', value: 'someStyle', lift: 20, confidence: 'high' }),
    ];
    const rec = buildBuild014Recommendation(findings, 5000);
    expect(rec?.failureMode).toBe('gridAppearance');
    expect(rec?.action).toBe('Increase positional jitter / reduce lattice regularity');
  });

  it('never selects a non-failureMode trait, even with higher lift', () => {
    const findings = [finding({ traitName: 'layoutId', value: 'grid', lift: 50, confidence: 'high' })];
    expect(buildBuild014Recommendation(findings, 5000)).toBeUndefined();
  });

  it('excludes low-confidence findings from consideration', () => {
    const findings = [finding({ value: 'gridAppearance', lift: 50, confidence: 'low' })];
    expect(buildBuild014Recommendation(findings, 5000)).toBeUndefined();
  });

  it('breaks ties by larger affected occurrence count', () => {
    const findings = [
      finding({ value: 'gridAppearance', lift: 5, occurrences: 50, confidence: 'medium' }),
      finding({ value: 'weakHierarchy', lift: 5, occurrences: 120, confidence: 'medium' }),
    ];
    const rec = buildBuild014Recommendation(findings, 5000);
    expect(rec?.failureMode).toBe('weakHierarchy');
  });

  it('returns undefined when no failureMode finding clears the confidence bar', () => {
    expect(buildBuild014Recommendation([], 5000)).toBeUndefined();
  });

  it('computes a real affected share percentage from the given total', () => {
    const findings = [finding({ occurrences: 250 })];
    const rec = buildBuild014Recommendation(findings, 5000);
    expect(rec?.affectedShare).toBe(5);
  });
});
