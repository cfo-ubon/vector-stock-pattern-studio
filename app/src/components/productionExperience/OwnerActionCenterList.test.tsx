import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OwnerActionCenterList } from './OwnerActionCenterList';
import type { OwnerActionItem } from '../../productionExperience/ownerActionCenter';

describe('OwnerActionCenterList', () => {
  it('renders nothing at all when there are no real items', () => {
    const { container } = render(<OwnerActionCenterList items={[]} onAction={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders every real item and calls onAction with its type when clicked', () => {
    const items: OwnerActionItem[] = [
      { type: 'REVIEW_IMAGES', label: 'Review images', detail: '2 pattern(s) need a quick look before they can ship.', count: 2 },
      { type: 'EXPORT_PACKAGES', label: 'Export packages', detail: '1 package(s) are ready to export.', count: 1 },
    ];
    const onAction = vi.fn();
    render(<OwnerActionCenterList items={items} onAction={onAction} />);
    expect(screen.getByText('Review images')).toBeInTheDocument();
    expect(screen.getByText('Export packages')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open Review'));
    expect(onAction).toHaveBeenCalledWith('REVIEW_IMAGES');
    fireEvent.click(screen.getByText('Open Export'));
    expect(onAction).toHaveBeenCalledWith('EXPORT_PACKAGES');
  });

  it('disables every action button while busy', () => {
    const items: OwnerActionItem[] = [{ type: 'APPROVE_SESSION', label: "Approve today's production session", detail: 'x', count: 1 }];
    render(<OwnerActionCenterList items={items} onAction={() => {}} busy={true} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });
});
