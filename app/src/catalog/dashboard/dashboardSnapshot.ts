import type { Collection } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';
import type { SubmissionRecord } from '../submission/submissionRecord';
import { computeCollectionAnalytics } from './collectionAnalytics';
import type { CollectionAnalytics } from './collectionAnalytics';
import { computeSubmissionAnalytics } from './submissionAnalytics';
import type { SubmissionAnalytics } from './submissionAnalytics';
import { computeSeoAnalytics } from './seoAnalytics';
import type { SeoAnalytics } from './seoAnalytics';
import { computeMarketplaceAnalytics } from './marketplaceAnalytics';
import type { MarketplaceAnalyticsEntry } from './marketplaceAnalytics';
import { computeReadinessAnalytics } from './readinessAnalytics';
import type { ReadinessAnalytics } from './readinessAnalytics';
import { computePortfolioHealth, countDuplicateConflictingSubmissions } from './portfolioHealthCalculator';
import type { PortfolioHealthScore } from './portfolioHealthCalculator';
import { generateRecommendations } from './recommendationEngine';
import type { Recommendation } from './recommendationEngine';

// Build 017 — Dashboard Snapshot: the single object every analytics
// module above feeds into, "suitable for future UI rendering" per the
// brief. `buildDashboardSnapshot` is pure — given the same three input
// arrays, it always produces the exact same snapshot (no wall-clock
// value is read into any SCORE or COUNT; `generatedAt` is the one
// explicitly time-stamped field, kept separate precisely so it never
// pollutes the deterministic parts of the snapshot). The duplicate-
// conflict count is computed exactly once here and threaded into both
// `computePortfolioHealth` (for the
// `duplicateRisk` percentage) and `generateRecommendations` (for the
// exact `remove-duplicates` count) — see
// `portfolioHealthCalculator.ts`'s `countDuplicateConflictingSubmissions`
// doc comment for why sharing one computation matters here.

export interface DashboardSnapshot {
  generatedAt: number;
  portfolioHealth: PortfolioHealthScore;
  submissionAnalytics: SubmissionAnalytics;
  seoAnalytics: SeoAnalytics;
  collectionAnalytics: CollectionAnalytics;
  marketplaceAnalytics: MarketplaceAnalyticsEntry[];
  readinessAnalytics: ReadinessAnalytics;
  recommendations: Recommendation[];
}

export interface DashboardSnapshotInput {
  collections: Collection[];
  assets: PortfolioAsset[];
  submissions: SubmissionRecord[];
  /** Injectable clock for deterministic tests, mirroring the rest of
   * this repo's `now?: number` convention — production callers omit
   * this and get `Date.now()`. */
  now?: number;
}

export function buildDashboardSnapshot(input: DashboardSnapshotInput): DashboardSnapshot {
  const { collections, assets, submissions } = input;

  const collectionAnalytics = computeCollectionAnalytics(collections, assets);
  const submissionAnalytics = computeSubmissionAnalytics(submissions);
  const seoAnalytics = computeSeoAnalytics(submissions);
  const marketplaceAnalytics = computeMarketplaceAnalytics(submissions);
  const readinessAnalytics = computeReadinessAnalytics(assets, submissions);
  // Computed once, threaded into both calls below — see this file's
  // module header and `portfolioHealthCalculator.ts`'s
  // `computeDuplicateRiskScore` doc comment for why: this is an O(n^2)
  // pass, and neither call needs its own independent copy of it.
  const duplicateSubmissionConflictCount = countDuplicateConflictingSubmissions(submissions);
  const portfolioHealth = computePortfolioHealth(submissions, seoAnalytics, collectionAnalytics, readinessAnalytics, duplicateSubmissionConflictCount);
  const recommendations = generateRecommendations({ seoAnalytics, submissionAnalytics, collectionAnalytics, duplicateSubmissionConflictCount });

  return {
    generatedAt: input.now ?? Date.now(),
    portfolioHealth,
    submissionAnalytics,
    seoAnalytics,
    collectionAnalytics,
    marketplaceAnalytics,
    readinessAnalytics,
    recommendations,
  };
}
