import type { Collection } from '../domain/collection';
import { createCollection, validateCollectionName, normalizeCollectionName } from '../domain/collection';
import { addCollectionMembership, removeCollectionMembership, removeInvalidMemberships } from '../domain/collectionMembership';
import type { PortfolioAsset } from '../domain/types';
import {
  loadCollections,
  getCollection,
  putCollectionRecord,
  putCollectionRecordsBulk,
  deleteCollectionCascade,
} from '../storage/collectionStore';
import { loadPortfolioAssets, getPortfolioAsset, putPortfolioAssetsBulk } from '../storage/portfolioStore';

// Portfolio Manager P2 Stage 1 — the business-logic layer for
// Collections: everything here composes `storage/collectionStore.ts` +
// `storage/portfolioStore.ts` (both already exist; this module adds no
// new IndexedDB access of its own) and the pure helpers in
// `domain/collection.ts` / `domain/collectionMembership.ts`. No UI code
// lives here (Stage 2, out of scope) — every function returns plain data
// or throws a typed error for a caller (future UI, or a test) to handle.

export class CollectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Collection ${id} not found.`);
    this.name = 'CollectionNotFoundError';
  }
}

export class DuplicateCollectionNameError extends Error {
  constructor(name: string) {
    super(`A collection named "${name}" already exists (case-insensitive match).`);
    this.name = 'DuplicateCollectionNameError';
  }
}

/** Rule 7's documented policy: archived collections accept no *new*
 * membership. Removal from an archived collection is still allowed (see
 * `removeAssetFromCollection`/`removeAssetsFromCollections`) — read-only
 * only blocks growth, not correction/cleanup, and `repairOrphanedCollectionIds`
 * must be able to shrink membership on any collection regardless of its
 * archive state. See ADR-005 for the full rationale. */
export class ArchivedCollectionError extends Error {
  constructor(id: string) {
    super(`Collection ${id} is archived — new asset assignments are not allowed. Unarchive it first.`);
    this.name = 'ArchivedCollectionError';
  }
}

export class InvalidCoverAssetError extends Error {
  constructor(assetId: string) {
    super(`Asset ${assetId} does not exist — cannot set it as a collection's cover asset.`);
    this.name = 'InvalidCoverAssetError';
  }
}

async function requireCollection(id: string): Promise<Collection> {
  const collection = await getCollection(id);
  if (!collection) throw new CollectionNotFoundError(id);
  return collection;
}

async function assertNameNotTaken(normalizedName: string, excludeId?: string): Promise<void> {
  const all = await loadCollections();
  const clash = all.find((c) => c.normalizedName === normalizedName && c.id !== excludeId);
  if (clash) throw new DuplicateCollectionNameError(clash.name);
}

// ---------------------------------------------------------------------
// Single-collection CRUD
// ---------------------------------------------------------------------

export interface CreateCollectionServiceInput {
  name: string;
  description?: string;
  coverAssetId?: string | null;
}

/** Validates the name (domain rule), enforces the case-insensitive
 * duplicate-name policy (service rule — not an IndexedDB `unique` index,
 * so the failure is a clear typed error rather than a raw
 * `ConstraintError`), and validates `coverAssetId` up front if given
 * (Rule 12). */
export async function createCollectionService(input: CreateCollectionServiceInput): Promise<Collection> {
  const cleanedName = validateCollectionName(input.name);
  await assertNameNotTaken(normalizeCollectionName(cleanedName));
  if (input.coverAssetId) {
    const asset = await getPortfolioAsset(input.coverAssetId);
    if (!asset) throw new InvalidCoverAssetError(input.coverAssetId);
  }
  const collection = createCollection({ name: cleanedName, description: input.description, coverAssetId: input.coverAssetId ?? null });
  await putCollectionRecord(collection);
  return collection;
}

export async function renameCollection(id: string, newName: string): Promise<Collection> {
  const collection = await requireCollection(id);
  const cleanedName = validateCollectionName(newName);
  const normalized = normalizeCollectionName(cleanedName);
  await assertNameNotTaken(normalized, id);
  const updated: Collection = { ...collection, name: cleanedName, normalizedName: normalized, updatedAt: Date.now() };
  await putCollectionRecord(updated);
  return updated;
}

export async function updateCollectionDescription(id: string, description: string): Promise<Collection> {
  const collection = await requireCollection(id);
  const updated: Collection = { ...collection, description: description.trim(), updatedAt: Date.now() };
  await putCollectionRecord(updated);
  return updated;
}

export async function archiveCollection(id: string): Promise<Collection> {
  const collection = await requireCollection(id);
  const now = Date.now();
  const updated: Collection = { ...collection, isArchived: true, archivedAt: now, updatedAt: now };
  await putCollectionRecord(updated);
  return updated;
}

