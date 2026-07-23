import { describe, it, expect } from 'vitest';
import { buildSubmissionPackage, sanitizeZipEntryName, SubmissionPackageError } from './submissionPackageBuilder';
import { createPortfolioAsset } from '../domain/asset';
import { createSubmissionRecord } from './submissionRecord';
import { sha256HexOfFile } from '../domain/hash';
import { generateFileId } from '../domain/id';
import type { PortfolioFileRecord, SourceFileReference } from '../domain/types';

/** Minimal STORE-method ZIP reader, mirroring `services/exportAsset.test.ts`'s
 * own helper -- sufficient to verify what `buildZip` actually wrote. */
async function readStoredZipEntries(blob: Blob): Promise<Array<{ name: string; data: Uint8Array }>> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset < buffer.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(buffer.slice(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const data = buffer.slice(dataStart, dataStart + compressedSize);
    entries.push({ name, data });
    offset = dataStart + compressedSize;
  }
  return entries;
}

function makeRef(role: SourceFileReference['role'], sha256: string, filename: string): SourceFileReference {
  return { fileId: generateFileId(), role, filename, mimeType: 'text/plain', fileSize: 10, sha256 };
}

async function makeSvgAssetAndFile(filename = 'flower.svg') {
  const svgBlob = new Blob(['<svg>content</svg>']);
  const svgHash = await sha256HexOfFile(svgBlob);
  const ref = makeRef('svg', svgHash, filename);
  ref.fileSize = svgBlob.size;
  const asset = createPortfolioAsset({
    displayName: 'Flower',
    originalFilename: filename,
    sourceFileReferences: [ref],
    previewReference: ref.fileId,
    metadataReference: null,
    productionAssetId: 'PAID-abc123',
  });
  const record: PortfolioFileRecord = {
    fileId: ref.fileId,
    assetId: asset.assetId,
    role: 'svg',
    filename,
    mimeType: 'image/svg+xml',
    fileSize: svgBlob.size,
    sha256: svgHash,
    blob: svgBlob,
    storedAt: Date.now(),
  };
  return { asset, record, svgHash };
}

describe('sanitizeZipEntryName', () => {
  it('leaves an ordinary filename unchanged', () => {
    expect(sanitizeZipEntryName('flower.svg')).toBe('flower.svg');
  });

  it('strips a leading directory-traversal segment', () => {
    expect(sanitizeZipEntryName('../../etc/passwd')).toBe('etc/passwd');
  });

  it('strips traversal segments mixed into the middle of a path', () => {
    expect(sanitizeZipEntryName('a/../../b/c.svg')).toBe('a/b/c.svg');
  });

  it('normalizes backslashes and strips a Windows-style absolute-drive prefix', () => {
    expect(sanitizeZipEntryName('C:\\Windows\\evil.svg')).toBe('C:/Windows/evil.svg');
  });

  it('strips a leading slash (absolute path)', () => {
    expect(sanitizeZipEntryName('/etc/passwd')).toBe('etc/passwd');
  });

  it('strips embedded control characters', () => {
    expect(sanitizeZipEntryName('evil\u0000.svg')).toBe('evil.svg');
  });

  it('falls back to a safe placeholder when nothing survives sanitization', () => {
    expect(sanitizeZipEntryName('../..')).toBe('unnamed-file');
    expect(sanitizeZipEntryName('')).toBe('unnamed-file');
  });
});

