import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { MarketplacePanel } from './MarketplacePanel';

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

describe('MarketplacePanel', () => {
  it('renders a real Readiness Score in the 0-100 range', () => {
    const spec = makeSpec();
    render(<MarketplacePanel spec={spec} seed="marketplace-panel-seed" qualityResult={null} />);
    const heading = screen.getByText(/📊 Readiness Score/);
    const match = heading.textContent!.match(/(\d+)\/100/);
    expect(match).not.toBeNull();
    const score = Number(match![1]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('switching the marketplace chip recomputes the filename against the new profile', () => {
    const spec = makeSpec();
    render(<MarketplacePanel spec={spec} seed="marketplace-panel-seed-2" qualityResult={null} />);

    fireEvent.click(screen.getByRole('button', { name: /Etsy/ }));

    fireEvent.click(screen.getByText('🏷 Filename Hints'));
    const filenameInput = document.querySelector('.marketplace-filename-input') as HTMLInputElement;
    expect(filenameInput.value.toLowerCase()).toContain('svg');
  });

  it('shows the Submission Checklist section with at least one real item', () => {
    const spec = makeSpec();
    render(<MarketplacePanel spec={spec} seed="marketplace-panel-seed-3" qualityResult={null} />);
    fireEvent.click(screen.getByText('📋 Submission Checklist'));
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });
});
