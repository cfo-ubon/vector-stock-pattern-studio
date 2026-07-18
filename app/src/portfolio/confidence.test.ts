import { describe, expect, it } from 'vitest';
import { computeSampleConfidence, computeTileEvaluatorConfidence } from './confidence';
import type { EvaluationTraceEntry } from '../engine/scoringV2';

function entry(confidence: EvaluationTraceEntry['confidence']): EvaluationTraceEntry {
  return { ruleId: 'r', label: 'r', points: -5, reason: 'test', confidence };
}

describe('computeTileEvaluatorConfidence', () => {
  it('returns high when no low/medium-confidence rules fired and instances are plentiful', () => {
    expect(computeTileEvaluatorConfidence([], [], 20)).toBe('high');
  });

  it('downgrades to low when instances are sparse AND a low/medium-confidence rule fired', () => {
    expect(computeTileEvaluatorConfidence([entry('low')], [], 3)).toBe('low');
  });

  it('downgrades to medium when instances are sparse but all rules are high-confidence', () => {
    expect(computeTileEvaluatorConfidence([entry('high')], [], 3)).toBe('medium');
  });

  it('downgrades to medium when 2+ low-confidence rules fired even with plentiful instances', () => {
    expect(computeTileEvaluatorConfidence([entry('low'), entry('low')], [], 20)).toBe('medium');
  });

  it('downgrades to medium when 3+ medium-confidence rules fired', () => {
    expect(computeTileEvaluatorConfidence([entry('medium'), entry('medium'), entry('medium')], [], 20)).toBe('medium');
  });

  it('considers exempted penalties too, not only applied ones', () => {
    expect(computeTileEvaluatorConfidence([], [entry('low')], 3)).toBe('low');
  });
});

describe('computeSampleConfidence', () => {
  it('is always low below the 30-sample floor, regardless of variance', () => {
    const result = computeSampleConfidence({ sampleSize: 10, values: [80, 80, 80] });
    expect(result.tier).toBe('low');
    expect(result.reason).toContain('30-observation floor');
  });

  it('is high with >=30 samples, low variance, and full coverage', () => {
    const values = Array.from({ length: 40 }, (_, i) => 80 + (i % 3));
    const result = computeSampleConfidence({ sampleSize: 40, values, coverageFraction: 1 });
    expect(result.tier).toBe('high');
  });

  it('is medium with >=30 samples but high variance', () => {
    const values = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 20 : 90));
    const result = computeSampleConfidence({ sampleSize: 40, values, coverageFraction: 1 });
    expect(result.tier).toBe('medium');
    expect(result.reason).toContain('coefficient of variation');
  });

  it('is medium with >=30 samples, low variance, but low coverage', () => {
    const values = Array.from({ length: 40 }, () => 80);
    const result = computeSampleConfidence({ sampleSize: 40, values, coverageFraction: 0.3 });
    expect(result.tier).toBe('medium');
    expect(result.reason).toContain('coverage');
  });

  it('computes a real coefficient of variation, not a placeholder', () => {
    const result = computeSampleConfidence({ sampleSize: 30, values: Array(30).fill(50) });
    expect(result.coefficientOfVariation).toBe(0);
  });

  it('defaults coverageFraction to 1 when omitted', () => {
    const values = Array(30).fill(75);
    const result = computeSampleConfidence({ sampleSize: 30, values });
    expect(result.coverageFraction).toBe(1);
  });
});
