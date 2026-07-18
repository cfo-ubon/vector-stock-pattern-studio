import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioSidebar } from './PortfolioSidebar';
import type { DashboardSummary } from '../../catalog/services/dashboard';

function makeSummary(): DashboardSummary {
  return {
    totalAssets: 12,
    activeAssets: 10,
    archivedAssets: 2,
    readyForReview: 3,
    readyToUpload: 1,
    submitted: 2,
    approved: 4,
    rejected: 0,
    missingPreview: 1,
    duplicateWarnings: 2,
    recentlyImported: [],
  };
}

describe('PortfolioSidebar', () => {
  it('renders dashboard numbers straight from the supplied summary (no hard-coded values)', () => {
    render(<PortfolioSidebar summary={makeSummary()} query={{}} onChange={() => {}} onOpenImport={() => {}} onOpenHealthCheck={() => {}} collections={[]} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders nothing in the summary section when summary is null', () => {
    render(<PortfolioSidebar summary={null} query={{}} onChange={() => {}} onOpenImport={() => {}} onOpenHealthCheck={() => {}} collections={[]} />);
    expect(screen.queryByText('ภาพรวมคลัง')).not.toBeInTheDocument();
  });

  it('toggling a workflow-status checkbox calls onChange with that status added', () => {
    const onChange = vi.fn();
    render(<PortfolioSidebar summary={null} query={{}} onChange={onChange} onOpenImport={() => {}} onOpenHealthCheck={() => {}} collections={[]} />);
    fireEvent.click(screen.getByText('อนุมัติแล้ว'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ workflowStatus: ['APPROVED'] }));
  });

  it('toggling an already-active workflow-status checkbox off removes it (and clears to undefined when empty)', () => {
    const onChange = vi.fn();
    render(
      <PortfolioSidebar summary={null} query={{ workflowStatus: ['APPROVED'] }} onChange={onChange} onOpenImport={() => {}} onOpenHealthCheck={() => {}} collections={[]} />,
    );
    fireEvent.click(screen.getByText('อนุมัติแล้ว'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ workflowStatus: undefined }));
  });

  it('changing the archived-filter select calls onChange with the new value', () => {
    const onChange = vi.fn();
    render(<PortfolioSidebar summary={null} query={{}} onChange={onChange} onOpenImport={() => {}} onOpenHealthCheck={() => {}} collections={[]} />);
    fireEvent.change(screen.getByDisplayValue('เฉพาะที่ใช้งานอยู่'), { target: { value: 'archived' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ archived: 'archived' }));
  });

  it('the "only duplicates" checkbox calls onChange with onlyDuplicates true', () => {
    const onChange = vi.fn();
    render(<PortfolioSidebar summary={null} query={{}} onChange={onChange} onOpenImport={() => {}} onOpenHealthCheck={() => {}} collections={[]} />);
    fireEvent.click(screen.getByText('เฉพาะที่อาจซ้ำ'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onlyDuplicates: true }));
  });

  it('clicking the import and health-check buttons call their handlers', () => {
    const onOpenImport = vi.fn();
    const onOpenHealthCheck = vi.fn();
    render(<PortfolioSidebar summary={null} query={{}} onChange={() => {}} onOpenImport={onOpenImport} onOpenHealthCheck={onOpenHealthCheck} collections={[]} />);
    fireEvent.click(screen.getByText('+ นำเข้าไฟล์'));
    fireEvent.click(screen.getByText('ตรวจสุขภาพคลัง'));
    expect(onOpenImport).toHaveBeenCalled();
    expect(onOpenHealthCheck).toHaveBeenCalled();
  });
});
