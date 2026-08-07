import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DownloadCenter } from './DownloadCenter';
import type { BulkExportResult } from '../../commercial/exportWorkflow';

const { downloadBlobFile } = vi.hoisted(() => ({ downloadBlobFile: vi.fn() }));
vi.mock('../../export/svgExporter', () => ({ downloadBlobFile }));

const workspaceApiMocks = vi.hoisted(() => ({
  isDesktopRuntime: vi.fn(() => false),
  getConfiguredWorkspacePath: vi.fn(async () => '/home/user/AI-SBOS'),
  openWorkspacePath: vi.fn(async () => {}),
}));
vi.mock('../../workspace/workspaceApi', () => workspaceApiMocks);

function makePackage(overrides: Partial<BulkExportResult> = {}): BulkExportResult {
  return {
    marketplaceId: 'shutterstock',
    marketplaceLabel: 'Shutterstock',
    blob: new Blob(['x'.repeat(2048)]),
    filename: 'shutterstock-export.zip',
    fileCount: 3,
    createdAt: Date.now(),
    builtAssetIds: ['asset-1'],
    skipped: [],
    ...overrides,
  };
}

describe('DownloadCenter', () => {
  beforeEach(() => {
    downloadBlobFile.mockClear();
    workspaceApiMocks.isDesktopRuntime.mockReturnValue(false);
    workspaceApiMocks.getConfiguredWorkspacePath.mockClear();
    workspaceApiMocks.openWorkspacePath.mockClear();
  });

  it('shows an honest empty state with no packages', () => {
    render(<DownloadCenter packages={[]} onClose={() => {}} />);
    expect(screen.getByText('ยังไม่มีแพ็กเกจที่พร้อมดาวน์โหลดในเซสชันนี้')).toBeInTheDocument();
  });

  it('lists a package with marketplace, size, file count, and skip badge when present', () => {
    render(<DownloadCenter packages={[makePackage({ skipped: [{ assetId: 'a', displayName: 'Asset A', reason: 'no files' }] })]} onClose={() => {}} />);
    expect(screen.getByText('Shutterstock')).toBeInTheDocument();
    expect(screen.getByText('3 ไฟล์')).toBeInTheDocument();
    expect(screen.getByText('ข้าม 1 ชิ้นงาน')).toBeInTheDocument();
  });

  it('downloads the ZIP via the browser download helper, not a fabricated file write', () => {
    const pkg = makePackage();
    render(<DownloadCenter packages={[pkg]} onClose={() => {}} />);
    fireEvent.click(screen.getByText('ดาวน์โหลด ZIP'));
    expect(downloadBlobFile).toHaveBeenCalledWith(pkg.filename, pkg.blob);
  });

  it('does not show "Open Folder" in the browser (non-desktop) runtime', () => {
    render(<DownloadCenter packages={[makePackage()]} onClose={() => {}} />);
    expect(screen.queryByText('เปิดโฟลเดอร์')).not.toBeInTheDocument();
  });

  it('resolves the real workspace path before opening a folder, in the desktop runtime', async () => {
    workspaceApiMocks.isDesktopRuntime.mockReturnValue(true);
    render(<DownloadCenter packages={[makePackage()]} onClose={() => {}} />);
    fireEvent.click(screen.getByText('เปิดโฟลเดอร์'));
    await waitFor(() => expect(workspaceApiMocks.openWorkspacePath).toHaveBeenCalled());
    expect(workspaceApiMocks.openWorkspacePath).toHaveBeenCalledWith('/home/user/AI-SBOS/Marketplace/Shutterstock');
  });
});
