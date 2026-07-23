import { describe, it, expect } from 'vitest';
import { bestFitProductTargetFit } from './productTargetFitV2';
import type { ProductUseEvaluation } from './productTargets';

function evalFixture(id: string, score: number, suitable: boolean): ProductUseEvaluation {
  return { id: id as ProductUseEvaluation['id'], label: id, score, suitable, reasons: [] };
}

describe('bestFitProductTargetFit', () => {
  it('averages only the suitable subset, ignoring irrelevant low scores', () => {
    const evaluations = [
      evalFixture('fabric', 85, true),
      evalFixture('textile', 80, true),
      evalFixture('wallpaper', 45, false),
      evalFixture('poster', 30, false),
      evalFixture('canvas', 20, false),
    ];
    const result = bestFitProductTargetFit(evaluations);
    expect(result.score).toBe(83); // mean of 85, 80
    expect(result.products.sort()).toEqual(['fabric', 'textile']);
  });

  it('falls back to the top-3 scores when nothing clears the suitability bar', () => {
    const evaluations = [
      evalFixture('a', 55, false),
      evalFixture('b', 50, false),
      evalFixture('c', 48, false),
      evalFixture('d', 40, false),
    ];
    const result = bestFitProductTargetFit(evaluations);
    expect(result.products).toEqual(['a', 'b', 'c']);
    expect(result.score).toBe(51); // mean of 55, 50, 48
  });

  it('never scores higher than the single best product', () => {
    const evaluations = [evalFixture('a', 90, true), evalFixture('b', 20, false)];
    const result = bestFitProductTargetFit(evaluations);
    expect(result.score).toBeLessThanOrEqual(90);
  });

  it('returns 0/empty for an empty input rather than throwing', () => {
    const result = bestFitProductTargetFit([]);
    expect(result.score).toBe(0);
    expect(result.products).toEqual([]);
  });
});
