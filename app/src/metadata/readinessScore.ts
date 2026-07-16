import type { TileData } from '../engine/types';
import { applyHardRejectRules } from '../engine/candidateEngine';
import { MARKETPLACE_PROFILES, type MarketplaceId, type MarketplaceProfile } from './marketplaceProfiles';
import { generateMarketplaceSeo, type MarketplaceSeo } from './marketplaceSeo';
import { validateMarketplaceSeo, type ValidationIssue } from './marketplaceValidation';
import { COMMERCIAL_TAG_CANDIDATES } from './submissionCenter';

// Readiness Score — Marketplace Intelligence Engine Phase 5, Section 8.
// Unifies 5 named dimensions into one real, per-marketplace score,
// assembled entirely from data marketplaceSeo.ts/marketplaceValidation.ts/
// candidateEngine.ts already compute — this module never re-derives SEO
// text or validation rules, it only scores what they already found.
// Distinct from metadata/submissionCenter.ts's `analyzeSeo` (which is
// hardcoded to Shutterstock's own fields regardless of which site is
// asked about, a pre-existing narrower tool): every dimension here is
// resolved against the *specific* marketplace's own profile and rules.

export interface MarketplaceReadinessScore {
  marketplaceId: MarketplaceId;
  /** Title/keyword-count/keyword-quality compliance against this
   * marketplace's own limits. */
  seoReadiness: number;
  /** Filename validity/length against this marketplace's own rules. */
  filenameReadiness: number;
  /** Are the core fields (title/description/keywords) actually filled in
   * at all — a simpler, blunter check than seoReadiness's limit
   * compliance. */
  metadataReadiness: number;
  /** Does the underlying SVG structurally pass this app's own hard-reject
   * rules (NaN/raster/duplicate-id/node-budget) — a pattern that fails
   * this is not compatible with *any* marketplace, regardless of SEO. */
  marketplaceCompatibility: number;
  /** Real commercial-intent keyword coverage (same tag pool
   * submissionCenter.ts's `analyzeSeo` already uses). */
  commercialReadiness: number;
  /** Unweighted average of the 5 dimensions above, 0-100. */
  overall: number;
  /** Pooled, human-readable (Thai) issue messages from every dimension —
   * real validation/reject-rule output, never fabricated. */
  issues: string[];
}

const SEO_QUALITY_CODES: ValidationIssue['code'][] = ['titleTooShort', 'titleTooLong', 'keywordsMissing', 'keywordsTooMany', 'duplicateKeywords', 'keywordTooLong'];
const FILENAME_CODES: ValidationIssue['code'][] = ['filenameInvalid', 'filenameTooLong'];

/** Real deductions from issues that actually fired — errors cost more than
 * warnings, never below 0. The same "penalty per real issue, not a fixed
 * script" convention `engine/scoring.ts`'s soft-penalty rules already use. */
function scoreFromIssues(issues: ValidationIssue[], codes: ValidationIssue['code'][]): number {
  const relevant = issues.filter((i) => codes.includes(i.code));
  const errorCount = relevant.filter((i) => i.severity === 'error').length;
  const warningCount = relevant.filter((i) => i.severity === 'warning').length;
  return Math.max(0, 100 - errorCount * 40 - warningCount * 15);
}

function computeMetadataReadiness(seo: MarketplaceSeo, profile: MarketplaceProfile): number {
  let score = 100;
  if (!seo.title.trim()) score -= 50;
  if (profile.descriptionRules.required && !seo.description.trim()) score -= 30;
  if (seo.keywords.length === 0) score -= 20;
  return Math.max(0, score);
}

function computeCommercialReadiness(seo: MarketplaceSeo): number {
  const keywordsLower = seo.keywords.map((k) => k.toLowerCase());
  const matched = COMMERCIAL_TAG_CANDIDATES.filter((tag) => keywordsLower.includes(tag));
  return Math.min(100, matched.length * 25);
}

/** Section 8's core: one marketplace's full Readiness Score for a real
 * generated tile. */
export function computeMarketplaceReadiness(tileData: TileData, marketplaceId: MarketplaceId): MarketplaceReadinessScore {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  const seo = generateMarketplaceSeo(tileData, marketplaceId);
  const validationIssues = validateMarketplaceSeo(seo, profile);
  const hardReject = applyHardRejectRules(tileData);

  const seoReadiness = scoreFromIssues(validationIssues, SEO_QUALITY_CODES);
  const filenameReadiness = scoreFromIssues(validationIssues, FILENAME_CODES);
  const metadataReadiness = computeMetadataReadiness(seo, profile);
  const marketplaceCompatibility = hardReject.rejected ? 0 : 100;
  const commercialReadiness = computeCommercialReadiness(seo);

  const overall = Math.round((seoReadiness + filenameReadiness + metadataReadiness + marketplaceCompatibility + commercialReadiness) / 5);

  const issues: string[] = validationIssues.filter((i) => i.severity === 'error').map((i) => i.message);
  if (hardReject.rejected) issues.push(...hardReject.reasons);
  if (profile.future) issues.push(`${profile.label} ยังเป็นสถานะ "future-ready" — ยังไม่ยืนยันว่าพร้อมส่งขายวันนี้`);

  return {
    marketplaceId,
    seoReadiness,
    filenameReadiness,
    metadataReadiness,
    marketplaceCompatibility,
    commercialReadiness,
    overall,
    issues,
  };
}

/** Every marketplace's Readiness Score in one call — mirrors
 * `generateAllMarketplaceSeo`/`buildAllSeoHints`'s "every marketplace at
 * once" convention. */
export function computeAllMarketplaceReadiness(tileData: TileData): Record<MarketplaceId, MarketplaceReadinessScore> {
  const result = {} as Record<MarketplaceId, MarketplaceReadinessScore>;
  for (const marketplaceId of Object.keys(MARKETPLACE_PROFILES) as MarketplaceId[]) {
    result[marketplaceId] = computeMarketplaceReadiness(tileData, marketplaceId);
  }
  return result;
}
