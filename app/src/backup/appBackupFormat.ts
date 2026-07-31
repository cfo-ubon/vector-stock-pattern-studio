// Application Backup System — archive format types and constants.
//
// A `.vspsb` ("Vector Stock Pattern Studio Backup") file is a real,
// standard ZIP archive (built/read by `zipArchive.ts`, verified against
// the system `unzip`/`zipinfo` tools during development, so any archive
// tool — Windows Explorer, macOS Archive Utility, 7-Zip — can open one if
// its extension is changed to `.zip`) containing:
//
//   manifest.json            this file's shape, see AppBackupManifest
//   checksums.sha256         one line per file: "<sha256>  <path>"
//   database.json             every non-binary IndexedDB store, dumped as
//                              plain JSON (this app persists via
//                              IndexedDB, not SQLite — see BACKUP_SYSTEM.md
//                              for why "database.sqlite" from a generic
//                              backup-tool brief doesn't apply here, and
//                              what actually replaces it)
//   assets/<fileId>__<name>   every PortfolioFileRecord's binary bytes
//                              (SVG/PNG/EPS/AI/etc.), byte-for-byte
//   settings/<key>.json       one file per backed-up localStorage key
//                              (Style DNA presets, workbench settings,
//                              favorites, etc.) — see
//                              `appBackupSettingsSnapshot.ts`
//
// No absolute paths appear anywhere in the archive — every entry name is
// a relative, forward-slash path, so the archive is byte-identical
// regardless of which machine/OS/drive it was built or restored on (the
// brief's portability requirement).

export const APP_BACKUP_EXTENSION = '.vspsb';
export const APP_BACKUP_FORMAT_ID = 'vsp-app-backup' as const;

/** Bumped only when the *shape* of `AppBackupManifest` changes in a way
 * future restore logic needs to branch on — mirrors
 * `catalog/backup/backupFormat.ts`'s `BACKUP_SCHEMA_VERSION` convention. */
export const APP_BACKUP_SCHEMA_VERSION = 1;
export const SUPPORTED_APP_BACKUP_SCHEMA_VERSIONS = [1];

/** Bumped when `appBackupBuilder.ts`'s generation logic changes without
 * the archive shape itself changing (e.g. a bug fix to what gets
 * included). */
export const APP_BACKUP_GENERATOR_VERSION = '1.0.0';

/** Same honest-placeholder reasoning as every other export module in this
 * repo (`catalog/backup/backupBuilder.ts`, `catalog/backup/productionBackup.ts`)
 * — `package.json`'s `"version": "0.0.0"` was never bumped per release;
 * `docs/USER_GUIDE.md`'s own Application Version changelog is the real
 * source of truth and does not belong hard-coded into shipped code. */
export const APP_BACKUP_APPLICATION_LABEL = 'vector-stock-pattern-studio';

export const MANIFEST_ENTRY_NAME = 'manifest.json';
export const CHECKSUMS_ENTRY_NAME = 'checksums.sha256';
export const DATABASE_ENTRY_NAME = 'database.json';
export const ASSETS_ENTRY_PREFIX = 'assets/';
export const SETTINGS_ENTRY_PREFIX = 'settings/';
export const LOGS_ENTRY_PREFIX = 'logs/';

/** One row per IndexedDB store included in `database.json` — every
 * store's record array, keyed by the store's own name (see
 * `storage/db.ts`'s `*_STORE` constants), so restore can iterate this
 * object generically instead of the builder and restorer needing to
 * agree on a bespoke per-store field name. */
export type AppBackupDatabaseDump = Record<string, unknown[]>;

export interface AppBackupAssetEntry {
  fileId: string;
  assetId: string;
  archivePath: string;
  /** `PortfolioFileRecord.role` (`catalog/domain/types.ts`) — required to
   * fully reconstruct the record on restore, not just its bytes. */
  role: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  /** `PortfolioFileRecord.storedAt` — preserved so restore doesn't have
   * to fabricate a new timestamp for a file that already existed. */
  storedAt: number;
}

export interface AppBackupStats {
  storeRecordCounts: Record<string, number>;
  assetFileCount: number;
  settingsKeyCount: number;
  fileCount: number;
  originalSize: number;
  compressedSize: number;
}

/** Validation-relevant provenance — the environment the backup was taken
 * FROM. Browsers do not expose a real machine hostname or OS build
 * (no filesystem/OS API is reachable from a web page, by design) — using
 * `navigator.userAgent`/`navigator.platform` here is the honest,
 * closest available signal, clearly informational only, never used to
 * gate a restore decision. `deviceLabel` is the user-supplied, actually
 * meaningful identifier ("Windows Desktop", "iPad") surfaced instead. */
