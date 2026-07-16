import type { StockSiteId } from './shutterstock';
import { MARKETPLACE_DATA, type MarketplaceLinks, type MarketplaceProfileData } from '../marketplaces';

// Marketplace Profile System — the config layer every marketplace-specific
// rule in the app should read from, instead of one generic SEO profile.
//
// Marketplace Intelligence Engine Phase 5 (Section 9, "no hardcoded
// marketplace logic") closes a gap Design Intelligence Core Phase 1's own
// report flagged as a "Phase 2 recommendation": `MARKETPLACE_PROFILES`
// below is no longer a hardcoded TS object literal — it's built from
// `../marketplaces`'s real, editable JSON files (`MARKETPLACE_DATA`), the
// single source of truth every marketplace-aware module in the app now
// shares (this file, contributorLinks.ts, and — through them — SEO
// generation, validation, filenames, export packages, readiness scoring).
// Adding a 7th marketplace is now one new JSON file under
// `src/marketplaces/` (registered in `marketplaces/index.ts`) plus one new
// branch in shutterstock.ts's `buildSiteMetadata` (the title/description/
// keyword *text* generator, which this file's *rules* still don't own).

export type MarketplaceId = StockSiteId;

export interface TitleRules {
  minLength: number;
  maxLength: number;
}

export interface DescriptionRules {
  required: boolean;
  minLength: number;
  /** Some marketplaces (Creative Fabrica, Creative Market, Etsy) have no
   * documented hard cap on product descriptions — `practicalCeiling: true`
   * marks a generous readability limit we chose, not a claimed platform
   * limit (same distinction submissionCenter.ts's old SITE_LIMITS drew). */
  maxLength: number;
  practicalCeiling?: boolean;
}

export interface KeywordRules {
  minCount: number;
  maxCount: number;
  /** Etsy-specific: each individual tag also has its own character cap
   * (unlike every other marketplace here, which only caps the total
   * count) — undefined means no per-keyword length limit. */
  maxKeywordLength?: number;
  /** What this marketplace actually calls them in its own UI — "keywords"
   * everywhere except Etsy's "tags". Cosmetic, but keeps validation
   * messages and the UI honest about which term to show. */
  termLabel: 'keywords' | 'tags';
}

export interface FilenameRules {
  /** Template placeholders: {palette} {category} {layout} {seed} {site} —
   * resolved by filenameEngine.ts. Kept as a plain string (not a function)
   * so it's real *configuration*, editable without touching code, and
   * user-customizable per the Filename Engine's own requirement. */
  template: string;
  maxLength: number;
  /** File extension the marketplace expects for the primary asset upload
   * (informational — actual export format is still user-chosen via the
   * existing Export EPS/SVG buttons; this just drives the *package*
   * builder's default choice). */
  extension: 'svg' | 'eps';
}

export interface CollectionNamingRules {
  template: string;
  maxLength: number;
}

export interface PreviewRequirements {
  minWidth: number;
  minHeight: number;
  format: string;
  notes: string;
}

export interface MarketplaceProfile {
  id: MarketplaceId;
  label: string;
  /** True for a marketplace whose profile is fully defined and generates
   * real output, but isn't yet a "verified, ready to submit today" site —
   * currently only Etsy. Flagged in the UI, not hidden. */
  future: boolean;
  contributorUrl: string;
  contributorUrlVerified: boolean;
  titleRules: TitleRules;
  descriptionRules: DescriptionRules;
  keywordRules: KeywordRules;
  filenameRules: FilenameRules;
  /** Human-readable category this marketplace's upload form expects for a
   * seamless vector pattern — a flat default for sites without a real
   * per-engine-category breakdown in the app yet (only Shutterstock's
   * secondary category varies by pattern category today, via
   * `categoryMapping` below). */
  defaultCategory: string;
  /** Ordered list of files a "download package" for this marketplace
   * contains — descriptive metadata the UI/export builder reads, not code. */
  exportPackageFiles: string[];
  /** Section 6, "Contributor Center" — 6 named link types (Portal,
   * Submission, Analytics, Help, Guidelines, Support), each with its own
   * `verified` flag. `contributorUrl`/`contributorUrlVerified` above are
   * kept as a stable alias of `links.portal` for existing callers. */
  links: MarketplaceLinks;
  /** Section 2, "Collection Naming Rules". */
  collectionNamingRules: CollectionNamingRules;
  /** Section 2, "Supported File Types" — every format this app can
   * actually deliver for this marketplace's package. */
  supportedFileTypes: string[];
  /** Section 2, "Preview Requirements". */
  previewRequirements: PreviewRequirements;
  /** Section 2, "Category Mapping" — real generator-category id ->
   * marketplace category label, when the app has verified per-category
   * data for this marketplace (today: Shutterstock only). Falls back to
   * `defaultCategory` wherever a category id isn't in this map, or the map
   * itself is absent. */
  categoryMapping?: Record<string, string>;
}

function toProfile(data: MarketplaceProfileData): MarketplaceProfile {
  return {
    id: data.id as MarketplaceId,
    label: data.label,
    future: data.future,
    contributorUrl: data.links.portal.url,
    contributorUrlVerified: data.links.portal.verified,
    titleRules: data.titleRules,
    descriptionRules: data.descriptionRules,
    keywordRules: data.keywordRules,
    filenameRules: data.filenameRules,
    defaultCategory: data.defaultCategory,
    exportPackageFiles: data.exportPackageFiles,
    links: data.links,
    collectionNamingRules: data.collectionNamingRules,
    supportedFileTypes: data.supportedFileTypes,
    previewRequirements: data.previewRequirements,
    categoryMapping: data.categoryMapping,
  };
}

export const MARKETPLACE_PROFILES: Record<MarketplaceId, MarketplaceProfile> = Object.fromEntries(
  MARKETPLACE_DATA.map((data) => [data.id, toProfile(data)]),
) as Record<MarketplaceId, MarketplaceProfile>;

export const MARKETPLACE_LIST: MarketplaceProfile[] = Object.values(MARKETPLACE_PROFILES);

/** Section 2, "Category Mapping" resolver — the real marketplace category
 * for a given engine category id, falling back to the profile's
 * `defaultCategory` when no per-category mapping exists (either the
 * marketplace has no `categoryMapping` at all, or this specific category
 * id isn't in it). Centralized here so every caller (SEO hints, export
 * package metadata) resolves category the same honest way instead of
 * re-deriving the fallback logic. */
export function resolveMarketplaceCategory(profile: MarketplaceProfile, categoryId: string): string {
  return profile.categoryMapping?.[categoryId] ?? profile.defaultCategory;
}
