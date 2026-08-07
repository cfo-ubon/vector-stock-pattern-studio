import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewWorkspacePanel } from './ReviewWorkspacePanel';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import { createQualitySnapshot } from '../../catalog/quality/qualitySnapshotStore';
import type { ReviewWorkspaceItem } from '../../productionExperience/reviewWorkspace';

function makeItem(displayName: string): ReviewWorkspaceItem {
  const asset = createPortfolioAsset({ displayName, originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
  const snapshot = createQualitySnapshot({ assetId: asset.assetId, beautyScore: 55, commercialScore: 62, fragmented: true, deadSpace: false, decision: 'REVIEW', generatorVersion: 'v1' });
  return { asset, snapshot };
}

describe('ReviewWorkspacePanel', () => {
  it('shows an honest empty state when there is nothing to review', () => {
    render(<ReviewWorkspacePanel items={[]} onApprove={() => {}} onReject={() => {}} onRepair={() => {}} />);
    expect(screen.getByText('Nothing waiting for review right now.')).toBeInTheDocument();
  });

  it('shows every real item with its real scores and fragmentation flag', () => {
    const item = makeItem('Pattern A');
    render(<ReviewWorkspacePanel items={[item]} onApprove={() => {}} onReject={() => {}} onRepair={() => {}} />);
    expect(screen.getByText('Pattern A')).toBeInTheDocument();
    expect(screen.getByText(/Beauty 55 · Commercial 62 · fragmented/)).toBeInTheDocument();
  });

  it('per-row Approve/Reject/Repair call back with exactly that one real assetId', () => {
    const item = makeItem('Pattern A');
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onRepair = vi.fn();
    render(<ReviewWorkspacePanel items={[item]} onApprove={onApprove} onReject={onReject} onRepair={onRepair} />);
    const [approveRow, rejectRow, repairRow] = screen.getAllByRole('button').filter((b) => ['Approve', 'Reject', 'Repair'].includes(b.textContent ?? ''));
    fireEvent.click(approveRow);
    fireEvent.click(rejectRow);
    fireEvent.click(repairRow);
    expect(onApprove).toHaveBeenCalledWith([item.asset.assetId]);
    expect(onReject).toHaveBeenCalledWith([item.asset.assetId]);
    expect(onRepair).toHaveBeenCalledWith([item.asset.assetId]);
  });

  it('bulk actions are disabled until at least one real item is selected, then act on the real selection', () => {
    const item = makeItem('Pattern A');
    const onApprove = vi.fn();
    render(<ReviewWorkspacePanel items={[item]} onApprove={onApprove} onReject={() => {}} onRepair={() => {}} />);
    const bulkApprove = screen.getByText(/Approve selected/);
    expect(bulkApprove).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(bulkApprove).not.toBeDisabled();
    fireEvent.click(bulkApprove);
    expect(onApprove).toHaveBeenCalledWith([item.asset.assetId]);
  });
});
