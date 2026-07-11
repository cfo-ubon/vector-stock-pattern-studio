import { describe, it, expect } from 'vitest';
import { resolveKeywordBundle } from './keywordBundle';
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

describe('resolveKeywordBundle: keyword relationship resolution', () => {
  it('matches individual keyword tokens across primary and secondary keywords', () => {
    const result = resolveKeywordBundle(makeBundle());
    expect(result.matchedTokens).toContain('luxury');
    expect(result.matchedTokens).toContain('botanical');
    expect(result.matchedTokens).toContain('editorial');
  });

  it('matches a multi-word keyword ("Muted Green") as one combined token, not two independent ones', () => {
    const result = resolveKeywordBundle(makeBundle());
    expect(result.matchedTokens).toContain('muted green');
  });

  it('applies a combo rule bonus when two related tokens are both present, and records why', () => {
    const result = resolveKeywordBundle(makeBundle());
    expect(result.comboNotes.some((n) => n.includes('Luxury + Botanical'))).toBe(true);
    expect(result.styleDnaHints[0]).toBe('luxuryFloral');
  });

  it('does not apply a combo bonus when only one half of the pair is present', () => {
    const result = resolveKeywordBundle(makeBundle({ primaryKeyword: 'Luxury', secondaryKeywords: ['Wallpaper'] }));
    expect(result.comboNotes.length).toBe(0);
  });

  it('weighs the primary keyword more heavily than secondary keywords', () => {
    // "kids" (weight 1.3, styleDnaHints -> kidsPlayful) as primary should
    // outrank "editorial" (weight 1.2, styleDnaHints -> editorialBotanical)
    // as a mere secondary keyword when they'd otherwise be close.
    const result = resolveKeywordBundle(makeBundle({ primaryKeyword: 'Kids', secondaryKeywords: ['Editorial'] }));
    expect(result.styleDnaHints[0]).toBe('kidsPlayful');
  });

  it('is deterministic for the same input', () => {
    const bundle = makeBundle();
    const a = resolveKeywordBundle(bundle);
    const b = resolveKeywordBundle(bundle);
    expect(a).toEqual(b);
  });

  it('returns empty signal arrays for a bundle with no recognizable keywords, without throwing', () => {
    const result = resolveKeywordBundle(makeBundle({ primaryKeyword: 'Xyzzyplugh', secondaryKeywords: ['Qwfp'] }));
    expect(result.matchedTokens).toEqual([]);
    expect(result.paletteHints).toEqual([]);
    expect(result.motifHints).toEqual([]);
    expect(result.comboNotes).toEqual([]);
  });

  it('ranks hints by aggregated weight, highest first', () => {
    // "vintage" (weight 1.1) alone vs. combined with "floral" (weight 1.2)
    // triggering the vintage+floral combo bonus should push vintageHerbarium
    // to the top even though other botanical-adjacent hints are present.
    const result = resolveKeywordBundle(makeBundle({ primaryKeyword: 'Vintage Floral', secondaryKeywords: ['Botanical'] }));
    expect(result.styleDnaHints[0]).toBe('vintageHerbarium');
  });
});
