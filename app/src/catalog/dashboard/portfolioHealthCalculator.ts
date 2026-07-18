import type { SubmissionRecord } from '../submission/submissionRecord';
import { detectDuplicateSubmission } from '../submission/submissionDuplicateDetection';
import { validateSeoContent } from '../seo/seoValidator';
import type { SeoAnalytics } from './seoAnalytics';
import type { CollectionAnalytics } from './collectionAnalytics';
import type { ReadinessAnalytics } from './readinessAnalytics';

// Build 017 — Portfolio Health Calculator. Combines 6 named components
// into one 0-100 score, unweighted average, rounded — the same
// "unweighted average of N real dimensions" convention every scoring
// module in this repo has used since `metadata/readinessScore.ts`
// (P2.5), continued through `catalog/seo/seoScoring.ts` (Build 016).
// Every component is a pure function of already-computed analytics or
// of the raw `SubmissionRecord[]`/`Collection`/`PortfolioAsset` data —
// nothing here writes anything, matching "Health Score deterministic."
//
// Empty-data convention (documented once, applied uniformly): every
// component below returns exactly `0` when there is no data to compute
// it from (zero submissions, zero patterns) — an empty portfolio is not
// assumed to be either perfectly healthy or maximally at risk, it is
// simply unscored at its floor. See each component's own comment for
// the specific "no data" condition that triggers this.

export interface PortfolioHealthComponents {
  seoScore: number;
  submissionReadiness: number;
  metadataCompleteness: number;
  duplicateRisk: number;
  collectionOrganization: number;
  validationStatus: number;
}

export interface PortfolioHealthScore {
  overall: number;
  components: PortfolioHealthComponents;
}

/** Every submission with at least one real duplicate-submission conflict
 * (`submissionDuplicateDetection.ts`'s existing, unmodified
 * `detectDuplicateSubmission` — same-version / already-approved /
 * already-submitted against every other record). Exported (not just an
 * internal score helper) so `recommendationEngine.ts` can report the
 * exact same count `dashboardSnapshot.ts` feeds it, rather than each
 * module recomputing its own slightly-different-by-rounding estimate —
 * see `dashboardSnapshot.ts`'s module header for why this one count is
 * computed once and threaded through. Distinct from
 * `collectionAnalytics.ts`'s `duplicatePatternUsage` (a pattern filed
 * under multiple collections, which is organizational, not risky). */
export function countDuplicateConflictingSubmissions(records: SubmissionRecord[]): number {
  return records.filter(
    (record) => detectDuplicateSubmission({ patternId: record.patternId, marketplaceId: record.marketplaceId, version: record.version, submissionId: record.submissionId }, records).isDuplicate,
  ).length;
}

/** Percentage of submissions with NO duplicate-submission conflict —
 * higher is safer. Takes the conflict count as a parameter (rather than
 * recomputing it from `records`) so a caller that already has the exact
 * count — `dashboardSnapshot.ts`, which also needs it for
 * `generateRecommendations` — never pays for
 * `countDuplicateConflictingSubmissions`'s O(n^2) pass twice in the same
 * snapshot build. */
function computeDuplicateRiskScore(recordCount: number, conflictCount: number): number {
  if (recordCount === 0) return 0;
  return Math.round((1 - conflictCount / recordCount) * 1000) / 10;
}

/** Percentage of submissions whose SEO content validates with zero
 * errors (`seoValidator.ts`'s existing, unmodified `validateSeoContent`)
 * against their own marketplace's rules. */
function computeValidationStatusScore(records: SubmissionRecord[]): number {
  if (records.length === 0) return 0;
  const validCount = records.filter((record) => validateSeoContent({ title: record.titleSnapshot, description: record.descriptionSnapshot, keywords: record.keywordSnapshot }, record.marketplaceId).valid).length;
  return Math.round((validCount / records.length) * 1000) / 10;
}

/** `duplicateConflictCount` defaults to a fresh
 * `countDuplicateConflictingSubmissions(records)` call when omitted —
 * standalone callers (including this module's own tests) never need to
 * compute it themselves. `dashboardSnapshot.ts` passes the exact count
 * it already computed once, for the O(n^2)-avoidance reason documented
 * on `computeDuplicateRiskScore` above. */
export function computePortfolioHealth(
  records: SubmissionRecord[],
  seoAnalytics: SeoAnalytics,
  collectionAnalytics: CollectionAnalytics,
  readinessAnalytics: ReadinessAnalytics,
  duplicateConflictCount: number = countDuplicateConflictingSubmissions(records),
): PortfolioHealthScore {
  const seoScore = seoAnalytics.averageScore;
  const submissionReadiness = readinessAnalytics.readinessRate;
  const metadataCompleteness =
    seoAnalytics.sampleSize === 0 ? 0 : Math.round(((seoAnalytics.sampleSize - seoAnalytics.missingMetadataCount) / seoAnalytics.sampleSize) * 1000) / 10;
  const duplicateRisk = computeDuplicateRiskScore(records.length, duplicateConflictCount);
  const collectionOrganization =
    readinessAnalytics.totalPatterns === 0 ? 0 : Math.round((collectionAnalytics.patternCount / readinessAnalytics.totalPatterns) * 1000) / 10;
  const validationStatus = computeValidationStatusScore(records);

  const components: PortfolioHealthComponents = { seoScore, submissionReadiness, metadataCompleteness, duplicateRisk, collectionOrganization, validationStatus };
  const overall = Math.round((seoScore + submissionReadiness + metadataCompleteness + duplicateRisk + collectionOrganization + validationStatus) / 6);

  return { overall, components };
}
