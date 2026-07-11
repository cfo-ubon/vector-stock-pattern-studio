import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import { buildCollectionFromDesignSpec } from './designSpecCollection';
import {
  buildCollectionPlan,
  buildProductTargets,
  buildLayoutVariants,
  buildCollectionSpecification,
  buildCollectionPreviewMetadata,
  prepareCollectionExport,
} from './collectionPlan';
import { COLLECTION_SCHEMA_VERSION } from '../collection/collectionGenerator';
import { COLOR_STORY_VARIANT_IDS } from '../collection/colorStory';
import { PRODUCT_USE_IDS } from '../collection/productTargets';
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

describe('buildCollectionPlan (Section 1)', () => {
  it('every field is derived from the real Design Specification, not a placeholder', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const plan = buildCollectionPlan(spec);
    expect(plan.collectionName).toContain('Luxury Botanical');
    expect(plan.targetMarketplace).toBe(spec.marketplace.id);
    expect(plan.styleDnaId).toBe(spec.styleDnaId);
    expect(plan.commercialCategory).toBe(spec.keywordBundle.commercialCategory);
    expect(plan.collectionSize).toBe(spec.collection.size);
    expect(plan.collectionVersion).toBe(COLLECTION_SCHEMA_VERSION);
  });

  it('collectionTheme falls back to the primary keyword when there is no matched Trend Pack', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    // Force the no-trend-match case directly (buildDesignSpecification's
    // own keyword-based auto-match may or may not find one for any given
    // bundle) so this test exercises the fallback branch deterministically.
    const noTrendSpec = { ...spec, trend: null };
    const plan = buildCollectionPlan(noTrendSpec);
    expect(plan.collectionTheme).toBe(spec.keywordBundle.primaryKeyword);
  });

  it('collectionTheme uses the matched Trend Pack theme when one is present', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    expect(spec.trend).not.toBeNull();
    const plan = buildCollectionPlan(spec);
    expect(plan.collectionTheme).toBe(spec.trend!.theme);
  });

  it('colorStory has all 10 named variants, each preserving the base color count', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const plan = buildCollectionPlan(spec);
    expect(Object.keys(plan.colorStory).sort()).toEqual([...COLOR_STORY_VARIANT_IDS].sort());
    for (const id of COLOR_STORY_VARIANT_IDS) {
      expect(plan.colorStory[id].colors.length).toBe(spec.palette.colors.length);
    }
  });

  it('recommendedProductUses is a non-empty subset of the 10 named product ids', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const plan = buildCollectionPlan(spec);
    expect(plan.recommendedProductUses.length).toBeGreaterThan(0);
    for (const id of plan.recommendedProductUses) {
      expect(PRODUCT_USE_IDS).toContain(id);
    }
  });

  it('is deterministic for the same spec', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    expect(buildCollectionPlan(spec)).toEqual(buildCollectionPlan(spec));
  });

  it('an explicit product keyword (e.g. "wallpaper") surfaces Wallpaper among the recommendations', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle({ commercialCategory: 'wallpaper' }), createdAt: 1000 });
    const plan = buildCollectionPlan(spec);
    expect(plan.recommendedProductUses).toContain('wallpaper');
  });
});

describe('buildProductTargets (Section 6)', () => {
  it('returns all 10 product uses evaluated against the spec', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const results = buildProductTargets(spec);
    expect(results.map((r) => r.id).sort()).toEqual([...PRODUCT_USE_IDS].sort());
  });
});

describe('buildLayoutVariants (Section 7)', () => {
  it('lists 6 pattern-type assets, each with a real, genuinely distinct layout', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-layout-variants');
    const variants = buildLayoutVariants(collection);
    expect(variants.length).toBe(6);
    expect(variants.map((v) => v.assetId)).toEqual(['hero', 'secondary', 'blender', 'mini', 'stripe', 'background-texture']);
    expect(new Set(variants.map((v) => v.layoutId)).size).toBe(6);
  });
});

describe('buildCollectionSpecification (Section 7)', () => {
  it('assembles metadata/assets/colorVariants/layoutVariants/motifRelationships/marketplaceTargets/commercialNotes from real data', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-collection-spec');
    const collectionSpec = buildCollectionSpecification(spec, collection);

    expect(collectionSpec.metadata.schemaVersion).toBe(COLLECTION_SCHEMA_VERSION);
    expect(collectionSpec.metadata.collectionId).toBe(collection.manifest.collectionId);
    expect(collectionSpec.metadata.plan.collectionName).toBe(collection.manifest.collectionName);

    expect(collectionSpec.assets).toEqual(collection.manifest.assets);
    expect(collectionSpec.motifRelationships).toEqual(collection.manifest.relationships);
    expect(collectionSpec.colorVariants).toEqual(collectionSpec.metadata.plan.colorStory);

    expect(collectionSpec.marketplaceTargets[0]).toBe(spec.marketplace.id);
    expect(new Set(collectionSpec.marketplaceTargets).size).toBe(collectionSpec.marketplaceTargets.length);

    expect(collectionSpec.commercialNotes.length).toBeGreaterThan(0);
    for (const note of collectionSpec.commercialNotes) expect(typeof note).toBe('string');
  });

  it('is deterministic for the same spec + collection', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-collection-spec-det');
    const a = buildCollectionSpecification(spec, collection);
    const b = buildCollectionSpecification(spec, collection);
    expect(a).toEqual(b);
  });
});

describe('buildCollectionPreviewMetadata (Section 8)', () => {
  it('reports real layout diversity, motif consistency, and commercial readiness', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-preview-metadata');
    const preview = buildCollectionPreviewMetadata(collection);

    expect(preview.layoutDiversity.totalPatternAssets).toBe(6);
    expect(preview.layoutDiversity.distinctLayouts).toBe(6);
    expect(preview.layoutDiversity.score).toBe(100);
    expect(preview.motifConsistency).toEqual(collection.manifest.consistency);
    expect(preview.commercialReadiness).toBeGreaterThanOrEqual(0);
    expect(preview.commercialReadiness).toBeLessThanOrEqual(100);
    expect(preview.colorStory.variantIds).toEqual(COLOR_STORY_VARIANT_IDS);
    expect(preview.assetRelationships).toEqual(collection.manifest.relationships);
  });
});

describe('prepareCollectionExport (Section 10 — structured data only, no actual export)', () => {
  it('produces a slugified filename prefix and a real asset manifest', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-export-prep');
    const prep = prepareCollectionExport(spec, collection);

    expect(prep.collectionId).toBe(collection.manifest.collectionId);
    expect(prep.recommendedFilenamePrefix).toMatch(/^[a-z0-9-]+$/);
    expect(prep.totalAssetCount).toBe(collection.assets.length);
    expect(prep.assetManifest).toEqual(collection.manifest.assets);
    expect(prep.marketplaceTargets[0]).toBe(spec.marketplace.id);
    expect(prep.productUses.length).toBeGreaterThan(0);
  });
});
