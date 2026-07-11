import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import { buildGenerateParamsFromDesignSpec, buildTileFromDesignSpec } from './designSpecToParams';
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

describe('buildGenerateParamsFromDesignSpec: field mapping', () => {
  it('maps every field 1:1 from the spec, not from any invented default', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const params = buildGenerateParamsFromDesignSpec(spec, 'seed-1');
    expect(params.categoryId).toBe(spec.heroMotifs[0].categoryId);
    expect(params.layoutId).toBe(spec.repeatType);
    expect(params.paletteId).toBe(spec.palette.id);
    expect(params.colorCount).toBe(spec.palette.colors.length);
    expect(params.tileSize).toBe(spec.exportHints.tileSize);
    expect(params.density).toBe(spec.density);
    expect(params.motifSize).toBe(spec.svgHints.motifSize);
    expect(params.colorStory).toBe(spec.svgHints.colorStory);
    expect(params.fillerStyle).toBe(spec.svgHints.fillerStyle);
    expect(params.flatShadow).toBe(spec.svgHints.flatShadow);
    expect(params.flatHighlight).toBe(spec.svgHints.flatHighlight);
    expect(params.patternScale).toBe(spec.svgHints.patternScale);
    expect(params.rotationJitter).toBe(spec.svgHints.rotationJitter);
    expect(params.scaleJitter).toBe(spec.svgHints.scaleJitter);
    expect(params.mirror).toBe(spec.svgHints.mirror);
    expect(params.radialSymmetry).toBe(spec.svgHints.radialSymmetry);
    expect(params.hierarchy).toEqual(spec.hierarchy);
    expect(params.negativeSpace).toBe(spec.negativeSpace);
    expect(params.styleDnaId).toBe(spec.styleDnaId);
    expect(params.seed).toBe('seed-1');
  });

  it('falls back to keywordBundle.patternType when heroMotifs is empty (defensive, hand-edited spec)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const edited = { ...spec, heroMotifs: [] };
    const params = buildGenerateParamsFromDesignSpec(edited, 'seed-1');
    expect(params.categoryId).toBe(spec.keywordBundle.patternType);
  });

  it('is deterministic for the same spec + seed', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const a = buildGenerateParamsFromDesignSpec(spec, 'seed-x');
    const b = buildGenerateParamsFromDesignSpec(spec, 'seed-x');
    expect(a).toEqual(b);
  });

  it('a different seed produces different params.seed but every other field stays identical', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const a = buildGenerateParamsFromDesignSpec(spec, 'seed-a');
    const b = buildGenerateParamsFromDesignSpec(spec, 'seed-b');
    expect(a.seed).not.toBe(b.seed);
    expect({ ...a, seed: '' }).toEqual({ ...b, seed: '' });
  });
});

describe('buildTileFromDesignSpec: real SVG generation from a Design Specification', () => {
  it('produces a valid, non-empty tile for every Trend Pack without throwing', () => {
    for (const trendPackId of Object.keys(TREND_PACKS)) {
      const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId, createdAt: 1000 });
      const tile = buildTileFromDesignSpec(spec, `seed-${trendPackId}`);
      expect(tile.svg).toBeDefined();
      expect(tile.colors.length).toBeGreaterThan(0);
      expect(tile.params.categoryId).toBe(spec.heroMotifs[0].categoryId);
    }
  });

  it('is fully deterministic for the same spec + seed', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q2', createdAt: 1000 });
    const a = buildTileFromDesignSpec(spec, 'seed-det');
    const b = buildTileFromDesignSpec(spec, 'seed-det');
    expect(a).toEqual(b);
  });

  it('produces a tile whose params pass the spec\'s own semantic validation', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q3', createdAt: 1000 });
    const issues = validateDesignSpecification(spec);
    expect(isDesignSpecificationValid(issues)).toBe(true);
    const tile = buildTileFromDesignSpec(spec, 'seed-valid');
    expect(tile.params.paletteId).toBe(spec.palette.id);
    expect(tile.params.layoutId).toBe(spec.repeatType);
  });

  it('generates visibly different output for two different Trend Packs from the same keyword bundle', () => {
    // No recognizable keywords and no explicit paletteDirection, so
    // palette/styleDnaId fall through entirely to each Trend Pack's own
    // values instead of being pinned by keyword-derived signals.
    const bundle = makeBundle({ paletteDirection: '', primaryKeyword: 'Zzzznotarealword', secondaryKeywords: [] });
    const specQ1 = buildDesignSpecification({ keywordBundle: bundle, trendPackId: '2026-Q1', createdAt: 1000 });
    const specQ4 = buildDesignSpecification({ keywordBundle: bundle, trendPackId: '2026-Q4', createdAt: 1000 });
    const tileQ1 = buildTileFromDesignSpec(specQ1, 'seed-compare');
    const tileQ4 = buildTileFromDesignSpec(specQ4, 'seed-compare');
    expect(tileQ1.params.paletteId).not.toBe(tileQ4.params.paletteId);
    expect(specQ1.styleDnaId).not.toBe(specQ4.styleDnaId);
  });
});
