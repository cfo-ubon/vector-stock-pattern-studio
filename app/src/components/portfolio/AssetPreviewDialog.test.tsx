import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetPreviewDialog } from './AssetPreviewDialog';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { CommercialReadinessReport } from '../../commercial/domain/types';
import type { AssetExportStatus } from '../../commercial/exportWorkflow';

function makeAsset() {
  return createPortfolioAsset({ displayName: 'Floral Pattern', originalFilename: 'floral.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
}

function makeReadiness(overrides: Partial<CommercialReadinessReport> = {}): CommercialReadinessReport {
  return {
    assetId: 'asset-1',
    computedAt: Date.now(),
    checks: [{ id: 'svgExists', label: 'SVG File', status: 'PASS', detail: 'พบไฟล์ SVG' }],
    score: 82,
    band: 'READY',
    failingChecks: [],
    warningChecks: [],
    ...overrides,
  };
}

const NEVER_EXPORTED: AssetExportStatus = { id: 'never-exported', label: 'ยังไม่เคย Export', at: null };

describe('AssetPreviewDialog', () => {
  it('shows the asset name, ID, and Export Status badge', () => {
    const asset = makeAsset();
    render(
      <AssetPreviewDialog
        asset={asset}
        readiness={null}
        seoScore={null}
        collections={[]}
        exportStatus={NEVER_EXPORTED}
        onClose={() => {}}
        onOpenEditDetails={() => {}}
        onOpenEditDesign={() => {}}
        onExport={() => {}}
        onOpenSubmissionHistory={() => {}}
      />,
    );
    expect(screen.getByText('Floral Pattern')).toBeInTheDocument();
    expect(screen.getByText(asset.assetId)).toBeInTheDocument();
    expect(screen.getByText('ยังไม่เคย Export')).toBeInTheDocument();
  });

  it('shows an honest "no data" state for Commercial Score and SEO Score when neither is computed', () => {
    render(
      <AssetPreviewDialog
        asset={makeAsset()}
        readiness={null}
        seoScore={null}
        collections={[]}
        exportStatus={NEVER_EXPORTED}
        onClose={() => {}}
        onOpenEditDetails={() => {}}
        onOpenEditDesign={() => {}}
        onExport={() => {}}
        onOpenSubmissionHistory={() => {}}
      />,
    );
    expect(screen.getAllByText('ยังไม่มีข้อมูล').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ยังไม่มีข้อมูล SEO/)).toBeInTheDocument();
  });

  it('renders the real Commercial Readiness score/band and per-check list when provided', () => {
    render(
      <AssetPreviewDialog
        asset={makeAsset()}
        readiness={makeReadiness()}
        seoScore={null}
        collections={[]}
        exportStatus={NEVER_EXPORTED}
        onClose={() => {}}
        onOpenEditDetails={() => {}}
        onOpenEditDesign={() => {}}
        onExport={() => {}}
        onOpenSubmissionHistory={() => {}}
      />,
    );
    expect(screen.getByText('82% — READY')).toBeInTheDocument();
    expect(screen.getByText(/SVG File/)).toBeInTheDocument();
  });

  it('calls onExport, onOpenEditDetails, and onOpenSubmissionHistory from their respective buttons', () => {
    const onExport = vi.fn();
    const onOpenEditDetails = vi.fn();
    const onOpenSubmissionHistory = vi.fn();
    render(
      <AssetPreviewDialog
        asset={makeAsset()}
        readiness={null}
        seoScore={null}
        collections={[]}
        exportStatus={NEVER_EXPORTED}
        onClose={() => {}}
        onOpenEditDetails={onOpenEditDetails}
        onOpenEditDesign={() => {}}
        onExport={onExport}
        onOpenSubmissionHistory={onOpenSubmissionHistory}
      />,
    );
    fireEvent.click(screen.getByText('📤 Export'));
    fireEvent.click(screen.getByText('✏️ แก้ไขรายละเอียด'));
    fireEvent.click(screen.getByText('🕓 ประวัติการส่งขาย'));
    expect(onExport).toHaveBeenCalled();
    expect(onOpenEditDetails).toHaveBeenCalled();
    expect(onOpenSubmissionHistory).toHaveBeenCalled();
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(
      <AssetPreviewDialog
        asset={makeAsset()}
        readiness={null}
        seoScore={null}
        collections={[]}
        exportStatus={NEVER_EXPORTED}
        onClose={onClose}
        onOpenEditDetails={() => {}}
        onOpenEditDesign={() => {}}
        onExport={() => {}}
        onOpenSubmissionHistory={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('ปิด'));
    expect(onClose).toHaveBeenCalled();
  });
});
