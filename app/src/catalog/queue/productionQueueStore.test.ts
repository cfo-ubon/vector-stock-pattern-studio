import { describe, it, expect, beforeEach } from 'vitest';
import { createProductionQueueItem, transitionProductionQueueItem } from './productionQueue';
import {
  loadProductionQueueItems,
  getProductionQueueItem,
  putProductionQueueItem,
  deleteProductionQueueItem,
  clearProductionQueueItems,
} from './productionQueueStore';

beforeEach(async () => {
  await clearProductionQueueItems();
});

describe('productionQueueStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadProductionQueueItems()).toEqual([]);
  });

  it('persists and retrieves an item', async () => {
    const item = createProductionQueueItem({ ideaNote: 'A new idea' });
    await putProductionQueueItem(item);
    expect(await loadProductionQueueItems()).toEqual([item]);
    expect(await getProductionQueueItem(item.queueItemId)).toEqual(item);
  });

  it('put again with an advanced status overwrites the same record (current state, not a new row)', async () => {
    const item = createProductionQueueItem({ ideaNote: 'A new idea' });
    await putProductionQueueItem(item);
    const advanced = transitionProductionQueueItem(item, 'GENERATED');
    await putProductionQueueItem(advanced);
    const all = await loadProductionQueueItems();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('GENERATED');
  });

  it('deletes an item', async () => {
    const item = createProductionQueueItem({ ideaNote: 'A new idea' });
    await putProductionQueueItem(item);
    await deleteProductionQueueItem(item.queueItemId);
    expect(await loadProductionQueueItems()).toEqual([]);
  });

  it('getProductionQueueItem returns undefined for an unknown id', async () => {
    expect(await getProductionQueueItem('QI-does-not-exist')).toBeUndefined();
  });

  it('clearProductionQueueItems empties the store', async () => {
    await putProductionQueueItem(createProductionQueueItem({ ideaNote: 'A' }));
    await putProductionQueueItem(createProductionQueueItem({ ideaNote: 'B' }));
    await clearProductionQueueItems();
    expect(await loadProductionQueueItems()).toEqual([]);
  });
});
