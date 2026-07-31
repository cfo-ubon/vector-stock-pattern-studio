import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketingDesignHandoff } from '../domain/marketingDesignHandoff';
import {
  loadMarketingDesignHandoffs,
  getMarketingDesignHandoff,
  getMarketingDesignHandoffsByOpportunityId,
  putMarketingDesignHandoff,
  deleteMarketingDesignHandoff,
  clearMarketingDesignHandoffs,
} from './marketingDesignHandoffStore';

beforeEach(async () => {
  await clearMarketingDesignHandoffs();
});

function makeHandoff(overrides: Partial<Parameters<typeof createMarketingDesignHandoff>[0]> = {}) {
  return createMarketingDesignHandoff({ recommendedTheme: 'spring florals', now: 1000, ...overrides });
}

describe('marketingDesignHandoffStore', () => {
  it('persists and retrieves a handoff', async () => {
    const handoff = makeHandoff();
    await putMarketingDesignHandoff(handoff);
    expect(await getMarketingDesignHandoff(handoff.id)).toEqual(handoff);
  });

  it('deletes a handoff', async () => {
    const handoff = makeHandoff();
    await putMarketingDesignHandoff(handoff);
    await deleteMarketingDesignHandoff(handoff.id);
    expect(await getMarketingDesignHandoff(handoff.id)).toBeUndefined();
  });

  it('loads all handoffs', async () => {
    await putMarketingDesignHandoff(makeHandoff());
    await putMarketingDesignHandoff(makeHandoff({ recommendedTheme: 'another theme' }));
    expect(await loadMarketingDesignHandoffs()).toHaveLength(2);
  });

  it('getMarketingDesignHandoffsByOpportunityId returns only matching records, newest first', async () => {
    const a = makeHandoff({ marketOpportunityId: 'OPP-A', now: 1 });
    const b = makeHandoff({ marketOpportunityId: 'OPP-A', now: 2 });
    const c = makeHandoff({ marketOpportunityId: 'OPP-B', now: 3 });
    await putMarketingDesignHandoff(a);
    await putMarketingDesignHandoff(b);
    await putMarketingDesignHandoff(c);

    const results = await getMarketingDesignHandoffsByOpportunityId('OPP-A');
    expect(results.map((h) => h.id).sort()).toEqual([a.id, b.id].sort());
    expect(results.every((h) => h.marketOpportunityId === 'OPP-A')).toBe(true);
  });

  it('getMarketingDesignHandoffsByOpportunityId returns [] when no handoff references that opportunity', async () => {
    await putMarketingDesignHandoff(makeHandoff({ marketOpportunityId: 'OPP-A' }));
    expect(await getMarketingDesignHandoffsByOpportunityId('OPP-DOES-NOT-EXIST')).toEqual([]);
  });
});
