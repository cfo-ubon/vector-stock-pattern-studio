import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildProductionBackup,
  readProductionBackupPayload,
  validateProductionBackupArchive,
  restoreProductionBackup,
  isProductionBackupArchiveShape,
  ProductionBackupValidationError,
  PRODUCTION_BACKUP_FORMAT_ID,
} from './productionBackup';
import { createSubmissionRecord } from '../submission/submissionRecord';
import { putSubmission, resetSubmissionStoreForTest, forgetInMemoryStateForTest } from '../submission/submissionStore';
import { createSalesEvent } from '../submission/salesRevenue';
import { putSalesEvent, clearSalesEvents } from '../submission/salesRevenueStore';
import { createRejectionRecord } from '../submission/rejectionIntelligence';
import { putRejectionRecord, clearRejectionRecords } from '../submission/rejectionStore';
import { createQualitySnapshot } from '../quality/qualitySnapshotStore';
import { putQualitySnapshot, clearQualitySnapshots } from '../quality/qualitySnapshotStore';
import { createProductionQueueItem } from '../queue/productionQueue';
import { putProductionQueueItem, clearProductionQueueItems } from '../queue/productionQueueStore';
import { createProductionBatch } from '../queue/productionBatch';
import { putProductionBatch, clearProductionBatches } from '../queue/productionBatchStore';
import { createImportHistoryRecord } from '../import/importHistoryStore';
import { putImportHistoryRecord, clearImportHistory } from '../import/importHistoryStore';
import { createMarketplaceRegistration } from '../submission/marketplaceRegistration';
import { putMarketplaceRegistration, clearMarketplaceRegistrations } from '../submission/marketplaceRegistrationStore';

beforeEach(async () => {
  await resetSubmissionStoreForTest();
  await clearSalesEvents();
  await clearRejectionRecords();
  await clearQualitySnapshots();
  await clearProductionQueueItems();
  await clearProductionBatches();
  await clearImportHistory();
  await clearMarketplaceRegistrations();
});

async function seedOneOfEach() {
  const submission = createSubmissionRecord({ patternId: 'p1', marketplaceId: 'etsy' });
  putSubmission(submission);
  await putSalesEvent(createSalesEvent({ productionAssetId: 'PAID-1', marketplaceId: 'etsy', date: 1000 }));
  await putRejectionRecord(createRejectionRecord({ submissionId: submission.submissionId, marketplaceReasonText: 'duplicate' }));
  await putQualitySnapshot(createQualitySnapshot({ assetId: 'VSP-1', beautyScore: 80, commercialScore: 80, fragmented: false, deadSpace: false, decision: 'READY', generatorVersion: '1.0' }));
  await putProductionQueueItem(createProductionQueueItem({ ideaNote: 'idea' }));
  await putProductionBatch(createProductionBatch({ name: 'Batch', batchType: 'collection' }));
  await putImportHistoryRecord(createImportHistoryRecord({ importedAt: Date.now(), buildLabelsSeen: [], assetsImported: 0, assetsSkippedAsDuplicate: 0, assetsErrored: 0, manifestEntriesFound: 0, skippedFiles: [], missingReferences: [], malformedManifestFiles: [] }));
  await putMarketplaceRegistration(createMarketplaceRegistration({ marketplaceId: 'etsy' }));
}

describe('buildProductionBackup', () => {
  it('produces an archive with correct stats for all 8 stores', async () => {
    await seedOneOfEach();
    const archive = await buildProductionBackup();
    expect(archive.format).toBe(PRODUCTION_BACKUP_FORMAT_ID);
    expect(archive.stats).toEqual({
      submissionCount: 1,
      salesEventCount: 1,
      rejectionRecordCount: 1,
      qualitySnapshotCount: 1,
      queueItemCount: 1,
      batchCount: 1,
      importHistoryCount: 1,
      marketplaceRegistrationCount: 1,
    });
  });

  it('round-trips the payload exactly through compress/decompress', async () => {
    await seedOneOfEach();
    const archive = await buildProductionBackup();
    const payload = await readProductionBackupPayload(archive);
    expect(payload.submissions).toHaveLength(1);
    expect(payload.salesEvents).toHaveLength(1);
    expect(payload.rejectionRecords).toHaveLength(1);
    expect(payload.qualitySnapshots).toHaveLength(1);
    expect(payload.queueItems).toHaveLength(1);
    expect(payload.batches).toHaveLength(1);
    expect(payload.importHistory).toHaveLength(1);
    expect(payload.marketplaceRegistrations).toHaveLength(1);
  });

  it('includes an optional label when supplied', async () => {
    const archive = await buildProductionBackup({ label: 'Before cleanup' });
    expect(archive.label).toBe('Before cleanup');
  });
});

describe('validateProductionBackupArchive', () => {
  it('accepts a freshly-built archive', async () => {
    const archive = await buildProductionBackup();
    const result = await validateProductionBackupArchive(archive);
    expect(result.valid).toBe(true);
  });

  it('rejects a completely wrong shape', async () => {
    const result = await validateProductionBackupArchive({ not: 'an archive' });
    expect(result.valid).toBe(false);
  });

  it('rejects a tampered checksum', async () => {
    const archive = await buildProductionBackup();
    const tampered = { ...archive, checksum: 'deadbeef'.repeat(8) };
    const result = await validateProductionBackupArchive(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Checksum mismatch');
  });

  it('rejects an unsupported schema version', async () => {
    const archive = await buildProductionBackup();
    const result = await validateProductionBackupArchive({ ...archive, schemaVersion: 999 });
    expect(result.valid).toBe(false);
  });
});

describe('isProductionBackupArchiveShape', () => {
  it('rejects null/undefined/non-object values', () => {
    expect(isProductionBackupArchiveShape(null)).toBe(false);
    expect(isProductionBackupArchiveShape(undefined)).toBe(false);
    expect(isProductionBackupArchiveShape('a string')).toBe(false);
  });
});

describe('restoreProductionBackup', () => {
  it('restores every store from a valid archive', async () => {
    await seedOneOfEach();
    const archive = await buildProductionBackup();

    await resetSubmissionStoreForTest();
    await clearSalesEvents();
    await clearRejectionRecords();
    await clearQualitySnapshots();
    await clearProductionQueueItems();
    await clearProductionBatches();
    await clearImportHistory();
    await clearMarketplaceRegistrations();

    const result = await restoreProductionBackup(archive);
    expect(result).toEqual({
      submissionsRestored: 1,
      salesEventsRestored: 1,
      rejectionRecordsRestored: 1,
      qualitySnapshotsRestored: 1,
      queueItemsRestored: 1,
      batchesRestored: 1,
      importHistoryRestored: 1,
      marketplaceRegistrationsRestored: 1,
    });
  });

  it('restore is an upsert -- restoring twice does not duplicate records', async () => {
    await seedOneOfEach();
    const archive = await buildProductionBackup();
    await restoreProductionBackup(archive);
    await forgetInMemoryStateForTest();
    await restoreProductionBackup(archive);
    const secondArchive = await buildProductionBackup();
    expect(secondArchive.stats.submissionCount).toBe(1);
    expect(secondArchive.stats.salesEventCount).toBe(1);
  });

  it('refuses to restore a corrupted archive, leaving stores untouched', async () => {
    const archive = await buildProductionBackup();
    const tampered = { ...archive, checksum: 'deadbeef'.repeat(8) };
    await expect(restoreProductionBackup(tampered)).rejects.toBeInstanceOf(ProductionBackupValidationError);
  });
});
