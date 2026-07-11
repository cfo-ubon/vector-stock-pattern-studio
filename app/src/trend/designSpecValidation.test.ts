import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import { parseDesignSpecificationJson, validateDesignSpecification, isDesignSpecificationValid } from './designSpecValidation';
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

describe('parseDesignSpecificationJson: shape validation', () => {
  it('round-trips a real generated spec through JSON.stringify/parse', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const parsed = parseDesignSpecificationJson(JSON.stringify(spec));
    expect(parsed).toEqual(spec);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseDesignSpecificationJson('{not json')).toThrow();
  });

  it('rejects a JSON value that is not a usable object', () => {
    expect(() => parseDesignSpecificationJson('42')).toThrow();
    expect(() => parseDesignSpecificationJson('null')).toThrow();
    // an array passes the typeof-object check but has none of the
    // required keys, so it still throws via the missing-fields check
    expect(() => parseDesignSpecificationJson('[]')).toThrow(/ขาดฟิลด์/);
  });

  it('rejects an object missing required top-level fields, naming what is missing', () => {
    expect(() => parseDesignSpecificationJson(JSON.stringify({ schemaVersion: 1 }))).toThrow(/project/);
  });
});

describe('validateDesignSpecification: semantic validation', () => {
  it('reports zero issues for a real, freshly built spec', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    expect(validateDesignSpecification(spec)).toEqual([]);
  });

  it('flags an unknown pattern type as an error', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const broken = { ...spec, keywordBundle: { ...spec.keywordBundle, patternType: 'not-a-real-category' } };
    const issues = validateDesignSpecification(broken);
    expect(issues.some((i) => i.path === 'keywordBundle.patternType' && i.severity === 'error')).toBe(true);
    expect(isDesignSpecificationValid(issues)).toBe(false);
  });

  it('flags an unknown repeatType (layout) as an error', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const broken = { ...spec, repeatType: 'not-a-real-layout' as never };
    const issues = validateDesignSpecification(broken);
    expect(issues.some((i) => i.path === 'repeatType' && i.severity === 'error')).toBe(true);
  });

  it('flags an unknown palette id as an error', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const broken = { ...spec, palette: { ...spec.palette, id: 'not-a-real-palette' } };
    const issues = validateDesignSpecification(broken);
    expect(issues.some((i) => i.path === 'palette.id' && i.severity === 'error')).toBe(true);
  });

  it('flags an out-of-range density/negativeSpace/scaleJitter as an error', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const broken = { ...spec, density: 1.5, negativeSpace: -0.2 };
    const issues = validateDesignSpecification(broken);
    expect(issues.some((i) => i.path === 'density')).toBe(true);
    expect(issues.some((i) => i.path === 'negativeSpace')).toBe(true);
  });

  it('flags a colorRoles hex not present in the palette as a warning (not an error)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const broken = { ...spec, colorRoles: { ...spec.colorRoles, accent: '#123456' } };
    const issues = validateDesignSpecification(broken);
    const found = issues.find((i) => i.path === 'colorRoles.accent');
    expect(found?.severity).toBe('warning');
    // warnings alone don't fail overall validity
    expect(isDesignSpecificationValid(issues)).toBe(true);
  });

  it('flags collection.size <= 0 as an error', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const broken = { ...spec, collection: { ...spec.collection, size: 0 } };
    const issues = validateDesignSpecification(broken);
    expect(issues.some((i) => i.path === 'collection.size' && i.severity === 'error')).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    expect(validateDesignSpecification(spec)).toEqual(validateDesignSpecification(spec));
  });
});
