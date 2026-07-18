import type { SubmissionRecord } from './submissionRecord';

// Build 015 — Duplicate Detection ("Detect: Same Pattern, Same
// Marketplace, Same Version, Already Approved, Already Submitted.
// Prevent accidental duplicates."). Three independent conflict rules,
// all scoped to the same (patternId, marketplaceId) pair — a different
// marketplace, or a different pattern, is never a conflict:
//
// 1. `same-version`  — an existing record for the exact same
//    (pattern, marketplace, version) already exists, in ANY status.
//    Re-creating/re-readying the identical attempt is always a mistake.
// 2. `already-approved` — an existing record for this (pattern,
//    marketplace) — any version — is already `APPROVED`. Resubmitting
//    already-accepted content is the accidental duplicate the brief
//    calls out by name.
// 3. `already-submitted` — an existing record for this (pattern,
//    marketplace) — any version — is currently `SUBMITTED` (pending
//    review). Submitting a second attempt while one is in flight is the
//    other accidental duplicate called out by name.

export type DuplicateConflictReason = 'same-version' | 'already-approved' | 'already-submitted';

export interface DuplicateConflict {
  reason: DuplicateConflictReason;
  existingSubmissionId: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  conflicts: DuplicateConflict[];
}

export interface DuplicateCandidate {
  patternId: string;
  marketplaceId: string;
  version: number;
  /** The candidate's own id, if it already exists as a record (e.g.
   * re-validating an existing DRAFT before it becomes READY) — excluded
   * from the comparison set so a record never conflicts with itself. */
  submissionId?: string;
}

/** Pure function: never reads or writes storage — callers pass in
 * whatever existing records are relevant (typically the full result of
 * `loadSubmissions()`), keeping this testable without any storage
 * dependency and reusable against any subset a caller already has in
 * memory. */
export function detectDuplicateSubmission(candidate: DuplicateCandidate, existing: SubmissionRecord[]): DuplicateDetectionResult {
  const conflicts: DuplicateConflict[] = [];
  const related = existing.filter(
    (r) => r.patternId === candidate.patternId && r.marketplaceId === candidate.marketplaceId && r.submissionId !== candidate.submissionId,
  );

  for (const record of related) {
    if (record.version === candidate.version) {
      conflicts.push({ reason: 'same-version', existingSubmissionId: record.submissionId });
    }
    if (record.status === 'APPROVED') {
      conflicts.push({ reason: 'already-approved', existingSubmissionId: record.submissionId });
    }
    if (record.status === 'SUBMITTED') {
      conflicts.push({ reason: 'already-submitted', existingSubmissionId: record.submissionId });
    }
  }

  return { isDuplicate: conflicts.length > 0, conflicts };
}
