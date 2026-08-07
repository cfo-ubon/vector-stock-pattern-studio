import { describe, it, expect, beforeEach } from 'vitest';
import { computeDuplicateSubmissionWarnings, executeBulkMarketplaceExport, type BulkMarketplaceExportContext } from './bulkMarketplaceExport';
import { computeCommercialReadiness } from './readinessEngine';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import { importAssetTransaction, clearPortfolioStores } from '../catalog/storage/portfolioStore';
import { loadCommercialPackageHistory } from './storage/commercialPackageHistoryStore';
import { sha256HexOfFile } from '../catalog/domain/hash';
import { generateFileId } from '../catalog/domain/id';
import type { PortfolioFileRecord, SourceFileReference, PortfolioAsset } from '../catalog/domain/types';
// jsdom's Blob isn't recognized by Node's structuredClone (fake-indexeddb) —
// same workaround exportWorkflow.test.ts/batchExportService.test.ts already
// established.
import { Blob as NodeBlob } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

async function makeSvgAssetAndFile(displayName = 'Flower'): Promise<{ asset: PortfolioAsset; record: PortfolioFileRecord }> {
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
  const record: PortfolioFileRecord = { fileId: ref.fileId, assetId: asset.assetId, role: 'svg', filename: 'flower.svg', mimeType: 'image/svg+xml', fileSize: svgBlob.size, sha256: svgHash, blob: svgBlob, storedAt: Date.now() };
  await importAssetTransaction(asset, [record]);
  return { asset, record };
}

function emptyContext(overrides: Partial<BulkMarketplaceExportContext> = {}): BulkMarketplaceExportContext {
  return { assets: [], submissions: [], submissionsByAsset: new Map(), readinessByAsset: new Map(), collections: [], ...overrides };
}

describe('computeDuplicateSubmissionWarnings', () => {
  it('warns when an already-approved submission exists for this asset+marketplace', async () => {
    const { asset } = await makeSvgAssetAndFile();
    const submission = {
      ...createSubmissionRecord({
        patternId: asset.assetId,
        marketplaceId: 'shutterstock',
        version: 1,
        titleSnapshot: 'Flower Pattern',
        descriptionSnapshot: '',
        keywordSnapshot: ['flower'],
        productionAssetId: asset.productionAssetId,
      }),
      status: 'APPROVED' as const,
    };
    const ctx = emptyContext({ assets: [asset], submissions: [submission], submissionsByAsset: new Map([[asset.assetId, [submission]]]) });

    const warnings = computeDuplicateSubmissionWarnings([asset.assetId], ['shutterstock'], ctx);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain(asset.displayName);
  });

  it('returns no warnings when there is no prior submission', async () => {
    const { asset } = await makeSvgAssetAndFile();
    const ctx = emptyContext({ assets: [asset] });
    expect(computeDuplicateSubmissionWarnings([asset.assetId], ['shutterstock'], ctx)).toEqual([]);
  });
});

describe('executeBulkMarketplaceExport', () => {
  it('builds one real ZIP result per marketplace for the selected assets and records package history', async () => {
    const { asset } = await makeSvgAssetAndFile();
    const readiness = computeCommercialReadiness({ asset, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    const ctx = emptyContext({ assets: [asset], readinessByAsset: new Map([[asset.assetId, readiness]]) });

    const results = await executeBulkMarketplaceExport([asset.assetId], ['shutterstock', 'etsy'], ctx);

    expect(results.length).toBe(2);
    expect(results.map((r) => r.marketplaceId).sort()).toEqual(['etsy', 'shutterstock']);
    for (const result of results) {
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.builtAssetIds).toContain(asset.assetId);
    }

    const history = await loadCommercialPackageHistory();
    const recorded = history.filter((h) => h.assetId === asset.assetId);
    expect(recorded.map((h) => h.marketplaceId).sort()).toEqual(['etsy', 'shutterstock']);
  });

  it('skips an unknown marketplace id rather than throwing', async () => {
    const { asset } = await makeSvgAssetAndFile();
    const ctx = emptyContext({ assets: [asset] });
    // @ts-expect-error deliberately invalid marketplace id to prove the guard works
    const results = await executeBulkMarketplaceExport([asset.assetId], ['not-a-real-marketplace'], ctx);
    expect(results).toEqual([]);
  });
});
