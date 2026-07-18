import { describe, it, expect } from 'vitest';
import { computeHealthReport, duplicateAssetIdsFromReport } from './healthCheck';
import { createPortfolioAsset } from '../domain/asset';
import type { PortfolioFileRecord, SourceFileReference } from '../domain/types';

function ref(role: SourceFileReference['role'], fileId: string, sha256 = `h-${fileId}`): SourceFileReference {
  return { fileId, role, filename: `x.${role}`, mimeType: 'text/plain', fileSize: 10, sha256 };
}

function fileRecord(fileId: string, assetId: string, sha256 = `h-${fileId}`): PortfolioFileRecord {
  return { fileId, assetId, role: 'svg', filename: 'x.svg', mimeType: 'image/svg+xml', fileSize: 10, sha256, blob: new Blob(['x']), storedAt: Date.now() };
}

describe('computeHealthReport', () => {
  it('reports a clean catalog with zero issues', () => {
    const svgRef = ref('svg', 'f1');
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [svgRef], previewReference: 'f1', metadataReference: null });
    const files = [fileRecord('f1', asset.assetId)];
    const report = computeHealthReport([asset], files);
    expect(report.recordCount).toBe(1);
    expect(report.missingSourceReferences).toHaveLength(0);
    expect(report.missingPreviews).toHaveLength(0);
    expect(report.duplicateHashGroups).toHaveLength(0);
    expect(report.orphanedFileIds).toHaveLength(0);
    expect(report.invalidMetadataAssetIds).toHaveLength(0);
    expect(report.migrationStatus.needsMigration).toBe(0);
  });

  it('detects a missing source reference (asset points at a file that does not exist)', () => {
    const svgRef = ref('svg', 'f-missing');
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [svgRef], previewReference: null, metadataReference: null });
    const report = computeHealthReport([asset], []);
    expect(report.missingSourceReferences).toHaveLength(1);
    expect(report.missingSourceReferences[0].fileId).toBe('f-missing');
  });

  it('detects a missing preview', () => {
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.json', sourceFileReferences: [], previewReference: null, metadataReference: null });
    const report = computeHealthReport([asset], []);
    expect(report.missingPreviews).toEqual([asset.assetId]);
  });

  it('detects duplicate hashes across two different assets', () => {
    const sharedHash = 'shared-hash';
    const a = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [ref('svg', 'fa', sharedHash)], previewReference: null, metadataReference: null });
    const b = createPortfolioAsset({ displayName: 'B', originalFilename: 'b.svg', sourceFileReferences: [ref('svg', 'fb', sharedHash)], previewReference: null, metadataReference: null });
    const report = computeHealthReport([a, b], []);
    expect(report.duplicateHashGroups).toHaveLength(1);
    expect(report.duplicateHashGroups[0].assetIds.sort()).toEqual([a.assetId, b.assetId].sort());
  });

  it('detects orphaned stored files (a file record whose asset no longer exists)', () => {
    const orphan = fileRecord('f-orphan', 'some-deleted-asset-id');
    const report = computeHealthReport([], [orphan]);
    expect(report.orphanedFileIds).toEqual(['f-orphan']);
  });

  it('detects invalid metadata records', () => {
    const asset = createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    const corrupted = { ...asset, assetId: undefined } as unknown as typeof asset;
    const report = computeHealthReport([corrupted], []);
    expect(report.invalidMetadataAssetIds).toHaveLength(1);
  });
});

describe('duplicateAssetIdsFromReport', () => {
  it('flattens every duplicate group into one set of asset IDs', () => {
    const report = computeHealthReport(
      [
        createPortfolioAsset({ displayName: 'A', originalFilename: 'a.svg', sourceFileReferences: [ref('svg', 'fa', 'H')], previewReference: null, metadataReference: null }),
        createPortfolioAsset({ displayName: 'B', originalFilename: 'b.svg', sourceFileReferences: [ref('svg', 'fb', 'H')], previewReference: null, metadataReference: null }),
      ],
      [],
    );
    expect(duplicateAssetIdsFromReport(report).size).toBe(2);
  });
});
