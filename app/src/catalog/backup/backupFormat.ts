import type { Collection } from '../domain/collection';

// Portfolio Manager P3 — Backup & Restore, Collection subsystem.
//
// A backup archive is a single JSON document with two parts: a plain,
// uncompressed header (schema/app/generator versions, timestamp,
// counts, checksum, metadata) that can be read and validated without
// decompressing anything, and a gzip-compressed, base64-encoded
// payload carrying the actual collection/membership data. This is
// deliberately NOT a ZIP — the payload is pure JSON (no binary asset
// files are included, see `BackupPayload`'s doc comment), so a
// dependency-free `CompressionStream`/`DecompressionStream` (available
// in Node 18+ and every evergreen browser — see `backupCodec.ts`) does
// the one job a ZIP would otherwise be used for, without needing a
// hand-written ZIP reader (only a writer exists in this repo today,
// `export/zip.ts`, built for whole binary files, not JSON payloads).

/** The archive format's own schema version — bumped only when the
 * *shape* of `BackupArchive`/`BackupPayload` changes in a way future
 * restore logic needs to branch on. Distinct from `generatorVersion`
 * (bumped when the code that PRODUCES an archive changes without the
 * shape changing, e.g. a bug fix) and from `applicationVersion` (the
 * app build that created this archive, informational only). */
export const BACKUP_SCHEMA_VERSION = 1;

/** Schema versions this build's restore logic knows how to read.
 * Restoring an archive with a schema version outside this list must be
 * refused with a clear compatibility error rather than attempting a
 * best-effort read — see `backupValidation.ts`. */
export const SUPPORTED_BACKUP_SCHEMA_VERSIONS = [1];

/** Bumped when `backupBuilder.ts`'s generation logic changes in a way
 * worth recording on the archive itself (e.g. a bug fix to what gets
 * included), independent of `BACKUP_SCHEMA_VERSION`. */
export const BACKUP_GENERATOR_VERSION = '1.0.0';

export const BACKUP_FORMAT_ID = 'vsp-collection-backup' as const;

/** One asset's membership — which collections it currently belongs to.
 * Only assets with at least one membership are included (an asset with
 * `collectionIds: []` contributes nothing to the Collection subsystem
 * and would just be dead weight in every backup — see
 * `backupBuilder.ts`). Assets themselves (files, previews, metadata)
 * are P1's concern, not this backup's — restoring a membership entry
 * whose `assetId` no longer exists in the live catalog is a detected,
 * reported condition (`backupValidation.ts`'s "missing assets" check),
 * not a silent no-op. */
export interface BackupMembershipEntry {
  assetId: string;
  collectionIds: string[];
}

/** No collection-specific application settings exist anywhere in the
 * app today (checked: no `localStorage` key, no `IndexedDB` field, no
 * settings panel touches Collections specifically) — `CollectionAssignmentDialog`,
 * `CollectionsView`, etc. are all stateless w.r.t. persisted
 * preferences. This field exists so a *future* setting (e.g. a default
 * sort order for the Collections tab) has a place to live in the
 * archive format without a schema version bump — see
 * `BACKUP_FORMAT.md`'s "Schema evolution" section for the intended
 * evolution path. */
export type BackupSettings = Record<string, never>;

export interface BackupPayload {
  collections: Collection[];
  memberships: BackupMembershipEntry[];
  settings: BackupSettings;
}

/** All three fields are fully, independently recomputable from the
 * decompressed payload alone (`collectionCount` = `payload.collections.length`,
 * `assetCount` = `payload.memberships.length`, `membershipCount` = the
 * sum of every membership entry's `collectionIds.length`) — deliberately
 * so `backupValidation.ts` can cross-check the header's claimed stats
 * against the real payload with no external state needed. `assetCount`
 * counts assets *represented in this backup* (i.e. with at least one
 * membership) — not the live catalog's total asset count, which this
 * backup does not include. */
export interface BackupStats {
  collectionCount: number;
  assetCount: number;
  membershipCount: number;
}

/** Validation-relevant provenance, distinct from `BackupStats` (which
 * describes payload *size*) — this describes the environment the
 * backup was taken FROM, so restore-time compatibility checks have
 * something concrete to compare against beyond just the schema
 * version number. */
export interface BackupMetadata {
  dbVersion: number;
  /** The frozen Collection API's own recommended version tag
   * (`docs/portfolio/COLLECTION_RELEASE_NOTES.md`) — informational,
   * never used to reject a restore (the frozen API is
   * backward-compatible by policy), but surfaced in the validation
   * report so a user restoring a very old backup has context. */
  collectionApiVersion: string;
  /** Optional user-supplied label ("Before bulk cleanup", "Weekly
   * backup"), surfaced in backup history — see `backupHistoryStore.ts`. */
  label?: string;
}

export interface BackupArchive {
  format: typeof BACKUP_FORMAT_ID;
  schemaVersion: number;
  applicationVersion: string;
  generatorVersion: string;
  createdAt: number;
  stats: BackupStats;
  metadata: BackupMetadata;
  /** SHA-256 hex digest of the *decompressed* payload's canonical JSON
   * string (`JSON.stringify(payload)`, no extra whitespace) — computed
   * and verified against the exact same serialization on both ends, so
   * a checksum mismatch can only mean the payload bytes themselves
   * changed (corruption, truncation, tampering), never a
   * formatting difference. */
  checksum: string;
  payloadEncoding: 'gzip+base64';
  payload: string;
}

/** Structural type guard for "is this even shaped like a backup archive
 * at all" — the first, cheapest check `backupValidation.ts` runs,
 * before touching the checksum or attempting decompression. Catches a
 * completely wrong file (e.g. a random JSON export from a different
 * tool) or a truncated/corrupted file that no longer parses as the
 * expected shape. */
export function isBackupArchiveShape(value: unknown): value is BackupArchive {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.format === BACKUP_FORMAT_ID &&
    typeof v.schemaVersion === 'number' &&
    typeof v.applicationVersion === 'string' &&
    typeof v.generatorVersion === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.checksum === 'string' &&
    v.payloadEncoding === 'gzip+base64' &&
    typeof v.payload === 'string' &&
    typeof v.stats === 'object' &&
    v.stats !== null &&
    typeof v.metadata === 'object' &&
    v.metadata !== null
  );
}
