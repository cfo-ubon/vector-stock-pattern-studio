import type { Collection } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';
import { loadCollections, putCollectionRecordsBulk } from '../storage/collectionStore';
import { loadPortfolioAssets, putPortfolioAssetsBulk } from '../storage/portfolioStore';
import { readBackupPayload } from './backupBuilder';
import { validateBackupArchive } from './backupValidation';
import type { BackupValidationReport } from './backupValidation';
import type { BackupArchive, BackupPayload } from './backupFormat';

// Portfolio Manager P3 — restore engine. Built entirely on the frozen
// Collection API's own bulk-write primitives (`putCollectionRecordsBulk`,
// `putPortfolioAssetsBulk` — both carrying Sprint 3's proven atomicity
// fix) so restore inherits their all-or-nothing-per-call guarantee
// without this module needing to touch IndexedDB directly at all. Two
// separate bulk calls (collections, then memberships) are NOT atomic
// with each other — see `computeRestorePlan`'s doc comment and
// `RESTORE_WORKFLOW.md`'s "Interrupted restore" section for why that is
// a deliberate, tested, self-healing design rather than a gap.

export type RestoreMode = 'overwrite' | 'merge';

export class BackupRestoreError extends Error {
  readonly validation: BackupValidationReport;
  constructor(message: string, validation: BackupValidationReport) {
    super(message);
    this.name = 'BackupRestoreError';
    this.validation = validation;
  }
}

export type CollectionDiffKind = 'create' | 'unchanged' | 'conflict';
export type ResolvedCollectionAction = 'create' | 'update' | 'keep-current' | 'unchanged';

export interface CollectionPreviewEntry {
  collectionId: string;
  name: string;
  diff: CollectionDiffKind;
  /** Populated only when `diff === 'conflict'` — which fields differ
   * between the live collection and the backup's version. */
  conflictingFields: string[];
  /** What restoring with the given `mode` would actually do to this one
   * collection — always derivable from `diff` + `mode`, computed here so
   * callers never have to re-derive the mode's own resolution rule. */
  resolvedAction: ResolvedCollectionAction;
}

export interface RestorePreview {
  mode: RestoreMode;
  /** False when the archive is too broken to preview at all (see
   * `validation` for why) — `collections` is empty and every count is 0
   * in that case, never a partial/best-effort preview. */
  previewable: boolean;
  collections: CollectionPreviewEntry[];
  toCreateCount: number;
  toUpdateCount: number;
  unchangedCount: number;
  conflictCount: number;
  membershipsToAdd: number;
  /** Always 0 in `merge` mode — merge never removes an existing
   * membership, by design (see the module header comment). */
  membershipsToRemove: number;
  missingLiveAssetIds: string[];
  validation: BackupValidationReport;
}

export interface RestoreResult {
  mode: RestoreMode;
  collectionsCreated: number;
  collectionsUpdated: number;
  collectionsUnchanged: number;
  membershipsAdded: number;
  membershipsRemoved: number;
  skippedMissingAssetIds: string[];
  validation: BackupValidationReport;
}

function resolveAction(diff: CollectionDiffKind, mode: RestoreMode): ResolvedCollectionAction {
  if (diff === 'create') return 'create';
  if (diff === 'unchanged') return 'unchanged';
  // diff === 'conflict'
  return mode === 'overwrite' ? 'update' : 'keep-current';
}

function diffCollections(backup: Collection, live: Collection): string[] {
  const fields: string[] = [];
  if (backup.name !== live.name) fields.push('name');
  if (backup.description !== live.description) fields.push('description');
  if (backup.coverAssetId !== live.coverAssetId) fields.push('coverAssetId');
  if (backup.isArchived !== live.isArchived) fields.push('isArchived');
  return fields;
}

