import { computePayloadChecksum, decompressFromBase64, BackupCodecError } from './backupCodec';
import { isBackupArchiveShape, SUPPORTED_BACKUP_SCHEMA_VERSIONS } from './backupFormat';
import type { BackupArchive, BackupPayload, BackupStats } from './backupFormat';
import { loadPortfolioAssets } from '../storage/portfolioStore';

// Portfolio Manager P3 — pre-restore validation. Generates a full report
// before any write happens (Section "VALIDATION": "Generate validation
// report before restoring"), covering both archive-internal integrity
// (checksum, schema version, declared-vs-actual counts, duplicate IDs,
// orphaned in-archive references, corruption/truncation) and, when
// asked, one live-database cross-check (memberships referencing assets
// that no longer exist in the current catalog). Accepts `unknown` — the
// very first thing this function must handle correctly is a value that
// isn't a backup archive at all (a corrupted file, a completely
// different JSON document, `undefined`).

export type BackupValidationIssueCode =
  | 'invalid-shape'
  | 'unsupported-schema-version'
  | 'corrupted-payload'
  | 'checksum-mismatch'
  | 'collection-count-mismatch'
  | 'asset-count-mismatch'
  | 'membership-count-mismatch'
  | 'duplicate-collection-id'
  | 'orphaned-membership-reference'
  | 'missing-live-asset';

export interface BackupValidationIssue {
  severity: 'error' | 'warning';
  code: BackupValidationIssueCode;
  message: string;
}

export interface BackupValidationReport {
  /** True only when there are zero `error`-severity issues. A report
   * with only `warning`s is still `valid` — see `missing-live-asset`,
   * the one check that is inherently informational (assets legitimately
   * get deleted between a backup and a later restore; that is not
   * corruption). */
  valid: boolean;
  structurallySound: boolean;
  schemaVersionSupported: boolean;
  /** `null` when the payload could not be decompressed at all (a
   * structural/corruption failure already reported as its own issue) —
   * distinct from `false`, which means decompression succeeded but the
   * checksum genuinely did not match. */
  checksumValid: boolean | null;
  reportedStats: BackupStats | null;
  actualStats: BackupStats | null;
  statsMatch: boolean;
  duplicateCollectionIds: string[];
  /** Membership entries whose `collectionIds` reference a collection ID
   * not present in `payload.collections` — an archive-internal
   * referential-integrity problem ("missing collections"). */
  orphanedMembershipCollectionIds: string[];
  /** Membership entries whose `assetId` does not exist in the current
   * live catalog ("missing assets") — only populated when
   * `crossCheckLiveAssets` is requested; `null` otherwise, distinct from
   * an empty array (which means "checked, found none"). */
  missingLiveAssetIds: string[] | null;
  issues: BackupValidationIssue[];
}

function emptyReport(issues: BackupValidationIssue[]): BackupValidationReport {
  return {
    valid: issues.every((i) => i.severity !== 'error'),
    structurallySound: false,
    schemaVersionSupported: false,
    checksumValid: null,
    reportedStats: null,
    actualStats: null,
    statsMatch: false,
    duplicateCollectionIds: [],
    orphanedMembershipCollectionIds: [],
    missingLiveAssetIds: null,
    issues,
  };
}

function computeActualStats(payload: BackupPayload): BackupStats {
  const membershipCount = payload.memberships.reduce((sum, m) => sum + m.collectionIds.length, 0);
  return {
    collectionCount: payload.collections.length,
    assetCount: payload.memberships.length,
    membershipCount,
  };
}

function findDuplicateCollectionIds(collections: BackupPayload['collections']): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const c of collections) {
    if (seen.has(c.id)) duplicates.add(c.id);
    seen.add(c.id);
  }
  return [...duplicates];
}

function findOrphanedMembershipReferences(payload: BackupPayload): string[] {
  const knownCollectionIds = new Set(payload.collections.map((c) => c.id));
  const orphaned = new Set<string>();
  for (const membership of payload.memberships) {
    for (const collectionId of membership.collectionIds) {
      if (!knownCollectionIds.has(collectionId)) orphaned.add(collectionId);
    }
  }
  return [...orphaned];
}

export interface ValidateBackupOptions {
  /** When true, also cross-checks every membership's `assetId` against
   * the current live portfolio catalog and reports any that no longer
   * exist. Requires IndexedDB access — skip when validating a file in
   * isolation (e.g. a corruption-detection-only check with no live app
   * state available). */
  crossCheckLiveAssets?: boolean;
}

/** Runs the complete pre-restore validation pass described above.
 * Never throws — every failure mode (wrong shape, unsupported schema,
 * corrupted/truncated payload, checksum mismatch) is captured as an
 * `issue` in the returned report so a caller always gets a report
 * object to act on, never an exception to catch. */
