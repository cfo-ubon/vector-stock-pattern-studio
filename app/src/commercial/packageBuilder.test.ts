import { describe, it, expect } from 'vitest';
import { buildCommercialPackage, CommercialPackageError } from './packageBuilder';
import { computeCommercialReadiness } from './readinessEngine';
import { createPortfolioAsset } from '../catalog/domain/asset';
import { createSubmissionRecord } from '../catalog/submission/submissionRecord';
import { sha256HexOfFile } from '../catalog/domain/hash';
import { generateFileId } from '../catalog/domain/id';
import type { PortfolioFileRecord, SourceFileReference } from '../catalog/domain/types';

function makeRef(role: SourceFileReference['role'], sha256: string, filename: string, fileId = generateFileId()): SourceFileReference {
  return { fileId, role, filename, mimeType: 'text/plain', fileSize: 10, sha256 };
}

async function makeSvgAssetAndFile() {
  const svgBlob = new Blob(['<svg>content</svg>']);
  const svgHash = await sha256HexOfFile(svgBlob);
  const ref = makeRef('svg', svgHash, 'flower.svg');
  ref.fileSize = svgBlob.size;
  const asset = createPortfolioAsset({
    displayName: 'Flower',
    originalFilename: 'flower.svg',
    sourceFileReferences: [ref],
    previewReference: ref.fileId,
    metadataReference: null,
    productionAssetId: 'PAID-abc123',
    generatorVersion: 'v1.0',
    presetId: 'luxuryFloral',
  });
  const record: PortfolioFileRecord = {
    fileId: ref.fileId,
    assetId: asset.assetId,
    role: 'svg',
    filename: 'flower.svg',
    mimeType: 'image/svg+xml',
    fileSize: svgBlob.size,
    sha256: svgHash,
    blob: svgBlob,
    storedAt: Date.now(),
  };
  return { asset, record };
}

async function readZipEntryNames(blob: Blob): Promise<string[]> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const names: string[] = [];
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset < buffer.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    names.push(decoder.decode(buffer.slice(nameStart, nameStart + nameLength)));
    offset = nameStart + nameLength + extraLength + compressedSize;
  }
  return names;
}

describe('buildCommercialPackage', () => {
  it('throws CommercialPackageError for an unregistered marketplace id', async () => {
    const { asset, record } = await makeSvgAssetAndFile();
    const asset2 = { ...asset, collectionIds: ['col-1'] };
    const readiness = computeCommercialReadiness({ asset: asset2, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    await expect(
      buildCommercialPackage({
        asset: asset2,
        files: [record],
        marketplaceId: 'not-a-real-marketplace' as never,
        readiness,
        submission: null,
        collections: [],
      }),
    ).rejects.toThrow(CommercialPackageError);
  });

  it('builds a real ZIP with manifest.json + readiness-report.json + the asset source file', async () => {
    const { asset, record } = await makeSvgAssetAndFile();
    const asset2 = { ...asset, collectionIds: ['col-1'] };
    const readiness = computeCommercialReadiness({ asset: asset2, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });
    const submission = { ...createSubmissionRecord({ patternId: asset2.assetId, marketplaceId: 'shutterstock' }), titleSnapshot: 'Flower pattern', keywordSnapshot: ['floral', 'seamless'] };

    const result = await buildCommercialPackage({
      asset: asset2,
      files: [record],
      marketplaceId: 'shutterstock',
      readiness,
      submission,
      collections: [],
    });

    expect(result.filename).toContain('shutterstock');
    expect(result.filename).toContain(asset2.assetId);
    expect(result.manifest.seo.hasSubmission).toBe(true);
    expect(result.manifest.seo.title).toBe('Flower pattern');
    expect(result.manifest.traceability.presetId).toBe('luxuryFloral');

    const names = await readZipEntryNames(result.blob);
    expect(names).toContain('manifest.json');
    expect(names).toContain('readiness-report.json');
    expect(names).toContain('flower.svg');
  });

  it('honestly reports empty SEO fields (never fabricated text) when no submission exists', async () => {
    const { asset, record } = await makeSvgAssetAndFile();
    const asset2 = { ...asset, collectionIds: ['col-1'] };
    const readiness = computeCommercialReadiness({ asset: asset2, qualitySnapshot: null, submissionsForAsset: [], siblingAssets: [] });

    const result = await buildCommercialPackage({ asset: asset2, files: [record], marketplaceId: 'shutterstock', readiness, submission: null, collections: [] });

    expect(result.manifest.seo.hasSubmission).toBe(false);
    expect(result.manifest.seo.title).toBe('');
    expect(result.manifest.seo.keywords).toEqual([]);
  });
});
