import { describe, it, expect } from 'vitest';
import {
  createSalesEvent,
  normalizeSalesEvent,
  isValidSalesEvent,
  aggregateByMonth,
  aggregateByMarketplace,
  aggregateByProductionAsset,
  topPerformers,
  underperformingApproved,
} from './salesRevenue';
import type { SalesEvent } from './salesRevenue';

describe('createSalesEvent', () => {
  it('computes netRevenue as gross minus fees', () => {
    const e = createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now(), grossRevenue: 10, fees: 2.5 });
    expect(e.netRevenue).toBe(7.5);
  });

  it('defaults currency to USD and does not require live conversion', () => {
    const e = createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now() });
    expect(e.currency).toBe('USD');
    expect(e.thbEquivalent).toBeNull();
  });

  it('accepts a manually entered THB equivalent without computing it', () => {
    const e = createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now(), grossRevenue: 10, thbEquivalent: 350 });
    expect(e.thbEquivalent).toBe(350);
  });
});

describe('normalizeSalesEvent', () => {
  it('fills in missing fields with safe defaults', () => {
    const partial = { eventId: 'SALE-1', productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: 1 } as SalesEvent;
    const normalized = normalizeSalesEvent(partial);
    expect(normalized.downloads).toBe(0);
    expect(normalized.netRevenue).toBe(0);
    expect(normalized.currency).toBe('USD');
  });
});

describe('isValidSalesEvent', () => {
  it('rejects malformed values', () => {
    expect(isValidSalesEvent(null)).toBe(false);
    expect(isValidSalesEvent({})).toBe(false);
    expect(isValidSalesEvent({ eventId: 'x' })).toBe(false);
  });

  it('accepts a well-formed event', () => {
    const e = createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now() });
    expect(isValidSalesEvent(e)).toBe(true);
  });
});

function event(overrides: Partial<Parameters<typeof createSalesEvent>[0]> = {}) {
  return createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: Date.now(), ...overrides });
}

describe('aggregateByMonth', () => {
  it('groups events into the same month and sums downloads/revenue', () => {
    const jan1 = Date.UTC(2026, 0, 1);
    const jan15 = Date.UTC(2026, 0, 15);
    const feb1 = Date.UTC(2026, 1, 1);
    const events = [
      event({ date: jan1, downloads: 5, grossRevenue: 10 }),
      event({ date: jan15, downloads: 3, grossRevenue: 6 }),
      event({ date: feb1, downloads: 1, grossRevenue: 2 }),
    ];
    const result = aggregateByMonth(events);
    expect(result).toEqual([
      { month: '2026-01', downloads: 8, netRevenue: 16 },
      { month: '2026-02', downloads: 1, netRevenue: 2 },
    ]);
  });
});

describe('aggregateByMarketplace and aggregateByProductionAsset', () => {
  it('sums per group, sorted descending by net revenue', () => {
    const events = [
      event({ marketplaceId: 'etsy', grossRevenue: 5 }),
      event({ marketplaceId: 'shutterstock', grossRevenue: 20 }),
      event({ marketplaceId: 'etsy', grossRevenue: 3 }),
    ];
    const result = aggregateByMarketplace(events);
    expect(result[0]).toEqual({ key: 'shutterstock', downloads: 0, netRevenue: 20 });
    expect(result[1]).toEqual({ key: 'etsy', downloads: 0, netRevenue: 8 });
  });

  it('aggregateByProductionAsset groups by productionAssetId', () => {
    const events = [
      event({ productionAssetId: 'PAID-a', grossRevenue: 1 }),
      event({ productionAssetId: 'PAID-b', grossRevenue: 5 }),
    ];
    const result = aggregateByProductionAsset(events);
    expect(result.map((r) => r.key)).toEqual(['PAID-b', 'PAID-a']);
  });
});

describe('topPerformers', () => {
  it('returns the top N production assets by net revenue', () => {
    const events = [
      event({ productionAssetId: 'PAID-a', grossRevenue: 100 }),
      event({ productionAssetId: 'PAID-b', grossRevenue: 5 }),
      event({ productionAssetId: 'PAID-c', grossRevenue: 50 }),
    ];
    const result = topPerformers(events, 2);
    expect(result).toHaveLength(2);
    expect(result[0].productionAssetId).toBe('PAID-a');
    expect(result[1].productionAssetId).toBe('PAID-c');
  });
});

describe('underperformingApproved', () => {
  it('flags approved assets at or below the revenue threshold', () => {
    const events = [event({ productionAssetId: 'PAID-a', grossRevenue: 100 }), event({ productionAssetId: 'PAID-b', grossRevenue: 0 })];
    const result = underperformingApproved(['PAID-a', 'PAID-b', 'PAID-c'], events, 0);
    // PAID-c has no sales events at all (0 net revenue, <= threshold 0) -> flagged.
    // PAID-b has exactly 0 net revenue -> flagged. PAID-a has 100 -> not flagged.
    expect(result.sort()).toEqual(['PAID-b', 'PAID-c']);
  });

  it('does not treat a newly-approved, not-yet-submitted pattern as underperforming when threshold is negative (opt-out)', () => {
    const result = underperformingApproved(['PAID-new'], [], -1);
    expect(result).toEqual([]);
  });
});
