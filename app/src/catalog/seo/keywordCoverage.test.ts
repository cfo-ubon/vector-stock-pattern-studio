import { describe, it, expect } from 'vitest';
import { analyzeKeywordCoverage, COVERAGE_CONCEPTS } from './keywordCoverage';

describe('analyzeKeywordCoverage', () => {
  it('reports zero coverage for an empty keyword list', () => {
    const report = analyzeKeywordCoverage([]);
    expect(report.coveredConcepts).toEqual([]);
    expect(report.missingConcepts).toEqual(COVERAGE_CONCEPTS);
    expect(report.coverageScore).toBe(0);
  });

  it('reports full coverage when every concept bucket is touched', () => {
    const report = analyzeKeywordCoverage([
      'seamless pattern', // technique
      'floral', // subject
      'pastel', // color
      'fabric', // useCase
      'editable eps', // format
    ]);
    expect(report.coveredConcepts.sort()).toEqual([...COVERAGE_CONCEPTS].sort());
    expect(report.missingConcepts).toEqual([]);
    expect(report.coverageScore).toBe(100);
  });

  it('reports partial coverage and lists exactly the missing concepts', () => {
    const report = analyzeKeywordCoverage(['seamless', 'floral']); // technique + subject only
    expect(report.coveredConcepts.sort()).toEqual(['subject', 'technique']);
    expect(report.missingConcepts.sort()).toEqual(['color', 'format', 'useCase']);
    expect(report.coverageScore).toBe(40);
  });

  it('matches concept terms as substrings within multi-word keywords', () => {
    const report = analyzeKeywordCoverage(['beautiful seamless spring floral design for wallpaper']);
    expect(report.coveredConcepts).toContain('technique');
    expect(report.coveredConcepts).toContain('subject');
    expect(report.coveredConcepts).toContain('useCase');
  });

  it('is case-insensitive', () => {
    const report = analyzeKeywordCoverage(['SEAMLESS', 'FLORAL']);
    expect(report.coveredConcepts.sort()).toEqual(['subject', 'technique']);
  });
});
