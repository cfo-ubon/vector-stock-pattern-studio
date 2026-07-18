// Build 015 — Submission Center Foundation, Commercial Workflow's first
// module. A `SubmissionStatus` tracks ONE (pattern, marketplace) listing
// attempt through its own lifecycle — distinct from
// `domain/types.ts`'s `WorkflowStatus` on `PortfolioAsset` (a single
// per-asset production-pipeline status). A pattern can have many
// `SubmissionRecord`s in flight simultaneously (one per marketplace, or
// several over time after a rejection) — that per-marketplace fan-out is
// exactly what `WorkflowStatus` cannot express and this module exists to
// cover. Naming follows the codebase's existing SCREAMING_SNAKE_CASE
// status convention (`WorkflowStatus`'s `DRAFT`/`READY_TO_UPLOAD`/...).

export type SubmissionStatus =
  | 'DRAFT'
  | 'READY'
  | 'QUEUED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_REVISION'
  | 'ARCHIVED';

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  'DRAFT',
  'READY',
  'QUEUED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'NEEDS_REVISION',
  'ARCHIVED',
];

export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return typeof value === 'string' && (SUBMISSION_STATUSES as string[]).includes(value);
}

/** The full state machine. Every non-`ARCHIVED` status can reach
 * `ARCHIVED` directly (a user must always be able to shelve a
 * submission), and `ARCHIVED` can only return to `DRAFT` (an explicit
 * "restore to draft," never straight back into a downstream status like
 * `SUBMITTED` — whatever made it archived should be re-reviewed first).
 * `READY` requires re-validation to leave `DRAFT` (see
 * `submissionValidation.ts`) — this map only encodes which transitions
 * are structurally legal, not whether one is allowed *right now*. */
export const SUBMISSION_STATUS_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: ['READY', 'ARCHIVED'],
  READY: ['DRAFT', 'QUEUED', 'ARCHIVED'],
  QUEUED: ['READY', 'SUBMITTED', 'ARCHIVED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'NEEDS_REVISION', 'ARCHIVED'],
  APPROVED: ['ARCHIVED'],
  REJECTED: ['DRAFT', 'ARCHIVED'],
  NEEDS_REVISION: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export function canTransitionSubmissionStatus(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return SUBMISSION_STATUS_TRANSITIONS[from].includes(to);
}

export class InvalidSubmissionStatusTransitionError extends Error {
  readonly from: SubmissionStatus;
  readonly to: SubmissionStatus;
  constructor(from: SubmissionStatus, to: SubmissionStatus) {
    super(`Cannot transition a submission from ${from} to ${to} — not a legal transition.`);
    this.name = 'InvalidSubmissionStatusTransitionError';
    this.from = from;
    this.to = to;
  }
}

/** Throws `InvalidSubmissionStatusTransitionError` for an illegal
 * transition; returns void (does not mutate anything) otherwise — the
 * caller (`submissionService.ts`) performs the actual state change. */
export function assertValidSubmissionTransition(from: SubmissionStatus, to: SubmissionStatus): void {
  if (!canTransitionSubmissionStatus(from, to)) {
    throw new InvalidSubmissionStatusTransitionError(from, to);
  }
}
