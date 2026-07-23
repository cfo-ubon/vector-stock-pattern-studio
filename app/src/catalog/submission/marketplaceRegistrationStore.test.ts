import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketplaceRegistration } from './marketplaceRegistration';
import {
  loadMarketplaceRegistrations,
  putMarketplaceRegistration,
  deleteMarketplaceRegistration,
  clearMarketplaceRegistrations,
} from './marketplaceRegistrationStore';

beforeEach(async () => {
  await clearMarketplaceRegistrations();
});

describe('marketplaceRegistrationStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadMarketplaceRegistrations()).toEqual([]);
  });

  it('persists and retrieves a registration', async () => {
    const reg = createMarketplaceRegistration({ marketplaceId: 'etsy', contributorAccountLabel: 'My Shop' });
    await putMarketplaceRegistration(reg);
    expect(await loadMarketplaceRegistrations()).toEqual([reg]);
  });

  it('deletes a registration', async () => {
    const reg = createMarketplaceRegistration({ marketplaceId: 'etsy' });
    await putMarketplaceRegistration(reg);
    await deleteMarketplaceRegistration(reg.id);
    expect(await loadMarketplaceRegistrations()).toEqual([]);
  });

  it('clearMarketplaceRegistrations empties the store', async () => {
    await putMarketplaceRegistration(createMarketplaceRegistration({ marketplaceId: 'etsy' }));
    await putMarketplaceRegistration(createMarketplaceRegistration({ marketplaceId: 'shutterstock' }));
    await clearMarketplaceRegistrations();
    expect(await loadMarketplaceRegistrations()).toEqual([]);
  });
});
