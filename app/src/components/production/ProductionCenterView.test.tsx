import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductionCenterView } from './ProductionCenterView';
import { createPortfolioAsset } from '../../catalog/domain/asset';
import { clearPortfolioStores } from '../../catalog/storage/portfolioStore';
import { resetSubmissionStoreForTest } from '../../catalog/submission/submissionStore';
import { clearSalesEvents } from '../../catalog/submission/salesRevenueStore';
import { clearRejectionRecords } from '../../catalog/submission/rejectionStore';
import { clearImportHistory } from '../../catalog/import/importHistoryStore';
import type { PortfolioAsset } from '../../catalog/domain/types';

beforeEach(async () => {
  await clearPortfolioStores();
  await resetSubmissionStoreForTest();
  await clearSalesEvents();
  await clearRejectionRecords();
  await clearImportHistory();
});

function makeAsset(overrides: Partial<Parameters<typeof createPortfolioAsset>[0]> = {}): PortfolioAsset {
  return createPortfolioAsset({
    displayName: 'Test Asset',
    originalFilename: 'test.svg',
    sourceFileReferences: [],
    previewReference: null,
    metadataReference: null,
    presetId: 'luxuryFloral',
    ...overrides,
  });
}

describe('ProductionCenterView', () => {
  it('renders the tab nav and defaults to the submission tracker tab', () => {
    render(<ProductionCenterView assets={[]} onClose={() => {}} />);
    expect(screen.getByText('ติดตามการส่ง')).toBeInTheDocument();
    expect(screen.getByText('สร้างการส่งใหม่')).toBeInTheDocument();
  });

  it('lists provided assets in the submission-creation dropdown', () => {
    const asset = makeAsset({ displayName: 'My Floral Pattern' });
    render(<ProductionCenterView assets={[asset]} onClose={() => {}} />);
    expect(screen.getByText('My Floral Pattern')).toBeInTheDocument();
  });

  it('switches to the commercial feedback tab and can trigger analysis', () => {
    render(<ProductionCenterView assets={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByText('ผลตอบรับเชิงพาณิชย์'));
    expect(screen.getByText('เครื่องมือผลตอบรับเชิงพาณิชย์')).toBeInTheDocument();
  });

  it('switches to the recommendations tab', () => {
    render(<ProductionCenterView assets={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByText('คำแนะนำการผลิต'));
    expect(screen.getByText('ควรผลิตอะไรต่อไป')).toBeInTheDocument();
  });

  it('switches to the historical import tab', () => {
    render(<ProductionCenterView assets={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByText('นำเข้าผลงานเก่า'));
    expect(screen.getByText('นำเข้าผลงานเก่า', { selector: 'h2' })).toBeInTheDocument();
  });

  it('switches to the backup tab', () => {
    render(<ProductionCenterView assets={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByText('สำรอง/กู้คืน'));
    expect(screen.getByText('สำรองข้อมูลศูนย์การผลิต')).toBeInTheDocument();
  });

  it('switches to the marketplace results import tab', () => {
    render(<ProductionCenterView assets={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByText('นำเข้าผลลัพธ์'));
    expect(screen.getByText('นำเข้าผลลัพธ์จากตลาด (CSV)')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    let closed = false;
    render(<ProductionCenterView assets={[]} onClose={() => (closed = true)} />);
    fireEvent.click(screen.getByText('← กลับ Portfolio Manager'));
    expect(closed).toBe(true);
  });
});
