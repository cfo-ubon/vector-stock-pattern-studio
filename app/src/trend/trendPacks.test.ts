import { describe, it, expect } from 'vitest';
import { GENERATORS } from '../generators';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import { TREND_PACKS, TREND_PACK_LIST, exportTrendPackJson, importTrendPackJson, type TrendPack } from './trendPacks';

describe('trendPacks: Trend Library config integrity', () => {
  it('defines all 4 quarterly packs for 2026', () => {
    const ids = TREND_PACK_LIST.map((p) => p.id).sort();
    expect(ids).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
  });

  it('every pack references only real category ids in popularMotifs/patternTypes', () => {
    for (const pack of TREND_PACK_LIST) {
      for (const id of [...pack.popularMotifs, ...pack.patternTypes]) {
        expect(GENERATORS[id], `${pack.id} references unknown category "${id}"`).toBeDefined();
      }
    }
  });

  it('every pack references a real Style DNA preset id', () => {
    for (const pack of TREND_PACK_LIST) {
      expect(STYLE_DNA_PRESETS[pack.styleDnaId], `${pack.id} references unknown Style DNA "${pack.styleDnaId}"`).toBeDefined();
    }
  });

  it('every pack has a complete required-field set', () => {
    for (const pack of TREND_PACK_LIST) {
      expect(pack.theme.length).toBeGreaterThan(0);
      expect(pack.mood.length).toBeGreaterThan(0);
      expect(pack.commercialUses.length).toBeGreaterThan(0);
      expect(pack.suggestedLayouts.length).toBeGreaterThan(0);
      expect(pack.collectionRecommendations.size).toBeGreaterThan(0);
      expect(pack.collectionRecommendations.assetTypes.length).toBeGreaterThan(0);
      expect(pack.negativeSpace).toBeGreaterThanOrEqual(0);
      expect(pack.negativeSpace).toBeLessThanOrEqual(1);
    }
  });

  it('colorRoles hex values are all present in a real palette-shaped set (4 named roles)', () => {
    for (const pack of TREND_PACK_LIST) {
      expect(Object.keys(pack.colorRoles).sort()).toEqual(['accent', 'background', 'primary', 'secondary']);
      for (const hex of Object.values(pack.colorRoles)) {
        expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('trendPacks: JSON import/export', () => {
  it('round-trips a pack through export -> import to an equivalent object', () => {
    const original = TREND_PACKS['2026-Q1'];
    const json = exportTrendPackJson(original);
    const imported = importTrendPackJson(json);
    expect(imported).toEqual(original);
  });

  it('rejects invalid JSON', () => {
    expect(() => importTrendPackJson('not json')).toThrow();
  });

  it('rejects well-formed JSON missing required fields', () => {
    expect(() => importTrendPackJson(JSON.stringify({ id: 'x' }))).toThrow();
  });

  it('accepts a bare TrendPack object (not wrapped in the export envelope)', () => {
    const bare: TrendPack = TREND_PACKS['2026-Q2'];
    const imported = importTrendPackJson(JSON.stringify(bare));
    expect(imported).toEqual(bare);
  });
});
