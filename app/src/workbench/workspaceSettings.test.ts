import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  isPanelVisible,
  togglePanelVisibility,
  parseWorkspaceSettingsJson,
  serializeWorkspaceSettings,
  clampSidebarWidth,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  type WorkspaceSettings,
} from './workspaceSettings';

beforeEach(() => {
  localStorage.clear();
});

describe('clampSidebarWidth', () => {
  it('clamps below the minimum', () => {
    expect(clampSidebarWidth(10)).toBe(MIN_SIDEBAR_WIDTH);
  });
  it('clamps above the maximum', () => {
    expect(clampSidebarWidth(9999)).toBe(MAX_SIDEBAR_WIDTH);
  });
  it('passes through an in-range value (rounded)', () => {
    expect(clampSidebarWidth(300.6)).toBe(301);
  });
});

describe('loadWorkspaceSettings / saveWorkspaceSettings', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(loadWorkspaceSettings()).toEqual(DEFAULT_WORKSPACE_SETTINGS);
  });

  it('round-trips a saved settings object', () => {
    const custom: WorkspaceSettings = { ...DEFAULT_WORKSPACE_SETTINGS, theme: 'light', leftWidth: 350, hiddenPanels: ['prompt'] };
    saveWorkspaceSettings(custom);
    expect(loadWorkspaceSettings()).toEqual(custom);
  });

  it('recovers to defaults on corrupt stored JSON instead of throwing', () => {
    localStorage.setItem('vsp-workbench-settings', 'not json{{{');
    expect(() => loadWorkspaceSettings()).not.toThrow();
    expect(loadWorkspaceSettings()).toEqual(DEFAULT_WORKSPACE_SETTINGS);
  });

  it('defensively fills in missing fields from a partial stored object', () => {
    localStorage.setItem('vsp-workbench-settings', JSON.stringify({ theme: 'light' }));
    const loaded = loadWorkspaceSettings();
    expect(loaded.theme).toBe('light');
    expect(loaded.leftWidth).toBe(DEFAULT_WORKSPACE_SETTINGS.leftWidth);
    expect(loaded.hiddenPanels).toEqual([]);
  });

  it('drops unknown panel ids from a corrupted hiddenPanels list', () => {
    localStorage.setItem('vsp-workbench-settings', JSON.stringify({ hiddenPanels: ['prompt', 'not-a-real-panel'] }));
    expect(loadWorkspaceSettings().hiddenPanels).toEqual(['prompt']);
  });
});

describe('isPanelVisible / togglePanelVisibility', () => {
  it('every panel is visible by default', () => {
    expect(isPanelVisible(DEFAULT_WORKSPACE_SETTINGS, 'quality')).toBe(true);
  });

  it('toggling hides a visible panel and toggling again restores it', () => {
    const hidden = togglePanelVisibility(DEFAULT_WORKSPACE_SETTINGS, 'quality');
    expect(isPanelVisible(hidden, 'quality')).toBe(false);
    const restored = togglePanelVisibility(hidden, 'quality');
    expect(isPanelVisible(restored, 'quality')).toBe(true);
  });

  it('hiding the active right-sidebar tab falls back to the first visible one', () => {
    const settings: WorkspaceSettings = { ...DEFAULT_WORKSPACE_SETTINGS, rightTab: 'preview' };
    const next = togglePanelVisibility(settings, 'preview');
    expect(next.rightTab).not.toBe('preview');
    expect(isPanelVisible(next, next.rightTab)).toBe(true);
  });

  it('hiding the active left-sidebar tab falls back to the first visible one', () => {
    const settings: WorkspaceSettings = { ...DEFAULT_WORKSPACE_SETTINGS, leftTab: 'favorites' };
    const next = togglePanelVisibility(settings, 'favorites');
    expect(next.leftTab).not.toBe('favorites');
    expect(isPanelVisible(next, next.leftTab)).toBe(true);
  });

  it('hiding a panel that is not the active tab does not change the active tab', () => {
    const settings: WorkspaceSettings = { ...DEFAULT_WORKSPACE_SETTINGS, rightTab: 'preview' };
    const next = togglePanelVisibility(settings, 'quality');
    expect(next.rightTab).toBe('preview');
  });
});

describe('parseWorkspaceSettingsJson / serializeWorkspaceSettings (Section 10 export/import)', () => {
  it('round-trips through serialize -> parse', () => {
    const custom: WorkspaceSettings = { ...DEFAULT_WORKSPACE_SETTINGS, theme: 'light', hiddenPanels: ['history', 'validation'] };
    const json = serializeWorkspaceSettings(custom);
    expect(parseWorkspaceSettingsJson(json)).toEqual(custom);
  });

  it('throws on genuinely malformed JSON (not silently swallowed)', () => {
    expect(() => parseWorkspaceSettingsJson('{not valid')).toThrow();
  });

  it('defensively normalizes a hand-edited/partial import', () => {
    const loaded = parseWorkspaceSettingsJson(JSON.stringify({ leftWidth: 9999 }));
    expect(loaded.leftWidth).toBe(MAX_SIDEBAR_WIDTH);
    expect(loaded.theme).toBe('dark');
  });
});
