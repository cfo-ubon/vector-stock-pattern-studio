import type { SubmissionRecord, SubmissionStatusEvent } from './submissionRecord';

// Build 015 — Submission History. A record's own `statusHistory` (append-
// only, written in the same transaction as every status change — see
// `submissionRecord.ts`'s module header) already *is* the history; this
// module is a thin, read-only query surface over it plus one
// cross-record view (every submission attempt for a given pattern, across
// marketplaces and over time) that a single record's own history cannot
// provide by itself.

export function getSubmissionHistory(record: SubmissionRecord): SubmissionStatusEvent[] {
  return record.statusHistory;
}

/** Every submission ever created for one pattern, oldest first —
 * spans every marketplace and every version, useful for answering "what
 * has happened to this pattern across all of Commercial Workflow," which
 * no single `SubmissionRecord` can answer alone. */
export function getPatternSubmissionTimeline(records: SubmissionRecord[], patternId: string): SubmissionRecord[] {
  return records.filter((r) => r.patternId === patternId).sort((a, b) => a.createdAt - b.createdAt);
}