interface RestorePlan {
  payload: BackupPayload;
  liveCollectionsById: Map<string, Collection>;
  liveAssetsById: Map<string, PortfolioAsset>;
  collectionEntries: { collection: Collection; diff: CollectionDiffKind; conflictingFields: string[] }[];
  /** Final `collectionIds` set per touched asset, already reflecting the
   * requested `mode`'s rule (overwrite replaces the backup-covered
   * subset; merge only adds) — the exact set `restoreBackup` will write,
   * and the exact set `previewRestore` diffs against current state to
   * report `membershipsToAdd`/`membershipsToRemove`. */
  finalMembershipByAsset: Map<string, Set<string>>;
  missingLiveAssetIds: string[];
  validation: BackupValidationReport;
}

/** The one place restore logic actually lives — both `previewRestore`
 * (read-only) and `restoreBackup` (which additionally writes this exact
 * plan) call this, so a preview can never show something restore then
 * does differently. Returns `null` when the archive is too structurally
 * broken to compute a plan from at all (see `validation` for why) —
 * distinct from a plan with zero changes, which is a valid, "nothing to
 * do" outcome. */
async function computeRestorePlan(archive: BackupArchive, mode: RestoreMode): Promise<RestorePlan | null> {
  const validation = await validateBackupArchive(archive, { crossCheckLiveAssets: true });
  if (!validation.structurallySound || !validation.schemaVersionSupported || validation.checksumValid === false) {
    return null;
  }

  const payload = await readBackupPayload(archive);
  const [liveCollections, liveAssets] = await Promise.all([loadCollections(), loadPortfolioAssets()]);
  const liveCollectionsById = new Map(liveCollections.map((c) => [c.id, c]));
  const liveAssetsById = new Map(liveAssets.map((a) => [a.assetId, a]));
  const liveAssetIds = new Set(liveAssetsById.keys());

  const collectionEntries = payload.collections.map((backupCollection) => {
    const live = liveCollectionsById.get(backupCollection.id);
    if (!live) return { collection: backupCollection, diff: 'create' as const, conflictingFields: [] };
    const conflictingFields = diffCollections(backupCollection, live);
    return { collection: backupCollection, diff: (conflictingFields.length === 0 ? 'unchanged' : 'conflict') as CollectionDiffKind, conflictingFields };
  });

  const backupCoveredCollectionIds = new Set(payload.collections.map((c) => c.id));
  const finalMembershipByAsset = new Map<string, Set<string>>();
  const touch = (assetId: string): Set<string> => {
    let set = finalMembershipByAsset.get(assetId);
    if (!set) {
      const live = liveAssetsById.get(assetId);
      set = new Set(live ? live.collectionIds : []);
      finalMembershipByAsset.set(assetId, set);
    }
    return set;
  };

  // Seed every live asset that currently belongs to any backup-covered
  // collection, so overwrite mode's removal step (below) has something
  // to remove from even if the backup's membership list omits them.
  for (const asset of liveAssets) {
    if (asset.collectionIds.some((id) => backupCoveredCollectionIds.has(id))) touch(asset.assetId);
  }
  // Overwrite mode: for every touched asset, drop membership in every
  // backup-covered collection first — the backup's own membership list
  // (added back below) is then the complete, authoritative truth for
  // those collections. Merge mode skips this entirely: it only ever
  // adds, never removes, by design.
  if (mode === 'overwrite') {
    for (const set of finalMembershipByAsset.values()) {
      for (const cid of backupCoveredCollectionIds) set.delete(cid);
    }
  }

  const missingLiveAssetIds: string[] = [];
  for (const membership of payload.memberships) {
    if (!liveAssetIds.has(membership.assetId)) {
      missingLiveAssetIds.push(membership.assetId);
      continue;
    }
    const set = touch(membership.assetId);
    for (const cid of membership.collectionIds) {
      if (backupCoveredCollectionIds.has(cid)) set.add(cid);
    }
  }

  return { payload, liveCollectionsById, liveAssetsById, collectionEntries, finalMembershipByAsset, missingLiveAssetIds, validation };
}

