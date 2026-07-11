import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { TREND_PACK_LIST } from '../trend/trendPacks';
import { applyTrendPackToSpec } from './workbenchTrendPack';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper'],
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

describe('applyTrendPackToSpec', () => {
  it('overlays the pack\'s trend narrative, style, composition, and color roles onto the spec', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const otherPack = TREND_PACK_LIST.find((p) => p.id !== '2026-Q1')!;
    const result = applyTrendPackToSpec(spec, otherPack);

    expect(result.trend).toEqual({ trendPackId: otherPack.id, theme: otherPack.theme, mood: otherPack.mood });
    expect(result.styleDnaId).toBe(otherPack.styleDnaId);
    expect(result.composition).toBe(otherPack.compositionStyle);
    expect(result.negativeSpace).toBe(otherPack.negativeSpace);
    expect(result.colorRoles).toEqual(otherPack.colorRoles);
  });

  it('leaves every other field on the spec untouched', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const otherPack = TREND_PACK_LIST.find((p) => p.id !== '2026-Q1')!;
    const result = applyTrendPackToSpec(spec, otherPack);

    expect(result.project).toEqual(spec.project);
    expect(result.palette).toEqual(spec.palette);
    expect(result.heroMotifs).toEqual(spec.heroMotifs);
    expect(result.repeatType).toBe(spec.repeatType);
  });
});
