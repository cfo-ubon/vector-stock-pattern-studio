import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { runDesignSpecQualityLoop } from '../../trend/designSpecQuality';
import { QualityPanel } from './QualityPanel';

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

describe('QualityPanel: before a run', () => {
  it('shows a hint and no score grid when no quality result exists yet', () => {
    render(<QualityPanel qualityResult={null} qualityRunning={false} onRunQualityLoop={vi.fn()} />);
    expect(screen.getByText(/Run the Quality Loop/)).toBeInTheDocument();
    expect(screen.queryByText('Named Dimensions')).not.toBeInTheDocument();
  });

  it('disables the run button and shows a checking state while running', () => {
    render(<QualityPanel qualityResult={null} qualityRunning onRunQualityLoop={vi.fn()} />);
    expect(screen.getByRole('button', { name: '⏳ Checking…' })).toBeDisabled();
  });
});

describe('QualityPanel: with a result', () => {
  const spec = makeSpec();
  const result = runDesignSpecQualityLoop(spec, 'quality-panel-test-seed', 'fast');

  it('renders all 6 named dimensions from the real quality report', () => {
    render(<QualityPanel qualityResult={result} qualityRunning={false} onRunQualityLoop={vi.fn()} />);
    for (const label of ['Composition', 'Hierarchy', 'Overlap', 'Negative Space', 'Rhythm', 'Commercial Readiness']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders the exact overlap score from the report, not a recomputed value', () => {
    render(<QualityPanel qualityResult={result} qualityRunning={false} onRunQualityLoop={vi.fn()} />);
    const overlapRow = screen.getByText('Overlap').closest('.workbench-quality-score') as HTMLElement;
    expect(overlapRow.querySelector('strong')?.textContent).toBe(String(result.check.report.overlap));
  });

  it('shows the re-run label once a result exists', () => {
    render(<QualityPanel qualityResult={result} qualityRunning={false} onRunQualityLoop={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🎯 Re-run Quality Loop' })).toBeInTheDocument();
  });
});
