import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollectionAssignmentDialog } from './CollectionAssignmentDialog';
import { createCollection } from '../../catalog/domain/collection';
import type { BulkMembershipResult } from '../../catalog/services/collectionService';

function emptyResult(requestedCount: number): BulkMembershipResult {
  return { requestedCount, changedCount: 0, skippedCount: 0, failedCount: 0, failures: [] };
}

describe('CollectionAssignmentDialog', () => {
  it('assign mode excludes archived collections from the pickable list (Rule 7)', () => {
    const active = createCollection({ name: 'Active' });
    const archived = { ...createCollection({ name: 'Archived' }), isArchived: true };
    render(
      <CollectionAssignmentDialog
        mode="assign"
        assetIds={['A1']}
        collections={[active, archived]}
        onConfirm={vi.fn().mockResolvedValue(emptyResult(1))}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
    expect(screen.getByText(/เก็บถาวรแล้ว 1 รายการ/)).toBeInTheDocument();
  });

  it('remove mode shows all collections, including archived (removal is always allowed)', () => {
    const archived = { ...createCollection({ name: 'Archived' }), isArchived: true };
    render(
      <CollectionAssignmentDialog
        mode="remove"
        assetIds={['A1']}
        collections={[archived]}
        onConfirm={vi.fn().mockResolvedValue(emptyResult(1))}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('confirm is disabled until at least one collection is checked, then calls onConfirm with the checked ids', async () => {
    const a = createCollection({ name: 'A' });
    const b = createCollection({ name: 'B' });
    const onConfirm = vi.fn().mockResolvedValue({ requestedCount: 1, changedCount: 1, skippedCount: 0, failedCount: 0, failures: [] });
    render(<CollectionAssignmentDialog mode="assign" assetIds={['A1']} collections={[a, b]} onConfirm={onConfirm} onClose={() => {}} />);

    const confirmButton = screen.getByText('ยืนยัน');
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByText('A'));
    expect(confirmButton).not.toBeDisabled();
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith([a.id]));
  });

  it('renders the requested/changed/skipped/failed summary after confirming, with readable failure reasons', async () => {
    const a = createCollection({ name: 'A' });
    const onConfirm = vi.fn().mockResolvedValue({
      requestedCount: 2,
      changedCount: 1,
      skippedCount: 0,
      failedCount: 1,
      failures: [{ assetId: 'A2', collectionId: a.id, reason: 'collection is archived' }],
    });
    render(<CollectionAssignmentDialog mode="assign" assetIds={['A1', 'A2']} collections={[a]} onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByText('A'));
    fireEvent.click(screen.getByText('ยืนยัน'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('รวม 2 รายการ'));
    expect(screen.getByRole('status')).toHaveTextContent('สำเร็จ 1');
    expect(screen.getByRole('status')).toHaveTextContent('ล้มเหลว 1');
    expect(screen.getByText(/คอลเลกชันถูกเก็บถาวรแล้ว/)).toBeInTheDocument();
    // No raw stack trace or internal error code leaks into the UI.
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it('shows a readable error (not a raw exception) if onConfirm rejects', async () => {
    const a = createCollection({ name: 'A' });
    const onConfirm = vi.fn().mockRejectedValue(new Error('เครือข่ายขัดข้อง'));
    render(<CollectionAssignmentDialog mode="assign" assetIds={['A1']} collections={[a]} onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByText('A'));
    fireEvent.click(screen.getByText('ยืนยัน'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('เครือข่ายขัดข้อง'));
  });
});