/** Unarchiving never touches membership (Rule 6: "Archived collections
 * may retain existing members") — this only flips the two archive
 * fields back. */
export async function unarchiveCollection(id: string): Promise<Collection> {
  const collection = await requireCollection(id);
  const updated: Collection = { ...collection, isArchived: false, archivedAt: null, updatedAt: Date.now() };
  await putCollectionRecord(updated);
  return updated;
}

/** Rule 12: `coverAssetId` must reference an existing asset or be
 * `null` — validated synchronously here at write time. Rule 13 (the
 * asset is deleted *later*) is handled separately by
 * `repairCoverAssetIntegrity`, since that drift can't be caught at this
 * call site. */
export async function setCollectionCoverAsset(id: string, assetId: string | null): Promise<Collection> {
  const collection = await requireCollection(id);
  if (assetId !== null) {
    const asset = await getPortfolioAsset(assetId);
    if (!asset) throw new InvalidCoverAssetError(assetId);
  }
  const updated: Collection = { ...collection, coverAssetId: assetId, updatedAt: Date.now() };
  await putCollectionRecord(updated);
  return updated;
}

/** Rule 8 + Rule 9: deletes the collection record and removes its ID
 * from every asset that referenced it, atomically (`deleteCollectionCascade`)
 * — never deletes the assets themselves. */
export async function deleteCollectionSafely(id: string): Promise<void> {
  await requireCollection(id);
  const allAssets = await loadPortfolioAssets();
  const updatedAssets: PortfolioAsset[] = [];
  for (const asset of allAssets) {
    if (!asset.collectionIds.includes(id)) continue;
    updatedAssets.push({ ...asset, collectionIds: removeCollectionMembership(asset.collectionIds, id), updatedAt: Date.now() });
  }
  await deleteCollectionCascade(id, updatedAssets);
}

// ---------------------------------------------------------------------
// Bulk operation result shape (Section 6 of the brief)
// ---------------------------------------------------------------------

export interface BulkMembershipFailure {
  assetId: string;
  collectionId: string;
  reason: string;
}

export interface BulkMembershipResult {
  /** Total (assetId, collectionId) pairs requested — `assetIds.length * collectionIds.length`. */
  requestedCount: number;
  /** Pairs that actually changed membership. */
  changedCount: number;
  /** Pairs that were already in the requested state (e.g. already a
   * member, for assign; already not a member, for remove) — a no-op,
   * not a failure. */
  skippedCount: number;
  /** Pairs that could not be applied (missing asset, missing collection,
   * or — assign only — an archived collection). */
  failedCount: number;
  failures: BulkMembershipFailure[];
}

function emptyResult(requestedCount: number): BulkMembershipResult {
  return { requestedCount, changedCount: 0, skippedCount: 0, failedCount: 0, failures: [] };
}

// ---------------------------------------------------------------------
// Membership — bulk assign/remove
//
// Both functions read the full asset list and full collection list
// exactly ONCE regardless of how many (assetId, collectionId) pairs are
// requested, and write every changed asset in exactly ONE bulk
// transaction (`putPortfolioAssetsBulk`) — O(assetIds x collectionIds)
// in-memory work, O(1) database reads, O(1) write transactions. This is
// what keeps a 1,000-asset bulk assignment well under the performance
// target instead of scaling with a nested collections x assets x reads
// shape — see `docs/portfolio/P2_STAGE1_PERFORMANCE.md`.
// ---------------------------------------------------------------------

export async function assignAssetsToCollections(assetIds: string[], collectionIds: string[]): Promise<BulkMembershipResult> {
  const requestedCount = assetIds.length * collectionIds.length;
  const result = emptyResult(requestedCount);
  if (requestedCount === 0) return result;

  const [allAssets, allCollections] = await Promise.all([loadPortfolioAssets(), loadCollections()]);
  const assetMap = new Map(allAssets.map((a) => [a.assetId, a]));
  const collectionMap = new Map(allCollections.map((c) => [c.id, c]));
  const working = new Map<string, string[]>(); // assetId -> in-progress collectionIds
  const touchedAssetIds = new Set<string>();

  for (const assetId of assetIds) {
    const asset = assetMap.get(assetId);
    for (const collectionId of collectionIds) {
      if (!asset) {
        result.failedCount += 1;
        result.failures.push({ assetId, collectionId, reason: 'asset not found' });
        continue;
      }
      const collection = collectionMap.get(collectionId);
      if (!collection) {
        result.failedCount += 1;
        result.failures.push({ assetId, collectionId, reason: 'collection not found' });
        continue;
      }
      if (collection.isArchived) {
        result.failedCount += 1;
        result.failures.push({ assetId, collectionId, reason: 'collection is archived' });
        continue;
      }
      const current = working.get(assetId) ?? asset.collectionIds;
      const next = addCollectionMembership(current, collectionId);
      if (next === current) {
        result.skippedCount += 1;
      } else {
        working.set(assetId, next);
        touchedAssetIds.add(assetId);
        result.changedCount += 1;
      }
    }
  }

  if (touchedAssetIds.size > 0) {
    const now = Date.now();
    const updatedAssets = [...touchedAssetIds].map((id) => ({ ...assetMap.get(id)!, collectionIds: working.get(id)!, updatedAt: now }));
    await putPortfolioAssetsBulk(updatedAssets);
  }
  return result;
}

