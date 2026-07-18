import type { PortfolioAsset } from '../domain/types';
import type { SubmissionRecord } from '../submission/submissionRecord';
import type { SubmissionStatus } from '../submission/submissionStatus';

// Build 017 — Readiness Analytics: a portfolio-wide view of "how much of
// the catalog has actually moved toward being sold," distinct from
// `submissionAnalytics.ts` (counts submission *records* by status) and
// `marketplaceAnalytics.ts` (counts per marketplace) — this counts
// distinct *patterns* against the full catalog, the one place `total
// portfolio size` (from the frozen Collection API's own
// `PortfolioAsset[]`) meets submission data at all.

/** A pattern has moved "ready or beyond" once at least one of its
 * submissions has left `DRAFT`/`NEEDS_REVISION`/`REJECTED`/`ARCHIVED` —
 * those four represent "not yet ready" or "sent back," everything else
 * represents forward progress on at least one marketplace. */
const READY_OR_BEYOND_STATUSES: SubmissionStatus[] = ['READY', 'QUEUED', 'SUBMITTED', 'APPROVED'];

export interface ReadinessAnalytics {
  /** Total distinct patterns in the portfolio catalog — from
   * `PortfolioAsset[]`, independent of collection membership. */
  totalPatterns: number;
  /** Distinct patterns with at least one submission record, in any
   * status. */
  patternsWithSubmissions: number;
  patternsWithoutSubmissions: number;
  /** Distinct patterns with at least one submission at `READY` or
   * beyond (see `READY_OR_BEYOND_STATUSES`) on at least one
   * marketplace. */
  patternsReadyOrBeyond: number;
  /** `patternsReadyOrBeyond / totalPatterns * 100`, rounded to 1
   * decimal; `0` when the catalog is empty (nothing to be ready). */
  readinessRate: number;
}

export function computeReadinessAnalytics(assets: PortfolioAsset[], records: SubmissionRecord[]): ReadinessAnalytics {
  const totalPatterns = assets.length;
  const catalogAssetIds = new Set(assets.map((a) => a.assetId));
  // Intersected with the real catalog — a submission whose `patternId`
  // no longer matches any live asset (e.g. the asset was later deleted)
  // must not inflate "patterns with submissions" past the catalog's own
  // size, which `patternsWithoutSubmissions` subtracts from.
  const patternIdsWithSubmissions = new Set([...new Set(records.map((r) => r.patternId))].filter((id) => catalogAssetIds.has(id)));
  const patternIdsReadyOrBeyond = new Set(
    [...new Set(records.filter((r) => READY_OR_BEYOND_STATUSES.includes(r.status)).map((r) => r.patternId))].filter((id) => catalogAssetIds.has(id)),
  );

  return {
    totalPatterns,
    patternsWithSubmissions: patternIdsWithSubmissions.size,
    patternsWithoutSubmissions: totalPatterns - patternIdsWithSubmissions.size,
    patternsReadyOrBeyond: patternIdsReadyOrBeyond.size,
    readinessRate: totalPatterns === 0 ? 0 : Math.round((patternIdsReadyOrBeyond.size / totalPatterns) * 1000) / 10,
  };
}
