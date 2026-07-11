import { describe, it, expect } from 'vitest';
import {
  SCHEMA_REGISTRY,
  validateDesignSpecificationData,
  validateTrendPackData,
  validateMarketplaceProfileData,
  validateKeywordBundleData,
  validateStyleDnaData,
  validatePatternGrammarData,
  validateMotifGrammarData,
  validateColorRoleSystemData,
  validatePaletteData,
  validateQualityTargetData,
} from './index';
import { TREND_PACK_DATA } from '../trend-packs';
import { MARKETPLACE_DATA } from '../marketplaces';
import { STYLE_DNA_DATA } from '../style-dna';
import { PATTERN_GRAMMAR_DATA } from '../pattern-grammar';
import { MOTIF_GRAMMAR_DATA } from '../motif-grammar';
import { COLOR_ROLE_SYSTEM_DATA, PALETTE_DATA } from '../color-roles';

describe('validators/index: schema registry', () => {
  it('registers all 10 schemas keyed by their own $id', () => {
    expect(Object.keys(SCHEMA_REGISTRY).sort()).toEqual(
      [
        'colorRoleSystem.schema.json',
        'designSpecification.schema.json',
        'keywordBundle.schema.json',
        'marketplaceProfile.schema.json',
        'motifGrammar.schema.json',
        'palette.schema.json',
        'patternGrammar.schema.json',
        'qualityTarget.schema.json',
        'styleDna.schema.json',
        'trendPack.schema.json',
      ].sort(),
    );
  });
});

describe('validators/index: real data validates against its own schema (required fields + data types)', () => {
  it('every Trend Pack passes validateTrendPackData', () => {
    for (const pack of TREND_PACK_DATA) {
      expect(validateTrendPackData(pack), `${pack.id}: ${JSON.stringify(validateTrendPackData(pack))}`).toEqual([]);
    }
  });

  it('every Marketplace Profile passes validateMarketplaceProfileData', () => {
    for (const profile of MARKETPLACE_DATA) {
      expect(validateMarketplaceProfileData(profile), `${profile.id}: ${JSON.stringify(validateMarketplaceProfileData(profile))}`).toEqual([]);
    }
  });

  it('every Style DNA preset passes validateStyleDnaData', () => {
    for (const dna of STYLE_DNA_DATA) {
      expect(validateStyleDnaData(dna), `${dna.id}: ${JSON.stringify(validateStyleDnaData(dna))}`).toEqual([]);
    }
  });

  it('every Pattern Grammar entry passes validatePatternGrammarData', () => {
    for (const grammar of PATTERN_GRAMMAR_DATA) {
      expect(validatePatternGrammarData(grammar), `${grammar.id}: ${JSON.stringify(validatePatternGrammarData(grammar))}`).toEqual([]);
    }
  });

  it('every Motif Grammar entry passes validateMotifGrammarData', () => {
    for (const grammar of MOTIF_GRAMMAR_DATA) {
      expect(validateMotifGrammarData(grammar), `${grammar.id}: ${JSON.stringify(validateMotifGrammarData(grammar))}`).toEqual([]);
    }
  });

  it('the Color Role System passes validateColorRoleSystemData', () => {
    expect(validateColorRoleSystemData(COLOR_ROLE_SYSTEM_DATA)).toEqual([]);
  });

  it('every palette passes validatePaletteData', () => {
    for (const palette of PALETTE_DATA) {
      expect(validatePaletteData(palette), `${palette.id}: ${JSON.stringify(validatePaletteData(palette))}`).toEqual([]);
    }
  });
});

describe('validators/index: schema rejects malformed data', () => {
  it('flags a Trend Pack missing a required field', () => {
    const broken = { ...TREND_PACK_DATA[0] } as Record<string, unknown>;
    delete broken.theme;
    expect(validateTrendPackData(broken).length).toBeGreaterThan(0);
  });

  it('flags a Marketplace Profile with a wrong-typed field', () => {
    const broken = { ...MARKETPLACE_DATA[0], future: 'nope' };
    expect(validateMarketplaceProfileData(broken).length).toBeGreaterThan(0);
  });

  it('flags a palette color that is not a hex string', () => {
    const broken = { ...PALETTE_DATA[0], colors: ['not-a-hex-color'] };
    expect(validatePaletteData(broken).length).toBeGreaterThan(0);
  });
});

