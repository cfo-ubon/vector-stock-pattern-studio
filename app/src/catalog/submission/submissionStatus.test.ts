import { describe, it, expect } from 'vitest';
import {
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_TRANSITIONS,
  isSubmissionStatus,
  canTransitionSubmissionStatus,
  assertValidSubmissionTransition,
  InvalidSubmissionStatusTransitionError,
} from './submissionStatus';

describe('isSubmissionStatus', () => {
  it('accepts every real status', () => {
    for (const status of SUBMISSION_STATUSES) expect(isSubmissionStatus(status)).toBe(true);
  });
  it('rejects unrelated values', () => {
    expect(isSubmissionStatus('DRAFTX')).toBe(false);
    expect(isSubmissionStatus('draft')).toBe(false);
    expect(isSubmissionStatus(42)).toBe(false);
    expect(isSubmissionStatus(undefined)).toBe(false);
  });
});

describe('canTransitionSubmissionStatus / SUBMISSION_STATUS_TRANSITIONS', () => {
  it('every status has an entry in the transition table', () => {
    for (const status of SUBMISSION_STATUSES) {
      expect(SUBMISSION_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('the golden happy path is fully legal: DRAFT -> READY -> QUEUED -> SUBMITTED -> APPROVED -> ARCHIVED', () => {
    const path = ['DRAFT', 'READY', 'QUEUED', 'SUBMITTED', 'APPROVED', 'ARCHIVED'] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionSubmissionStatus(path[i], path[i + 1])).toBe(true);
    }
  });

  it('every status can reach ARCHIVED directly', () => {
    for (const status of SUBMISSION_STATUSES) {
      if (status === 'ARCHIVED') continue;
      expect(canTransitionSubmissionStatus(status, 'ARCHIVED')).toBe(true);
    }
  });

  it('ARCHIVED can only return to DRAFT, never straight to a downstream status', () => {
    expect(canTransitionSubmissionStatus('ARCHIVED', 'DRAFT')).toBe(true);
    expect(canTransitionSubmissionStatus('ARCHIVED', 'SUBMITTED')).toBe(false);
    expect(canTransitionSubmissionStatus('ARCHIVED', 'APPROVED')).toBe(false);
    expect(canTransitionSubmissionStatus('ARCHIVED', 'READY')).toBe(false);
  });

  it('APPROVED is terminal except for archiving', () => {
    expect(SUBMISSION_STATUS_TRANSITIONS.APPROVED).toEqual(['ARCHIVED']);
  });

  it('REJECTED and NEEDS_REVISION both route back to DRAFT for resubmission', () => {
    expect(canTransitionSubmissionStatus('REJECTED', 'DRAFT')).toBe(true);
    expect(canTransitionSubmissionStatus('NEEDS_REVISION', 'DRAFT')).toBe(true);
  });

  it('DRAFT cannot skip straight to QUEUED or SUBMITTED', () => {
    expect(canTransitionSubmissionStatus('DRAFT', 'QUEUED')).toBe(false);
    expect(canTransitionSubmissionStatus('DRAFT', 'SUBMITTED')).toBe(false);
  });

  it('QUEUED can fall back to READY (dequeue)', () => {
    expect(canTransitionSubmissionStatus('QUEUED', 'READY')).toBe(true);
  });
});

describe('assertValidSubmissionTransition', () => {
  it('does not throw for a legal transition', () => {
    expect(() => assertValidSubmissionTransition('DRAFT', 'READY')).not.toThrow();
  });

  it('throws InvalidSubmissionStatusTransitionError for an illegal transition', () => {
    expect(() => assertValidSubmissionTransition('DRAFT', 'SUBMITTED')).toThrow(InvalidSubmissionStatusTransitionError);
    try {
      assertValidSubmissionTransition('APPROVED', 'DRAFT');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidSubmissionStatusTransitionError);
      expect((err as InstanceType<typeof InvalidSubmissionStatusTransitionError>).from).toBe('APPROVED');
      expect((err as InstanceType<typeof InvalidSubmissionStatusTransitionError>).to).toBe('DRAFT');
    }
  });
});
