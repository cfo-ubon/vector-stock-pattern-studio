import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StorageCleanupPanel } from './StorageCleanupPanel';
import { addBackupHistoryRecord, clearBackupHistoryStore, listBackupHistory } from '../../backup/appBackupHistoryStore';

async function seedHistory(count: number) {
  for (let i = 0; i < count; i++) {
    await addBackupHistoryRecord({
      historyId: `h${i}`,
      createdAt: i,
      fileName: `backup-${i}.vspsb`,
      destination: 'This device',
      result: 'success',
      durationMs: 10,
      trigger: 'manual',
      dbVersion: 7,
      fileCount: 1,
      assetFileCount: 0,
      originalSize: 100,
      compressedSize: 50,
      blob: new Blob(['x']),
    });
  }
}

beforeEach(async () => {
  await clearBackupHistoryStore();
});

describe('StorageCleanupPanel', () => {
  it('shows the current backup history count and size', async () => {
    await seedHistory(3);
    render(<StorageCleanupPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('3', { exact: false })).toBeTruthy());
  });

  it('pruning to a smaller retention removes older non-safety entries and reports the count', async () => {
    await seedHistory(8);
    render(<StorageCleanupPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/8/)).toBeTruthy());

    fireEvent.click(screen.getByText('เก็บล่าสุด 5 รายการ'));

    await waitFor(async () => {
      expect(await listBackupHistory()).toHaveLength(5);
    });
    await waitFor(() => expect(screen.getByText(/ลบประวัติสำรองเก่าไป 3 รายการ/)).toBeTruthy());
  });

  it('calls onClose when the close button is clicked', () => {
    let closed = false;
    render(<StorageCleanupPanel onClose={() => (closed = true)} />);
    fireEvent.click(screen.getByLabelText('ปิด'));
    expect(closed).toBe(true);
  });
});
