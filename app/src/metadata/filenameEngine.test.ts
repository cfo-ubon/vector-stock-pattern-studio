import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { MARKETPLACE_PROFILES } from './marketplaceProfiles';
import { buildMarketplaceFilename, buildMarketplaceFilenameBase, resolveFilenameTemplate, dedupeFilename } from './filenameEngine';

describe('filenameEngine: filename generation', () => {
  it('produces a lowercase, hyphenated filename with the marketplace extension', () => {
    const params = { ...defaultParams(), categoryId: 'botanical', paletteId: 'jewel-tones', seed: 'file-basic' };
    const filename = buildMarketplaceFilename(params, MARKETPLACE_PROFILES.shutterstock);
    expect(filename).toMatch(/^[a-z0-9-]+\.eps$/);
    expect(filename).toContain('botanical');
  });

  it('uses each profile\'s own configured extension', () => {
    const params = { ...defaultParams(), seed: 'file-ext' };
    expect(buildMarketplaceFilename(params, MARKETPLACE_PROFILES.shutterstock)).toMatch(/\.eps$/);
    expect(buildMarketplaceFilename(params, MARKETPLACE_PROFILES.creativefabrica)).toMatch(/\.svg$/);
  });

  it('is fully deterministic for the same params', () => {
    const params = { ...defaultParams(), seed: 'file-det' };
    const a = buildMarketplaceFilename(params, MARKETPLACE_PROFILES.adobestock);
    const b = buildMarketplaceFilename(params, MARKETPLACE_PROFILES.adobestock);
    expect(a).toBe(b);
  });

  it('a different seed produces a genuinely different filename', () => {
    const a = buildMarketplaceFilename({ ...defaultParams(), seed: 'file-seed-a' }, MARKETPLACE_PROFILES.shutterstock);
    const b = buildMarketplaceFilename({ ...defaultParams(), seed: 'file-seed-b' }, MARKETPLACE_PROFILES.shutterstock);
    expect(a).not.toBe(b);
  });

  it('truncates at a hyphen boundary when the resolved name exceeds the profile\'s maxLength', () => {
    const shortProfile = { ...MARKETPLACE_PROFILES.shutterstock, filenameRules: { ...MARKETPLACE_PROFILES.shutterstock.filenameRules, maxLength: 20 } };
    const base = buildMarketplaceFilenameBase({ ...defaultParams(), categoryId: 'botanical', seed: 'file-truncate' }, shortProfile);
    expect(base.length).toBeLessThanOrEqual(20);
    expect(base.endsWith('-')).toBe(false);
  });

  describe('user customization', () => {
    it('resolves a custom template\'s placeholders against real params', () => {
      const params = { ...defaultParams(), categoryId: 'geometric', seed: 'my-seed-123' };
      const resolved = resolveFilenameTemplate('{category}_{seed}_{site}', params, 'etsy');
      expect(resolved).toBe('geometric_my-seed-123_etsy');
    });

    it('leaves an unrecognized placeholder as literal text instead of throwing', () => {
      const resolved = resolveFilenameTemplate('{unknown}-{seed}', { ...defaultParams(), seed: 'abc' }, 'shutterstock');
      expect(resolved).toBe('{unknown}-abc');
    });

    it('a custom template overrides the profile default for one call without mutating the profile', () => {
      const params = { ...defaultParams(), seed: 'custom-tpl' };
      const custom = buildMarketplaceFilename(params, MARKETPLACE_PROFILES.shutterstock, '{seed}-only');
      const defaultName = buildMarketplaceFilename(params, MARKETPLACE_PROFILES.shutterstock);
      expect(custom).not.toBe(defaultName);
      expect(custom.startsWith('custom-tpl-only')).toBe(true);
    });
  });

  describe('duplicate avoidance', () => {
    it('appends -2, -3, ... on collision instead of overwriting', () => {
      const used = new Set<string>();
      const first = dedupeFilename('pattern.svg', used);
      const second = dedupeFilename('pattern.svg', used);
      const third = dedupeFilename('pattern.svg', used);
      expect(first).toBe('pattern.svg');
      expect(second).toBe('pattern-2.svg');
      expect(third).toBe('pattern-3.svg');
      expect(new Set([first, second, third]).size).toBe(3);
    });

    it('leaves a genuinely unique filename untouched', () => {
      const used = new Set<string>(['a.svg', 'b.svg']);
      expect(dedupeFilename('c.svg', used)).toBe('c.svg');
    });

    it('handles a filename with no extension', () => {
      const used = new Set<string>();
      expect(dedupeFilename('filename', used)).toBe('filename');
      expect(dedupeFilename('filename', used)).toBe('filename-2');
    });
  });

  describe('extra placeholders (e.g. trend/designSpecSeo.ts\'s {keyword})', () => {
    it('resolves an extra placeholder passed via the extra argument', () => {
      const params = { ...defaultParams(), seed: 'file-extra' };
      const resolved = resolveFilenameTemplate('{keyword}-{category}-{seed}', params, 'shutterstock', { keyword: 'luxury-botanical' });
      expect(resolved.startsWith('luxury-botanical-')).toBe(true);
    });

    it('is backward compatible: omitting extra behaves exactly as before', () => {
      const params = { ...defaultParams(), seed: 'file-no-extra' };
      const withoutExtra = resolveFilenameTemplate('{palette}-{category}-{seed}', params, 'shutterstock');
      const withEmptyExtra = resolveFilenameTemplate('{palette}-{category}-{seed}', params, 'shutterstock', {});
      expect(withoutExtra).toBe(withEmptyExtra);
    });

    it('extra never overrides a built-in placeholder name', () => {
      const params = { ...defaultParams(), categoryId: 'botanical', seed: 'file-override-guard' };
      const resolved = resolveFilenameTemplate('{category}', params, 'shutterstock', { category: 'should-not-win' });
      expect(resolved).not.toBe('should-not-win');
    });

    it('buildMarketplaceFilename threads extra through to the resolved filename', () => {
      const params = { ...defaultParams(), seed: 'file-extra-full' };
      const filename = buildMarketplaceFilename(params, MARKETPLACE_PROFILES.shutterstock, '{keyword}-{seed}', { keyword: 'kids-tropical' });
      expect(filename.startsWith('kids-tropical-')).toBe(true);
    });
  });
});
