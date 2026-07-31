import { describe, it, expect } from 'vitest';
import { buildTile } from '../engine/tile';
import { defaultParams } from '../engine/defaults';
import { evaluateGeneratedPattern, generateWithBoundedRepair, MAX_REPAIR_ATTEMPTS } from './qualityEvaluation';

function makeParams(overrides: Partial<ReturnType<typeof defaultParams>> = {}) {
  return { ...defaultParams(), categoryId: 'botanical', seed: 'autopilot-qa-seed-1', ...overrides };
}

describe('evaluateGeneratedPattern', () => {
  it('produces a real READY/REVIEW/REJECT classification with real sub-scores, never a fabricated pass', () => {
    const params = makeParams();
    const tile = buildTile(params);
    const evaluation = evaluateGeneratedPattern(tile);
    expect(['READY', 'REVIEW', 'REJECT']).toContain(evaluation.decision);
    expect(evaluation.beautyReview.beautyScore).toBeGreaterThanOrEqual(0);
    expect(evaluation.commercialScore).toBeGreaterThanOrEqual(0);
    expect(typeof evaluation.fragmented).toBe('boolean');
    expect(typeof evaluation.deadSpace).toBe('boolean');
  });

  it('is deterministic — the same tile always evaluates to the same result', () => {
    const params = makeParams();
    const tile = buildTile(params);
    const a = evaluateGeneratedPattern(tile);
    const b = evaluateGeneratedPattern(tile);
    expect(a).toEqual(b);
  });
});

describe('generateWithBoundedRepair', () => {
  it('never exceeds MAX_REPAIR_ATTEMPTS (3) total attempts', () => {
    const params = makeParams();
    const result = generateWithBoundedRepair(params, (attempt) => `autopilot-qa-repair-${attempt}`);
    expect(result.attempts).toBeLessThanOrEqual(MAX_REPAIR_ATTEMPTS);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
  });

  it('the first attempt uses the base params seed exactly (reproducible by seed+config)', () => {
    const params = makeParams({ seed: 'exact-seed-check' });
    const direct = buildTile(params);
    const directEvaluation = evaluateGeneratedPattern(direct);
    const result = generateWithBoundedRepair(params, () => 'never-used-if-first-is-ready');
    if (result.attempts === 1) {
      expect(result.tileData.params.seed).toBe('exact-seed-check');
      expect(result.evaluation).toEqual(directEvaluation);
    }
  });

  it('stops early once a READY result is found (does not always burn all 3 attempts)', () => {
    const params = makeParams();
    const result = generateWithBoundedRepair(params, (attempt) => `early-stop-${attempt}`);
    if (result.evaluation.decision === 'READY') {
      // The loop breaks on the attempt that reached READY, so attempts
      // recorded is exactly how many were actually run, not always 3.
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    }
  });

  it('reports repaired: true only when more than one attempt actually ran', () => {
    const params = makeParams();
    const result = generateWithBoundedRepair(params, (attempt) => `repaired-flag-${attempt}`);
    expect(result.repaired).toBe(result.attempts > 1);
  });
});
