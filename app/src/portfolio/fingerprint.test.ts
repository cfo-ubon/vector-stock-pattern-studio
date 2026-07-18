import { describe, expect, it } from 'vitest';
import { bucket, classifyDuplicate, computeSimilarityFingerprint, DEFAULT_DUPLICATE_THRESHOLDS, shapeSetSimilarity } from './fingerprint';

describe('bucket', () => {
  it('rounds to the nearest step', () => {
    expect(bucket(0.32, 0.05)).toBeCloseTo(0.3, 6);
    expect(bucket(0.38, 0.05)).toBeCloseTo(0.4, 6);
  });

  it('never leaks floating-point artifacts like 0.30000000000000004', () => {
    const result = bucket(0.3, 0.05);
    expect(result.toString()).toBe('0.3');
  });

  it('buckets node counts to the given step', () => {
    expect(bucket(437, 200)).toBe(400);
    expect(bucket(650, 200)).toBe(600);
  });
});

describe('computeSimilarityFingerprint', () => {
  it('produces a deterministic, human-readable string from real fields', () => {
    const fp = computeSimilarityFingerprint({
      styleDnaId: 'stockClean', layoutId: 'grid', compositionZone: 'center', paletteId: 'earthTone',
      botanicalFamily: 'rose', hierarchyPreset: 'classic', productTarget: 'wallpaper',
      density: 0.32, negativeSpace: 0.28, nodeCount: 437, shapeSignatures: ['a', 'b', 'a'],
    });
    expect(fp).toBe('style:stockClean|layout:grid|zone:center|palette:earthTone|family:rose|hierarchy:classic|product:wallpaper|density:0.3|negSpace:0.3|nodes:400|shapes:2');
  });

  it('falls back to "none" for undefined optional fields', () => {
    const fp = computeSimilarityFingerprint({
      styleDnaId: 'a', layoutId: 'grid', productTarget: 'wallpaper', density: 0.3, negativeSpace: 0.3, nodeCount: 400, shapeSignatures: [],
    });
    expect(fp).toContain('zone:none');
    expect(fp).toContain('palette:none');
    expect(fp).toContain('family:none');
    expect(fp).toContain('hierarchy:none');
  });

  it('produces identical fingerprints for two calls with identical input (determinism)', () => {
    const input = { styleDnaId: 'a', layoutId: 'grid', productTarget: 'wallpaper' as const, density: 0.3, negativeSpace: 0.3, nodeCount: 400, shapeSignatures: ['x'] };
    expect(computeSimilarityFingerprint(input)).toBe(computeSimilarityFingerprint(input));
  });
});

describe('shapeSetSimilarity', () => {
  it('returns 1 for identical shape sets', () => {
    expect(shapeSetSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
  });

  it('returns 0 for disjoint shape sets', () => {
    expect(shapeSetSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('returns 1 for two empty sets (no evidence of difference)', () => {
    expect(shapeSetSimilarity([], [])).toBe(1);
  });

  it('computes real Jaccard similarity for partial overlap', () => {
    // intersection {b} = 1, union {a,b,c} = 3
    expect(shapeSetSimilarity(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3, 6);
  });

  it('dedupes repeated signatures before comparing', () => {
    expect(shapeSetSimilarity(['a', 'a', 'a'], ['a'])).toBe(1);
  });
});

describe('classifyDuplicate', () => {
  const base = { shapeSignatures: ['a', 'b'], productTarget: 'wallpaper', paletteId: 'earthTone', compositionZone: 'center', densityBucket: 0.3, nodeCountBucket: 400 };

  it('classifies identical shape sets + identical structure as exactDuplicate', () => {
    const result = classifyDuplicate(base, { ...base });
    expect(result?.status).toBe('exactDuplicate');
    expect(result?.similarity).toBe(1);
  });

  it('classifies identical shapes but different structure as deterministicDuplicate', () => {
    const result = classifyDuplicate(base, { ...base, paletteId: 'luxury' });
    expect(result?.status).toBe('deterministicDuplicate');
  });

  it('classifies high-but-imperfect shape overlap with matching structure as nearDuplicate', () => {
    const a = { ...base, shapeSignatures: ['a', 'b', 'c', 'd'] };
    const b = { ...base, shapeSignatures: ['a', 'b', 'c', 'e'] }; // jaccard 3/5 = 0.6, below default near=0.8
    expect(classifyDuplicate(a, b)).toBeUndefined();
    const c = { ...base, shapeSignatures: ['a', 'b', 'c', 'd', 'e'] };
    const d = { ...base, shapeSignatures: ['a', 'b', 'c', 'd'] }; // jaccard 4/5 = 0.8
    expect(classifyDuplicate(c, d)?.status).toBe('nearDuplicate');
  });

  it('classifies high shape overlap with different structure as acceptableVariant', () => {
    const a = { ...base, shapeSignatures: ['a', 'b', 'c', 'd', 'e'] };
    const b = { ...base, shapeSignatures: ['a', 'b', 'c', 'd'], paletteId: 'luxury' };
    expect(classifyDuplicate(a, b)?.status).toBe('acceptableVariant');
  });

  it('returns undefined below the near threshold — a real, distinct output', () => {
    const a = { ...base, shapeSignatures: ['a', 'b'] };
    const b = { ...base, shapeSignatures: ['c', 'd'] };
    expect(classifyDuplicate(a, b)).toBeUndefined();
  });

  it('respects custom thresholds', () => {
    const a = { ...base, shapeSignatures: ['a', 'b', 'c'] };
    const b = { ...base, shapeSignatures: ['a', 'b'] }; // jaccard 2/3 = 0.667
    expect(classifyDuplicate(a, b)).toBeUndefined();
    const custom = { ...DEFAULT_DUPLICATE_THRESHOLDS, near: 0.5 };
    expect(classifyDuplicate(a, b, custom)?.status).toBe('nearDuplicate');
  });
});
