import type { SubmissionRecord, CreateSubmissionInput } from './submissionRecord';
import { createSubmissionRecord } from './submissionRecord';
import type { SubmissionStatus } from './submissionStatus';
import { assertValidSubmissionTransition } from './submissionStatus';
import { getSubmission, loadSubmissions, putSubmission, deleteSubmission as deleteSubmissionFromStore } from './submissionStore';
import type { SubmissionReadinessInput, SubmissionValidationReport } from './submissionValidation';
import { validateSubmissionReadiness } from './submissionValidation';

// Build 015 — the Submission Center's orchestration layer, playing the
// same role `services/collectionService.ts` plays for Collections: the
// one place record creation, status transitions, validation, and
// storage are tied together. Everything below only reads/writes through
// `submissionStore.ts` — never IndexedDB, never the Collection module.

export class SubmissionNotFoundError extends Error {
  constructor(submissionId: string) {
    super(`No submission found with id "${submissionId}".`);
    this.name = 'SubmissionNotFoundError';
  }
}

/** The only statuses whose snapshot fields (title/description/keywords/
 * category/notes) may still be edited — a submission that is Queued,
 * Submitted, Approved, or Archived represents a listing already
 * committed to (or shelved from) a marketplace; editing its snapshot in
 * place would silently disagree with what was actually submitted. */
const EDITABLE_STATUSES: SubmissionStatus[] = ['DRAFT', 'NEEDS_REVISION', 'REJECTED'];

export class SubmissionNotEditableError extends Error {
  constructor(submissionId: string, status: SubmissionStatus) {
    super(`Submission "${submissionId}" cannot be edited while its status is ${status}.`);
    this.name = 'SubmissionNotEditableError';
  }
}

function getSubmissionOrThrow(submissionId: string): SubmissionRecord {
  const record = getSubmission(submissionId);
  if (!record) throw new SubmissionNotFoundError(submissionId);
  return record;
}

export function createSubmission(input: CreateSubmissionInput): SubmissionRecord {
  const record = createSubmissionRecord(input);
  putSubmission(record);
  return record;
}

export interface SubmissionDraftUpdate {
  titleSnapshot?: string;
  descriptionSnapshot?: string;
  keywordSnapshot?: string[];
  category?: string | null;
  notes?: string;
}

export function updateSubmissionDraft(submissionId: string, updates: SubmissionDraftUpdate): SubmissionRecord {
  const record = getSubmissionOrThrow(submissionId);
  if (!EDITABLE_STATUSES.includes(record.status)) {
    throw new SubmissionNotEditableError(submissionId, record.status);
  }
  const updated: SubmissionRecord = { ...record, ...updates, updatedAt: Date.now() };
  putSubmission(updated);
  return updated;
}

function applyTransition(record: SubmissionRecord, to: SubmissionStatus, note?: string, now: number = Date.now()): SubmissionRecord {
  assertValidSubmissionTransition(record.status, to);
  const updated: SubmissionRecord = {
    ...record,
    status: to,
    updatedAt: now,
    submittedAt: to === 'SUBMITTED' ? now : record.submittedAt,
    statusHistory: [...record.statusHistory, note ? { status: to, changedAt: now, note } : { status: to, changedAt: now }],
  };
  putSubmission(updated);
  return updated;
}

/** Generic transition entry point — throws
 * `InvalidSubmissionStatusTransitionError` (from `submissionStatus.ts`)
 * for anything not legal per the state machine. The one exception is
 * `DRAFT -> READY`, which always requires `markReady` instead since it
 * is validation-gated, not a free transition — see `markReady` below. */
export function transitionSubmission(submissionId: string, to: SubmissionStatus, note?: string): SubmissionRecord {
  const record = getSubmissionOrThrow(submissionId);
  return applyTransition(record, to, note);
}

export interface MarkReadyResult {
  record: SubmissionRecord;
  validation: SubmissionValidationReport;
}

/** The only path into `READY`. Always returns the validation report,
 * whether or not the transition actually happened — `validation.valid
 * === false` means `record` is returned unchanged (still whatever
 * status it was), so a caller never needs to guess why nothing moved. */
export function markReady(submissionId: string, readiness: SubmissionReadinessInput): MarkReadyResult {
  const record = getSubmissionOrThrow(submissionId);
  const validation = validateSubmissionReadiness(record, readiness, loadSubmissions());
  if (!validation.valid) return { record, validation };
  return { record: applyTransition(record, 'READY'), validation };
}

export function enqueueSubmission(submissionId: string): SubmissionRecord {
  return transitionSubmission(submissionId, 'QUEUED');
}

export function markSubmitted(submissionId: string): SubmissionRecord {
  return transitionSubmission(submissionId, 'SUBMITTED');
}

export function markApproved(submissionId: string): SubmissionRecord {
  return transitionSubmission(submissionId, 'APPROVED');
}

export function markRejected(submissionId: string, note?: string): SubmissionRecord {
  return transitionSubmission(submissionId, 'REJECTED', note);
}

export function markNeedsRevision(submissionId: string, note?: string): SubmissionRecord {
  return transitionSubmission(submissionId, 'NEEDS_REVISION', note);
}

export function archiveSubmission(submissionId: string, note?: string): SubmissionRecord {
  return transitionSubmission(submissionId, 'ARCHIVED', note);
}

export function restoreSubmissionToDraft(submissionId: string, note?: string): SubmissionRecord {
  return transitionSubmission(submissionId, 'DRAFT', note);
}

export function deleteSubmissionRecord(submissionId: string): void {
  deleteSubmissionFromStore(submissionId);
}
