/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCollectionCoverUrl } from './useCollectionCoverUrl';
import { clearPortfolioStores, importAssetTransaction } from '../../catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import { generateFileId } from '../../catalog/domain/id';
import type { SourceFileReference } from '../../catalog/domain/types';
import { Blob as NodeBlob } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

describe('useCollectionCoverUrl', () => {
  it('resolves to null/not-broken when coverAssetId is null', () => {
    const { result } = renderHook(() => useCollectionCoverUrl(null));
    expect(result.current.url).toBeNull();
    expect(result.current.broken).toBe(false);
  });

  it('resolves a real Blob URL for a valid cover asset with a preview file', async () => {
    const ref: SourceFileReference = { fileId: generateFileId(), role: 'preview', filename: 'cover.png', mimeType: 'image/png', fileSize: 3, sha256: 'h1' };
    const asset = createPortfolioAsset({
      displayName: 'Cover Asset',
      originalFilename: 'cover.png',
      sourceFileReferences: [ref],
      previewReference: ref.fileId,
      metadataReference: null,
    });
    await importAssetTransaction(asset, [
      { fileId: ref.fileId, assetId: asset.assetId, role: 'preview', filename: 'cover.png', mimeType: 'image/png', fileSize: 3, sha256: 'h1', blob: new NodeBlob(['x']) as unknown as Blob, storedAt: Date.now() },
    ]);

    const { result } = renderHook(() => useCollectionCoverUrl(asset.assetId));
    await waitFor(() => expect(result.current.url).not.toBeNull());
    expect(result.current.broken).toBe(false);
    expect(result.current.url).toMatch(/^blob:/);
  });

  it('resolves broken:true (no console error, no throw) when the cover asset no longer exists — Rule 13 staleness', async () => {
    const { result } = renderHook(() => useCollectionCoverUrl('COL-does-not-exist'));
    await waitFor(() => expect(result.current.broken).toBe(true));
    expect(result.current.url).toBeNull();
  });

  it('resolves broken:true when the cover asset exists but has no preview file', async () => {
    const asset = createPortfolioAsset({ displayName: 'No Preview', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    const { result } = renderHook(() => useCollectionCoverUrl(asset.assetId));
    await waitFor(() => expect(result.current.broken).toBe(true));
  });
});
