import { describe, it, expect } from 'vitest';
import { filterSubmissions, searchSubmissions } from './submissionSearchFilter';
import { createSubmissionRecord } from './submissionRecord';
import type { SubmissionRecord } from './submissionRecord';

function record(overrides: Partial<SubmissionRecord> & { patternId: string; marketplaceId: string }): SubmissionRecord {
  const base = createSubmissionRecord({ patternId: overrides.patternId, marketplaceId: overrides.marketplaceId, now: overrides.createdAt });
  return { ...base, ...overrides };
}

const records: SubmissionRecord[] = [
  record({ patternId: 'p1', marketplaceId: 'etsy', status: 'READY', createdAt: 100, titleSnapshot: 'Floral Spring Pattern', keywordSnapshot: ['floral', 'spring'], notes: '' }),
  record({ patternId: 'p2', marketplaceId: 'shutterstock', status: 'SUBMITTED', createdAt: 200, titleSnapshot: 'Geometric Abstract', keywordSnapshot: ['geometric'], notes: 'Priority listing' }),
  record({ patternId: 'p3', marketplaceId: 'etsy', status: 'DRAFT', createdAt: 300, titleSnapshot: 'Boho Tribal Print', keywordSnapshot: ['boho'], notes: '' }),
];

describe('filterSubmissions', () => {
  it('returns everything when no criteria given', () => {
    expect(filterSubmissions(records, {})).toHaveLength(3);
  });

  it('filters by marketplaceId', () => {
    expect(filterSubmissions(records, { marketplaceId: 'etsy' }).map((r) => r.patternId)).toEqual(['p1', 'p3']);
  });

  it('filters by status', () => {
    expect(filterSubmissions(records, { status: 'SUBMITTED' }).map((r) => r.patternId)).toEqual(['p2']);
  });

  it('filters by patternId', () => {
    expect(filterSubmissions(records, { patternId: 'p3' }).map((r) => r.patternId)).toEqual(['p3']);
  });

  it('filters by an inclusive createdAt date range', () => {
    expect(filterSubmissions(records, { createdFrom: 150, createdTo: 250 }).map((r) => r.patternId)).toEqual(['p2']);
    expect(filterSubmissions(records, { createdFrom: 100, createdTo: 300 })).toHaveLength(3);
  });

  it('combines multiple criteria with AND semantics', () => {
    expect(filterSubmissions(records, { marketplaceId: 'etsy', status: 'DRAFT' }).map((r) => r.patternId)).toEqual(['p3']);
  });
});

describe('searchSubmissions', () => {
  it('returns everything for an empty query', () => {
    expect(searchSubmissions(records, '')).toHaveLength(3);
    expect(searchSubmissions(records, '   ')).toHaveLength(3);
  });

  it('matches a title substring case-insensitively', () => {
    expect(searchSubmissions(records, 'floral').map((r) => r.patternId)).toEqual(['p1']);
    expect(searchSubmissions(records, 'FLORAL').map((r) => r.patternId)).toEqual(['p1']);
  });

  it('matches an individual keyword, not just a joined string', () => {
    expect(searchSubmissions(records, 'geo').map((r) => r.patternId)).toEqual(['p2']);
  });

  it('matches notes', () => {
    expect(searchSubmissions(records, 'priority').map((r) => r.patternId)).toEqual(['p2']);
  });

  it('matches patternId', () => {
    expect(searchSubmissions(records, 'p3').map((r) => r.patternId)).toEqual(['p3']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchSubmissions(records, 'nonexistent-term')).toEqual([]);
  });
});
