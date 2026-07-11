import type { StockSiteId } from './shutterstock';
import { CONTRIBUTOR_LINKS } from './contributorLinks';

// Marketplace Profile System — the config layer every marketplace-specific
// rule in the app should read from, instead of one generic SEO profile.
// This module is deliberately *data*, not logic: adding a 7th marketplace
// is one new entry here (plus one new branch in shutterstock.ts's
// buildSiteMetadata, which is the actual title/description/keyword *text*
// generator — this file owns the *rules* those fields must satisfy, and
// the rules driving the Filename Engine / export package / validation
// layers built on top of it).

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
   * shutterstock.ts's own SHUTTERSTOCK_SECONDARY table). */
  defaultCategory: string;
  /** Ordered list of files a "download package" for this marketplace
   * contains — descriptive metadata the UI/export builder reads, not code. */
  exportPackageFiles: string[];
}

const DEFAULT_FILENAME_TEMPLATE = '{palette}-{category}-{layout}-seamless-pattern-{seed}';

const STANDARD_PACKAGE_FILES = ['pattern.svg', 'preview.png', 'title.txt', 'description.txt', 'keywords.txt', 'filename.txt', 'metadata.json'];

export const MARKETPLACE_PROFILES: Record<MarketplaceId, MarketplaceProfile> = {
  shutterstock: {
    id: 'shutterstock',
    label: 'Shutterstock',
    future: false,
    contributorUrl: CONTRIBUTOR_LINKS.find((l) => l.id === 'shutterstock')!.url,
    contributorUrlVerified: CONTRIBUTOR_LINKS.find((l) => l.id === 'shutterstock')!.verified,
    titleRules: { minLength: 20, maxLength: 200 },
    descriptionRules: { required: true, minLength: 20, maxLength: 200 },
    keywordRules: { minCount: 7, maxCount: 50, termLabel: 'keywords' },
    filenameRules: { template: DEFAULT_FILENAME_TEMPLATE, maxLength: 100, extension: 'eps' },
    defaultCategory: 'Backgrounds/Textures',
    exportPackageFiles: STANDARD_PACKAGE_FILES,
  },
  adobestock: {
    id: 'adobestock',
    label: 'Adobe Stock',
    future: false,
    contributorUrl: CONTRIBUTOR_LINKS.find((l) => l.id === 'adobestock')!.url,
    contributorUrlVerified: CONTRIBUTOR_LINKS.find((l) => l.id === 'adobestock')!.verified,
    titleRules: { minLength: 20, maxLength: 70 },
    // Adobe Stock's upload form has no separate description field —
    // matches shutterstock.ts's buildSiteMetadata, which only emits
    // Title/Keywords/Category for this site.
    descriptionRules: { required: false, minLength: 0, maxLength: 0 },
    keywordRules: { minCount: 7, maxCount: 49, termLabel: 'keywords' },
    filenameRules: { template: DEFAULT_FILENAME_TEMPLATE, maxLength: 100, extension: 'eps' },
    defaultCategory: 'Graphic Resources',
    exportPackageFiles: STANDARD_PACKAGE_FILES.filter((f) => f !== 'description.txt'),
  },
  freepik: {
    id: 'freepik',
    label: 'Freepik',
    future: false,
    contributorUrl: CONTRIBUTOR_LINKS.find((l) => l.id === 'freepik')!.url,
    contributorUrlVerified: CONTRIBUTOR_LINKS.find((l) => l.id === 'freepik')!.verified,
    titleRules: { minLength: 20, maxLength: 100 },
    descriptionRules: { required: false, minLength: 0, maxLength: 0 },
    keywordRules: { minCount: 7, maxCount: 50, termLabel: 'keywords' },
    filenameRules: { template: DEFAULT_FILENAME_TEMPLATE, maxLength: 100, extension: 'eps' },
    defaultCategory: 'Vectors',
    exportPackageFiles: STANDARD_PACKAGE_FILES.filter((f) => f !== 'description.txt'),
  },
  creativefabrica: {
    id: 'creativefabrica',
    label: 'Creative Fabrica',
    future: false,
    contributorUrl: CONTRIBUTOR_LINKS.find((l) => l.id === 'creativefabrica')!.url,
    contributorUrlVerified: CONTRIBUTOR_LINKS.find((l) => l.id === 'creativefabrica')!.verified,
    titleRules: { minLength: 10, maxLength: 150 },
    descriptionRules: { required: true, minLength: 40, maxLength: 5000, practicalCeiling: true },
    keywordRules: { minCount: 5, maxCount: 20, termLabel: 'tags' },
    filenameRules: { template: DEFAULT_FILENAME_TEMPLATE, maxLength: 100, extension: 'svg' },
    defaultCategory: 'Digital Paper & Fabric Design',
    exportPackageFiles: STANDARD_PACKAGE_FILES,
  },
  creativemarket: {
    id: 'creativemarket',
    label: 'Creative Market',
    future: false,
    contributorUrl: CONTRIBUTOR_LINKS.find((l) => l.id === 'creativemarket')!.url,
    contributorUrlVerified: CONTRIBUTOR_LINKS.find((l) => l.id === 'creativemarket')!.verified,
    titleRules: { minLength: 10, maxLength: 150 },
    descriptionRules: { required: true, minLength: 40, maxLength: 5000, practicalCeiling: true },
    keywordRules: { minCount: 5, maxCount: 20, termLabel: 'tags' },
    filenameRules: { template: DEFAULT_FILENAME_TEMPLATE, maxLength: 100, extension: 'svg' },
    defaultCategory: 'Seamless Digital Pattern',
    exportPackageFiles: STANDARD_PACKAGE_FILES,
  },
  // Etsy real, stable, long-documented limits: 140-char title, 13 tags max
  // (each tag <=20 chars), no hard description cap in practice.
  etsy: {
    id: 'etsy',
    label: 'Etsy',
    future: true,
    contributorUrl: CONTRIBUTOR_LINKS.find((l) => l.id === 'etsy')!.url,
    contributorUrlVerified: CONTRIBUTOR_LINKS.find((l) => l.id === 'etsy')!.verified,
    titleRules: { minLength: 10, maxLength: 140 },
    descriptionRules: { required: true, minLength: 40, maxLength: 5000, practicalCeiling: true },
    keywordRules: { minCount: 5, maxCount: 13, maxKeywordLength: 20, termLabel: 'tags' },
    filenameRules: { template: DEFAULT_FILENAME_TEMPLATE, maxLength: 100, extension: 'svg' },
    defaultCategory: 'Digital Prints',
    exportPackageFiles: STANDARD_PACKAGE_FILES,
  },
};

export const MARKETPLACE_LIST: MarketplaceProfile[] = Object.values(MARKETPLACE_PROFILES);
