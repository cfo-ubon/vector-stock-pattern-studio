import { describe, it, expect } from 'vitest';
import { listStyleKnowledge } from '../style';
import { DEFAULT_LEARNING_HISTORY, recordStyleDnaUsage, type LearningHistory } from '../history';
import { TREND_PACK_LIST } from '../../trend/trendPacks';
import {
  recommendStyleDna,
  recommendPalettesForStyle,
  recommendMotifFamiliesForStyle,
  recommendMarketplacesForStyle,
  recommendProductUses,
  recommendTrendPack,
  recommendQualityImprovements,
} from './index';

describe('knowledge/recommendation: recommendStyleDna', () => {
  it('with no context, returns every real Style DNA', () => {
    expect(recommendStyleDna().length).toBe(listStyleKnowledge().length);
  });

  it('with a marketplaceId, narrows to styles actually recommended for it', () => {
    const style = listStyleKnowledge()[0];
    const marketplaceId = style.recommendedMarketplaces[0] as never;
    const results = recommendStyleDna({ marketplaceId });
    for (const r of results) expect(r.recommendedMarketplaces).toContain(marketplaceId);
  });

  it('with a history, moves a frequently-used style to the front of the real candidate set', () => {
    const target = listStyleKnowledge()[listStyleKnowledge().length - 1];
    let history: LearningHistory = DEFAULT_LEARNING_HISTORY;
    for (let i = 0; i < 5; i++) history = recordStyleDnaUsage(history, target.id);

    const results = recommendStyleDna({ history });
    expect(results.length).toBe(listStyleKnowledge().length);
    expect(results[0].id).toBe(target.id);
  });
});

describe('knowledge/recommendation: per-style palette/motif recommendations', () => {
  it('recommendPalettesForStyle with no history returns the style\'s own real preferred order', () => {
    const style = listStyleKnowledge()[0];
    expect(recommendPalettesForStyle(style)).toEqual(style.preferredPalettes);
  });

  it('recommendPalettesForStyle promotes a frequently-used real palette to the front', () => {
    const style = listStyleKnowledge().find((s) => s.preferredPalettes.length > 1)!;
    const target = style.preferredPalettes[style.preferredPalettes.length - 1];
    const history = recordStyleDnaUsage(DEFAULT_LEARNING_HISTORY, 'irrelevant');
    const withFrequentPalette = { ...history, paletteUsage: { [target]: 3 } };
    const results = recommendPalettesForStyle(style, withFrequentPalette);
    expect(results[0]).toBe(target);
    expect(results.sort()).toEqual([...style.preferredPalettes].sort());
  });

  it('recommendMotifFamiliesForStyle with no history returns the style\'s own real preferred order', () => {
    const style = listStyleKnowledge()[0];
    expect(recommendMotifFamiliesForStyle(style)).toEqual(style.preferredMotifFamilies);
  });
});

describe('knowledge/recommendation: recommendMarketplacesForStyle', () => {
  it('returns the real exportRecommendation.recommendedSites for a known style', () => {
    const style = listStyleKnowledge()[0];
    expect(recommendMarketplacesForStyle(style.id)).toEqual(style.recommendedMarketplaces);
  });

  it('returns [] for an unknown style id', () => {
    expect(recommendMarketplacesForStyle('not-a-real-style')).toEqual([]);
  });
});

describe('knowledge/recommendation: recommendProductUses', () => {
  it('composes the real Product Targets recommender', () => {
    const { evaluations, recommended } = recommendProductUses({ categoryId: 'botanical', tileSize: 1400, density: 0.5, keywordText: 'wallpaper' }, 3);
    expect(evaluations.length).toBe(10);
    expect(recommended.length).toBeLessThanOrEqual(3);
  });
});

describe('knowledge/recommendation: recommendTrendPack (Auto-match)', () => {
  it('an explicit trendPackId always wins', () => {
    const pack = TREND_PACK_LIST[0];
    const result = recommendTrendPack(pack.id, { primaryKeyword: '', secondaryKeywords: [], marketplace: 'adobestock', season: 'summer', audience: '', commercialCategory: '', patternType: 'botanical', paletteDirection: '', difficulty: 'moderate', collectionSize: 8 });
    expect(result?.id).toBe(pack.id);
  });

  it('matches the real real season when no explicit id is given', () => {
    const pack = TREND_PACK_LIST[0];
    const result = recommendTrendPack(undefined, { primaryKeyword: '', secondaryKeywords: [], marketplace: 'adobestock', season: pack.season, audience: '', commercialCategory: '', patternType: pack.patternTypes[0], paletteDirection: '', difficulty: 'moderate', collectionSize: 8 });
    expect(result?.season).toBe(pack.season);
  });
});

describe('knowledge/recommendation: recommendQualityImprovements', () => {
  it('wraps the real buildQualityRecommendations rule engine', () => {
    const report = {
      overall: 90, composition: 90, hierarchy: 90, overlap: 40, negativeSpace: 90, rhythm: 90,
      commercialReadiness: 90, flow: 90, balance: 90, repeatQuality: 90, svgHealth: 90, motifDiversity: 90,
    };
    const recommendations = recommendQualityImprovements(report);
    expect(recommendations.some((r) => r.toLowerCase().includes('overlap'))).toBe(true);
  });
});