export interface AppBackupMetadata {
  dbVersion: number;
  deviceLabel: string;
  userAgent: string;
  platform: string;
  label?: string;
}

export interface AppBackupManifest {
  format: typeof APP_BACKUP_FORMAT_ID;
  schemaVersion: number;
  applicationVersion: string;
  /** `docs/USER_GUIDE.md`'s Application Version at build time (e.g.
   * "v1.80") — distinct from `schemaVersion` (this archive format's own
   * version) and from `applicationVersion` (a fixed app-identity label),
   * matching the "Application Version vs Development Build" distinction
   * `docs/USER_GUIDE.md`'s own "Version and Build Numbering" section
   * documents. Optional so an archive built before this field existed
   * still parses. */
  appVersionLabel?: string;
  generatorVersion: string;
  backupId: string;
  createdAt: number;
  stats: AppBackupStats;
  metadata: AppBackupMetadata;
  assets: AppBackupAssetEntry[];
  settingsKeys: string[];
  /** SHA-256 of the archive's own `checksums.sha256` file content — the
   * single "whole archive" checksum the brief asks for, verified first
   * (cheapest, catches most corruption) before per-file checksums are
   * individually re-checked. */
  archiveChecksum: string;
}

export function isAppBackupManifestShape(value: unknown): value is AppBackupManifest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.format === APP_BACKUP_FORMAT_ID &&
    typeof v.schemaVersion === 'number' &&
    typeof v.applicationVersion === 'string' &&
    typeof v.generatorVersion === 'string' &&
    typeof v.backupId === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.stats === 'object' &&
    v.stats !== null &&
    typeof v.metadata === 'object' &&
    v.metadata !== null &&
    Array.isArray(v.assets) &&
    Array.isArray(v.settingsKeys) &&
    typeof v.archiveChecksum === 'string'
  );
}

/** Every IndexedDB store this backup system captures, in the order the
 * database dump lists them. Kept as one named list (rather than scattered
 * string literals) so `appBackupBuilder.ts`/`appBackupRestore.ts`/tests
 * all agree on exactly what "everything" means — see `BACKUP_SYSTEM.md`
 * for why each one is included. */
export const APP_BACKUP_STORE_NAMES = [
  'saved',
  'projects',
  'assets',
  'portfolioAssets',
  'collections',
  'submissions',
  'qualitySnapshots',
  'salesEvents',
  'rejectionRecords',
  'productionQueueItems',
  'productionBatches',
  'importHistory',
  'marketplaceRegistrations',
  // Build 028, Marketing Intelligence (Phase 2) — only the three stores
  // with real domain/store modules so far are registered here; the
  // remaining Build 028 stores (marketKeywords, seasonalEvents,
  // marketOpportunities, scoringProfiles, dailyMissions, designBriefs,
  // designStrategies, designConfigurations, marketingDesignHandoffs,
  // commercialFeedbackSignals, recommendationHistory) already exist in
  // `storage/db.ts`'s v8 schema but are added here in the later phase
  // that actually writes to them, matching this list's existing
  // convention of registering a store only once it holds real data.
  'researchSources',
  'marketObservations',
  'marketSnapshots',
] as const;

export type AppBackupStoreName = (typeof APP_BACKUP_STORE_NAMES)[number];

/** localStorage keys this backup system captures — every key here is a
 * genuine user setting/preset/library, never a legacy migration fallback
 * (`vsp-saved-v1`, `vsp-projects-v1`, `vsp-assets-v1` are localStorage
 * fallbacks used only when IndexedDB is unavailable; the real data for
 * those three already comes from the IndexedDB stores above, so backing
 * up the fallback keys too would be redundant) and never a stale
 * pre-migration cache (`vsp-submission-center-records` was fully
 * migrated into the `submissions` IndexedDB store by Build 026 — see
 * `docs/DATABASE_SCHEMA.md`). See `BACKUP_SYSTEM.md` for the full
 * rationale per key. */
export const APP_BACKUP_SETTINGS_KEYS = [
  'vsp-gallery-v1',
  'vsp-workbench-settings',
  'vsp-workbench-favorites-v1',
  'vsp-asset-favorites-v1',
  'vsp-style-dna-custom-v1',
  'vsp-style-dna-favorites-v1',
  'vsp-knowledge-learning-history-v1',
  'vsp-auto-backup-settings-v1',
] as const;
