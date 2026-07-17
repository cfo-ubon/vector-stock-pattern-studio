import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollectionIntegrityPanel } from './CollectionIntegrityPanel';
import type { CollectionIntegrityReport } from '../../catalog/services/collectionService';

function cleanReport(): CollectionIntegrityReport {
  return { generatedAt: Date.now(), totalCollections: 2, totalAssets: 10, orphanedMemberships: [], invalidCoverAssetReferences: [] };
}

describe('CollectionIntegrityPanel', () => {
  it('prompts to scan before any report exists (read-only until an explicit scan)', () => {
    render(<CollectionIntegrityPanel report={null} loading={false} onScan={vi.fn()} onRepairOrphans={vi.fn()} onRepairCovers={vi.fn()} />);
    expect(screen.getByText(/กด "ตรวจสอบใหม่"/)).toBeInTheDocument();
  });

  it('the scan button calls onScan and shows a loading label while scanning', () => {
    const onScan = vi.fn();
    render(<CollectionIntegrityPanel report={null} loading={true} onScan={onScan} onRepairOrphans={vi.fn()} onRepairCovers={vi.fn()} />);
    expect(screen.getByText('กำลังตรวจสอบ…')).toBeInTheDocument();
  });

  it('shows "no issues" and no repair buttons for a clean report', () => {
    render(<CollectionIntegrityPanel report={cleanReport()} loading={false} onScan={vi.fn()} onRepairOrphans={vi.fn()} onRepairCovers={vi.fn()} />);
    expect(screen.getByText('ไม่พบปัญหาความถูกต้องของข้อมูล')).toBeInTheDocument();
    expect(screen.queryByText(/ซ่อมแซมการอ้างอิงที่ไม่ถูกต้อง/)).not.toBeInTheDocument();
  });

  it('shows a repair button for orphaned memberships and calls onRepairOrphans, never automatically', async () => {
    const report: CollectionIntegrityReport = {
      ...cleanReport(),
      orphanedMemberships: [{ assetId: 'A1', invalidCollectionIds: ['COL-gone'] }],
    };
    const onRepairOrphans = vi.fn().mockResolvedValue({ requestedCount: 1, changedCount: 1, skippedCount: 0, failedCount: 0, failures: [] });
    render(<CollectionIntegrityPanel report={report} loading={false} onScan={vi.fn()} onRepairOrphans={onRepairOrphans} onRepairCovers={vi.fn()} />);

    expect(onRepairOrphans).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('ซ่อมแซมการอ้างอิงที่ไม่ถูกต้อง'));
    await waitFor(() => expect(onRepairOrphans).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('สำเร็จ 1 รายการ'));
  });

  it('shows a repair button for stale cover references and calls onRepairCovers', async () => {
    const report: CollectionIntegrityReport = {
      ...cleanReport(),
      invalidCoverAssetReferences: [{ collectionId: 'COL-1', coverAssetId: 'A-deleted' }],
    };
    const onRepairCovers = vi.fn().mockResolvedValue({ requestedCount: 1, changedCount: 1, skippedCount: 0, failedCount: 0, failures: [] });
    render(<CollectionIntegrityPanel report={report} loading={false} onScan={vi.fn()} onRepairOrphans={vi.fn()} onRepairCovers={onRepairCovers} />);
    fireEvent.click(screen.getByText('ล้างปกที่อ้างอิงไม่ถูกต้อง'));
    await waitFor(() => expect(onRepairCovers).toHaveBeenCalled());
  });
});
