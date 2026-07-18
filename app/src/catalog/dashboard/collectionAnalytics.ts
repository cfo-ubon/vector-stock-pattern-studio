import type { Collection } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';

// Build 017 — Collection Analytics. Read-only integration over the
// frozen Collection API's own types (`Collection`, `PortfolioAsset`) —
// this module never imports `collectionService.ts`/`collectionStore.ts`,
// only the plain data shapes, and never calls anything that writes.
// Membership is derived exactly the way the frozen API itself models it
// (`PortfolioAsset.collectionIds`, not a separate join a Collection
// record owns), so this reads the real relationship, not a shadow copy.

export interface CollectionSummary {
  collectionId: string;
  name: string;
  patternCount: number;
}

export interface CollectionAnalytics {
  collectionCount: number;
  /** Distinct patterns that belong to at least one collection —
   * "organized" patterns, not the portfolio's total catalog size (an
   * asset with `collectionIds: []` is not counted here; see
   * `readinessAnalytics.ts`/`portfolioHealthCalculator.ts`'s "Collection
   * Organization" component for how the *un*-organized remainder
   * factors into portfolio health). */
  patternCount: number;
  /** `patternCount / collectionCount`, rounded to 1 decimal place; `0`
   * when there are no collections (nothing to divide by). */
  averagePatternsPerCollection: number;
  /** `null` when there are no collections at all — distinct from a real
   * collection that happens to have 0 patterns, which is reported in
   * `emptyCollections` instead. */
  largestCollection: CollectionSummary | null;
  emptyCollections: CollectionSummary[];
  /** Patterns that belong to MORE than one collection — organizational
   * duplication (the same pattern filed under several collections),
   * distinct from `portfolioHealthCalculator.ts`'s "Duplicate Risk"
   * component (which is about duplicate *submissions*, not duplicate
   * *filing*). Not inherently a problem — a pattern legitimately
   * belonging to "Spring 2026" and "Florals" both is normal — but worth
   * surfacing as a fact. */
  duplicatePatternUsage: { assetId: string; collectionCount: number }[];
}

export function computeCollectionAnalytics(collections: Collection[], assets: PortfolioAsset[]): CollectionAnalytics {
  const patternCountByCollection = new Map<string, number>(collections.map((c) => [c.id, 0]));
  const organizedPatternIds = new Set<string>();
  const duplicatePatternUsage: { assetId: string; collectionCount: number }[] = [];

  for (const asset of assets) {
    if (asset.collectionIds.length === 0) continue;
    organizedPatternIds.add(asset.assetId);
    if (asset.collectionIds.length > 1) {
      duplicatePatternUsage.push({ assetId: asset.assetId, collectionCount: asset.collectionIds.length });
    }
    for (const collectionId of asset.collectionIds) {
      if (patternCountByCollection.has(collectionId)) {
        patternCountByCollection.set(collectionId, patternCountByCollection.get(collectionId)! + 1);
      }
    }
  }

  const summaries: CollectionSummary[] = collections.map((c) => ({ collectionId: c.id, name: c.name, patternCount: patternCountByCollection.get(c.id) ?? 0 }));
  const emptyCollections = summaries.filter((s) => s.patternCount === 0);
  const largestCollection = summaries.reduce<CollectionSummary | null>((largest, current) => (!largest || current.patternCount > largest.patternCount ? current : largest), null);
  // Sum of each collection's own size (not `organizedPatternIds.size`) —
  // a pattern filed under 2 collections legitimately makes both of those
  // collections 1 pattern bigger, so it must count twice here even
  // though it is only 1 distinct pattern overall (`patternCount` above).
  const totalMemberships = summaries.reduce((sum, s) => sum + s.patternCount, 0);

  return {
    collectionCount: collections.length,
    patternCount: organizedPatternIds.size,
    averagePatternsPerCollection: collections.length === 0 ? 0 : Math.round((totalMemberships / collections.length) * 10) / 10,
    largestCollection,
    emptyCollections,
    duplicatePatternUsage,
  };
}
