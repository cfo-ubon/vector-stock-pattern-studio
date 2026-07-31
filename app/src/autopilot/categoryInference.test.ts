import { describe, it, expect } from 'vitest';
import { inferCategoryId, isSupportedCategoryId, supportedCategoryIds } from './categoryInference';

describe('inferCategoryId', () => {
  it('matches a real keyword to a real generator category', () => {
    expect(inferCategoryId('Luxury Botanical florals')).toEqual({ categoryId: 'botanical', matched: true });
    expect(inferCategoryId('Tropical palm jungle')).toEqual({ categoryId: 'tropical', matched: true });
    expect(inferCategoryId('Mandala pattern')).toEqual({ categoryId: 'mandala', matched: true });
  });

  it('falls back to botanical, honestly reporting matched: false, when nothing matches', () => {
    const result = inferCategoryId('xyzzy nonsense theme');
    expect(result.categoryId).toBe('botanical');
    expect(result.matched).toBe(false);
  });

  it('every returned categoryId is a real, generator-supported id', () => {
    for (const text of ['botanical', 'tropical', 'geometric', 'nonsense', 'plaid check']) {
      const { categoryId } = inferCategoryId(text);
      expect(isSupportedCategoryId(categoryId)).toBe(true);
    }
  });
});

describe('supportedCategoryIds', () => {
  it('returns a non-empty real list matching the generator registry', () => {
    const ids = supportedCategoryIds();
    expect(ids.length).toBeGreaterThan(5);
    expect(ids).toContain('botanical');
  });
});
