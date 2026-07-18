import { describe, it, expect, afterEach } from 'vitest';
import {
  BUILT_IN_MARKETPLACE_PROFILES,
  registerMarketplaceProfile,
  getMarketplaceProfile,
  isKnownMarketplace,
  listMarketplaceProfiles,
  resetMarketplaceProfileRegistry,
  DuplicateMarketplaceProfileError,
} from './marketplaceProfile';

afterEach(() => {
  resetMarketplaceProfileRegistry();
});

describe('built-in marketplace profiles', () => {
  it('ships exactly the 5 required marketplaces', () => {
    const ids = BUILT_IN_MARKETPLACE_PROFILES.map((p) => p.id).sort();
    expect(ids).toEqual(['adobestock', 'etsy', 'freepik', 'gettyimages', 'shutterstock']);
  });

  it('every built-in is marked builtin: true and resolves via getMarketplaceProfile', () => {
    for (const profile of BUILT_IN_MARKETPLACE_PROFILES) {
      expect(profile.builtin).toBe(true);
      expect(getMarketplaceProfile(profile.id)).toEqual(profile);
    }
  });

  it('isKnownMarketplace is true for built-ins, false for unknown ids', () => {
    expect(isKnownMarketplace('shutterstock')).toBe(true);
    expect(isKnownMarketplace('not-a-real-marketplace')).toBe(false);
  });
});

describe('registerMarketplaceProfile — future marketplaces without code changes', () => {
  it('adds a new marketplace at runtime, immediately visible to every lookup', () => {
    registerMarketplaceProfile({ id: 'redbubble', label: 'Redbubble', builtin: false, minKeywords: 5, maxKeywords: 30, requiresDescription: false, requiresCategory: false });
    expect(isKnownMarketplace('redbubble')).toBe(true);
    expect(getMarketplaceProfile('redbubble')?.label).toBe('Redbubble');
    expect(listMarketplaceProfiles().some((p) => p.id === 'redbubble')).toBe(true);
  });

  it('rejects re-registering an existing id, including a built-in', () => {
    expect(() =>
      registerMarketplaceProfile({ id: 'shutterstock', label: 'Different', builtin: false, minKeywords: 1, maxKeywords: 1, requiresDescription: false, requiresCategory: false }),
    ).toThrow(DuplicateMarketplaceProfileError);

    registerMarketplaceProfile({ id: 'redbubble', label: 'Redbubble', builtin: false, minKeywords: 5, maxKeywords: 30, requiresDescription: false, requiresCategory: false });
    expect(() =>
      registerMarketplaceProfile({ id: 'redbubble', label: 'Again', builtin: false, minKeywords: 1, maxKeywords: 1, requiresDescription: false, requiresCategory: false }),
    ).toThrow(DuplicateMarketplaceProfileError);
  });
});

describe('resetMarketplaceProfileRegistry', () => {
  it('clears runtime-registered profiles and restores exactly the built-ins', () => {
    registerMarketplaceProfile({ id: 'redbubble', label: 'Redbubble', builtin: false, minKeywords: 5, maxKeywords: 30, requiresDescription: false, requiresCategory: false });
    expect(isKnownMarketplace('redbubble')).toBe(true);
    resetMarketplaceProfileRegistry();
    expect(isKnownMarketplace('redbubble')).toBe(false);
    expect(listMarketplaceProfiles()).toEqual(BUILT_IN_MARKETPLACE_PROFILES);
  });
});
