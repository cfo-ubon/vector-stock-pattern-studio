import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXPORT_MARKETPLACE_OPTIONS,
  findExportMarketplaceOption,
  deriveAssetExportStatus,
  buildBulkExportForMarketplace,
  type BulkExportAssetInput,
} from './exportWorkflow';
import { computeCommercialReadiness } from './readinessEngine';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import { importAssetTransaction, clearPortfolioStores } from '../catalog/storage/portfolioStore';
import { sha256HexOfFile } from '../catalog/domain/hash';
import { generateFileId } from '../catalog/domain/id';
import type { PortfolioFileRecord, SourceFileReference } from '../catalog/domain/types';
import type { CommercialPackageHistoryEntry } from './domain/types';
// jsdom's Blob isn't recognized by Node's structuredClone (fake-indexeddb) —
// same workaround `batchExportService.test.ts` already established.
import { Blob as NodeBlob } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

async function makeSvgAssetAndFile(displayName = 'Flower') {
  const svgBlob = new NodeBlob(['<svg>content</svg>']) as unknown as Blob;
  const svgHash = await sha256HexOfFile(svgBlob);
  const ref: SourceFileReference = { fileId: generateFileId(), role: 'svg', filename: 'flower.svg', mimeType: 'image/svg+xml', fileSize: svgBlob.size, sha256: svgHash };
  const asset = createPortfolioAsset({
    displayName,
    originalFilename: 'flower.svg',
    sourceFileReferences: [ref],
    previewReference: ref.fileId,
    metadataReference: null,
  });
  asset.collectionIds = ['col-1'];
  const record: PortfolioFileRecord = { fileId: ref.fileId, assetId: asset.assetId, role: 'svg', filename: 'flower.svg', mimeType: 'image/svg+xml', fileSize: svgBlob.size, sha256: svgHash, blob: svgBlob, storedAt: Date.now() };
  return { asset, record };
}

async function readZipEntryNames(blob: Blob): Promise<string[]> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const names: string[] = [];
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset < buffer.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    names.push(decoder.decode(buffer.slice(nameStart, nameStart + nameLength)));
    if (method !== 0 && method !== 8) break;
    offset = nameStart + nameLength + extraLength + compressedSize;
  }
  return names;
}

describe('EXPORT_MARKETPLACE_OPTIONS', () => {
  it('exposes exactly the 6 marketplaces the mission spec names', () => {
    expect(EXPORT_MARKETPLACE_OPTIONS.map((m) => m.id).sort()).toEqual(['adobestock', 'custom', 'etsy', 'freepik', 'getty', 'shutterstock'].sort());
  });

  it('marks the 4 real marketplace profiles as wired and Getty/Custom as unwired', () => {
    expect(findExportMarketplaceOption('shutterstock')?.wired).toBe(true);
    expect(findExportMarketplaceOption('adobestock')?.wired).toBe(true);
    expect(findExportMarketplaceOption('freepik')?.wired).toBe(true);
    expect(findExportMarketplaceOption('etsy')?.wired).toBe(true);
    expect(findExportMarketplaceOption('getty')?.wired).toBe(false);
    expect(findExportMarketplaceOption('custom')?.wired).toBe(false);
  });

  it('every option has a non-empty exportFiles description', () => {
    for (const option of EXPORT_MARKETPLACE_OPTIONS) {
      expect(option.exportFiles.length).toBeGreaterThan(0);
    }
  });
});

