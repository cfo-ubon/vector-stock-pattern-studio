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
//
// Build 026 adds a 4th rule, layered on top of (not replacing) the three
// above:
//
// 4. `same-production-asset` — an existing record for the SAME
//    marketplace carries the same content-derived `productionAssetId`
//    (`domain/productionAssetId.ts`) but a DIFFERENT `patternId`. The
//    three rules above are blind to this case by construction (they all
//    scope to "same patternId"), so a design re-imported under a new
//    catalog asset id — a renamed file, a re-exported copy, a fresh
//    import of the same generated SVG — would otherwise sail through as
//    "not a duplicate" even though it is byte-for-byte the same sellable
//    content already submitted to that marketplace. Candidates/records
//    with a `null` `productionAssetId` never match each other or anything
//    else — `null` means "unknown," not "same."

export type DuplicateConflictReason = 'same-version' | 'already-approved' | 'already-submitted' | 'same-production-asset';

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
  /** Build 026 — the candidate's content-derived identity, when known.
   * Omitted/`null` disables the `same-production-asset` rule for this
   * candidate rather than matching everything, since `null` means
   * "unknown," not "same." */
  productionAssetId?: string | null;
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

  if (candidate.productionAssetId) {
    const sameAssetDifferentPattern = existing.filter(
      (r) =>
        r.marketplaceId === candidate.marketplaceId &&
        r.submissionId !== candidate.submissionId &&
        r.patternId !== candidate.patternId &&
        r.productionAssetId === candidate.productionAssetId,
    );
    for (const record of sameAssetDifferentPattern) {
      conflicts.push({ reason: 'same-production-asset', existingSubmissionId: record.submissionId });
    }
  }

  return { isDuplicate: conflicts.length > 0, conflicts };
}
