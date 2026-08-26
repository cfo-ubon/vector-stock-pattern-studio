import { describe, it, expect } from 'vitest';
import { analyzeKeyword } from './keywordIntent';
import { STYLE_DNA_DATA } from '../style-dna';
import { GENERATOR_LIST } from '../generators';

describe('analyzeKeyword', () => {
  it('matches a real StyleDna preset when the keyword overlaps its label/description/categories', () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    expect(intent.styleDnaId).toBe('minimalBotanical');
    expect(intent.categoryId).toBe('botanical');
    expect(intent.matchedTokens.length).toBeGreaterThan(0);
    expect(intent.confidence).toBeGreaterThan(0);
  });

  it('falls back to a raw generator category when no StyleDna preset matches', () => {
    const intent = analyzeKeyword('japanese geometric');
    const geometricGenerator = GENERATOR_LIST.find((g) => g.id === 'geometric');
    expect(geometricGenerator).toBeDefined();
    expect(intent.categoryId).toBe('geometric');
  });

  it('infers low density from sparse/minimal tokens regardless of the matched preset default', () => {
    const intent = analyzeKeyword('minimal geometric pattern');
    expect(intent.density).toBe('low');
  });

  it('infers high density from dense/busy tokens', () => {
    const intent = analyzeKeyword('dense busy botanical foliage');
    expect(intent.density).toBe('high');
  });

  it('infers a nursery/kids target use for kid-oriented keywords', () => {
    const intent = analyzeKeyword('cute dinosaur kids');
    expect(intent.targetUses).toContain('Nursery / kids apparel');
  });

  it('infers a seasonal target use for holiday keywords', () => {
    const intent = analyzeKeyword('christmas candy');
    expect(intent.targetUses).toContain('Seasonal / holiday stock');
  });

  it('never fabricates a market-demand claim — commercialIntent only describes use-case, and says so', () => {
    const intent = analyzeKeyword('boho rainbow nursery');
    expect(intent.commercialIntent).toMatch(/no market-demand data consulted/i);
  });

  it('is always offline (no network dependency, purely local data)', () => {
    const intent = analyzeKeyword('luxury abstract leaves');
    expect(intent.offline).toBe(true);
  });

  it('returns zero confidence for an empty keyword, never a fabricated positive number', () => {
    const intent = analyzeKeyword('   ');
    expect(intent.confidence).toBe(0);
    expect(intent.tokens).toEqual([]);
  });

  it('handles a comma-separated multi-concept phrase by tokenizing across separators', () => {
    const intent = analyzeKeyword('botanical, minimal, pastel');
    expect(intent.tokens).toEqual(['botanical', 'minimal', 'pastel']);
  });

  it('every StyleDna preset id referenced by a match actually exists in STYLE_DNA_DATA (no dangling reference)', () => {
    const intent = analyzeKeyword('luxury floral wallpaper');
    if (intent.styleDnaId) {
      expect(STYLE_DNA_DATA.some((d) => d.id === intent.styleDnaId)).toBe(true);
    }
  });

  it('confidence never exceeds 90 (a keyword match is evidence of relevance, not proof of demand)', () => {
    const intent = analyzeKeyword('minimal botanical leaves airy scattered organic');
    expect(intent.confidence).toBeLessThanOrEqual(90);
  });
});
