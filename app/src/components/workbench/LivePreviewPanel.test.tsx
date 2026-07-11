import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { runDesignSpecQualityLoop } from '../../trend/designSpecQuality';
import { LivePreviewPanel } from './LivePreviewPanel';

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

function baseProps() {
  return {
    spec: makeSpec(),
    seed: 'live-preview-panel-seed',
    onRerollSeed: vi.fn(),
    onApplyToEditor: vi.fn(),
    onRunQualityLoop: vi.fn(),
    qualityResult: null,
    qualityRunning: false,
    onGenerateCollection: vi.fn(),
    collectionStatus: 'idle' as const,
    onDownloadPackage: vi.fn(),
  };
}

describe('LivePreviewPanel: tabs (Phase 6)', () => {
  it('has a Pattern Repeat tab and no Prompt tab (promoted to its own standalone panel)', () => {
    render(<LivePreviewPanel {...baseProps()} />);
    expect(screen.getByRole('tab', { name: '🔁 Pattern Repeat' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Prompt/ })).not.toBeInTheDocument();
  });

  it('opening the Pattern Repeat tab renders a real 3x3 tiled SVG', () => {
    render(<LivePreviewPanel {...baseProps()} />);
    fireEvent.click(screen.getByRole('tab', { name: '🔁 Pattern Repeat' }));
    const svgContainer = screen.getByText(/3×3 tiled/).closest('.collection-asset-preview') as HTMLElement;
    expect(svgContainer.querySelector('svg')).not.toBeNull();
  });

  it('clicking Run Quality Loop on the Composition tab calls onRunQualityLoop', () => {
    const props = baseProps();
    render(<LivePreviewPanel {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: '🖼 Composition' }));
    fireEvent.click(screen.getByRole('button', { name: /Run Quality Loop/ }));
    expect(props.onRunQualityLoop).toHaveBeenCalledOnce();
  });

  it('once a quality result exists, the Composition tab points to the Quality Panel for full scoring instead of duplicating it', () => {
    const props = baseProps();
    const qualityResult = runDesignSpecQualityLoop(props.spec, props.seed, 'fast');
    render(<LivePreviewPanel {...props} qualityResult={qualityResult} />);
    fireEvent.click(screen.getByRole('tab', { name: '🖼 Composition' }));
    expect(screen.getByText(/Full scoring, all 6 named dimensions, and recommendations live in the Quality Panel/)).toBeInTheDocument();
  });
});
