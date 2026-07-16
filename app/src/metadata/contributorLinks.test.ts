import { describe, it, expect } from 'vitest';
import { CONTRIBUTOR_LINKS, MARKETPLACE_LINK_SETS, CONTRIBUTOR_LINK_TYPES } from './contributorLinks';
import { MARKETPLACE_LIST } from './marketplaceProfiles';

describe('CONTRIBUTOR_LINKS (backward-compatible single-URL list)', () => {
  it('has one entry per marketplace, matching MARKETPLACE_LIST', () => {
    expect(CONTRIBUTOR_LINKS.length).toBe(MARKETPLACE_LIST.length);
    for (const profile of MARKETPLACE_LIST) {
      const link = CONTRIBUTOR_LINKS.find((l) => l.id === profile.id);
      expect(link, profile.id).toBeDefined();
      expect(link!.url).toBe(profile.links.portal.url);
      expect(link!.verified).toBe(profile.links.portal.verified);
      expect(link!.label).toBe(`${profile.label} Contributor`);
    }
  });
});

describe('MARKETPLACE_LINK_SETS (Section 6, full 6-link set)', () => {
  it('has one entry per marketplace with all 6 real link types', () => {
    expect(MARKETPLACE_LINK_SETS.length).toBe(MARKETPLACE_LIST.length);
    for (const set of MARKETPLACE_LINK_SETS) {
      for (const key of ['portal', 'submission', 'analytics', 'help', 'guidelines', 'support'] as const) {
        expect(set.links[key].url.length, `${set.id}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('matches the same profile data CONTRIBUTOR_LINKS derives from (single source of truth)', () => {
    for (const set of MARKETPLACE_LINK_SETS) {
      const profile = MARKETPLACE_LIST.find((p) => p.id === set.id)!;
      expect(set.links).toEqual(profile.links);
    }
  });
});

describe('CONTRIBUTOR_LINK_TYPES', () => {
  it('names exactly the 6 link types in display order', () => {
    expect(CONTRIBUTOR_LINK_TYPES.map((t) => t.key)).toEqual(['portal', 'submission', 'analytics', 'help', 'guidelines', 'support']);
  });
});
