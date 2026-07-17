// Portfolio Manager P2.5 Sprint 1 — Collection Validation Infrastructure.
//
// Shared types for the deterministic dataset generator, its manifest, and
// the benchmark runner. This module has no side effects and no dependency
// on IndexedDB/fake-indexeddb — safe to import from a Node CLI script, a
// vitest file, or (in principle) a browser context.

/** Named, brief-mandated dataset scales (Section 3). `custom` covers any
 * hand-built `DatasetGeneratorConfig` that doesn't match one of the three
 * presets — the manifest still records whichever `preset` string the
 * caller passed in, purely descriptive. */
export type DatasetPresetName = 'small' | 'medium' | 'large' | 'custom';

export interface DatasetGeneratorConfig {
  /** Any non-empty string. Two runs with the same seed and the same
   * config produce byte-identical logical output (Section 3's
   * determinism requirement). */
  seed: string;
  preset: DatasetPresetName;
  assetCount: number;
  collectionCount: number;
  /** Target average `PortfolioAsset.collectionIds.length` across all
   * assets, before any injected-condition adjustments. */
  avgMembershipsPerAsset: number;
  /** Fraction of collections (0..1) marked `isArchived: true`. */
  archivedCollectionRatio: number;
  /** Fraction of collections (0..1) deliberately given zero members —
   * excluded from the normal random membership assignment pass. */
  emptyCollectionRatio: number;
  /** Fraction of non-empty collections (0..1) given a `coverAssetId`
   * (valid or stale, see `staleCoverRatio`). */
  collectionCoverRatio: number;
  /** Fraction of *covered* collections (0..1) whose cover is deliberately
   * stale — a `coverAssetId` that does not correspond to any generated
   * asset (Rule 13 violation), instead of a valid member asset id. */
  staleCoverRatio: number;
  /** Fraction of assets (0..1) that receive one extra `collectionIds`
   * entry pointing at a collection id that does not exist in the
   * generated collection set (Rule 11 violation — an orphaned
   * membership). */
  orphanedCollectionIdRatio: number;
  /** Fraction of assets (0..1) that receive a duplicated entry within
   * their own `collectionIds` array. This condition cannot arise through
   * `collectionService.ts`'s public API (`addCollectionMembership`
   * dedupes) — the generator injects it directly into the raw record,
   * bypassing the service layer entirely. See
   * `docs/portfolio/P2_5_DATASET_GENERATOR.md` for the exact mechanism. */
  duplicateCollectionIdRatio: number;
  /** Base wall-clock time (ms since epoch) every deterministic
   * timestamp in the dataset is derived from. Two runs with the same
   * `baseTimestamp` produce identical `createdAt`/`updatedAt`/etc. */
  baseTimestamp: number;
  /** When true, one asset and one collection are deliberately boosted to
   * unusually high membership counts (the brief's "high-membership
   * asset" / "high-member collection" scenarios) rather than relying on
   * chance to produce one. */
  includeHighMembershipFixtures: boolean;
  /** When true, persistence-mode generation (see `validationDb.ts`) also
   * writes a tiny (~200 byte) placeholder SVG `PortfolioFileRecord` for a
   * bounded subset of assets and sets `previewReference` accordingly —
   * enough to exercise the preview/cover Blob-URL lifecycle without
   * allocating full-resolution images. Ignored in pure in-memory mode
   * (there is nothing to persist). */
  includeBlobs: boolean;
  /** How many assets get a placeholder blob when `includeBlobs` is true.
   * Bounded deliberately — see `includeBlobs`'s doc comment. */
  blobSampleCount: number;
  /** Row count per IndexedDB write transaction in persistence mode.
   * Purely a memory/throughput knob — has no effect on in-memory
   * generation or on the logical dataset produced. */
  batchSize: number;
}

export const DEFAULT_DATASET_CONFIG: Omit<DatasetGeneratorConfig, 'seed' | 'preset' | 'assetCount' | 'collectionCount' | 'avgMembershipsPerAsset'> = {
  archivedCollectionRatio: 0.1,
  emptyCollectionRatio: 0.05,
  collectionCoverRatio: 0.5,
  staleCoverRatio: 0.1,
  orphanedCollectionIdRatio: 0.02,
  duplicateCollectionIdRatio: 0.02,
  baseTimestamp: 1700000000000,
  includeHighMembershipFixtures: true,
  includeBlobs: false,
  blobSampleCount: 20,
  batchSize: 2000,
};

export class InvalidDatasetConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDatasetConfigError';
  }
}

export interface DatasetManifest {
  schemaVersion: number;
  generatorVersion: string;
  preset: DatasetPresetName;
  seed: string;
  generatedAt: number;
  assetCount: number;
  collectionCount: number;
  activeCollectionCount: number;
  archivedCollectionCount: number;
  emptyCollectionCount: number;
  membershipCount: number;
  averageMembershipsPerAsset: number;
  maxMembershipsOnOneAsset: number;
  coverCount: number;
  staleCoverCount: number;
  orphanedMembershipCount: number;
  duplicateCollectionIdAssetCount: number;
  batchSize: number;
  generationDurationMs: number;
  /** Set only when the dataset was persisted (Section 4's "database name
   * when persisted"); `null` for pure in-memory generation. */
  databaseName: string | null;
  /** A rough, declared estimate (not a measured byte count) of the
   * dataset's logical JSON size, `JSON.stringify(assets).length +
   * JSON.stringify(collections).length` — "estimated", per Section 4,
   * not a claim of exact storage footprint. */
  estimatedLogicalSizeBytes: number;
}

/** Bumped whenever this module's manifest shape changes in a
 * non-additive way — independent of `Collection`/`PortfolioAsset`'s own
 * `schemaVersion`/`DB_VERSION`, matching this app's existing per-concern
 * versioning convention (see `docs/portfolio/COLLECTION_DATA_MODEL.md`'s
 * "Schema versioning summary"). */
export const DATASET_MANIFEST_SCHEMA_VERSION = 1;

/** Bumped whenever the generator's own logic changes in a way that could
 * change its output for the same seed/config — lets a stored manifest
 * self-report which generator produced it. */
export const DATASET_GENERATOR_VERSION = '1.0.0';
