import { createRng, rngInt } from '../../engine/rng';
import type { Rng } from '../../engine/types';
import type { Collection } from '../domain/collection';
import { COLLECTION_SCHEMA_VERSION } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';
import { PORTFOLIO_ASSET_SCHEMA_VERSION } from '../domain/types';
import { deterministicAssetId, deterministicCollectionId, GHOST_ASSET_ID, GHOST_COLLECTION_ID } from './deterministicIds';
import type { DatasetGeneratorConfig, DatasetManifest } from './types';
import { DATASET_GENERATOR_VERSION, DATASET_MANIFEST_SCHEMA_VERSION, InvalidDatasetConfigError } from './types';

// Portfolio Manager P2.5 Sprint 1 — deterministic Collection validation
// dataset generator (Section 3). Builds `Collection[]`/`PortfolioAsset[]`
// entirely in memory using the real domain shapes (`Collection`,
// `PortfolioAsset` from `catalog/domain/*`) — no IndexedDB access here;
// `validationDb.ts` is the separate, optional persistence layer for
// integration benchmarks (Section 3, capability 2). This keeps "build the
// dataset" and "write the dataset somewhere" independently testable and
// keeps pure-generator benchmarks (Section 5A) free of any storage cost.

export interface GeneratedDataset {
  collections: Collection[];
  assets: PortfolioAsset[];
  manifest: DatasetManifest;
}

export function validateDatasetConfig(config: DatasetGeneratorConfig): void {
  const fail = (msg: string): never => {
    throw new InvalidDatasetConfigError(msg);
  };
  if (typeof config.seed !== 'string' || config.seed.length === 0) fail('seed must be a non-empty string.');
  if (!Number.isInteger(config.assetCount) || config.assetCount < 0) fail('assetCount must be a non-negative integer.');
  if (!Number.isInteger(config.collectionCount) || config.collectionCount < 0) fail('collectionCount must be a non-negative integer.');
  if (!Number.isFinite(config.avgMembershipsPerAsset) || config.avgMembershipsPerAsset < 0) {
    fail('avgMembershipsPerAsset must be a non-negative number.');
  }
  const ratios: [string, number][] = [
    ['archivedCollectionRatio', config.archivedCollectionRatio],
    ['emptyCollectionRatio', config.emptyCollectionRatio],
    ['collectionCoverRatio', config.collectionCoverRatio],
    ['staleCoverRatio', config.staleCoverRatio],
    ['orphanedCollectionIdRatio', config.orphanedCollectionIdRatio],
    ['duplicateCollectionIdRatio', config.duplicateCollectionIdRatio],
  ];
  for (const [name, value] of ratios) {
    if (!Number.isFinite(value) || value < 0 || value > 1) fail(`${name} must be a number between 0 and 1 (got ${value}).`);
  }
  if (config.archivedCollectionRatio + config.emptyCollectionRatio > 1) {
    fail('archivedCollectionRatio + emptyCollectionRatio cannot exceed 1 (a collection cannot be more than 100% likely to be each).');
  }
  if (!Number.isInteger(config.batchSize) || config.batchSize < 1) fail('batchSize must be a positive integer.');
  if (!Number.isFinite(config.baseTimestamp) || config.baseTimestamp < 0) fail('baseTimestamp must be a non-negative number.');
  if (config.collectionCount === 0 && config.assetCount > 0 && config.avgMembershipsPerAsset > 0) {
    fail('collectionCount is 0 but avgMembershipsPerAsset > 0 — there is nothing for assets to join.');
  }
  const assignablePoolFloor = Math.floor(config.collectionCount * (1 - config.emptyCollectionRatio));
  if (config.avgMembershipsPerAsset > assignablePoolFloor) {
    fail(
      `avgMembershipsPerAsset (${config.avgMembershipsPerAsset}) cannot exceed the assignable (non-empty) collection pool size (~${assignablePoolFloor}).`,
    );
  }
  if (!Number.isInteger(config.blobSampleCount) || config.blobSampleCount < 0) fail('blobSampleCount must be a non-negative integer.');
}

/** Deterministic in-place Fisher-Yates over `[0, count)`, driven entirely
 * by the seeded `rng` — same seed always yields the same permutation,
 * which is what lets "pick the first K% of this shuffle" stand in for a
 * random-looking but fully reproducible subset selection throughout this
 * generator (which collections are archived/empty/covered, which assets
 * get an injected defect, etc). */