describe('buildSubmissionPackage', () => {
  it('produces a ZIP with every expected file', async () => {
    const { asset, record } = await makeSvgAssetAndFile();
    const submission = createSubmissionRecord({
      patternId: asset.assetId,
      marketplaceId: 'etsy',
      titleSnapshot: 'Luxury Floral Pattern',
      descriptionSnapshot: 'A seamless luxury floral repeat.',
      keywordSnapshot: ['floral', 'luxury', 'seamless', 'pattern', 'botanical'],
      category: 'Patterns',
      productionAssetId: asset.productionAssetId,
    });

    const result = await buildSubmissionPackage({ asset, files: [record], submission, existingSubmissions: [] });
    expect(result.filename.endsWith('.zip')).toBe(true);
    expect(result.filename).toContain('etsy');
    expect(result.filename).toContain(asset.assetId);

    const entries = await readStoredZipEntries(result.blob);
    const names = entries.map((e) => e.name);
    expect(names).toContain('manifest.json');
    expect(names).toContain('title.txt');
    expect(names).toContain('description.txt');
    expect(names).toContain('keywords.txt');
    expect(names).toContain('SHA-256SUMS.txt');
    expect(names).toContain('submission-checklist.json');
    expect(names).toContain('duplicate-warning-report.json');
    expect(names).toContain('flower.svg');

    const titleEntry = entries.find((e) => e.name === 'title.txt')!;
    expect(new TextDecoder().decode(titleEntry.data)).toBe('Luxury Floral Pattern');
  });

  it('SHA-256SUMS.txt lists the correct hash for every source file', async () => {
    const { asset, record, svgHash } = await makeSvgAssetAndFile();
    const submission = createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' });
    const result = await buildSubmissionPackage({ asset, files: [record], submission, existingSubmissions: [] });
    const entries = await readStoredZipEntries(result.blob);
    const sumsEntry = entries.find((e) => e.name === 'SHA-256SUMS.txt')!;
    const sumsText = new TextDecoder().decode(sumsEntry.data);
    expect(sumsText).toContain(`${svgHash}  flower.svg`);
  });

  it('sanitizes a maliciously-named source file so it cannot escape the archive root', async () => {
    const { asset, record } = await makeSvgAssetAndFile('../../../evil.svg');
    const submission = createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' });
    const result = await buildSubmissionPackage({ asset, files: [record], submission, existingSubmissions: [] });
    const entries = await readStoredZipEntries(result.blob);
    const names = entries.map((e) => e.name);
    expect(names.some((n) => n.includes('..'))).toBe(false);
    expect(names.some((n) => n.startsWith('/'))).toBe(false);
    expect(names).toContain('evil.svg');
  });

  it('the checklist reports missing-title when the submission has no title', async () => {
    const { asset, record } = await makeSvgAssetAndFile();
    const submission = createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'etsy' });
    const result = await buildSubmissionPackage({ asset, files: [record], submission, existingSubmissions: [] });
    expect(result.checklist.valid).toBe(false);
    expect(result.checklist.issues.some((i) => i.code === 'missing-title')).toBe(true);
  });

  it('the duplicate-warning report flags a same-production-asset conflict from a different pattern', async () => {
    const { asset, record } = await makeSvgAssetAndFile();
    const existing = createSubmissionRecord({
      patternId: 'some-other-pattern-id',
      marketplaceId: 'etsy',
      productionAssetId: asset.productionAssetId,
    });
    const submission = createSubmissionRecord({
      patternId: asset.assetId,
      marketplaceId: 'etsy',
      titleSnapshot: 'Title',
      descriptionSnapshot: 'Description',
      keywordSnapshot: ['a', 'b', 'c', 'd', 'e'],
      category: 'Patterns',
      productionAssetId: asset.productionAssetId,
    });
    const result = await buildSubmissionPackage({ asset, files: [record], submission, existingSubmissions: [existing] });
    expect(result.duplicateWarnings.isDuplicate).toBe(true);
    expect(result.duplicateWarnings.conflicts.some((c) => c.reason === 'same-production-asset')).toBe(true);
  });

  it('throws SubmissionPackageError for an unregistered marketplace', async () => {
    const { asset, record } = await makeSvgAssetAndFile();
    const submission = createSubmissionRecord({ patternId: asset.assetId, marketplaceId: 'not-a-real-marketplace' });
    await expect(buildSubmissionPackage({ asset, files: [record], submission, existingSubmissions: [] })).rejects.toBeInstanceOf(SubmissionPackageError);
  });
});
