import type { SubmissionRecord } from '../submission/submissionRecord';

// Build 017 — Marketplace Analytics: per-marketplace funnel view,
// distinct from `submissionAnalytics.ts`'s `byMarketplace` (a raw status
// breakdown) — this reshapes the same underlying records into a
// commercial funnel ("Planned -> Ready -> Submitted -> Approved/
// Rejected") with a real, honestly-nullable Approval Rate.

export interface MarketplaceAnalyticsEntry {
  marketplaceId: string;
  /** Distinct patterns with at least one submission record for this
   * marketplace, in ANY status — "planned" means "the portfolio has
   * expressed intent to sell this pattern here," not "is actively being
   * worked on right now." */
  patternsPlanned: number;
  ready: number;
  submitted: number;
  approved: number;
  rejected: number;
  /** `null` when there is no decided outcome yet (`approved + rejected
   * === 0`) — "if data exists" per the brief, distinct from a real `0%`
   * rate, which would mean every decided submission was rejected. */
  approvalRate: number | null;
}

export function computeMarketplaceAnalytics(records: SubmissionRecord[]): MarketplaceAnalyticsEntry[] {
  const marketplaceIds = [...new Set(records.map((r) => r.marketplaceId))].sort();

  return marketplaceIds.map((marketplaceId) => {
    const forMarketplace = records.filter((r) => r.marketplaceId === marketplaceId);
    const patternsPlanned = new Set(forMarketplace.map((r) => r.patternId)).size;
    const ready = forMarketplace.filter((r) => r.status === 'READY').length;
    const submitted = forMarketplace.filter((r) => r.status === 'SUBMITTED').length;
    const approved = forMarketplace.filter((r) => r.status === 'APPROVED').length;
    const rejected = forMarketplace.filter((r) => r.status === 'REJECTED').length;
    const decided = approved + rejected;

    return {
      marketplaceId,
      patternsPlanned,
      ready,
      submitted,
      approved,
      rejected,
      approvalRate: decided === 0 ? null : Math.round((approved / decided) * 1000) / 10,
    };
  });
}
