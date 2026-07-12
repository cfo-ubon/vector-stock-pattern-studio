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

describe('LivePreviewPanel: Design Critic quality gate (Phase 7)', () => {
  function failingQualitySpec() {
    const props = baseProps();
    // An unreachable target reliably fails `meetsTargets`, which is the
    // exact field the quality gate's `meetsCommercialBar` mirrors — no
    // need to engineer a genuinely ugly tile to exercise the gate.
    const spec = { ...props.spec, qualityTargets: { minOverallScore: 999, minSeamlessIntegrity: 0, minMotifDiversity: 0, minCommercialReadiness: 0 } };
    return { props, spec };
  }

  it('does not prompt for confirmation when no quality result has been computed yet', () => {
    const props = baseProps();
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<LivePreviewPanel {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: '🏷 Filename' }));
    fireEvent.click(screen.getByRole('button', { name: /Download Marketplace Package/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(props.onDownloadPackage).toHaveBeenCalledOnce();
    confirmSpy.mockRestore();
  });

  it('gates Download Marketplace Package behind a confirm when the quality gate fails, and blocks the download on Cancel', () => {
    const { props, spec } = failingQualitySpec();
    const qualityResult = runDesignSpecQualityLoop(spec, props.seed, 'fast');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LivePreviewPanel {...props} spec={spec} qualityResult={qualityResult} />);
    fireEvent.click(screen.getByRole('tab', { name: '🏷 Filename' }));
    expect(screen.getByText(/quality targets/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Download Marketplace Package/ }));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(props.onDownloadPackage).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('lets the download proceed when the user confirms past a failed quality gate', () => {
    const { props, spec } = failingQualitySpec();
    const qualityResult = runDesignSpecQualityLoop(spec, props.seed, 'fast');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LivePreviewPanel {...props} spec={spec} qualityResult={qualityResult} />);
    fireEvent.click(screen.getByRole('tab', { name: '🏷 Filename' }));
    fireEvent.click(screen.getByRole('button', { name: /Download Marketplace Package/ }));
    expect(props.onDownloadPackage).toHaveBeenCalledOnce();
    confirmSpy.mockRestore();
  });

  it('gates Generate Collection behind the same confirm when the quality gate fails', () => {
    const { props, spec } = failingQualitySpec();
    const qualityResult = runDesignSpecQualityLoop(spec, props.seed, 'fast');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LivePreviewPanel {...props} spec={spec} qualityResult={qualityResult} />);
    fireEvent.click(screen.getByRole('tab', { name: '🏭 Collection' }));
    fireEvent.click(screen.getByRole('button', { name: /Generate Collection/ }));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(props.onGenerateCollection).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('does not prompt when the quality gate passes', () => {
    const props = baseProps();
    const qualityResult = runDesignSpecQualityLoop(props.spec, props.seed, 'fast');
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<LivePreviewPanel {...props} qualityResult={qualityResult} />);
    fireEvent.click(screen.getByRole('tab', { name: '🏷 Filename' }));
    fireEvent.click(screen.getByRole('button', { name: /Download Marketplace Package/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(props.onDownloadPackage).toHaveBeenCalledOnce();
    confirmSpy.mockRestore();
  });
});
