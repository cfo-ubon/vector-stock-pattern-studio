import type { SubmissionRecord } from '../submission/submissionRecord';
import { computeSubmissionStatistics } from '../submission/submissionStatistics';

// Build 017 — Submission Analytics. A thin reshape over Submission
// Center's OWN existing `computeSubmissionStatistics` — no new counting
// logic is written here at all, per the brief's "read-only integration,
// not a replacement" framing and the explicit "Do NOT modify Submission
// Engine" constraint. This module's only job is presenting those exact
// same numbers under the field names the brief's "Submission Analytics"
// section names (`draft`/`ready`/.../`archived`), since
// `SubmissionStatistics.byStatus` already carries the identical data
// keyed by the SCREAMING_SNAKE_CASE status codes instead.

export interface SubmissionAnalytics {
  draft: number;
  ready: number;
  queued: number;
  submitted: number;
  approved: number;
  rejected: number;
  needsRevision: number;
  archived: number;
  total: number;
  /** Passed through unchanged from `computeSubmissionStatistics` — the
   * per-marketplace breakdown already has everything this section needs
   * (`Per Marketplace`), so it is reused wholesale rather than
   * reshaped. */
  byMarketplace: ReturnType<typeof computeSubmissionStatistics>['byMarketplace'];
}

export function computeSubmissionAnalytics(records: SubmissionRecord[]): SubmissionAnalytics {
  const stats = computeSubmissionStatistics(records);
  return {
    draft: stats.byStatus.DRAFT,
    ready: stats.byStatus.READY,
    queued: stats.byStatus.QUEUED,
    submitted: stats.byStatus.SUBMITTED,
    approved: stats.byStatus.APPROVED,
    rejected: stats.byStatus.REJECTED,
    needsRevision: stats.byStatus.NEEDS_REVISION,
    archived: stats.byStatus.ARCHIVED,
    total: stats.totalSubmissions,
    byMarketplace: stats.byMarketplace,
  };
}
