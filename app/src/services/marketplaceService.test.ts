import { describe, it, expect } from 'vitest';
import { listMarketplaces, getMarketplace, listAvailableMarketplaces, isKeywordLengthValid, isKeywordCountValid } from './marketplaceService';

describe('marketplaceService', () => {
  it('listMarketplaces returns all 6 profiles', () => {
    expect(listMarketplaces()).toHaveLength(6);
  });

  it('getMarketplace resolves a real id and returns undefined for an unknown one', () => {
    expect(getMarketplace('shutterstock')?.id).toBe('shutterstock');
    expect(getMarketplace('not-real')).toBeUndefined();
  });

  it('listAvailableMarketplaces excludes any profile with future: true', () => {
    for (const profile of listAvailableMarketplaces()) {
      expect(profile.future).toBe(false);
    }
  });

  it('isKeywordLengthValid returns false for an unknown marketplace', () => {
    expect(isKeywordLengthValid('not-real', 'x')).toBe(false);
  });

  it('isKeywordLengthValid respects a configured maxKeywordLength when present', () => {
    const marketplace = getMarketplace('shutterstock')!;
    if (marketplace.keywordRules.maxKeywordLength !== undefined) {
      const tooLong = 'x'.repeat(marketplace.keywordRules.maxKeywordLength + 1);
      expect(isKeywordLengthValid('shutterstock', tooLong)).toBe(false);
    }
    expect(isKeywordLengthValid('shutterstock', 'short')).toBe(true);
  });

  it('isKeywordCountValid respects minCount/maxCount', () => {
    const marketplace = getMarketplace('shutterstock')!;
    expect(isKeywordCountValid('shutterstock', marketplace.keywordRules.minCount)).toBe(true);
    expect(isKeywordCountValid('shutterstock', marketplace.keywordRules.maxCount)).toBe(true);
    expect(isKeywordCountValid('shutterstock', marketplace.keywordRules.maxCount + 1)).toBe(false);
    if (marketplace.keywordRules.minCount > 0) {
      expect(isKeywordCountValid('shutterstock', marketplace.keywordRules.minCount - 1)).toBe(false);
    }
  });
});
