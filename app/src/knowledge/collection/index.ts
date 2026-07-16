import { buildCollectionPlan, buildCollectionSpecification, type CollectionPlan, type CollectionSpecification } from '../../trend/collectionPlan';
import { evaluateProductTargets, recommendedProductUses, PRODUCT_USE_IDS, type ProductUseEvaluation, type ProductUseId, type ProductTargetsInput } from '../../collection/productTargets';
import { buildColorStory, COLOR_STORY_VARIANT_IDS, type ColorStorySet, type ColorStoryVariantId } from '../../collection/colorStory';
import { buildMotifReuseReport, type MotifReuseReport } from '../../collection/motifReuse';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import type { GeneratedCollection } from '../../collection/collectionGenerator';

// Design Knowledge Engine (Phase 6.5) — Section 8 "Collection Knowledge".
// A thin facade over `trend/collectionPlan.ts` (Collection Planner,
// Commercial Collection Engine Phase 4), `collection/productTargets.ts`
// (Product Targets — "Commercial Uses"), `collection/colorStory.ts`
// ("Variation Rules" — the real Color Story Engine), and
// `collection/motifReuse.ts` ("Asset Relationships"). A `CollectionPlan`
// already *is* the brief's "Collection Template" concept — a full
// creative brief (name/theme/marketplace targets/style/color story/
// product uses/size) derivable from a Design Specification alone, before
// anything is generated — so `getCollectionTemplate` is a direct alias,
// not a new template format.

export function getCollectionTemplate(spec: DesignSpecification): CollectionPlan {
  return buildCollectionPlan(spec);
}

export function getCollectionSpecification(spec: DesignSpecification, collection: GeneratedCollection): CollectionSpecification {
  return buildCollectionSpecification(spec, collection);
}

export function listProductUseIds(): ProductUseId[] {
  return PRODUCT_USE_IDS;
}

export function evaluateCollectionProductUses(input: ProductTargetsInput): ProductUseEvaluation[] {
  return evaluateProductTargets(input);
}

export function getRecommendedProductUses(evaluations: ProductUseEvaluation[], max = 4): ProductUseId[] {
  return recommendedProductUses(evaluations, max);
}

export function listColorStoryVariantIds(): ColorStoryVariantId[] {
  return COLOR_STORY_VARIANT_IDS;
}

/** The real Section 3 "Variation Rules" — deterministic HSL-transform
 * recipes, one per named variant (see collection/colorStory.ts's own
 * header for the real-colorist convention each recipe follows). */
export function getVariationRules(baseColors: string[]): ColorStorySet {
  return buildColorStory(baseColors);
}

/** Asset-relationship / motif-reuse reporting for an already-generated
 * collection — pass-through, since this operates on real generated-
 * collection data this module has no reason to duplicate. */
export function getAssetRelationships(
  relationships: GeneratedCollection['manifest']['relationships'],
  motifs: Parameters<typeof buildMotifReuseReport>[1],
  placements?: Parameters<typeof buildMotifReuseReport>[2],
): MotifReuseReport {
  return buildMotifReuseReport(relationships, motifs, placements);
}
