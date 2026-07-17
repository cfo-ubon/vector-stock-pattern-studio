import { loadCollections } from '../storage/collectionStore';
import { loadPortfolioAssets } from '../storage/portfolioStore';
import { validateCollectionIntegrity } from '../services/collectionService';

// Portfolio Manager P2.5 Sprint 2 — IndexedDB consistency manifest and
// diff (Section 8). Captures a real snapshot of the current stored data
// (via the same unmodified `loadCollections`/`loadPortfolioAssets`/
// `validateCollectionIntegrity` Sprint 1 already used) before and after a
// stress/soak run, then reports a machine-readable diff. This never
// mutates anything — `captureConsistencySnapshot` only reads.
//
// `duplicateCollectionIdAssetCount` is measured directly here (a plain
// scan over each asset's own `collectionIds`), not via
// `validateCollectionIntegrity`'s report — Sprint 1 documented that the
// scanner does not detect this condition (see
// `docs/portfolio/TECHNICAL_DEBT_REGISTER.md`'s P2.5-1). Measuring it
// directly for the consistency manifest is not "adding detection to the
// scanner" — it is a separate, read-only count this module computes for
// its own reporting purposes.

export interface ConsistencySnapshot {
  capturedAt: number;
  assetCount: number;
  collectionCount: number;
  activeCollectionCount: number;
  archivedCollectionCount: number;
  /** Sum of `collectionIds.length` across every asset — includes any
   * orphaned/duplicate entries, intentionally (this is a raw structural
   * count, not a "valid memberships only" count). */
  membershipCount: number;
  orphanCount: number;
  staleCoverCount: number;
  duplicateCollectionIdAssetCount: number;
}

export async function captureConsistencySnapshot(): Promise<ConsistencySnapshot> {
  const [collections, assets, report] = await Promise.all([loadCollections(), loadPortfolioAssets(), validateCollectionIntegrity()]);
  let membershipCount = 0;
  let duplicateCollectionIdAssetCount = 0;
  for (const asset of assets) {
    membershipCount += asset.collectionIds.length;
    if (new Set(asset.collectionIds).size < asset.collectionIds.length) duplicateCollectionIdAssetCount++;
  }
  return {
    capturedAt: Date.now(),
    assetCount: assets.length,
    collectionCount: collections.length,
    activeCollectionCount: collections.filter((c) => !c.isArchived).length,
    archivedCollectionCount: collections.filter((c) => c.isArchived).length,
    membershipCount,
    orphanCount: report.orphanedMemberships.length,
    staleCoverCount: report.invalidCoverAssetReferences.length,
    duplicateCollectionIdAssetCount,
  };
}

/** What the caller expects the net counts to look like after the run —
 * e.g. a stress run that creates and then deletes N temporary
 * collections expects `collectionCountDelta: 0`, not "no idea." Any
 * deviation from these expectations is flagged as an unexplained
 * mismatch rather than silently accepted. */
export interface ExpectedMutation {
  assetCountDelta?: number;
  collectionCountDelta?: number;
}

export interface ConsistencyDiff {
  before: ConsistencySnapshot;
  after: ConsistencySnapshot;
  assetCountDelta: number;
  collectionCountDelta: number;
  membershipCountDelta: number;
  orphanCountDelta: number;
  staleCoverCountDelta: number;
  duplicateCollectionIdAssetCountDelta: number;
  unexplainedAssetCountMismatch: boolean;
  unexplainedCollectionCountMismatch: boolean;
  newOrphansIntroduced: boolean;
  newStaleCoversIntroduced: boolean;
  notes: string[];
}

export function diffConsistencySnapshots(before: ConsistencySnapshot, after: ConsistencySnapshot, expected: ExpectedMutation = {}): ConsistencyDiff {
  const assetCountDelta = after.assetCount - before.assetCount;
  const collectionCountDelta = after.collectionCount - before.collectionCount;
  const membershipCountDelta = after.membershipCount - before.membershipCount;
  const orphanCountDelta = after.orphanCount - before.orphanCount;
  const staleCoverCountDelta = after.staleCoverCount - before.staleCoverCount;
  const duplicateCollectionIdAssetCountDelta = after.duplicateCollectionIdAssetCount - before.duplicateCollectionIdAssetCount;

  const expectedAssetDelta = expected.assetCountDelta ?? 0;
  const expectedCollectionDelta = expected.collectionCountDelta ?? 0;
  const unexplainedAssetCountMismatch = assetCountDelta !== expectedAssetDelta;
  const unexplainedCollectionCountMismatch = collectionCountDelta !== expectedCollectionDelta;
  const newOrphansIntroduced = orphanCountDelta > 0;
  const newStaleCoversIntroduced = staleCoverCountDelta > 0;

  const notes: string[] = [];
  if (unexplainedAssetCountMismatch) notes.push(`Asset count changed by ${assetCountDelta}, expected ${expectedAssetDelta}.`);
  if (unexplainedCollectionCountMismatch) notes.push(`Collection count changed by ${collectionCountDelta}, expected ${expectedCollectionDelta}.`);
  if (newOrphansIntroduced) notes.push(`${orphanCountDelta} new orphaned membership(s) introduced during the run.`);
  if (newStaleCoversIntroduced) notes.push(`${staleCoverCountDelta} new stale cover reference(s) introduced during the run.`);
  if (duplicateCollectionIdAssetCountDelta > 0) notes.push(`${duplicateCollectionIdAssetCountDelta} new asset(s) with a duplicate collectionId entry.`);

  return {
    before,
    after,
    assetCountDelta,
    collectionCountDelta,
    membershipCountDelta,
    orphanCountDelta,
    staleCoverCountDelta,
    duplicateCollectionIdAssetCountDelta,
    unexplainedAssetCountMismatch,
    unexplainedCollectionCountMismatch,
    newOrphansIntroduced,
    newStaleCoversIntroduced,
    notes,
  };
}
