import { listMarketplaces, getMarketplace, listAvailableMarketplaces, isKeywordLengthValid, isKeywordCountValid } from '../../services/marketplaceService';
import { MARKETPLACE_PROFILES, MARKETPLACE_LIST, resolveMarketplaceCategory, type MarketplaceProfile, type MarketplaceId } from '../../metadata/marketplaceProfiles';
import type { MarketplaceProfileData } from '../../marketplaces';

// Design Knowledge Engine (Phase 6.5) — Section 7 "Marketplace Knowledge".
// A thin facade over `marketplaces/*.json` + `services/marketplaceService.ts`
// + `metadata/marketplaceProfiles.ts` — already the real, editable-JSON
// source of profile references, metadata constraints, category mappings,
// export preferences, and guideline links (built in Marketplace
// Intelligence Engine Phase 5). Nothing here asserts market popularity —
// every field is a real, static rule from the committed JSON profiles,
// per the brief's own "avoid hardcoding assumptions about market
// popularity" instruction.

export function listMarketplaceKnowledge(): MarketplaceProfileData[] {
  return listMarketplaces();
}

export function getMarketplaceKnowledge(id: string): MarketplaceProfileData | undefined {
  return getMarketplace(id);
}

export function listAvailableMarketplaceKnowledge(): MarketplaceProfileData[] {
  return listAvailableMarketplaces();
}

export function getMarketplaceProfile(id: MarketplaceId): MarketplaceProfile {
  return MARKETPLACE_PROFILES[id];
}

export function listMarketplaceProfiles(): MarketplaceProfile[] {
  return MARKETPLACE_LIST;
}

export function getMarketplaceCategoryMapping(id: MarketplaceId, engineCategoryId: string): string {
  return resolveMarketplaceCategory(MARKETPLACE_PROFILES[id], engineCategoryId);
}

export function isMarketplaceKeywordLengthValid(id: string, keyword: string): boolean {
  return isKeywordLengthValid(id, keyword);
}

export function isMarketplaceKeywordCountValid(id: string, count: number): boolean {
  return isKeywordCountValid(id, count);
}
