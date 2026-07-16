import { MARKETPLACE_DATA, MARKETPLACE_DATA_BY_ID, type MarketplaceProfileData } from '../marketplaces';

// Thin query/lookup service over the Marketplace Profile data library. No
// hardcoded marketplace rules — every rule returned comes from the JSON
// data files in /marketplaces.

export function listMarketplaces(): MarketplaceProfileData[] {
  return MARKETPLACE_DATA;
}

export function getMarketplace(id: string): MarketplaceProfileData | undefined {
  return MARKETPLACE_DATA_BY_ID[id];
}

export function listAvailableMarketplaces(): MarketplaceProfileData[] {
  return MARKETPLACE_DATA.filter((profile) => !profile.future);
}

/** Checks a keyword string against a marketplace's own `keywordRules`
 * (`maxKeywordLength`), returning true when no limit is configured or the
 * keyword fits within it. */
export function isKeywordLengthValid(marketplaceId: string, keyword: string): boolean {
  const marketplace = MARKETPLACE_DATA_BY_ID[marketplaceId];
  if (!marketplace) return false;
  const maxLength = marketplace.keywordRules.maxKeywordLength;
  return maxLength === undefined || keyword.length <= maxLength;
}

/** Checks a candidate keyword count against a marketplace's own
 * `keywordRules.minCount`/`maxCount`. */
export function isKeywordCountValid(marketplaceId: string, count: number): boolean {
  const marketplace = MARKETPLACE_DATA_BY_ID[marketplaceId];
  if (!marketplace) return false;
  return count >= marketplace.keywordRules.minCount && count <= marketplace.keywordRules.maxCount;
}