export async function previewRestore(archive: BackupArchive, mode: RestoreMode): Promise<RestorePreview> {
  const plan = await computeRestorePlan(archive, mode);
  if (!plan) {
    const validation = await validateBackupArchive(archive, { crossCheckLiveAssets: true });
    return { mode, previewable: false, collections: [], toCreateCount: 0, toUpdateCount: 0, unchangedCount: 0, conflictCount: 0, membershipsToAdd: 0, membershipsToRemove: 0, missingLiveAssetIds: [], validation };
  }

  const collections: CollectionPreviewEntry[] = plan.collectionEntries.map(({ collection, diff, conflictingFields }) => ({
    collectionId: collection.id,
    name: collection.name,
    diff,
    conflictingFields,
    resolvedAction: resolveAction(diff, mode),
  }));

  let membershipsToAdd = 0;
  let membershipsToRemove = 0;
  for (const [assetId, finalSet] of plan.finalMembershipByAsset) {
    const liveSet = new Set(plan.liveAssetsById.get(assetId)?.collectionIds ?? []);
    for (const cid of finalSet) if (!liveSet.has(cid)) membershipsToAdd++;
    for (const cid of liveSet) if (!finalSet.has(cid)) membershipsToRemove++;
  }

  return {
    mode,
    previewable: true,
    collections,
    toCreateCount: collections.filter((c) => c.resolvedAction === 'create').length,
    toUpdateCount: collections.filter((c) => c.resolvedAction === 'update').length,
    unchangedCount: collections.filter((c) => c.resolvedAction === 'unchanged' || c.resolvedAction === 'keep-current').length,
    conflictCount: collections.filter((c) => c.diff === 'conflict').length,
    membershipsToAdd,
    membershipsToRemove,
    missingLiveAssetIds: plan.missingLiveAssetIds,
    validation: plan.validation,
  };
}

/** Executes the exact plan `previewRestore` would show for the same
 * archive+mode. Refuses to write anything (throws `BackupRestoreError`)
 * if the archive is not structurally trustworthy — a broken archive
 * must never partially apply. "Cancel" is simply not calling this
 * function after inspecting a preview; there is nothing to undo because
 * nothing was written yet. */
export async function restoreBackup(archive: BackupArchive, mode: RestoreMode): Promise<RestoreResult> {
  const plan = await computeRestorePlan(archive, mode);
  if (!plan) {
    const validation = await validateBackupArchive(archive, { crossCheckLiveAssets: true });
    throw new BackupRestoreError('This backup archive cannot be restored — it failed structural validation. See the validation report for details.', validation);
  }

  const now = Date.now();
  const collectionsToWrite: Collection[] = [];
  let collectionsCreated = 0;
  let collectionsUpdated = 0;
  let collectionsUnchanged = 0;
  for (const { collection, diff } of plan.collectionEntries) {
    const action = resolveAction(diff, mode);
    if (action === 'create') {
      collectionsToWrite.push({ ...collection, updatedAt: now });
      collectionsCreated++;
    } else if (action === 'update') {
      const live = plan.liveCollectionsById.get(collection.id)!;
      collectionsToWrite.push({ ...collection, createdAt: live.createdAt, updatedAt: now });
      collectionsUpdated++;
    } else {
      collectionsUnchanged++;
    }
  }
  if (collectionsToWrite.length > 0) await putCollectionRecordsBulk(collectionsToWrite);

  const assetsToWrite: PortfolioAsset[] = [];
  let membershipsAdded = 0;
  let membershipsRemoved = 0;
  for (const [assetId, finalSet] of plan.finalMembershipByAsset) {
    const live = plan.liveAssetsById.get(assetId)!;
    const liveSet = new Set(live.collectionIds);
    const finalArray = [...finalSet];
    const changed = finalArray.length !== liveSet.size || finalArray.some((id) => !liveSet.has(id));
    for (const cid of finalSet) if (!liveSet.has(cid)) membershipsAdded++;
    for (const cid of liveSet) if (!finalSet.has(cid)) membershipsRemoved++;
    if (changed) assetsToWrite.push({ ...live, collectionIds: finalArray, updatedAt: now });
  }
  if (assetsToWrite.length > 0) await putPortfolioAssetsBulk(assetsToWrite);

  return {
    mode,
    collectionsCreated,
    collectionsUpdated,
    collectionsUnchanged,
    membershipsAdded,
    membershipsRemoved,
    skippedMissingAssetIds: plan.missingLiveAssetIds,
    validation: plan.validation,
  };
}
