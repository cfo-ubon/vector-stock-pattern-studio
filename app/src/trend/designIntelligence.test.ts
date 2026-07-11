import { describe, it, expect } from 'vitest';
import { buildDesignSpecification, resolveTrendPack } from './designIntelligence';
import { validateDesignSpecification, isDesignSpecificationValid } from './designSpecValidation';
import { TREND_PACKS } from './trendPacks';
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

describe('buildDesignSpecification: assembly', () => {
  it('produces a fully valid Design Specification (no error-severity issues) for a realistic bundle', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const issues = validateDesignSpecification(spec);
    expect(isDesignSpecificationValid(issues)).toBe(true);
  });

  it('is fully deterministic for the same input', () => {
    const input = { keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000, projectId: 'p1' };
    const a = buildDesignSpecification(input);
    const b = buildDesignSpecification(input);
    expect(a).toEqual(b);
  });

  it('attaches the explicitly selected Trend Pack, carrying its theme/mood through', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q4', createdAt: 1000 });
    expect(spec.trend).toEqual({ trendPackId: '2026-Q4', theme: TREND_PACKS['2026-Q4'].theme, mood: TREND_PACKS['2026-Q4'].mood });
  });

  it('falls back to the Trend Pack\'s styleDnaId when neither an explicit override nor a keyword signal picks one', () => {
    // "Zzz"/no secondary keywords produces no styleDnaHints at all, so the
    // Trend Pack's own styleDnaId should win over the generic default.
    const spec = buildDesignSpecification({
      keywordBundle: makeBundle({ primaryKeyword: 'Zzz', secondaryKeywords: [] }),
      trendPackId: '2026-Q4',
      createdAt: 1000,
    });
    expect(spec.styleDnaId).toBe(TREND_PACKS['2026-Q4'].styleDnaId);
  });

  it('a keyword-derived Style DNA signal outranks the Trend Pack\'s own styleDnaId', () => {
    // "Luxury Botanical" resolves to luxuryFloral via keywordMap.ts, which
    // should win over 2026-Q4's darkBotanical default.
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q4', createdAt: 1000 });
    expect(spec.styleDnaId).toBe('luxuryFloral');
    expect(spec.styleDnaId).not.toBe(TREND_PACKS['2026-Q4'].styleDnaId);
  });

  it('auto-matches a Trend Pack by season + pattern type when none is given explicitly', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle({ season: 'autumn', patternType: 'damask' }), createdAt: 1000 });
    expect(spec.trend?.trendPackId).toBe('2026-Q3');
  });

  it('still builds a valid spec with trend: null when no Trend Pack matches at all is impossible here, but an unknown explicit id resolves to null gracefully', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: 'not-a-real-pack', createdAt: 1000 });
    expect(spec.trend).toBeNull();
    // The rest of the spec still resolves from keyword signals alone.
    expect(spec.styleDnaId.length).toBeGreaterThan(0);
    const issues = validateDesignSpecification(spec);
    expect(isDesignSpecificationValid(issues)).toBe(true);
  });

  it('an explicit keywordBundle.styleDnaId overrides both keyword signals and the Trend Pack', () => {
    const spec = buildDesignSpecification({
      keywordBundle: makeBundle({ styleDnaId: 'kidsPlayful' }),
      trendPackId: '2026-Q1',
      createdAt: 1000,
    });
    expect(spec.styleDnaId).toBe('kidsPlayful');
  });

  it('colorRoles is always a subset of the resolved palette.colors', () => {
    for (const trendPackId of Object.keys(TREND_PACKS)) {
      const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId, createdAt: 1000 });
      for (const hex of Object.values(spec.colorRoles)) {
        expect(spec.palette.colors, `${trendPackId}: ${hex} not in palette`).toContain(hex);
      }
    }
  });

  it('exportHints.exportFormats matches the selected marketplace profile\'s filename extension', () => {
    const eps = buildDesignSpecification({ keywordBundle: makeBundle({ marketplace: 'shutterstock' }), createdAt: 1000 });
    expect(eps.exportHints.exportFormats).toEqual(['eps']);
    const svg = buildDesignSpecification({ keywordBundle: makeBundle({ marketplace: 'creativefabrica' }), createdAt: 1000 });
    expect(svg.exportHints.exportFormats).toEqual(['svg']);
  });

  it('difficulty maps to distinct density values (simple < moderate < complex)', () => {
    const simple = buildDesignSpecification({ keywordBundle: makeBundle({ difficulty: 'simple' }), createdAt: 1000 });
    const moderate = buildDesignSpecification({ keywordBundle: makeBundle({ difficulty: 'moderate' }), createdAt: 1000 });
    const complex = buildDesignSpecification({ keywordBundle: makeBundle({ difficulty: 'complex' }), createdAt: 1000 });
    expect(simple.density).toBeLessThan(moderate.density);
    expect(moderate.density).toBeLessThan(complex.density);
  });

  it('heroMotifs always has exactly one entry with role "hero"', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    expect(spec.heroMotifs.length).toBe(1);
    expect(spec.heroMotifs[0].role).toBe('hero');
  });

  it('falls back to a sensible default when the pattern type matches no keyword hints at all', () => {
    const spec = buildDesignSpecification({
      keywordBundle: makeBundle({ primaryKeyword: 'Zzz', secondaryKeywords: [], patternType: 'geometric' }),
      createdAt: 1000,
    });
    expect(spec.heroMotifs[0].categoryId).toBe('geometric');
    const issues = validateDesignSpecification(spec);
    expect(isDesignSpecificationValid(issues)).toBe(true);
  });
});

describe('resolveTrendPack', () => {
  it('returns the explicit pack when trendPackId is a real id', () => {
    const pack = resolveTrendPack('2026-Q2', makeBundle());
    expect(pack?.id).toBe('2026-Q2');
  });

  it('returns null for an explicit but unknown trendPackId (does not silently fall back to auto-match)', () => {
    const pack = resolveTrendPack('nope', makeBundle());
    expect(pack).toBeNull();
  });

  it('auto-matches by season when no explicit id is given', () => {
    const pack = resolveTrendPack(undefined, makeBundle({ season: 'summer', patternType: 'tropical' }));
    expect(pack?.id).toBe('2026-Q2');
  });
});