function shuffledIndices(count: number, rng: Rng): number[] {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = rngInt(rng, 0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function takeFraction(shuffled: number[], fraction: number): Set<number> {
  const n = Math.floor(shuffled.length * fraction);
  return new Set(shuffled.slice(0, n));
}

export function generateDataset(config: DatasetGeneratorConfig): GeneratedDataset {
  validateDatasetConfig(config);
  const start = performance.now();
  const rng = createRng(config.seed);
  const { baseTimestamp } = config;

  // --- Collections -------------------------------------------------
  const collectionShuffle = shuffledIndices(config.collectionCount, rng);
  const archivedSet = takeFraction(collectionShuffle, config.archivedCollectionRatio);
  const remainingAfterArchived = collectionShuffle.filter((i) => !archivedSet.has(i));
  const emptySet = takeFraction(shuffledIndices(remainingAfterArchived.length, rng).map((i) => remainingAfterArchived[i]), config.emptyCollectionRatio);

  const collections: Collection[] = [];
  for (let i = 0; i < config.collectionCount; i++) {
    const createdAt = baseTimestamp + i * 1000;
    collections.push({
      id: deterministicCollectionId(i, baseTimestamp),
      name: `Validation Collection ${i}`,
      normalizedName: `validation collection ${i}`,
      description: '',
      coverAssetId: null,
      isArchived: archivedSet.has(i),
      archivedAt: archivedSet.has(i) ? createdAt + 500 : null,
      schemaVersion: COLLECTION_SCHEMA_VERSION,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // --- Assets (memberships assigned below) --------------------------
  const assets: PortfolioAsset[] = [];
  for (let i = 0; i < config.assetCount; i++) {
    const createdAt = baseTimestamp + i * 500;
    assets.push({
      assetId: deterministicAssetId(i, baseTimestamp),
      displayName: `Validation Asset ${i}`,
      originalFilename: `validation-asset-${i}.svg`,
      assetType: 'svg',
      createdAt,
      importedAt: createdAt,
      updatedAt: createdAt,
      generatorVersion: null,
      schemaVersion: PORTFOLIO_ASSET_SCHEMA_VERSION,
      styleDna: null,
      presetId: null,
      compositionType: null,
      patternType: null,
      generatorSeed: null,
      productTargets: [],
      collectionIds: [],
      tags: [],
      rating: 0,
      workflowStatus: 'DRAFT',
      isArchived: false,
      archivedAt: null,
      archiveReason: null,
      previewReference: null,
      sourceFileReferences: [],
      metadataReference: null,
      sourceHashes: [],
      fileSizes: {},
      dimensions: null,
      colorPalette: [],
      notes: '',
      parentAssetId: null,
      variationGroupId: null,
      productionAssetId: null,
      qualitySnapshotId: null,
    });
  }

  // --- Membership assignment (rejection sampling — see module header) ---
  const assignablePool = collections.map((_, i) => i).filter((i) => !emptySet.has(i));
  const avg = Math.round(config.avgMembershipsPerAsset);
  if (avg > 0 && assignablePool.length > 0) {
    for (let a = 0; a < assets.length; a++) {
      const picked = new Set<number>();
      let attempts = 0;
      const target = Math.min(avg, assignablePool.length);
      while (picked.size < target && attempts < target * 50 + 100) {
        picked.add(assignablePool[rngInt(rng, 0, assignablePool.length - 1)]);
        attempts++;
      }
      assets[a].collectionIds = [...picked].map((idx) => collections[idx].id);
    }
  }

  // --- High-membership fixtures (Section 7) -------------------------
  if (config.includeHighMembershipFixtures && assets.length > 0 && assignablePool.length > 0) {
    // "high-membership asset": asset 0 joins up to 50 (or the whole
    // assignable pool, if smaller) collections.
    const wideCount = Math.min(50, assignablePool.length);
    const widePicked = new Set<string>(assets[0].collectionIds);
    for (let k = 0; k < assignablePool.length && widePicked.size < wideCount; k++) {
      widePicked.add(collections[assignablePool[k]].id);
    }
    assets[0].collectionIds = [...widePicked];

    // "high-member collection": the first assignable collection gains a
    // large membership by being joined by up to 500 (or all) assets.
    const bigCollection = collections[assignablePool[0]];
    const bigCount = Math.min(500, assets.length);
    for (let a = 0; a < bigCount; a++) {
      if (!assets[a].collectionIds.includes(bigCollection.id)) {
        assets[a].collectionIds = [...assets[a].collectionIds, bigCollection.id];
      }
    }
  }

  // --- Covers (valid + deliberately stale) ---------------------------
  const nonEmptyIndices = collections.map((_, i) => i).filter((i) => !emptySet.has(i) && collections[i].coverAssetId === null);
  const coverTargets = takeFraction(shuffledIndices(nonEmptyIndices.length, rng).map((i) => nonEmptyIndices[i]), config.collectionCoverRatio);
  const coverTargetList = [...coverTargets];
  const staleCoverSet = takeFraction(shuffledIndices(coverTargetList.length, rng).map((i) => coverTargetList[i]), config.staleCoverRatio);
  // One linear pass over assets builds "first member seen" per collection
  // id, instead of an O(coveredCollections x assets) `.find()` per
  // collection — the difference between milliseconds and minutes at the
  // LARGE preset's 100,000-asset x 10,000-collection scale.
  const firstMemberByCollectionId = new Map<string, string>();
  for (const asset of assets) {
    for (const id of asset.collectionIds) {
      if (!firstMemberByCollectionId.has(id)) firstMemberByCollectionId.set(id, asset.assetId);
    }
  }
  let staleCoverCount = 0;
  let coverCount = 0;
  for (const idx of coverTargetList) {
    const collection = collections[idx];
    if (staleCoverSet.has(idx)) {
      collection.coverAssetId = GHOST_ASSET_ID;
      staleCoverCount++;
      coverCount++;
      continue;
    }
    const memberAssetId = firstMemberByCollectionId.get(collection.id);
    if (memberAssetId) {
      collection.coverAssetId = memberAssetId;
      coverCount++;
    }
  }

  // --- Orphaned collectionId injection (Rule 11 violation) -----------
  const orphanTargets = takeFraction(shuffledIndices(assets.length, rng), config.orphanedCollectionIdRatio);
  let orphanedMembershipCount = 0;
  for (const idx of orphanTargets) {
    assets[idx].collectionIds = [...assets[idx].collectionIds, GHOST_COLLECTION_ID];
    orphanedMembershipCount++;
  }

  // --- Duplicate collectionId injection (bypasses addCollectionMembership) ---
  const duplicateTargets = takeFraction(
    shuffledIndices(assets.length, rng).filter((i) => assets[i].collectionIds.length > 0),
    config.duplicateCollectionIdRatio,
  );
  let duplicateCollectionIdAssetCount = 0;
  for (const idx of duplicateTargets) {
    const ids = assets[idx].collectionIds;
    if (ids.length === 0) continue;
    assets[idx].collectionIds = [...ids, ids[0]];
    duplicateCollectionIdAssetCount++;
  }

  // --- Manifest (measured from the final data, not from formulas) ----
  // Single linear pass over assets computes everything below — including
  // which collection ids have >=1 real member — instead of the naive
  // O(collections x assets) `.some()`-per-collection check that made this
  // section the dominant cost at the LARGE preset's 100,000 x 10,000
  // scale (confirmed: the fix below cut LARGE generation time roughly
  // 8x — see `docs/portfolio/P2_5_DATASET_GENERATOR.md`'s performance note).
  const collectionIdSet = new Set(collections.map((c) => c.id));
  const collectionIdsWithMembers = new Set<string>();
  let membershipCount = 0;
  let maxMembershipsOnOneAsset = 0;
  for (const asset of assets) {
    let validMemberships = 0;
    for (const id of asset.collectionIds) {
      if (collectionIdSet.has(id)) {
        validMemberships++;
        collectionIdsWithMembers.add(id);
      }
    }
    membershipCount += asset.collectionIds.length; // raw count, including injected orphans — see doc
    maxMembershipsOnOneAsset = Math.max(maxMembershipsOnOneAsset, validMemberships);
  }
  const archivedCollectionCount = collections.filter((c) => c.isArchived).length;
  const emptyCollectionCount = collections.filter((c) => !collectionIdsWithMembers.has(c.id)).length;

  const generationDurationMs = performance.now() - start;
  const estimatedLogicalSizeBytes = JSON.stringify(assets).length + JSON.stringify(collections).length;

  const manifest: DatasetManifest = {
    schemaVersion: DATASET_MANIFEST_SCHEMA_VERSION,
    generatorVersion: DATASET_GENERATOR_VERSION,
    preset: config.preset,
    seed: config.seed,
    generatedAt: Date.now(),
    assetCount: assets.length,
    collectionCount: collections.length,
    activeCollectionCount: collections.length - archivedCollectionCount,
    archivedCollectionCount,
    emptyCollectionCount,
    membershipCount,
    averageMembershipsPerAsset: assets.length > 0 ? membershipCount / assets.length : 0,
    maxMembershipsOnOneAsset,
    coverCount,
    staleCoverCount,
    orphanedMembershipCount,
    duplicateCollectionIdAssetCount,
    batchSize: config.batchSize,
    generationDurationMs,
    databaseName: null,
    estimatedLogicalSizeBytes,
  };

  return { collections, assets, manifest };
}
