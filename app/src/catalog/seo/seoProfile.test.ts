import { describe, it, expect, afterEach } from 'vitest';
import {
  BUILT_IN_SEO_PROFILES,
  registerSeoProfile,
  getSeoProfile,
  isKnownSeoMarketplace,
  listSeoProfiles,
  resetSeoProfileRegistry,
  DuplicateSeoProfileError,
} from './seoProfile';

afterEach(() => {
  resetSeoProfileRegistry();
});

describe('built-in SEO profiles', () => {
  it('ships exactly the 5 required marketplaces', () => {
    const ids = BUILT_IN_SEO_PROFILES.map((p) => p.id).sort();
    expect(ids).toEqual(['adobestock', 'etsy', 'freepik', 'gettyimages', 'shutterstock']);
  });

  it('every built-in is marked builtin: true and resolves via getSeoProfile', () => {
    for (const profile of BUILT_IN_SEO_PROFILES) {
      expect(profile.builtin).toBe(true);
      expect(getSeoProfile(profile.id)).toEqual(profile);
    }
  });

  it('every profile has internally consistent bounds (min <= max)', () => {
    for (const profile of BUILT_IN_SEO_PROFILES) {
      expect(profile.title.minLength).toBeLessThanOrEqual(profile.title.maxLength);
      expect(profile.keywords.minCount).toBeLessThanOrEqual(profile.keywords.maxCount);
      if (profile.description.maxLength > 0) expect(profile.description.minLength).toBeLessThanOrEqual(profile.description.maxLength);
    }
  });

  it('isKnownSeoMarketplace is true for built-ins, false for unknown ids', () => {
    expect(isKnownSeoMarketplace('etsy')).toBe(true);
    expect(isKnownSeoMarketplace('not-a-real-marketplace')).toBe(false);
  });
});

describe('registerSeoProfile — new marketplaces without changing the engine', () => {
  it('adds a new marketplace at runtime, immediately visible to every lookup', () => {
    registerSeoProfile({ id: 'redbubble', label: 'Redbubble', builtin: false, title: { minLength: 5, maxLength: 100 }, description: { required: false, minLength: 0, maxLength: 200 }, keywords: { minCount: 3, maxCount: 30, maxKeywordLength: 40 } });
    expect(isKnownSeoMarketplace('redbubble')).toBe(true);
    expect(getSeoProfile('redbubble')?.label).toBe('Redbubble');
    expect(listSeoProfiles().some((p) => p.id === 'redbubble')).toBe(true);
  });

  it('rejects re-registering an existing id, including a built-in', () => {
    expect(() =>
      registerSeoProfile({ id: 'etsy', label: 'Different', builtin: false, title: { minLength: 1, maxLength: 1 }, description: { required: false, minLength: 0, maxLength: 1 }, keywords: { minCount: 1, maxCount: 1, maxKeywordLength: 1 } }),
    ).toThrow(DuplicateSeoProfileError);
  });
});

describe('resetSeoProfileRegistry', () => {
  it('clears runtime-registered profiles and restores exactly the built-ins', () => {
    registerSeoProfile({ id: 'redbubble', label: 'Redbubble', builtin: false, title: { minLength: 5, maxLength: 100 }, description: { required: false, minLength: 0, maxLength: 200 }, keywords: { minCount: 3, maxCount: 30, maxKeywordLength: 40 } });
    resetSeoProfileRegistry();
    expect(isKnownSeoMarketplace('redbubble')).toBe(false);
    expect(listSeoProfiles()).toEqual(BUILT_IN_SEO_PROFILES);
  });
});
