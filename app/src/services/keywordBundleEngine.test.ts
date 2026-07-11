import { describe, it, expect } from 'vitest';
import {
  validateKeywordBundle,
  isKeywordBundleValid,
  suggestTrendPacksForBundle,
  suggestStyleDnaIdsForBundle,
  type KeywordBundleLike,
} from './keywordBundleEngine';

function buildValidBundle(): KeywordBundleLike {
  return {
    primaryKeyword: 'botanical pattern',
    secondaryKeywords: ['floral', 'spring'],
    marketplace: 'shutterstock',
    season: 'summer',
    audience: 'home decor shoppers',
    commercialCategory: 'textile',
    styleDnaId: 'editorialBotanical',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 6,
  };
}

describe('keywordBundleEngine: validateKeywordBundle', () => {
  it('finds no issues for a fully valid, cross-referenced bundle', () => {
    expect(validateKeywordBundle(buildValidBundle())).toEqual([]);
    expect(isKeywordBundleValid(buildValidBundle())).toBe(true);
  });

  it('flags an unknown marketplace', () => {
    const bundle = { ...buildValidBundle(), marketplace: 'not-real' };
    const issues = validateKeywordBundle(bundle);
    expect(issues.some((i) => i.path === '$.marketplace')).toBe(true);
    expect(isKeywordBundleValid(bundle)).toBe(false);
  });

  it('flags an unknown styleDnaId when provided', () => {
    const bundle = { ...buildValidBundle(), styleDnaId: 'not-real' };
    const issues = validateKeywordBundle(bundle);
    expect(issues.some((i) => i.path === '$.styleDnaId')).toBe(true);
  });

  it('accepts a bundle with no styleDnaId at all (optional field)', () => {
    const bundle = buildValidBundle();
    delete bundle.styleDnaId;
    expect(validateKeywordBundle(bundle)).toEqual([]);
  });

  it('flags an unknown patternType (no matching Motif Grammar entry)', () => {
    const bundle = { ...buildValidBundle(), patternType: 'not-real' };
    const issues = validateKeywordBundle(bundle);
    expect(issues.some((i) => i.path === '$.patternType')).toBe(true);
  });

  it('propagates schema-level issues (e.g. an empty primaryKeyword) from the JSON Schema validator', () => {
    const bundle = { ...buildValidBundle(), primaryKeyword: '' };
    const issues = validateKeywordBundle(bundle);
    expect(issues.some((i) => i.path === '$.primaryKeyword')).toBe(true);
  });
});

describe('keywordBundleEngine: suggestTrendPacksForBundle', () => {
  it('only suggests packs matching season (or yearRound) and patternType', () => {
    const results = suggestTrendPacksForBundle(buildValidBundle());
    expect(results.length).toBeGreaterThan(0);
    for (const pack of results) {
      expect(['summer', 'yearRound']).toContain(pack.season);
      expect(pack.patternTypes).toContain('botanical');
    }
  });

  it('ranks exact-season matches ahead of yearRound ones', () => {
    const results = suggestTrendPacksForBundle(buildValidBundle());
    const firstYearRoundIndex = results.findIndex((p) => p.season === 'yearRound');
    const lastExactIndex = results.map((p) => p.season).lastIndexOf('summer');
    if (firstYearRoundIndex !== -1 && lastExactIndex !== -1) {
      expect(lastExactIndex).toBeLessThan(firstYearRoundIndex);
    }
  });

  it('returns an empty array when nothing matches both filters (no pack lists "terrazzo")', () => {
    const bundle = { ...buildValidBundle(), patternType: 'terrazzo' };
    expect(suggestTrendPacksForBundle(bundle)).toEqual([]);
  });
});

describe('keywordBundleEngine: suggestStyleDnaIdsForBundle', () => {
  it('returns just the bundle\'s own styleDnaId when it is set and real', () => {
    expect(suggestStyleDnaIdsForBundle(buildValidBundle())).toEqual(['editorialBotanical']);
  });

  it('falls back to category + marketplace matching when styleDnaId is absent', () => {
    const bundle = buildValidBundle();
    delete bundle.styleDnaId;
    const results = suggestStyleDnaIdsForBundle(bundle);
    expect(results).toContain('editorialBotanical');
  });

  it('falls back to category matching when styleDnaId is set but unknown', () => {
    const bundle = { ...buildValidBundle(), styleDnaId: 'not-real' };
    const results = suggestStyleDnaIdsForBundle(bundle);
    expect(results.length).toBeGreaterThan(0);
  });
});
