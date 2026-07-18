import { describe, it, expect } from 'vitest';
import { computeSeoScore } from './seoScoring';

const GOOD_CONTENT = {
  title: 'Seamless Pastel Floral Spring Pattern With Botanical Motifs',
  description: 'This seamless floral pattern brings a soft, pastel spring feel to any project. It works beautifully on fabric and wallpaper.',
  keywords: ['seamless', 'floral', 'pastel', 'fabric', 'wallpaper', 'spring', 'botanical', 'vector', 'editable'],
};

describe('computeSeoScore — returns all named scores', () => {
  it('returns overall/titleScore/descriptionScore/keywordScore/marketplaceCompatibility/commercialReadiness', () => {
    const report = computeSeoScore(GOOD_CONTENT, 'shutterstock');
    expect(report).toHaveProperty('overall');
    expect(report).toHaveProperty('titleScore');
    expect(report).toHaveProperty('descriptionScore');
    expect(report).toHaveProperty('keywordScore');
    expect(report).toHaveProperty('marketplaceCompatibility');
    expect(report).toHaveProperty('commercialReadiness');
    for (const value of Object.values(report)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('overall is the average of the 5 named sub-scores', () => {
    const report = computeSeoScore(GOOD_CONTENT, 'shutterstock');
    const expected = Math.round((report.titleScore + report.descriptionScore + report.keywordScore + report.marketplaceCompatibility + report.commercialReadiness) / 5);
    expect(report.overall).toBe(expected);
  });
});

describe('computeSeoScore — quality differentiation', () => {
  it('scores well-formed content substantially higher than empty content', () => {
    const good = computeSeoScore(GOOD_CONTENT, 'shutterstock');
    const empty = computeSeoScore({ title: '', description: '', keywords: [] }, 'shutterstock');
    expect(good.overall).toBeGreaterThan(empty.overall);
  });

  it('marketplaceCompatibility drops when content violates marketplace rules', () => {
    const compliant = computeSeoScore(GOOD_CONTENT, 'shutterstock');
    const nonCompliant = computeSeoScore({ ...GOOD_CONTENT, keywords: ['one'] }, 'shutterstock'); // below shutterstock's minimum
    expect(nonCompliant.marketplaceCompatibility).toBeLessThan(compliant.marketplaceCompatibility);
  });

  it('commercialReadiness rewards commercial-intent keywords', () => {
    const commercial = computeSeoScore({ ...GOOD_CONTENT, keywords: ['seamless', 'vector', 'commercial use', 'editable', 'royalty free'] }, 'shutterstock');
    const noncommercial = computeSeoScore({ ...GOOD_CONTENT, keywords: ['sunshine', 'happiness', 'joy', 'friendship', 'wonder'] }, 'shutterstock');
    expect(commercial.commercialReadiness).toBeGreaterThan(noncommercial.commercialReadiness);
  });
});

describe('computeSeoScore — never throws for an unknown marketplace', () => {
  it('returns a fallback report instead of throwing', () => {
    expect(() => computeSeoScore(GOOD_CONTENT, 'not-a-real-marketplace')).not.toThrow();
    const report = computeSeoScore(GOOD_CONTENT, 'not-a-real-marketplace');
    expect(report.titleScore).toBe(0);
    expect(report.descriptionScore).toBe(0);
  });
});
