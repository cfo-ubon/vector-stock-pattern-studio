import {
  createCollectionPlan,
  COLLECTION_PATTERN_TYPE_VALUES,
  type CollectionPatternType,
  type CollectionPlan,
  type PatternTypeCounts,
} from '../domain/collectionPlan';
import type { CreativeBrief } from '../domain/creativeBrief';

// Build 028B — Module 2: Collection Planner. Divides a Creative Brief's
// `collectionSize` into the 8 pattern-type categories using one documented,
// editable default ratio — the standard commercial surface-pattern
// collection structure real studios use (one hero print, a handful of
// coordinating secondary/blender prints to round out a "collection" rather
// than a single design, some stripe/texture filler for coordinating rolls,
// and border/mini-pattern/coordinate prints for specific product formats).
// This is a real, inspectable starting point, not a fabricated number — and
// every count stays user-editable after the plan is created.

const DEFAULT_RATIO: Record<CollectionPatternType, number> = {
  hero: 0.1,
  secondary: 0.25,
  blender: 0.2,
  stripe: 0.1,
  border: 0.1,
  coordinate: 0.15,
  miniPattern: 0.05,
  texture: 0.05,
};

/** Splits `totalSize` across the 8 pattern types using `ratio` (defaults to
 * `DEFAULT_RATIO`), rounding down for every type and assigning the leftover
 * remainder to `secondary` (this collection's biggest bucket, so a small
 * rounding remainder never distorts a minor category like `texture`). */
export function defaultPatternTypeRatios(totalSize: number, ratio: Record<CollectionPatternType, number> = DEFAULT_RATIO): PatternTypeCounts {
  const counts = {} as PatternTypeCounts;
  let assigned = 0;
  for (const type of COLLECTION_PATTERN_TYPE_VALUES) {
    const count = Math.floor(totalSize * ratio[type]);
    counts[type] = count;
    assigned += count;
  }
  counts.secondary += Math.max(0, totalSize - assigned);
  return counts;
}

export interface BuildCollectionPlanOptions {
  patternTypeCounts?: PatternTypeCounts;
  colorwayCount?: number;
  now?: number;
}

export function buildCollectionPlan(brief: CreativeBrief, options: BuildCollectionPlanOptions = {}): CollectionPlan {
  const patternTypeCounts = options.patternTypeCounts ?? defaultPatternTypeRatios(brief.collectionSize);
  return createCollectionPlan({
    briefId: brief.id,
    name: brief.collectionName,
    theme: brief.theme,
    totalSize: brief.collectionSize,
    patternTypeCounts,
    colorwayCount: options.colorwayCount ?? 3,
    targetMarketplace: brief.targetMarketplace,
    targetProducts: brief.targetProducts,
    now: options.now,
  });
}

export { DEFAULT_RATIO as DEFAULT_PATTERN_TYPE_RATIO };
