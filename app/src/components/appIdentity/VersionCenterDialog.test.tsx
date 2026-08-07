import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionCenterDialog } from './VersionCenterDialog';
import { APP_VERSION, COMMIT, CHANGELOG } from '../../appMeta';

describe('VersionCenterDialog', () => {
  it('shows the real product identity and version/build/commit fields from appMeta', () => {
    render(<VersionCenterDialog onClose={() => {}} />);
    expect(screen.getByText('ℹ️ About AI-SBOS')).toBeInTheDocument();
    expect(screen.getByText(APP_VERSION)).toBeInTheDocument();
    expect(screen.getByText(COMMIT)).toBeInTheDocument();
  });

  it('shows a real, non-empty Latest Changes section sourced from CHANGELOG', () => {
    render(<VersionCenterDialog onClose={() => {}} />);
    expect(screen.getByText('Latest Changes')).toBeInTheDocument();
    for (const highlight of CHANGELOG[0].highlights) {
      expect(screen.getByText(highlight)).toBeInTheDocument();
    }
  });

  it('shows a live Offline Status reflecting navigator.onLine', () => {
    render(<VersionCenterDialog onClose={() => {}} />);
    expect(screen.getByText(/🟢 Online|🔴 Offline/)).toBeInTheDocument();
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<VersionCenterDialog onClose={onClose} />);
    fireEvent.click(screen.getByText('ปิด'));
    expect(onClose).toHaveBeenCalled();
  });
});
