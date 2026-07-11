import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { validateDesignSpecForWorkbench } from './workbenchValidation';

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

describe('validateDesignSpecForWorkbench: a real, engine-generated spec', () => {
  it('produces no schema errors for a freshly generated spec (the engine\'s own output is always schema-valid)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const result = validateDesignSpecForWorkbench(spec);
    expect(result.errors.filter((i) => i.category === 'schema')).toEqual([]);
  });

  it('produces no relationship errors once composition/repeatType/density/flow/rhythm are set to a mutually compatible tuple', () => {
    // The shipped engine (trend/designIntelligence.ts) and the Design
    // Intelligence Core's Pattern Grammar library (built in a separate,
    // not-yet-wired-together phase) don't always agree — this is a real,
    // documented gap (see app/DESIGN_INTELLIGENCE_CORE.md's Phase 2
    // recommendation #3), not a bug in either one individually. This test
    // proves the merged validator reports zero errors for a spec that
    // genuinely satisfies every layer, using pattern-grammar/balanced.json's
    // own documented-compatible values.
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const compatible = { ...spec, composition: 'balanced' as const, repeatType: 'heroFlow' as const, density: 0.5, negativeSpace: 0.2, flow: 'directional' as const, rhythm: 'regular' as const };
    const result = validateDesignSpecForWorkbench(compatible);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('buckets issues into errors/warnings/suggestions/marketplaceIssues consistently with `issues`', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const result = validateDesignSpecForWorkbench(spec);
    expect(result.errors.length + result.warnings.length + result.suggestions.length).toBe(result.issues.length);
    for (const issue of result.marketplaceIssues) {
      expect(result.issues).toContainEqual(issue);
    }
  });

  it('suggests attaching a Trend Pack when trend is null', () => {
    // No trend pack lists season "yearRound" or pattern type "terrazzo", so
    // resolveTrendPack() falls through to null — a real "no trend matched" case.
    const spec = buildDesignSpecification({
      keywordBundle: makeBundle({ season: 'yearRound', patternType: 'terrazzo' }),
      createdAt: 1000,
    });
    expect(spec.trend).toBeNull();
    const result = validateDesignSpecForWorkbench(spec);
    expect(result.suggestions.some((i) => i.path === '$.trend')).toBe(true);
  });
});

describe('validateDesignSpecForWorkbench: schema + relationship errors surface through', () => {
  it('flags an unknown marketplace id as a schema error', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const broken = { ...spec, marketplace: { id: 'not-real' as never } };
    const result = validateDesignSpecForWorkbench(broken);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((i) => i.category === 'schema' || i.category === 'marketplace')).toBe(true);
  });

  it('flags an unknown styleDnaId as a relationship error', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const broken = { ...spec, styleDnaId: 'not-real' };
    const result = validateDesignSpecForWorkbench(broken);
    expect(result.errors.some((i) => i.path === '$.styleDnaId')).toBe(true);
  });
});

describe('validateDesignSpecForWorkbench: missing values', () => {
  it('flags an empty project name', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const broken = { ...spec, project: { ...spec.project, name: '' } };
    const result = validateDesignSpecForWorkbench(broken);
    expect(result.warnings.some((i) => i.path === '$.project.name' && i.category === 'missing')).toBe(true);
  });

  it('flags an empty heroMotifs list', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const broken = { ...spec, heroMotifs: [] };
    const result = validateDesignSpecForWorkbench(broken);
    expect(result.warnings.some((i) => i.path === '$.heroMotifs' && i.category === 'missing')).toBe(true);
  });
});

describe('validateDesignSpecForWorkbench: duplicate values', () => {
  it('flags a duplicate secondary keyword matching the primary keyword', () => {
    const spec = buildDesignSpecification({
      keywordBundle: makeBundle({ primaryKeyword: 'Botanical', secondaryKeywords: ['botanical', 'Wallpaper'] }),
      trendPackId: '2026-Q1',
      createdAt: 1000,
    });
    const result = validateDesignSpecForWorkbench(spec);
    expect(result.warnings.some((i) => i.category === 'duplicate' && i.message.includes('botanical'))).toBe(true);
  });

  it('flags the same categoryId+role used in two different motif lists', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const categoryId = spec.heroMotifs[0].categoryId;
    const broken = { ...spec, secondaryMotifs: [...spec.secondaryMotifs, { categoryId, role: spec.heroMotifs[0].role }] };
    const result = validateDesignSpecForWorkbench(broken);
    expect(result.warnings.some((i) => i.category === 'duplicate' && i.path === '$.secondaryMotifs')).toBe(true);
  });
});
