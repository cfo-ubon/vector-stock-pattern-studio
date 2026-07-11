import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import { buildTileFromDesignSpec } from './designSpecToParams';
import {
  blendKeywordIntoTitle,
  blendKeywordsIntoList,
  buildDesignSpecCollectionName,
  buildDesignSpecAssetName,
  buildDesignSpecSeo,
  buildAllDesignSpecSeo,
} from './designSpecSeo';
import { MARKETPLACE_PROFILES } from '../metadata/marketplaceProfiles';
import { validateMarketplaceSeo, isMarketplaceReady } from '../metadata/marketplaceValidation';
import type { KeywordBundle } from './designSpecTypes';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Spring', 'Muted Green', 'Editorial'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

describe('blendKeywordIntoTitle', () => {
  it('front-loads the primary keyword when not already present', () => {
    const result = blendKeywordIntoTitle('Seamless Vector Pattern for Fabric', 'Luxury Botanical', 100);
    expect(result.startsWith('Luxury Botanical')).toBe(true);
    expect(result).toContain('Seamless Vector Pattern');
  });

  it('leaves the title untouched when the keyword is already present (case-insensitive)', () => {
    const title = 'LUXURY BOTANICAL Seamless Vector Pattern';
    expect(blendKeywordIntoTitle(title, 'luxury botanical', 100)).toBe(title);
  });

  it('never exceeds maxLength', () => {
    const result = blendKeywordIntoTitle('A very long generated title that goes on and on about fabric and wallpaper patterns', 'Luxury Botanical', 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toContain('Luxury Botanical');
  });

  it('handles an empty primary keyword as a no-op', () => {
    expect(blendKeywordIntoTitle('Base Title', '', 100)).toBe('Base Title');
  });

  it('falls back to just the (truncated) keyword when there is no room for anything else', () => {
    const result = blendKeywordIntoTitle('Some base title', 'A Genuinely Very Long Primary Keyword Phrase Here', 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

describe('blendKeywordsIntoList', () => {
  it('puts bundle keywords first, then fills with base keywords, deduped', () => {
    const result = blendKeywordsIntoList(['botanical', 'seamless', 'luxury'], ['Luxury', 'Editorial'], 10);
    expect(result[0]).toBe('Luxury');
    expect(result[1]).toBe('Editorial');
    // "luxury" from baseKeywords is a case-insensitive duplicate of "Luxury" and dropped
    expect(result.filter((k) => k.toLowerCase() === 'luxury').length).toBe(1);
  });

  it('respects maxCount', () => {
    const result = blendKeywordsIntoList(['a', 'b', 'c', 'd', 'e'], ['x', 'y'], 3);
    expect(result.length).toBe(3);
  });

  it('drops any keyword longer than maxKeywordLength (Etsy tag cap)', () => {
    const result = blendKeywordsIntoList(['short', 'a-very-long-keyword-that-exceeds-the-cap'], ['ok'], 10, 20);
    expect(result).not.toContain('a-very-long-keyword-that-exceeds-the-cap');
    expect(result).toContain('short');
    expect(result).toContain('ok');
  });

  it('ignores empty/whitespace-only entries', () => {
    const result = blendKeywordsIntoList(['real', '  ', ''], ['', 'also-real'], 10);
    expect(result).toEqual(['also-real', 'real']);
  });
});

describe('buildDesignSpecCollectionName / buildDesignSpecAssetName', () => {
  it('includes the primary keyword and the Trend Pack theme when one is attached', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const name = buildDesignSpecCollectionName(spec);
    expect(name).toContain('Luxury Botanical');
    expect(name).toContain(spec.trend!.theme);
  });

  it('falls back to just "{keyword} Collection" when no trend is attached', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: 'not-real', createdAt: 1000 });
    expect(buildDesignSpecCollectionName(spec)).toBe('Luxury Botanical Collection');
  });

  it('asset name combines the primary keyword with the asset label', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    expect(buildDesignSpecAssetName(spec, 'Border Pattern (top)')).toBe('Luxury Botanical Border Pattern (top)');
  });
});

describe('buildDesignSpecSeo: market-driven per-marketplace SEO', () => {
  it('produces a title that surfaces the primary keyword, for every marketplace', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-seo');
    for (const marketplaceId of Object.keys(MARKETPLACE_PROFILES) as Array<keyof typeof MARKETPLACE_PROFILES>) {
      const seo = buildDesignSpecSeo(spec, tile, marketplaceId);
      expect(seo.title.toLowerCase(), marketplaceId).toContain('luxury botanical');
      expect(seo.title.length, marketplaceId).toBeLessThanOrEqual(MARKETPLACE_PROFILES[marketplaceId].titleRules.maxLength);
    }
  });

  it('front-loads secondary keywords into the keyword list', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-kw');
    const seo = buildDesignSpecSeo(spec, tile, 'shutterstock');
    expect(seo.keywords[0].toLowerCase()).toBe('luxury botanical');
    expect(seo.keywords.some((k) => k.toLowerCase() === 'wallpaper')).toBe(true);
  });

  it('the filename includes a slug of the primary keyword', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-fn');
    const seo = buildDesignSpecSeo(spec, tile, 'shutterstock');
    expect(seo.filename.startsWith('luxury-botanical-')).toBe(true);
    expect(seo.filename).toMatch(/\.eps$/);
  });

  it('every marketplace\'s result passes that marketplace\'s own validation rules', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-valid');
    for (const [marketplaceId, seo] of Object.entries(buildAllDesignSpecSeo(spec, tile))) {
      const issues = validateMarketplaceSeo(seo, MARKETPLACE_PROFILES[marketplaceId as keyof typeof MARKETPLACE_PROFILES]);
      expect(isMarketplaceReady(issues), `${marketplaceId}: ${JSON.stringify(issues)}`).toBe(true);
    }
  });

  it('leaves description empty for a marketplace with no description field (e.g. Adobe Stock)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-no-desc');
    const seo = buildDesignSpecSeo(spec, tile, 'adobestock');
    expect(seo.description).toBe('');
  });

  it('carries collectionName and assetName alongside the standard MarketplaceSeo fields', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-names');
    const seo = buildDesignSpecSeo(spec, tile, 'shutterstock', 'Secondary Pattern');
    expect(seo.collectionName.length).toBeGreaterThan(0);
    expect(seo.assetName).toBe('Luxury Botanical Secondary Pattern');
  });

  it('is fully deterministic for the same spec + tile + marketplace', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-det');
    const a = buildDesignSpecSeo(spec, tile, 'shutterstock');
    const b = buildDesignSpecSeo(spec, tile, 'shutterstock');
    expect(a).toEqual(b);
  });

  it('buildAllDesignSpecSeo covers every marketplace, keyed by id', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-all');
    const all = buildAllDesignSpecSeo(spec, tile);
    expect(Object.keys(all).sort()).toEqual(Object.keys(MARKETPLACE_PROFILES).sort());
  });
});
