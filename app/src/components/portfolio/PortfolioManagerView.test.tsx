/// <reference types="node" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PortfolioManagerView } from './PortfolioManagerView';
import { clearPortfolioStores, importAssetTransaction, portfolioStorageAvailable } from '../../catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import { generateFileId } from '../../catalog/domain/id';
import type { SourceFileReference } from '../../catalog/domain/types';
import { Blob as NodeBlob } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

describe('PortfolioManagerView', () => {
  it('loads and displays real stored assets from IndexedDB on mount', async () => {
    const ref: SourceFileReference = { fileId: generateFileId(), role: 'svg', filename: 'stored.svg', mimeType: 'image/svg+xml', fileSize: 3, sha256: 'h1' };
    const asset = createPortfolioAsset({ displayName: 'Stored Asset', originalFilename: 'stored.svg', sourceFileReferences: [ref], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, [
      { fileId: ref.fileId, assetId: asset.assetId, role: 'svg', filename: 'stored.svg', mimeType: 'image/svg+xml', fileSize: 3, sha256: 'h1', blob: new NodeBlob(['x']) as unknown as Blob, storedAt: Date.now() },
    ]);

    render(<PortfolioManagerView onClose={() => {}} />);
    expect(screen.getByText('กำลังโหลดคลัง…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Stored Asset')).toBeInTheDocument());
  });

  it('selecting an asset in the grid opens the Preview Dialog (Hotfix v1.0.1 Part 1); "แก้ไขรายละเอียด" opens the full detail panel', async () => {
    const asset = createPortfolioAsset({ displayName: 'Clickable Asset', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);

    render(<PortfolioManagerView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Clickable Asset')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Clickable Asset'));
    await waitFor(() => expect(screen.getByText('✏️ แก้ไขรายละเอียด')).toBeInTheDocument());
    // Preview Dialog does not itself contain the full editor's ZIP export button.
    expect(screen.queryByText('ส่งออกเป็น ZIP')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('✏️ แก้ไขรายละเอียด'));
    await waitFor(() => expect(screen.getByText('ส่งออกเป็น ZIP')).toBeInTheDocument());

    fireEvent.click(screen.getByText('ปิด'));
    await waitFor(() => expect(screen.queryByText('ส่งออกเป็น ZIP')).not.toBeInTheDocument());
  });

  it('archiving an asset from the detail panel (reached via the Preview Dialog) persists and updates the dashboard summary live', async () => {
    const asset = createPortfolioAsset({ displayName: 'Archive Me', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);

    render(<PortfolioManagerView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Archive Me')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Archive Me'));
    await waitFor(() => expect(screen.getByText('✏️ แก้ไขรายละเอียด')).toBeInTheDocument());
    fireEvent.click(screen.getByText('✏️ แก้ไขรายละเอียด'));
    await waitFor(() => expect(screen.getByText('เก็บเข้าที่เก็บถาวร')).toBeInTheDocument());

    fireEvent.click(screen.getByText('เก็บเข้าที่เก็บถาวร'));

    // Default filter is "active only" — an archived asset drops out of the
    // grid immediately once the update round-trips through IndexedDB. The
    // detail panel (an <h2>) may still show it, so scope to the grid card.
    await waitFor(() => expect(screen.getByText('พบ 0 รายการ')).toBeInTheDocument());
  });

  it('deleting an asset (record only, reached via the Preview Dialog) removes it from the grid and clears the selection', async () => {
    const asset = createPortfolioAsset({ displayName: 'Delete Me', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);

    render(<PortfolioManagerView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Delete Me')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete Me'));
    await waitFor(() => expect(screen.getByText('✏️ แก้ไขรายละเอียด')).toBeInTheDocument());
    fireEvent.click(screen.getByText('✏️ แก้ไขรายละเอียด'));
    await waitFor(() => expect(screen.getByText('ลบออกจากคลัง')).toBeInTheDocument());

    fireEvent.click(screen.getByText('ลบออกจากคลัง'));
    fireEvent.click(screen.getByText('ยืนยันลบ'));

    await waitFor(() => expect(screen.queryByText('Delete Me')).not.toBeInTheDocument());
  });

  it('the close button calls onClose', async () => {
    const onClose = vi.fn();
    render(<PortfolioManagerView onClose={onClose} />);
    await waitFor(() => expect(screen.queryByText('กำลังโหลดคลัง…')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('← กลับหน้าสร้างลาย'));
    expect(onClose).toHaveBeenCalled();
  });

  it('opening the health-check panel shows a report computed from real stored data', async () => {
    const asset = createPortfolioAsset({ displayName: 'Health Asset', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);

    render(<PortfolioManagerView onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Health Asset')).toBeInTheDocument());
    fireEvent.click(screen.getByText('ตรวจสุขภาพคลัง'));
    await waitFor(() => expect(screen.getByText('จำนวนรายการทั้งหมด')).toBeInTheDocument());
    // recordCount reflects the one real stored asset — never a hard-coded sample.
    const dd = screen.getByText('จำนวนรายการทั้งหมด').nextElementSibling;
    expect(dd?.textContent).toContain('1');
  });
});

describe('PortfolioManagerView (storage unavailable)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a clear fallback message instead of crashing when IndexedDB is unavailable', async () => {
    const storeModule = await import('../../catalog/storage/portfolioStore');
    const spy = vi.spyOn(storeModule, 'portfolioStorageAvailable').mockReturnValue(false);
    expect(portfolioStorageAvailable).toBeDefined();

    render(<PortfolioManagerView onClose={() => {}} />);
    expect(screen.getByText(/ไม่รองรับ IndexedDB/)).toBeInTheDocument();
    spy.mockRestore();
  });
});
