import type { LayoutId } from '../engine/types';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '../metadata/marketplaceProfiles';
import { buildMarketplaceFilename, dedupeFilename } from '../metadata/filenameEngine';
import { COLLECTION_SCHEMA_VERSION, type CollectionManifest, type GeneratedCollection } from '../collection/collectionGenerator';
import { computeCollectionScore, type CollectionScore } from '../collection/collectionScore';
import { buildColorStory, COLOR_STORY_VARIANT_IDS, type ColorStorySet, type ColorStoryVariantId } from '../collection/colorStory';
import { evaluateProductTargets, recommendedProductUses, type ProductUseEvaluation, type ProductUseId } from '../collection/productTargets';
import type { MotifReuseReport } from '../collection/motifReuse';
import { buildDesignSpecCollectionName } from './designSpecSeo';
import type { DesignSpecification } from './designSpecTypes';

// Collection Planner — Commercial Collection Engine Phase 4, Sections 1, 7,
// 8, and 10. Everything here is orchestration: it consumes the Design
// Specification JSON (the only source of truth per this phase's brief) and
// the *already-generated* `GeneratedCollection` (collection/
// collectionGenerator.ts, unmodified) plus the already-real
// `collection/collectionScore.ts` scoring — nothing in this file
// re-implements SVG generation, scoring, or the Design Spec schema. Its
// only job is assembling those real, independently-computed pieces into
// the Collection Plan / Collection Specification JSON / Preview metadata /
// Export-prep shapes Sections 1/7/8/10 name.

/** Section 1, "Collection Planner" — a high-level creative brief derived
 * entirely from a Design Specification, with no dependency on any
 * already-generated collection (a plan can exist before anything is
 * generated, the same way a Design Specification already can). */
export interface CollectionPlan {
  collectionName: string;
  collectionTheme: string;
  commercialCategory: string;
  targetMarketplace: MarketplaceId;
  /** Section 1's own "Marketplace Targets" field (plural) — the primary
   * `targetMarketplace` plus any additional marketplaces the active Style
   * DNA preset curates (same real data `CollectionSpecification.
   * marketplaceTargets`/`CollectionExportPrep.marketplaceTargets` already
   * derive via `buildMarketplaceTargets`, now also surfaced on the Plan
   * itself since Section 1 explicitly names it as a Plan-level field). */
  marketplaceTargets: MarketplaceId[];
  styleDnaId: string;
  /** Full Section 3 Color Story — all 13 named variants (Section 1 asks
   * for one "Color Story" field; this is the real palette-variant set that
   * field resolves to, not just a label). */
  colorStory: ColorStorySet;
  recommendedProductUses: ProductUseId[];
  collectionSize: number;
  /** The real collection/collectionGenerator.ts schema version this plan
   * targets — not a separate, disconnected version label (see
   * project/projectTypes.ts's `ProjectExportHistoryEntry.version` for the
   * same "reuse the real schema version, don't invent a parallel one"
   * convention already established in this codebase). */
  collectionVersion: number;
}

/** Builds the Section 1 Collection Plan from a Design Specification alone
 * — consumes `spec.palette.colors` (the Design Spec's own already-resolved
 * palette) for the Color Story base and `spec.keywordBundle.patternType`
 * (a real generator category id, per designSpecTypes.ts's own field docs)
 * plus tile size/density for Product Targets, so this never needs an
 * already-generated tile to run. */
export function buildCollectionPlan(spec: DesignSpecification): CollectionPlan {
  const keywordText = [spec.keywordBundle.commercialCategory, spec.keywordBundle.primaryKeyword, ...spec.keywordBundle.secondaryKeywords].join(' ');
  const productEvaluations = evaluateProductTargets({
    categoryId: spec.keywordBundle.patternType,
    tileSize: spec.exportHints.tileSize,
    density: spec.density,
    keywordText,
  });
  return {
    collectionName: buildDesignSpecCollectionName(spec),
    collectionTheme: spec.trend?.theme ?? spec.keywordBundle.primaryKeyword,
    commercialCategory: spec.keywordBundle.commercialCategory,
    targetMarketplace: spec.marketplace.id,
    marketplaceTargets: buildMarketplaceTargets(spec),
    styleDnaId: spec.styleDnaId,
    colorStory: buildColorStory(spec.palette.colors),
    recommendedProductUses: recommendedProductUses(productEvaluations),
    collectionSize: spec.collection.size,
    collectionVersion: COLLECTION_SCHEMA_VERSION,
  };
}

