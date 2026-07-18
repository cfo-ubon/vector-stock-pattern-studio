import { describe, it, expect } from 'vitest';
import { analyzeKeywords } from './keywordAnalyzer';

describe('analyzeKeywords — duplicates', () => {
  it('reports exact duplicates via the same logic as keywordDeduplicator', () => {
    const report = analyzeKeywords(['floral', 'Floral', 'spring']);
    expect(report.totalKeywords).toBe(3);
    expect(report.uniqueKeywordCount).toBe(2);
    expect(report.duplicates).toEqual([{ keyword: 'Floral', duplicateOf: 'floral' }]);
  });
});

describe('analyzeKeywords — similar keywords', () => {
  it('detects a near-duplicate pair at small edit distance', () => {
    const report = analyzeKeywords(['floral print', 'florals print']);
    expect(report.similarPairs.length).toBeGreaterThan(0);
    expect(report.similarPairs[0].distance).toBeGreaterThanOrEqual(1);
    expect(report.similarPairs[0].distance).toBeLessThanOrEqual(2);
  });

  it('does not flag two genuinely unrelated keywords as similar', () => {
    const report = analyzeKeywords(['floral pattern', 'geometric abstract design']);
    expect(report.similarPairs).toEqual([]);
  });

  it('does not double-report a plural pair as also "similar"', () => {
    const report = analyzeKeywords(['flower', 'flowers']);
    expect(report.pluralConflicts).toEqual([{ singular: 'flower', plural: 'flowers' }]);
    expect(report.similarPairs).toEqual([]);
  });
});

describe('analyzeKeywords — plural/singular conflicts', () => {
  it('detects a simple -s plural pair', () => {
    const report = analyzeKeywords(['pattern', 'patterns']);
    expect(report.pluralConflicts).toEqual([{ singular: 'pattern', plural: 'patterns' }]);
  });

  it('detects an -es plural pair', () => {
    const report = analyzeKeywords(['box', 'boxes']);
    expect(report.pluralConflicts).toEqual([{ singular: 'box', plural: 'boxes' }]);
  });

  it('detects a y -> ies plural pair', () => {
    const report = analyzeKeywords(['daisy', 'daisies']);
    expect(report.pluralConflicts).toEqual([{ singular: 'daisy', plural: 'daisies' }]);
  });

  it('does not flag unrelated words as a plural conflict', () => {
    const report = analyzeKeywords(['floral', 'geometric']);
    expect(report.pluralConflicts).toEqual([]);
  });
});

describe('analyzeKeywords — ordering quality', () => {
  it('scores 100 for broad-to-specific ordering', () => {
    const report = analyzeKeywords(['floral', 'floral seamless pattern', 'pastel floral seamless repeat pattern']);
    expect(report.orderingScore).toBe(100);
  });

  it('scores lower when specific keywords come before broad ones', () => {
    const report = analyzeKeywords(['pastel floral seamless repeat pattern', 'floral seamless pattern', 'floral']);
    expect(report.orderingScore).toBe(0);
  });

  it('scores 100 for a single keyword or empty list (nothing to order)', () => {
    expect(analyzeKeywords([]).orderingScore).toBe(100);
    expect(analyzeKeywords(['floral']).orderingScore).toBe(100);
  });
});

describe('analyzeKeywords — coverage', () => {
  it('embeds a real KeywordCoverageReport', () => {
    const report = analyzeKeywords(['seamless', 'floral', 'pastel', 'fabric', 'editable']);
    expect(report.coverage.coverageScore).toBe(100);
  });
});

describe('analyzeKeywords — noise keywords', () => {
  it('flags stopword-only keywords', () => {
    const report = analyzeKeywords(['the', 'and', 'floral pattern']);
    expect(report.noiseKeywords).toEqual(['the', 'and']);
  });

  it('flags keywords shorter than the minimum meaningful length', () => {
    const report = analyzeKeywords(['ab', 'floral']);
    expect(report.noiseKeywords).toContain('ab');
  });

  it('does not flag legitimate short real words', () => {
    const report = analyzeKeywords(['sun', 'art', 'zoo']);
    expect(report.noiseKeywords).toEqual([]);
  });

  it('reports no noise for a clean keyword list', () => {
    const report = analyzeKeywords(['floral', 'seamless pattern', 'spring']);
    expect(report.noiseKeywords).toEqual([]);
  });
});
