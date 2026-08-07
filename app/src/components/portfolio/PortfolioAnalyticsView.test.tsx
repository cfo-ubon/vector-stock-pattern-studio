import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioAnalyticsView } from './PortfolioAnalyticsView';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { DashboardSummary } from '../../catalog/services/dashboard';

function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalAssets: 10,
    activeAssets: 9,
    archivedAssets: 1,
    readyForReview: 2,
    readyToUpload: 3,
    submitted: 1,
    approved: 2,
    rejected: 0,
    missingPreview: 0,
    duplicateWarnings: 1,
    recentlyImported: [],
    ...overrides,
  };
}

describe('PortfolioAnalyticsView', () => {
  it('shows a real loading state when summary is not yet available', () => {
    render(<PortfolioAnalyticsView summary={null} onOpenAsset={() => {}} />);
    expect(screen.getByText('กำลังโหลดข้อมูล…')).toBeInTheDocument();
  });

  it('renders every real DashboardSummary field, not fabricated numbers', () => {
    const summary = makeSummary({ totalAssets: 42, activeAssets: 40, duplicateWarnings: 7 });
    render(<PortfolioAnalyticsView summary={summary} onOpenAsset={() => {}} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows an honest empty state when nothing was recently imported', () => {
    render(<PortfolioAnalyticsView summary={makeSummary()} onOpenAsset={() => {}} />);
    expect(screen.getByText('ยังไม่มีชิ้นงาน')).toBeInTheDocument();
  });

  it('lists real recently-imported assets and calls onOpenAsset with the real assetId', () => {
    const asset = createPortfolioAsset({ displayName: 'Recent Pattern', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    const onOpenAsset = vi.fn();
    render(<PortfolioAnalyticsView summary={makeSummary({ recentlyImported: [asset] })} onOpenAsset={onOpenAsset} />);
    fireEvent.click(screen.getByText('Recent Pattern'));
    expect(onOpenAsset).toHaveBeenCalledWith(asset.assetId);
  });
});
