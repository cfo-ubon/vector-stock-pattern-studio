import { loadCollections } from '../storage/collectionStore';
import { loadPortfolioAssets } from '../storage/portfolioStore';
import { DB_VERSION } from '../../storage/db';
import { compressToBase64, computePayloadChecksum, decompressFromBase64 } from './backupCodec';
import { BACKUP_FORMAT_ID, BACKUP_GENERATOR_VERSION, BACKUP_SCHEMA_VERSION } from './backupFormat';
import type { BackupArchive, BackupMembershipEntry, BackupPayload } from './backupFormat';

// Portfolio Manager P3 — full backup builder. Reads only through the
// frozen Collection API (`loadCollections`/`loadPortfolioAssets` —
// `docs/portfolio/COLLECTION_API_FREEZE.md`) — this module never
// touches `storage/db.ts`'s raw IndexedDB primitives directly, so it
// cannot itself introduce a durability/atomicity regression in the
// already-certified read path.

/** The frozen Collection API's own recommended version tag
 * (`docs/portfolio/COLLECTION_RELEASE_NOTES.md`) — a plain string
 * constant here rather than an import, since the release notes doc is
 * documentation, not code, and this value only needs to be
 * informational on the archive, never load-bearing for restore logic
 * (see `BackupMetadata.collectionApiVersion`'s doc comment). */
const COLLECTION_API_VERSION = 'portfolio-collections-v1.0.0';

/** Same fallback `applicationVersion` reasoning as the rest of the app's
 * export tooling — `package.json`'s own `"version": "0.0.0"` is not
 * bumped per release in this repo (build/sprint numbering is tracked in
 * `docs/CHANGELOG.md` instead), so a fixed, documented placeholder is
 * more honest than fabricating a version number nothing else in the
 * repo agrees with. */
const APPLICATION_VERSION = 'vector-stock-pattern-studio-portfolio-manager';

/** Only assets that actually belong to at least one collection are
 * included — an asset with `collectionIds: []` contributes nothing to
 * the Collection subsystem this backup covers (see
 * `backupFormat.ts`'s `BackupMembershipEntry` doc comment). */
function buildMembershipEntries(assets: { assetId: string; collectionIds: string[] }[]): BackupMembershipEntry[] {
  const entries: BackupMembershipEntry[] = [];
  for (const asset of assets) {
    if (asset.collectionIds.length === 0) continue;
    entries.push({ assetId: asset.assetId, collectionIds: [...asset.collectionIds] });
  }
  return entries;
}

export interface BuildBackupOptions {
  /** Optional user-supplied label, carried through to
   * `BackupMetadata.label` and surfaced in backup history. */
  label?: string;
}

/** Builds a complete backup archive of the current Collection subsystem
 * state — every collection record and every asset's membership in it.
 * Read-only: takes no lock, holds no transaction open, and can safely
 * run concurrently with normal app usage (the archive is a snapshot of
 * whatever `loadCollections()`/`loadPortfolioAssets()` returned at the
 * moment each was called — see `BACKUP_ARCHITECTURE.md`'s "Consistency
 * window" section for the honest caveat this implies). */
export async function buildCollectionBackup(options: BuildBackupOptions = {}): Promise<BackupArchive> {
  const [collections, assets] = await Promise.all([loadCollections(), loadPortfolioAssets()]);
  const memberships = buildMembershipEntries(assets);
  const membershipCount = memberships.reduce((sum, m) => sum + m.collectionIds.length, 0);

  const payload: BackupPayload = { collections, memberships, settings: {} };
  const checksum = await computePayloadChecksum(payload);
  const compressedPayload = await compressToBase64(JSON.stringify(payload));

  const archive: BackupArchive = {
    format: BACKUP_FORMAT_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
    generatorVersion: BACKUP_GENERATOR_VERSION,
    createdAt: Date.now(),
    stats: {
      collectionCount: collections.length,
      // Distinct assets *represented in this backup* (i.e. with at least
      // one membership) — deliberately NOT the live catalog's total
      // asset count, which this backup does not include and could not
      // verify from the payload alone. This definition means all three
      // `BackupStats` fields are fully, independently recomputable from
      // the decompressed payload — see `backupValidation.ts`'s
      // "collection/membership/asset count" checks.
      assetCount: memberships.length,
      membershipCount,
    },
    metadata: {
      dbVersion: DB_VERSION,
      collectionApiVersion: COLLECTION_API_VERSION,
      ...(options.label ? { label: options.label } : {}),
    },
    checksum,
    payloadEncoding: 'gzip+base64',
    payload: compressedPayload,
  };

  return archive;
}

/** Decompresses and parses an archive's payload — the read-side
 * counterpart to `buildCollectionBackup`'s write side. Does NOT verify
 * the checksum (that's `backupValidation.ts`'s job, deliberately kept
 * separate so callers who only need the data, e.g. a preview, do not
 * have to also decide what to do with a checksum failure — they get
 * `BackupCodecError` for structural corruption, and can call
 * `backupValidation.ts` first if they want the checksum guarantee
 * before trusting the result). */
export async function readBackupPayload(archive: BackupArchive): Promise<BackupPayload> {
  const json = await decompressFromBase64(archive.payload);
  return JSON.parse(json) as BackupPayload;
}
