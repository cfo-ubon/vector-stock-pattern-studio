import { describe, it, expect } from 'vitest';
import { generateSeoPackage, UnknownSeoMarketplaceError } from './seoGenerator';
import { getSeoProfile } from './seoProfile';

describe('generateSeoPackage — unknown marketplace', () => {
  it('throws UnknownSeoMarketplaceError (unlike the validator, which never throws)', () => {
    expect(() => generateSeoPackage({ title: 'x', description: '', keywords: [] }, 'not-a-real-marketplace')).toThrow(UnknownSeoMarketplaceError);
  });
});

describe('generateSeoPackage — keyword deduplication', () => {
  it('removes exact duplicates from the generated keyword list', () => {
    const result = generateSeoPackage({ title: 'Seamless Pastel Floral Spring Pattern', description: '', keywords: ['floral', 'Floral', 'spring', 'spring'] }, 'freepik');
    expect(result.keywords).toEqual(['floral', 'spring']);
  });
});

describe('generateSeoPackage — keyword count truncation', () => {
  it('truncates the keyword list to the marketplace maximum', () => {
    const etsy = getSeoProfile('etsy')!; // max 13
    const manyKeywords = Array.from({ length: 20 }, (_, i) => `keyword${i}`);
    const result = generateSeoPackage({ title: 'A Handmade Etsy Style Pattern Listing', description: 'A description long enough to pass the forty character minimum easily.', keywords: manyKeywords }, 'etsy');
    expect(result.keywords).toHaveLength(etsy.keywords.maxCount);
    expect(result.keywords).toEqual(manyKeywords.slice(0, etsy.keywords.maxCount));
  });

  it('does not truncate when the keyword count is already within bounds', () => {
    const keywords = ['floral', 'spring', 'seamless', 'pastel', 'fabric'];
    const result = generateSeoPackage({ title: 'A Handmade Etsy Style Pattern Listing', description: 'A description long enough to pass the forty character minimum easily.', keywords }, 'etsy');
    expect(result.keywords).toEqual(keywords);
  });
});

describe('generateSeoPackage — per-keyword length truncation', () => {
  it('truncates an over-long keyword to the marketplace per-keyword limit', () => {
    const longKeyword = 'this keyword is definitely way too long for etsy tags to accept';
    const result = generateSeoPackage({ title: 'A Handmade Etsy Style Pattern Listing', description: 'A description long enough to pass the forty character minimum easily.', keywords: ['floral', 'spring', 'seamless', 'pastel', longKeyword] }, 'etsy');
    const truncated = result.keywords.find((k) => k.toLowerCase().startsWith('this keyword'));
    expect(truncated).toBeDefined();
    expect(truncated!.length).toBeLessThanOrEqual(getSeoProfile('etsy')!.keywords.maxKeywordLength);
  });
});

describe('generateSeoPackage — title truncation', () => {
  it('truncates an over-long title at a word boundary, never mid-word', () => {
    const longTitle = 'Seamless Pastel Floral Spring Pattern With Repeating Botanical Motifs For Fabric Wallpaper And Packaging Design Projects Everywhere You Can Imagine And Even More Beyond That Limit For Sure Definitely';
    const result = generateSeoPackage({ title: longTitle, description: '', keywords: [] }, 'adobestock'); // adobestock max 70
    expect(result.title.length).toBeLessThanOrEqual(70);
    expect(longTitle.startsWith(result.title)).toBe(true); // truncation, not rewriting
    expect(result.title.endsWith(' ')).toBe(false); // no trailing whitespace from a word-boundary cut
  });

  it('leaves a title within bounds untouched', () => {
    const title = 'Seamless Pastel Floral Spring Pattern';
    const result = generateSeoPackage({ title, description: '', keywords: [] }, 'adobestock');
    expect(result.title).toBe(title);
  });
});

describe('generateSeoPackage — description truncation', () => {
  it('truncates an over-long description at a word boundary', () => {
    const longDescription = 'word '.repeat(2000).trim();
    const result = generateSeoPackage({ title: 'A Handmade Etsy Style Pattern Listing', description: longDescription, keywords: ['floral', 'spring', 'seamless', 'pastel', 'fabric'] }, 'etsy'); // etsy max 5000
    expect(result.description.length).toBeLessThanOrEqual(5000);
  });

  it('leaves an empty description empty rather than inventing copy', () => {
    const result = generateSeoPackage({ title: 'Seamless Pastel Floral Spring Pattern', description: '', keywords: [] }, 'freepik');
    expect(result.description).toBe('');
  });
});

describe('generateSeoPackage — attaches real validation and score', () => {
  it('validation and score reflect the GENERATED content, not the raw input', () => {
    const etsy = getSeoProfile('etsy')!;
    const manyKeywords = Array.from({ length: 20 }, (_, i) => `keyword${i}`); // input has 20, over etsy's max of 13
    const result = generateSeoPackage({ title: 'A Handmade Etsy Style Pattern Listing', description: 'A description long enough to pass the forty character minimum easily.', keywords: manyKeywords }, 'etsy');
    expect(result.keywords).toHaveLength(etsy.keywords.maxCount);
    // The generated package's own keyword count is within bounds, so the
    // validator must NOT report a keyword-non-compliant error for count —
    // proving validation ran against result.keywords, not the raw input.
    expect(result.validation.errors.some((e) => e.code === 'keyword-non-compliant')).toBe(false);
  });
});
