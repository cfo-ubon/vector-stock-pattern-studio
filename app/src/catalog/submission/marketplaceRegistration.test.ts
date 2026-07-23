import { describe, it, expect } from 'vitest';
import {
  createMarketplaceRegistration,
  normalizeMarketplaceRegistration,
  isValidMarketplaceRegistration,
  InvalidMarketplaceRegistrationInputError,
} from './marketplaceRegistration';

describe('createMarketplaceRegistration', () => {
  it('creates a registration with defaults', () => {
    const reg = createMarketplaceRegistration({ marketplaceId: 'etsy', now: 1000 });
    expect(reg.marketplaceId).toBe('etsy');
    expect(reg.contributorAccountLabel).toBe('');
    expect(reg.notes).toBe('');
    expect(reg.createdAt).toBe(1000);
  });

  it('rejects an empty marketplaceId', () => {
    expect(() => createMarketplaceRegistration({ marketplaceId: '  ' })).toThrow(InvalidMarketplaceRegistrationInputError);
  });

  it('never has a password/token/apiKey field -- the domain type literally cannot carry one', () => {
    const reg = createMarketplaceRegistration({ marketplaceId: 'etsy', contributorAccountLabel: 'My Etsy Shop' });
    expect(Object.keys(reg).some((k) => /password|token|apikey|secret/i.test(k))).toBe(false);
  });
});

describe('normalizeMarketplaceRegistration', () => {
  it('defaults missing optional fields for a legacy-shaped record', () => {
    const bare = { id: 'MREG-1', marketplaceId: 'etsy', createdAt: 1, updatedAt: 1 } as unknown as Parameters<typeof normalizeMarketplaceRegistration>[0];
    const normalized = normalizeMarketplaceRegistration(bare);
    expect(normalized.contributorAccountLabel).toBe('');
    expect(normalized.notes).toBe('');
  });
});

describe('isValidMarketplaceRegistration', () => {
  it('validates a real record and rejects a malformed one', () => {
    expect(isValidMarketplaceRegistration(createMarketplaceRegistration({ marketplaceId: 'etsy' }))).toBe(true);
    expect(isValidMarketplaceRegistration({})).toBe(false);
    expect(isValidMarketplaceRegistration(null)).toBe(false);
  });
});
