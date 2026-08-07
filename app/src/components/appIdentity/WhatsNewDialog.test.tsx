import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WhatsNewDialog } from './WhatsNewDialog';
import { APP_VERSION, CHANGELOG } from '../../appMeta';
import { shouldShowWhatsNew, isDontShowAgainEnabled } from './whatsNewStore';

beforeEach(() => {
  localStorage.clear();
});

describe('WhatsNewDialog', () => {
  it('shows the real latest CHANGELOG entry, the same data source the Version Center reads', () => {
    render(<WhatsNewDialog onDismiss={() => {}} />);
    expect(screen.getByText(`✨ What's New — v${CHANGELOG[0].version}`)).toBeInTheDocument();
    for (const highlight of CHANGELOG[0].highlights) {
      expect(screen.getByText(highlight)).toBeInTheDocument();
    }
  });

  it('marks the current version seen and calls onDismiss when closed', () => {
    const onDismiss = vi.fn();
    render(<WhatsNewDialog onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('เข้าใจแล้ว'));
    expect(onDismiss).toHaveBeenCalled();
    expect(shouldShowWhatsNew(APP_VERSION)).toBe(false);
  });

  it('persists "don\'t show again" only when the checkbox is checked before closing', () => {
    render(<WhatsNewDialog onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('เข้าใจแล้ว'));
    expect(isDontShowAgainEnabled()).toBe(true);
  });

  it('does not set "don\'t show again" when the checkbox is left unchecked', () => {
    render(<WhatsNewDialog onDismiss={() => {}} />);
    fireEvent.click(screen.getByText('เข้าใจแล้ว'));
    expect(isDontShowAgainEnabled()).toBe(false);
  });
});
