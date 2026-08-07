import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketplaceSelectionDialog } from './MarketplaceSelectionDialog';
import { EXPORT_MARKETPLACE_OPTIONS } from '../../commercial/exportWorkflow';

describe('MarketplaceSelectionDialog', () => {
  it('shows the asset count and every marketplace option', () => {
    render(<MarketplaceSelectionDialog assetCount={5} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/5 ชิ้นงานที่เลือก/)).toBeInTheDocument();
    for (const option of EXPORT_MARKETPLACE_OPTIONS) {
      expect(screen.getByText(option.label)).toBeInTheDocument();
    }
  });

  it('marks unwired marketplaces (Getty/Custom) with a generic-files badge', () => {
    render(<MarketplaceSelectionDialog assetCount={1} onConfirm={() => {}} onClose={() => {}} />);
    const badges = screen.getAllByText('ไฟล์ทั่วไป (ยังไม่มีโปรไฟล์เฉพาะ)');
    expect(badges).toHaveLength(EXPORT_MARKETPLACE_OPTIONS.filter((o) => !o.wired).length);
  });

  it('Export button is disabled until at least one marketplace is checked', () => {
    render(<MarketplaceSelectionDialog assetCount={1} onConfirm={() => {}} onClose={() => {}} />);
    const exportButton = screen.getByText('Export ไปยัง 0 มาร์เก็ตเพลส');
    expect(exportButton).toBeDisabled();
  });

  it('supports selecting multiple marketplaces and confirms with exactly those ids', () => {
    const onConfirm = vi.fn();
    render(<MarketplaceSelectionDialog assetCount={2} onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Shutterstock').closest('label')!.querySelector('input[type="checkbox"]')!);
    fireEvent.click(screen.getByText('Etsy').closest('label')!.querySelector('input[type="checkbox"]')!);
    const exportButton = screen.getByText('Export ไปยัง 2 มาร์เก็ตเพลส');
    fireEvent.click(exportButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(new Set(onConfirm.mock.calls[0][0])).toEqual(new Set(['shutterstock', 'etsy']));
  });

  it('disables all controls while busy', () => {
    render(<MarketplaceSelectionDialog assetCount={1} onConfirm={() => {}} onClose={() => {}} busy />);
    expect(screen.getByText('ปิด')).toBeDisabled();
    expect(screen.getByText('กำลัง Export…')).toBeDisabled();
  });
});
