import { compressToBase64, decompressFromBase64, computePayloadChecksum, BackupCodecError } from './backupCodec';
import { DB_VERSION } from '../../storage/db';
import { loadSubmissions, putSubmissionsBulk, whenSubmissionStoreHydrated } from '../submission/submissionStore';
import type { SubmissionRecord } from '../submission/submissionRecord';
import { loadSalesEvents, putSalesEventsBulk } from '../submission/salesRevenueStore';
import type { SalesEvent } from '../submission/salesRevenue';
import { loadRejectionRecords, putRejectionRecord } from '../submission/rejectionStore';
import type { RejectionRecord } from '../submission/rejectionIntelligence';
import { loadQualitySnapshots, putQualitySnapshot } from '../quality/qualitySnapshotStore';
import type { QualitySnapshot } from '../quality/qualitySnapshotStore';
import { loadProductionQueueItems, putProductionQueueItem } from '../queue/productionQueueStore';
import type { ProductionQueueItem } from '../queue/productionQueue';
import { loadProductionBatches, putProductionBatch } from '../queue/productionBatchStore';
import type { ProductionBatch } from '../queue/productionBatch';
import { loadImportHistory, putImportHistoryRecord } from '../import/importHistoryStore';
import type { ImportHistoryRecord } from '../import/importHistoryStore';
import { loadMarketplaceRegistrations, putMarketplaceRegistration } from '../submission/marketplaceRegistrationStore';
import type { MarketplaceRegistration } from '../submission/marketplaceRegistration';

// Build 026, Phase 16 — Production Backup & Restore. A second, separate
// backup subsystem alongside `backupFormat.ts`/`backupBuilder.ts`/
// `restoreService.ts` (the P3 "Collection subsystem" backup), rather
// than an extension of it -- that subsystem's own doc comments describe
// it explicitly as reading "only through the frozen Collection API" and
// covering "the Collection subsystem," and its restore logic is a
// bespoke field-by-field diff/conflict/merge engine built specifically
// around Collections and asset membership. The 8 new Build 026 stores
// (submissions, sales events, rejection records, quality snapshots,
// queue items, batches, import history, marketplace registrations) are
// unrelated data with no membership/conflict-field model of their own
// -- every one of them is a flat, keyPath-addressed record, so their
// backup/restore is deliberately simpler: a full snapshot of all 8
// stores, and a restore that's a plain upsert (each record's own
// primary key decides whether it creates or overwrites) rather than a
// Collection-style diff-and-choose. This module never reads or writes
// anything the Collection backup already owns (`Collection`,
// `PortfolioAsset`), and the Collection backup never reads or writes
// anything this module owns -- the two subsystems are fully
// independent and can be restored in either order.

export const PRODUCTION_BACKUP_FORMAT_ID = 'vsp-production-backup' as const;
export const PRODUCTION_BACKUP_SCHEMA_VERSION = 1;
export const SUPPORTED_PRODUCTION_BACKUP_SCHEMA_VERSIONS = [1];
export const PRODUCTION_BACKUP_GENERATOR_VERSION = '1.0.0';
const APPLICATION_VERSION = 'vector-stock-pattern-studio-production-portfolio';

export interface ProductionBackupPayload {
  submissions: SubmissionRecord[];
  salesEvents: SalesEvent[];
  rejectionRecords: RejectionRecord[];
  qualitySnapshots: QualitySnapshot[];
  queueItems: ProductionQueueItem[];
  batches: ProductionBatch[];
  importHistory: ImportHistoryRecord[];
  marketplaceRegistrations: MarketplaceRegistration[];
}

export interface ProductionBackupStats {
  submissionCount: number;
  salesEventCount: number;
  rejectionRecordCount: number;
  qualitySnapshotCount: number;
  queueItemCount: number;
  batchCount: number;
  importHistoryCount: number;
  marketplaceRegistrationCount: number;
}

export interface ProductionBackupArchive {
  format: typeof PRODUCTION_BACKUP_FORMAT_ID;
  schemaVersion: number;
  applicationVersion: string;
  generatorVersion: string;
  createdAt: number;
  dbVersion: number;
  stats: ProductionBackupStats;
  checksum: string;
  payloadEncoding: 'gzip+base64';
  payload: string;
  label?: string;
}

export function isProductionBackupArchiveShape(value: unknown): value is ProductionBackupArchive {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.format === PRODUCTION_BACKUP_FORMAT_ID &&
    typeof v.schemaVersion === 'number' &&
    typeof v.applicationVersion === 'string' &&
    typeof v.generatorVersion === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.checksum === 'string' &&
    v.payloadEncoding === 'gzip+base64' &&
    typeof v.payload === 'string' &&
    typeof v.stats === 'object' &&
    v.stats !== null
  );
}

export interface BuildProductionBackupOptions {
  label?: string;
}

/** Builds a complete snapshot of all 8 Build 026 stores. Read-only, same
 * "no lock held, safe to run alongside normal app usage" caveat as
 * `backupBuilder.ts`'s `buildCollectionBackup`. */
