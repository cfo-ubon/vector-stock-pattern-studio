import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { defaultParams } from '../../engine/defaults';
import { generateCollection } from '../../collection/collectionGenerator';
import { PRODUCT_USE_IDS } from '../../collection/productTargets';
import {
  getCollectionTemplate,
  getCollectionSpecification,
  listProductUseIds,
  evaluateCollectionProductUses,
  getRecommendedProductUses,
  listColorStoryVariantIds,
  getVariationRules,
  getAssetRelationships,
} from './index';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper'],
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

describe('knowledge/collection: getCollectionTemplate', () => {
  it('builds the real Collection Plan from a Design Specification alone', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const template = getCollectionTemplate(spec);
    expect(template.styleDnaId).toBe(spec.styleDnaId);
    expect(template.collectionSize).toBe(spec.collection.size);
  });
});

describe('knowledge/collection: getCollectionSpecification', () => {
  it('builds the real Collection Specification from a spec + generated collection', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const collection = generateCollection({ ...defaultParams(), seed: 'knowledge-collection-spec' });
    const collectionSpec = getCollectionSpecification(spec, collection);
    expect(collectionSpec.assets).toEqual(collection.manifest.assets);
  });
});

describe('knowledge/collection: Product Targets facade', () => {
  it('listProductUseIds matches the real 10 named product uses', () => {
    expect(listProductUseIds()).toEqual(PRODUCT_USE_IDS);
  });

  it('evaluateCollectionProductUses + getRecommendedProductUses compose the real recommender', () => {
    const evaluations = evaluateCollectionProductUses({ categoryId: 'botanical', tileSize: 1400, density: 0.5, keywordText: 'wallpaper' });
    expect(evaluations.length).toBe(PRODUCT_USE_IDS.length);
    const recommended = getRecommendedProductUses(evaluations, 3);
    expect(recommended.length).toBeLessThanOrEqual(3);
  });
});

describe('knowledge/collection: Color Story facade', () => {
  it('listColorStoryVariantIds has all 13 real variants', () => {
    expect(listColorStoryVariantIds().length).toBe(13);
  });

  it('getVariationRules derives the real Color Story from base colors', () => {
    const story = getVariationRules(['#112233', '#445566', '#778899']);
    expect(story.original.colors).toEqual(['#112233', '#445566', '#778899']);
  });
});

describe('knowledge/collection: asset relationships pass-through', () => {
  it('getAssetRelationships builds the real Motif Reuse Report from a generated collection', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'knowledge-collection-reuse' });
    const report = getAssetRelationships(collection.manifest.relationships, collection.motifs);
    expect(report.reuseRatio).toBeGreaterThanOrEqual(0);
    expect(report.reuseRatio).toBeLessThanOrEqual(100);
  });
});
