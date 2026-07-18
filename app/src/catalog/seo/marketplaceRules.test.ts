import { describe, it, expect } from 'vitest';
import { checkTitleCompliance, checkDescriptionCompliance, checkKeywordCompliance } from './marketplaceRules';
import { getSeoProfile } from './seoProfile';

const etsy = getSeoProfile('etsy')!;
const adobestock = getSeoProfile('adobestock')!;

describe('checkTitleCompliance', () => {
  it('is compliant for a title within bounds', () => {
    const result = checkTitleCompliance('A lovely seamless floral spring pattern for fabric', etsy);
    expect(result.compliant).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('flags an empty title', () => {
    const result = checkTitleCompliance('', etsy);
    expect(result.compliant).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('flags a title below the minimum length', () => {
    const result = checkTitleCompliance('Short', etsy); // etsy min is 10
    expect(result.compliant).toBe(false);
  });

  it('flags a title over the maximum length', () => {
    const longTitle = 'x'.repeat(adobestock.title.maxLength + 10);
    const result = checkTitleCompliance(longTitle, adobestock);
    expect(result.compliant).toBe(false);
  });
});

describe('checkDescriptionCompliance', () => {
  it('flags a missing description when the marketplace requires one', () => {
    const result = checkDescriptionCompliance('', etsy);
    expect(result.compliant).toBe(false);
  });

  it('is compliant for an empty description when the marketplace does not require one', () => {
    const result = checkDescriptionCompliance('', adobestock);
    expect(result.compliant).toBe(true);
  });

  it('flags a description below the minimum length when non-empty', () => {
    const result = checkDescriptionCompliance('Too short.', etsy); // etsy min is 40
    expect(result.compliant).toBe(false);
  });

  it('is compliant for a description within bounds', () => {
    const description = 'A beautiful seamless floral pattern, perfect for spring collections and fabric printing projects.';
    const result = checkDescriptionCompliance(description, etsy);
    expect(result.compliant).toBe(true);
  });
});

describe('checkKeywordCompliance', () => {
  it('flags too few keywords', () => {
    const result = checkKeywordCompliance(['floral', 'spring'], etsy); // etsy min is 5
    expect(result.compliant).toBe(false);
  });

  it('flags too many keywords', () => {
    const tooMany = Array.from({ length: 20 }, (_, i) => `kw${i}`); // etsy max is 13
    const result = checkKeywordCompliance(tooMany, etsy);
    expect(result.compliant).toBe(false);
  });

  it('flags a keyword exceeding the per-keyword length limit', () => {
    const result = checkKeywordCompliance(['floral', 'spring', 'seamless', 'pastel', 'this keyword is way too long for etsy tags'], etsy); // etsy maxKeywordLength is 20
    expect(result.compliant).toBe(false);
  });

  it('is compliant for a well-formed keyword list', () => {
    const result = checkKeywordCompliance(['floral', 'spring', 'seamless', 'pastel', 'fabric'], etsy);
    expect(result.compliant).toBe(true);
  });
});
