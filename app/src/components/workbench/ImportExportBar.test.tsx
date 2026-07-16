import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { DEFAULT_WORKSPACE_SETTINGS } from '../../workbench/workspaceSettings';
import { ImportExportBar } from './ImportExportBar';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function baseProps() {
  return {
    spec: makeSpec(),
    onImportSpec: vi.fn(),
    onImportError: vi.fn(),
    selectedTrendPack: null,
    onImportTrendPack: vi.fn(),
    workspaceSettings: DEFAULT_WORKSPACE_SETTINGS,
    onImportWorkspaceSettings: vi.fn(),
    seed: 'import-export-bar-seed',
  };
}

describe('ImportExportBar: Export Design Spec / Collection Spec / Marketplace Profile', () => {
  it('Export Design Spec triggers a download when a spec is present', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ImportExportBar {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: '💾 Export Design Spec' }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('Export Collection Spec triggers a download when a spec is present', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ImportExportBar {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: '💾 Export Collection Spec' }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('Export buttons that need a spec are disabled when there is none', () => {
    render(<ImportExportBar {...baseProps()} spec={null} />);
    expect(screen.getByRole('button', { name: '💾 Export Design Spec' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '💾 Export Collection Spec' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '💾 Export Marketplace Profile' })).toBeDisabled();
  });
});

describe('ImportExportBar: Workspace Settings', () => {
  it('Export Workspace Settings triggers a download unconditionally', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ImportExportBar {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: '💾 Export Workspace Settings' }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('importing a valid Workspace Settings file calls onImportWorkspaceSettings with the parsed settings', async () => {
    const onImportWorkspaceSettings = vi.fn();
    render(<ImportExportBar {...baseProps()} onImportWorkspaceSettings={onImportWorkspaceSettings} />);
    const settings = { ...DEFAULT_WORKSPACE_SETTINGS, leftWidth: 400 };
    const file = new File([JSON.stringify(settings)], 'settings.json', { type: 'application/json' });

    const importButton = screen.getByRole('button', { name: '📂 Import Workspace Settings' });
    const fileInput = importButton.nextElementSibling as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await vi.waitFor(() => expect(onImportWorkspaceSettings).toHaveBeenCalledWith(settings));
  });

  it('importing malformed Workspace Settings JSON calls onImportError instead of onImportWorkspaceSettings', async () => {
    const onImportWorkspaceSettings = vi.fn();
    const onImportError = vi.fn();
    render(<ImportExportBar {...baseProps()} onImportWorkspaceSettings={onImportWorkspaceSettings} onImportError={onImportError} />);
    const file = new File(['not json'], 'settings.json', { type: 'application/json' });

    const importButton = screen.getByRole('button', { name: '📂 Import Workspace Settings' });
    const fileInput = importButton.nextElementSibling as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await vi.waitFor(() => expect(onImportError).toHaveBeenCalled());
    expect(onImportWorkspaceSettings).not.toHaveBeenCalled();
  });
});

describe('ImportExportBar: Marketplace Profile import (validate-only)', () => {
  it('importing a valid Marketplace Profile shows a success note without calling onImportError', async () => {
    render(<ImportExportBar {...baseProps()} />);
    const { MARKETPLACE_DATA_BY_ID } = await import('../../marketplaces');
    const file = new File([JSON.stringify(MARKETPLACE_DATA_BY_ID.shutterstock)], 'profile.json', { type: 'application/json' });

    const importButton = screen.getByRole('button', { name: '📂 Import Marketplace Profile' });
    const fileInput = importButton.nextElementSibling as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/valid Marketplace Profile/)).toBeInTheDocument();
  });
});