/** Section 6, "Product Targets" — the full evaluated table across all 10
 * named product uses (not just the Section 1 recommended subset), for
 * callers that want to show/inspect every product's real score and
 * reasons rather than only the top picks. */
export function buildProductTargets(spec: DesignSpecification): ProductUseEvaluation[] {
  const keywordText = [spec.keywordBundle.commercialCategory, spec.keywordBundle.primaryKeyword, ...spec.keywordBundle.secondaryKeywords].join(' ');
  return evaluateProductTargets({
    categoryId: spec.keywordBundle.patternType,
    tileSize: spec.exportHints.tileSize,
    density: spec.density,
    keywordText,
  });
}

/** Section 7, "Collection JSON" — the fixed pattern-type asset ids
 * collection/collectionGenerator.ts's `generateCollection` assigns, in the
 * exact order `GeneratedCollection.patternTiles` returns them. Kept local
 * to this module (not re-exported from collectionGenerator.ts) since nothing
 * there currently needs its own asset ids as a named list. */
const PATTERN_ASSET_IDS = ['hero', 'secondary', 'blender', 'mini', 'stripe', 'background-texture', 'dense-pattern', 'airy-pattern'];

export interface CollectionLayoutVariant {
  assetId: string;
  layoutId: LayoutId;
}

/** Section 7's "Layout Variants" — which real layout each pattern-type
 * asset actually got (Section 5's `allocateLayout` result), read straight
 * off the already-generated collection, never re-derived or guessed. */
export function buildLayoutVariants(collection: GeneratedCollection): CollectionLayoutVariant[] {
  return collection.patternTiles.map((tile, i) => ({
    assetId: PATTERN_ASSET_IDS[i] ?? `pattern-${i}`,
    layoutId: tile.params.layoutId,
  }));
}

export interface CollectionMarketplaceFilename {
  assetId: string;
  filename: string;
}

/** Marketplace Intelligence Engine Phase 5, Section 5 — "Support ...
 * Collection Specification JSON": a marketplace-optimized, deduped
 * filename for every pattern-type asset in an already-generated
 * Collection, reusing `metadata/filenameEngine.ts`'s real template
 * resolution and dedup logic (never re-implemented here) against each
 * asset's own real `GenerateParams` from `patternTiles`. Deliberately
 * distinct from the collection's own internal asset ids/filenames
 * (`collection.manifest.assets[].filename`, e.g. `collection-x-hero.svg`)
 * — those are this app's own bookkeeping names; these are what the chosen
 * marketplace's own filename rules would produce for the same assets. */
export function buildCollectionMarketplaceFilenames(
  collection: GeneratedCollection,
  marketplaceId: MarketplaceId,
  customTemplate?: string,
): CollectionMarketplaceFilename[] {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  const used = new Set<string>();
  return collection.patternTiles.map((tile, i) => {
    const filename = buildMarketplaceFilename(tile.params, profile, customTemplate);
    return { assetId: PATTERN_ASSET_IDS[i] ?? `pattern-${i}`, filename: dedupeFilename(filename, used) };
  });
}

/** A small local slugify — deliberately not imported from
 * metadata/filenameEngine.ts's module-private `slugify` (a different
 * concern layer: marketplace filename templates), the same "a few lines of
 * genuinely generic logic is cheaper to duplicate than to couple two
 * unrelated modules over" judgment call collection/collectionScore.ts's
 * own `shannonDiversity` helper documents. */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Section 7's full Collection Specification JSON — Collection Metadata,
 * Assets, Color Variants, Layout Variants, Motif Relationships,
 * Marketplace Targets, Commercial Notes. Every field is either the
 * Collection Plan (Section 1) or something read straight off the
 * already-generated `GeneratedCollection`'s own manifest — this function
 * assembles, it never re-derives. */
