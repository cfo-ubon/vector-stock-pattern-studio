import { describe, it, expect } from 'vitest';
import { generateBatchSeo } from './batchSeoService';
import type { PatternSeoRequest } from './batchSeoService';
import { listSeoProfiles } from './seoProfile';

// Build 016 — "Large dataset" required test category. 400 patterns x 5
// built-in marketplaces = 2,000 generated SEO packages, each with a real
// validation report and score attached — large enough to exceed any
// accidental O(n^2) mistake's practical runtime, and consistent with the
// scale Build 015's own large-dataset test used.
describe('SEO Intelligence Engine — large dataset', () => {
  it('generates, validates, and scores 2,000 SEO packages correctly', () => {
    const patternCount = 400;
    const marketplaceIds = listSeoProfiles().map((p) => p.id);
    expect(marketplaceIds).toHaveLength(5);

    const requests: PatternSeoRequest[] = Array.from({ length: patternCount }, (_, i) => ({
      patternId: `PATTERN-${i}`,
      content: {
        title: `Seamless Pastel Floral Spring Pattern Number ${i} With Botanical Motifs`,
        description: `This is seamless floral pattern number ${i}, featuring a soft pastel spring feel that works beautifully on fabric and wallpaper.`,
        keywords: ['seamless', 'floral', 'pastel', 'fabric', 'wallpaper', 'spring', 'botanical', `variant${i}`],
      },
    }));

    const start = performance.now();
    const results = generateBatchSeo(requests, marketplaceIds);
    const durationMs = performance.now() - start;

    expect(results).toHaveLength(patternCount * marketplaceIds.length); // 2,000
    expect(durationMs).toBeLessThan(10000);

    // Every result has a real, in-range score and a real validation
    // report — spot-checked exhaustively across all 2,000, not sampled.
    for (const result of results) {
      expect(result.package.score.overall).toBeGreaterThanOrEqual(0);
      expect(result.package.score.overall).toBeLessThanOrEqual(100);
      expect(typeof result.package.validation.valid).toBe('boolean');
    }

    // Marketplace-specific generation held at scale: every marketplace
    // got exactly one package per pattern, and every package is tagged
    // with the marketplace it was actually generated for.
    for (const marketplaceId of marketplaceIds) {
      const forMarketplace = results.filter((r) => r.marketplaceId === marketplaceId);
      expect(forMarketplace).toHaveLength(patternCount);
      expect(forMarketplace.every((r) => r.package.marketplaceId === marketplaceId)).toBe(true);
    }

    // Etsy's tight 13-keyword cap held for every one of its 400 packages.
    const etsyResults = results.filter((r) => r.marketplaceId === 'etsy');
    expect(etsyResults.every((r) => r.package.keywords.length <= 13)).toBe(true);

    // Spot-check pattern identity is preserved end to end for a sample.
    const sample = results.find((r) => r.patternId === 'PATTERN-137' && r.marketplaceId === 'shutterstock')!;
    expect(sample.package.title).toContain('137');
  }, 30000);
});
