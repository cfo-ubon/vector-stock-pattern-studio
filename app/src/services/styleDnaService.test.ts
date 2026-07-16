import { describe, it, expect } from 'vitest';
import { listStyleDna, getStyleDna, findStyleDnaByCategory, findStyleDnaByPalette, findStyleDnaRecommendedForMarketplace } from './styleDnaService';

describe('styleDnaService', () => {
  it('listStyleDna returns all 15 presets', () => {
    expect(listStyleDna()).toHaveLength(15);
  });

  it('getStyleDna resolves a real id and returns undefined for an unknown one', () => {
    expect(getStyleDna('editorialBotanical')?.id).toBe('editorialBotanical');
    expect(getStyleDna('not-real')).toBeUndefined();
  });

  it('findStyleDnaByCategory only returns presets listing that category', () => {
    const results = findStyleDnaByCategory('botanical');
    expect(results.length).toBeGreaterThan(0);
    for (const dna of results) {
      expect(dna.categories).toContain('botanical');
    }
  });

  it('findStyleDnaByPalette only returns presets listing that palette id', () => {
    const preset = listStyleDna()[0];
    const paletteId = preset.paletteIds[0];
    const results = findStyleDnaByPalette(paletteId);
    expect(results.length).toBeGreaterThan(0);
    for (const dna of results) {
      expect(dna.paletteIds).toContain(paletteId);
    }
  });

  it('findStyleDnaRecommendedForMarketplace only returns presets recommending that site', () => {
    const results = findStyleDnaRecommendedForMarketplace('shutterstock');
    expect(results.length).toBeGreaterThan(0);
    for (const dna of results) {
      expect(dna.exportRecommendation.recommendedSites).toContain('shutterstock');
    }
  });
});
