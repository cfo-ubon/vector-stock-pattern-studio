import type { SubmissionRecord } from './submissionRecord';
import type { SubmissionStatus } from './submissionStatus';
import { SUBMISSION_STATUSES } from './submissionStatus';

// Build 015 — Submission Statistics ("Provide summary service: Ready,
// Queued, Submitted, Approved, Rejected, Per Marketplace totals").
// `byStatus` reports every status (a superset of the brief's 5 named
// ones — Draft/NeedsRevision/Archived counts are strictly more
// information, never less, and cost nothing extra to include), and
// `byMarketplace` gives the same per-status breakdown scoped to each
// marketplace individually.

function zeroByStatus(): Record<SubmissionStatus, number> {
  return Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s, 0])) as Record<SubmissionStatus, number>;
}

export interface MarketplaceSubmissionTotals {
  total: number;
  byStatus: Record<SubmissionStatus, number>;
}

export interface SubmissionStatistics {
  totalSubmissions: number;
  byStatus: Record<SubmissionStatus, number>;
  byMarketplace: Record<string, MarketplaceSubmissionTotals>;
}

export function computeSubmissionStatistics(records: SubmissionRecord[]): SubmissionStatistics {
  const byStatus = zeroByStatus();
  const byMarketplace: Record<string, MarketplaceSubmissionTotals> = {};

  for (const record of records) {
    byStatus[record.status]++;

    if (!byMarketplace[record.marketplaceId]) {
      byMarketplace[record.marketplaceId] = { total: 0, byStatus: zeroByStatus() };
    }
    byMarketplace[record.marketplaceId].total++;
    byMarketplace[record.marketplaceId].byStatus[record.status]++;
  }

  return { totalSubmissions: records.length, byStatus, byMarketplace };
}