export interface CollectionSpecification {
  metadata: {
    schemaVersion: number;
    collectionId: string;
    generatedAt: number;
    plan: CollectionPlan;
  };
  assets: CollectionManifest['assets'];
  colorVariants: ColorStorySet;
  layoutVariants: CollectionLayoutVariant[];
  motifRelationships: CollectionManifest['relationships'];
  /** Section 6/8's "Motif Variants" — which motifs are genuinely shared
   * across more than one asset, grouped by role/family, with the real
   * rotation/scale variants each placement got. Read straight off
   * `collection.motifReuse` (collection/motifReuse.ts) — computed once
   * during generation, never re-derived here. */
  motifVariants: MotifReuseReport;
  /** The Design Spec's own chosen marketplace, plus (when the active Style
   * DNA is a known built-in preset) that style's own curated
   * `exportRecommendation.recommendedSites` — real, already-authored
   * per-style data (engine/styleDna.ts), deduplicated, primary marketplace
   * always first. */
  marketplaceTargets: MarketplaceId[];
  /** Deterministic, fact-derived one-line notes (asset counts, style/
   * product/marketplace summary) — never fabricated marketing copy. */
  commercialNotes: string[];
}

function buildMarketplaceTargets(spec: DesignSpecification): MarketplaceId[] {
  const styleDna = STYLE_DNA_PRESETS[spec.styleDnaId];
  const recommended = styleDna?.exportRecommendation.recommendedSites ?? [];
  return [spec.marketplace.id, ...recommended.filter((id) => id !== spec.marketplace.id)];
}

function buildCommercialNotes(spec: DesignSpecification, plan: CollectionPlan, collection: GeneratedCollection, score: CollectionScore): string[] {
  const notes: string[] = [];
  notes.push(`${collection.assets.length} assets generated, sharing Style DNA "${plan.styleDnaId}" and one motif family.`);
  notes.push(`Overall Collection Score: ${score.overall}/100 (${score.issues.length === 0 ? 'no consistency issues found' : `${score.issues.length} issue(s) flagged`}).`);
  notes.push(`Recommended for: ${plan.recommendedProductUses.map((id) => id).join(', ') || 'no strong product match found'}.`);
  notes.push(`Primary marketplace target: ${spec.marketplace.id}.`);
  if (spec.trend) notes.push(`Aligned to Trend Pack theme "${spec.trend.theme}" (mood: ${spec.trend.mood}).`);
  return notes;
}

/** Assembles the full Section 7 Collection Specification from a Design
 * Specification and its already-generated Collection. */
export function buildCollectionSpecification(spec: DesignSpecification, collection: GeneratedCollection): CollectionSpecification {
  const plan = buildCollectionPlan(spec);
  const score = computeCollectionScore(collection);
  return {
    metadata: {
      schemaVersion: COLLECTION_SCHEMA_VERSION,
      collectionId: collection.manifest.collectionId,
      generatedAt: collection.manifest.createdAt,
      plan,
    },
    assets: collection.manifest.assets,
    colorVariants: plan.colorStory,
    layoutVariants: buildLayoutVariants(collection),
    motifRelationships: collection.manifest.relationships,
    motifVariants: collection.motifReuse,
    marketplaceTargets: buildMarketplaceTargets(spec),
    commercialNotes: buildCommercialNotes(spec, plan, collection, score),
  };
}

/** Section 8, "Collection Preview" metadata — describes asset
 * relationships, color story, layout diversity, motif consistency, and
 * commercial readiness, all read from data collection/collectionGenerator.ts
 * and collection/collectionScore.ts already computed (this function does
 * not build or modify the visual preview SVG itself — that's
 * collection/collectionGenerator.ts's existing `buildCollectionPreview`,
 * untouched). */
