import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { DEFAULT_WORKSPACE_SETTINGS, LEFT_PANEL_IDS, RIGHT_PANEL_IDS } from '../../workbench/workspaceSettings';
import { PanelVisibilityBar } from './PanelVisibilityBar';

describe('PanelVisibilityBar', () => {
  it('renders one chip per panel across both sidebars', () => {
    render(<PanelVisibilityBar settings={DEFAULT_WORKSPACE_SETTINGS} onToggle={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(LEFT_PANEL_IDS.length + RIGHT_PANEL_IDS.length);
  });

  it('every chip is pressed (visible) by default', () => {
    render(<PanelVisibilityBar settings={DEFAULT_WORKSPACE_SETTINGS} onToggle={vi.fn()} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('a hidden panel renders its chip as not pressed', () => {
    const settings = { ...DEFAULT_WORKSPACE_SETTINGS, hiddenPanels: ['quality' as const] };
    render(<PanelVisibilityBar settings={settings} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /🎯 Quality/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a chip calls onToggle with that panel id', () => {
    const onToggle = vi.fn();
    render(<PanelVisibilityBar settings={DEFAULT_WORKSPACE_SETTINGS} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /🎯 Quality/ }));
    expect(onToggle).toHaveBeenCalledWith('quality');
  });
});
