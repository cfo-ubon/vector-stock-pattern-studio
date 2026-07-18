import { describe, it, expect } from 'vitest';
import { analyzeTitle } from './titleAnalyzer';
import { getSeoProfile } from './seoProfile';

const shutterstock = getSeoProfile('shutterstock')!;

describe('analyzeTitle — length', () => {
  it('scores a well-within-bounds title at 100 for lengthScore', () => {
    const report = analyzeTitle('Seamless Pastel Floral Spring Pattern With Repeating Botanical Motifs', [], shutterstock);
    expect(report.lengthScore).toBe(100);
  });

  it('penalizes a title below the minimum length', () => {
    const report = analyzeTitle('Short', [], shutterstock); // shutterstock min 20
    expect(report.lengthScore).toBeLessThan(100);
  });

  it('penalizes a title above the maximum length', () => {
    const report = analyzeTitle('x'.repeat(shutterstock.title.maxLength + 50), [], shutterstock);
    expect(report.lengthScore).toBeLessThan(100);
  });

  it('scores 0 for an empty title', () => {
    const report = analyzeTitle('', [], shutterstock);
    expect(report.lengthScore).toBe(0);
    expect(report.length).toBe(0);
  });
});

describe('analyzeTitle — keyword placement', () => {
  it('scores 100 when no keywords are given (nothing to place)', () => {
    const report = analyzeTitle('A Reasonable Title Here', [], shutterstock);
    expect(report.keywordPlacementScore).toBe(100);
  });

  it('scores 100 when the primary keyword appears in the title', () => {
    const report = analyzeTitle('Seamless Floral Spring Pattern', ['floral'], shutterstock);
    expect(report.keywordPlacementScore).toBe(100);
  });

  it('scores lower when none of the top keywords appear in the title', () => {
    const report = analyzeTitle('Seamless Abstract Geometric Pattern', ['floral', 'botanical', 'spring'], shutterstock);
    expect(report.keywordPlacementScore).toBe(0);
  });

  it('weights an earlier keyword match more than a later one', () => {
    const withFirst = analyzeTitle('Floral Pattern Design', ['floral', 'geometric', 'stripe'], shutterstock);
    const withThird = analyzeTitle('Stripe Pattern Design', ['floral', 'geometric', 'stripe'], shutterstock);
    expect(withFirst.keywordPlacementScore).toBeGreaterThan(withThird.keywordPlacementScore);
  });
});

describe('analyzeTitle — readability', () => {
  it('penalizes ALL CAPS titles', () => {
    const normal = analyzeTitle('Seamless Floral Spring Pattern Design', [], shutterstock);
    const shouting = analyzeTitle('SEAMLESS FLORAL SPRING PATTERN DESIGN', [], shutterstock);
    expect(shouting.readabilityScore).toBeLessThan(normal.readabilityScore);
  });

  it('penalizes a title that is too short in word count', () => {
    const report = analyzeTitle('Floral', [], shutterstock);
    expect(report.readabilityScore).toBeLessThan(100);
  });
});

describe('analyzeTitle — duplicate words', () => {
  it('detects a repeated word', () => {
    const report = analyzeTitle('Floral Floral Seamless Pattern Design', [], shutterstock);
    expect(report.duplicateWords).toContain('floral');
    expect(report.duplicateWordScore).toBeLessThan(100);
  });

  it('reports no duplicates for a clean title', () => {
    const report = analyzeTitle('Seamless Floral Spring Pattern Design', [], shutterstock);
    expect(report.duplicateWords).toEqual([]);
    expect(report.duplicateWordScore).toBe(100);
  });
});

describe('analyzeTitle — marketplace compliance and overall score', () => {
  it('scores complianceScore 100 for a compliant title', () => {
    const report = analyzeTitle('Seamless Pastel Floral Spring Pattern With Repeating Botanical Motifs', [], shutterstock);
    expect(report.complianceScore).toBe(100);
  });

  it('overall score is the average of the 5 sub-scores, within 0-100', () => {
    const report = analyzeTitle('Seamless Pastel Floral Spring Pattern With Repeating Botanical Motifs', ['floral'], shutterstock);
    const expected = Math.round((report.lengthScore + report.keywordPlacementScore + report.readabilityScore + report.duplicateWordScore + report.complianceScore) / 5);
    expect(report.score).toBe(expected);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it('a well-formed title scores highly overall', () => {
    const report = analyzeTitle('Seamless Pastel Floral Spring Pattern With Repeating Botanical Motifs', ['floral'], shutterstock);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it('an empty title scores substantially worse than a well-formed one', () => {
    const empty = analyzeTitle('', [], shutterstock);
    const wellFormed = analyzeTitle('Seamless Pastel Floral Spring Pattern With Repeating Botanical Motifs', [], shutterstock);
    expect(empty.score).toBeLessThan(wellFormed.score);
    expect(empty.lengthScore).toBe(0);
    expect(empty.readabilityScore).toBe(0);
  });
});
