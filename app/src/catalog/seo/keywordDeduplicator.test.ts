import { describe, it, expect } from 'vitest';
import { deduplicateKeywords } from './keywordDeduplicator';

describe('deduplicateKeywords', () => {
  it('returns everything unchanged when there are no duplicates', () => {
    const result = deduplicateKeywords(['floral', 'spring', 'seamless']);
    expect(result.unique).toEqual(['floral', 'spring', 'seamless']);
    expect(result.duplicatesRemoved).toEqual([]);
  });

  it('removes case-insensitive exact duplicates, keeping the first occurrence', () => {
    const result = deduplicateKeywords(['Floral', 'floral', 'FLORAL']);
    expect(result.unique).toEqual(['Floral']);
    expect(result.duplicatesRemoved).toEqual([
      { keyword: 'floral', duplicateOf: 'Floral' },
      { keyword: 'FLORAL', duplicateOf: 'Floral' },
    ]);
  });

  it('removes whitespace-insensitive duplicates', () => {
    const result = deduplicateKeywords(['spring pattern', '  spring   pattern  ']);
    expect(result.unique).toEqual(['spring pattern']);
    expect(result.duplicatesRemoved).toHaveLength(1);
  });

  it('drops whitespace-only entries silently, not as reported duplicates', () => {
    const result = deduplicateKeywords(['floral', '   ', '']);
    expect(result.unique).toEqual(['floral']);
    expect(result.duplicatesRemoved).toEqual([]);
  });

  it('preserves relative order of kept keywords', () => {
    const result = deduplicateKeywords(['c', 'a', 'b', 'a', 'c']);
    expect(result.unique).toEqual(['c', 'a', 'b']);
  });

  it('does NOT remove near-duplicates that are not exact (that is keywordAnalyzer\'s job)', () => {
    const result = deduplicateKeywords(['floral pattern', 'florals pattern']);
    expect(result.unique).toEqual(['floral pattern', 'florals pattern']);
  });
});
