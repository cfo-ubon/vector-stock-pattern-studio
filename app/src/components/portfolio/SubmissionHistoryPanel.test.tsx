import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubmissionHistoryPanel } from './SubmissionHistoryPanel';
import { createSubmissionRecord } from '../../catalog/submission/submissionRecord';

describe('SubmissionHistoryPanel', () => {
  it('shows an honest empty state when there is no submission history', () => {
    render(<SubmissionHistoryPanel displayName="Test Asset" submissions={[]} onClose={() => {}} />);
    expect(screen.getByText('ยังไม่มีประวัติการส่งขายชิ้นงานนี้')).toBeInTheDocument();
  });

  it('lists submissions sorted by most recently updated first, with marketplace label and status', () => {
    const older = createSubmissionRecord({ patternId: 'a', marketplaceId: 'shutterstock', now: 1000 });
    const newer = { ...createSubmissionRecord({ patternId: 'a', marketplaceId: 'etsy', now: 2000 }), status: 'SUBMITTED' as const };
    render(<SubmissionHistoryPanel displayName="Test Asset" submissions={[older, newer]} onClose={() => {}} />);

    const rows = screen.getAllByRole('row').slice(1); // skip header row
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Etsy');
    expect(rows[0]).toHaveTextContent('ส่งแล้ว');
    expect(rows[1]).toHaveTextContent('Shutterstock');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<SubmissionHistoryPanel displayName="Test Asset" submissions={[]} onClose={onClose} />);
    screen.getByText('ปิด').click();
    expect(onClose).toHaveBeenCalled();
  });
});