export async function validateBackupArchive(input: unknown, options: ValidateBackupOptions = {}): Promise<BackupValidationReport> {
  if (!isBackupArchiveShape(input)) {
    return emptyReport([{ severity: 'error', code: 'invalid-shape', message: 'This file is not a recognizable Collection backup archive (wrong format, corrupted header, or a different file entirely).' }]);
  }
  const archive: BackupArchive = input;
  const issues: BackupValidationIssue[] = [];

  const schemaVersionSupported = SUPPORTED_BACKUP_SCHEMA_VERSIONS.includes(archive.schemaVersion);
  if (!schemaVersionSupported) {
    issues.push({
      severity: 'error',
      code: 'unsupported-schema-version',
      message: `Archive schema version ${archive.schemaVersion} is not supported by this build (supported: ${SUPPORTED_BACKUP_SCHEMA_VERSIONS.join(', ')}). Restoring it could be interpreted incorrectly, so it is refused rather than attempted.`,
    });
    return {
      ...emptyReport(issues),
      structurallySound: true,
      schemaVersionSupported: false,
      reportedStats: archive.stats,
    };
  }

  let payload: BackupPayload;
  try {
    const json = await decompressFromBase64(archive.payload);
    payload = JSON.parse(json) as BackupPayload;
  } catch (err) {
    const message = err instanceof BackupCodecError ? err.message : `Backup payload is not valid JSON after decompression: ${err instanceof Error ? err.message : String(err)}`;
    issues.push({ severity: 'error', code: 'corrupted-payload', message });
    return {
      ...emptyReport(issues),
      structurallySound: true,
      schemaVersionSupported: true,
      reportedStats: archive.stats,
    };
  }

  const recomputedChecksum = await computePayloadChecksum(payload);
  const checksumValid = recomputedChecksum === archive.checksum;
  if (!checksumValid) {
    issues.push({ severity: 'error', code: 'checksum-mismatch', message: 'The backup payload does not match its recorded checksum — the archive may be corrupted or was modified after it was created.' });
  }

  const actualStats = computeActualStats(payload);
  const statsIssues: BackupValidationIssue[] = [];
  if (actualStats.collectionCount !== archive.stats.collectionCount) {
    statsIssues.push({ severity: 'error', code: 'collection-count-mismatch', message: `Archive header reports ${archive.stats.collectionCount} collections, but the payload contains ${actualStats.collectionCount}.` });
  }
  if (actualStats.assetCount !== archive.stats.assetCount) {
    statsIssues.push({ severity: 'error', code: 'asset-count-mismatch', message: `Archive header reports ${archive.stats.assetCount} assets with membership, but the payload contains ${actualStats.assetCount}.` });
  }
  if (actualStats.membershipCount !== archive.stats.membershipCount) {
    statsIssues.push({ severity: 'error', code: 'membership-count-mismatch', message: `Archive header reports ${archive.stats.membershipCount} memberships, but the payload contains ${actualStats.membershipCount}.` });
  }
  issues.push(...statsIssues);

  const duplicateCollectionIds = findDuplicateCollectionIds(payload.collections);
  for (const id of duplicateCollectionIds) {
    issues.push({ severity: 'error', code: 'duplicate-collection-id', message: `Collection ID "${id}" appears more than once in the archive.` });
  }

  const orphanedMembershipCollectionIds = findOrphanedMembershipReferences(payload);
  for (const id of orphanedMembershipCollectionIds) {
    issues.push({ severity: 'error', code: 'orphaned-membership-reference', message: `A membership entry references collection ID "${id}", which is not present in this archive's collection list.` });
  }

  let missingLiveAssetIds: string[] | null = null;
  if (options.crossCheckLiveAssets) {
    const liveAssets = await loadPortfolioAssets();
    const liveAssetIds = new Set(liveAssets.map((a) => a.assetId));
    missingLiveAssetIds = payload.memberships.filter((m) => !liveAssetIds.has(m.assetId)).map((m) => m.assetId);
    for (const assetId of missingLiveAssetIds) {
      issues.push({ severity: 'warning', code: 'missing-live-asset', message: `Asset "${assetId}" referenced in this backup no longer exists in the current catalog — its memberships cannot be restored.` });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    structurallySound: true,
    schemaVersionSupported: true,
    checksumValid,
    reportedStats: archive.stats,
    actualStats,
    statsMatch: statsIssues.length === 0,
    duplicateCollectionIds,
    orphanedMembershipCollectionIds,
    missingLiveAssetIds,
    issues,
  };
}
