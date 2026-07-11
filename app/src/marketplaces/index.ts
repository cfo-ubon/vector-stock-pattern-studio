import shutterstock from './shutterstock.json';
import adobestock from './adobestock.json';
import freepik from './freepik.json';
import creativefabrica from './creativefabrica.json';
import creativemarket from './creativemarket.json';
import etsy from './etsy.json';

// Marketplace Profile data loader — Design Intelligence Core Phase 1's
// "no hardcoded marketplace rules" requirement: every rule here is real
// editable JSON, ported 1:1 from app/src/metadata/marketplaceProfiles.ts
// (unmodified, still the live source for the existing Trend Studio/
// Marketplace Profile System UI — this is a parallel, JSON-first mirror
// for the new architecture, not a replacement yet; see the Phase 1
// report's Phase 2 recommendations).

export interface MarketplaceProfileData {
  id: string;
  label: string;
  future: boolean;
  contributorUrl: string;
  contributorUrlVerified: boolean;
  titleRules: { minLength: number; maxLength: number };
  descriptionRules: { required: boolean; minLength: number; maxLength: number; practicalCeiling?: boolean };
  keywordRules: { minCount: number; maxCount: number; maxKeywordLength?: number; termLabel: 'keywords' | 'tags' };
  filenameRules: { template: string; maxLength: number; extension: 'svg' | 'eps' };
  defaultCategory: string;
  exportPackageFiles: string[];
}

export const MARKETPLACE_DATA: MarketplaceProfileData[] = [
  shutterstock,
  adobestock,
  freepik,
  creativefabrica,
  creativemarket,
  etsy,
] as MarketplaceProfileData[];

export const MARKETPLACE_DATA_BY_ID: Record<string, MarketplaceProfileData> = Object.fromEntries(
  MARKETPLACE_DATA.map((profile) => [profile.id, profile]),
);
