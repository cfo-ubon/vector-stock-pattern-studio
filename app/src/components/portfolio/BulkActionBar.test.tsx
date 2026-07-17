import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from './BulkActionBar';

describe('BulkActionBar', () => {
  it('shows the real selected count', () => {
    render(<BulkActionBar selectedCount={3} onSelectVisible={() => {}} onClearSelection={() => {}} onAssign={() => {}} onRemove={() => {}} busy={false} />);
    expect(screen.getByText('เลือกแล้ว 3 รายการ')).toBeInTheDocument();
  });

  it('assign/remove buttons are disabled when nothing is selected', () => {
    render(<BulkActionBar selectedCount={0} onSelectVisible={() => {}} onClearSelection={() => {}} onAssign={() => {}} onRemove={() => {}} busy={false} />);
    expect(screen.getByText('เพิ่มเข้าคอลเลกชัน')).toBeDisabled();
    expect(screen.getByText('นำออกจากคอลเลกชัน')).toBeDisabled();
  });

  it('all controls are disabled while busy (prevents double-triggering an operation)', () => {
    render(<BulkActionBar selectedCount={2} onSelectVisible={() => {}} onClearSelection={() => {}} onAssign={() => {}} onRemove={() => {}} busy={true} />);
    expect(screen.getByText('เลือกที่แสดงอยู่ทั้งหมด')).toBeDisabled();
    expect(screen.getByText('ล้างการเลือก')).toBeDisabled();
    expect(screen.getByText('เพิ่มเข้าคอลเลกชัน')).toBeDisabled();
    expect(screen.getByText('นำออกจากคอลเลกชัน')).toBeDisabled();
  });

  it('calls the right handler for each button', () => {
    const onSelectVisible = vi.fn();
    const onClearSelection = vi.fn();
    const onAssign = vi.fn();
    const onRemove = vi.fn();
    render(<BulkActionBar selectedCount={1} onSelectVisible={onSelectVisible} onClearSelection={onClearSelection} onAssign={onAssign} onRemove={onRemove} busy={false} />);
    fireEvent.click(screen.getByText('เลือกที่แสดงอยู่ทั้งหมด'));
    fireEvent.click(screen.getByText('ล้างการเลือก'));
    fireEvent.click(screen.getByText('เพิ่มเข้าคอลเลกชัน'));
    fireEvent.click(screen.getByText('นำออกจากคอลเลกชัน'));
    expect(onSelectVisible).toHaveBeenCalled();
    expect(onClearSelection).toHaveBeenCalled();
    expect(onAssign).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });
});
