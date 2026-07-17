import { describe, it, expect } from 'vitest';
import { detectDuplicate, type DuplicateCandidateSignals } from './duplicates';
import { createPortfolioAsset } from '../domain/asset';
import type { SourceFileReference } from '../domain/types';

function ref(role: SourceFileReference['role'], sha256: string, size = 100): SourceFileReference {
  return { fileId: `f-${sha256}`, role, filename: `x.${role}`, mimeType: 'text/plain', fileSize: size, sha256 };
}

describe('detectDuplicate', () => {
  it('returns none when nothing overlaps', () => {
    const candidate: DuplicateCandidateSignals = { fileHashes: ['h1'], originalFilename: 'a.svg', totalFileSize: 100 };
    expect(detectDuplicate(candidate, []).kind).toBe('none');
  });

  it('flags an exact duplicate when a source file hash already exists in the catalog', () => {
    const existing = createPortfolioAsset({
      displayName: 'A',
      originalFilename: 'a.svg',
      sourceFileReferences: [ref('svg', 'shared-hash')],
      previewReference: null,
      metadataReference: null,
    });
    const candidate: DuplicateCandidateSignals = { fileHashes: ['shared-hash'], originalFilename: 'a.svg', totalFileSize: 100 };
    const result = detectDuplicate(candidate, [existing]);
    expect(result.kind).toBe('exact');
    if (result.kind === 'exact') expect(result.existingAsset.assetId).toBe(existing.assetId);
  });

  it('flags a possible duplicate on matching filename + total file size (different content)', () => {
    const existing = createPortfolioAsset({
      displayName: 'A',
      originalFilename: 'spring-garden-001.svg',
      sourceFileReferences: [ref('svg', 'hash-a', 250)],
      previewReference: null,
      metadataReference: null,
    });
    const candidate: DuplicateCandidateSignals = {
      fileHashes: ['hash-b'],
      originalFilename: 'spring-garden-001.svg',
      totalFileSize: 250,
    };
    const result = detectDuplicate(candidate, [existing]);
    expect(result.kind).toBe('possible');
    if (result.kind === 'possible') expect(result.matchedOn).toContain('filename+fileSize');
  });

  it('flags a possible duplicate on matching generator seed alone', () => {
    const existing = createPortfolioAsset({
      displayName: 'A',
      originalFilename: 'a.svg',
      sourceFileReferences: [ref('svg', 'hash-a')],
      previewReference: null,
      metadataReference: null,
      generatorSeed: 'seed-xyz',
    });
    const candidate: DuplicateCandidateSignals = {
      fileHashes: ['hash-different'],
      originalFilename: 'different-name.svg',
      totalFileSize: 999,
      generatorSeed: 'seed-xyz',
    };
    const result = detectDuplicate(candidate, [existing]);
    expect(result.kind).toBe('possible');
    if (result.kind === 'possible') expect(result.matchedOn).toContain('generatorSeed');
  });

  it('prefers exact over possible when both signals are present', () => {
    const existing = createPortfolioAsset({
      displayName: 'A',
      originalFilename: 'a.svg',
      sourceFileReferences: [ref('svg', 'hash-a')],
      previewReference: null,
      metadataReference: null,
    });
    const candidate: DuplicateCandidateSignals = { fileHashes: ['hash-a'], originalFilename: 'a.svg', totalFileSize: 100 };
    expect(detectDuplicate(candidate, [existing]).kind).toBe('exact');
  });
});