export async function removeAssetsFromCollections(assetIds: string[], collectionIds: string[]): Promise<BulkMembershipResult> {
  const requestedCount = assetIds.length * collectionIds.length;
  const result = emptyResult(requestedCount);
  if (requestedCount === 0) return result;

  const allAssets = await loadPortfolioAssets();
  const assetMap = new Map(allAssets.map((a) => [a.assetId, a]));
  const working = new Map<string, string[]>();
  const touchedAssetIds = new Set<string>();

  for (const assetId of assetIds) {
    const asset = assetMap.get(assetId);
    for (const collectionId of collectionIds) {
      if (!asset) {
        result.failedCount += 1;
        result.failures.push({ assetId, collectionId, reason: 'asset not found' });
        continue;
      }
      // Removal is allowed regardless of the collection's archive state
      // or even its continued existence (Rule 7's read-only policy only
      // blocks new assignments) — see the class comment on
      // `ArchivedCollectionError`.
      const current = working.get(assetId) ?? asset.collectionIds;
      const next = removeCollectionMembership(current, collectionId);
      if (next === current) {
        result.skippedCount += 1;
      } else {
        working.set(assetId, next);
        touchedAssetIds.add(assetId);
        result.changedCount += 1;
      }
    }
  }

  if (touchedAssetIds.size > 0) {
    const now = Date.now();
    const updatedAssets = [...touchedAssetIds].map((id) => ({ ...assetMap.get(id)!, collectionIds: working.get(id)!, updatedAt: now }));
    await putPortfolioAssetsBulk(updatedAssets);
  }
  return result;
}

/** Single-pair convenience wrappers over the bulk functions above (Section
 * 6: "add one asset to one collection" / "remove one asset from one
 * collection") — reuses the same validated logic rather than
 * duplicating it, and turns a bulk failure into a thrown typed error
 * since a single-item caller wants an exception, not a result object to
 * inspect. */
export async function assignAssetToCollection(assetId: string, collectionId: string): Promise<void> {
  const result = await assignAssetsToCollections([assetId], [collectionId]);
  if (result.failedCount > 0) {
    const reason = result.failures[0].reason;
    if (reason === 'collection not found') throw new CollectionNotFoundError(collectionId);
    if (reason === 'collection is archived') throw new ArchivedCollectionError(collectionId);
    throw new Error(`Could not assign asset ${assetId} to collection ${collectionId}: ${reason}`);
  }
}

export async function removeAssetFromCollection(assetId: string, collectionId: string): Promise<void> {
  const result = await removeAssetsFromCollections([assetId], [collectionId]);
  if (result.failedCount > 0) {
    throw new Error(`Could not remove asset ${assetId} from collection ${collectionId}: ${result.failures[0].reason}`);
  }
}

// ---------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------

export async function getAssetsForCollection(collectionId: string): Promise<PortfolioAsset[]> {
  const all = await loadPortfolioAssets();
  return all.filter((a) => a.collectionIds.includes(collectionId));
}

export async function getCollectionsForAsset(assetId: string): Promise<Collection[]> {
  const asset = await getPortfolioAsset(assetId);
  if (!asset || asset.collectionIds.length === 0) return [];
  const memberOf = new Set(asset.collectionIds);
  const all = await loadCollections();
  return all.filter((c) => memberOf.has(c.id));
}

// ---------------------------------------------------------------------
// Integrity validation + repair (Rules 11, 12, 13)
// ---------------------------------------------------------------------

export interface OrphanedMembership {
  assetId: string;
  invalidCollectionIds: string[];
}

export interface InvalidCoverAssetReference {
  collectionId: string;
  coverAssetId: string;
}

