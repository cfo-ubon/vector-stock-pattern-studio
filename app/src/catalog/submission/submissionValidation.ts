import type { SubmissionRecord } from './submissionRecord';
import { getMarketplaceProfile } from './marketplaceProfile';
import { detectDuplicateSubmission } from './submissionDuplicateDetection';

// Build 015 — Submission Validation ("Before a submission can become
// Ready... Return structured validation report."). Never throws — like
// `catalog/backup/backupValidation.ts`'s `validateBackupArchive`, every
// failure is captured as an `issue` in the returned report, so a caller
// always gets an object to inspect/display rather than an exception to
// catch. Pure: takes the record plus caller-supplied readiness facts and
// the existing-records list to check against; touches no storage itself.

export type SubmissionValidationIssueCode =
  | 'unknown-marketplace'
  | 'missing-svg'
  | 'missing-preview'
  | 'missing-title'
  | 'missing-description'
  | 'insufficient-keywords'
  | 'too-many-keywords'
  | 'missing-category'
  | 'duplicate-submission';

export interface SubmissionValidationIssue {
  severity: 'error' | 'warning';
  code: SubmissionValidationIssueCode;
  message: string;
}

export interface SubmissionValidationReport {
  valid: boolean;
  issues: SubmissionValidationIssue[];
}

/** What the caller knows about the underlying pattern's file assets —
 * deliberately NOT a `PortfolioAsset` (see `submissionRecord.ts`'s
 * module header on why `patternId` stays decoupled). A caller backed by
 * Portfolio Manager derives this from a real asset
 * (`hasSvg: asset.sourceFileReferences.some(f => f.role === 'svg')`,
 * `hasPreview: asset.previewReference !== null`); any other caller
 * supplies whatever facts it has. */
export interface SubmissionReadinessInput {
  hasSvg: boolean;
  hasPreview: boolean;
}

/** Validates whether `record` is allowed to become `READY`. Every check
 * below is one of the brief's literally-named "Required" items —
 * `SVG exists`/`Preview exists` come from `readiness`, `Title exists`/
 * `Description exists`/`Keywords available`/`Category assigned` come
 * from the record's own snapshot fields (checked against the
 * submission's marketplace profile for the keyword count bound), and
 * `No duplicate submission to the same marketplace` is delegated to
 * `detectDuplicateSubmission`. */
export function validateSubmissionReadiness(
  record: SubmissionRecord,
  readiness: SubmissionReadinessInput,
  existingSubmissions: SubmissionRecord[],
): SubmissionValidationReport {
  const issues: SubmissionValidationIssue[] = [];
  const profile = getMarketplaceProfile(record.marketplaceId);

  if (!profile) {
    issues.push({ severity: 'error', code: 'unknown-marketplace', message: `"${record.marketplaceId}" is not a registered marketplace profile — register it before submitting to it.` });
    // No profile means no keyword bounds or requirement flags to check
    // against — every other marketplace-relative check below is
    // meaningless without one, so report just this and stop.
    return { valid: false, issues };
  }

  if (!readiness.hasSvg) {
    issues.push({ severity: 'error', code: 'missing-svg', message: 'No SVG source file is available for this pattern.' });
  }
  if (!readiness.hasPreview) {
    issues.push({ severity: 'error', code: 'missing-preview', message: 'No preview image is available for this pattern.' });
  }
  if (!record.titleSnapshot.trim()) {
    issues.push({ severity: 'error', code: 'missing-title', message: 'A title is required before this submission can become Ready.' });
  }
  if (profile.requiresDescription && !record.descriptionSnapshot.trim()) {
    issues.push({ severity: 'error', code: 'missing-description', message: 'A description is required before this submission can become Ready.' });
  }
  if (record.keywordSnapshot.length < profile.minKeywords) {
    issues.push({ severity: 'error', code: 'insufficient-keywords', message: `${profile.label} requires at least ${profile.minKeywords} keywords — this submission has ${record.keywordSnapshot.length}.` });
  } else if (record.keywordSnapshot.length > profile.maxKeywords) {
    issues.push({ severity: 'error', code: 'too-many-keywords', message: `${profile.label} allows at most ${profile.maxKeywords} keywords — this submission has ${record.keywordSnapshot.length}.` });
  }
  if (profile.requiresCategory && !record.category) {
    issues.push({ severity: 'error', code: 'missing-category', message: 'A category is required before this submission can become Ready.' });
  }

  const duplicate = detectDuplicateSubmission(
    {
      patternId: record.patternId,
      marketplaceId: record.marketplaceId,
      version: record.version,
      submissionId: record.submissionId,
      productionAssetId: record.productionAssetId,
    },
    existingSubmissions,
  );
  if (duplicate.isDuplicate) {
    const reasons = [...new Set(duplicate.conflicts.map((c) => c.reason))].join(', ');
    issues.push({ severity: 'error', code: 'duplicate-submission', message: `This would duplicate an existing submission to ${profile.label} (${reasons}).` });
  }

  return { valid: issues.every((i) => i.severity !== 'error'), issues };
}
