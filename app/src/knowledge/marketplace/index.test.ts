import { describe, it, expect } from 'vitest';
import { listMarketplaces } from '../../services/marketplaceService';
import { MARKETPLACE_LIST } from '../../metadata/marketplaceProfiles';
import {
  listMarketplaceKnowledge,
  getMarketplaceKnowledge,
  listAvailableMarketplaceKnowledge,
  getMarketplaceProfile,
  listMarketplaceProfiles,
  getMarketplaceCategoryMapping,
  isMarketplaceKeywordLengthValid,
  isMarketplaceKeywordCountValid,
} from './index';

describe('knowledge/marketplace: pass-through lookups', () => {
  it('listMarketplaceKnowledge / getMarketplaceKnowledge match the real Marketplace Profile data', () => {
    expect(listMarketplaceKnowledge().length).toBe(listMarketplaces().length);
    const m = listMarketplaces()[0];
    expect(getMarketplaceKnowledge(m.id)).toEqual(m);
  });

  it('listAvailableMarketplaceKnowledge excludes future marketplaces', () => {
    for (const m of listAvailableMarketplaceKnowledge()) expect(m.future).toBe(false);
  });

  it('listMarketplaceProfiles matches metadata/marketplaceProfiles.ts\'s MARKETPLACE_LIST', () => {
    expect(listMarketplaceProfiles().length).toBe(MARKETPLACE_LIST.length);
  });

  it('getMarketplaceProfile returns the real resolved profile for a known id', () => {
    expect(getMarketplaceProfile('shutterstock').id).toBe('shutterstock');
  });
});

describe('knowledge/marketplace: category mapping', () => {
  it('falls back to defaultCategory for a category with no explicit mapping', () => {
    const profile = getMarketplaceProfile('shutterstock');
    const result = getMarketplaceCategoryMapping('shutterstock', 'not-a-real-category');
    expect(result).toBe(profile.defaultCategory);
  });
});

describe('knowledge/marketplace: keyword rule facades', () => {
  it('isMarketplaceKeywordLengthValid / isMarketplaceKeywordCountValid honor the real marketplace rules', () => {
    const m = listMarketplaces()[0];
    expect(isMarketplaceKeywordCountValid(m.id, m.keywordRules.minCount)).toBe(true);
    expect(isMarketplaceKeywordCountValid(m.id, m.keywordRules.minCount - 1)).toBe(false);
    expect(isMarketplaceKeywordLengthValid(m.id, 'a')).toBe(true);
  });
});
