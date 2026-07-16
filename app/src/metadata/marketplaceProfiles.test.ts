import { describe, it, expect } from 'vitest';
import { MARKETPLACE_PROFILES, MARKETPLACE_LIST, resolveMarketplaceCategory } from './marketplaceProfiles';
import { STOCK_SITES } from './shutterstock';
import { MARKETPLACE_DATA } from '../marketplaces';
import { validateMarketplaceProfileData } from '../validators';

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

describe('marketplaceProfiles: Marketplace Intelligence Engine Phase 5, Section 9 ("no hardcoded marketplace logic")', () => {
  it('MARKETPLACE_PROFILES is built from the real editable JSON under src/marketplaces/, not a second hardcoded copy', () => {
    expect(MARKETPLACE_LIST.length).toBe(MARKETPLACE_DATA.length);
    for (const data of MARKETPLACE_DATA) {
      const profile = MARKETPLACE_PROFILES[data.id as keyof typeof MARKETPLACE_PROFILES];
      expect(profile.label).toBe(data.label);
      expect(profile.titleRules).toEqual(data.titleRules);
      expect(profile.contributorUrl).toBe(data.links.portal.url);
      expect(profile.contributorUrlVerified).toBe(data.links.portal.verified);
    }
  });

  it('every marketplace JSON file passes its own JSON Schema', () => {
    for (const data of MARKETPLACE_DATA) {
      const issues = validateMarketplaceProfileData(data);
      expect(issues, JSON.stringify(issues)).toEqual([]);
    }
  });
});

describe('marketplaceProfiles: Section 6, Contributor Center (6 link types)', () => {
  it('every profile defines all 6 named link types with a real url + verified flag', () => {
    for (const profile of MARKETPLACE_LIST) {
      for (const key of ['portal', 'submission', 'analytics', 'help', 'guidelines', 'support'] as const) {
        expect(profile.links[key].url.length, `${profile.id}.${key}`).toBeGreaterThan(0);
        expect(typeof profile.links[key].verified).toBe('boolean');
      }
    }
  });
});

describe('marketplaceProfiles: Section 2, Collection Naming / Supported File Types / Preview Requirements', () => {
  it('every profile defines collectionNamingRules with a real template + maxLength', () => {
    for (const profile of MARKETPLACE_LIST) {
      expect(profile.collectionNamingRules.template).toContain('{primaryKeyword}');
      expect(profile.collectionNamingRules.maxLength).toBeGreaterThan(0);
    }
  });

  it('every profile lists at least svg and eps among its supported file types', () => {
    for (const profile of MARKETPLACE_LIST) {
      expect(profile.supportedFileTypes).toContain('svg');
      expect(profile.supportedFileTypes).toContain('eps');
    }
  });

  it('every profile defines real, positive preview dimension requirements', () => {
    for (const profile of MARKETPLACE_LIST) {
      expect(profile.previewRequirements.minWidth).toBeGreaterThan(0);
      expect(profile.previewRequirements.minHeight).toBeGreaterThan(0);
      expect(profile.previewRequirements.notes.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveMarketplaceCategory (Section 2, Category Mapping)', () => {
  it('Shutterstock resolves a real, verified per-category mapping (ported from shutterstock.ts)', () => {
    expect(resolveMarketplaceCategory(MARKETPLACE_PROFILES.shutterstock, 'botanical')).toBe('Nature');
    expect(resolveMarketplaceCategory(MARKETPLACE_PROFILES.shutterstock, 'mandala')).toBe('Arts');
  });

  it('falls back to defaultCategory for a marketplace with no categoryMapping', () => {
    expect(MARKETPLACE_PROFILES.adobestock.categoryMapping).toBeUndefined();
    expect(resolveMarketplaceCategory(MARKETPLACE_PROFILES.adobestock, 'botanical')).toBe(MARKETPLACE_PROFILES.adobestock.defaultCategory);
  });

  it('falls back to defaultCategory for an engine category not in the mapping, even for Shutterstock', () => {
    expect(resolveMarketplaceCategory(MARKETPLACE_PROFILES.shutterstock, 'not-a-real-category')).toBe(MARKETPLACE_PROFILES.shutterstock.defaultCategory);
  });
});
