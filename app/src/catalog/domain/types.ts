// Portfolio Manager P1 (Sprint) — versioned Asset domain model.
//
// This is a *catalog* of externally-produced stock-vector files (imported
// SVG/PNG/JSON/EPS/AI source sets), distinct from `src/assets/` (the Asset
// Ecosystem Engine's extracted/decomposed *editable SVG-AST motif* assets
// lifted out of a generated Collection) and from `src/portfolio/` (the
// Portfolio *Intelligence* Engine, Build 013/014's read-only statistical
// analysis of generated-pattern batches). All three "Asset"/"Portfolio"
// names collide on vocabulary but not on domain — this module owns none of
// their storage or types and imports nothing from either.

/** The role a stored source file plays within one catalog asset. */
export type SourceFileRole = 'preview' | 'svg' | 'json' | 'eps' | 'ai' | 'png' | 'jpg' | 'other';

export const SOURCE_FILE_ROLES: SourceFileRole[] = ['preview', 'svg', 'json', 'eps', 'ai', 'png', 'jpg', 'other'];

/** Ordinary production workflow — never includes "archived"; archiving is a
 * separate, orthogonal axis (`isArchived`/`archivedAt`/`archiveReason`
 * below) so an asset can be e.g. `REJECTED` *and* archived, or `APPROVED`
 * and still active, without the two concepts fighting over one enum slot. */
export type WorkflowStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'READY_TO_UPLOAD'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_REVISION';

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  'DRAFT',
  'READY_FOR_REVIEW',
  'READY_TO_UPLOAD',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'NEEDS_REVISION',
];

/** One physically-stored source file (its bytes live in the `portfolioFiles`
 * store, keyed by `fileId` — this record is only the pointer + the metadata
 * cheap enough to keep inline for fast list/search/health-check queries
 * without touching file bodies). */
export interface SourceFileReference {
  fileId: string;
  role: SourceFileRole;
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
}

/** The current schema version of `PortfolioAsset` records — bump this and
 * add a `normalizePortfolioAsset()` migration branch (mirroring
 * `project/projectManager.ts`'s `normalizeProject` convention) the next
 * time this shape changes, rather than a DB-wide version bump. */
export const PORTFOLIO_ASSET_SCHEMA_VERSION = 1;

export interface PortfolioAsset {
  assetId: string;
  displayName: string;
  originalFilename: string;
  /** The dominant source role this asset represents commercially (usually
   * 'svg' — the sellable vector — even when a PNG preview and JSON source
   * are grouped alongside it). */
  assetType: SourceFileRole;
  /** When the underlying design was created, if recoverable from imported
   * JSON metadata; falls back to `importedAt` when unknown. */
  createdAt: number;
  importedAt: number;
  updatedAt: number;
  generatorVersion: string | null;
  schemaVersion: number;
  styleDna: string | null;
  presetId: string | null;
  compositionType: string | null;
  patternType: string | null;
  /** The generator's own RNG seed, if recoverable from imported JSON
   * metadata — a strong "possible duplicate" signal independent of file
   * bytes (a re-exported/re-serialized copy of the same generated design
   * still carries the same seed). */
  generatorSeed: string | null;
  productTargets: string[];
  collectionIds: string[];
  tags: string[];
  /** 0 = unrated, otherwise 1-5. */
  rating: number;
  workflowStatus: WorkflowStatus;
  isArchived: boolean;
  archivedAt: number | null;
  archiveReason: string | null;
  /** fileId of the file used as this asset's preview (see
   * `import/previewSelection.ts` for the priority order), or null if no
   * previewable source was provided. */
  previewReference: string | null;
  sourceFileReferences: SourceFileReference[];
  /** fileId of the raw source JSON, or null when none was imported. */
  metadataReference: string | null;
  /** Denormalized `sourceFileReferences[].sha256` list — kept alongside for
   * fast duplicate/health-check queries without re-deriving it. */
  sourceHashes: string[];
  /** Denormalized `fileId -> fileSize` map, same rationale. */
  fileSizes: Record<string, number>;
  dimensions: { width: number; height: number } | null;
  colorPalette: string[];
  notes: string;
  /** Set when this asset was explicitly imported "as new" over a possible
   * duplicate, or grouped as a deliberate variation of another asset. */
  parentAssetId: string | null;
  variationGroupId: string | null;
}

/** One physically-stored file body. Kept in its own object store
 * (`portfolioFiles`) so listing/searching/filtering `PortfolioAsset`
 * records never has to touch Blob bodies. `sha256` is duplicated here too
 * (not just on the asset's `SourceFileReference`) so the store is
 * self-describing and orphan-file detection doesn't need a join. */
export interface PortfolioFileRecord {
  fileId: string;
  assetId: string;
  role: SourceFileRole;
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  blob: Blob;
  storedAt: number;
}

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return typeof value === 'string' && (WORKFLOW_STATUSES as string[]).includes(value);
}

export function isSourceFileRole(value: unknown): value is SourceFileRole {
  return typeof value === 'string' && (SOURCE_FILE_ROLES as string[]).includes(value);
}
