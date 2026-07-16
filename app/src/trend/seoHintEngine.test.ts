import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import { buildSeoHints, buildAllSeoHints } from './seoHintEngine';
import { MARKETPLACE_PROFILES, resolveMarketplaceCategory } from '../metadata/marketplaceProfiles';
import type { KeywordBundle } from './designSpecTypes';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Spring', 'Muted Green', 'Editorial'],
    marketplace: 'shutterstock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'simple',
    collectionSize: 8,
    ...overrides,
  };
}

describe('buildSeoHints (Section 4, SEO Hint Engine)', () => {
  it('runs from a Design Specification alone — no TileData required', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    // The mere fact this compiles/runs without ever building a tile proves
    // the "before generation" requirement — no buildTile call anywhere above.
    const hints = buildSeoHints(spec, 'shutterstock');
    expect(hints.marketplaceId).toBe('shutterstock');
  });

  it('title/description/keyword targets are exact 1:1 reads of the real marketplace profile', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'shutterstock');
    const profile = MARKETPLACE_PROFILES.shutterstock;
    expect(hints.titleTarget).toEqual({ minLength: profile.titleRules.minLength, maxLength: profile.titleRules.maxLength });
    expect(hints.keywordCountTarget).toEqual({ minCount: profile.keywordRules.minCount, maxCount: profile.keywordRules.maxCount, termLabel: profile.keywordRules.termLabel });
  });

  it('descriptionTarget is null for a marketplace with no description field (Adobe Stock)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'adobestock');
    expect(hints.descriptionTarget).toBeNull();
  });

  it('keyword candidates include the real primary/secondary keywords from the Keyword Bundle', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'shutterstock');
    const lower = hints.keywordCandidates.map((k) => k.toLowerCase());
    expect(lower).toContain('luxury botanical');
    expect(lower).toContain('wallpaper');
  });

  it('keyword candidates never include a duplicate (case-insensitive)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'shutterstock');
    const lower = hints.keywordCandidates.map((k) => k.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('is a candidate pool, not a final trimmed list — larger than the marketplace\'s own required count', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'shutterstock');
    expect(hints.keywordCandidates.length).toBeGreaterThan(hints.keywordCountTarget.minCount);
  });

  it('categorySuggestion matches resolveMarketplaceCategory for the same inputs', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'shutterstock');
    expect(hints.categorySuggestion).toBe(resolveMarketplaceCategory(MARKETPLACE_PROFILES.shutterstock, 'botanical'));
  });

  it('collectionNameSuggestion is built from the profile\'s own naming template and stays within its maxLength', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'shutterstock');
    expect(hints.collectionNameSuggestion).toContain('Luxury Botanical');
    expect(hints.collectionNameSuggestion.length).toBeLessThanOrEqual(MARKETPLACE_PROFILES.shutterstock.collectionNamingRules.maxLength);
  });

  it('flags the future-ready marketplace with an honest hint', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const hints = buildSeoHints(spec, 'etsy');
    expect(hints.hints.some((h) => h.code === 'futureMarketplace')).toBe(true);
  });

  it('is deterministic for the same spec + marketplace', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    expect(buildSeoHints(spec, 'shutterstock')).toEqual(buildSeoHints(spec, 'shutterstock'));
  });
});

describe('buildAllSeoHints', () => {
  it('returns real hints for every marketplace', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const all = buildAllSeoHints(spec);
    for (const profile of Object.values(MARKETPLACE_PROFILES)) {
      expect(all[profile.id].marketplaceId).toBe(profile.id);
    }
  });
});