export interface CollectionIntegrityReport {
  generatedAt: number;
  totalCollections: number;
  totalAssets: number;
  /** Assets whose `collectionIds` reference a collection that no longer
   * exists (Rule 11). */
  orphanedMemberships: OrphanedMembership[];
  /** Collections whose `coverAssetId` references an asset that no
   * longer exists (Rule 13). */
  invalidCoverAssetReferences: InvalidCoverAssetReference[];
}

/** Reads every collection and every asset exactly once (no per-asset or
 * per-collection extra database round-trip), builds two `Set`s for O(1)
 * membership checks, then does a single linear pass over assets and a
 * single linear pass over collections — O(collections + assets x
 * avgMembership), never O(collections x assets). */
export async function validateCollectionIntegrity(): Promise<CollectionIntegrityReport> {
  const [allCollections, allAssets] = await Promise.all([loadCollections(), loadPortfolioAssets()]);
  const collectionIdSet = new Set(allCollections.map((c) => c.id));
  const assetIdSet = new Set(allAssets.map((a) => a.assetId));

  const orphanedMemberships: OrphanedMembership[] = [];
  for (const asset of allAssets) {
    const invalid = asset.collectionIds.filter((id) => !collectionIdSet.has(id));
    if (invalid.length > 0) orphanedMemberships.push({ assetId: asset.assetId, invalidCollectionIds: invalid });
  }

  const invalidCoverAssetReferences: InvalidCoverAssetReference[] = [];
  for (const collection of allCollections) {
    if (collection.coverAssetId !== null && !assetIdSet.has(collection.coverAssetId)) {
      invalidCoverAssetReferences.push({ collectionId: collection.id, coverAssetId: collection.coverAssetId });
    }
  }

  return {
    generatedAt: Date.now(),
    totalCollections: allCollections.length,
    totalAssets: allAssets.length,
    orphanedMemberships,
    invalidCoverAssetReferences,
  };
}

/** Rule 11's repair half: removes every invalid `collectionId` found by
 * `validateCollectionIntegrity` from the affected assets, in one bulk
 * write. Reuses a freshly-computed report rather than trusting a
 * caller-supplied stale one, so a repair always acts on current data. */
export async function repairOrphanedCollectionIds(): Promise<BulkMembershipResult> {
  const report = await validateCollectionIntegrity();
  const result = emptyResult(report.orphanedMemberships.length);
  if (report.orphanedMemberships.length === 0) return result;

  const allAssets = await loadPortfolioAssets();
  const assetMap = new Map(allAssets.map((a) => [a.assetId, a]));
  const now = Date.now();
  const updatedAssets: PortfolioAsset[] = [];

  for (const { assetId, invalidCollectionIds } of report.orphanedMemberships) {
    const asset = assetMap.get(assetId);
    if (!asset) {
      result.failedCount += 1;
      result.failures.push({ assetId, collectionId: invalidCollectionIds[0], reason: 'asset not found (deleted since report was generated)' });
      continue;
    }
    const next = removeInvalidMemberships(asset.collectionIds, new Set(invalidCollectionIds));
    updatedAssets.push({ ...asset, collectionIds: next, updatedAt: now });
    result.changedCount += 1;
  }

  if (updatedAssets.length > 0) await putPortfolioAssetsBulk(updatedAssets);
  return result;
}

/** Rule 13's documented policy: a stale `coverAssetId` (its asset was
 * deleted after being set as a cover) is detected lazily by
 * `validateCollectionIntegrity` and cleared to `null` here, rather than
 * being cleaned up automatically and immediately at asset-deletion time.
 * This is a deliberate Stage 1 scope decision — see ADR-005 — made to
 * avoid coupling collection bookkeeping into P1's stable, unmodified
 * `deletePortfolioAssetRecordOnly`/`deletePortfolioAssetAndFiles` API. */
export async function repairCoverAssetIntegrity(): Promise<BulkMembershipResult> {
  const report = await validateCollectionIntegrity();
  const result = emptyResult(report.invalidCoverAssetReferences.length);
  if (report.invalidCoverAssetReferences.length === 0) return result;

  const allCollections = await loadCollections();
  const collectionMap = new Map(allCollections.map((c) => [c.id, c]));
  const now = Date.now();
  const updated: Collection[] = [];

  for (const { collectionId, coverAssetId } of report.invalidCoverAssetReferences) {
    const collection = collectionMap.get(collectionId);
    if (!collection) {
      result.failedCount += 1;
      result.failures.push({ assetId: coverAssetId, collectionId, reason: 'collection not found (deleted since report was generated)' });
      continue;
    }
    updated.push({ ...collection, coverAssetId: null, updatedAt: now });
    result.changedCount += 1;
  }

  if (updated.length > 0) await putCollectionRecordsBulk(updated);
  return result;
}