export interface CollectionPreviewMetadata {
  assetRelationships: CollectionManifest['relationships'];
  colorStory: { variantCount: number; variantIds: ColorStoryVariantId[] };
  layoutDiversity: { distinctLayouts: number; totalPatternAssets: number; score: number };
  motifConsistency: CollectionManifest['consistency'];
  commercialReadiness: number;
  /** Section 10 "Collection Cover" — which asset a preview UI should
   * feature first. Always the Hero Pattern (the same asset
   * collection/collectionGenerator.ts's own `buildCollectionPreview`
   * composite places first), falling back to whatever asset the manifest
   * lists first in the (structurally impossible in practice, but never
   * assumed) case a collection has no `hero` asset. */
  coverAssetId: string;
  /** Section 10 "Asset Order" — every asset id in the real order the
   * generator assembled them (`manifest.assets`), never re-sorted. */
  assetOrder: string[];
  /** Section 10 "Palette Story" — one deterministic, fact-derived line
   * (never fabricated marketing copy, same convention
   * `buildCommercialNotes` already follows). */
  paletteStory: string;
  /** Section 10 "Layout Story" — one deterministic line naming the real
   * layout each pattern-type asset actually got. */
  layoutStory: string;
  /** Section 10 "Motif Family" — the collection's own real dominant motif
   * family (`manifest.motifFamily`) plus a one-line description. */
  motifFamily: { family: CollectionManifest['motifFamily']; description: string };
}

export function buildCollectionPreviewMetadata(collection: GeneratedCollection): CollectionPreviewMetadata {
  const score = computeCollectionScore(collection);
  const layouts = collection.patternTiles.map((t) => t.params.layoutId);
  const assetOrder = collection.manifest.assets.map((a) => a.id);
  return {
    assetRelationships: collection.manifest.relationships,
    colorStory: { variantCount: COLOR_STORY_VARIANT_IDS.length, variantIds: COLOR_STORY_VARIANT_IDS },
    layoutDiversity: { distinctLayouts: new Set(layouts).size, totalPatternAssets: layouts.length, score: score.layoutDiversity },
    motifConsistency: collection.manifest.consistency,
    commercialReadiness: score.commercialReadiness,
    coverAssetId: assetOrder.includes('hero') ? 'hero' : (assetOrder[0] ?? 'hero'),
    assetOrder,
    paletteStory: `${COLOR_STORY_VARIANT_IDS.length} coordinated palette variants available (${COLOR_STORY_VARIANT_IDS.join(', ')}), each preserving the collection's own base color count and ordering.`,
    layoutStory: `${new Set(layouts).size}/${layouts.length} pattern-type assets use a genuinely distinct layout: ${layouts.join(', ')}.`,
    motifFamily: {
      family: collection.manifest.motifFamily,
      description: `Every asset shares the "${collection.manifest.motifFamily}" motif family, generated from the "${collection.patternParams[0]?.categoryId ?? 'unknown'}" category.`,
    },
  };
}

/** Section 10, "Export Preparation" — structured data only, per the
 * brief's explicit "Do not implement export yet" instruction: no zip/file
 * writing happens here (that remains App.tsx's `buildAndDownloadCollectionZip`,
 * unmodified). This just shapes what a future export step would need,
 * assembled from data this module and its dependencies already computed. */
export interface CollectionExportPrep {
  collectionId: string;
  collectionName: string;
  recommendedFilenamePrefix: string;
  assetManifest: CollectionManifest['assets'];
  totalAssetCount: number;
  marketplaceTargets: MarketplaceId[];
  productUses: ProductUseId[];
}

export function prepareCollectionExport(spec: DesignSpecification, collection: GeneratedCollection): CollectionExportPrep {
  const plan = buildCollectionPlan(spec);
  return {
    collectionId: collection.manifest.collectionId,
    collectionName: plan.collectionName,
    recommendedFilenamePrefix: slugify(plan.collectionName) || 'collection',
    assetManifest: collection.manifest.assets,
    totalAssetCount: collection.assets.length,
    marketplaceTargets: buildMarketplaceTargets(spec),
    productUses: plan.recommendedProductUses,
  };
}
