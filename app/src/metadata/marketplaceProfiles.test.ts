import { describe, it, expect } from 'vitest';
import { MARKETPLACE_PROFILES, MARKETPLACE_LIST } from './marketplaceProfiles';
import { STOCK_SITES } from './shutterstock';

describe('marketplaceProfiles: profile selection', () => {
  it('defines exactly the 6 supported marketplaces (5 live + Etsy future-ready)', () => {
    const ids = MARKETPLACE_LIST.map((p) => p.id).sort();
    expect(ids).toEqual(['adobestock', 'creativefabrica', 'creativemarket', 'etsy', 'freepik', 'shutterstock'].sort());
  });

  it('every profile in STOCK_SITES (the app-wide marketplace registry) has a matching config profile', () => {
    for (const site of STOCK_SITES) {
      expect(MARKETPLACE_PROFILES[site.id], `missing profile for ${site.id}`).toBeDefined();
      expect(MARKETPLACE_PROFILES[site.id].label).toBe(site.label);
    }
  });

  it('only Etsy is marked future-ready — every other marketplace is live', () => {
    for (const profile of MARKETPLACE_LIST) {
      expect(profile.future).toBe(profile.id === 'etsy');
    }
  });

  it('every profile defines every required rule category (Title/Description/Keyword/Filename/Category/Export Package)', () => {
    for (const profile of MARKETPLACE_LIST) {
      expect(profile.titleRules.maxLength).toBeGreaterThan(0);
      expect(profile.descriptionRules).toBeDefined();
      expect(profile.keywordRules.maxCount).toBeGreaterThan(0);
      expect(profile.filenameRules.template.length).toBeGreaterThan(0);
      expect(profile.defaultCategory.length).toBeGreaterThan(0);
      expect(profile.exportPackageFiles.length).toBeGreaterThan(0);
    }
  });

  it('an unverified contributor URL is never presented as verified (never guess a live URL as confirmed)', () => {
    // Only Adobe Stock and Shutterstock have long-stable, confidently-known
    // contributor URLs — every other marketplace (including Etsy) must stay
    // unverified until a human confirms the exact deep link.
    expect(MARKETPLACE_PROFILES.adobestock.contributorUrlVerified).toBe(true);
    expect(MARKETPLACE_PROFILES.shutterstock.contributorUrlVerified).toBe(true);
    for (const id of ['freepik', 'creativefabrica', 'creativemarket', 'etsy'] as const) {
      expect(MARKETPLACE_PROFILES[id].contributorUrlVerified, `${id} should be unverified`).toBe(false);
    }
  });

  it('Etsy keyword rules reflect its real "13 tags, 20 chars each" platform limit', () => {
    expect(MARKETPLACE_PROFILES.etsy.keywordRules.maxCount).toBe(13);
    expect(MARKETPLACE_PROFILES.etsy.keywordRules.maxKeywordLength).toBe(20);
    expect(MARKETPLACE_PROFILES.etsy.keywordRules.termLabel).toBe('tags');
  });

  it('backward compatibility: the 5 pre-existing marketplaces keep their original numeric limits', () => {
    expect(MARKETPLACE_PROFILES.shutterstock.titleRules.maxLength).toBe(200);
    expect(MARKETPLACE_PROFILES.shutterstock.keywordRules.maxCount).toBe(50);
    expect(MARKETPLACE_PROFILES.adobestock.titleRules.maxLength).toBe(70);
    expect(MARKETPLACE_PROFILES.adobestock.keywordRules.maxCount).toBe(49);
    expect(MARKETPLACE_PROFILES.freepik.titleRules.maxLength).toBe(100);
    expect(MARKETPLACE_PROFILES.freepik.keywordRules.maxCount).toBe(50);
    expect(MARKETPLACE_PROFILES.creativefabrica.titleRules.maxLength).toBe(150);
    expect(MARKETPLACE_PROFILES.creativefabrica.keywordRules.maxCount).toBe(20);
    expect(MARKETPLACE_PROFILES.creativemarket.titleRules.maxLength).toBe(150);
    expect(MARKETPLACE_PROFILES.creativemarket.keywordRules.maxCount).toBe(20);
  });
});
