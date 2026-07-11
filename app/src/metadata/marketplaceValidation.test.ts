import { describe, it, expect } from 'vitest';
import type { MarketplaceSeo } from './marketplaceSeo';
import { MARKETPLACE_PROFILES } from './marketplaceProfiles';
import { validateMarketplaceSeo, isMarketplaceReady } from './marketplaceValidation';

function baseSeo(overrides: Partial<MarketplaceSeo> = {}): MarketplaceSeo {
  return {
    marketplaceId: 'shutterstock',
    title: 'A perfectly reasonable seamless vector pattern title',
    description: 'A perfectly reasonable description that is long enough to pass validation checks easily.',
    keywords: ['seamless', 'pattern', 'vector', 'floral', 'botanical', 'flower', 'garden'],
    filename: 'my-pattern-abc123.eps',
    ...overrides,
  };
}

describe('marketplaceValidation: validation', () => {
  it('a healthy SEO package produces zero issues and is ready', () => {
    const issues = validateMarketplaceSeo(baseSeo(), MARKETPLACE_PROFILES.shutterstock);
    expect(issues).toEqual([]);
    expect(isMarketplaceReady(issues)).toBe(true);
  });

  it('flags title too short', () => {
    const issues = validateMarketplaceSeo(baseSeo({ title: 'short' }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'titleTooShort')).toBe(true);
    expect(isMarketplaceReady(issues)).toBe(false);
  });

  it('flags title too long', () => {
    const issues = validateMarketplaceSeo(baseSeo({ title: 'x'.repeat(300) }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'titleTooLong')).toBe(true);
    expect(isMarketplaceReady(issues)).toBe(false);
  });

  it('flags description missing when the marketplace requires one', () => {
    const issues = validateMarketplaceSeo(baseSeo({ description: '' }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'descriptionMissing')).toBe(true);
  });

  it('does not flag a missing description for a marketplace with no description field (Adobe Stock)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ description: '' }), MARKETPLACE_PROFILES.adobestock);
    expect(issues.some((i) => i.code === 'descriptionMissing')).toBe(false);
  });

  it('flags missing keywords (below minCount)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ keywords: ['seamless'] }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'keywordsMissing')).toBe(true);
  });

  it('flags too many keywords (above maxCount)', () => {
    const manyKeywords = Array.from({ length: 60 }, (_, i) => `kw${i}`);
    const issues = validateMarketplaceSeo(baseSeo({ keywords: manyKeywords }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'keywordsTooMany')).toBe(true);
  });

  it('flags duplicate keywords (case-insensitive)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ keywords: ['Seamless', 'seamless', 'pattern', 'vector', 'floral', 'botanical', 'flower'] }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'duplicateKeywords')).toBe(true);
  });

  it('flags an Etsy tag that exceeds the 20-character-per-tag limit', () => {
    const issues = validateMarketplaceSeo(
      baseSeo({ keywords: ['this-tag-is-way-too-long-for-etsy', 'seamless', 'pattern', 'vector', 'floral'] }),
      MARKETPLACE_PROFILES.etsy,
    );
    expect(issues.some((i) => i.code === 'keywordTooLong')).toBe(true);
  });

  it('flags an invalid filename (unsafe characters)', () => {
    const issues = validateMarketplaceSeo(baseSeo({ filename: 'my pattern!@#.svg' }), MARKETPLACE_PROFILES.shutterstock);
    expect(issues.some((i) => i.code === 'filenameInvalid')).toBe(true);
  });

  it('accepts a clean lowercase-hyphenated filename', () => {
    const issues = validateMarketplaceSeo(baseSeo({ filename: 'my-clean-filename-123.svg' }), MARKETPLACE_PROFILES.creativefabrica);
    expect(issues.some((i) => i.code === 'filenameInvalid')).toBe(false);
  });

  it('errors make isMarketplaceReady false; warnings alone keep it true', () => {
    const warningOnly = [{ code: 'keywordsMissing' as const, severity: 'warning' as const, message: 'x' }];
    const withError = [{ code: 'titleTooLong' as const, severity: 'error' as const, message: 'x' }];
    expect(isMarketplaceReady(warningOnly)).toBe(true);
    expect(isMarketplaceReady(withError)).toBe(false);
  });
});
