// Portfolio Manager P2 Stage 1 — pure helpers for the many-to-many
// asset<->collection relationship, which is stored on the asset side
// (`PortfolioAsset.collectionIds: string[]`, see `domain/collection.ts`'s
// header comment / ADR-005). Kept separate from `domain/collection.ts`
// (which owns the `Collection` record itself) since these operate on
// `PortfolioAsset.collectionIds`, not on a `Collection`. Pure and
// synchronous — `services/collectionService.ts` is the only caller, and
// is responsible for persisting the result via `storage/portfolioStore.ts`.

/** Adds `collectionId` to `collectionIds` if not already present (Rule 4:
 * "Duplicate collection membership is invalid") — returns the *same*
 * array reference when no change was needed, so callers can cheaply
 * detect a no-op via `result === collectionIds` without a deep-equal
 * check (used by bulk operations to compute `skippedCount`). */
export function addCollectionMembership(collectionIds: string[], collectionId: string): string[] {
  if (collectionIds.includes(collectionId)) return collectionIds;
  return [...collectionIds, collectionId];
}

export function removeCollectionMembership(collectionIds: string[], collectionId: string): string[] {
  if (!collectionIds.includes(collectionId)) return collectionIds;
  return collectionIds.filter((id) => id !== collectionId);
}

/** De-duplicates while preserving first-seen order — used defensively by
 * `normalizePortfolioAsset`-adjacent integrity repair, in case a record
 * ever accumulates a duplicate through a path other than
 * `addCollectionMembership` (e.g. a hand-edited import). */
export function dedupeCollectionIds(collectionIds: string[]): string[] {
  return [...new Set(collectionIds)];
}

/** Removes every ID in `invalidIds` from `collectionIds` — used by
 * `collectionService.repairOrphanedCollectionIds()` (Rule 11). Returns
 * the same array reference when nothing was removed. */
export function removeInvalidMemberships(collectionIds: string[], invalidIds: ReadonlySet<string>): string[] {
  if (!collectionIds.some((id) => invalidIds.has(id))) return collectionIds;
  return collectionIds.filter((id) => !invalidIds.has(id));
}
