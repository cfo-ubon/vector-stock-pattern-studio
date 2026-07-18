import { describe, it, expect } from 'vitest';
import { getSubmissionHistory, getPatternSubmissionTimeline } from './submissionHistory';
import { createSubmissionRecord } from './submissionRecord';

describe('getSubmissionHistory', () => {
  it('returns the record\'s own statusHistory verbatim', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', now: 1000 });
    expect(getSubmissionHistory(record)).toEqual([{ status: 'DRAFT', changedAt: 1000 }]);
  });

  it('reflects appended transitions when the record has more history', () => {
    const record = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', now: 1000 });
    const withHistory = { ...record, statusHistory: [...record.statusHistory, { status: 'READY' as const, changedAt: 2000 }] };
    expect(getSubmissionHistory(withHistory)).toHaveLength(2);
    expect(getSubmissionHistory(withHistory)[1].status).toBe('READY');
  });
});

describe('getPatternSubmissionTimeline', () => {
  it('returns every submission for one pattern across marketplaces, oldest first', () => {
    const a = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy', now: 300 });
    const b = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'shutterstock', now: 100 });
    const c = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'freepik', now: 200 });
    const unrelated = createSubmissionRecord({ patternId: 'p2', marketplaceId: 'etsy', now: 50 });
    const timeline = getPatternSubmissionTimeline([a, b, c, unrelated], 'p1');
    expect(timeline.map((r) => r.marketplaceId)).toEqual(['shutterstock', 'freepik', 'etsy']);
  });

  it('returns an empty array for a pattern with no submissions', () => {
    const a = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
    expect(getPatternSubmissionTimeline([a], 'p999')).toEqual([]);
  });
});
