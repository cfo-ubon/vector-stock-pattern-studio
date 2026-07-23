import { describe, it, expect, beforeEach } from 'vitest';
import { loadSalesEvents, putSalesEvent, putSalesEventsBulk, deleteSalesEvent, clearSalesEvents } from './salesRevenueStore';
import { createSalesEvent } from './salesRevenue';

beforeEach(async () => {
  await clearSalesEvents();
});

describe('salesRevenueStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadSalesEvents()).toEqual([]);
  });

  it('putSalesEvent persists a single event', async () => {
    const event = createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now(), grossRevenue: 10 });
    await putSalesEvent(event);
    const all = await loadSalesEvents();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(event);
  });

  it('putSalesEventsBulk persists many events in one transaction', async () => {
    const events = [
      createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now() }),
      createSalesEvent({ productionAssetId: 'PAID-2', marketplaceId: 'shutterstock', date: Date.now() }),
    ];
    await putSalesEventsBulk(events);
    expect(await loadSalesEvents()).toHaveLength(2);
  });

  it('deleteSalesEvent removes exactly the targeted event', async () => {
    const a = createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now() });
    const b = createSalesEvent({ productionAssetId: 'PAID-2', marketplaceId: 'shutterstock', date: Date.now() });
    await putSalesEventsBulk([a, b]);
    await deleteSalesEvent(a.eventId);
    const all = await loadSalesEvents();
    expect(all).toHaveLength(1);
    expect(all[0].eventId).toBe(b.eventId);
  });

  it('clearSalesEvents empties the store', async () => {
    await putSalesEvent(createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now() }));
    await clearSalesEvents();
    expect(await loadSalesEvents()).toEqual([]);
  });
});
