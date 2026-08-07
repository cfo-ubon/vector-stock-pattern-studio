import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductionPreviewGallery } from './ProductionPreviewGallery';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import type { CommercialReadinessReport } from '../../commercial/domain/types';
import type { QualitySnapshot } from '../../catalog/quality/qualitySnapshotStore';

function makeAsset(displayName = 'Floral Pattern') {
  return createPortfolioAsset({ displayName, originalFilename: 'floral.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
}

function makeReadiness(overrides: Partial<CommercialReadinessReport> = {}): CommercialReadinessReport {
  return {
    assetId: 'a1',
    computedAt: Date.now(),
    checks: [{ id: 'seoExists', label: 'SEO exists', status: 'PASS', detail: 'ok' }],
    score: 96,
    band: 'READY',
    failingChecks: [],
    warningChecks: [],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<QualitySnapshot> = {}): QualitySnapshot {
  return {
    snapshotId: 'qs1',
    assetId: 'a1',
    productionAssetId: null,
    beautyScore: 82,
    commercialScore: 78,
    thumbnailScore: null,
    fragmented: false,
    deadSpace: false,
    decision: 'READY',
    generatorVersion: 'v1',
    createdAt: Date.now(),
    schemaVersion: 1,
    ...overrides,
  };
}

describe('ProductionPreviewGallery', () => {
  it('shows an honest empty state when there are no assets', () => {
    render(
      <ProductionPreviewGallery
        assets={[]}
        readinessByAsset={new Map()}
        latestSnapshotByAsset={new Map()}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onPreview={() => {}}
        onEdit={() => {}}
        onExport={() => {}}
        onBulkExport={() => {}}
        busy={false}
      />,
    );
    expect(screen.getByText(/ยังไม่มีชิ้นงาน/)).toBeInTheDocument();
  });

  it('renders real Commercial Score, Quality Score, Marketplace Ready, and SEO Ready from the readiness/snapshot data passed in', () => {
    const asset = makeAsset();
    const readiness = makeReadiness({ assetId: asset.assetId, score: 97, band: 'READY' });
    const snapshot = makeSnapshot({ assetId: asset.assetId, beautyScore: 88 });

    render(
      <ProductionPreviewGallery
        assets={[asset]}
        readinessByAsset={new Map([[asset.assetId, readiness]])}
        latestSnapshotByAsset={new Map([[asset.assetId, snapshot]])}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onPreview={() => {}}
        onEdit={() => {}}
        onExport={() => {}}
        onBulkExport={() => {}}
        busy={false}
      />,
    );

    expect(screen.getByText('97%')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('✅ Marketplace Ready')).toBeInTheDocument();
    expect(screen.getByText('✅ SEO Ready')).toBeInTheDocument();
  });

  it('shows an honest "not ready" state when there is no readiness data at all', () => {
    const asset = makeAsset();
    render(
      <ProductionPreviewGallery
        assets={[asset]}
        readinessByAsset={new Map()}
        latestSnapshotByAsset={new Map()}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onPreview={() => {}}
        onEdit={() => {}}
        onExport={() => {}}
        onBulkExport={() => {}}
        busy={false}
      />,
    );
    expect(screen.getByText('⚠ Not Ready')).toBeInTheDocument();
    expect(screen.getByText('⚠ SEO Missing')).toBeInTheDocument();
  });

  it('calls onPreview/onEdit/onExport with the real asset id from their buttons', () => {
    const asset = makeAsset();
    const onPreview = vi.fn();
    const onEdit = vi.fn();
    const onExport = vi.fn();
    render(
      <ProductionPreviewGallery
        assets={[asset]}
        readinessByAsset={new Map()}
        latestSnapshotByAsset={new Map()}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onPreview={onPreview}
        onEdit={onEdit}
        onExport={onExport}
        onBulkExport={() => {}}
        busy={false}
      />,
    );
    fireEvent.click(screen.getByText('👁 Preview'));
    fireEvent.click(screen.getByText('🎨 Edit'));
    fireEvent.click(screen.getByText('📤 Export'));
    expect(onPreview).toHaveBeenCalledWith(asset.assetId);
    expect(onEdit).toHaveBeenCalledWith(asset.assetId);
    expect(onExport).toHaveBeenCalledWith(asset.assetId);
  });

  it('shows the bulk export button only when at least one card is selected, and calls onBulkExport', () => {
    const asset = makeAsset();
    const onBulkExport = vi.fn();
    const { rerender } = render(
      <ProductionPreviewGallery
        assets={[asset]}
        readinessByAsset={new Map()}
        latestSnapshotByAsset={new Map()}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onPreview={() => {}}
        onEdit={() => {}}
        onExport={() => {}}
        onBulkExport={onBulkExport}
        busy={false}
      />,
    );
    expect(screen.queryByText(/Export ที่เลือก/)).not.toBeInTheDocument();

    rerender(
      <ProductionPreviewGallery
        assets={[asset]}
        readinessByAsset={new Map()}
        latestSnapshotByAsset={new Map()}
        selectedIds={new Set([asset.assetId])}
        onToggleSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onPreview={() => {}}
        onEdit={() => {}}
        onExport={() => {}}
        onBulkExport={onBulkExport}
        busy={false}
      />,
    );
    fireEvent.click(screen.getByText(/Export ที่เลือก \(1\)/));
    expect(onBulkExport).toHaveBeenCalled();
  });
});
