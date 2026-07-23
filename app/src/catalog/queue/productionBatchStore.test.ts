import { describe, it, expect, beforeEach } from 'vitest';
import { createProductionBatch, addQueueItemToBatch } from './productionBatch';
import {
  loadProductionBatches,
  getProductionBatch,
  putProductionBatch,
  deleteProductionBatch,
  clearProductionBatches,
} from './productionBatchStore';

beforeEach(async () => {
  await clearProductionBatches();
});

describe('productionBatchStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadProductionBatches()).toEqual([]);
  });

  it('persists and retrieves a batch', async () => {
    const batch = createProductionBatch({ name: 'Spring Collection', batchType: 'collection' });
    await putProductionBatch(batch);
    expect(await loadProductionBatches()).toEqual([batch]);
    expect(await getProductionBatch(batch.batchId)).toEqual(batch);
  });

  it('put again with updated membership overwrites the same record', async () => {
    const batch = createProductionBatch({ name: 'Spring Collection', batchType: 'collection' });
    await putProductionBatch(batch);
    const withItem = addQueueItemToBatch(batch, 'QI-1');
    await putProductionBatch(withItem);
    const all = await loadProductionBatches();
    expect(all).toHaveLength(1);
    expect(all[0].queueItemIds).toEqual(['QI-1']);
  });

  it('deletes a batch', async () => {
    const batch = createProductionBatch({ name: 'X', batchType: 'production-batch' });
    await putProductionBatch(batch);
    await deleteProductionBatch(batch.batchId);
    expect(await loadProductionBatches()).toEqual([]);
  });

  it('getProductionBatch returns undefined for an unknown id', async () => {
    expect(await getProductionBatch('BATCH-does-not-exist')).toBeUndefined();
  });

  it('clearProductionBatches empties the store', async () => {
    await putProductionBatch(createProductionBatch({ name: 'A', batchType: 'collection' }));
    await putProductionBatch(createProductionBatch({ name: 'B', batchType: 'marketplace-batch' }));
    await clearProductionBatches();
    expect(await loadProductionBatches()).toEqual([]);
  });
});
