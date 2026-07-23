import { describe, it, expect } from 'vitest';
import {
  createProductionBatch,
  addQueueItemToBatch,
  removeQueueItemFromBatch,
  normalizeProductionBatch,
  isValidProductionBatch,
  isProductionBatchType,
  InvalidProductionBatchInputError,
  PRODUCTION_BATCH_TYPES,
} from './productionBatch';

describe('createProductionBatch', () => {
  it('creates a batch with an empty queueItemIds list', () => {
    const batch = createProductionBatch({ name: 'Autumn 2026', batchType: 'seasonal-campaign', now: 1000 });
    expect(batch.name).toBe('Autumn 2026');
    expect(batch.batchType).toBe('seasonal-campaign');
    expect(batch.queueItemIds).toEqual([]);
    expect(batch.createdAt).toBe(1000);
  });

  it('rejects an empty name', () => {
    expect(() => createProductionBatch({ name: '   ', batchType: 'production-batch' })).toThrow(InvalidProductionBatchInputError);
  });
});

describe('addQueueItemToBatch / removeQueueItemFromBatch', () => {
  it('adds an item and updates updatedAt', () => {
    const batch = createProductionBatch({ name: 'B', batchType: 'production-batch', now: 1000 });
    const updated = addQueueItemToBatch(batch, 'QI-1', 2000);
    expect(updated.queueItemIds).toEqual(['QI-1']);
    expect(updated.updatedAt).toBe(2000);
  });

  it('adding the same item twice is idempotent (no duplicate, unchanged batch)', () => {
    const batch = createProductionBatch({ name: 'B', batchType: 'production-batch', now: 1000 });
    const once = addQueueItemToBatch(batch, 'QI-1', 2000);
    const twice = addQueueItemToBatch(once, 'QI-1', 3000);
    expect(twice.queueItemIds).toEqual(['QI-1']);
    expect(twice.updatedAt).toBe(2000);
  });

  it('removes an item and updates updatedAt', () => {
    const batch = addQueueItemToBatch(createProductionBatch({ name: 'B', batchType: 'production-batch' }), 'QI-1');
    const removed = removeQueueItemFromBatch(batch, 'QI-1', 5000);
    expect(removed.queueItemIds).toEqual([]);
    expect(removed.updatedAt).toBe(5000);
  });

  it('removing a non-member is a no-op', () => {
    const batch = createProductionBatch({ name: 'B', batchType: 'production-batch', now: 1000 });
    const result = removeQueueItemFromBatch(batch, 'QI-does-not-exist', 9999);
    expect(result).toEqual(batch);
  });

  it('never mutates the input batch', () => {
    const batch = createProductionBatch({ name: 'B', batchType: 'production-batch' });
    const before = JSON.parse(JSON.stringify(batch));
    addQueueItemToBatch(batch, 'QI-1');
    expect(batch).toEqual(before);
  });
});

describe('normalizeProductionBatch', () => {
  it('defaults every optional field and falls back to production-batch for an invalid stored type', () => {
    const corrupted = { batchId: 'BATCH-1', name: 'X', batchType: 'not-a-real-type', createdAt: 1, updatedAt: 1 } as unknown as Parameters<typeof normalizeProductionBatch>[0];
    const normalized = normalizeProductionBatch(corrupted);
    expect(normalized.batchType).toBe('production-batch');
    expect(normalized.queueItemIds).toEqual([]);
    expect(normalized.notes).toBe('');
  });
});

describe('isProductionBatchType / isValidProductionBatch', () => {
  it('accepts all 6 named batch types', () => {
    expect(PRODUCTION_BATCH_TYPES).toHaveLength(6);
    for (const t of PRODUCTION_BATCH_TYPES) expect(isProductionBatchType(t)).toBe(true);
  });

  it('rejects a bogus type', () => {
    expect(isProductionBatchType('bogus')).toBe(false);
  });

  it('validates a real batch and rejects a malformed one', () => {
    expect(isValidProductionBatch(createProductionBatch({ name: 'X', batchType: 'collection' }))).toBe(true);
    expect(isValidProductionBatch({})).toBe(false);
  });
});
