import { describe, it, expect } from 'vitest';
import {
  createProductionQueueItem,
  transitionProductionQueueItem,
  canTransitionProductionQueueStatus,
  normalizeProductionQueueItem,
  isValidProductionQueueItem,
  isProductionQueueStatus,
  InvalidProductionQueueTransitionError,
  PRODUCTION_QUEUE_STATUSES,
} from './productionQueue';

describe('createProductionQueueItem', () => {
  it('starts at IDEA with a single history entry', () => {
    const item = createProductionQueueItem({ ideaNote: 'Try a bold geometric mug pattern', now: 1000 });
    expect(item.status).toBe('IDEA');
    expect(item.statusHistory).toEqual([{ status: 'IDEA', changedAt: 1000 }]);
    expect(item.assetId).toBeNull();
    expect(item.submissionIds).toEqual([]);
  });
});

describe('canTransitionProductionQueueStatus', () => {
  it('allows the full linear happy path', () => {
    expect(canTransitionProductionQueueStatus('IDEA', 'GENERATED')).toBe(true);
    expect(canTransitionProductionQueueStatus('GENERATED', 'QUALITY_REVIEW')).toBe(true);
    expect(canTransitionProductionQueueStatus('QUALITY_REVIEW', 'READY')).toBe(true);
    expect(canTransitionProductionQueueStatus('READY', 'PACKAGE_PREPARED')).toBe(true);
    expect(canTransitionProductionQueueStatus('PACKAGE_PREPARED', 'SUBMITTED')).toBe(true);
    expect(canTransitionProductionQueueStatus('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransitionProductionQueueStatus('SUBMITTED', 'REJECTED')).toBe(true);
    expect(canTransitionProductionQueueStatus('APPROVED', 'PERFORMANCE_TRACKING')).toBe(true);
  });

  it('allows the regenerate-on-failure loop from QUALITY_REVIEW back to GENERATED', () => {
    expect(canTransitionProductionQueueStatus('QUALITY_REVIEW', 'GENERATED')).toBe(true);
  });

  it('allows the rework path from REJECTED back to IDEA or GENERATED', () => {
    expect(canTransitionProductionQueueStatus('REJECTED', 'IDEA')).toBe(true);
    expect(canTransitionProductionQueueStatus('REJECTED', 'GENERATED')).toBe(true);
  });

  it('rejects skipping stages', () => {
    expect(canTransitionProductionQueueStatus('IDEA', 'READY')).toBe(false);
    expect(canTransitionProductionQueueStatus('IDEA', 'SUBMITTED')).toBe(false);
  });

  it('rejects any transition out of the terminal PERFORMANCE_TRACKING stage', () => {
    for (const status of PRODUCTION_QUEUE_STATUSES) {
      expect(canTransitionProductionQueueStatus('PERFORMANCE_TRACKING', status)).toBe(false);
    }
  });
});

describe('transitionProductionQueueItem', () => {
  it('advances status, updates updatedAt, and appends a history entry', () => {
    const item = createProductionQueueItem({ ideaNote: 'idea', now: 1000 });
    const advanced = transitionProductionQueueItem(item, 'GENERATED', 2000, 'first draft generated');
    expect(advanced.status).toBe('GENERATED');
    expect(advanced.updatedAt).toBe(2000);
    expect(advanced.statusHistory).toHaveLength(2);
    expect(advanced.statusHistory[1]).toEqual({ status: 'GENERATED', changedAt: 2000, note: 'first draft generated' });
  });

  it('never mutates the input item', () => {
    const item = createProductionQueueItem({ ideaNote: 'idea', now: 1000 });
    const before = JSON.parse(JSON.stringify(item));
    transitionProductionQueueItem(item, 'GENERATED', 2000);
    expect(item).toEqual(before);
  });

  it('throws InvalidProductionQueueTransitionError for a disallowed transition', () => {
    const item = createProductionQueueItem({ ideaNote: 'idea' });
    expect(() => transitionProductionQueueItem(item, 'SUBMITTED')).toThrow(InvalidProductionQueueTransitionError);
  });

  it('throws for any attempted transition out of PERFORMANCE_TRACKING', () => {
    let item = createProductionQueueItem({ ideaNote: 'idea' });
    item = transitionProductionQueueItem(item, 'GENERATED');
    item = transitionProductionQueueItem(item, 'QUALITY_REVIEW');
    item = transitionProductionQueueItem(item, 'READY');
    item = transitionProductionQueueItem(item, 'PACKAGE_PREPARED');
    item = transitionProductionQueueItem(item, 'SUBMITTED');
    item = transitionProductionQueueItem(item, 'APPROVED');
    item = transitionProductionQueueItem(item, 'PERFORMANCE_TRACKING');
    expect(() => transitionProductionQueueItem(item, 'IDEA')).toThrow(InvalidProductionQueueTransitionError);
  });
});

describe('normalizeProductionQueueItem', () => {
  it('defaults every optional field for a legacy-shaped record', () => {
    const bare = { queueItemId: 'QI-1', status: 'IDEA', createdAt: 1000, updatedAt: 1000 } as unknown as Parameters<typeof normalizeProductionQueueItem>[0];
    const normalized = normalizeProductionQueueItem(bare);
    expect(normalized.ideaNote).toBe('');
    expect(normalized.assetId).toBeNull();
    expect(normalized.productionAssetId).toBeNull();
    expect(normalized.submissionIds).toEqual([]);
    expect(normalized.batchId).toBeNull();
    expect(normalized.statusHistory).toEqual([]);
  });

  it('falls back to IDEA for an invalid stored status rather than crashing', () => {
    const corrupted = { ...createProductionQueueItem({ ideaNote: 'x' }), status: 'NOT_A_REAL_STATUS' } as unknown as Parameters<typeof normalizeProductionQueueItem>[0];
    expect(normalizeProductionQueueItem(corrupted).status).toBe('IDEA');
  });
});

describe('isProductionQueueStatus / isValidProductionQueueItem', () => {
  it('accepts every real status and rejects garbage', () => {
    for (const status of PRODUCTION_QUEUE_STATUSES) expect(isProductionQueueStatus(status)).toBe(true);
    expect(isProductionQueueStatus('nonsense')).toBe(false);
  });

  it('validates a real item and rejects a malformed one', () => {
    expect(isValidProductionQueueItem(createProductionQueueItem({ ideaNote: 'x' }))).toBe(true);
    expect(isValidProductionQueueItem({})).toBe(false);
    expect(isValidProductionQueueItem(null)).toBe(false);
  });
});
