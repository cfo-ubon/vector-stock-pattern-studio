import type { SubmissionRecord } from './submissionRecord';

// Build 015 — Submission Queue: a pure read-side view over `QUEUED`
// records. The mutating half (moving a submission into/out of `QUEUED`)
// is `submissionService.ts`'s `enqueueSubmission`/`transitionSubmission`
// — this module only orders and inspects what is already queued, kept
// separate so "what's next" logic has no storage dependency of its own
// and is trivially testable against an in-memory list.

/** FIFO by the moment each record most recently entered `QUEUED`
 * (`updatedAt`, since `applyTransition` always bumps it) — earliest
 * first, so the head of the list is genuinely "next in line," not just
 * insertion order into the whole store. */
export function getSubmissionQueue(records: SubmissionRecord[]): SubmissionRecord[] {
  return records.filter((r) => r.status === 'QUEUED').sort((a, b) => a.updatedAt - b.updatedAt);
}

export function getNextQueuedSubmission(records: SubmissionRecord[]): SubmissionRecord | undefined {
  return getSubmissionQueue(records)[0];
}

export function getQueueLength(records: SubmissionRecord[]): number {
  return records.filter((r) => r.status === 'QUEUED').length;
}