function buildValidDesignSpecification() {
  return {
    schemaVersion: 1,
    project: { id: 'proj-1', name: 'Test Project', createdAt: 1700000000000 },
    collection: { size: 6, assetTypes: ['heroPattern', 'secondaryPattern'] },
    marketplace: { id: 'shutterstock' },
    trend: { trendPackId: '2026-Q1', theme: 'Fresh Spring', mood: 'optimistic' },
    keywordBundle: {
      primaryKeyword: 'botanical pattern',
      secondaryKeywords: ['floral', 'spring'],
      marketplace: 'shutterstock',
      season: 'spring',
      audience: 'home decor shoppers',
      commercialCategory: 'textile',
      patternType: 'botanical',
      paletteDirection: 'muted green',
      difficulty: 'moderate',
      collectionSize: 6,
    },
    styleDnaId: 'editorialBotanical',
    palette: { id: 'sage-terracotta', colors: ['#F7F2EA', '#D8C7A1', '#9CAF88', '#C97D5D'] },
    colorRoles: { background: '#F7F2EA', primary: '#D8C7A1', secondary: '#9CAF88', accent: '#C97D5D' },
    composition: 'balanced',
    repeatType: 'grid',
    density: 0.5,
    hierarchy: {
      heroRatio: 0.2,
      secondaryRatio: 0.3,
      fillerRatio: 0.4,
      accentRatio: 0.1,
      heroScale: 1.4,
      secondaryScale: 1,
      fillerScale: 0.6,
      accentScale: 0.4,
    },
    flow: 'calm',
    rhythm: 'regular',
    negativeSpace: 0.3,
    heroMotifs: [{ categoryId: 'botanical', role: 'hero' }],
    secondaryMotifs: [{ categoryId: 'botanical', role: 'secondary' }],
    fillers: [{ categoryId: 'botanical', role: 'filler' }],
    background: { color: '#F7F2EA' },
    svgHints: {
      motifSize: 120,
      rotationJitter: 0.1,
      scaleJitter: 0.1,
      mirror: true,
      radialSymmetry: 1,
      colorStory: true,
      fillerStyle: 'subtle',
      flatShadow: false,
      flatHighlight: false,
      patternScale: 1,
    },
    seoHints: {
      primaryKeyword: 'botanical pattern',
      secondaryKeywords: ['floral', 'spring'],
      commercialCategory: 'textile',
      audience: 'home decor shoppers',
      season: 'spring',
    },
    exportHints: { tileSize: 1400, collectionSize: 6, assetTypes: ['heroPattern'], exportFormats: ['svg'] },
    qualityTargets: { minOverallScore: 70, minSeamlessIntegrity: 80, minMotifDiversity: 60, minCommercialReadiness: 70 },
  };
}

describe('validators/index: validateDesignSpecificationData (cross-file $ref + oneOf)', () => {
  it('accepts a fully-conforming Design Specification, including its nested keywordBundle $ref and qualityTargets $ref', () => {
    expect(validateDesignSpecificationData(buildValidDesignSpecification())).toEqual([]);
  });

  it('accepts trend: null via the oneOf branch', () => {
    const spec = { ...buildValidDesignSpecification(), trend: null };
    expect(validateDesignSpecificationData(spec)).toEqual([]);
  });

  it('rejects an invalid nested keywordBundle (propagated through the cross-file $ref)', () => {
    const spec = buildValidDesignSpecification();
    (spec.keywordBundle as Record<string, unknown>).marketplace = 'not-a-real-marketplace';
    const issues = validateDesignSpecificationData(spec);
    expect(issues.some((i) => i.path.startsWith('$.keywordBundle'))).toBe(true);
  });

  it('rejects an unknown composition enum value', () => {
    const spec = { ...buildValidDesignSpecification(), composition: 'chaotic' };
    const issues = validateDesignSpecificationData(spec);
    expect(issues.some((i) => i.path === '$.composition')).toBe(true);
  });

  it('rejects a missing top-level required field', () => {
    const spec = buildValidDesignSpecification() as Record<string, unknown>;
    delete spec.hierarchy;
    const issues = validateDesignSpecificationData(spec);
    expect(issues.some((i) => i.path === '$.hierarchy')).toBe(true);
  });
});

describe('validators/index: validateQualityTargetData', () => {
  it('accepts values within 0-100', () => {
    expect(
      validateQualityTargetData({ minOverallScore: 0, minSeamlessIntegrity: 100, minMotifDiversity: 50, minCommercialReadiness: 50 }),
    ).toEqual([]);
  });

  it('rejects a value above 100', () => {
    const issues = validateQualityTargetData({
      minOverallScore: 150,
      minSeamlessIntegrity: 100,
      minMotifDiversity: 50,
      minCommercialReadiness: 50,
    });
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('validators/index: validateKeywordBundleData', () => {
  it('rejects an unknown marketplace enum value', () => {
    const issues = validateKeywordBundleData({
      primaryKeyword: 'x',
      secondaryKeywords: [],
      marketplace: 'not-real',
      season: 'spring',
      audience: 'a',
      commercialCategory: 'c',
      patternType: 'botanical',
      paletteDirection: 'green',
      difficulty: 'simple',
      collectionSize: 1,
    });
    expect(issues.some((i) => i.path === '$.marketplace')).toBe(true);
  });
});
