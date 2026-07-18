import { describe, it, expect } from 'vitest';
import { getSubmissionQueue, getNextQueuedSubmission, getQueueLength } from './submissionQueue';
import { createSubmissionRecord } from './submissionRecord';
import type { SubmissionRecord } from './submissionRecord';

function queued(patternId: string, updatedAt: number): SubmissionRecord {
  const record = createSubmissionRecord({ patternId, marketplaceId: 'etsy', now: updatedAt });
  return { ...record, status: 'QUEUED', updatedAt };
}

describe('getSubmissionQueue', () => {
  it('is empty when there are no queued records', () => {
    const records = [createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' })]; // DRAFT
    expect(getSubmissionQueue(records)).toEqual([]);
  });

  it('returns only QUEUED records, in FIFO order by updatedAt', () => {
    const third = queued('p3', 300);
    const first = queued('p1', 100);
    const second = queued('p2', 200);
    const notQueued = createSubmissionRecord({ patternId: 'p4', marketplaceId: 'etsy' });
    const ordered = getSubmissionQueue([third, first, notQueued, second]);
    expect(ordered.map((r) => r.patternId)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('getNextQueuedSubmission', () => {
  it('returns undefined when the queue is empty', () => {
    expect(getNextQueuedSubmission([])).toBeUndefined();
  });

  it('returns the earliest-queued record', () => {
    const first = queued('p1', 100);
    const second = queued('p2', 200);
    expect(getNextQueuedSubmission([second, first])?.patternId).toBe('p1');
  });
});

describe('getQueueLength', () => {
  it('counts only QUEUED records', () => {
    const records = [queued('p1', 100), queued('p2', 200), createSubmissionRecord({ patternId: 'p3', marketplaceId: 'etsy' })];
    expect(getQueueLength(records)).toBe(2);
  });
});
