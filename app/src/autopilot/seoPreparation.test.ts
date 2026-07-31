import { describe, it, expect } from 'vitest';
import { resolveSeoProfileId, buildSeoContentInputFromParams, prepareAutopilotSeoForItem } from './seoPreparation';
import { defaultParams } from '../engine/defaults';

describe('resolveSeoProfileId', () => {
  it('resolves real Design Plan marketplace labels to their registered SEO profile id', () => {
    expect(resolveSeoProfileId('Adobe Stock')).toBe('adobestock');
    expect(resolveSeoProfileId('Shutterstock')).toBe('shutterstock');
    expect(resolveSeoProfileId('Etsy')).toBe('etsy');
    expect(resolveSeoProfileId('Getty-iStock')).toBe('gettyimages');
  });

  it('honestly returns null for "Auto" and any unrecognized marketplace — never fabricates a rule', () => {
    expect(resolveSeoProfileId('Auto')).toBeNull();
    expect(resolveSeoProfileId('Some Made Up Marketplace')).toBeNull();
  });
});

describe('buildSeoContentInputFromParams', () => {
  it('produces real title/description/exactly-up-to-50 canonical English keywords from the existing content generator', () => {
    const content = buildSeoContentInputFromParams({ ...defaultParams(), categoryId: 'botanical' });
    expect(content.title.length).toBeGreaterThan(0);
    expect(content.description.length).toBeGreaterThan(0);
    expect(content.keywords.length).toBeGreaterThan(0);
    expect(content.keywords.length).toBeLessThanOrEqual(50);
    expect(new Set(content.keywords).size).toBe(content.keywords.length);
  });
});

describe('prepareAutopilotSeoForItem', () => {
  it('generates a real SEO package for a known marketplace', () => {
    const result = prepareAutopilotSeoForItem('pattern-1', { ...defaultParams(), categoryId: 'botanical' }, 'Adobe Stock');
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.results).toHaveLength(1);
      expect(result.results[0].marketplaceId).toBe('adobestock');
      expect(result.results[0].package.keywords.length).toBeGreaterThan(0);
    }
  });

  it('reports "needs marketplace profile verification" for Auto rather than blocking or fabricating', () => {
    const result = prepareAutopilotSeoForItem('pattern-1', defaultParams(), 'Auto');
    expect(result.status).toBe('needsProfileVerification');
    if (result.status === 'needsProfileVerification') {
      expect(result.reason).toContain('Auto');
    }
  });
});
