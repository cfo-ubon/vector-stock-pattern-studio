import { describe, it, expect } from 'vitest';
import { validateDesignSpecificationRelationships, type DesignSpecificationRelationshipInput } from './relationshipValidator';

function buildValidSpec(): DesignSpecificationRelationshipInput {
  return {
    marketplace: { id: 'shutterstock' },
    trend: { trendPackId: '2026-Q1' },
    styleDnaId: 'editorialBotanical',
    palette: { colors: ['#F7F2EA', '#D8C7A1', '#9CAF88', '#C97D5D'] },
    composition: 'balanced',
    repeatType: 'heroFlow',
    density: 0.5,
    negativeSpace: 0.3,
    flow: 'directional',
    rhythm: 'regular',
    heroMotifs: [{ categoryId: 'botanical', role: 'hero' }],
    secondaryMotifs: [{ categoryId: 'botanical', role: 'secondary' }],
    fillers: [{ categoryId: 'botanical', role: 'filler' }],
    exportHints: { exportFormats: ['eps'] }, // shutterstock's marketplace profile requires eps
  };
}

describe('relationshipValidator: happy path', () => {
  it('finds no issues for a fully cross-referenced, real-data-backed spec', () => {
    expect(validateDesignSpecificationRelationships(buildValidSpec())).toEqual([]);
  });
});

describe('relationshipValidator: marketplace relationships', () => {
  it('flags an unknown marketplace id', () => {
    const spec = { ...buildValidSpec(), marketplace: { id: 'not-real' } };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.marketplace.id')).toBe(true);
  });

  it('flags an export format that does not match the marketplace-required extension', () => {
    // shutterstock's marketplace profile requires eps filenames; svg-only export mismatches.
    const spec = { ...buildValidSpec(), exportHints: { exportFormats: ['svg'] } };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.exportHints.exportFormats')).toBe(true);
  });
});

describe('relationshipValidator: trend pack / style dna / palette relationships', () => {
  it('flags an unknown trend pack id', () => {
    const spec = { ...buildValidSpec(), trend: { trendPackId: 'not-real' } };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.trend.trendPackId')).toBe(true);
  });

  it('allows a null trend (no trend pack selected)', () => {
    const spec = { ...buildValidSpec(), trend: null };
    expect(validateDesignSpecificationRelationships(spec)).toEqual([]);
  });

  it('flags an unknown Style DNA id', () => {
    const spec = { ...buildValidSpec(), styleDnaId: 'not-real' };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.styleDnaId')).toBe(true);
  });

  it('flags a palette with fewer colors than the Color Role System requires', () => {
    const spec = { ...buildValidSpec(), palette: { colors: ['#FFFFFF'] } };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.palette.colors')).toBe(true);
  });
});

describe('relationshipValidator: pattern grammar relationships', () => {
  it('flags an unknown composition style', () => {
    const spec = { ...buildValidSpec(), composition: 'chaotic' };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.composition')).toBe(true);
  });

  it('flags a repeatType not in the composition style\'s compatibleLayouts', () => {
    // "dense" grammar's compatibleLayouts does not include "gridMinimal".
    const spec = { ...buildValidSpec(), composition: 'dense', repeatType: 'gridMinimal' };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.repeatType')).toBe(true);
  });

  it('flags a density outside the composition style\'s densityRange', () => {
    const spec = { ...buildValidSpec(), composition: 'minimal', density: 0.95 };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.density')).toBe(true);
  });

  it('flags a negativeSpace outside the composition style\'s negativeSpaceRange', () => {
    const spec = { ...buildValidSpec(), composition: 'dense', negativeSpace: 0.9 };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.negativeSpace')).toBe(true);
  });

  it('flags a flow profile not compatible with the composition style', () => {
    const spec = { ...buildValidSpec(), composition: 'dense', flow: 'calm' };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.flow')).toBe(true);
  });

  it('flags a rhythm profile not compatible with the composition style', () => {
    const spec = { ...buildValidSpec(), composition: 'dense', rhythm: 'regular' };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.rhythm')).toBe(true);
  });
});

describe('relationshipValidator: motif grammar relationships', () => {
  it('flags an unknown motif category id', () => {
    const spec = { ...buildValidSpec(), heroMotifs: [{ categoryId: 'not-real', role: 'hero' as const }] };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.heroMotifs[0].categoryId')).toBe(true);
  });

  it('flags a role the motif category\'s grammar does not allow (plaid has no hero role)', () => {
    const spec = { ...buildValidSpec(), heroMotifs: [{ categoryId: 'plaid', role: 'hero' as const }] };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.heroMotifs[0].role')).toBe(true);
  });

  it('flags a motif category incompatible with the spec\'s composition style', () => {
    // plaid's compatiblePatternGrammars is ["minimal", "balanced"] — "dense" is not in it.
    const spec = { ...buildValidSpec(), composition: 'dense', heroMotifs: [{ categoryId: 'plaid', role: 'filler' as const }] };
    const issues = validateDesignSpecificationRelationships(spec);
    expect(issues.some((i) => i.path === '$.heroMotifs[0].categoryId' && i.message.includes('not compatible with Pattern Grammar'))).toBe(true);
  });
});
