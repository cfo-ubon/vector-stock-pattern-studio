import { describe, it, expect } from 'vitest';
import { analyzeDescription } from './descriptionAnalyzer';
import { getSeoProfile } from './seoProfile';

const etsy = getSeoProfile('etsy')!; // description required, min 40, max 5000
const adobestock = getSeoProfile('adobestock')!; // description not required

const NATURAL_DESCRIPTION =
  'This seamless floral pattern brings a soft, pastel spring feel to any project. It works beautifully on fabric, wallpaper, and packaging designs.';

describe('analyzeDescription — empty optional description', () => {
  it('scores everything at 100 for an empty description on a marketplace that does not require one', () => {
    const report = analyzeDescription('', [], adobestock);
    expect(report).toEqual({ length: 0, lengthScore: 100, keywordCoverageScore: 100, naturalLanguageScore: 100, readabilityScore: 100, complianceScore: 100, score: 100 });
  });
});

describe('analyzeDescription — empty required description', () => {
  it('scores poorly when the marketplace requires a description and none is given', () => {
    const report = analyzeDescription('', [], etsy);
    expect(report.length).toBe(0);
    expect(report.lengthScore).toBe(0);
    expect(report.complianceScore).toBeLessThan(100);
    expect(report.score).toBeLessThan(50);
  });
});

describe('analyzeDescription — length', () => {
  it('scores 100 for a description within bounds', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, [], etsy);
    expect(report.lengthScore).toBe(100);
  });

  it('penalizes a description below the minimum length', () => {
    const report = analyzeDescription('Too short.', [], etsy); // etsy min 40
    expect(report.lengthScore).toBeLessThan(100);
  });

  it('penalizes a description above the maximum length', () => {
    const report = analyzeDescription('x '.repeat(etsy.description.maxLength), [], etsy);
    expect(report.lengthScore).toBeLessThan(100);
  });
});

describe('analyzeDescription — keyword coverage', () => {
  it('scores 100 when no keywords are given (nothing to cover)', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, [], etsy);
    expect(report.keywordCoverageScore).toBe(100);
  });

  it('scores 100 when every keyword is mentioned in the description', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, ['floral', 'pastel', 'fabric'], etsy);
    expect(report.keywordCoverageScore).toBe(100);
  });

  it('scores partially when only some keywords are mentioned', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, ['floral', 'geometric'], etsy);
    expect(report.keywordCoverageScore).toBe(50);
  });

  it('scores 0 when no keywords are mentioned', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, ['geometric', 'tribal'], etsy);
    expect(report.keywordCoverageScore).toBe(0);
  });
});

describe('analyzeDescription — natural language', () => {
  it('scores highly for real prose', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, [], etsy);
    expect(report.naturalLanguageScore).toBeGreaterThanOrEqual(80);
  });

  it('scores poorly for a comma-joined keyword dump', () => {
    const report = analyzeDescription('seamless, floral, pattern, pastel, spring, botanical, fabric, wallpaper', [], etsy);
    expect(report.naturalLanguageScore).toBeLessThan(80);
  });
});

describe('analyzeDescription — readability', () => {
  it('penalizes ALL CAPS descriptions', () => {
    const normal = analyzeDescription(NATURAL_DESCRIPTION, [], etsy);
    const shouting = analyzeDescription(NATURAL_DESCRIPTION.toUpperCase(), [], etsy);
    expect(shouting.readabilityScore).toBeLessThan(normal.readabilityScore);
  });
});

describe('analyzeDescription — marketplace compliance and overall score', () => {
  it('overall score is the average of the 5 sub-scores', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, ['floral'], etsy);
    const expected = Math.round((report.lengthScore + report.keywordCoverageScore + report.naturalLanguageScore + report.readabilityScore + report.complianceScore) / 5);
    expect(report.score).toBe(expected);
  });

  it('a well-formed description scores highly overall', () => {
    const report = analyzeDescription(NATURAL_DESCRIPTION, ['floral'], etsy);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });
});