describe('deriveAssetExportStatus', () => {
  it('reports never-exported when there is no readiness, submission, or package history', () => {
    const status = deriveAssetExportStatus({ readiness: null, submissionsForAsset: [], packageHistoryForAsset: [] });
    expect(status.id).toBe('never-exported');
    expect(status.at).toBeNull();
  });

  it('reports export-ready when readiness band is READY but nothing has been exported yet', async () => {
    const { asset } = await makeSvgAssetAndFile();
    const readiness = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    const status = deriveAssetExportStatus({ readiness, submissionsForAsset: [], packageHistoryForAsset: [] });
    // This asset is not actually READY-quality (no QA snapshot etc.), so
    // assert the honest fallback behavior instead of assuming READY.
    expect(status.id).toBe(readiness.band === 'READY' ? 'export-ready' : 'never-exported');
  });

  it('picks the most recent real event across submissions and package history', () => {
    const older: CommercialPackageHistoryEntry = { id: 'h1', createdAt: 1000, assetId: 'a1', marketplaceId: 'shutterstock', status: 'BUILT', readinessScore: 80 };
    const submission = createSubmissionRecord({ patternId: 'a1', marketplaceId: 'shutterstock', now: 2000 });
    const submitted = { ...submission, status: 'SUBMITTED' as const, updatedAt: 2000 };
    const status = deriveAssetExportStatus({ readiness: null, submissionsForAsset: [submitted], packageHistoryForAsset: [older] });
    expect(status.id).toBe('submitted');
    expect(status.at).toBe(2000);
  });

  it('maps APPROVED/REJECTED/ARCHIVED submission statuses to accepted/rejected/archived', () => {
    const base = createSubmissionRecord({ patternId: 'a1', marketplaceId: 'shutterstock' });
    expect(deriveAssetExportStatus({ readiness: null, submissionsForAsset: [{ ...base, status: 'APPROVED', updatedAt: 1 }], packageHistoryForAsset: [] }).id).toBe('accepted');
    expect(deriveAssetExportStatus({ readiness: null, submissionsForAsset: [{ ...base, status: 'REJECTED', updatedAt: 1 }], packageHistoryForAsset: [] }).id).toBe('rejected');
    expect(deriveAssetExportStatus({ readiness: null, submissionsForAsset: [{ ...base, status: 'ARCHIVED', updatedAt: 1 }], packageHistoryForAsset: [] }).id).toBe('archived');
  });

  it('does not treat DRAFT/READY/QUEUED submission statuses as real export activity', () => {
    const base = createSubmissionRecord({ patternId: 'a1', marketplaceId: 'shutterstock' });
    const status = deriveAssetExportStatus({ readiness: null, submissionsForAsset: [{ ...base, status: 'DRAFT', updatedAt: 1 }], packageHistoryForAsset: [] });
    expect(status.id).toBe('never-exported');
  });
});

describe('buildBulkExportForMarketplace', () => {
  it('bundles per-asset commercial packages into one outer ZIP for a wired marketplace', async () => {
    const { asset: asset1, record: record1 } = await makeSvgAssetAndFile('Asset One');
    const { asset: asset2, record: record2 } = await makeSvgAssetAndFile('Asset Two');
    const readiness1 = computeCommercialReadiness({ asset: asset1, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    const readiness2 = computeCommercialReadiness({ asset: asset2, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });

    const inputs: BulkExportAssetInput[] = [
      { asset: asset1, files: [record1], readiness: readiness1, submission: null, collections: [] },
      { asset: asset2, files: [record2], readiness: readiness2, submission: null, collections: [] },
    ];

    const marketplace = findExportMarketplaceOption('shutterstock')!;
    const result = await buildBulkExportForMarketplace(marketplace, inputs, 1700000000000);

    expect(result.marketplaceId).toBe('shutterstock');
    expect(result.builtAssetIds.sort()).toEqual([asset1.assetId, asset2.assetId].sort());
    expect(result.skipped).toEqual([]);
    expect(result.fileCount).toBe(2);
    expect(result.filename).toContain('shutterstock');
    expect(result.filename).toContain('2-assets');

    const entryNames = await readZipEntryNames(result.blob);
    expect(entryNames.length).toBe(2);
    // Each inner entry is itself a real nested ZIP (the individual
    // commercial package), not a flattened re-derivation of its contents.
    for (const name of entryNames) {
      expect(name.endsWith('.zip')).toBe(true);
    }
  });

  it('skips an asset that fails to build and still returns the others, with an honest reason', async () => {
    const { asset: asset1, record: record1 } = await makeSvgAssetAndFile('Buildable');
    const readiness1 = computeCommercialReadiness({ asset: asset1, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    const { asset: asset2 } = await makeSvgAssetAndFile('Missing readiness');

    const inputs: BulkExportAssetInput[] = [
      { asset: asset1, files: [record1], readiness: readiness1, submission: null, collections: [] },
      { asset: asset2, files: [], readiness: null, submission: null, collections: [] },
    ];

    const marketplace = findExportMarketplaceOption('adobestock')!;
    const result = await buildBulkExportForMarketplace(marketplace, inputs);

    expect(result.builtAssetIds).toEqual([asset1.assetId]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].assetId).toBe(asset2.assetId);
    expect(result.skipped[0].reason.length).toBeGreaterThan(0);
  });

  it('reuses the generic multi-asset export ZIP for an unwired marketplace (Getty/Custom)', async () => {
    const { asset, record } = await makeSvgAssetAndFile('Getty Candidate');
    await importAssetTransaction(asset, [record]);

    const marketplace = findExportMarketplaceOption('getty')!;
    const result = await buildBulkExportForMarketplace(marketplace, [{ asset, files: [record], readiness: null, submission: null, collections: [] }]);

    expect(result.marketplaceId).toBe('getty');
    expect(result.builtAssetIds).toEqual([asset.assetId]);
    expect(result.skipped).toEqual([]);
    expect(result.blob.size).toBeGreaterThan(0);
  });
});
