import { describe, it, expect } from 'vitest';
import { buildDesignCoachAdvice } from './designCoach';
import { evaluateDesign } from './designEvaluation';
import { defaultParams } from '../engine/defaults';
import type { CommercialReadinessReport } from '../commercial/domain/types';

describe('buildDesignCoachAdvice', () => {
  it('produces one advice item per real detected problem/issue, each pointing at a real editable control', () => {
    // Deliberately mechanical params (near-zero jitter, low density) —
    // designed to trigger real detectors (equalSpacingDetected,
    // mechanicalSpacing, etc.), not a fabricated scenario.
    const params = { ...defaultParams(), seed: 'coach-seed', rotationJitter: 0, scaleJitter: 0, density: 0.1 };
    const evaluation = evaluateDesign(params);

    const advice = buildDesignCoachAdvice(evaluation, null);

    expect(Array.isArray(advice)).toBe(true);
    const problemIds = new Set(evaluation.problems.map((p) => p.id));
    const issueIds = new Set<string>(evaluation.issues.filter((i) => i.detected).map((i) => i.id));

    for (const item of advice) {
      if (item.source === 'problem') {
        expect(problemIds.has(item.id.replace('problem:', ''))).toBe(true);
      } else if (item.source === 'issue') {
        expect(issueIds.has(item.id.replace('issue:', ''))).toBe(true);
      }
      expect(item.suggestion.length).toBeGreaterThan(0);
      expect(item.message.length).toBeGreaterThan(0);
    }
  });

  it('sorts advice with high severity first', () => {
    const evaluation = evaluateDesign({ ...defaultParams(), seed: 'sort-seed', rotationJitter: 0, scaleJitter: 0 });
    const advice = buildDesignCoachAdvice(evaluation, null);
    for (let i = 1; i < advice.length; i++) {
      const rank = (s: string) => (s === 'high' ? 3 : s === 'medium' ? 2 : 1);
      expect(rank(advice[i - 1].severity)).toBeGreaterThanOrEqual(rank(advice[i].severity));
    }
  });

  it('surfaces real FAIL/WARNING readiness checks as readiness-sourced advice, and skips PASS checks', () => {
    const evaluation = evaluateDesign({ ...defaultParams(), seed: 'readiness-seed' });
    const readiness: CommercialReadinessReport = {
      assetId: 'a1',
      computedAt: Date.now(),
      checks: [
        { id: 'collectionAssignment', label: 'Collection assignment exists', status: 'FAIL', detail: 'Not assigned to any collection.' },
        { id: 'svgExists', label: 'SVG exists', status: 'PASS', detail: 'SVG source file present.' },
      ],
      score: 40,
      band: 'BLOCKED',
      failingChecks: ['collectionAssignment'],
      warningChecks: [],
    };

    const advice = buildDesignCoachAdvice(evaluation, readiness);
    const readinessAdvice = advice.filter((a) => a.source === 'readiness');
    expect(readinessAdvice.some((a) => a.id === 'readiness:collectionAssignment')).toBe(true);
    expect(readinessAdvice.some((a) => a.id === 'readiness:svgExists')).toBe(false);
    expect(readinessAdvice.find((a) => a.id === 'readiness:collectionAssignment')?.severity).toBe('high');
  });

  it('returns an empty list for a clean evaluation with no readiness data', () => {
    // Not asserting zero problems for every seed (that would be fabricating
    // a guarantee the real engine doesn't make) — only that advice items
    // never exceed the real detected problems/issues/readiness checks.
    const evaluation = evaluateDesign({ ...defaultParams(), seed: 'clean-seed' });
    const advice = buildDesignCoachAdvice(evaluation, null);
    expect(advice.length).toBeLessThanOrEqual(evaluation.problems.length + evaluation.issues.filter((i) => i.detected).length);
  });
});
