import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioHealthCheckPanel } from './PortfolioHealthCheckPanel';
import type { HealthCheckReport } from '../../catalog/services/healthCheck';

function makeReport(overrides: Partial<HealthCheckReport> = {}): HealthCheckReport {
  return {
    generatedAt: Date.now(),
    recordCount: 5,
    missingSourceReferences: [],
    missingPreviews: [],
    duplicateHashGroups: [],
    orphanedFileIds: [],
    invalidMetadataAssetIds: [],
    migrationStatus: { upToDate: 5, needsMigration: 0, currentSchemaVersion: 1 },
    ...overrides,
  };
}

describe('PortfolioHealthCheckPanel', () => {
  it('shows nothing report-related before a report has loaded', () => {
    render(<PortfolioHealthCheckPanel report={null} loading={false} onRefresh={() => {}} onClose={() => {}} />);
    expect(screen.queryByText('จำนวนรายการทั้งหมด')).not.toBeInTheDocument();
  });

  it('renders the report fields from real data, never hard-coded', () => {
    const report = makeReport({ recordCount: 42 });
    render(<PortfolioHealthCheckPanel report={report} loading={false} onRefresh={() => {}} onClose={() => {}} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('lists every missing-source-reference entry and every duplicate-hash group (does not silently repair, only reports)', () => {
    const report = makeReport({
      missingSourceReferences: [{ assetId: 'VSP-1', fileId: 'file-a', role: 'svg' }],
      duplicateHashGroups: [{ sha256: 'abcdef1234567890', assetIds: ['VSP-1', 'VSP-2'] }],
    });
    render(<PortfolioHealthCheckPanel report={report} loading={false} onRefresh={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/VSP-1 — svg/)).toBeInTheDocument();
    expect(screen.getByText(/VSP-1, VSP-2/)).toBeInTheDocument();
  });

  it('disables the refresh button while loading and shows a progress label', () => {
    render(<PortfolioHealthCheckPanel report={null} loading={true} onRefresh={() => {}} onClose={() => {}} />);
    const button = screen.getByText('กำลังตรวจสอบ…') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('clicking refresh and close call their handlers', () => {
    const onRefresh = vi.fn();
    const onClose = vi.fn();
    render(<PortfolioHealthCheckPanel report={makeReport()} loading={false} onRefresh={onRefresh} onClose={onClose} />);
    fireEvent.click(screen.getByText('ตรวจสอบใหม่'));
    fireEvent.click(screen.getByText('ปิด'));
    expect(onRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
