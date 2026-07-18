import { describe, it, expect } from 'vitest';
import { generatePatternSeo, generatePatternSeoForMarketplaces, generateBatchSeo } from './batchSeoService';
import { listSeoProfiles } from './seoProfile';

const REQUEST = {
  patternId: 'VSP-20260718-ABCDEF',
  content: {
    title: 'Seamless Pastel Floral Spring Pattern With Botanical Motifs',
    description: 'This seamless floral pattern brings a soft, pastel spring feel to any project. It works beautifully on fabric and wallpaper.',
    keywords: ['seamless', 'floral', 'pastel', 'fabric', 'wallpaper', 'spring', 'botanical', 'vector', 'editable'],
  },
};

describe('generatePatternSeo — single pattern, single marketplace', () => {
  it('carries the pattern id and marketplace id alongside the generated package', () => {
    const result = generatePatternSeo(REQUEST, 'shutterstock');
    expect(result.patternId).toBe(REQUEST.patternId);
    expect(result.marketplaceId).toBe('shutterstock');
    expect(result.package.marketplaceId).toBe('shutterstock');
  });
});

describe('generatePatternSeoForMarketplaces — single pattern, multiple marketplaces', () => {
  it('defaults to every registered marketplace when none are specified', () => {
    const results = generatePatternSeoForMarketplaces(REQUEST);
    expect(results).toHaveLength(listSeoProfiles().length);
    expect(results.map((r) => r.marketplaceId).sort()).toEqual(listSeoProfiles().map((p) => p.id).sort());
  });

  it('generates for exactly the requested subset when marketplaceIds is given', () => {
    const results = generatePatternSeoForMarketplaces(REQUEST, ['etsy', 'shutterstock']);
    expect(results.map((r) => r.marketplaceId).sort()).toEqual(['etsy', 'shutterstock']);
  });

  it('every result carries the same patternId', () => {
    const results = generatePatternSeoForMarketplaces(REQUEST, ['etsy', 'shutterstock', 'freepik']);
    expect(results.every((r) => r.patternId === REQUEST.patternId)).toBe(true);
  });
});

describe('generateBatchSeo — multiple patterns, multiple marketplaces', () => {
  it('produces the full cross product of patterns x marketplaces', () => {
    const requests = [REQUEST, { patternId: 'VSP-20260718-ZZZZZZ', content: REQUEST.content }];
    const marketplaceIds = ['etsy', 'shutterstock', 'freepik'];
    const results = generateBatchSeo(requests, marketplaceIds);
    expect(results).toHaveLength(requests.length * marketplaceIds.length);
    for (const request of requests) {
      for (const marketplaceId of marketplaceIds) {
        expect(results.some((r) => r.patternId === request.patternId && r.marketplaceId === marketplaceId)).toBe(true);
      }
    }
  });

  it('one pattern\'s content never influences another\'s result', () => {
    const distinctiveRequest = { patternId: 'distinctive', content: { title: 'Totally Unique Distinctive Title Words Here', description: '', keywords: ['unique-marker-keyword'] } };
    const results = generateBatchSeo([REQUEST, distinctiveRequest], ['shutterstock']);
    const forOriginal = results.find((r) => r.patternId === REQUEST.patternId)!;
    const forDistinctive = results.find((r) => r.patternId === 'distinctive')!;
    expect(forOriginal.package.keywords).not.toContain('unique-marker-keyword');
    expect(forDistinctive.package.title).toContain('Distinctive');
  });

  it('returns an empty array for an empty request list', () => {
    expect(generateBatchSeo([], ['shutterstock'])).toEqual([]);
  });
});
