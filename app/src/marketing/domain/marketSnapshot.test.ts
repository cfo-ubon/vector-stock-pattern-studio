import { describe, it, expect } from 'vitest';
import {
  createMarketSnapshot,
  normalizeMarketSnapshot,
  duplicateMarketSnapshot,
  describeSnapshotFreshness,
  isValidMarketSnapshot,
  InvalidMarketSnapshotInputError,
} from './marketSnapshot';

const DAY = 24 * 60 * 60 * 1000;

describe('createMarketSnapshot', () => {
  it('produces a well-shaped snapshot from real evidence refs', () => {
    const now = new Date(2026, 6, 18).getTime();
    const snapshot = createMarketSnapshot({
      researchDateRange: { from: now - 7 * DAY, to: now },
      evidenceRefs: ['OBS-1', 'OBS-2', 'OBS-3'],
      keywords: ['spring floral'],
      confidence: 'medium',
      now,
    });
    expect(snapshot.id).toMatch(/^SNAP-\d{8}-[0-9A-Z]{6}$/);
    expect(snapshot.sourceCount).toBe(3);
    expect(snapshot.archived).toBe(false);
    expect(snapshot.dataFreshness).toBe('Same day');
    expect(isValidMarketSnapshot(snapshot)).toBe(true);
  });

  it('refuses to create a snapshot with zero evidence refs', () => {
    expect(() => createMarketSnapshot({ researchDateRange: { from: 0, to: 1 }, evidenceRefs: [] })).toThrow(
      InvalidMarketSnapshotInputError,
    );
  });
});

describe('describeSnapshotFreshness', () => {
  it('labels ages correctly at each documented threshold', () => {
    const created = 0;
    expect(describeSnapshotFreshness(created, created)).toBe('Same day');
    expect(describeSnapshotFreshness(created, created + 1 * DAY)).toBe('1 day old');
    expect(describeSnapshotFreshness(created, created + 3 * DAY)).toBe('3 days old');
    expect(describeSnapshotFreshness(created, created + 10 * DAY)).toBe('1 week old');
    expect(describeSnapshotFreshness(created, created + 20 * DAY)).toBe('2 weeks old');
    expect(describeSnapshotFreshness(created, created + 45 * DAY)).toBe('1 months old');
  });
});

describe('duplicateMarketSnapshot', () => {
  it('creates a fresh, independent, unarchived copy', () => {
    const original = createMarketSnapshot({ researchDateRange: { from: 0, to: 1 }, evidenceRefs: ['OBS-1'], now: 1000 });
    const archivedOriginal = { ...original, archived: true };
    const copy = duplicateMarketSnapshot(archivedOriginal, 5000);
    expect(copy.id).not.toBe(original.id);
    expect(copy.archived).toBe(false);
    expect(copy.evidenceRefs).toEqual(original.evidenceRefs);
    expect(copy.createdAt).toBe(5000);
  });
});

describe('normalizeMarketSnapshot', () => {
  it('fills defaults for a record missing newer optional array fields', () => {
    const bare = {
      id: 'SNAP-20260101-ABCDEF',
      createdAt: 1000,
      researchDateRange: { from: 0, to: 1000 },
      evidenceRefs: ['OBS-1'],
      confidence: 'unknown',
      archived: false,
      schemaVersion: 1,
    } as never;
    const normalized = normalizeMarketSnapshot(bare);
    expect(normalized.keywords).toEqual([]);
    expect(normalized.opportunityIds).toEqual([]);
    expect(normalized.marketplaces).toEqual([]);
  });
});