export async function buildProductionBackup(options: BuildProductionBackupOptions = {}): Promise<ProductionBackupArchive> {
  await whenSubmissionStoreHydrated();
  const [salesEvents, rejectionRecords, qualitySnapshots, queueItems, batches, importHistory, marketplaceRegistrations] = await Promise.all([
    loadSalesEvents(),
    loadRejectionRecords(),
    loadQualitySnapshots(),
    loadProductionQueueItems(),
    loadProductionBatches(),
    loadImportHistory(),
    loadMarketplaceRegistrations(),
  ]);
  const submissions = loadSubmissions();

  const payload: ProductionBackupPayload = {
    submissions,
    salesEvents,
    rejectionRecords,
    qualitySnapshots,
    queueItems,
    batches,
    importHistory,
    marketplaceRegistrations,
  };

  const checksum = await computePayloadChecksum(payload);
  const compressedPayload = await compressToBase64(JSON.stringify(payload));

  return {
    format: PRODUCTION_BACKUP_FORMAT_ID,
    schemaVersion: PRODUCTION_BACKUP_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
    generatorVersion: PRODUCTION_BACKUP_GENERATOR_VERSION,
    createdAt: Date.now(),
    dbVersion: DB_VERSION,
    stats: {
      submissionCount: submissions.length,
      salesEventCount: salesEvents.length,
      rejectionRecordCount: rejectionRecords.length,
      qualitySnapshotCount: qualitySnapshots.length,
      queueItemCount: queueItems.length,
      batchCount: batches.length,
      importHistoryCount: importHistory.length,
      marketplaceRegistrationCount: marketplaceRegistrations.length,
    },
    checksum,
    payloadEncoding: 'gzip+base64',
    payload: compressedPayload,
    ...(options.label ? { label: options.label } : {}),
  };
}

export async function readProductionBackupPayload(archive: ProductionBackupArchive): Promise<ProductionBackupPayload> {
  const json = await decompressFromBase64(archive.payload);
  return JSON.parse(json) as ProductionBackupPayload;
}

export class ProductionBackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionBackupValidationError';
  }
}

/** Structural + checksum validation, mirroring
 * `backupValidation.ts`'s two cheapest, always-run checks (shape, then
 * checksum) -- deliberately does not attempt the Collection backup's
 * richer live cross-checks, since these 8 domains have no equivalent
 * "does this asset still exist" question to ask. */
export async function validateProductionBackupArchive(value: unknown): Promise<{ valid: boolean; reason?: string }> {
  if (!isProductionBackupArchiveShape(value)) {
    return { valid: false, reason: 'This file is not a recognizable Production Backup archive.' };
  }
  if (!SUPPORTED_PRODUCTION_BACKUP_SCHEMA_VERSIONS.includes(value.schemaVersion)) {
    return { valid: false, reason: `Archive schema version ${value.schemaVersion} is not supported by this build.` };
  }
  try {
    const payload = await readProductionBackupPayload(value);
    const checksum = await computePayloadChecksum(payload);
    if (checksum !== value.checksum) {
      return { valid: false, reason: 'Checksum mismatch -- the archive is corrupted or was tampered with.' };
    }
  } catch (err) {
    if (err instanceof BackupCodecError) {
      return { valid: false, reason: err.message };
    }
    throw err;
  }
  return { valid: true };
}

export interface RestoreProductionBackupResult {
  submissionsRestored: number;
  salesEventsRestored: number;
  rejectionRecordsRestored: number;
  qualitySnapshotsRestored: number;
  queueItemsRestored: number;
  batchesRestored: number;
  importHistoryRestored: number;
  marketplaceRegistrationsRestored: number;
}

/** Restores all 8 stores from the archive via plain upsert (each
 * record's own primary key decides create-vs-overwrite) -- refuses to
 * write anything if the archive fails validation, matching
 * `restoreService.ts`'s "a broken archive must never partially apply"
 * rule. */
export async function restoreProductionBackup(archive: ProductionBackupArchive): Promise<RestoreProductionBackupResult> {
  const validation = await validateProductionBackupArchive(archive);
  if (!validation.valid) {
    throw new ProductionBackupValidationError(validation.reason ?? 'This Production Backup archive cannot be restored.');
  }
  const payload = await readProductionBackupPayload(archive);

  await whenSubmissionStoreHydrated();
  putSubmissionsBulk(payload.submissions);
  await putSalesEventsBulk(payload.salesEvents);
  for (const record of payload.rejectionRecords) await putRejectionRecord(record);
  for (const snapshot of payload.qualitySnapshots) await putQualitySnapshot(snapshot);
  for (const item of payload.queueItems) await putProductionQueueItem(item);
  for (const batch of payload.batches) await putProductionBatch(batch);
  for (const record of payload.importHistory) await putImportHistoryRecord(record);
  for (const registration of payload.marketplaceRegistrations) await putMarketplaceRegistration(registration);

  return {
    submissionsRestored: payload.submissions.length,
    salesEventsRestored: payload.salesEvents.length,
    rejectionRecordsRestored: payload.rejectionRecords.length,
    qualitySnapshotsRestored: payload.qualitySnapshots.length,
    queueItemsRestored: payload.queueItems.length,
    batchesRestored: payload.batches.length,
    importHistoryRestored: payload.importHistory.length,
    marketplaceRegistrationsRestored: payload.marketplaceRegistrations.length,
  };
}
