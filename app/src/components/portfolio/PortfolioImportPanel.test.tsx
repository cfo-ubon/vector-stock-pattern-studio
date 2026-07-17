/// <reference types="node" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PortfolioImportPanel } from './PortfolioImportPanel';
import { clearPortfolioStores, importAssetTransaction } from '../../catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { SourceFileReference } from '../../catalog/domain/types';
import { generateFileId } from '../../catalog/domain/id';
import { File as NodeFile } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

function nodeFile(name: string, content: string, type: string): File {
  return new NodeFile([content], name, { type }) as unknown as File;
}

describe('PortfolioImportPanel', () => {
  it('shows an empty/no-files-selected hint before anything is imported', () => {
    render(<PortfolioImportPanel existingAssets={[]} onImported={() => {}} onClose={() => {}} />);
    expect(screen.getByText('ยังไม่ได้เลือกไฟล์')).toBeInTheDocument();
  });

  it('importing a new file via the file input shows an "imported" outcome and calls onImported', async () => {
    const onImported = vi.fn();
    render(<PortfolioImportPanel existingAssets={[]} onImported={onImported} onClose={() => {}} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = nodeFile('new-design.svg', '<svg>unique-content</svg>', 'image/svg+xml');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('นำเข้าแล้ว')).toBeInTheDocument());
    expect(onImported).toHaveBeenCalled();
  });

  it('importing a file that exactly duplicates an existing asset shows a blocked-duplicate outcome and does not call onImported', async () => {
    const sharedContent = 'exact-duplicate-bytes';
    const ref: SourceFileReference = { fileId: generateFileId(), role: 'svg', filename: 'existing.svg', mimeType: 'image/svg+xml', fileSize: sharedContent.length, sha256: 'will-be-recomputed' };
    // Compute the real hash so the duplicate check actually matches.
    const { sha256Hex } = await import('../../catalog/domain/hash');
    ref.sha256 = await sha256Hex(new TextEncoder().encode(sharedContent).buffer as ArrayBuffer);
    const existingAsset = createPortfolioAsset({ displayName: 'Existing', originalFilename: 'existing.svg', sourceFileReferences: [ref], previewReference: ref.fileId, metadataReference: null });
    await importAssetTransaction(existingAsset, [
      { fileId: ref.fileId, assetId: existingAsset.assetId, role: 'svg', filename: 'existing.svg', mimeType: 'image/svg+xml', fileSize: ref.fileSize, sha256: ref.sha256, blob: new Blob([sharedContent]), storedAt: Date.now() },
    ]);

    const onImported = vi.fn();
    render(<PortfolioImportPanel existingAssets={[existingAsset]} onImported={onImported} onClose={() => {}} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = nodeFile('a-copy.svg', sharedContent, 'image/svg+xml');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('ซ้ำกับที่มีอยู่ (ถูกบล็อก)')).toBeInTheDocument());
    expect(onImported).not.toHaveBeenCalled();
  });

  it('a possible-duplicate outcome offers explicit "import as new" / "skip" actions', async () => {
    const existingAsset = createPortfolioAsset({
      displayName: 'Existing',
      originalFilename: 'same-name.svg',
      sourceFileReferences: [{ fileId: generateFileId(), role: 'svg', filename: 'same-name.svg', mimeType: 'image/svg+xml', fileSize: 11, sha256: 'hash-a' }],
      previewReference: null,
      metadataReference: null,
    });

    render(<PortfolioImportPanel existingAssets={[existingAsset]} onImported={() => {}} onClose={() => {}} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Same filename + same byte length (11) as the existing asset, different content.
    const file = nodeFile('same-name.svg', 'contentxyzw', 'image/svg+xml');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('อาจซ้ำ (รอตัดสินใจ)')).toBeInTheDocument());
    expect(screen.getByText('นำเข้าเป็นชิ้นใหม่')).toBeInTheDocument();
    expect(screen.getByText('ข้าม')).toBeInTheDocument();
  });

  it('the close button calls onClose', () => {
    const onClose = vi.fn();
    render(<PortfolioImportPanel existingAssets={[]} onImported={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByText('ปิด'));
    expect(onClose).toHaveBeenCalled();
  });
});
