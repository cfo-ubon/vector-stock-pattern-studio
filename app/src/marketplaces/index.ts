import shutterstock from './shutterstock.json';
import adobestock from './adobestock.json';
import freepik from './freepik.json';
import creativefabrica from './creativefabrica.json';
import creativemarket from './creativemarket.json';
import etsy from './etsy.json';

// Marketplace Profile data loader — Design Intelligence Core Phase 1's
// "no hardcoded marketplace rules" requirement: every rule here is real
// editable JSON. Marketplace Intelligence Engine Phase 5 (Section 9) closes
// the gap the Phase 1 report itself flagged as a "Phase 2 recommendation":
// this JSON is no longer just a parallel mirror — app/src/metadata/
// marketplaceProfiles.ts now *builds* its `MARKETPLACE_PROFILES` from
// `MARKETPLACE_DATA_BY_ID` below, so editing one of these JSON files is the
// single real source of truth for every marketplace-aware module in the
// app (SEO generation, validation, filenames, export packages, contributor
// links, readiness scoring) — not a second copy that can drift.

export interface MarketplaceLinkEntry {
  url: string;
  verified: boolean;
}

/** Section 6, "Contributor Center" — the 6 named link types, each with its
 * own real-or-honestly-unverified URL (same `verified` convention the
 * original single `contributorUrl`/`contributorUrlVerified` fields already
 * used, extended per link type instead of collapsed to one). Many
 * marketplaces route Submission/Analytics back into the same one
 * contributor dashboard behind login — reusing the portal URL for those in
 * that case is an honest choice, not a placeholder. */
export interface MarketplaceLinks {
  portal: MarketplaceLinkEntry;
  submission: MarketplaceLinkEntry;
  analytics: MarketplaceLinkEntry;
  help: MarketplaceLinkEntry;
  guidelines: MarketplaceLinkEntry;
  support: MarketplaceLinkEntry;
}

export interface CollectionNamingRules {
  /** Template placeholders resolved the same way filenameRules.template's
   * are — {primaryKeyword}, plus whatever a caller's `extra` map adds. */
  template: string;
  maxLength: number;
}

export interface PreviewRequirements {
  minWidth: number;
  minHeight: number;
  format: string;
  /** Always states this is a conservative internal floor, not a claimed
   * platform-verified minimum — see each JSON file's own note. */
  notes: string;
}

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
  /** Section 6. */
  links: MarketplaceLinks;
  /** Section 2, "Collection Naming Rules". */
  collectionNamingRules: CollectionNamingRules;
  /** Section 2, "Supported File Types" — every format this app can
   * actually deliver for a marketplace package (not an exhaustive claim of
   * every format the marketplace itself accepts). */
  supportedFileTypes: string[];
  /** Section 2, "Preview Requirements". */
  previewRequirements: PreviewRequirements;
  /** Section 2, "Category Mapping" — real generator-category -> this
   * marketplace's own category id, when the app has verified per-category
   * granularity for that marketplace (today: Shutterstock only, ported
   * from metadata/shutterstock.ts's own `SHUTTERSTOCK_SECONDARY` table).
   * Absent (not an empty object) for marketplaces without real per-category
   * data — those honestly fall back to `defaultCategory` for every engine
   * category rather than fabricating a mapping this app has no basis for. */
  categoryMapping?: Record<string, string>;
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
